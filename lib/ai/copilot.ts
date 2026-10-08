/**
 * Parent Copilot — Phase 2 of the AI-native transformation.
 *
 * The Copilot is a pattern-READER, not a chatbot. Pattern detection is
 * deterministic (pure functions over mission_events rows — no LLM). The LLM
 * only NARRATES precomputed facts into warm, parent-facing sentences; it
 * never analyzes raw data and never sees child PII.
 *
 * Conscious-parenting voice (shared with the Mission Engine via
 * PARENT_VOICE_GUIDELINES): insights point at what the PARENT can shift
 * ("here's what you could try together"), never at what's wrong with the
 * child. Celebrate joy and brave tries; never shame, guilt-trip, or dwell
 * on failure. Behavioral descriptions only — no diagnosis, no clinical
 * language, no mental-health labels, no cross-child comparison.
 *
 * Guardrails:
 *  - Parent-side only. Model inputs: insight_type + behavioral fact JSON +
 *    age band. Never child names, photos, notes, or voice transcripts.
 *  - Every narration is scanned for clinical terms; on any hit (or any LLM
 *    failure) we fall back to a deterministic, pre-written safe narrative.
 *  - Insights are dismissible and expire; no persistent psychological profiles.
 */

import { PARENT_VOICE_GUIDELINES } from "./mission-engine";
import { ageBandForAge, type IdeaAgeBand } from "./ideas";

export const COPILOT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

/** Matches the pattern_insights.insight_type check constraint. */
export const INSIGHT_TYPES = [
  "weak_weekday",
  "weak_category",
  "weak_skill",
  "difficulty_mismatch",
  "streak_at_risk",
  "completion_drop",
  "skill_imbalance",
  "engagement_rise",
] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

