/**
 * Choice Adventures — decision intelligence for kids.
 *
 * Kids don't learn decision-making from being told what's right. They learn
 * it from making choices, seeing consequences, and getting to try again.
 * This module provides:
 *
 *  - ChoiceScenario types: branching narratives (2-3 choices → outcomes).
 *  - SEED_SCENARIOS: hand-crafted starter content per age mode (kid-safe,
 *    no right answers). The LLM generates fresh scenarios; seeds guarantee
 *    the UI always has something to show.
 *  - branchingComplexity: age mode (+ optional Elo) → choice count & depth.
 *  - detectDecisionPattern: deterministic pattern detection from choice
 *    events (timing + archetypes + rewind behavior). Coarse, internal-only —
 *    the parent NEVER sees a label, only strength-first growth language.
 *  - buildChoiceScenarioPrompt / parseChoiceScenarioResponse: LLM prompt
 *    builder + parser. The model sees coarse trait bands + age mode only —
 *    never PII, never the child's name.
 *  - decisionGrowthCopy: parent-facing, strength-first, calm-language-safe.
 *
 * Zero LLM calls in this module. Prompt builders only.
 * "Lantern, not leash": the AI never grades decisions. There are no right
 * choices — only different outcomes. We celebrate that the child is thinking.
 */

export type ChoiceAgeMode = "sprout" | "grow" | "thrive";

/** Archetype of a single choice — internal only, never shown to kid/parent. */
export type ChoiceArchetype = "bold" | "kind" | "careful" | "playful";

/** How the outcome felt — for the journal. NOT good/bad. */
export type OutcomeFeeling = "happy" | "okay" | "tricky";

export interface AdventureChoice {
  id: string;
  label: string;
  emoji: string;
  /** Internal archetype for pattern detection. Never surfaced. */
  archetype: ChoiceArchetype;
}

export interface AdventureOutcome {
  choiceId: string;
  headline: string;
  /** 1-2 sentences. Consequence, not judgment. */
  story: string;
  emoji: string;
  feeling: OutcomeFeeling;
}

export interface ChoiceScenario {
  id: string;
  title: string;
  emoji: string;
  /** The setup — 2-3 sentences max, visual-first. */
  setup: string;
  choices: AdventureChoice[];
  outcomes: AdventureOutcome[];
  ageMode: ChoiceAgeMode;
  /** Which decision pattern this scenario gently probes (internal only). */
  probesPattern?: DecisionPattern;
}

/** Coarse decision patterns — internal only. Parents see growth language. */
export type DecisionPattern =
  | "impulsivity"      // decides very fast, rarely explores alternatives
  | "people_pleasing"  // consistently picks the "kind" archetype
  | "avoidance"        // consistently picks the "careful"/safest archetype
  | "deliberation"     // takes time, weighs options
  | "exploration";     // rewinds often, tries many paths

export interface ChoiceEvent {
  scenarioId: string;
  choiceId: string;
  choiceArchetype: ChoiceArchetype;
  /** ms from scenario shown to choice picked */
  decisionTimeMs: number;
  /** Did the kid rewind this adventure? */
  rewound: boolean;
  /** Total distinct paths explored in this adventure */
  pathsExplored: number;
  atMs: number;
}

/* ------------------------------------------------------------------ */
/* Seed scenarios — hand-crafted starter content. Kid-safe, no right   */
/* answers. The LLM generates fresh scenarios; seeds keep the UI alive */
/* before/without generation.                                          */
/* ------------------------------------------------------------------ */

