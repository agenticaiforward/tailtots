/**
 * TailTots Ecosystem — cross-context strength transfer.
 *
 * Finds traits that are STRONG in one context but WEAK in another, and turns
 * that into a strength-based coaching suggestion for an adult. The AI
 * personalizes THROUGH adults, positively:
 *
 *   "Maya shows real patience at the shelter — here's a home game that builds
 *    on that same strength."
 *
 * Hard rules (enforced here and in tests):
 * - Output is ALWAYS a CoachingSuggestion for an adult (parent | teacher).
 * - NEVER a label about the child. No deficit language, ever.
 * - NEVER auto-adjusts missions. Suggestions only; adults decide.
 * - Only strengths that appear in the suggestion bank may fire. No free text
 *   from the model — deterministic templates keep language safe.
 * - Evidence threshold: minimum missions in each context before firing.
 */
import type { CoachingAdult, CoachingSuggestion, ContextTraitSummary, EcoContext } from "./types";

/** Strengths the engine knows how to talk about. Closed set — no free text. */
const KNOWN_STRENGTHS = [
  "patience",
  "kindness",
  "perseverance",
  "empathy",
  "confidence",
  "respect",
  "curiosity",
  "self-control",
  "leadership",
  "responsibility",
  "teamwork",
] as const;

type KnownStrength = (typeof KNOWN_STRENGTHS)[number];

function isKnownStrength(s: string): s is KnownStrength {
  return (KNOWN_STRENGTHS as readonly string[]).includes(s.toLowerCase());
}

/**
 * Words that must NEVER appear in any output. Scanned in tests and at runtime.
 * The engine cannot produce deficit labels because it has no vocabulary for them.
 */
export const BANNED_OUTPUT_WORDS = [
  "anxious",
  "anxiety",
  "depressed",
  "depression",
  "impatient",
  "lazy",
  "disobedient",
  "defiant",
  "disruptive",
  "behind",
  "failing",
  "failure",
  "problem",
  "struggling",
  "weak",
  "weakness",
  "bad at",
  "can't",
  "won't",
  "never",
  "always",
  "diagnos",
  "disorder",
  "adhd",
  "autism",
] as const;

export function scanForBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_OUTPUT_WORDS.filter((w) => lower.includes(w));
}

/** Minimum missions per context before a suggestion can fire. */
export const MIN_EVIDENCE_MISSIONS = 3;
/** Strength threshold in the strong context. */
export const STRONG_THRESHOLD = 0.6;
/** Weakness ceiling in the target context. */
export const WEAK_CEILING = 0.4;

/** Deterministic activity bank: strength -> toContext -> activity. */
const ACTIVITY_BANK: Record<KnownStrength, Partial<Record<EcoContext, string>>> = {
  patience: {
    home: "the \"slow pour\" game — pour water between cups as slowly as possible, no spills",
    school: "a \"quiet corner\" book basket for calm-down reading time",
    community: "a \"sit-with-me\" shift: 10 quiet minutes near a shy animal",
  },
  kindness: {
    home: "a secret kindness mission — do one kind thing nobody sees, tell the family at dinner",
    school: "a compliment chain — each student adds one genuine compliment to the board",
    community: "a thank-you card for a shelter staffer or volunteer",
  },
  perseverance: {
    home: "a 7-day \"tiny steps\" chart for one hard thing, sticker per day",
    school: "\"marathon math\" — one extra question a day, tracked on a class chart",
    community: "a two-week donation drive with a visible progress jar",
  },
  empathy: {
    home: "\"feelings detective\" — guess the feeling in a story character's face, then check",
    school: "a \"listening circle\" where each child repeats back what they heard",
    community: "\"meet the shy ones\" — learn one animal's story and retell it kindly",
  },
  confidence: {
    home: "\"teach-back\" — the child teaches the parent something they learned",
    school: "a 1-minute class share about something they made or did",
    community: "adoption-day greeter: welcome one visitor with one true, kind fact",
  },
  respect: {
    home: "\"ask-first\" practice — ask before borrowing, then thank",
    school: "a \"turn-tokens\" discussion where everyone gets one uninterrupted turn",
    community: "\"gentle hands\" handling practice with small animals",
  },
  curiosity: {
    home: "a \"why jar\" — one wonder question a day, researched together weekly",
    school: "\"mystery object\" show-and-tell with three clues",
    community: "\"animal detective\" — learn and share three facts about one shelter animal",
  },
  "self-control": {
    home: "\"freeze dance\" with longer and longer freeze rounds",
    school: "\"pause button\" practice — stop, breathe, choose, before answering",
    community: "\"calm leash\" walking — practice slow, steady steps beside a dog",
  },
  leadership: {
    home: "let them plan one family evening — menu, game, and schedule",
    school: "a \"project captain\" role for one small group activity",
    community: "co-lead one event station with a grown-up nearby",
  },
  responsibility: {
    home: "one owned chore for a full week — same job, same time, no reminders after day 2",
    school: "\"classroom keeper\" of one shared supply for a week",
    community: "\"feeding buddy\" — same animal, same time, three visits",
  },
  teamwork: {
    home: "a two-person build — one holds, one tapes, switch halfway",
    school: "a pair puzzle with a \"both hands on\" rule",
    community: "a buddy clean-up — one holds the bag, one picks up, then switch",
  },
};

