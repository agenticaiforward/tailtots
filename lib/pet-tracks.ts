/**
 * pet-tracks — the three pet experience tracks.
 *
 * HAVE  → family has real pet(s). The real pet is the hero: photo, name,
 *         species drive missions, celebrations, and the kid dashboard.
 * WANT  → family wants a pet. Virtual buddy as readiness track: consistent
 *         care unlocks a "readiness certificate" + parent readiness report.
 * CANT  → family can't have pets. Virtual buddy + shelter buddy connection:
 *         volunteer missions, donation goals, shelter animal sponsorship.
 *
 * The Mission Engine consumes { species, name, careNeeds } — toMissionEnginePet
 * maps the app Pet shape to exactly that. Photos never leave the device
 * without explicit parent consent (COPPA data minimization).
 */

import type { Pet } from "./types";

export type PetTrack = "have" | "want" | "cant";

export const PET_TRACKS: { id: PetTrack; emoji: string; title: string; blurb: string }[] = [
  {
    id: "have",
    emoji: "🏠",
    title: "We have pets!",
    blurb: "Your real pet becomes the star of every mission.",
  },
  {
    id: "want",
    emoji: "💛",
    title: "We want one",
    blurb: "Care for a buddy to show you're ready for a real pet.",
  },
  {
    id: "cant",
    emoji: "🐾",
    title: "We can't have pets",
    blurb: "Befriend shelter animals and help them find homes.",
  },
];

export function isValidPetTrack(t: unknown): t is PetTrack {
  return t === "have" || t === "want" || t === "cant";
}

/** Care-needs checklist offered at real-pet profile creation. */
export const CARE_NEED_OPTIONS = [
  { id: "feeding", emoji: "🍽️", label: "Feeding" },
  { id: "water", emoji: "💧", label: "Fresh water" },
  { id: "grooming", emoji: "🪮", label: "Grooming / brushing" },
  { id: "exercise", emoji: "🏃", label: "Exercise / walks" },
  { id: "playtime", emoji: "🧸", label: "Playtime" },
  { id: "cleaning", emoji: "🧹", label: "Cleaning habitat" },
  { id: "training", emoji: "🎯", label: "Training" },
  { id: "health", emoji: "🩺", label: "Health checks" },
] as const;

export type CareNeedId = (typeof CARE_NEED_OPTIONS)[number]["id"];

/** A real pet profile as captured in onboarding. Extends the app Pet type. */
export interface RealPetInput {
  name: string;
  species: string;
  age?: string;
  photoDataUrl?: string;
  careNeedIds: CareNeedId[];
  favoriteFood?: string;
}

export function careNeedsLabel(ids: CareNeedId[]): string {
  return ids
    .map((id) => CARE_NEED_OPTIONS.find((o) => o.id === id)?.label ?? id)
    .join(", ");
}

/**
 * Map an app Pet to exactly the shape the Mission Engine consumes:
 * { species: string; name?: string; careNeeds?: string }
 */
export function toMissionEnginePet(pet: Pet): { species: string; name?: string; careNeeds?: string } {
  const out: { species: string; name?: string; careNeeds?: string } = {
    species: pet.species,
  };
  if (pet.name) out.name = pet.name;
  const needs = [pet.careNotes, pet.favoriteFood ? `loves ${pet.favoriteFood}` : ""]
    .filter(Boolean)
    .join("; ");
  if (needs) out.careNeeds = needs;
  return out;
}

/** Build a Pet record from a real-pet onboarding input. */
export function realPetFromInput(input: RealPetInput): Pet {
  return {
    id: `pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim() || "Buddy",
    species: input.species,
    favoriteFood: input.favoriteFood?.trim() ?? "",
    careNotes: careNeedsLabel(input.careNeedIds),
    vet: "",
    medicine: "",
    photoUrl: input.photoDataUrl,
  };
}

/* ------------------------------------------------------------------ */
/* Readiness track (WANT)                                              */
/* ------------------------------------------------------------------ */

/** Consistent care unlocks the readiness certificate at this score. */
export const READINESS_THRESHOLD = 80;

export interface ReadinessInput {
  /** Approved/completed missions caring for the virtual buddy. */
  careMissions: number;
  /** Current streak in days. */
  streakDays: number;
  /** Distinct days with at least one care mission, trailing 30d. */
  activeDays30d: number;
}

/**
 * Readiness score 0..100. Weights: consistency (active days) 50%,
 * volume (care missions) 30%, streak 20%. Deterministic.
 */
export function readinessScore(input: ReadinessInput): number {
  const consistency = Math.min(1, input.activeDays30d / 21); // 21/30 days = full marks
  const volume = Math.min(1, input.careMissions / 40);
  const streak = Math.min(1, input.streakDays / 14);
  return Math.round(consistency * 50 + volume * 30 + streak * 20);
}

export function readinessUnlocked(input: ReadinessInput): boolean {
  return readinessScore(input) >= READINESS_THRESHOLD;
}

export function readinessBlurb(score: number): string {
  if (score >= READINESS_THRESHOLD) return "Ready! This family shows real-pet consistency.";
  if (score >= 50) return "Getting there — keep the daily rhythm going.";
  if (score >= 20) return "A good start — consistency is the secret.";
  return "Every pet journey starts with one small act of care.";
}

/* ------------------------------------------------------------------ */
/* Track-aware helpers                                                 */
/* ------------------------------------------------------------------ */

/** First pet to feature, preferring one with a real photo. */
export function heroPet(pets: Pet[]): Pet | undefined {
  return pets.find((p) => p.photoUrl) ?? pets[0];
}

/** Species emoji fallback when no photo is available. */
export function speciesEmoji(species: string): string {
  const s = species.toLowerCase();
  if (s.includes("dog")) return "🐶";
  if (s.includes("cat")) return "🐱";
  if (s.includes("bird")) return "🐦";
  if (s.includes("fish")) return "🐠";
  if (s.includes("rabbit") || s.includes("bunny")) return "🐰";
  if (s.includes("hamster") || s.includes("guinea")) return "🐹";
  if (s.includes("turtle") || s.includes("tortoise")) return "🐢";
  if (s.includes("horse")) return "🐴";
  return "🐾";
}