export const SEED_SCENARIOS: ChoiceScenario[] = [
  // ---- SPROUT (4-6): 2 simple choices ----
  {
    id: "seed-sprout-crayon",
    title: "The Red Crayon",
    emoji: "🖍️",
    setup: "You are coloring a big rainbow. Your friend Sam wants the red crayon you are using right now.",
    ageMode: "sprout",
    probesPattern: "people_pleasing",
    choices: [
      { id: "share", label: "Share the red crayon", emoji: "🤝", archetype: "kind" },
      { id: "wait", label: "Ask Sam to wait a bit", emoji: "⏳", archetype: "bold" },
    ],
    outcomes: [
      {
        choiceId: "share",
        headline: "You shared!",
        story: "Sam smiles big and colors a red sun. You pick up the orange crayon and keep going. Sharing felt warm.",
        emoji: "🌞",
        feeling: "happy",
      },
      {
        choiceId: "wait",
        headline: "You asked for a minute",
        story: "Sam waits and watches. You finish your red stripe, then hand it over. Sam says thanks! Waiting worked out.",
        emoji: "🌈",
        feeling: "happy",
      },
    ],
  },
  {
    id: "seed-sprout-puddle",
    title: "The Big Puddle",
    emoji: "💧",
    setup: "After the rain there is a giant puddle on the path. Your boots are on. Your grown-up is watching.",
    ageMode: "sprout",
    probesPattern: "impulsivity",
    choices: [
      { id: "splash", label: "Splash right in!", emoji: "💦", archetype: "bold" },
      { id: "around", label: "Walk around it", emoji: "🚶", archetype: "careful" },
    ],
    outcomes: [
      {
        choiceId: "splash",
        headline: "SPLASH!",
        story: "Water flies everywhere! Your socks are a little wet, but you are laughing so hard. What a splash!",
        emoji: "😄",
        feeling: "happy",
      },
      {
        choiceId: "around",
        headline: "Careful steps",
        story: "You step around the puddle and stay dry. You spot a worm on the other side — hello, worm!",
        emoji: "🪱",
        feeling: "okay",
      },
    ],
  },
  // ---- GROW (7-9): 2-3 choices ----
  {
    id: "seed-grow-team",
    title: "Picking Teams",
    emoji: "⚽",
    setup: "At recess, two friends both want you on their team for kickball. Alex's team and Jordan's team. Everyone is waiting.",
    ageMode: "grow",
    probesPattern: "avoidance",
    choices: [
      { id: "alex", label: "Join Alex's team", emoji: "🅰️", archetype: "bold" },
      { id: "jordan", label: "Join Jordan's team", emoji: "🌀", archetype: "kind" },
      { id: "suggest", label: "Suggest mixing the teams up", emoji: "🔀", archetype: "playful" },
    ],
    outcomes: [
      {
        choiceId: "alex",
        headline: "Team Alex!",
        story: "Alex cheers. Jordan looks a little sad, but then the game starts and everyone is running and laughing.",
        emoji: "🏃",
        feeling: "okay",
      },
      {
        choiceId: "jordan",
        headline: "Team Jordan!",
        story: "Jordan grins. Alex shrugs and says 'you're going down!' — it's all friendly. Game on!",
        emoji: "🎉",
        feeling: "okay",
      },
      {
        choiceId: "suggest",
        headline: "New teams!",
        story: "You suggest shuffling everyone. Both captains agree! The teams are mixed and the game feels fresh and fair.",
        emoji: "✨",
        feeling: "happy",
      },
    ],
  },
  {
    id: "seed-grow-secret",
    title: "A Friend's Secret",
    emoji: "🤫",
    setup: "Your friend tells you a secret and says 'don't tell anyone.' Later, another friend asks you what the secret is.",
    ageMode: "grow",
    probesPattern: "people_pleasing",
    choices: [
      { id: "keep", label: "Keep the secret", emoji: "🔒", archetype: "careful" },
      { id: "deflect", label: "Say 'I can't share that'", emoji: "💬", archetype: "bold" },
      { id: "tell", label: "Tell the secret", emoji: "📢", archetype: "playful" },
    ],
    outcomes: [
      {
        choiceId: "keep",
        headline: "Secret kept",
        story: "You just smile and change the subject. Your friend trusts you even more now. Trust is a treasure.",
        emoji: "💎",
        feeling: "happy",
      },
      {
        choiceId: "deflect",
        headline: "Honest and kind",
        story: "You say 'that's not mine to share.' The other friend nods — they get it. You protected both friendships.",
        emoji: "🤝",
        feeling: "happy",
      },
      {
        choiceId: "tell",
        headline: "The secret spreads",
        story: "You tell. It feels exciting for a second — then your friend finds out and looks hurt. Secrets are heavy to carry.",
        emoji: "💔",
        feeling: "tricky",
      },
    ],
  },
  // ---- THRIVE (10-12): dilemmas with tradeoffs ----
  {
    id: "seed-thrive-project",
    title: "The Science Fair Dilemma",
    emoji: "🔬",
    setup: "The science fair is in two weeks. Your volcano is almost done, but your best friend's project fell apart and they asked for your help. Helping means less time on your own project.",
    ageMode: "thrive",
    probesPattern: "deliberation",
    choices: [
      { id: "help", label: "Help your friend rebuild", emoji: "🛠️", archetype: "kind" },
      { id: "focus", label: "Focus on your own project", emoji: "🎯", archetype: "bold" },
      { id: "both", label: "Split time between both", emoji: "⚖️", archetype: "careful" },
    ],
    outcomes: [
      {
        choiceId: "help",
        headline: "Friend first",
        story: "You spend three afternoons helping. Their project comes back to life — and they credit you on the poster. Your volcano is simpler than planned, but you learned how it feels to show up for someone.",
        emoji: "🏆",
        feeling: "happy",
      },
      {
        choiceId: "focus",
        headline: "Your best work",
        story: "Your volcano erupts perfectly and wins a ribbon. Your friend's project is wobbly. You feel proud — and a little torn. Both feelings can be true.",
        emoji: "🎖️",
        feeling: "okay",
      },
      {
        choiceId: "both",
        headline: "The juggle",
        story: "You split your time. Both projects turn out decent — not amazing, not bad. You learn that dividing attention has a cost, and sometimes that's the right price.",
        emoji: "🤹",
        feeling: "okay",
      },
    ],
  },
  {
    id: "seed-thrive-post",
    title: "The Photo Post",
    emoji: "📸",
    setup: "You took a hilarious photo of your friend mid-sneeze at lunch. Everyone would laugh. Your friend hasn't seen it yet, and you haven't asked.",
    ageMode: "thrive",
    probesPattern: "impulsivity",
    choices: [
      { id: "ask", label: "Ask your friend first", emoji: "💬", archetype: "careful" },
      { id: "post", label: "Post it — it's funny!", emoji: "🚀", archetype: "bold" },
      { id: "show", label: "Show just your friend", emoji: "👀", archetype: "playful" },
    ],
    outcomes: [
      {
        choiceId: "ask",
        headline: "Permission first",
        story: "Your friend laughs and says 'post it!' Now it's funny for everyone — including them. Asking took ten seconds and changed everything.",
        emoji: "✅",
        feeling: "happy",
      },
      {
        choiceId: "post",
        headline: "Posted in a hurry",
        story: "It gets lots of laughs. But at lunch your friend is quiet. Funny for the crowd isn't always funny for the person in the photo.",
        emoji: "😶",
        feeling: "tricky",
      },
      {
        choiceId: "show",
        headline: "Just between you two",
        story: "You show your friend privately. You both crack up, and it becomes your inside joke. Some laughs are better shared small.",
        emoji: "😂",
        feeling: "happy",
      },
    ],
  },
  // ---- RESPECT scenarios: boundaries, fairness, treating others well ----
  {
    id: "seed-sprout-game",
    title: "Not My Game",
    emoji: "🎮",
    setup: "Your friend is playing a game on their tablet. You really want a turn, but they said 'not right now' and kept playing.",
    ageMode: "sprout",
    probesPattern: "impulsivity",
    choices: [
      { id: "wait", label: "Wait until they offer", emoji: "⏳", archetype: "careful" },
      { id: "ask", label: "Ask nicely one more time", emoji: "🙏", archetype: "kind" },
    ],
    outcomes: [
      {
        choiceId: "wait",
        headline: "You waited",
        story: "After a few minutes, your friend looks up and says 'okay, your turn!' Waiting showed them their 'no' mattered — and it felt good to be trusted.",
        emoji: "🌟",
        feeling: "happy",
      },
      {
        choiceId: "ask",
        headline: "One kind ask",
        story: "You ask sweetly: 'Can I have a turn when you're done?' Your friend nods. Asking — not grabbing — kept the friendship smooth.",
        emoji: "💛",
        feeling: "happy",
      },
    ],
  },
  {
    id: "seed-grow-borrow",
    title: "The Borrowed Book",
    emoji: "📖",
    setup: "You borrowed your cousin's favorite comic book last week. There's a small juice stain on one page now. Your cousin is coming over today.",
    ageMode: "grow",
    probesPattern: "deliberation",
    choices: [
      { id: "tell", label: "Tell them right away", emoji: "🗣️", archetype: "bold" },
      { id: "hide", label: "Say nothing and hope they don't notice", emoji: "🤫", archetype: "careful" },
      { id: "fix", label: "Try to fix it first, then tell them", emoji: "🛠️", archetype: "kind" },
    ],
    outcomes: [
      {
        choiceId: "tell",
        headline: "Honest up front",
        story: "You show them the stain right away and say sorry. They're a little sad — then they say 'thanks for telling me.' Owning it kept the trust.",
        emoji: "🤝",
        feeling: "happy",
      },
      {
        choiceId: "hide",
        headline: "The secret stain",
        story: "They find it halfway through reading. 'Was this you?' The stain was small — the hiding felt bigger. Trust is easier to keep than rebuild.",
        emoji: "😟",
        feeling: "tricky",
      },
      {
        choiceId: "fix",
        headline: "Fix and fess up",
        story: "You gently blot the page, then tell them what happened. They appreciate both the effort and the honesty. Respecting their things meant respecting them.",
        emoji: "✨",
        feeling: "happy",
      },
    ],
  },
  // ---- PATIENCE scenarios: waiting well, delayed gratification ----
  {
    id: "seed-sprout-cookie",
    title: "One Cookie or Two?",
    emoji: "🍪",
    setup: "Grown-up puts one cookie in front of you. 'You can eat it now — or wait 10 minutes while we read a story, and you can have TWO cookies.'",
    ageMode: "sprout",
    probesPattern: "impulsivity",
    choices: [
      { id: "now", label: "Eat the one cookie now", emoji: "😋", archetype: "bold" },
      { id: "wait", label: "Wait for two cookies", emoji: "⏳", archetype: "careful" },
    ],
    outcomes: [
      {
        choiceId: "now",
        headline: "Yum, one cookie!",
        story: "Crunch! Delicious. The story is fun too — but somewhere in the middle you wonder what two cookies would have tasted like. Wondering is okay!",
        emoji: "🍪",
        feeling: "okay",
      },
      {
        choiceId: "wait",
        headline: "Two cookies!",
        story: "The story ends, and there they are — TWO cookies! Waiting was a little wiggly, but wow, double cookies. Patience tastes sweet.",
        emoji: "🍪🍪",
        feeling: "happy",
      },
    ],
  },
  {
    id: "seed-grow-seeds",
    title: "The Slow Seeds",
    emoji: "🌱",
    setup: "You planted bean seeds in a cup a week ago. Nothing is poking up yet. Your friend's fast-growing cress already sprouted. You could dig yours up to check — or keep waiting.",
    ageMode: "grow",
    probesPattern: "deliberation",
    choices: [
      { id: "dig", label: "Dig one up to peek", emoji: "🔍", archetype: "bold" },
      { id: "wait", label: "Keep watering and wait", emoji: "💧", archetype: "careful" },
      { id: "journal", label: "Draw what you imagine is happening underground", emoji: "🎨", archetype: "playful" },
    ],
    outcomes: [
      {
        choiceId: "dig",
        headline: "A tiny peek",
        story: "You find a pale little root! But the seed you dug up won't grow now. Some things break when we rush them — roots need their quiet time.",
        emoji: "🌱",
        feeling: "tricky",
      },
      {
        choiceId: "wait",
        headline: "Green surprise!",
        story: "Three days later — a green loop pushes through the soil! Waiting didn't just work, it felt like a little miracle you earned.",
        emoji: "🌿",
        feeling: "happy",
      },
      {
        choiceId: "journal",
        headline: "Underground imagination",
        story: "You draw roots spreading like secret rivers. When the real sprout comes, your drawing was almost right! Waiting + wondering is a superpower.",
        emoji: "🎨",
        feeling: "happy",
      },
    ],
  },
];

