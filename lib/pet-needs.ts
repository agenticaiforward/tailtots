/**
 * Pet Needs System — any pet as a living companion, not a decoration.
 *
 * Six needs, decaying over real time, fulfilled through play:
 *   🍎 hunger      — needs food/water (~8h decay)
 *   💛 attention   — wants play and love (~6h decay)
 *   😴 energy      — needs rest (~12h drain, restored by sleep)
 *   🧹 cleanliness — needs grooming/cleaning (~10h decay), species-aware
 *   🏃 exercise    — needs to move/play (~7h decay), species-aware
 *   ✨ happiness   — derived from the other five (never directly filled)
 *
 * PET-AGNOSTIC: works for any pet on any track —
 *   real    — the family's actual pet (Biscuit). Fulfillment = real-world
 *             care actions confirmed by parent/kid check-in.
 *   virtual — the in-app companion (Jack). Fulfillment = in-app interactions.
 *             This is the readiness proof for the WANT track.
 *   shelter — the matched shelter animal (Luna). Fulfillment = visits,
 *             kindness missions, donations toward the animal's care.
 *
 * SPECIES-AWARE: labels and fulfillment adapt to species. A fish doesn't
 * need a walk; a dog doesn't need its tank cleaned.
 *
 * THE GOLDEN RULE (lantern, not leash):
 * The pet expresses needs as INVITATIONS, never accusations. Banned
 * language is enforced by tests — see GUILT_PHRASES and pet-needs.test.ts.
 *
 * Persistence: localStorage with timestamps; decay from elapsed time.
 * On return: "happy to see you!" — welcome, never guilt about absence.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** The five fillable needs. Happiness is derived. */
export type NeedKind = "hunger" | "attention" | "energy" | "cleanliness" | "exercise";

/** Species key — matches petKindFor() in KidExperience. */
export type PetSpecies =
  | "dog"
  | "cat"
  | "bird"
  | "fish"
  | "rabbit"
  | "guinea"
  | "hamster"
  | "tortoise"
  | "pet"; // generic fallback

/**
 * Care context — WHO the needs belong to.
 */
export type CareContext = "real" | "virtual" | "shelter";

/** A need's value is 0–100. */
export type NeedValue = number;

export interface PetNeedsState {
  hunger: NeedValue;
  attention: NeedValue;
  energy: NeedValue;
  cleanliness: NeedValue;
  exercise: NeedValue;
  /** Unix ms of last update — used to compute decay. */
  updatedAt: number;
  lastFedAt: number;
  lastPlayedAt: number;
  lastCleanedAt: number;
  lastExercisedAt: number;
  /** Whether the pet is currently in bedtime/sleep mode. */
  sleeping: boolean;
}

/* ------------------------------------------------------------------ */
/* Decay & fulfillment tuning                                          */
/* ------------------------------------------------------------------ */

/** Decay rates: points lost per hour of real time. */
export const DECAY_PER_HOUR: Record<NeedKind, number> = {
  hunger: 100 / 8, // empties over ~8 hours
  attention: 100 / 6, // empties over ~6 hours
  energy: 100 / 12, // drains slowly; restored by sleep instead
  cleanliness: 100 / 10, // gets messy over ~10 hours
  exercise: 100 / 7, // needs movement over ~7 hours
};

/** How much each interaction restores. */
export const FULFILL_AMOUNT = {
  feed: 35,
  play: 30,
  tapPet: 8,
  missionComplete: 15,
  clean: 40,
  exercise: 35,
  bedtime: 100, // energy restored to full on wake
} as const;

/* ------------------------------------------------------------------ */
/* Guilt-language guard                                                */
/* ------------------------------------------------------------------ */

/** Phrases that must NEVER appear in any pet copy. Enforced by tests. */
export const GUILT_PHRASES = [
  "you forgot",
  "you left me",
  "you left",
  "missed you so much",
  "sad because",
  "don't you love me",
  "dont you love me",
  "why did you leave",
  "you abandoned",
  "you ignored",
  "i was so lonely",
  "so lonely without you",
  "😭",
] as const;

/**
 * Assert that copy contains no guilt language. Throws in dev/tests;
 * returns false in production so the UI can fall back to a safe line.
 */
