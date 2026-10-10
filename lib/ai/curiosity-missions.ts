/**
 * Curiosity Missions — question-asking, listening, articulation.
 *
 * The future-skills trio, part 1: ASK GOOD QUESTIONS.
 * (Part 2 is decide well — Choice Adventures. Part 3 is synthesize fast.)
 *
 * Two mission flavors:
 *  - WonderMission: rewards ASKING, not just doing. "Ask a grown-up 3 'why'
 *    questions about [topic]." AI generates curiosity prompts tailored to
 *    the child's interests + trait profile.
 *  - ListeningMission: active listening as a mission. "Listen for 2 minutes.
 *    Tell back what you heard." Parent confirms; kid articulates.
 *
 * Maps to Thrivers: curiosity (questions), empathy (listening),
 * confidence (articulation).
 *
 * Zero LLM calls in this module. Prompt builders only. No PII in prompts.
 */

export type CuriosityAgeMode = "sprout" | "grow" | "thrive";

export interface WonderMission {
  id: string;
  topic: string;
  topicEmoji: string;
  /** The invitation — "Ask a grown-up 3 why questions about…" */
  prompt: string;
  /** Follow-up sparks if the kid wants more. */
  followUps: string[];
  ageMode: CuriosityAgeMode;
}

export interface ListeningMission {
  id: string;
  /** Who/what to listen to. */
  listenTarget: string;
  listenTargetEmoji: string;
  durationMinutes: number;
  /** The articulation prompt after listening. */
  reflectPrompt: string;
  ageMode: CuriosityAgeMode;
}

export const SEED_WONDER_MISSIONS: WonderMission[] = [
  {
    id: "wonder-sprout-sky",
    topic: "the sky",
    topicEmoji: "☁️",
    prompt: "Ask a grown-up 3 WHY questions about the sky. Why is it blue? Why do clouds move? Your questions — your rules!",
    followUps: ["What shape is that cloud?", "Where does rain come from?"],
    ageMode: "sprout",
  },
  {
    id: "wonder-sprout-worms",
    topic: "worms",
    topicEmoji: "🪱",
    prompt: "Ask a grown-up 3 WHY questions about worms. Silly questions count double!",
    followUps: ["Do worms have eyes?", "Why do they come out in rain?"],
    ageMode: "sprout",
  },
  {
    id: "wonder-grow-birds",
    topic: "birds",
    topicEmoji: "🐦",
    prompt: "Ask someone 3 WHY questions about birds. How do they know where to fly? Stump a grown-up if you can!",
    followUps: ["Why do some birds sing at night?", "How do baby birds learn to fly?"],
    ageMode: "grow",
  },
  {
    id: "wonder-grow-dreams",
    topic: "dreams",
    topicEmoji: "💭",
    prompt: "Ask 3 WHY questions about dreams — to a grown-up, a friend, or even your pet (pets give the best answers).",
    followUps: ["Why do we dream in color?", "Can you dream the same dream twice?"],
    ageMode: "grow",
  },
  {
    id: "wonder-thrive-alive",
    topic: "what makes something alive",
    topicEmoji: "🧬",
    prompt: "Ask 3 big WHY questions about what makes something alive. Is fire alive? Is a robot? Every question counts here.",
    followUps: ["Where is the line between alive and not?", "Could we ever build something alive?"],
    ageMode: "thrive",
  },
  {
    id: "wonder-thrive-germs",
    topic: "germs and discovery",
    topicEmoji: "🔬",
    prompt: "Ask 3 WHY questions about how people figured out germs exist — something nobody can see. How would YOU prove the invisible?",
    followUps: ["What else is invisible but real?", "How do scientists test ideas?"],
    ageMode: "thrive",
  },
];

export const SEED_LISTENING_MISSIONS: ListeningMission[] = [
  {
    id: "listen-sprout-pet",
    listenTarget: "your pet",
    listenTargetEmoji: "🐾",
    durationMinutes: 1,
    reflectPrompt: "What sounds did you hear? Pick what fits!",
    ageMode: "sprout",
  },
  {
    id: "listen-sprout-rain",
    listenTarget: "the rain or the wind",
    listenTargetEmoji: "🌧️",
    durationMinutes: 1,
    reflectPrompt: "Close your eyes and listen. What did the weather sound like?",
    ageMode: "sprout",
  },
  {
    id: "listen-grow-story",
    listenTarget: "a grown-up",
    listenTargetEmoji: "👨‍👩‍👧",
    durationMinutes: 2,
    reflectPrompt: "Ask them to tell you about when they were your age. Then tell back ONE thing you heard.",
    ageMode: "grow",
  },
  {
    id: "listen-grow-friend",
    listenTarget: "a friend",
    listenTargetEmoji: "🧒",
    durationMinutes: 2,
    reflectPrompt: "Ask your friend about their favorite day ever. Listen all the way through — then tell back what you heard.",
    ageMode: "grow",
  },
  {
    id: "listen-thrive-sibling",
    listenTarget: "a sibling, friend, or grown-up",
    listenTargetEmoji: "👂",
    durationMinutes: 3,
    reflectPrompt: "Ask them: 'what's something on your mind lately?' Listen without interrupting. Then tell back what you heard — in your own words.",
    ageMode: "thrive",
  },
  {
    id: "listen-thrive-world",
    listenTarget: "the world outside",
    listenTargetEmoji: "🌍",
    durationMinutes: 3,
    reflectPrompt: "Sit outside and just listen for 3 minutes. How many different sounds can you catch? Tell them back one by one.",
    ageMode: "thrive",
  },
];