export function seedScenariosFor(mode: ChoiceAgeMode): ChoiceScenario[] {
  return SEED_SCENARIOS.filter((s) => s.ageMode === mode);
}

export function seedScenarioById(id: string): ChoiceScenario | undefined {
  return SEED_SCENARIOS.find((s) => s.id === id);
}

/* ------------------------------------------------------------------ */
/* Branching complexity — age mode (+ optional Elo) → choice count.    */
/* ------------------------------------------------------------------ */

export type DilemmaDepth = "simple" | "tradeoff";

export interface BranchingConfig {
  choiceCount: 2 | 3;
  depth: DilemmaDepth;
}

/**
 * Sprout: 2 simple choices. Grow: 2-3 (3 when thriving). Thrive: 3 with
 * real tradeoffs. Elo is optional — age mode alone is a fine default.
 */
export function branchingComplexity(
  ageMode: ChoiceAgeMode,
  eloRating?: number
): BranchingConfig {
  if (ageMode === "sprout") return { choiceCount: 2, depth: "simple" };
  if (ageMode === "grow") {
    const thriving = typeof eloRating === "number" && eloRating >= 1350;
    return { choiceCount: thriving ? 3 : 2, depth: "simple" };
  }
  return { choiceCount: 3, depth: "tradeoff" };
}

