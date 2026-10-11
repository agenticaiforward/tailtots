/**
 * Pet Needs System — Jack as a living companion, not a decoration.
 *
 * Four needs (0–100), decaying over real time, fulfilled through play:
 *   🍎 hunger    — decays over ~8 hours, filled by feeding
 *   💛 attention — decays over ~6 hours, filled by tapping/playing
 *   😴 energy    — drains with activity, restores when idle/sleeping
 *   ✨ happiness — derived from the other three (never directly filled)
 *
 * THE GOLDEN RULE (lantern, not leash):
 * Jack expresses needs as INVITATIONS, never accusations. The pet never
 * guilts the child. Banned language is enforced by tests — see
 * GUILT_PHRASES below and pet-needs.test.ts.
 *
 * Persistence: localStorage with timestamps; decay computed from elapsed
 * time so the pet feels alive across sessions. On return after absence:
 * "Jack is happy to see you!" — welcome, never guilt about being away.
 */

export type NeedKind = "hunger" | "attention" | "energy";

/** A need's value is 0–100. */
export type NeedValue = number;

export interface PetNeedsState {
  hunger: NeedValue;
  attention: NeedValue;
  energy: NeedValue;
  /** Unix ms of last update — used to compute decay. */
  updatedAt: number;
  /** Unix ms of last feed, for gentle "recently fed" context. */
  lastFedAt: number;
  /** Unix ms of last play interaction. */
  lastPlayedAt: number;
  /** Whether Jack is currently in bedtime/sleep mode. */
  sleeping: boolean;
}

/** Decay rates: points lost per hour of real time. */
export const DECAY_PER_HOUR: Record<NeedKind, number> = {
  hunger: 100 / 8, // empties over ~8 hours
  attention: 100 / 6, // empties over ~6 hours
  energy: 100 / 12, // drains slowly; restored by sleep instead
};

/** How much each interaction restores. */
export const FULFILL_AMOUNT = {
  feed: 35,
  play: 30,
  tapPet: 8,
  missionComplete: 15, // feeds attention + energy boost handled separately
  bedtime: 100, // energy restored to full on wake
} as const;

/** Phrases that must NEVER appear in any pet copy. Enforced by tests. */
export const GUILT_PHRASES = [
  "you forgot",
  "you left me",
  "you left jack",
  "missed you so much",
  "sad because",
  "don't you love me",
  "dont you love me",
  "why did you leave",
  "you abandoned",
  "you ignored",
  "i was so lonely",
  "so lonely without you",
  "😭", // crying emoji is never used in a guilt context
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

/** Default fresh state — a happy, full, rested Jack. */
export function freshNeedsState(nowMs: number = Date.now()): PetNeedsState {
  return {
    hunger: 85,
    attention: 80,
    energy: 90,
    updatedAt: nowMs,
    lastFedAt: nowMs,
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Clamp a need value to 0–100. */
export function clampNeed(v: number): NeedValue {
  return Math.min(100, Math.max(0, v));
}

/**
 * Apply time-based decay to a state. Pure function — does not mutate.
 * Sleeping pets don't lose attention/hunger as fast; energy restores.
 */
export function decayNeeds(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const elapsedHours = Math.max(0, (nowMs - state.updatedAt) / 3_600_000);
  if (elapsedHours <= 0) return state;

  const sleepFactor = state.sleeping ? 0.4 : 1;
  const hunger = clampNeed(state.hunger - DECAY_PER_HOUR.hunger * elapsedHours * sleepFactor);
  const attention = clampNeed(state.attention - DECAY_PER_HOUR.attention * elapsedHours * sleepFactor);
  // Energy: drains slowly while awake, restores while sleeping
  const energy = state.sleeping
    ? clampNeed(state.energy + (100 / 4) * elapsedHours) // full rest in ~4h
    : clampNeed(state.energy - DECAY_PER_HOUR.energy * elapsedHours);

  return { ...state, hunger, attention, energy, updatedAt: nowMs };
}

/** Happiness is derived — the average of the three fillable needs. */
export function happinessFrom(state: PetNeedsState): NeedValue {
  return Math.round((state.hunger + state.attention + state.energy) / 3);
}

export type NeedLevel = "full" | "okay" | "low" | "empty";

/** Coarse level for UI (hearts/paws), avoiding clinical precision. */
export function needLevel(v: NeedValue): NeedLevel {
  if (v >= 70) return "full";
  if (v >= 40) return "okay";
  if (v >= 15) return "low";
  return "empty";
}

/** Feed Jack. Returns new state. */
export function feedPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    hunger: clampNeed(decayed.hunger + FULFILL_AMOUNT.feed),
    lastFedAt: nowMs,
    sleeping: false,
  };
}

/** Play with Jack (tap interaction). Returns new state. */
export function playWithPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.play),
    energy: clampNeed(decayed.energy - 5), // playing is gently tiring
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Quick tap on Jack — small attention boost. */
export function tapPet(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.tapPet),
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Mission completed together — shared joy. */
export function celebrateMission(state: PetNeedsState, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    attention: clampNeed(decayed.attention + FULFILL_AMOUNT.missionComplete),
    energy: clampNeed(decayed.energy - 8), // missions are active fun
    lastPlayedAt: nowMs,
    sleeping: false,
  };
}

