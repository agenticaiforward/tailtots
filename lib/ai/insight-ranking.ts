/**
 * Insight Ranking Engine — billion-dollar redesign, Change 1.
 *
 * The Copilot's detectors can fire many patterns at once. Surfacing all of
 * them is the anxiety cockpit. This module ranks patterns so the parent sees
 * exactly ONE insight per week — the most actionable, confident, novel one.
 *
 * Ranking is deterministic: score = actionability × confidence × novelty.
 * Confidence comes from sample size (<8 suppressed, 8–20 medium, 20+ high).
 * Novelty deprioritizes insight types the parent has seen recently, so the
 * weekly card never says "Thursdays again" three weeks in a row.
 *
 * Zero LLM calls. The ranked output feeds the narration layer (copilot.ts).
 */

import type { DetectedPattern, InsightType } from "./copilot";

/** Confidence bands derived from the missions observed behind a pattern. */
export const CONFIDENCE_BANDS = {
  /** Fewer than 8 missions: too sparse to trust — suppress entirely. */
  LOW_MIN_SAMPLE: 8,
  /** 20+ missions: solid signal. */
  HIGH_MIN_SAMPLE: 20,
} as const;

export type InsightConfidence = "low" | "medium" | "high";

/** Confidence multipliers used in the ranking score. */
export const CONFIDENCE_MULTIPLIERS: Record<InsightConfidence, number> = {
  low: 0, // suppressed — never surfaced
  medium: 0.7,
  high: 1.0,
};

/**
 * Actionability: how concrete and doable is the parent's next step?
 * Concrete schedule/behavior shifts score highest; celebrations score
 * lowest (still valuable, but they don't need the weekly slot).
 */
export const ACTIONABILITY_SCORES: Record<InsightType, number> = {
  weak_weekday: 1.0, // "try this on Thursdays" — specific day, specific swap
  weak_category: 0.9, // "start together with a tiny first step" — concrete
  difficulty_mismatch: 0.9, // "ease down a notch" — concrete calibration
  completion_drop: 0.8, // "reset the rhythm" — actionable, slightly vague
  skill_imbalance: 0.7, // "bridge through the strong skill" — needs thought
  streak_at_risk: 0.6, // gentle nudge — low stakes either way
  weak_skill: 0.6, // informational
  engagement_rise: 0.4, // celebration — wonderful, but not the weekly slot
  independence_milestone: 0.5, // celebration of autonomy — joyful, not urgent
};

export interface RankedInsight {
  pattern: DetectedPattern;
  /** 0..1 — the composite ranking score. */
  score: number;
  confidence: InsightConfidence;
  sampleSize: number;
  actionability: number;
  novelty: number;
  /** True when this is the single insight to surface this week. */
  isWeeklyPick: boolean;
  /** Why this ranked where it did — for the "Tell me more" expander. */
  rationale: string;
}

/** Best-effort sample size extraction from a pattern's fact detail. */
export function sampleSizeFor(pattern: DetectedPattern): number {
  const d = pattern.detail;
  const candidates = [
    d.assigned,
    d.assignedThisWeek,
    d.strongCount,
    d.streakDays,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c >= 0) return Math.floor(c);
  }
  return 0;
}

export function confidenceForSampleSize(sampleSize: number): InsightConfidence {
  if (sampleSize < CONFIDENCE_BANDS.LOW_MIN_SAMPLE) return "low";
  if (sampleSize < CONFIDENCE_BANDS.HIGH_MIN_SAMPLE) return "medium";
  return "high";
}

/**
 * Novelty: 1.0 for a fresh insight type, decaying for repeats.
 * Each recent occurrence of the same type multiplies by 0.5, so a pattern
 * seen last week scores half, two weeks running scores a quarter.
 */
export function noveltyFor(
  insightType: InsightType,
  recentInsightTypes: readonly InsightType[],
): number {
  let repeats = 0;
  for (const t of recentInsightTypes) {
    if (t === insightType) repeats += 1;
  }
  return Math.pow(0.5, repeats);
}

/** Score a single pattern. Pure function — no side effects. */
export function scoreInsight(
  pattern: DetectedPattern,
  recentInsightTypes: readonly InsightType[] = [],
): Omit<RankedInsight, "isWeeklyPick"> {
  const sampleSize = sampleSizeFor(pattern);
  const confidence = confidenceForSampleSize(sampleSize);
  const actionability = ACTIONABILITY_SCORES[pattern.insightType] ?? 0.5;
  const novelty = noveltyFor(pattern.insightType, recentInsightTypes);
  const score =
    actionability * (CONFIDENCE_MULTIPLIERS[confidence] ?? 0) * novelty;
  const rationale =
    `Actionability ${actionability.toFixed(2)} × confidence ${confidence} ` +
    `(${sampleSize} missions) × novelty ${novelty.toFixed(2)}.`;
  return { pattern, score, confidence, sampleSize, actionability, novelty, rationale };
}

export interface RankInsightsOptions {
  /** Insight types surfaced in recent weeks — drives novelty decay. */
  recentInsightTypes?: readonly InsightType[];
}

/**
 * Rank all detected patterns. Returns them sorted best-first; exactly the
 * top non-suppressed insight is marked `isWeeklyPick`. Low-confidence
 * patterns score 0 and are never picked.
 */
export function rankInsights(
  patterns: readonly DetectedPattern[],
  options: RankInsightsOptions = {},
): RankedInsight[] {
  const recent = options.recentInsightTypes ?? [];
  const scored = patterns.map((p) => scoreInsight(p, recent));
  scored.sort((a, b) => b.score - a.score);
  const ranked: RankedInsight[] = scored.map((s) => ({ ...s, isWeeklyPick: false }));
  const pick = ranked.find((r) => r.score > 0);
  if (pick) pick.isWeeklyPick = true;
  return ranked;
}

/** The single insight to surface this week, or null when nothing qualifies. */
export function weeklyPick(
  patterns: readonly DetectedPattern[],
  options: RankInsightsOptions = {},
): RankedInsight | null {
  const ranked = rankInsights(patterns, options);
  return ranked.find((r) => r.isWeeklyPick) ?? null;
}
