/**
 * Pet Personality Engine — billion-dollar redesign, Change 4.
 *
 * The pet is the emotional anchor of the kid's loop. A static pet is a
 * sticker; a pet with a personality that evolves is a relationship. This
 * module provides:
 *
 *  - petEvolutionStage: deterministic 5-stage bond progression (new → legends) from
 *    lifetime mission counts. No two bonds grow identically because
 *    the pace follows the child's own rhythm.
 *  - generatePetPersonality: deterministic species base + trait-influenced
 *    tendencies. Pure function — the "bones" of the personality.
 *  - buildPetPersonalityPrompt: prompt builder for the LLM to generate
 *    unique quirks, catchphrases, and evolution-milestone stories. The model
 *    sees species + coarse trait bands + stage only — never PII, never the
 *    child's name.
 *
 * Zero LLM calls in this module. Prompt builders only.
 */

export const PET_EVOLUTION_STAGES = [
  "new",
  "growing",
  "friends",
  "partners",
  "legends",
] as const;
export type PetEvolutionStage = (typeof PET_EVOLUTION_STAGES)[number];

/** Lifetime completed missions needed to reach each bond stage. */
export const EVOLUTION_THRESHOLDS: Record<PetEvolutionStage, number> = {
  new: 0,
  growing: 5,
  friends: 25,
  partners: 75,
  legends: 150,
};

export function petEvolutionStage(totalCompletedMissions: number): PetEvolutionStage {
  const n = Math.max(0, Math.floor(totalCompletedMissions));
  if (n >= EVOLUTION_THRESHOLDS.legends) return "legends";
  if (n >= EVOLUTION_THRESHOLDS.partners) return "partners";
  if (n >= EVOLUTION_THRESHOLDS.friends) return "friends";
  if (n >= EVOLUTION_THRESHOLDS.growing) return "growing";
  return "new";
}

/** Missions remaining until the next evolution stage (null at max). */
export function missionsToNextStage(totalCompletedMissions: number): number | null {
  const n = Math.max(0, Math.floor(totalCompletedMissions));
  const thresholds = [
    EVOLUTION_THRESHOLDS.baby,
    EVOLUTION_THRESHOLDS.junior,
    EVOLUTION_THRESHOLDS.adult,
    EVOLUTION_THRESHOLDS.wise,
  ];
  for (const t of thresholds) {
    if (n < t) return t - n;
  }
  return null;
}

/** Deterministic species base — temperament bones every pet of a species shares. */
export const SPECIES_BASE_TRAITS: Record<string, { energy: string; affection: string; quirk: string }> = {
  dog: { energy: "bouncy", affection: "velcro-loyal", quirk: "spins in circles when excited" },
  cat: { energy: "selective bursts", affection: "slow-blink devoted", quirk: "judges from high places, then cuddles" },
  "guinea pig": { energy: "popcorn-zoomies", affection: "wheeky", quirk: "popcorns when happy" },
  rabbit: { energy: "binky-powered", affection: "nose-nudge", quirk: "does joyful mid-air twists" },
  hamster: { energy: "night-shift busy", affection: "pocket-sized", quirk: "stuffs cheeks for important occasions" },
  bird: { energy: "chattery", affection: "shoulder-percher", quirk: "learns the household's favorite sounds" },
  fish: { energy: "glide-calm", affection: "bubble-blower", quirk: "does a happy wiggle at feeding time" },
  turtle: { energy: "slow-and-steady", affection: "ancient-wise", quirk: "has seen things; blinks slowly" },
};

export function speciesBaseFor(species: string): { energy: string; affection: string; quirk: string } {
  const key = species.trim().toLowerCase();
  return (
    SPECIES_BASE_TRAITS[key] ?? {
      energy: "curious",
      affection: "gentle",
      quirk: "has a mysterious habit nobody can explain",
    }
  );
}

export interface PetPersonalityInput {
  species: string;
  /** Coarse trait bands only — "blooming" | "growing" | "steady". Never scores. */
  childTraitBands: Record<string, "blooming" | "growing" | "steady">;
  evolutionStage: PetEvolutionStage;
  totalCompletedMissions: number;
}

export interface PetPersonality {
  species: string;
  evolutionStage: PetEvolutionStage;
  energy: string;
  affection: string;
  baseQuirk: string;
  /** Deterministic tendencies derived from the child's trait bands. */
  tendencies: string[];
}

/**
 * Deterministic personality bones. The LLM (via buildPetPersonalityPrompt)
 * adds the flesh: unique quirks, catchphrases, milestone stories.
 */
export function generatePetPersonality(input: PetPersonalityInput): PetPersonality {
  const base = speciesBaseFor(input.species);
  const tendencies: string[] = [];
  const bands = input.childTraitBands;
  if (bands.confidence === "blooming" || bands.perseverance === "blooming") {
    tendencies.push("cheers loudest on brave tries");
  }
  if (bands.empathy === "blooming") {
    tendencies.push("nuzzles when missions are kind ones");
  }
  if (bands.curiosity === "blooming") {
    tendencies.push("tilts head at new mission types");
  }
  if (bands["self-control"] === "growing" || bands.optimism === "growing") {
    tendencies.push("models calm-down wiggles before tricky missions");
  }
  if (tendencies.length === 0) {
    tendencies.push("watches missions with wide, encouraging eyes");
  }
  return {
    species: input.species,
    evolutionStage: input.evolutionStage,
    energy: base.energy,
    affection: base.affection,
    baseQuirk: base.quirk,
    tendencies,
  };
}

export const PET_PERSONALITY_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

export interface PetPersonalityPromptInput {
  personality: PetPersonality;
  /** What just happened: "evolved" | "milestone" | "daily". Coarse only. */
  occasion: "evolved" | "milestone" | "daily";
}

/**
 * Build the LLM prompt for unique pet flavor. The model sees species,
 * evolution stage, and deterministic tendencies — coarse aggregates only.
 * Never the child's name, age, traits scores, or any PII.
 */
export function buildPetPersonalityPrompt(input: PetPersonalityPromptInput): string {
  const p = input.personality;
  const occasionLine =
    input.occasion === "evolved"
      ? `The pet just evolved to the ${p.evolutionStage} stage. Write a 2-sentence evolution story celebrating the change.`
      : input.occasion === "milestone"
        ? "The pet reached a care milestone. Write one warm sentence the pet would 'say' (in third person, playful)."
        : "Write one short, playful line describing what the pet is doing right now.";
  return [
    `You invent personality flavor for a child's virtual pet. The pet is a ${p.species} at the ${p.evolutionStage} life stage.`,
    `Species temperament: ${p.energy}, ${p.affection}. Known quirk: ${p.baseQuirk}.`,
    `Tendencies: ${p.tendencies.join("; ")}.`,
    occasionLine,
    "Rules: kid-friendly, 1-2 sentences, no more than 120 characters. No exclamation marks. Never mention missions, traits, scores, or anything about the child. The pet is the star.",
  ].join("\n");
}

/** Validate an LLM personality snippet. Null when unusable (caller uses a deterministic fallback). */
export function parsePetPersonalityResponse(text: string): string | null {
  if (typeof text !== "string") return null;
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length < 8 || cleaned.length > 300) return null;
  return cleaned;
}