/* ------------------------------------------------------------------ */
/* Decision pattern detection — deterministic, internal only.          */
/* Parents see growth language; they NEVER see these labels.           */
/* ------------------------------------------------------------------ */

const MIN_EVENTS_FOR_PATTERN = 5;

/**
 * Classify a child's decision style from choice events.
 * Returns null when there isn't enough data — we don't guess.
 */
export function detectDecisionPattern(events: readonly ChoiceEvent[]): DecisionPattern | null {
  const valid = events.filter((e) => e.decisionTimeMs >= 0 && Number.isFinite(e.decisionTimeMs));
  if (valid.length < MIN_EVENTS_FOR_PATTERN) return null;

  const times = valid.map((e) => e.decisionTimeMs).sort((a, b) => a - b);
  const medianMs = times[Math.floor(times.length / 2)];

  const archetypeCounts: Record<ChoiceArchetype, number> = { bold: 0, kind: 0, careful: 0, playful: 0 };
  for (const e of valid) archetypeCounts[e.choiceArchetype] += 1;
  const n = valid.length;
  const kindShare = archetypeCounts.kind / n;
  const carefulShare = archetypeCounts.careful / n;

  const rewindRate = valid.filter((e) => e.rewound).length / n;
  const avgPaths = valid.reduce((s, e) => s + e.pathsExplored, 0) / n;

  // Exploration: the rewind kid. Tries many paths.
  if (rewindRate >= 0.4 || avgPaths >= 1.8) return "exploration";
  // Deliberation: takes real time to decide.
  if (medianMs >= 15000) return "deliberation";
  // Impulsivity: fast + never looks back.
  if (medianMs <= 4000 && rewindRate < 0.1) return "impulsivity";
  // People-pleasing: the kind choice, almost always.
  if (kindShare >= 0.7) return "people_pleasing";
  // Avoidance: the safe choice, almost always.
  if (carefulShare >= 0.7) return "avoidance";
  return null;
}