export function wonderFor(mode: CuriosityAgeMode): WonderMission[] {
  return SEED_WONDER_MISSIONS.filter((w) => w.ageMode === mode);
}

export function listeningFor(mode: CuriosityAgeMode): ListeningMission[] {
  return SEED_LISTENING_MISSIONS.filter((l) => l.ageMode === mode);
}

/* ------------------------------------------------------------------ */
/* LLM prompt builder — curiosity prompts from interests + traits.     */
/* ------------------------------------------------------------------ */

export const WONDER_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export interface WonderPromptInput {
  ageMode: CuriosityAgeMode;
  /** Kid's interests in plain words, e.g. ["dinosaurs", "baking"]. No PII. */
  interests: string[];
  traitBands: Record<string, "blooming" | "growing" | "steady">;
  recentTopics?: string[];
}

const WONDER_AGE_GUIDANCE: Record<CuriosityAgeMode, string> = {
  sprout: "Ages 4-6. Concrete, sensory topics (animals, weather, food). Wonder must be askable in one breath.",
  grow: "Ages 7-9. School-world topics with room for stumping grown-ups. Playful.",
  thrive: "Ages 10-12. Big philosophical or scientific questions. Respect their intelligence — no question too big.",
};

export function buildWonderPrompt(input: WonderPromptInput): { system: string; user: string } {
  const system = [
    "You create 'wonder missions' for children — invitations to ask great questions, not tasks to complete.",
    "HARD RULES:",
    "- The mission rewards ASKING. Never imply there's a correct answer to find.",
    "- Topics must be kid-safe, concrete enough to ask a grown-up about, and genuinely interesting.",
    "- Keep it to 2-3 sentences. Playful tone. No lecturing.",
    "- Output STRICT JSON only: { \"topic\": string, \"topicEmoji\": string, \"prompt\": string, \"followUps\": [string, string] }.",
  ].join("\n");
  const user = [
    `Age mode: ${input.ageMode}. ${WONDER_AGE_GUIDANCE[input.ageMode]}`,
    input.interests.length > 0
      ? `The child's interests: ${input.interests.join(", ")}. Lean the wonder toward these when natural — never forced.`
      : "Pick a fresh, delightful topic.",
    input.recentTopics && input.recentTopics.length > 0
      ? `Avoid these recent topics: ${input.recentTopics.join("; ")}.`
      : "",
    "Return the JSON now.",
  ]
    .filter(Boolean)
    .join("\n");
  return { system, user };
}

/** Validate a generated wonder mission. Returns violations (empty = clean). */
export function validateWonderText(w: { topic: string; prompt: string; followUps: string[] }): string[] {
  const violations: string[] = [];
  const all = [w.topic, w.prompt, ...w.followUps].join(" ").toLowerCase();
  for (const bad of ["you should know", "wrong question", "stupid question", "test you", "quiz"]) {
    if (all.includes(bad)) violations.push(`anti-curiosity phrase: "${bad}"`);
  }
  if (!w.prompt.toLowerCase().includes("ask") && !w.prompt.toLowerCase().includes("wonder")) {
    violations.push("prompt doesn't invite asking");
  }
  return violations;
}

/* ------------------------------------------------------------------ */
/* Parent-facing copy — curiosity as growth.                            */
/* ------------------------------------------------------------------ */

export function curiosityGrowthCopy(
  childName: string,
  questionsAsked: number,
  listensCompleted: number
): string | null {
  if (questionsAsked === 0 && listensCompleted === 0) return null;
  const parts: string[] = [];
  if (questionsAsked > 0) {
    parts.push(
      `asked ${questionsAsked} big "why" question${questionsAsked === 1 ? "" : "s"}`
    );
  }
  if (listensCompleted > 0) {
    parts.push(
      `completed ${listensCompleted} listening mission${listensCompleted === 1 ? "" : "s"}`
    );
  }
  return `${childName} ${parts.join(" and ")} this week. Questions are thinking out loud — every "why" is a workout for curiosity. 💛`;
}
