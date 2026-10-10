/**
 * Transition Predictor — billion-dollar redesign, Change 3 (Age Ladder).
 *
 * One app cannot serve ages 4–12. The product is three modes:
 *   sprout (4–6) → grow (7–9) → thrive (10–12)
 * Aging up must feel like leveling up, not like outgrowing a baby app.
 *
 * This module detects when a child is outgrowing their mode, deterministically:
 *  - Elo readiness ratings hitting the ceiling (mastery of current mode)
 *  - Completion rates on "hard" missions staying high (not challenged)
 *  - Skipping age-typical "young" missions (bored by the mode's content)
 *  - Chronological age approaching the mode boundary
 *
 * Output feeds the graduation-ceremony UX (owned by the kid-UX agent).
 * Zero LLM calls. Pure functions over the ChildSnapshot + Elo state.
 */

import type { ChildSnapshot } from "./mission-engine";
import { ELO_MAX_RATING } from "./flow-calibration";

export const AGE_MODES = ["sprout", "grow", "thrive"] as const;
export type AgeMode = (typeof AGE_MODES)[number];

/** Age ranges per mode (inclusive). */
export const AGE_MODE_RANGES: Record<AgeMode, { min: number; max: number }> = {
  sprout: { min: 4, max: 6 },
  grow: { min: 7, max: 9 },
  thrive: { min: 10, max: 12 },
};

export function ageModeForAge(age: number | null): AgeMode | null {
  if (age == null || !Number.isFinite(age)) return null;
  for (const mode of AGE_MODES) {
    const r = AGE_MODE_RANGES[mode];
    if (age >= r.min && age <= r.max) return mode;
  }
  return age < 4 ? "sprout" : "thrive";
}

export function nextMode(mode: AgeMode): AgeMode | null {
  const i = AGE_MODES.indexOf(mode);
  return i >= 0 && i < AGE_MODES.length - 1 ? AGE_MODES[i + 1] : null;
}

export interface TransitionSignals {
  /** Fraction of Elo-rated categories at/near the ceiling. */
  ceilingFraction: number;
  /** Completion rate on hard missions (null when no hard sample). */
  hardCompletionRate: number | null;
  /** Skip/reject rate on easy missions (boredom signal). */
  easySkipRate: number | null;
  /** True when chronological age is at/above the mode's max. */
  ageAtBoundary: boolean;
  /** Total lifetime completions (tenure signal). */
  lifetimeCompletions: number;
}

export interface ModeTransition {
  ready: boolean;
  fromMode: AgeMode;
  toMode: AgeMode | null;
  /** 0..1 — fraction of transition signals firing. */
  confidence: number;
  /** Human-readable reasons, strength-first, for the graduation UX. */
  reasons: string[];
}

/** Elo ratings per category → ceiling fraction. Input: category → rating. */
export function ceilingFractionForRatings(
  ratings: Record<string, number>,
): number {
  const values = Object.values(ratings).filter((r) => Number.isFinite(r));
  if (values.length === 0) return 0;
  const atCeiling = values.filter((r) => r >= ELO_MAX_RATING - 50).length;
  return atCeiling / values.length;
}

export interface DetectTransitionInput {
  snapshot: ChildSnapshot;
  /** Current mode the child is in (from their profile). */
  currentMode: AgeMode;
  /** Elo readiness ratings per category (from flow-calibration state). */
  eloRatings: Record<string, number>;
  /** Skip rate on easy missions, 0..1 (null when unknown). */
  easySkipRate?: number | null;
}

/**
 * Detect whether the child is ready to graduate to the next mode.
 * Requires at least 2 of 4 signals (or age-at-boundary + 1 other).
 */
export function detectModeTransition(input: DetectTransitionInput): ModeTransition {
  const { snapshot, currentMode, eloRatings } = input;
  const toMode = nextMode(currentMode);
  const reasons: string[] = [];

  const ceilingFraction = ceilingFractionForRatings(eloRatings);
  const hardRate =
    typeof snapshot.completionRateByDifficulty?.hard === "number"
      ? snapshot.completionRateByDifficulty.hard
      : null;
  const easySkipRate =
    typeof input.easySkipRate === "number" ? input.easySkipRate : null;
  const age = snapshot.age;
  const range = AGE_MODE_RANGES[currentMode];
  const ageAtBoundary = age != null && age >= range.max;

  let signals = 0;

  if (ceilingFraction >= 0.5) {
    signals += 1;
    reasons.push("mastering challenges across categories");
  }
  if (hardRate != null && hardRate >= 0.8) {
    signals += 1;
    reasons.push("acing the hardest missions");
  }
  if (easySkipRate != null && easySkipRate >= 0.4) {
    signals += 1;
    reasons.push("outgrowing the easier missions");
  }
  if (ageAtBoundary) {
    signals += 1;
    reasons.push("ready for the next stage");
  }

  // Need 2+ signals firing, plus a minimum tenure so brand-new
  // children don't graduate on a lucky week.
  const ready = toMode != null && signals >= 2 && snapshot.lifetime.totalCompletions >= 20;
  const confidence = Math.min(1, signals / 4);

  return {
    ready,
    fromMode: currentMode,
    toMode: ready ? toMode : null,
    confidence: Math.round(confidence * 100) / 100,
    reasons,
  };
}

/** Deterministic graduation message. The kid-UX agent renders the ceremony. */
export function graduationMessage(transition: ModeTransition): string | null {
  if (!transition.ready || !transition.toMode) return null;
  const modeNames: Record<AgeMode, string> = {
    sprout: "Sprout",
    grow: "Grow",
    thrive: "Thrive",
  };
  const highlight =
    transition.reasons.length > 0 ? transition.reasons[0] : "growing so much";
  return (
    `Big news: it's time to graduate from ${modeNames[transition.fromMode]} ` +
    `to ${modeNames[transition.toMode]}. You've been ${highlight} — ` +
    `the next adventure is waiting.`
  );
}
