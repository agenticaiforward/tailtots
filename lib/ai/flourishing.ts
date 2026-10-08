/**
 * PERMA Growth Log — Phase 3 of the AI-native transformation.
 *
 * Transforms the Growth Log from a trophy shelf into a flourishing dashboard.
 * Five kid-language pillars, computed DETERMINISTICALLY from behavioral
 * signals (mission_events, badge_awards, Kid Bank ledger) — never from
 * self-report surveys. An LLM may narrate the weekly snapshot into a warm
 * parent-facing celebration; it never computes scores and never sees child
 * PII.
 *
 * The five pillars (kid language → PERMA → Thrivers mapping):
 *  - joy      — "Joy"            (Positive Emotion / Optimism, Happiness)
 *  - stick    — "Stick-with-it"  (Engagement / Perseverance, Curiosity)
 *  - together — "Togetherness"   (Relationships / Empathy, Connectedness)
 *  - giving   — "Giving"         (Meaning / Kindness)
 *  - mastery  — "Mastery"        (Accomplishment / Confidence, Perseverance)
 *
 * Conscious-parenting voice (shared via PARENT_VOICE_GUIDELINES): celebrate
 * the brightest pillar first, frame dips as blooming forward, never shame
 * a weak pillar or guilt-trip the parent. Scores are internal-only relative
 * signals — never shown to children, never percentiles vs other kids,
 * never rankings or leaderboards.
 *
 * Guardrails:
 *  - Parent-side only. Model inputs: pillar scores + trend arrows + age band.
 *    Never child names, notes, photos, or voice transcripts.
 *  - Every narration is scanned for clinical terms; on any hit (or any LLM
 *    failure) a deterministic, pre-written safe narrative is used instead.
 *  - Behavioral descriptions only — no diagnosis, no clinical language,
 *    no mental-health labels, no cross-child comparison.
 */

import { PARENT_VOICE_GUIDELINES } from "./mission-engine";
import { scanNarrationForClinicalTerms } from "./copilot";
import { ageBandForAge, type IdeaAgeBand } from "./ideas";

export const FLOURISH_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

/** The five flourishing pillars, in fixed display order. */
export const FLOURISH_PILLARS = [
  "joy",
  "stick",
  "together",
  "giving",
  "mastery",
] as const;
export type FlourishPillar = (typeof FLOURISH_PILLARS)[number];

/** Kid-language labels — the only words the UI uses for pillars. */
export const FLOURISH_PILLAR_LABELS: Record<FlourishPillar, string> = {
  joy: "Joy",
  stick: "Stick-with-it",
  together: "Togetherness",
  giving: "Giving",
  mastery: "Mastery",
};

/** Kid-language taglines, one per pillar (celebration framing, never shame). */
export const FLOURISH_PILLAR_TAGLINES: Record<FlourishPillar, string> = {
  joy: "Delight, laughter, and loving the moment",
  stick: "Keeping going, even when it's tricky",
  together: "Caring for pets, family, and friends",
  giving: "Sharing kindness that matters",
  mastery: "Growing real skills, step by step",
};

export const FLOURISH_PILLAR_EMOJI: Record<FlourishPillar, string> = {
  joy: "🌞",
  stick: "🌱",
  together: "💛",
  giving: "🎁",
  mastery: "⭐",
};

export type FlourishTrend = "up" | "steady" | "down";

/** Raw behavioral inputs for pillar computation. */
export interface FlourishEventInput {
  eventType: string;
  taskId?: string | null;
  category?: string | null;
  difficulty?: string | null;
  skill?: string | null;
  createdAt: string; // ISO
}

export interface FlourishBadgeInput {
  skill?: string | null;
  earnedAt: string; // ISO
}

export interface FlourishBankInput {
  category: "earn" | "spend" | "give" | "save";
  amount: number;
  approved: boolean;
}

export type FlourishScores = Record<FlourishPillar, number>; // 0–100, internal only
export type FlourishTrends = Record<FlourishPillar, FlourishTrend>;

export interface FlourishingSnapshot {
  childId: string;
  weekStart: string; // ISO date of Monday of this week
  scores: FlourishScores;
  trends: FlourishTrends;
  brightest: FlourishPillar; // pillar to celebrate first (Sadhguru voice)
  narrative?: string | null;
  mode: "ai" | "deterministic";
  computedAt: string; // ISO
}

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function inWindow(createdAt: string, sinceMs: number, nowMs: number): boolean {
  const ms = toMs(createdAt);
  return ms >= sinceMs && ms <= nowMs;
}

