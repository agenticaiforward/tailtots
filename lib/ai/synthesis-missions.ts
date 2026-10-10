/**
 * Synthesis Missions — fast understanding and distillation.
 *
 * The future-skills trio, part 3: SYNTHESIZE FAST.
 * (Part 1: ask good questions — curiosity missions. Part 2: decide well —
 * Choice Adventures.)
 *
 * In an age of infinite information, the premium skill is rapidly grasping
 * new things, connecting dots, and distilling the essence. These mechanics
 * train it as play:
 *
 *  - ConnectTheDots: two seemingly unrelated completed missions — "what's
 *    the same about these?" Cross-domain pattern recognition.
 *  - TellItIn3: compress any story into 3 (emojis/sentences). Compression
 *    IS synthesis — finding what matters, dropping the rest.
 *  - TeachYourPet: Feynman technique for kids. "Explain it to your pet in
 *    30 seconds." If you can teach it simply, you understand it.
 *  - WeeklySynthesis: ONE question in the week review — "What was the
 *    biggest thing you figured out this week?" Distilling experience.
 *  - PatternSpotter: "You chose to share 3 times. What do you notice about
 *    yourself?" Metacognition — the kid becomes their own analyst.
 *
 * Playful challenge framing, never punitive. No anxiety timers — a friendly
 * countdown that encourages, never fails.
 *
 * Zero LLM calls in this module. Deterministic + prompt builders only.
 */

export type SynthesisAgeMode = "sprout" | "grow" | "thrive";

/* ------------------------------------------------------------------ */
/* Connect the Dots — "what's the same about these two missions?"      */
/* ------------------------------------------------------------------ */

export interface DotMission {
  title: string;
  category: "pet_care" | "chore" | "kindness" | "money" | "community";
  emoji?: string;
}

export interface DotPair {
  missionA: DotMission;
  missionB: DotMission;
  /** The connection — the "aha". Kid-friendly, one line. */
  connection: string;
  connectionEmoji: string;
  /** Wrong-but-plausible options for grow/thrive multiple choice. */
  distractors: string[];
}

const CATEGORY_THEMES: Record<DotMission["category"], { theme: string; emoji: string }> = {
  pet_care: { theme: "caring for another living thing", emoji: "💛" },
  kindness: { theme: "caring for another living thing", emoji: "💛" },
  chore: { theme: "taking care of your world", emoji: "🌍" },
  community: { theme: "taking care of your world", emoji: "🌍" },
  money: { theme: "thinking ahead about the future", emoji: "🔮" },
};

const DISTRACTOR_THEMES = [
  "being the fastest",
  "getting the most points",
  "doing it perfectly",
  "finishing before lunch",
];

/**
 * Build a connect-the-dots pair from completed missions. Returns null when
 * no two missions share a theme — we only ask when there's a real aha.
 */
export function makeDotPair(missions: DotMission[]): DotPair | null {
  const byTheme = new Map<string, DotMission[]>();
  for (const m of missions) {
    const t = CATEGORY_THEMES[m.category];
    if (!t) continue;
    const list = byTheme.get(t.theme) ?? [];
    list.push(m);
    byTheme.set(t.theme, list);
  }
  for (const [theme, list] of byTheme) {
    if (list.length >= 2) {
      const [a, b] = list;
      const emoji = CATEGORY_THEMES[a.category].emoji;
      const distractors = DISTRACTOR_THEMES.filter((d) => d !== theme).slice(0, 3);
      return {
        missionA: a,
        missionB: b,
        connection: `Both were about ${theme}!`,
        connectionEmoji: emoji,
        distractors,
      };
    }
  }
  return null;
}

/** Kid-facing question for the dot pair. */
export function dotQuestion(): string {
  return "These two missions look different… but what's the SAME about them? 🤔";
}

/* ------------------------------------------------------------------ */
/* Tell it in 3 — compression as synthesis.                            */
/* ------------------------------------------------------------------ */

export function tellItIn3Prompt(ageMode: SynthesisAgeMode, storyTitle: string): string {
  switch (ageMode) {
    case "sprout":
      return `Tell "${storyTitle}" using just 3 emojis! 😊 Which 3 tell the whole story?`;
    case "grow":
      return `Tell "${storyTitle}" in 3 short sentences. Finding what matters — and dropping the rest — is a superpower!`;
    case "thrive":
      return `Tell "${storyTitle}" in 3 sentences. Then the boss level: do it in ONE.`;
  }
}