/* ------------------------------------------------------------------ */
/* Parent-facing growth copy — strength-first, calm, never a label.    */
/* ------------------------------------------------------------------ */

const PATTERN_GROWTH_COPY: Record<DecisionPattern, { strength: string; growth: string }> = {
  exploration: {
    strength: "loves seeing every possibility before settling",
    growth: "that curiosity about 'what if' is the seed of great judgment",
  },
  deliberation: {
    strength: "takes time to think things through",
    growth: "that pause-before-acting muscle is exactly what hard decisions need",
  },
  impulsivity: {
    strength: "decisive and full of energy",
    growth: "choice adventures are gently stretching that pause-and-consider muscle",
  },
  people_pleasing: {
    strength: "a big, generous heart that wants everyone happy",
    growth: "we're practicing that their own voice counts too",
  },
  avoidance: {
    strength: "thoughtful and careful — never reckless",
    growth: "adventures make it safe to try the bolder path, since every ending can be rewound",
  },
};

/**
 * "Maya explored 4 different endings this week. She's building the
 * thinking-ahead muscle." — patterns as growth, never as diagnosis.
 */
export function decisionGrowthCopy(
  childName: string,
  adventuresThisWeek: number,
  endingsExplored: number,
  pattern: DecisionPattern | null
): string {
  const base =
    adventuresThisWeek === 0
      ? `${childName} hasn't tried a choice adventure yet — they'll be here whenever curiosity strikes.`
      : `${childName} explored ${endingsExplored} different ending${endingsExplored === 1 ? "" : "s"} across ${adventuresThisWeek} choice adventure${adventuresThisWeek === 1 ? "" : "s"} this week.`;
  if (adventuresThisWeek === 0 || !pattern) {
    return `${base} Every ending explored is thinking practice.`;
  }
  const c = PATTERN_GROWTH_COPY[pattern];
  return `${base} ${childName} ${c.strength} — and ${c.growth}.`;
}

