/**
 * Erikson stage grammars for the Developmental Mission Engine.
 *
 * Mission *framing* changes with developmental stage — not just difficulty.
 * Two grammars, selected deterministically (no LLM, no labels):
 *
 *  - initiative (roughly ages 3-6, Erikson's "purpose" stage): "you lead,
 *    we follow." Open-ended, no fail state, parent as audience/witness.
 *    Emphasis on creating, directing, imagining.
 *  - industry (roughly ages 5-12, Erikson's "competence" stage): real
 *    multi-step work, mastery ladders, free retry, process-focused praise
 *    ("you stuck with the tricky part"). Emphasis on doing, completing,
 *    mastering.
 *  - blend (ages 5-6): starts initiative-flavored, scaffolds toward one
 *    completable outcome.
 *
 * Regression rule: under stress signals (disengaged), any child gets the
 * gentler initiative grammar WITHOUT labeling — the child is never told
 * why missions got gentler, and no stress/mental-health language appears
 * anywhere.
 *
 * Anti-comparison is structural: no grammar variant may introduce ranking,
 * leaderboards, scores-vs-peers, or "top X%" framing. Cooperative framing
 * only; the child's only benchmark is their own last week.
 */

import type { IdeaAgeBand } from "./ideas";

/** Developmental framing grammar applied to a whole mission set. */
export const STAGE_GRAMMARS = ["initiative", "industry", "blend"] as const;
export type StageGrammar = (typeof STAGE_GRAMMARS)[number];

/**
 * Select the grammar for a mission set. Pure function, deterministic.
 *
 * - stressed (disengaged signals: skip streaks, abandonment, long gap)
 *   wins over everything: the regression rule sends the child the gentler
 *   initiative grammar, unlabeled.
 * - Ages 5-6 (overlap window) get the blend.
 * - Age band 4-6 (age unknown or under 5) gets initiative; 7-9 and 10-12
 *   get industry.
 *
 * @param age child's age in years, or null when unknown
 * @param ageBand coarse band used across the AI layer
 * @param stressed true when recent engagement signals indicate stress
 */
export function selectStageGrammar(
  age: number | null,
  ageBand: IdeaAgeBand,
  stressed: boolean,
): StageGrammar {
  if (stressed) return "initiative";
  if (age !== null && age >= 5 && age <= 6) return "blend";
  if (ageBand === "4-6") return "initiative";
  return "industry";
}

/**
 * Anti-comparison rules shared by every grammar. Cooperative framing only;
 * never rank, never compare to other children.
 */
export const ANTI_COMPARISON_RULES = [
  "No ranking, leaderboards, scores-vs-peers, or 'top X%' framing — ever. Cooperative framing only.",
  "The child's only benchmark is their own last week. Celebrate personal growth, never relative standing.",
].join("\n");

/**
 * Design rules the LLM must follow for EVERY mission in the set, keyed by
 * grammar. Kid-friendly language; no clinical terms; no trademarked names.
 */
export const GRAMMAR_DESIGN_RULES: Record<StageGrammar, string> = {
  initiative: [
    "INITIATIVE GRAMMAR (ages ~3-6, 'you lead, we follow'):",
    "- The child DIRECTS the mission; the parent is the audience and witness, never the supervisor.",
    "- Open-ended: no fail state, no wrong way to complete it. Completion = the child tried and led.",
    "- Emphasize creating, directing, imagining, pretending — the child decides what 'done' looks like.",
    "- Keep steps loose and playful (1-2 invitations, not instructions). Follow the child's lead in the detail text.",
    "- Celebrate their direction: 'Maya decided the guinea pigs get a parade route' beats 'Maya completed step 3'.",
  ].join("\n"),
  industry: [
    "INDUSTRY GRAMMAR (ages ~5-12, 'competence through doing'):",
    "- Real multi-step work: a genuine job, really finished. Visible progress (checkpoints the child can see).",
    "- Mastery-ladder shape: each step slightly harder than the last, ending in something to be proud of.",
    "- Free retry, no penalty for attempts. Brave tries count as data, never as failure.",
    "- Process-focused praise in the detail text ('you stuck with the tricky part'), never outcome-only praise.",
    "- Concrete, completable, and owned end-to-end by the child (parent as companion, not manager).",
  ].join("\n"),
  blend: [
    "BLEND GRAMMAR (ages 5-6 transition):",
    "- Start initiative-flavored: the child leads, open-ended, playful, no fail state.",
    "- Then gently scaffold toward ONE completable outcome the child can own ('and then we get to see it finished!').",
    "- Parent follows the child's lead and quietly narrows choices — companion, not instructor.",
    "- Celebrate both the leading (their ideas) and the finishing (their follow-through).",
  ].join("\n"),
};

/**
 * Full grammar instruction block for the LLM user message. Combines the
 * grammar's design rules with the always-on anti-comparison rules.
 */
export function grammarInstructionFor(grammar: StageGrammar): string {
  return [GRAMMAR_DESIGN_RULES[grammar], ANTI_COMPARISON_RULES].join("\n");
}
