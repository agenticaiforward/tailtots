/**
 * Parent-State Modeling + Anxiety Guardrails — billion-dollar redesign, Change 2.
 *
 * The product promise is calm, confident parenting. The mechanics of a
 * pattern-detecting dashboard can manufacture the opposite: compulsive
 * checking, worry spirals, alarmist framing. This module is the first
 * parenting-AI anxiety-guardrail layer:
 *
 *  - trackParentEngagement: classify parent app usage (healthy / elevated /
 *    compulsive) from dashboard-open events. Deterministic.
 *  - shouldThrottleInsights: compulsive parents get silence, not more data.
 *  - strengthFirstOrdering: every insight leads with what's working.
 *  - CALM_LANGUAGE_RULES: banned alarmist phrases + required framing, for
 *    LLM prompt builders and for scanning generated copy.
 *
 * Zero LLM calls in this module. Prompt builders consume CALM_LANGUAGE_RULES.
 */

export type ParentEngagementLevel = "healthy" | "elevated" | "compulsive";

/** One dashboard-open event. Coarse timestamp only — no content tracked. */
export interface ParentEngagementEvent {
  openedAt: string; // ISO
}

export interface ParentEngagementState {
  level: ParentEngagementLevel;
  /** Dashboard opens in the trailing 24h window. */
  opensLast24h: number;
  /** Distinct days with any opens in the trailing 7d window. */
  activeDaysLast7d: number;
  /** True when the parent should see a gentle "step away" nudge. */
  needsCalmNudge: boolean;
}

/** >5 dashboard opens in a day = compulsive checking. */
export const COMPULSIVE_OPENS_PER_DAY = 5;
/** 3–5 opens/day = elevated (watch, don't throttle yet). */
export const ELEVATED_OPENS_PER_DAY = 3;

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Classify parent engagement from dashboard-open events.
 * Deterministic — pure function over coarse timestamps.
 */
export function trackParentEngagement(
  events: readonly ParentEngagementEvent[],
  nowMs: number = Date.now(),
): ParentEngagementState {
  const dayAgo = nowMs - DAY_MS;
  const weekAgo = nowMs - 7 * DAY_MS;
  let opensLast24h = 0;
  const activeDays = new Set<string>();
  for (const e of events) {
    const ms = toMs(e.openedAt);
    if (!ms || ms > nowMs || ms < weekAgo) continue;
    if (ms >= dayAgo) opensLast24h += 1;
    activeDays.add(new Date(ms).toISOString().slice(0, 10));
  }
  const level: ParentEngagementLevel =
    opensLast24h > COMPULSIVE_OPENS_PER_DAY
      ? "compulsive"
      : opensLast24h >= ELEVATED_OPENS_PER_DAY
        ? "elevated"
        : "healthy";
  return {
    level,
    opensLast24h,
    activeDaysLast7d: activeDays.size,
    needsCalmNudge: level === "compulsive",
  };
}

/**
 * True when insights should be throttled (withheld, not reworded).
 * A compulsive parent gets silence + a calm nudge — more data would feed
 * the checking loop. Elevated parents still get the weekly insight.
 */
export function shouldThrottleInsights(state: ParentEngagementState): boolean {
  return state.level === "compulsive";
}

/** Deterministic calm nudge for a compulsive-checking parent. No LLM needed. */
export function calmNudgeMessage(): string {
  return (
    "You're checking in a lot today — that care is a good thing. " +
    "The patterns will still be here on Sunday. For now, the best data is " +
    "the kid in front of you."
  );
}

export interface StrengthFirstInput {
  /** What's working — the strength, win, or bright spot. Required. */
  strength: string;
  /** The growth area or observation. Required. */
  growthArea: string;
  /** One doable suggestion. Required. */
  suggestion: string;
}

/**
 * Restructure any insight to lead with what's working. Strength first,
 * growth area second, suggestion last. Never the reverse.
 */
export function strengthFirstOrdering(input: StrengthFirstInput): string {
  const s = input.strength.trim().replace(/\s+/g, " ");
  const g = input.growthArea.trim().replace(/\s+/g, " ");
  const sug = input.suggestion.trim().replace(/\s+/g, " ");
  return `${s} ${g} ${sug}`.trim();
}

// ---------------------------------------------------------------------------
// CALM_LANGUAGE_RULES — consumed by LLM prompt builders (copilot narration,
// blueprint, weekly insight) and by the calm-language scanner below.
// ---------------------------------------------------------------------------

/** Phrases that must never appear in parent-facing AI copy. */
export const BANNED_ALARMIST_PHRASES = [
  "warning",
  "alert",
  "concern",
  "concerning",
  "red flag",
  "at risk",
  "falling behind",
  "problem",
  "struggling",
  "failing",
  "worse",
  "deteriorating",
  "urgent",
  "critical",
  "danger",
] as const;

/** Framing every AI narration must follow. */
export const REQUIRED_CALM_FRAMING = [
  "Lead with a strength or bright spot before any growth area.",
  "Describe behavior, never label the child.",
  "State uncertainty honestly: sample sizes, 'we're still learning'.",
  "One doable suggestion, framed as something to try together.",
  "No exclamation marks. No emojis. No alarmist language.",
] as const;

export const CALM_LANGUAGE_RULES = {
  bannedPhrases: BANNED_ALARMIST_PHRASES,
  requiredFraming: REQUIRED_CALM_FRAMING,
  /** Strongest language permitted for a growth area. */
  maxSeverityPhrasing: "worth paying attention to",
} as const;

/** Scan generated copy for alarmist phrasing. Returns the first hit or null. */
export function scanForAlarmistLanguage(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_ALARMIST_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

/**
 * Validate parent-facing copy against the calm rules. Returns a list of
 * violations (empty = clean). Callers fall back to deterministic safe copy
 * on any violation.
 */
export function validateCalmCopy(text: string): string[] {
  const violations: string[] = [];
  const hit = scanForAlarmistLanguage(text);
  if (hit) violations.push(`alarmist phrase: "${hit}"`);
  if (/!/.test(text)) violations.push("exclamation mark");
  // Emoji detection: broad ranges covering common emoji blocks.
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(text)) {
    violations.push("emoji");
  }
  return violations;
}
