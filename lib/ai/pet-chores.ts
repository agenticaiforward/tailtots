/**
 * AI pet-chores builder: parent-side helpers for Parent Review.
 *
 * A parent picks ONE character/life skill to teach that day; the AI builds a
 * set of 4-5 trackable pet chores from the family's EXACT pets, each chore
 * tagged with a related trackable skill (life-skill labels the app already
 * awards badges for).
 *
 * These are pure functions shared by the parent-side client fetch,
 * unit-tested with vitest. They deliberately avoid `@/` imports so a Worker
 * bundle (which has no path alias) can import this module via a relative
 * path.
 *
 * Safety framing (non-negotiable): the endpoint is parent-side only. It sees
 * the chosen skill, a coarse age band, and the family's pet names/species —
 * never a child's name or any other kid PII. When the live endpoint is
 * unreachable (or no parent is signed in), the honest local template builder
 * runs instead and the UI labels it as built-in templates.
 */
import { IDEA_AGE_BANDS, type IdeaAgeBand } from "./ideas";

/** Character/life skills the parent can pick as the day's focus. */
export const PET_CHORE_SKILLS = [
  "responsibility",
  "empathy",
  "teamwork",
  "leadership",
  "time",
] as const;
export type PetChoreSkill = (typeof PET_CHORE_SKILLS)[number];

/**
 * Workers AI model used for parent-facing pet-chore generation.
 * Same verified free-tier model as the conversation-prompt endpoint.
 */
export const PET_CHORE_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export type PetChoreDifficulty = "easy" | "medium" | "hard";

/** One chore in a generated set — trackable via its skill tag. */
export interface PetChoreDraft {
  title: string;
  detail: string;
  skill: PetChoreSkill;
  difficulty: PetChoreDifficulty;
  points: number;
  petId?: string;
  petName?: string;
}

export interface PetChorePetInput {
  id?: string;
  name: string;
  species: string;
}

export interface PetChoreRequest {
  skill: PetChoreSkill;
  ageBand: IdeaAgeBand;
  pets: PetChorePetInput[];
  goal?: string;
}

export type PetChoreValidation =
  | { ok: true; value: PetChoreRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value);
}