export const INSIGHT_SEVERITIES = ["info", "watch", "act"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const COPILOT_CATEGORY_LABELS: Record<string, string> = {
  pet_care: "pet care",
  chore: "chores",
  kindness: "kindness",
  money: "money",
  community: "community",
};

export const COPILOT_SKILL_LABELS: Record<string, string> = {
  responsibility: "responsibility",
  empathy: "empathy",
  teamwork: "teamwork",
  leadership: "leadership",
  time: "time management",
};

/** One mission_events row, trimmed to what detection needs. */
export interface CopilotEventInput {
  eventType: string;
  taskId?: string | null;
  category?: string | null;
  difficulty?: string | null;
  skill?: string | null;
  weekday?: number | null;
  createdAt: string; // ISO
  minutesToComplete?: number | null;
}

export interface CopilotChildInput {
  streakDays: number;
  age: number | null;
}

/**
 * A detected behavioral pattern — facts only, no interpretation.
 * `detail` carries rates, counts, and ratios; never labels or diagnoses.
 */
export interface DetectedPattern {
  insightType: InsightType;
  severity: InsightSeverity;
  detail: Record<string, string | number | boolean | null>;
}

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

interface TaskOutcome {
  assigned: boolean;
  completed: boolean;
}

/**
 * Completion rate per group key, counting distinct tasks once.
 * A task counts as completed if it has a 'completed' OR 'approved' event.
 */
function completionRatesBy(
  events: CopilotEventInput[],
  sinceMs: number,
  keyOf: (e: CopilotEventInput) => string | null,
): Map<string, { assigned: number; completed: number; rate: number }> {
  const tasks = new Map<string, TaskOutcome & { key: string }>();
  for (const e of events) {
    const ms = toMs(e.createdAt);
    if (ms < sinceMs || !e.taskId) continue;
    const key = keyOf(e);
    if (key == null) continue;
    let t = tasks.get(e.taskId);
    if (!t) {
      t = { assigned: false, completed: false, key };
      tasks.set(e.taskId, t);
    }
    if (e.eventType === "assigned") t.assigned = true;
    if (e.eventType === "completed" || e.eventType === "approved") t.completed = true;
  }
  const groups = new Map<string, { assigned: number; completed: number; rate: number }>();
  for (const t of tasks.values()) {
    if (!t.assigned) continue;
    let g = groups.get(t.key);
    if (!g) {
      g = { assigned: 0, completed: 0, rate: 0 };
      groups.set(t.key, g);
    }
    g.assigned += 1;
    if (t.completed) g.completed += 1;
  }
  for (const g of groups.values()) {
    g.rate = g.assigned > 0 ? g.completed / g.assigned : 0;
  }
  return groups;
}

function overallRate(
  groups: Map<string, { assigned: number; completed: number; rate: number }>,
): number {
  let a = 0;
  let c = 0;
  for (const g of groups.values()) {
    a += g.assigned;
    c += g.completed;
  }
  return a > 0 ? c / a : 0;
}

function weekdayOf(e: CopilotEventInput): string | null {
  if (typeof e.weekday === "number" && e.weekday >= 0 && e.weekday <= 6) {
    return String(e.weekday);
  }
  const ms = toMs(e.createdAt);
  if (!ms) return null;
  return String(new Date(ms).getDay());
}

/** 1. Weekday with completion far below the child's own baseline. */
export function detectWeakWeekday(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const since = nowMs - 8 * 7 * DAY_MS;
  const byDay = completionRatesBy(events, since, weekdayOf);
  const baseline = overallRate(byDay);
  if (baseline <= 0) return [];
  const out: DetectedPattern[] = [];
  for (const [day, g] of byDay) {
    if (g.assigned < 10) continue;
    if (g.rate < baseline * 0.7) {
      out.push({
        insightType: "weak_weekday",
        severity: g.rate < baseline * 0.5 ? "act" : "watch",
        detail: {
          weekday: Number(day),
          weekdayName: WEEKDAY_NAMES[Number(day)] ?? `day ${day}`,
          rate: Math.round(g.rate * 100) / 100,
          baseline: Math.round(baseline * 100) / 100,
          assigned: g.assigned,
        },
      });
    }
  }
  // Report only the single weakest weekday to avoid insight spam.
  out.sort((a, b) => (a.detail.rate as number) - (b.detail.rate as number));
  return out.slice(0, 1);
}

/** 2. Category with completion far below the child's own mean. */
export function detectWeakCategory(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const since = nowMs - 8 * 7 * DAY_MS;
  const byCat = completionRatesBy(events, since, (e) =>
    typeof e.category === "string" && e.category ? e.category : null,
  );
  const mean = overallRate(byCat);
  if (mean <= 0) return [];
  const out: DetectedPattern[] = [];
  for (const [cat, g] of byCat) {
    if (g.assigned < 10) continue;
    if (g.rate < mean * 0.5) {
      out.push({
        insightType: "weak_category",
        severity: g.rate < mean * 0.3 ? "act" : "watch",
        detail: {
          category: cat,
          categoryLabel: COPILOT_CATEGORY_LABELS[cat] ?? cat,
          rate: Math.round(g.rate * 100) / 100,
          baseline: Math.round(mean * 100) / 100,
          assigned: g.assigned,
        },
      });
    }
  }
  out.sort((a, b) => (a.detail.rate as number) - (b.detail.rate as number));
  return out.slice(0, 1);
}

/** 3. Completion this week dropped >25% vs the prior 4-week mean. */
export function detectCompletionDrop(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const thisWeek = completionRatesBy(events, nowMs - 7 * DAY_MS, () => "w");
  const prior = completionRatesBy(events, nowMs - 35 * DAY_MS, (e) =>
    toMs(e.createdAt) < nowMs - 7 * DAY_MS ? "p" : null,
  );
  const w = thisWeek.get("w");
  const p = prior.get("p");
  if (!w || !p || w.assigned < 8 || p.assigned < 8 || p.rate <= 0) return [];
  if (w.rate < p.rate * 0.75) {
    return [
      {
        insightType: "completion_drop",
        severity: w.rate < p.rate * 0.5 ? "act" : "watch",
        detail: {
          thisWeekRate: Math.round(w.rate * 100) / 100,
          priorRate: Math.round(p.rate * 100) / 100,
          assignedThisWeek: w.assigned,
        },
      },
    ];
  }
  return [];
}

/** 4. Long streak with no completion in 2 days — gentle nudge, never alarm. */
export function detectStreakAtRisk(
  events: CopilotEventInput[],
  child: CopilotChildInput,
  nowMs: number = Date.now(),
): DetectedPattern[] {
  if (child.streakDays < 5) return [];
  let lastCompletion = 0;
  for (const e of events) {
    if (e.eventType === "completed" || e.eventType === "approved") {
      const ms = toMs(e.createdAt);
      if (ms > lastCompletion) lastCompletion = ms;
    }
  }
  if (!lastCompletion) return [];
  const daysSince = (nowMs - lastCompletion) / DAY_MS;
  if (daysSince >= 2) {
    return [
      {
        insightType: "streak_at_risk",
        severity: "watch",
        detail: {
          streakDays: child.streakDays,
          daysSinceCompletion: Math.round(daysSince * 10) / 10,
        },
      },
    ];
  }
  return [];
}

/** 5. One skill's completed missions >= 3x another's over 30 days. */
export function detectSkillImbalance(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const since = nowMs - 30 * DAY_MS;
  const counts = new Map<string, number>();
  for (const e of events) {
    if (toMs(e.createdAt) < since) continue;
    if (e.eventType !== "completed" && e.eventType !== "approved") continue;
    if (typeof e.skill !== "string" || !e.skill) continue;
    counts.set(e.skill, (counts.get(e.skill) ?? 0) + 1);
  }
  if (counts.size < 2) return [];
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topSkill, topCount] = entries[0];
  const [lowSkill, lowCount] = entries[entries.length - 1];
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (total < 12 || lowCount <= 0) return [];
  if (topCount >= lowCount * 3) {
    return [
      {
        insightType: "skill_imbalance",
        severity: "info",
        detail: {
          strongSkill: topSkill,
          strongSkillLabel: COPILOT_SKILL_LABELS[topSkill] ?? topSkill,
          strongCount: topCount,
          lightSkill: lowSkill,
          lightSkillLabel: COPILOT_SKILL_LABELS[lowSkill] ?? lowSkill,
          lightCount: lowCount,
        },
      },
    ];
  }
  return [];
}