/** Validate a "tell it in 3" submission. Lenient — effort counts. */
export function validateTellItIn3(parts: string[], ageMode: SynthesisAgeMode): boolean {
  const filled = parts.filter((p) => p.trim().length > 0);
  if (ageMode === "sprout") return filled.length >= 1; // 1+ emojis = trying
  return filled.length >= 2; // 2+ sentences = a real attempt
}

/* ------------------------------------------------------------------ */
/* Teach your pet — Feynman technique for kids.                        */
/* ------------------------------------------------------------------ */

export function teachYourPetPrompt(petName: string, topic: string, ageMode: SynthesisAgeMode): string {
  const base = `${petName} wants to learn! Can you teach ${petName} about "${topic}"?`;
  switch (ageMode) {
    case "sprout":
      return `${base} Use simple words — like you're telling a baby bunny! 🐰`;
    case "grow":
      return `${base} 30 seconds, simple words. If ${petName} gets it, YOU really get it! 🎓`;
    case "thrive":
      return `${base} Explain it so simply a 5-year-old would understand. That's the real test of knowing something. 🎓`;
  }
}

/** The pet's delighted reaction after a teaching moment. Deterministic pick. */
const PET_REACTIONS = [
  "tilts head, then does a happy wiggle — LESSON LEARNED!",
  "stares with big eyes… then popcorn-zooms with joy!",
  "nods slowly like a tiny professor. A+ student AND teacher!",
  "does three happy spins. Best lesson ever!",
];

export function petReactionFor(topic: string): string {
  let hash = 0;
  for (let i = 0; i < topic.length; i++) hash = (hash * 31 + topic.charCodeAt(i)) >>> 0;
  return PET_REACTIONS[hash % PET_REACTIONS.length];
}

/* ------------------------------------------------------------------ */
/* Weekly synthesis — ONE distilling question.                          */
/* ------------------------------------------------------------------ */

export function weeklySynthesisQuestion(childName: string): string {
  return `${childName}, what was the BIGGEST thing you figured out this week? Just one. 🌟`;
}

/* ------------------------------------------------------------------ */
/* Pattern spotter — the kid as analyst of their own choices.           */
/* ------------------------------------------------------------------ */

export interface BehaviorSpot {
  /** e.g. "chose the kind path 3 times" */
  observation: string;
  observationEmoji: string;
  question: string;
}

/**
 * Build a metacognition prompt from the week's choice archetypes.
 * Returns null when there's nothing notable — we don't manufacture insight.
 */
export function spotBehaviorPattern(
  archetypeCounts: Record<string, number>,
  childName: string
): BehaviorSpot | null {
  const entries = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const [top, count] = entries[0];
  if (count < 3) return null; // need a real pattern, not noise

  const observations: Record<string, { text: string; emoji: string }> = {
    kind: { text: `chose the kind path ${count} times`, emoji: "💛" },
    bold: { text: `picked the brave option ${count} times`, emoji: "🦁" },
    careful: { text: `thought it through carefully ${count} times`, emoji: "🤔" },
    playful: { text: `found the playful way ${count} times`, emoji: "🎈" },
  };
  const obs = observations[top];
  if (!obs) return null;
  return {
    observation: `You ${obs.text} this week.`,
    observationEmoji: obs.emoji,
    question: `What do you notice about yourself, ${childName}?`,
  };
}

/* ------------------------------------------------------------------ */
/* Parent copy — synthesis as growth.                                   */
/* ------------------------------------------------------------------ */

export function synthesisGrowthCopy(
  childName: string,
  dotsConnected: number,
  taughtPet: boolean,
  weeklyInsight?: string
): string | null {
  if (dotsConnected === 0 && !taughtPet && !weeklyInsight) return null;
  const parts: string[] = [];
  if (dotsConnected > 0) {
    parts.push(`connected ${dotsConnected} dot${dotsConnected === 1 ? "" : "s"} between different missions`);
  }
  if (taughtPet) parts.push("taught their pet something new (the Feynman test — if you can teach it, you know it)");
  const base = `${childName} ${parts.join(" and ")}${parts.length > 0 ? " this week" : ""}.`;
  if (weeklyInsight) {
    return `${base} Their one big takeaway: "${weeklyInsight}" — distilling a whole week into one insight is a genuine thinking skill. 🌟`;
  }
  return `${base} Spotting patterns across different experiences is the root of fast understanding. 🌟`;
}