const clampScore = (x: number): number =>
  Math.max(0, Math.min(100, Math.round(x)));

/**
 * Blend a raw signal (0–100) with the prior snapshot's score so pillars
 * move smoothly week to week. Cold start (no prior) uses neutral 50,
 * pulled toward the raw signal — never a label, just a starting point.
 */
function smooth(raw: number, prior: number | undefined): number {
  if (prior == null || Number.isNaN(prior)) return clampScore(50 * 0.4 + raw * 0.6);
  return clampScore(prior * 0.4 + raw * 0.6);
}

/** Distinct tasks that have a 'completed' (or 'approved') event in window. */
function completedTasks(
  events: FlourishEventInput[],
  sinceMs: number,
  nowMs: number,
): Map<string, FlourishEventInput[]> {
  const byTask = new Map<string, FlourishEventInput[]>();
  for (const e of events) {
    if (!e.taskId || !inWindow(e.createdAt, sinceMs, nowMs)) continue;
    const list = byTask.get(e.taskId) ?? [];
    list.push(e);
    byTask.set(e.taskId, list);
  }
  const done = new Map<string, FlourishEventInput[]>();
  for (const [taskId, list] of byTask) {
    if (list.some((e) => e.eventType === "completed" || e.eventType === "approved")) {
      done.set(taskId, list);
    }
  }
  return done;
}

function countEvents(
  events: FlourishEventInput[],
  types: string[],
  sinceMs: number,
  nowMs: number,
): number {
  return events.filter(
    (e) => types.includes(e.eventType) && inWindow(e.createdAt, sinceMs, nowMs),
  ).length;
}

/**
 * JOY — delight in the doing.
 * Signals: same-week completion rate (prompt engagement), checkin events
 * (the child taps in because they're enjoying it), streak extensions.
 */
function computeJoy(
  events: FlourishEventInput[],
  sinceMs: number,
  nowMs: number,
): number {
  const done = completedTasks(events, sinceMs, nowMs);
  const assigned = new Set<string>();
  for (const e of events) {
    if (e.taskId && e.eventType === "assigned" && inWindow(e.createdAt, sinceMs, nowMs)) {
      assigned.add(e.taskId);
    }
  }
  const completionRate = assigned.size > 0 ? done.size / assigned.size : null;
  const checkins = countEvents(events, ["checkin"], sinceMs, nowMs);
  const streakExt = countEvents(events, ["streak_extended"], sinceMs, nowMs);

  // Blend signals; require minimum data before trusting the completion rate.
  let raw = 50;
  if (completionRate != null && assigned.size >= 3) {
    raw = completionRate * 100;
  }
  // Check-ins and streaks nudge upward — evidence of joyful return.
  raw += Math.min(15, checkins * 3 + streakExt * 5);
  return clampScore(raw);
}

/**
 * STICK-WITH-IT — perseverance through difficulty.
 * Signals: completion rate of medium/hard missions, tasks that were
 * skipped then later completed (comeback), multi-event engagement
 * (started + completed = sustained effort).
 */
function computeStick(
  events: FlourishEventInput[],
  sinceMs: number,
  nowMs: number,
): number {
  const done = completedTasks(events, sinceMs, nowMs);
  const windowed = events.filter((e) => inWindow(e.createdAt, sinceMs, nowMs));

  const hardDone = [...done.values()].filter((list) =>
    list.some((e) => e.difficulty === "medium" || e.difficulty === "hard"),
  ).length;

  // Comebacks: a task with a 'skipped' event followed by completion.
  let comebacks = 0;
  for (const list of done.values()) {
    const ordered = [...list].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
    const skipIdx = ordered.findIndex((e) => e.eventType === "skipped");
    const doneIdx = ordered.findIndex(
      (e) => e.eventType === "completed" || e.eventType === "approved",
    );
    if (skipIdx >= 0 && doneIdx > skipIdx) comebacks += 1;
  }

  const totalDone = done.size;
  if (totalDone === 0 && hardDone === 0 && comebacks === 0) return 50;

  const hardShare = totalDone > 0 ? hardDone / totalDone : 0;
  const comebackBonus = Math.min(20, comebacks * 10);
  const base = 30 + hardShare * 50 + comebackBonus;
  // Sustained effort: tasks with both started and completed events.
  const sustained = [...done.values()].filter((list) =>
    list.some((e) => e.eventType === "started"),
  ).length;
  const sustainedShare = totalDone > 0 ? sustained / totalDone : 0;
  return clampScore(base + sustainedShare * 20);
}