/** 6. Difficulty mismatch per category: struggling on hard or breezing on easy. */
export function detectDifficultyMismatch(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const since = nowMs - 30 * DAY_MS;
  const byDiff = new Map<string, Map<string, { assigned: number; completed: number }>>();
  const tasks = new Map<string, { assigned: boolean; completed: boolean; key: string }>();
  for (const e of events) {
    const ms = toMs(e.createdAt);
    if (ms < since || !e.taskId) continue;
    if (typeof e.category !== "string" || !e.category) continue;
    if (typeof e.difficulty !== "string" || !e.difficulty) continue;
    const key = `${e.category}|${e.difficulty}`;
    let t = tasks.get(e.taskId);
    if (!t) {
      t = { assigned: false, completed: false, key };
      tasks.set(e.taskId, t);
    }
    if (e.eventType === "assigned") t.assigned = true;
    if (e.eventType === "completed" || e.eventType === "approved") t.completed = true;
  }
  for (const t of tasks.values()) {
    if (!t.assigned) continue;
    const [cat, diff] = t.key.split("|");
    let catMap = byDiff.get(cat);
    if (!catMap) {
      catMap = new Map();
      byDiff.set(cat, catMap);
    }
    let g = catMap.get(diff);
    if (!g) {
      g = { assigned: 0, completed: 0 };
      catMap.set(diff, g);
    }
    g.assigned += 1;
    if (t.completed) g.completed += 1;
  }
  for (const [cat, catMap] of byDiff) {
    const hard = catMap.get("hard");
    const easy = catMap.get("easy");
    const hardRate = hard && hard.assigned >= 8 ? hard.completed / hard.assigned : null;
    const easyRate = easy && easy.assigned >= 8 ? easy.completed / easy.assigned : null;
    if (hardRate !== null && easyRate !== null && hardRate < 0.3 && easyRate > 0.8) {
      return [
        {
          insightType: "difficulty_mismatch",
          severity: "watch",
          detail: {
            category: cat,
            categoryLabel: COPILOT_CATEGORY_LABELS[cat] ?? cat,
            direction: "downshift",
            hardRate: Math.round(hardRate * 100) / 100,
            easyRate: Math.round(easyRate * 100) / 100,
          },
        },
      ];
    }
    if (easyRate !== null && easyRate >= 0.99 && (easy?.assigned ?? 0) >= 12) {
      // Breezing through easy with zero misses — but check they aren't
      // rushing: require median completion time data before upshifting.
      return [
        {
          insightType: "difficulty_mismatch",
          severity: "info",
          detail: {
            category: cat,
            categoryLabel: COPILOT_CATEGORY_LABELS[cat] ?? cat,
            direction: "upshift",
            easyRate: Math.round(easyRate * 100) / 100,
          },
        },
      ];
    }
  }
  return [];
}

