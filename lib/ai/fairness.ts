/**
 * Auto-balance & fairness engine: real analysis of mission distribution
 * across kids, with concrete rebalancing proposals and AI-assisted coaching.
 *
 * This is the analysis core shared by the Parent Review UI (Parent Review →
 * Fair mission assignment) and unit tests. Pure functions only — no DOM, no
 * network. The AI coaching layer follows the same parent-side pattern as the
 * other /api/ai helpers: coarse aggregates only, never a child's name or any
 * other kid PII; any failure falls back to an honest templated tip.
 */
import type { Child, Mission } from "../types";
import { IDEA_AGE_BANDS, type IdeaAgeBand } from "./ideas";

export type FairnessDifficulty = "easy" | "medium" | "hard" | "super_hard";
export type FairnessSkillKey = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";

/** Same thresholds as the app's difficultyAgeGuidance (kept in sync deliberately). */
export const FAIRNESS_MIN_AGE: Record<FairnessDifficulty, number> = {
  easy: 4,
  medium: 7,
  hard: 10,
  super_hard: 13,
};

const DIFFICULTY_WEIGHT: Record<FairnessDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  super_hard: 4,
};

/** Points spread the engine considers "balanced" — matches the UI's 8-point rule. */
export const FAIRNESS_BALANCED_SPREAD = 8;

/** Max rebalancing moves proposed in one plan. */
export const FAIRNESS_MAX_MOVES = 3;

/** Mirrors getMissionLifeSkill in the app: category → trackable skill. */
export function fairnessMissionSkill(mission: Mission): FairnessSkillKey {
  if (mission.category === "kindness") return "empathy";
  if (mission.category === "community") return "teamwork";
  if (mission.category === "money") return "leadership";
  if (mission.category === "chore") return "time";
  return "responsibility";
}

export interface FairnessKidStat {
  childId: string;
  name: string;
  age: number;
  ageBand: IdeaAgeBand;
  /** Planned points from open (non-approved) missions. */
  plannedPoints: number;
  /** Open missions not yet started/completed. */
  openCount: number;
  /** Completed missions awaiting parent approval. */
  awaitingApproval: number;
  /** Weighted average difficulty (easy=1 … super_hard=4), 0 when no open missions. */
  avgDifficulty: number;
  byDifficulty: Record<FairnessDifficulty, number>;
  skillPoints: Record<FairnessSkillKey, number>;
}

export interface RebalanceMove {
  missionId: string;
  title: string;
  points: number;
  difficulty: FairnessDifficulty;
  fromChildId: string;
  fromName: string;
  toChildId: string;
  toName: string;
  reason: string;
}

export interface FairnessAnalysis {
  kids: FairnessKidStat[];
  spread: number;
  balanced: boolean;
  topKidId: string | null;
  bottomKidId: string | null;
  moves: RebalanceMove[];
  insight: string;
}

function emptySkillPoints(): Record<FairnessSkillKey, number> {
  return { responsibility: 0, empathy: 0, teamwork: 0, leadership: 0, time: 0 };
}

function ageBandFor(age: number): IdeaAgeBand {
  if (!Number.isFinite(age) || age <= 6) return "4-6";
  if (age <= 9) return "7-9";
  return "10-12";
}

function isOpen(mission: Mission): boolean {
  return mission.status !== "approved" && Boolean(mission.assignedChildId);
}

function isMovable(mission: Mission): boolean {
  return isOpen(mission) && !mission.completedBy;
}

/**
 * Analyze planned mission load across kids and propose concrete rebalancing
 * moves. Greedy: while the points spread exceeds the balanced threshold,
 * move the open mission from the heaviest kid to the lightest kid that best
 * closes the gap (age-fit for the receiving kid, never a completed mission).
 */