export function assertNoGuilt(copy: string): boolean {
  const lower = copy.toLowerCase();
  for (const phrase of GUILT_PHRASES) {
    if (lower.includes(phrase)) {
      if (process.env.NODE_ENV !== "production") {
        throw new Error(`Guilt phrase detected in pet copy: "${phrase}" in "${copy}"`);
      }
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Species-aware labels                                                */
/* ------------------------------------------------------------------ */

export interface SpeciesNeedInfo {
  /** What's dirty for this species. */
  dirtyLabel: string;
  /** What exercise means for this species. */
  exerciseLabel: string;
  /** Fulfillment action label for cleaning. */
  cleanAction: string;
  /** Fulfillment action label for exercise. */
  exerciseAction: string;
}

const SPECIES_NEEDS: Record<PetSpecies, SpeciesNeedInfo> = {
  dog: {
    dirtyLabel: "muddy paws",
    exerciseLabel: "needs a walk",
    cleanAction: "Give a bath",
    exerciseAction: "Go for a walk",
  },
  cat: {
    dirtyLabel: "litter box needs cleaning",
    exerciseLabel: "wants to chase and play",
    cleanAction: "Clean up",
    exerciseAction: "Play chase",
  },
  bird: {
    dirtyLabel: "cage needs cleaning",
    exerciseLabel: "wants out-of-cage time",
    cleanAction: "Clean the cage",
    exerciseAction: "Out-of-cage time",
  },
  fish: {
    dirtyLabel: "tank water is cloudy",
    exerciseLabel: "tank needs enrichment",
    cleanAction: "Clean the tank",
    exerciseAction: "Add enrichment",
  },
  rabbit: {
    dirtyLabel: "bedding is dirty",
    exerciseLabel: "needs run-around time",
    cleanAction: "Change bedding",
    exerciseAction: "Run-around time",
  },
  guinea: {
    dirtyLabel: "bedding smells",
    exerciseLabel: "needs floor time",
    cleanAction: "Change bedding",
    exerciseAction: "Floor time",
  },
  hamster: {
    dirtyLabel: "bedding is dirty",
    exerciseLabel: "wants wheel time",
    cleanAction: "Change bedding",
    exerciseAction: "Wheel time",
  },
  tortoise: {
    dirtyLabel: "shell needs a wipe",
    exerciseLabel: "wants to roam",
    cleanAction: "Wipe the shell",
    exerciseAction: "Roam time",
  },
  pet: {
    dirtyLabel: "getting dusty",
    exerciseLabel: "wants to zoom around",
    cleanAction: "Clean up",
    exerciseAction: "Play time",
  },
};

export function speciesNeedInfo(species: PetSpecies): SpeciesNeedInfo {
  return SPECIES_NEEDS[species] ?? SPECIES_NEEDS.pet;
}

/* ------------------------------------------------------------------ */
/* Track-aware fulfillment hints                                       */
/* ------------------------------------------------------------------ */

/**
 * How to fulfill each need, adapted to the care context.
 * Real: real-world actions (check-in). Virtual: in-app play.
 * Shelter: visits, kindness, donations.
 */
export function fulfillmentHint(
  need: NeedKind,
  context: CareContext,
  petName: string,
  species: PetSpecies = "pet"
): string {
  const info = speciesNeedInfo(species);
  let hint: string;
  switch (context) {
    case "real":
      hint =
        need === "hunger"
          ? `Did ${petName} get fed today? Check in!`
          : need === "attention"
            ? `Spend a few minutes with ${petName}!`
            : need === "energy"
              ? `Let ${petName} rest somewhere cozy.`
              : need === "cleanliness"
                ? `${petName} has ${info.dirtyLabel} — time for cleanup!`
                : `${petName} ${info.exerciseLabel} — ${info.exerciseAction.toLowerCase()}!`;
      break;
    case "shelter":
      hint =
        need === "hunger"
          ? `Your kindness helps feed ${petName}!`
          : need === "attention"
            ? `Your visit would make ${petName}'s day!`
            : need === "energy"
              ? `${petName} is resting up for visitors.`
              : need === "cleanliness"
                ? `Volunteers keep ${petName} clean — join them!`
                : `${petName} loves playtime with visitors!`;
      break;
    case "virtual":
    default:
      hint =
        need === "hunger"
          ? `Feed ${petName} a snack to fill this up!`
          : need === "attention"
            ? `Tap ${petName} or do a mission together!`
            : need === "energy"
              ? `Tuck ${petName} in for a nap to recharge!`
              : need === "cleanliness"
                ? `${petName} has ${info.dirtyLabel} — clean up!`
                : `${petName} ${info.exerciseLabel}!`;
      break;
  }
  assertNoGuilt(hint);
  return hint;
}

/* ------------------------------------------------------------------ */
/* State constructors & transitions (pure functions)                   */
/* ------------------------------------------------------------------ */

/** Default fresh state — a happy, full, rested pet. */
export function freshNeedsState(nowMs: number = Date.now()): PetNeedsState {
  return {
    hunger: 85,
    attention: 80,
    energy: 90,
    cleanliness: 85,
    exercise: 75,
    updatedAt: nowMs,
    lastFedAt: nowMs,
    lastPlayedAt: nowMs,
    lastCleanedAt: nowMs,
    lastExercisedAt: nowMs,
    sleeping: false,
  };
}

/** Clamp a need value to 0–100. */
export function clampNeed(v: number): NeedValue {
  return Math.min(100, Math.max(0, v));
}

/**
 * Apply time-based decay. Pure function — does not mutate.
 * Sleeping pets decay slower; energy restores while sleeping.
 */
export function decayNeeds(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const elapsedHours = Math.max(0, (nowMs - state.updatedAt) / 3_600_000);
  if (elapsedHours <= 0) return state;

  const sleepFactor = state.sleeping ? 0.4 : 1;
  const hunger = clampNeed(state.hunger - DECAY_PER_HOUR.hunger * elapsedHours * sleepFactor);
  const attention = clampNeed(state.attention - DECAY_PER_HOUR.attention * elapsedHours * sleepFactor);
  const cleanliness = clampNeed(state.cleanliness - DECAY_PER_HOUR.cleanliness * elapsedHours * sleepFactor);
  const exercise = clampNeed(state.exercise - DECAY_PER_HOUR.exercise * elapsedHours * sleepFactor);
  const energy = state.sleeping
    ? clampNeed(state.energy + (100 / 4) * elapsedHours) // full rest in ~4h
    : clampNeed(state.energy - DECAY_PER_HOUR.energy * elapsedHours);

  return { ...state, hunger, attention, cleanliness, exercise, energy, updatedAt: nowMs };
}

/** Happiness is derived — the average of the five fillable needs. */
export function happinessFrom(state: PetNeedsState): NeedValue {
  return Math.round(
    (state.hunger + state.attention + state.energy + state.cleanliness + state.exercise) / 5
  );
}

export type NeedLevel = "full" | "okay" | "low" | "empty";

/** Coarse level for UI (paws), avoiding clinical precision. */
export function needLevel(v: NeedValue): NeedLevel {
  if (v >= 70) return "full";
  if (v >= 40) return "okay";
  if (v >= 15) return "low";
  return "empty";
}

/** Feed the pet. */
export function feedPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return { ...decayed, hunger: clampNeed(decayed.hunger + FULFILL_AMOUNT.feed), lastFedAt: nowMs, sleeping: false };
}

/** Play with the pet. */
export function playWithPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.play),
    exercise: clampNeed(decayed.exercise + FULFILL_AMOUNT.play * 0.5),
    energy: clampNeed(decayed.energy - 5),
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Quick tap — small attention boost. */
export function tapPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.tapPet),
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Clean/groom the pet. */
export function cleanPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    cleanliness: clampNeed(decayed.cleanliness + FULFILL_AMOUNT.clean),
    attention: clampNeed(decayed.attention + 5), // grooming is bonding
    lastCleanedAt: nowMs,
    sleeping: false,
  };
}