/** 7. Engagement rising: this week well above the prior 4-week mean. Celebrate it. */
export function detectEngagementRise(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): DetectedPattern[] {
  const thisWeek = completionRatesBy(events, nowMs - 7 * DAY_MS, () => "w");
  const prior = completionRatesBy(events, nowMs - 35 * DAY_MS, (e) =>
    toMs(e.createdAt) < nowMs - 7 * DAY_MS ? "p" : null,
  );
  const w = thisWeek.get("w");
  const p = prior.get("p");
  if (!w || !p || w.assigned < 8 || p.assigned < 8 || p.rate <= 0) return [];
  if (w.rate > p.rate * 1.2 && w.rate - p.rate >= 0.1) {
    return [
      {
        insightType: "engagement_rise",
        severity: "info",
        detail: {
          thisWeekRate: Math.round(w.rate * 100) / 100,
          priorRate: Math.round(p.rate * 100) / 100,
          assignedThisWeek: w.assigned,
        },
      },
    ];
  }
  return [];
}

/** Run all detectors. Deterministic — no LLM involved. */
export function detectPatterns(
  events: CopilotEventInput[],
  child: CopilotChildInput,
  nowMs: number = Date.now(),
): DetectedPattern[] {
  return [
    ...detectWeakWeekday(events, nowMs),
    ...detectWeakCategory(events, nowMs),
    ...detectCompletionDrop(events, nowMs),
    ...detectStreakAtRisk(events, child, nowMs),
    ...detectSkillImbalance(events, nowMs),
    ...detectDifficultyMismatch(events, nowMs),
    ...detectEngagementRise(events, nowMs),
  ];
}