const CONTEXT_LABEL: Record<EcoContext, string> = {
  home: "home",
  school: "school",
  community: "the community",
};

const ADULT_FOR_CONTEXT: Record<EcoContext, CoachingAdult> = {
  home: "parent",
  school: "teacher",
  community: "parent", // community suggestions route through the parent (COPPA)
};

export interface DetectOptions {
  minEvidence?: number;
  strongThreshold?: number;
  weakCeiling?: number;
  /** Max suggestions returned (highest gap first). */
  limit?: number;
}

/**
 * Detect strength transfer opportunities across contexts.
 *
 * A suggestion fires when a KNOWN strength scores >= strongThreshold in one
 * context and <= weakCeiling in another, with >= minEvidence missions in
 * each. Output is deterministic, template-based, and strength-only.
 */
export function detectStrengthTransfer(
  summaries: ContextTraitSummary[],
  opts: DetectOptions = {},
): CoachingSuggestion[] {
  const minEvidence = opts.minEvidence ?? MIN_EVIDENCE_MISSIONS;
  const strongThreshold = opts.strongThreshold ?? STRONG_THRESHOLD;
  const weakCeiling = opts.weakCeiling ?? WEAK_CEILING;
  const limit = opts.limit ?? 3;

  // Index: trait -> context -> summary (keep the strongest score per trait+context).
  const byTrait = new Map<string, Map<EcoContext, ContextTraitSummary>>();
  for (const s of summaries) {
    const trait = s.trait.toLowerCase();
    if (!isKnownStrength(trait)) continue; // unknown traits never fire
    if (typeof s.score !== "number" || s.score < 0 || s.score > 1) continue;
    if (!byTrait.has(trait)) byTrait.set(trait, new Map());
    const existing = byTrait.get(trait)!.get(s.context);
    if (!existing || s.score > existing.score) byTrait.get(trait)!.set(s.context, s);
  }

  const suggestions: Array<CoachingSuggestion & { gap: number }> = [];

  for (const [trait, byCtx] of byTrait) {
    const entries = [...byCtx.values()];
    for (const strong of entries) {
      if (strong.score < strongThreshold) continue;
      if (strong.missionsCompleted < minEvidence) continue;
      for (const weak of entries) {
        if (weak.context === strong.context) continue;
        if (weak.score > weakCeiling) continue;
        if (weak.missionsCompleted < minEvidence) continue;

        const activity =
          ACTIVITY_BANK[trait as KnownStrength]?.[weak.context] ??
          `one small, joyful activity that practices ${trait} together`;
        const forAdult = ADULT_FOR_CONTEXT[weak.context];
        const framing =
          `Real strength spotted: ${trait} is blooming in ${CONTEXT_LABEL[strong.context]}. ` +
          `Try building on that same strength in ${CONTEXT_LABEL[weak.context]} — ${activity}. ` +
          `Same muscle, new setting.`;

        suggestions.push({
          forAdult,
          strength: trait,
          fromContext: strong.context,
          toContext: weak.context,
          suggestedActivity: activity,
          framing,
          gap: strong.score - weak.score,
        });
      }
    }
  }

  suggestions.sort((a, b) => b.gap - a.gap);
  const out: CoachingSuggestion[] = suggestions.slice(0, limit).map((s) => ({
    forAdult: s.forAdult,
    strength: s.strength,
    fromContext: s.fromContext,
    toContext: s.toContext,
    suggestedActivity: s.suggestedActivity,
    framing: s.framing,
  }));

  // Runtime safety net: no banned words may ever leave this function.
  for (const s of out) {
    const hits = scanForBannedWords(`${s.framing} ${s.suggestedActivity} ${s.strength}`);
    if (hits.length > 0) {
      throw new Error(`Banned words in cross-context output: ${hits.join(", ")}`);
    }
  }
  return out;
}

/**
 * Aggregate per-context trait summaries from mission events. Coarse only:
 * completion rate per (context, trait-tag) bucket. Callers tag events with
 * their EcoContext; events without a context default to "home" and never
 * cross boundaries.
 */
export interface ContextTaggedEvent {
  completed: boolean;
  context?: EcoContext;
  traitTags?: string[];
}

export function summarizeByContext(
  events: ContextTaggedEvent[],
): ContextTraitSummary[] {
  const buckets = new Map<string, { done: number; total: number; context: EcoContext; trait: string }>();
  for (const e of events) {
    const context: EcoContext = e.context ?? "home";
    for (const rawTag of e.traitTags ?? []) {
      const trait = rawTag.toLowerCase();
      if (!isKnownStrength(trait)) continue;
      const key = `${context}::${trait}`;
      if (!buckets.has(key)) buckets.set(key, { done: 0, total: 0, context, trait });
      const b = buckets.get(key)!;
      b.total += 1;
      if (e.completed) b.done += 1;
    }
  }
  return [...buckets.values()].map((b) => ({
    context: b.context,
    trait: b.trait,
    score: b.total > 0 ? b.done / b.total : 0,
    missionsCompleted: b.total,
  }));
}