/** Strictly validate an incoming `/api/ai/pet-chores` JSON body. */
export function validatePetChoreInput(body: unknown): PetChoreValidation {
  if (!isRecord(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { skill, ageBand, pets, goal } = body;
  if (typeof skill !== "string" || !(PET_CHORE_SKILLS as readonly string[]).includes(skill)) {
    return { ok: false, error: `skill must be one of: ${PET_CHORE_SKILLS.join(", ")}.` };
  }
  if (typeof ageBand !== "string" || !(IDEA_AGE_BANDS as readonly string[]).includes(ageBand)) {
    return { ok: false, error: `ageBand must be one of: ${IDEA_AGE_BANDS.join(", ")}.` };
  }
  if (!Array.isArray(pets) || pets.length === 0 || pets.length > 8) {
    return { ok: false, error: "pets must be a non-empty array (max 8)." };
  }
  const cleanPets: PetChorePetInput[] = [];
  for (const entry of pets) {
    if (!isRecord(entry)) return { ok: false, error: "Each pet must be an object with name and species." };
    const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 40) : "";
    const species = typeof entry.species === "string" ? entry.species.trim().slice(0, 40) : "";
    if (!name || !species) return { ok: false, error: "Each pet needs a name and species." };
    cleanPets.push({ name, species });
  }
  if (goal !== undefined && (typeof goal !== "string" || goal.length > 200)) {
    return { ok: false, error: "goal must be a short string (max 200 chars)." };
  }
  return {
    ok: true,
    value: {
      skill: skill as PetChoreSkill,
      ageBand: ageBand as IdeaAgeBand,
      pets: cleanPets,
      goal: typeof goal === "string" && goal.trim() ? goal.trim() : undefined,
    },
  };
}

/** System prompt framing for the Workers AI chore builder. */
export function buildPetChoreSystemPrompt(): string {
  return [
    "You build pet-care chore sets for a parent's family app.",
    "Given ONE focus skill, an age band, and the family's exact pets, return a JSON array of 4-5 chores.",
    "Rules:",
    "- Every chore must name a real pet from the list and use that pet's species-appropriate care.",
    "- The first chore teaches the focus skill; the others teach related life skills: responsibility, empathy, teamwork, leadership, time management.",
    "- Each item: {\"title\": string (max 60 chars), \"detail\": string (max 140 chars), \"skill\": one of responsibility|empathy|teamwork|leadership|time, \"difficulty\": easy|medium|hard, \"points\": 8-30}.",
    "- Age-fit: 4-6 mostly easy, 7-9 easy/medium, 10-12 medium/hard. No dangerous tasks; grown-up help where needed.",
    "- Output ONLY the JSON array, no prose.",
  ].join("\n");
}

/** User message carrying the parent's exact pets and chosen skill. */
export function buildPetChoreUserMessage(request: PetChoreRequest): string {
  const petList = request.pets.map((pet) => `${pet.name} (${pet.species})`).join(", ");
  const lines = [
    `Focus skill: ${request.skill}`,
    `Age band: ${request.ageBand}`,
    `Family pets: ${petList}`,
  ];
  if (request.goal) lines.push(`Parent goal: ${request.goal}`);
  return lines.join("\n");
}

/** Parse the model's JSON array into validated chore drafts. Null = unusable. */
export function parsePetChoreResponse(text: string): PetChoreDraft[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const drafts: PetChoreDraft[] = [];
  for (const entry of parsed.slice(0, 6)) {
    if (!isRecord(entry)) return null;
    const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 80) : "";
    if (!title) return null;
    const skill = entry.skill;
    if (typeof skill !== "string" || !(PET_CHORE_SKILLS as readonly string[]).includes(skill)) return null;
    const difficulty = entry.difficulty === "hard" ? "hard" : entry.difficulty === "medium" ? "medium" : "easy";
    const points = Number.isFinite(entry.points)
      ? Math.max(5, Math.min(40, Math.round(entry.points as number)))
      : difficulty === "hard" ? 24 : difficulty === "medium" ? 16 : 10;
    drafts.push({
      title,
      detail: typeof entry.detail === "string" ? entry.detail.trim().slice(0, 160) : "",
      skill: skill as PetChoreSkill,
      difficulty,
      points,
    });
  }
  return drafts.length >= 2 ? drafts : null;
}

type SpeciesGroup = "dog" | "cat" | "fish" | "bird" | "small" | "reptile" | "other";

function speciesGroup(species: string): SpeciesGroup {
  const s = species.toLowerCase();
  if (/\bdog|puppy|pup\b/.test(s)) return "dog";
  if (/\bcat|kitten|kitty\b/.test(s)) return "cat";
  if (/\bfish|goldfish|betta|guppy|tetra\b/.test(s)) return "fish";
  if (/\bbird|parrot|parakeet|cockatiel|budgie|canary\b/.test(s)) return "bird";
  if (/\bhamster|guinea|rabbit|bunny|gerbil|mouse|rat|ferret|hedgehog\b/.test(s)) return "small";
  if (/\bsnake|lizard|gecko|turtle|tortoise|reptile|dragon\b/.test(s)) return "reptile";
  return "other";
}

interface ChoreTemplate {
  title: (name: string) => string;
  detail: (name: string) => string;
}

