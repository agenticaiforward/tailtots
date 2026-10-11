/**
 * great-journey/journey — progression math + local persistence for The Great Journey.
 *
 * Every completed mission earns journey miles; miles move the kid's animal
 * along its real route. State is per-child, stored on-device (COPPA data
 * minimization — nothing leaves the device without parent consent).
 */

import { getJourneyAnimal, getShelterAnimal, type JourneyAnimal } from "./animals";

export const JOURNEY_STORAGE_KEY = "tailtots-journey-v1";

/** Missions to complete a full journey — tuned so a journey lasts ~5-8 weeks. */
export const MISSIONS_PER_JOURNEY = 40;

export interface JourneyState {
  kind: "wild" | "shelter";
  /** JourneyAnimal id (wild) or ShelterAnimal id (shelter). */
  animalId: string;
  missionsCompleted: number;
  milesEarned: number;
  startedAt: string;
  /** Leg indices the kid has already seen celebrated (prevents repeat fanfare). */
  celebratedLegs: number[];
  journeyCompletedAt: string | null;
}

export type JourneyMap = Record<string, JourneyState>;

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadJourneyMap(): JourneyMap {
  if (!storageAvailable()) return {};
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveJourneyMap(map: JourneyMap): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full — journey progress is nice-to-have, never fatal */
  }
}

export function getJourneyState(childId: string): JourneyState | null {
  return loadJourneyMap()[childId] ?? null;
}

/**
 * Start (or switch) a journey for a child. Switching animals restarts
 * progress — the old journey is archived, not deleted, so nothing is lost.
 */
export function startJourney(childId: string, kind: "wild" | "shelter", animalId: string): JourneyState {
  const state: JourneyState = {
    kind,
    animalId,
    missionsCompleted: 0,
    milesEarned: 0,
    startedAt: new Date().toISOString(),
    celebratedLegs: [],
    journeyCompletedAt: null,
  };
  const map = loadJourneyMap();
  map[childId] = state;
  saveJourneyMap(map);
  return state;
}

/** Miles one mission is worth for a given animal. */
export function milesPerMission(animal: JourneyAnimal): number {
  return animal.totalDistanceMi / MISSIONS_PER_JOURNEY;
}

export interface MissionAward {
  state: JourneyState;
  /** True when the award pushed the animal into a brand-new leg. */
  newLegUnlocked: boolean;
  /** True when the full journey just completed. */
  journeyJustCompleted: boolean;
  currentLegIndex: number;
}

/**
 * Record one completed mission for a child's journey.
 * Returns the updated state plus celebration flags for the UI.
 * No-ops (returns null) when the child has no active journey.
 */
export function recordJourneyMission(childId: string): MissionAward | null {
  const map = loadJourneyMap();
  const state = map[childId];
  if (!state || state.kind !== "wild") return null;

  const animal = getJourneyAnimal(state.animalId);
  if (!animal) return null;
  const perMission = milesPerMission(animal);

  const beforeLeg = currentLegIndex(state);
  state.missionsCompleted += 1;
  state.milesEarned = Math.min(state.milesEarned + perMission, animal.totalDistanceMi);

  const afterLeg = currentLegIndex(state);
  const newLegUnlocked = afterLeg > beforeLeg;

  let journeyJustCompleted = false;
  if (state.milesEarned >= animal.totalDistanceMi && !state.journeyCompletedAt) {
    state.journeyCompletedAt = new Date().toISOString();
    journeyJustCompleted = true;
  }

  map[childId] = state;
  saveJourneyMap(map);
  return { state, newLegUnlocked, journeyJustCompleted, currentLegIndex: afterLeg };
}

/** Shelter journeys progress by stages (5), not miles. */
export function recordShelterMission(childId: string): MissionAward | null {
  const map = loadJourneyMap();
  const state = map[childId];
  if (!state || state.kind !== "shelter") return null;
  const animal = getShelterAnimal(state.animalId);
  if (!animal) return null;

  const beforeStage = currentShelterStageIndex(state);
  state.missionsCompleted += 1;
  // 8 missions per stage → 40 missions for the full rescue → home arc.
  const afterStage = currentShelterStageIndex(state);
  const newLegUnlocked = afterStage > beforeStage;

  let journeyJustCompleted = false;
  if (afterStage >= animal.stages.length - 1 && state.missionsCompleted >= 40 && !state.journeyCompletedAt) {
    state.journeyCompletedAt = new Date().toISOString();
    journeyJustCompleted = true;
  }

  map[childId] = state;
  saveJourneyMap(map);
  return { state, newLegUnlocked, journeyJustCompleted, currentLegIndex: afterStage };
}

/** 0-based index of the leg the animal is currently on. */
export function currentLegIndex(state: JourneyState): number {
  if (state.kind === "shelter") return currentShelterStageIndex(state);
  const animal = getJourneyAnimal(state.animalId);
  if (!animal) return 0;
  let acc = 0;
  for (let i = 0; i < animal.legs.length; i++) {
    acc += animal.legs[i].miles;
    if (state.milesEarned < acc) return i;
  }
  return animal.legs.length - 1;
}

/** Shelter stage index: 8 missions per stage. */
export function currentShelterStageIndex(state: JourneyState): number {
  const animal = getShelterAnimal(state.animalId);
  const stages = animal ? animal.stages.length : 5;
  return Math.min(Math.floor(state.missionsCompleted / 8), stages - 1);
}

/** 0..1 progress through the whole journey. */
export function journeyProgress(state: JourneyState): number {
  if (state.kind === "shelter") {
    const animal = getShelterAnimal(state.animalId);
    const stages = animal ? animal.stages.length : 5;
    return Math.min(state.missionsCompleted / (stages * 8), 1);
  }
  const animal = getJourneyAnimal(state.animalId);
  if (!animal || animal.totalDistanceMi <= 0) return 0;
  return Math.min(state.milesEarned / animal.totalDistanceMi, 1);
}

/** Mark a leg's celebration as seen so we don't repeat the fanfare. */
export function markLegCelebrated(childId: string, legIndex: number): void {
  const map = loadJourneyMap();
  const state = map[childId];
  if (!state || state.celebratedLegs.includes(legIndex)) return;
  state.celebratedLegs.push(legIndex);
  saveJourneyMap(map);
}

/**
 * Trait Garden watering: journey progress boosts the animal's mapped traits.
 * Returns { trait: 0..0.3 } — callers merge into trait levels. Pure function,
 * no side effects, safe to call anywhere.
 */
export function journeyTraitBoosts(state: JourneyState): Record<string, number> {
  const progress = journeyProgress(state);
  if (progress <= 0) return {};
  const boost = Math.round(progress * 0.3 * 100) / 100;
  if (state.kind === "shelter") {
    // Shelter journeys water empathy (caring for a real animal) + self-control
    // (patience is self-control over time).
    return { empathy: boost, "self-control": Math.round(boost * 0.7 * 100) / 100 };
  }
  const animal = getJourneyAnimal(state.animalId);
  if (!animal) return {};
  const out: Record<string, number> = {};
  for (const t of animal.traits) out[t] = boost;
  return out;
}

/** Human-friendly miles display, e.g. 1,250. */
export function formatMiles(miles: number): string {
  return Math.floor(miles).toLocaleString("en-US");
}