/**
 * TOGETHERNESS — caring connection.
 * Signals: completion of kindness, community, and pet_care missions —
 * the categories where the child cares FOR someone or something.
 */
function computeTogetherness(
  events: FlourishEventInput[],
  sinceMs: number,
  nowMs: number,
): number {
  const done = completedTasks(events, sinceMs, nowMs);
  if (done.size === 0) return 50;
  const CONNECTED_CATEGORIES = new Set(["kindness", "community", "pet_care"]);
  const connected = [...done.values()].filter((list) =>
    list.some((e) => e.category && CONNECTED_CATEGORIES.has(e.category)),
  ).length;
  const share = connected / done.size;
  // Reward both share AND volume — a child doing lots of caring missions blooms.
  return clampScore(30 + share * 50 + Math.min(20, connected * 4));
}

/**
 * GIVING — generosity in action.
 * Signals: Kid Bank 'give' transactions (approved) as a share of all
 * approved outflows, plus kindness/community mission completions.
 */
function computeGiving(
  events: FlourishEventInput[],
  bank: FlourishBankInput[],
  sinceMs: number,
  nowMs: number,
): number {
  const approvedOut = bank.filter((t) => t.approved && (t.category === "give" || t.category === "spend"));
  const given = approvedOut
    .filter((t) => t.category === "give")
    .reduce((s, t) => s + t.amount, 0);
  const totalOut = approvedOut.reduce((s, t) => s + t.amount, 0);

  const done = completedTasks(events, sinceMs, nowMs);
  const giveMissions = [...done.values()].filter((list) =>
    list.some((e) => e.category === "kindness" || e.category === "community"),
  ).length;

  if (totalOut === 0 && giveMissions === 0) return 50;

  const giveShare = totalOut > 0 ? given / totalOut : 0;
  const missionBonus = Math.min(30, giveMissions * 6);
  return clampScore(30 + giveShare * 50 + missionBonus);
}

/**
 * MASTERY — real skill growth.
 * Signals: badge awards in window, hard-difficulty completions, and
 * difficulty progression (completing harder missions than before).
 */
function computeMastery(
  events: FlourishEventInput[],
  badges: FlourishBadgeInput[],
  sinceMs: number,
  nowMs: number,
): number {
  const done = completedTasks(events, sinceMs, nowMs);
  const windowBadges = badges.filter((b) => inWindow(b.earnedAt, sinceMs, nowMs)).length;
  const hardDone = [...done.values()].filter((list) =>
    list.some((e) => e.difficulty === "hard"),
  ).length;

  if (done.size === 0 && windowBadges === 0) return 50;

  const badgeScore = Math.min(40, windowBadges * 10);
  const hardShare = done.size > 0 ? hardDone / done.size : 0;
  return clampScore(30 + badgeScore + hardShare * 30 + Math.min(20, done.size * 2));
}

/** Compute all five pillar scores for a 4-week window ending now. */
export function computeFlourishScores(
  events: FlourishEventInput[],
  badges: FlourishBadgeInput[],
  bank: FlourishBankInput[],
  prior?: Partial<FlourishScores>,
  nowMs: number = Date.now(),
): FlourishScores {
  const sinceMs = nowMs - 28 * DAY_MS;
  return {
    joy: smooth(computeJoy(events, sinceMs, nowMs), prior?.joy),
    stick: smooth(computeStick(events, sinceMs, nowMs), prior?.stick),
    together: smooth(computeTogetherness(events, sinceMs, nowMs), prior?.together),
    giving: smooth(computeGiving(events, bank, sinceMs, nowMs), prior?.giving),
    mastery: smooth(computeMastery(events, badges, sinceMs, nowMs), prior?.mastery),
  };
}

/** Per-pillar trend: this week vs last week, ±5 point deadband. */
export function computeFlourishTrends(
  thisWeek: FlourishScores,
  lastWeek: FlourishScores | undefined,
): FlourishTrends {
  const out = {} as FlourishTrends;
  for (const pillar of FLOURISH_PILLARS) {
    if (lastWeek == null) {
      out[pillar] = "steady";
      continue;
    }
    const delta = thisWeek[pillar] - lastWeek[pillar];
    out[pillar] = delta >= 5 ? "up" : delta <= -5 ? "down" : "steady";
  }
  return out;
}

/** Monday (UTC) of the week containing nowMs — the snapshot's week key. */
export function weekStartIso(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const day = d.getUTCDay(); // 0=Sunday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const back = (day + 6) % 7; // days since Monday
  monday.setUTCDate(monday.getUTCDate() - back);
  return monday.toISOString().slice(0, 10);
}