const PET_CHORE_TEMPLATES: Record<SpeciesGroup, Record<PetChoreSkill, ChoreTemplate>> = {
  dog: {
    responsibility: { title: (n) => `Refill ${n}'s water bowl and food`, detail: () => "Fresh water and the right scoop of food, then check the bowl is clean." },
    empathy: { title: (n) => `5-minute calm cuddle with ${n}`, detail: () => "Sit with them, pet gently, and notice if they seem happy, tired, or restless." },
    teamwork: { title: (n) => `Tidy ${n}'s corner together`, detail: () => "With a grown-up, put toys back and shake out the bed." },
    leadership: { title: (n) => `Teach ${n} a trick`, detail: () => "Practice 'sit' with treats for 5 minutes — patience first." },
    time: { title: (n) => `Evening walk check for ${n}`, detail: () => "Leash check, poop bag ready, 10-minute walk before dinner." },
  },
  cat: {
    responsibility: { title: (n) => `Fresh food and water for ${n}`, detail: () => "Rinse the bowls, refill food and water to the line." },
    empathy: { title: (n) => `Quiet play session with ${n}`, detail: () => "Wand toy for 5 minutes; stop if they walk away." },
    teamwork: { title: (n) => `Scoop patrol for ${n}'s litter`, detail: () => "With a grown-up, scoop the litter box and wipe the mat." },
    leadership: { title: (n) => `Grooming session for ${n}`, detail: () => "Gentle brushing — count 20 slow strokes." },
    time: { title: (n) => `Morning window check for ${n}`, detail: () => "Open the blinds, check water, quick litter glance — 3 minutes." },
  },
  fish: {
    responsibility: { title: (n) => `Feed ${n} one pinch`, detail: () => "One small pinch of flakes; watch them eat for a minute." },
    empathy: { title: (n) => `Watch ${n} swim for 2 minutes`, detail: () => "Notice colors and fins — anything different today?" },
    teamwork: { title: (n) => `Wipe ${n}'s tank glass`, detail: () => "With a grown-up, wipe algae spots with the tank sponge." },
    leadership: { title: (n) => `Tank log for ${n}`, detail: () => "Write down the water level and temperature in the pet log." },
    time: { title: (n) => `Weekly water check for ${n}`, detail: () => "Check the filter hums and the light timer is on." },
  },
  bird: {
    responsibility: { title: (n) => `Refill ${n}'s seed and water cups`, detail: () => "Dump old seed hulls, add fresh seed, rinse and refill water." },
    empathy: { title: (n) => `Talk or whistle to ${n} for 3 minutes`, detail: () => "Calm voice; watch if they chirp back." },
    teamwork: { title: (n) => `Change ${n}'s cage liner`, detail: () => "With a grown-up, swap the liner and rinse the tray." },
    leadership: { title: (n) => `Teach ${n} step-up`, detail: () => "Offer a finger perch; reward calm steps." },
    time: { title: (n) => `Cover-time routine for ${n}`, detail: () => "Dim lights, cover the cage at the same time each night." },
  },
  small: {
    responsibility: { title: (n) => `Fresh hay and water for ${n}`, detail: () => "Top up hay, rinse the water bottle, add a veggie treat." },
    empathy: { title: (n) => `Quiet handling time with ${n}`, detail: () => "Gentle hands, low voice; put them back if they squirm." },
    teamwork: { title: (n) => `Spot-clean ${n}'s bedding`, detail: () => "With a grown-up, scoop soiled corners and add fresh bedding." },
    leadership: { title: (n) => `Build ${n} a play tunnel`, detail: () => "Cardboard maze; watch how they explore it." },
    time: { title: (n) => `Morning cage check for ${n}`, detail: () => "Food, water, bedding — a 3-minute scan before school." },
  },
  reptile: {
    responsibility: { title: (n) => `Mist ${n}'s habitat`, detail: () => "Light misting; check the water dish is full." },
    empathy: { title: (n) => `Observe ${n} for 3 minutes`, detail: () => "Watch basking and breathing; note anything new." },
    teamwork: { title: (n) => `Wipe ${n}'s glass doors`, detail: () => "With a grown-up, wipe smudges so they get clear light." },
    leadership: { title: (n) => `Feeding log for ${n}`, detail: () => "Record what they ate and when." },
    time: { title: (n) => `Heat-lamp check for ${n}`, detail: () => "Confirm the lamp is on and the warm spot feels warm — tell a grown-up if not." },
  },
  other: {
    responsibility: { title: (n) => `Fresh food and water for ${n}`, detail: () => "Right food, clean water, bowls wiped." },
    empathy: { title: (n) => `Comfort check on ${n}`, detail: () => "Look, listen, and notice how they seem today." },
    teamwork: { title: (n) => `Tidy ${n}'s space`, detail: () => "With a grown-up, clean and reset their area." },
    leadership: { title: (n) => `Teach ${n} something new`, detail: () => "One small trick or routine, 5 patient minutes." },
    time: { title: (n) => `Daily ${n} check-in`, detail: () => "Food, water, comfort — same order every day." },
  },
};