export function analyzeFairness(missions: Mission[], children: Child[]): FairnessAnalysis {
  const kids: FairnessKidStat[] = children.map((child) => {
    const open = missions.filter((m) => isOpen(m) && m.assignedChildId === child.id);
    const plannedPoints = open.reduce((sum, m) => sum + m.points, 0);
    const awaitingApproval = missions.filter(
      (m) => m.assignedChildId === child.id && m.status === "pending" && m.completedBy,
    ).length;
    const byDifficulty: Record<FairnessDifficulty, number> = { easy: 0, medium: 0, hard: 0, super_hard: 0 };
    const skillPoints = emptySkillPoints();
    let weightSum = 0;
    for (const mission of open) {
      byDifficulty[mission.difficulty] = (byDifficulty[mission.difficulty] ?? 0) + 1;
      weightSum += DIFFICULTY_WEIGHT[mission.difficulty] ?? 1;
      skillPoints[fairnessMissionSkill(mission)] += mission.points;
    }
    return {
      childId: child.id,
      name: child.name,
      age: child.age,
      ageBand: ageBandFor(child.age),
      plannedPoints,
      openCount: open.filter((m) => !m.completedBy).length,
      awaitingApproval,
      avgDifficulty: open.length ? weightSum / open.length : 0,
      byDifficulty,
      skillPoints,
    };
  });

  const sorted = [...kids].sort((a, b) => a.plannedPoints - b.plannedPoints);
  const lowest = sorted[0] ?? null;
  const highest = sorted[sorted.length - 1] ?? null;
  const spread = highest && lowest && kids.length > 1 ? highest.plannedPoints - lowest.plannedPoints : 0;
  const balanced = spread <= FAIRNESS_BALANCED_SPREAD;

  const moves: RebalanceMove[] = [];
  if (kids.length > 1) {
    // Virtual ledger so proposed moves chain correctly.
    const virtual = new Map<string, number>(kids.map((k) => [k.childId, k.plannedPoints]));
    const movedMissionIds = new Set<string>();
    for (let step = 0; step < FAIRNESS_MAX_MOVES; step += 1) {
      const ranked = [...virtual.entries()].sort((a, b) => a[1] - b[1]);
      const [bottomId, bottomPts] = ranked[0];
      const [topId, topPts] = ranked[ranked.length - 1];
      const gap = topPts - bottomPts;
      if (gap <= FAIRNESS_BALANCED_SPREAD) break;
      const topKid = kids.find((k) => k.childId === topId);
      const bottomKid = kids.find((k) => k.childId === bottomId);
      if (!topKid || !bottomKid) break;
      const candidates = missions
        .filter(
          (m) =>
            isMovable(m) &&
            m.assignedChildId === topId &&
            !movedMissionIds.has(m.id) &&
            (FAIRNESS_MIN_AGE[m.difficulty] ?? 4) <= bottomKid.age,
        )
        .sort((a, b) => {
          // Prefer the mission whose points best close the gap without overshooting.
          const score = (m: Mission) =>
            m.points <= gap ? gap - m.points : 1000 + (m.points - gap);
          return score(a) - score(b) || a.points - b.points;
        });
      const pick = candidates[0];
      if (!pick) break;
      movedMissionIds.add(pick.id);
      virtual.set(topId, topPts - pick.points);
      virtual.set(bottomId, bottomPts + pick.points);
      moves.push({
        missionId: pick.id,
        title: pick.title,
        points: pick.points,
        difficulty: pick.difficulty,
        fromChildId: topId,
        fromName: topKid.name,
        toChildId: bottomId,
        toName: bottomKid.name,
        reason:
          pick.points <= gap
            ? `Moves ${pick.points} pts — closes the ${gap}-point gap without overshooting.`
            : `Smallest age-fit option (${pick.points} pts); slightly over-corrects the ${gap}-point gap.`,
      });
    }
  }

  let insight: string;
  if (kids.length < 2) {
    insight = "Add a second kid profile to compare workloads across kids.";
  } else if (balanced) {
    insight = `Balanced: the heaviest and lightest plans are ${spread} points apart (within the ${FAIRNESS_BALANCED_SPREAD}-point rule).`;
  } else if (moves.length) {
    insight = `${highest?.name ?? "One kid"} carries ${spread} more planned points than ${lowest?.name ?? "another"}. ${moves.length} move${moves.length === 1 ? "" : "s"} proposed below.`;
  } else {
    insight = `${highest?.name ?? "One kid"} carries ${spread} more planned points than ${lowest?.name ?? "another"}, but no open, age-fit mission can move — try assigning new missions to ${lowest?.name ?? "them"}.`;
  }

  return {
    kids,
    spread,
    balanced,
    topKidId: highest?.childId ?? null,
    bottomKidId: lowest?.childId ?? null,
    moves,
    insight,
  };
}

/** Honest local fallback: templated coaching derived from the real analysis. */
export function fairnessCoachFallback(analysis: FairnessAnalysis): string {
  const { kids, balanced, moves } = analysis;
  if (kids.length < 2) return "With one kid profile, every mission belongs to them — no balancing needed yet.";
  const skillGaps = kids
    .map((kid) => {
      const entries = (Object.entries(kid.skillPoints) as [FairnessSkillKey, number][]).sort((a, b) => a[1] - b[1]);
      return entries[0][1] === 0 ? `${kid.name}: no ${entries[0][0]} points planned` : null;
    })
    .filter(Boolean);
  const parts = [analysis.insight];
  if (moves.length) {
    parts.push(
      `Start with “${moves[0].title}” (${moves[0].points} pts) from ${moves[0].fromName} → ${moves[0].toName}.`,
    );
  }
  if (skillGaps.length) parts.push(`Skill gaps to watch: ${skillGaps.join("; ")}.`);
  if (balanced) parts.push("Keep harder work worth more — balance points, not difficulty.");
  return parts.join(" ");
}

/** Anonymized aggregates sent to the AI coach — no names, no IDs, no kid PII. */
export interface FairnessCoachingPayload {
  spread: number;
  balanced: boolean;
  perKid: { ageBand: IdeaAgeBand; plannedPoints: number; openCount: number; avgDifficulty: number; topSkill: FairnessSkillKey }[];
}