/** Exercise the pet. */
export function exercisePet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    exercise: clampNeed(decayed.exercise + FULFILL_AMOUNT.exercise),
    energy: clampNeed(decayed.energy - 10), // exercise tires
    attention: clampNeed(decayed.attention + 5),
    lastExercisedAt: nowMs,
    sleeping: false,
  };
}

/** Mission completed together — shared joy. */
export function celebrateMission(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.missionComplete),
    exercise: clampNeed(decayed.exercise + FULFILL_AMOUNT.missionComplete * 0.5),
    energy: clampNeed(decayed.energy - 8),
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Toggle bedtime mode. Waking restores energy fully. */
export function setSleeping(
  state: PetNeedsState,
  sleeping: boolean,
  nowMs: number = Date.now()
): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    sleeping,
    energy: sleeping ? decayed.energy : FULFILL_AMOUNT.bedtime,
  };
}

/* ------------------------------------------------------------------ */
/* Signals — what the pet is expressing (invitations, never guilt)     */
/* ------------------------------------------------------------------ */

export type NeedSignalKind =
  | "hungry"
  | "wantsPlay"
  | "sleepy"
  | "dirty"
  | "needsExercise"
  | "happy"
  | "needsLove"
  | "resting";

export interface NeedSignal {
  kind: NeedSignalKind;
  /** Invitation copy — always warm, never accusatory. */
  line: string;
  /** Suggested action label for the UI button. */
  actionLabel: string;
  /** Which need this maps to (for the meter highlight). */
  need: NeedKind | "happiness";
}