function difficultyForSlot(ageBand: IdeaAgeBand, slot: number): PetChoreDifficulty {
  if (ageBand === "4-6") return "easy";
  if (ageBand === "10-12") return slot === 3 ? "hard" : "medium";
  return slot < 2 ? "easy" : "medium";
}

function pointsFor(difficulty: PetChoreDifficulty): number {
  return difficulty === "hard" ? 24 : difficulty === "medium" ? 16 : 10;
}

/**
 * Honest local fallback: builds a 4-5 chore set from the family's EXACT
 * pets using species-appropriate templates. The picked skill leads; the
 * rest of the set teaches related trackable skills. Empty pets → empty set
 * (the UI prompts the parent to add pets in Pet Passports first).
 */
export function buildLocalPetChoreSet(
  pets: PetChorePetInput[],
  skill: PetChoreSkill,
  ageBand: IdeaAgeBand,
): PetChoreDraft[] {
  if (!pets.length) return [];
  const related: PetChoreSkill[] = [skill, ...PET_CHORE_SKILLS.filter((s) => s !== skill)];
  const used = pets.slice(0, 5);
  return related.slice(0, 5).map((choreSkill, slot) => {
    const pet = used[slot % used.length];
    const template = PET_CHORE_TEMPLATES[speciesGroup(pet.species)][choreSkill];
    const difficulty = difficultyForSlot(ageBand, slot);
    return {
      title: template.title(pet.name),
      detail: template.detail(pet.name),
      skill: choreSkill,
      difficulty,
      points: pointsFor(difficulty),
      petId: pet.id,
      petName: pet.name,
    };
  });
}

export interface FetchPetChoresOptions {
  fetchFn?: typeof fetch;
  token: string;
  skill: PetChoreSkill;
  ageBand: IdeaAgeBand;
  pets: PetChorePetInput[];
  goal?: string;
  endpoint?: string;
}

export type FetchPetChoresResult =
  | { ok: true; chores: PetChoreDraft[] }
  | { ok: false };

/**
 * Ask the parent-side AI endpoint for a chore set. Returns {ok:false} on
 * any failure (or no token) — the caller runs the honest local fallback.
 * Kids-data rule: pets (name/species), skill, and a coarse age band only —
 * never a child's name or any other kid PII.
 */
export async function fetchPetChores(options: FetchPetChoresOptions): Promise<FetchPetChoresResult> {
  const { fetchFn = fetch, token, skill, ageBand, pets, goal, endpoint = "/api/ai/pet-chores" } = options;
  if (!token) return { ok: false };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ skill, ageBand, pets: pets.map((p) => ({ name: p.name, species: p.species })), goal }),
    });
    let data: { chores?: unknown } | null = null;
    try {
      data = (await response.json()) as { chores?: unknown } | null;
    } catch {
      data = null;
    }
    const raw = typeof data?.chores === "string" ? data.chores : Array.isArray(data?.chores) ? JSON.stringify(data.chores) : null;
    const chores = raw ? parsePetChoreResponse(raw) : null;
    if (!response.ok || !chores) return { ok: false };
    return { ok: true, chores };
  } catch {
    return { ok: false };
  }
}

/** One saved chore set in the parent's history (localStorage). */
export interface ChoreSetRecord {
  id: string;
  dateKey: string;
  skill: PetChoreSkill;
  petNames: string[];
  chores: PetChoreDraft[];
  source: "live" | "demo";
}

const CHORE_HISTORY_KEY = "tailtots-chore-history-v1";
const CHORE_HISTORY_MAX = 20;

export function loadChoreHistory(): ChoreSetRecord[] {
  try {
    const raw = localStorage.getItem(CHORE_HISTORY_KEY);
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ChoreSetRecord =>
        isRecord(entry) &&
        typeof entry.id === "string" &&
        typeof entry.dateKey === "string" &&
        typeof entry.skill === "string" &&
        Array.isArray(entry.chores),
    ).slice(0, CHORE_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveChoreHistory(records: ChoreSetRecord[]): void {
  try {
    localStorage.setItem(CHORE_HISTORY_KEY, JSON.stringify(records.slice(0, CHORE_HISTORY_MAX)));
  } catch {
    // Local-only history; a full/quota-blocked store must not break the builder.
  }
}