/** The pillar to celebrate first — highest score wins; ties go to joy. */
export function brightestPillar(scores: FlourishScores): FlourishPillar {
  let best: FlourishPillar = "joy";
  for (const pillar of FLOURISH_PILLARS) {
    if (scores[pillar] > scores[best]) best = pillar;
  }
  return best;
}

// ---------------------------------------------------------------------------
// LLM narration (parent-facing weekly celebration)
// ---------------------------------------------------------------------------

export interface FlourishNarrationInput {
  scores: FlourishScores;
  trends: FlourishTrends;
  brightest: FlourishPillar;
  ageBand: IdeaAgeBand;
}

const TREND_WORD: Record<FlourishTrend, string> = {
  up: "climbing",
  steady: "holding strong",
  down: "blooming",
};

export function buildFlourishSystemPrompt(): string {
  const voice = PARENT_VOICE_GUIDELINES.split("\n")
    .map((g) => `- ${g}`)
    .join("\n");
  return [
    "You are a warm family celebration writer for TailTots, a kids' character-growth app.",
    "Write ONE short paragraph (2-3 sentences) celebrating a child's week of growth for their parent.",
    "Rules:",
    "- Lead with the BRIGHTEST pillar — celebrate what is blooming, not what is weak.",
    "- Describe trends with warm, forward-looking words. A 'down' trend is 'blooming' — never a problem.",
    "- Never mention scores, numbers, percentiles, or rankings.",
    "- Never compare this child to any other child.",
    "- Never use clinical or diagnostic language.",
    "- Speak to the parent as a companion: 'you two' language, never lecturing.",
    "- Plain, joyful language a busy parent can read in 10 seconds.",
    "Parent voice guidelines:",
    voice,
  ].join("\n");
}

export function buildFlourishUserPrompt(input: FlourishNarrationInput): string {
  const lines = FLOURISH_PILLARS.map(
    (p) =>
      `- ${FLOURISH_PILLAR_LABELS[p]} (${FLOURISH_PILLAR_TAGLINES[p]}): ${TREND_WORD[input.trends[p]]}`,
  );
  return [
    `Child age band: ${input.ageBand}.`,
    "This week's pillar trends (relative to the child's own last week):",
    ...lines,
    `Brightest pillar to celebrate first: ${FLOURISH_PILLAR_LABELS[input.brightest]}.`,
    "Write the celebration paragraph. No child name needed — address 'your child' or use 'you two'.",
  ].join("\n");
}

/**
 * Deterministic, pre-written safe narrative — used when the LLM is
 * unavailable or its output fails the clinical scan. Celebrates the
 * brightest pillar; frames everything forward.
 */
export function flourishFallbackNarrative(brightest: FlourishPillar): string {
  const label = FLOURISH_PILLAR_LABELS[brightest];
  return (
    `What a week — ${label} is shining brightest right now, and you two made that happen together. ` +
    `Keep following their delight and the rest will bloom in its own time. ` +
    `Every small step counts, and this week had plenty of them.`
  );
}

/** Validate + scan an LLM narration; returns null if it must not be shown. */
export function sanitizeFlourishNarration(text: string): string | null {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length < 20 || trimmed.length > 600) return null;
  if (scanNarrationForClinicalTerms(trimmed)) return null;
  // No numbers-as-scores leaking through.
  if (/\b\d{2,3}\s*(%|percent|points|score)/i.test(trimmed)) return null;
  return trimmed;
}

/** Assemble a full snapshot from computed scores + optional narration. */
export function buildFlourishingSnapshot(
  childId: string,
  scores: FlourishScores,
  lastWeekScores: FlourishScores | undefined,
  narration: string | null,
  mode: "ai" | "deterministic",
  nowMs: number = Date.now(),
): FlourishingSnapshot {
  const trends = computeFlourishTrends(scores, lastWeekScores);
  const brightest = brightestPillar(scores);
  return {
    childId,
    weekStart: weekStartIso(nowMs),
    scores,
    trends,
    brightest,
    narrative: narration,
    mode,
    computedAt: new Date(nowMs).toISOString(),
  };
}

/** Input validation for the Worker route body. */
export function validateFlourishInput(body: unknown): { ok: true; childId: string } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const childId = (body as { childId?: unknown }).childId;
  if (typeof childId !== "string" || childId.length === 0 || childId.length > 100) {
    return { ok: false, error: "childId must be a non-empty string." };
  }
  return { ok: true, childId };
}