export function fairnessCoachingPayload(analysis: FairnessAnalysis): FairnessCoachingPayload {
  return {
    spread: analysis.spread,
    balanced: analysis.balanced,
    perKid: analysis.kids.map((kid) => {
      const topSkill = (Object.entries(kid.skillPoints) as [FairnessSkillKey, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "responsibility";
      return {
        ageBand: kid.ageBand,
        plannedPoints: kid.plannedPoints,
        openCount: kid.openCount,
        avgDifficulty: Math.round(kid.avgDifficulty * 10) / 10,
        topSkill,
      };
    }),
  };
}

export type FairnessCoachingValidation =
  | { ok: true; value: FairnessCoachingPayload }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value);
}

/** Strictly validate an incoming `/api/ai/fairness-coaching` JSON body. */
export function validateFairnessCoachingInput(body: unknown): FairnessCoachingValidation {
  if (!isRecord(body)) return { ok: false, error: "Request body must be a JSON object." };
  const { spread, balanced, perKid } = body;
  if (typeof spread !== "number" || !Number.isFinite(spread) || spread < 0) {
    return { ok: false, error: "spread must be a non-negative number." };
  }
  if (typeof balanced !== "boolean") return { ok: false, error: "balanced must be a boolean." };
  if (!Array.isArray(perKid) || perKid.length === 0 || perKid.length > 8) {
    return { ok: false, error: "perKid must be a non-empty array (max 8)." };
  }
  const skills: FairnessSkillKey[] = ["responsibility", "empathy", "teamwork", "leadership", "time"];
  const clean = [];
  for (const entry of perKid) {
    if (!isRecord(entry)) return { ok: false, error: "Each perKid entry must be an object." };
    const { ageBand, plannedPoints, openCount, avgDifficulty, topSkill } = entry;
    if (typeof ageBand !== "string" || !(IDEA_AGE_BANDS as readonly string[]).includes(ageBand)) {
      return { ok: false, error: "perKid[].ageBand must be a valid age band." };
    }
    if (typeof plannedPoints !== "number" || typeof openCount !== "number" || typeof avgDifficulty !== "number") {
      return { ok: false, error: "perKid[] must carry numeric plannedPoints, openCount, avgDifficulty." };
    }
    if (typeof topSkill !== "string" || !skills.includes(topSkill as FairnessSkillKey)) {
      return { ok: false, error: "perKid[].topSkill must be a valid skill." };
    }
    clean.push({ ageBand, plannedPoints, openCount, avgDifficulty, topSkill: topSkill as FairnessSkillKey });
  }
  return { ok: true, value: { spread, balanced, perKid: clean } };
}

export function buildFairnessCoachingSystemPrompt(): string {
  return [
    "You coach a parent on fairly splitting chores across their kids.",
    "Given anonymized workload aggregates (no names), reply with 2-3 short, warm, concrete sentences:",
    "what is balanced or off, one specific fix (move a harder task, add points, split a big task), and one encouragement.",
    "Never rank the kids against each other. Output plain text only, max 60 words.",
  ].join("\n");
}

export function buildFairnessCoachingUserMessage(payload: FairnessCoachingPayload): string {
  const lines = payload.perKid.map(
    (kid, i) => `Kid ${i + 1} (${kid.ageBand}): ${kid.plannedPoints} planned pts, ${kid.openCount} open tasks, avg difficulty ${kid.avgDifficulty}/4, strongest skill ${kid.topSkill}`,
  );
  return [`Points spread between kids: ${payload.spread} (balanced: ${payload.balanced})`, ...lines].join("\n");
}

export interface FetchFairnessCoachingOptions {
  fetchFn?: typeof fetch;
  token: string;
  analysis: FairnessAnalysis;
  endpoint?: string;
}

export type FetchFairnessCoachingResult = { ok: true; tip: string } | { ok: false };

/**
 * Ask the parent-side AI endpoint for a coaching tip. {ok:false} on any
 * failure — the caller falls back to fairnessCoachFallback (labeled honestly).
 */
export async function fetchFairnessCoaching(
  options: FetchFairnessCoachingOptions,
): Promise<FetchFairnessCoachingResult> {
  const { fetchFn = fetch, token, analysis, endpoint = "/api/ai/fairness-coaching" } = options;
  if (!token) return { ok: false };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(fairnessCoachingPayload(analysis)),
    });
    let data: { tip?: unknown } | null = null;
    try {
      data = (await response.json()) as { tip?: unknown } | null;
    } catch {
      data = null;
    }
    const tip = typeof data?.tip === "string" ? data.tip.trim().slice(0, 500) : "";
    if (!response.ok || !tip) return { ok: false };
    return { ok: true, tip };
  } catch {
    return { ok: false };
  }
}

/**
 * Workers AI model used for parent-facing fairness coaching.
 * Same verified free-tier model as the other parent-side endpoints.
 */
export const FAIRNESS_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";