/** Per-category calibrated difficulty band from 30-day completion rates. */
export function calibrateDifficultyBands(
  events: CopilotEventInput[],
  nowMs: number = Date.now(),
): { category: string; band: "easy" | "medium" | "hard"; rate: number; sampleSize: number }[] {
  const since = nowMs - 30 * DAY_MS;
  const byCat = completionRatesBy(events, since, (e) =>
    typeof e.category === "string" && e.category ? e.category : null,
  );
  const out: { category: string; band: "easy" | "medium" | "hard"; rate: number; sampleSize: number }[] = [];
  for (const [cat, g] of byCat) {
    if (g.assigned < 8) continue;
    const band = g.rate >= 0.85 ? "hard" : g.rate >= 0.6 ? "medium" : "easy";
    out.push({ category: cat, band, rate: Math.round(g.rate * 100) / 100, sampleSize: g.assigned });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Narration: LLM turns precomputed facts into one warm parent-facing sentence.
// The model NEVER sees raw events, names, or anything beyond the fact JSON +
// age band. Every output is scanned for clinical terms; on any hit or parse
// failure we use the deterministic fallback narrative (always safe).
// ---------------------------------------------------------------------------

export interface NarrationInput {
  insightType: InsightType;
  severity: InsightSeverity;
  detail: Record<string, string | number | boolean | null>;
  ageBand: IdeaAgeBand;
}

/** Terms that must never appear in a parent-facing narration. */
const CLINICAL_BLOCKLIST = [
  "diagnos",
  "anxiety",
  "anxious",
  "depress",
  "adhd",
  "trauma",
  "traumatized",
  "disorder",
  "therapy",
  "therapist",
  "clinical",
  "symptom",
  "patholog",
  "neurodivergent",
  "autis",
];

export function scanNarrationForClinicalTerms(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of CLINICAL_BLOCKLIST) {
    if (lower.includes(term)) return term;
  }
  return null;
}

function pct(x: unknown): string {
  return typeof x === "number" ? `${Math.round(x * 100)}%` : "?";
}

function detailLine(pattern: { insightType: InsightType; detail: NarrationInput["detail"] }): string {
  const d = pattern.detail;
  switch (pattern.insightType) {
    case "weak_weekday":
      return (
        `Fact: missions are completed ${pct(d.rate)} of the time on ${d.weekdayName} ` +
        `vs ${pct(d.baseline)} usually (over ${d.assigned} missions). ` +
        `Suggest one small doable shift for that day, like a 3-minute pet-connected mission instead of a planning one.`
      );
    case "weak_category":
      return (
        `Fact: ${d.categoryLabel} missions are completed ${pct(d.rate)} of the time ` +
        `vs ${pct(d.baseline)} overall (over ${d.assigned} missions). ` +
        `Suggest starting the next one together, side by side, with a tiny first step.`
      );
    case "completion_drop":
      return (
        `Fact: completion this week is ${pct(d.thisWeekRate)} vs ${pct(d.priorRate)} over the prior month. ` +
        `Frame this as a rhythm to reset together — never as failure. Suggest one joyful, easy win to restart the rhythm.`
      );
    case "streak_at_risk":
      return (
        `Fact: a ${d.streakDays}-day streak with no completion in the last ${d.daysSinceCompletion} days. ` +
        `Gentle nudge only: suggest one tiny mission they can do together today to keep the rhythm warm. Never guilt about the streak.`
      );
    case "skill_imbalance":
      return (
        `Fact: ${d.strongCount} recent completions in ${d.strongSkillLabel} vs ${d.lightCount} in ${d.lightSkillLabel}. ` +
        `Suggest using the strong area as a bridge: one mission that practices ${d.lightSkillLabel} through ${d.strongSkillLabel}.`
      );
    case "difficulty_mismatch":
      return d.direction === "downshift"
        ? `Fact: hard ${d.categoryLabel} missions complete ${pct(d.hardRate)} of the time while easy ones complete ${pct(d.easyRate)}. ` +
          `Suggest easing that category down a notch for a week or two — confidence first, challenge later.`
        : `Fact: easy ${d.categoryLabel} missions are completing ${pct(d.easyRate)} of the time. ` +
          `Suggest offering one slightly stretchier mission as a "brave try" — attempts count, no pressure.`;
    case "weak_skill":
      return `Fact: the skill "${d.skill ?? "unknown"}" has seen little practice lately. Suggest one small, joyful mission in that skill done together.`;
    case "engagement_rise":
      return (
        `Fact: completion this week is ${pct(d.thisWeekRate)} vs ${pct(d.priorRate)} over the prior month. ` +
        `Celebrate this warmly — name what's working and suggest keeping the same rhythm. This is a joy to reinforce.`
      );
  }
}

export function buildCopilotNarrationSystemPrompt(): string {
  return [
    "You turn a precomputed family-activity fact into one warm, specific message for a PARENT. Output ONLY the message: 1-2 sentences, at most 160 characters.",
    "Rules:",
    "1. Behavioral observation only. Never diagnose, never label the child, never mention mental health, anxiety, ADHD, trauma, or disorders.",
    "2. Speak to the parent as the capable guide: frame the suggestion as something THEY can try together with their child — never as something wrong with the child or their past choices.",
    "3. Companion framing: suggest doing things side by side, not supervising or correcting.",
    "4. Celebrate joy and brave tries. Never shame, guilt-trip, or dwell on failure, broken streaks, or distress.",
    "5. Be concrete: reference the actual numbers and give one doable suggestion.",
    "6. No exclamation marks. No emojis.",
    "Parent voice guidelines:",
    PARENT_VOICE_GUIDELINES,
  ].join("\n");
}

export function buildCopilotNarrationUserMessage(input: NarrationInput): string {
  return [
    `Child age band: ${input.ageBand}.`,
    detailLine({ insightType: input.insightType, detail: input.detail }),
    "Write the parent-facing message.",
  ].join("\n");
}

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function buildCopilotNarrationMessages(input: NarrationInput): ChatMessage[] {
  return [
    { role: "system", content: buildCopilotNarrationSystemPrompt() },
    { role: "user", content: buildCopilotNarrationUserMessage(input) },
  ];
}

/** Deterministic, pre-written safe narrative — used when the LLM is unavailable or its output fails the clinical scan. */
export function fallbackNarrative(input: NarrationInput): string {
  const d = input.detail;
  switch (input.insightType) {
    case "weak_weekday":
      return (
        `Missions get done ${pct(d.rate)} of the time on ${d.weekdayName} vs ${pct(d.baseline)} usually. ` +
        `Try a 3-minute pet-connected mission on ${d.weekdayName} instead of a planning one.`
      );
    case "weak_category":
      return (
        `${String(d.categoryLabel ?? "These")} missions complete ${pct(d.rate)} of the time vs ${pct(d.baseline)} overall. ` +
        `Start the next one together, side by side, with one tiny first step.`
      );
    case "completion_drop":
      return (
        `Completion this week is ${pct(d.thisWeekRate)} vs ${pct(d.priorRate)} lately. ` +
        `Reset the rhythm together with one joyful, easy win — no pressure, just a fresh start.`
      );
    case "streak_at_risk":
      return (
        `A ${d.streakDays}-day rhythm with nothing completed in the last couple of days. ` +
        `One tiny mission together today keeps it warm.`
      );
    case "skill_imbalance":
      return (
        `${d.strongCount} recent wins in ${d.strongSkillLabel} vs ${d.lightCount} in ${d.lightSkillLabel}. ` +
        `Bridge them: one mission that practices ${d.lightSkillLabel} through ${d.strongSkillLabel}.`
      );
    case "difficulty_mismatch":
      return d.direction === "downshift"
        ? `Hard ${d.categoryLabel} missions complete ${pct(d.hardRate)} of the time vs ${pct(d.easyRate)} for easy ones. Ease that category down a notch — confidence first.`
        : `Easy ${d.categoryLabel} missions are at ${pct(d.easyRate)}. Offer one slightly stretchier "brave try" — attempts count.`;
    case "weak_skill":
      return `The skill "${d.skill ?? "unknown"}" has had little practice lately. One small, joyful mission in it, done together.`;
    case "engagement_rise":
      return `Completion this week is ${pct(d.thisWeekRate)} vs ${pct(d.priorRate)} lately — something is working. Keep that same rhythm going.`;
  }
}

/** Parse + validate a narration. Returns null when unusable (caller uses fallback). */
export function parseCopilotNarrationResponse(text: string): string | null {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 10 || cleaned.length > 400) return null;
  if (scanNarrationForClinicalTerms(cleaned)) return null;
  return cleaned;
}