/** Toggle bedtime mode. Waking restores energy fully. */
export function setSleeping(state: PetNeedsState, sleeping: boolean, nowMs: number = Date.now()): PetNeedsState {
  const decayed = decayNeeds(state, nowMs);
  return {
    ...decayed,
    sleeping,
    energy: sleeping ? decayed.energy : FULFILL_AMOUNT.bedtime,
  };
}

/**
 * What is Jack expressing right now? Returns the single most salient
 * need-signal, as an invitation. Priority: sleeping > very low need >
 * low need > happy. Never returns guilt.
 */
export interface NeedSignal {
  kind: "hungry" | "wantsPlay" | "sleepy" | "happy" | "needsLove" | "resting";
  /** Invitation copy — always warm, never accusatory. */
  line: string;
  /** Suggested action label for the UI button. */
  actionLabel: string;
  /** Which need this maps to (for the meter highlight). */
  need: NeedKind | "happiness";
}

const NEED_LINES: Record<NeedSignal["kind"], { line: string; actionLabel: string }> = {
  hungry: { line: "Jack's tummy is rumbling…", actionLabel: "Feed Jack" },
  wantsPlay: { line: "Jack wants to play!", actionLabel: "Play together" },
  sleepy: { line: "Jack is getting sleepy…", actionLabel: "Tuck in" },
  happy: { line: "Jack is so happy!", actionLabel: "Say hi" },
  needsLove: { line: "Jack could use some love", actionLabel: "Give love" },
  resting: { line: "Shhh… Jack is dreaming", actionLabel: "Wake up" },
};

// Validate all copy at module load (dev/test will throw on guilt).
for (const k of Object.keys(NEED_LINES) as (keyof typeof NEED_LINES)[]) {
  assertNoGuilt(NEED_LINES[k].line);
  assertNoGuilt(NEED_LINES[k].actionLabel);
}

export function currentSignal(state: PetNeedsState): NeedSignal {
  if (state.sleeping) {
    return { kind: "resting", need: "energy", ...NEED_LINES.resting };
  }
  const happiness = happinessFrom(state);
  // Most urgent low need wins
  if (state.hunger < 20) return { kind: "hungry", need: "hunger", ...NEED_LINES.hungry };
  if (state.attention < 20) return { kind: "wantsPlay", need: "attention", ...NEED_LINES.wantsPlay };
  if (state.energy < 20) return { kind: "sleepy", need: "energy", ...NEED_LINES.sleepy };
  if (happiness < 30) return { kind: "needsLove", need: "happiness", ...NEED_LINES.needsLove };
  if (state.hunger < 45) return { kind: "hungry", need: "hunger", ...NEED_LINES.hungry };
  if (state.attention < 45) return { kind: "wantsPlay", need: "attention", ...NEED_LINES.wantsPlay };
  if (state.energy < 45) return { kind: "sleepy", need: "energy", ...NEED_LINES.sleepy };
  return { kind: "happy", need: "happiness", ...NEED_LINES.happy };
}

/** Welcome-back line after absence — warm, never guilt about being away. */
export function welcomeBackLine(hoursAway: number): string {
  const line =
    hoursAway >= 24
      ? "Jack is happy to see you!"
      : hoursAway >= 6
        ? "Jack was waiting to play!"
        : "Hi again! Jack's glad you're here.";
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
      const hoursAway = Math.max(0, (nowMs - parsed.updatedAt) / 3_600_000);
      return { state: decayNeeds(parsed, nowMs), hoursAway };
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