/* ------------------------------------------------------------------ */
/* LLM prompt builder — coarse bands only, never PII.                 */
/* ------------------------------------------------------------------ */

export const CHOICE_SCENARIO_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export interface ChoiceScenarioPromptInput {
  ageMode: ChoiceAgeMode;
  choiceCount: 2 | 3;
  depth: DilemmaDepth;
  /** Coarse trait bands — "blooming" | "growing" | "steady". Never scores. */
  traitBands: Record<string, "blooming" | "growing" | "steady">;
  /** Decision pattern to gently probe (optional). */
  probesPattern?: DecisionPattern;
  /** Titles of recent scenarios, to avoid repeats. */
  recentTitles?: string[];
}

const AGE_GUIDANCE: Record<ChoiceAgeMode, string> = {
  sprout:
    "Ages 4-6. Very simple language, one clear situation, concrete and immediate (toys, snacks, playground). No reading burden — short sentences.",
  grow:
    "Ages 7-9. School and friendship situations. Slightly more nuance, but still concrete. Short paragraphs.",
  thrive:
    "Ages 10-12. Real dilemmas with genuine tradeoffs — helping a friend vs. own goals, honesty vs. kindness. Respect their intelligence.",
};

export function buildChoiceScenarioPrompt(input: ChoiceScenarioPromptInput): { system: string; user: string } {
  const growingTraits = Object.entries(input.traitBands)
    .filter(([, band]) => band === "growing" || band === "steady")
    .map(([trait]) => trait);

  const system = [
    "You create branching choice adventures for children — tiny interactive stories where a child makes a decision and sees what happens.",
    "",
    "HARD RULES:",
    "- There are NO right or wrong choices. Every outcome is neutral-to-warm; even 'tricky' outcomes end with gentle warmth, never shame or punishment.",
    "- NEVER moralize. NEVER say 'you should have'. Describe what happens, kindly.",
    "- Keep language simple and visual. 2-3 sentences for setup, 1-2 per outcome.",
    "- Every choice gets exactly one outcome. Outcomes differ meaningfully — no two endings feel the same.",
    "- No scary, violent, or exclusion-themed content. No mention of parents divorcing, death, or bullying.",
    "- Output STRICT JSON only, matching the schema below. No markdown, no commentary.",
    "",
    "JSON SCHEMA:",
    '{ "title": string, "emoji": string (one emoji), "setup": string,',
    '  "choices": [ { "id": string (slug), "label": string, "emoji": string, "archetype": "bold"|"kind"|"careful"|"playful" } ],',
    '  "outcomes": [ { "choiceId": string, "headline": string, "story": string, "emoji": string, "feeling": "happy"|"okay"|"tricky" } ] }',
  ].join("\n");

  const user = [
    `Age mode: ${input.ageMode}. ${AGE_GUIDANCE[input.ageMode]}`,
    `Create exactly ${input.choiceCount} choices. Depth: ${input.depth === "tradeoff" ? "genuine tradeoff — each option costs something real" : "simple and clear — each option leads somewhere different"}.`,
    growingTraits.length > 0
      ? `Gently exercise these growth areas through the scenario's tension: ${growingTraits.join(", ")}. Do this through situation design, never through lecturing.`
      : "Design a fresh, delightful everyday situation.",
    input.probesPattern
      ? `The scenario's tension should gently invite the child to notice their own deciding style (no labeling, just an interesting fork).`
      : "",
    input.recentTitles && input.recentTitles.length > 0
      ? `Avoid repeating these recent scenarios: ${input.recentTitles.join("; ")}.`
      : "",
    "Return the JSON now.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

/** Validate + normalize a model response into a ChoiceScenario. Returns null on invalid. */
export function parseChoiceScenarioResponse(
  raw: unknown,
  ageMode: ChoiceAgeMode,
  id: string
): ChoiceScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.setup !== "string") return null;
  if (!Array.isArray(o.choices) || o.choices.length < 2 || o.choices.length > 3) return null;
  if (!Array.isArray(o.outcomes) || o.outcomes.length !== o.choices.length) return null;

  const archetypes: ChoiceArchetype[] = ["bold", "kind", "careful", "playful"];
  const feelings: OutcomeFeeling[] = ["happy", "okay", "tricky"];

  const choices: AdventureChoice[] = [];
  for (const c of o.choices) {
    if (!c || typeof c !== "object") return null;
    const cc = c as Record<string, unknown>;
    if (typeof cc.id !== "string" || typeof cc.label !== "string") return null;
    choices.push({
      id: cc.id,
      label: cc.label,
      emoji: typeof cc.emoji === "string" ? cc.emoji : "✨",
      archetype: archetypes.includes(cc.archetype as ChoiceArchetype)
        ? (cc.archetype as ChoiceArchetype)
        : "playful",
    });
  }

  const choiceIds = new Set(choices.map((c) => c.id));
  const outcomes: AdventureOutcome[] = [];
  for (const oc of o.outcomes) {
    if (!oc || typeof oc !== "object") return null;
    const oo = oc as Record<string, unknown>;
    if (typeof oo.choiceId !== "string" || !choiceIds.has(oo.choiceId)) return null;
    if (typeof oo.headline !== "string" || typeof oo.story !== "string") return null;
    outcomes.push({
      choiceId: oo.choiceId,
      headline: oo.headline,
      story: oo.story,
      emoji: typeof oo.emoji === "string" ? oo.emoji : "✨",
      feeling: feelings.includes(oo.feeling as OutcomeFeeling) ? (oo.feeling as OutcomeFeeling) : "okay",
    });
  }

  return {
    id,
    title: o.title,
    emoji: typeof o.emoji === "string" ? o.emoji : "🌿",
    setup: o.setup,
    choices,
    outcomes,
    ageMode,
  };
}