const NEED_LINES_TEMPLATES: Record<
  NeedSignalKind,
  { line: (name: string, species?: PetSpecies) => string; actionLabel: (species?: PetSpecies) => string }
> = {
  hungry: {
    line: (name) => `${name}'s tummy is rumbling…`,
    actionLabel: () => "Feed",
  },
  wantsPlay: {
    line: (name) => `${name} wants to play!`,
    actionLabel: () => "Play together",
  },
  sleepy: {
    line: (name) => `${name} is getting sleepy…`,
    actionLabel: () => "Tuck in",
  },
  dirty: {
    line: (name, species = "pet") => `${name} has ${speciesNeedInfo(species).dirtyLabel}…`,
    actionLabel: (species = "pet") => speciesNeedInfo(species).cleanAction,
  },
  needsExercise: {
    line: (name, species = "pet") => `${name} ${speciesNeedInfo(species).exerciseLabel}!`,
    actionLabel: (species = "pet") => speciesNeedInfo(species).exerciseAction,
  },
  happy: {
    line: (name) => `${name} is so happy!`,
    actionLabel: () => "Say hi",
  },
  needsLove: {
    line: (name) => `${name} could use some love`,
    actionLabel: () => "Give love",
  },
  resting: {
    line: (name) => `Shhh… ${name} is dreaming`,
    actionLabel: () => "Wake up",
  },
};

/** Build the invitation lines for a specific pet. All copy validated. */
export function needLines(
  petName: string,
  species: PetSpecies = "pet"
): Record<NeedSignalKind, { line: string; actionLabel: string }> {
  const out = {} as Record<NeedSignalKind, { line: string; actionLabel: string }>;
  for (const k of Object.keys(NEED_LINES_TEMPLATES) as NeedSignalKind[]) {
    const line = NEED_LINES_TEMPLATES[k].line(petName, species);
    const actionLabel = NEED_LINES_TEMPLATES[k].actionLabel(species);
    assertNoGuilt(line);
    assertNoGuilt(actionLabel);
    out[k] = { line, actionLabel };
  }
  return out;
}

/**
 * The single most salient need-signal. Priority: sleeping > very low
 * need > low need > happy. Never returns guilt.
 */
export function currentSignal(state: PetNeedsState, petName: string, species: PetSpecies = "pet"): NeedSignal {
  const lines = needLines(petName, species);
  const mk = (kind: NeedSignalKind, need: NeedKind | "happiness"): NeedSignal => ({
    kind,
    need,
    line: lines[kind].line,
    actionLabel: lines[kind].actionLabel,
  });
  if (state.sleeping) return mk("resting", "energy");
  const happiness = happinessFrom(state);
  if (state.hunger < 20) return mk("hungry", "hunger");
  if (state.attention < 20) return mk("wantsPlay", "attention");
  if (state.energy < 20) return mk("sleepy", "energy");
  if (state.cleanliness < 20) return mk("dirty", "cleanliness");
  if (state.exercise < 20) return mk("needsExercise", "exercise");
  if (happiness < 30) return mk("needsLove", "happiness");
  if (state.hunger < 45) return mk("hungry", "hunger");
  if (state.attention < 45) return mk("wantsPlay", "attention");
  if (state.energy < 45) return mk("sleepy", "energy");
  if (state.cleanliness < 45) return mk("dirty", "cleanliness");
  if (state.exercise < 45) return mk("needsExercise", "exercise");
  return mk("happy", "happiness");
}

/** Welcome-back line after absence — warm, never guilt about being away. */
export function welcomeBackLine(hoursAway: number, petName: string): string {
  const line =
    hoursAway >= 24
      ? `${petName} is happy to see you!`
      : hoursAway >= 6
        ? `${petName} was waiting to play!`
        : `Hi again! ${petName}'s glad you're here.`;
  assertNoGuilt(line);
  return line;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "tailtots:pet-needs:v1";

export function loadNeeds(nowMs: number = Date.now()): { state: PetNeedsState; hoursAway: number } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PetNeedsState;
      // Backfill new fields from older saves
      const withDefaults: PetNeedsState = {
        cleanliness: 85,
        exercise: 75,
        lastCleanedAt: parsed.updatedAt,
        lastExercisedAt: parsed.updatedAt,
        ...parsed,
      };
      const hoursAway = Math.max(0, (nowMs - withDefaults.updatedAt) / 3_600_000);
      return { state: decayNeeds(withDefaults, nowMs), hoursAway };
    }
  } catch {
    /* ignore — fall through to fresh */
  }
  return { state: freshNeedsState(nowMs), hoursAway: 0 };
}

export function saveNeeds(state: PetNeedsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