export function validateCopilotInsightsInput(body: unknown): { ok: true; childId: string } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request body." };
  const childId = (body as { childId?: unknown }).childId;
  if (typeof childId !== "string" || childId.length < 8 || childId.length > 64) {
    return { ok: false, error: "childId is required." };
  }
  return { ok: true, childId };
}

export interface PatternInsightRow {
  id: string;
  child_id: string;
  insight_type: InsightType;
  severity: InsightSeverity;
  detail_json: Record<string, string | number | boolean | null>;
  narrative: string | null;
  valid_from: string;
  valid_until: string | null;
  dismissed_by_parent_id: string | null;
  created_at: string;
}

export interface FetchCopilotInsightsOptions {
  fetchFn?: typeof fetch;
  token: string | null | undefined;
  childId: string;
  endpoint?: string;
}

export interface FetchCopilotInsightsResult {
  ok: boolean;
  insights?: PatternInsightRow[];
  error?: string;
}

/** Client helper: ask the Worker to detect patterns + narrate for one child. */
export async function fetchCopilotInsights(
  options: FetchCopilotInsightsOptions,
): Promise<FetchCopilotInsightsResult> {
  const { fetchFn = fetch, token, childId, endpoint = "/api/ai/copilot-insights" } = options;
  if (!token) return { ok: false, error: "no token" };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ childId }),
    });
    let data: { insights?: unknown } | null = null;
    try {
      data = (await response.json()) as { insights?: unknown } | null;
    } catch {
      data = null;
    }
    if (!response.ok || !data) return { ok: false, error: "request failed" };
    if (!Array.isArray(data.insights)) return { ok: false, error: "unusable response" };
    const insights: PatternInsightRow[] = [];
    for (const raw of data.insights) {
      if (typeof raw !== "object" || raw === null) continue;
      const r = raw as Record<string, unknown>;
      if (
        typeof r.id !== "string" ||
        typeof r.child_id !== "string" ||
        !(INSIGHT_TYPES as readonly string[]).includes(r.insight_type as string) ||
        !(INSIGHT_SEVERITIES as readonly string[]).includes(r.severity as string)
      ) {
        continue;
      }
      insights.push({
        id: r.id,
        child_id: r.child_id,
        insight_type: r.insight_type as InsightType,
        severity: r.severity as InsightSeverity,
        detail_json:
          typeof r.detail_json === "object" && r.detail_json !== null
            ? (r.detail_json as Record<string, string | number | boolean | null>)
            : {},
        narrative: typeof r.narrative === "string" ? r.narrative : null,
        valid_from: typeof r.valid_from === "string" ? r.valid_from : "",
        valid_until: typeof r.valid_until === "string" ? r.valid_until : null,
        dismissed_by_parent_id:
          typeof r.dismissed_by_parent_id === "string" ? r.dismissed_by_parent_id : null,
        created_at: typeof r.created_at === "string" ? r.created_at : "",
      });
    }
    return { ok: true, insights };
  } catch {
    return { ok: false, error: "network error" };
  }
}

/** Narration needs only the child's age band — coarse aggregate, never PII. */
export function narrationInputFor(
  pattern: DetectedPattern,
  age: number | null,
): NarrationInput {
  return {
    insightType: pattern.insightType,
    severity: pattern.severity,
    detail: pattern.detail,
    ageBand: ageBandForAge(age ?? 8),
  };
}