/** Calm-language scan for generated scenario text. Reuses the shared blocklist. */
export const SCENARIO_BANNED_PHRASES = [  "you should have",
  "wrong choice",
  "bad decision",
  "punish",
  "you failed",
  "stupid",
  "naughty",
] as const;

export function scanScenarioForJudgment(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of SCENARIO_BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

/** True when a generated scenario is safe to show (structure + language). */
export function validateScenarioText(scenario: ChoiceScenario): string[] {
  const violations: string[] = [];
  const texts = [
    scenario.title,
    scenario.setup,
    ...scenario.choices.map((c) => c.label),
    ...scenario.outcomes.map((o) => `${o.headline} ${o.story}`),
  ];
  for (const t of texts) {
    const hit = scanScenarioForJudgment(t);
    if (hit) violations.push(`judgmental phrase: "${hit}"`);
  }
  return violations;
}

/* ------------------------------------------------------------------ */
/* Socratic mode — prediction before consequence. Teaching kids to      */
/* think AHEAD, not just react. "What do YOU think will happen?"       */
/* ------------------------------------------------------------------ */

/** A child's prediction about their chosen path, made BEFORE the outcome. */
export interface ChoicePrediction {
  choiceId: string;
  predictedFeeling: OutcomeFeeling;
  /** Grow/Thrive: "I think ___ will happen because ___" */
  note?: string;
  predictedAtMs: number;
}

/** Age-appropriate Socratic prompt shown before the consequence reveals. */
export function socraticPromptFor(ageMode: ChoiceAgeMode, choiceLabel: string): string {
  switch (ageMode) {
    case "sprout":
      return `You picked "${choiceLabel}"! Quick guess — what do you think will happen?`;
    case "grow":
      return `You chose "${choiceLabel}". Before we see what happens — what do YOU think will happen?`;
    case "thrive":
      return `Interesting choice. Pause a second: predict the outcome. What happens next, and why do you think so?`;
  }
}

/** Gentle prediction-vs-reality reflection. Never "wrong" — predicting is the skill. */
export function predictionReflection(
  predicted: OutcomeFeeling,
  actual: OutcomeFeeling,
  childName: string
): string {
  if (predicted === actual) {
    return `You guessed it, ${childName}! Great predicting — that's thinking ahead. 🔮✨`;
  }
  return `Surprise! You guessed one thing and something else happened. That's the fun of predicting — every guess makes the next one sharper. 🔮💛`;
}

/* ------------------------------------------------------------------ */
/* "Why" round — articulation practice disguised as reflection.         */
/* After comparing endings: "Which did you like better? WHY?"          */
/* ------------------------------------------------------------------ */

export interface WhyPick {
  favoriteChoiceId: string;
  /** Grow: chip choice. Thrive: free text. Sprout: just the pick. */
  because?: string;
}

export const WHY_BECAUSE_CHIPS = [
  "it was funny",
  "it was kind",
  "it was surprising",
  "it was fair",
  "it felt brave",
] as const;

/** Articulation growth copy for the parent card. */
export function articulationCopy(endingsCompared: number, whyAnswered: boolean): string | null {
  if (endingsCompared < 2) return null;
  if (whyAnswered) {
    return `Compared ${endingsCompared} endings AND explained why — that's articulation practice, the root of confidence.`;
  }
  return `Compared ${endingsCompared} endings side by side — weighing options out loud is how judgment grows.`;
}
