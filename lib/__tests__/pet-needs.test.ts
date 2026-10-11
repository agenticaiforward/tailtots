import { describe, expect, it } from "vitest";
import {
  GUILT_PHRASES,
  assertNoGuilt,
  celebrateMission,
  clampNeed,
  cleanPet,
  currentSignal,
  decayNeeds,
  exercisePet,
  feedPet,
  freshNeedsState,
  fulfillmentHint,
  happinessFrom,
  needLevel,
  needLines,
  playWithPet,
  setSleeping,
  speciesNeedInfo,
  tapPet,
  welcomeBackLine,
  type PetNeedsState,
} from "../pet-needs";

function stateWith(overrides: Partial<PetNeedsState>): PetNeedsState {
  return { ...freshNeedsState(1_000_000), ...overrides };
}

describe("pet needs — decay math", () => {
  it("decays hunger over ~8 hours to near-empty", () => {
    const s = stateWith({ hunger: 100, updatedAt: 0 });
    const after = decayNeeds(s, 8 * 3_600_000);
    expect(after.hunger).toBeLessThan(5);
  });

  it("decays attention over ~6 hours to near-empty", () => {
    const s = stateWith({ attention: 100, updatedAt: 0 });
    const after = decayNeeds(s, 6 * 3_600_000);
    expect(after.attention).toBeLessThan(5);
  });

  it("decays cleanliness and exercise over time", () => {
    const s = stateWith({ cleanliness: 100, exercise: 100, updatedAt: 0 });
    const after = decayNeeds(s, 10 * 3_600_000);
    expect(after.cleanliness).toBeLessThan(5);
    expect(after.exercise).toBeLessThan(5);
  });

  it("does not decay with zero elapsed time", () => {
    const s = stateWith({ hunger: 77, updatedAt: 5_000 });
    const after = decayNeeds(s, 5_000);
    expect(after.hunger).toBe(77);
  });

  it("clamps values to 0–100", () => {
    expect(clampNeed(-10)).toBe(0);
    expect(clampNeed(150)).toBe(100);
    expect(clampNeed(50)).toBe(50);
  });

  it("sleeping slows decay and restores energy", () => {
    const awake = stateWith({ hunger: 80, cleanliness: 80, energy: 50, sleeping: false, updatedAt: 0 });
    const asleep = stateWith({ hunger: 80, cleanliness: 80, energy: 50, sleeping: true, updatedAt: 0 });
    const t = 4 * 3_600_000;
    const awakeAfter = decayNeeds(awake, t);
    const asleepAfter = decayNeeds(asleep, t);
    expect(asleepAfter.hunger).toBeGreaterThan(awakeAfter.hunger);
    expect(asleepAfter.cleanliness).toBeGreaterThan(awakeAfter.cleanliness);
    expect(asleepAfter.energy).toBeGreaterThan(awakeAfter.energy);
  });
});

describe("pet needs — fulfillment", () => {
  it("feeding restores hunger", () => {
    const s = stateWith({ hunger: 20, updatedAt: 1_000_000 });
    const after = feedPet(s, 1_000_000);
    expect(after.hunger).toBeGreaterThan(20);
    expect(after.hunger).toBeLessThanOrEqual(100);
  });

  it("playing restores attention and gently tires", () => {
    const s = stateWith({ attention: 20, energy: 90, updatedAt: 1_000_000 });
    const after = playWithPet(s, 1_000_000);
    expect(after.attention).toBeGreaterThan(20);
    expect(after.energy).toBeLessThan(90);
  });

  it("tapping gives a small attention boost", () => {
    const s = stateWith({ attention: 50, updatedAt: 1_000_000 });
    const after = tapPet(s, 1_000_000);
    expect(after.attention).toBeGreaterThan(50);
  });

  it("cleaning restores cleanliness", () => {
    const s = stateWith({ cleanliness: 20, updatedAt: 1_000_000 });
    const after = cleanPet(s, 1_000_000);
    expect(after.cleanliness).toBeGreaterThan(20);
  });

  it("exercising restores exercise and tires", () => {
    const s = stateWith({ exercise: 20, energy: 90, updatedAt: 1_000_000 });
    const after = exercisePet(s, 1_000_000);
    expect(after.exercise).toBeGreaterThan(20);
    expect(after.energy).toBeLessThan(90);
  });

  it("mission completion boosts attention", () => {
    const s = stateWith({ attention: 50, updatedAt: 1_000_000 });
    const after = celebrateMission(s, 1_000_000);
    expect(after.attention).toBeGreaterThan(50);
  });

  it("waking from sleep restores energy fully", () => {
    const s = stateWith({ energy: 10, sleeping: true, updatedAt: 1_000_000 });
    const after = setSleeping(s, false, 1_000_000);
    expect(after.sleeping).toBe(false);
    expect(after.energy).toBe(100);
  });
});

describe("pet needs — happiness derivation", () => {
  it("happiness is the average of the five needs", () => {
    const s = stateWith({ hunger: 60, attention: 90, energy: 30, cleanliness: 80, exercise: 40 });
    expect(happinessFrom(s)).toBe(60);
  });

  it("needLevel buckets correctly", () => {
    expect(needLevel(85)).toBe("full");
    expect(needLevel(55)).toBe("okay");
    expect(needLevel(25)).toBe("low");
    expect(needLevel(5)).toBe("empty");
  });
});

describe("pet needs — species awareness", () => {
  it("dog dirty/exercise labels differ from fish", () => {
    const dog = speciesNeedInfo("dog");
    const fish = speciesNeedInfo("fish");
    expect(dog.dirtyLabel).toContain("paws");
    expect(fish.dirtyLabel).toContain("tank");
    expect(dog.exerciseAction).toContain("walk");
    expect(fish.exerciseAction).toContain("enrichment");
    expect(dog.dirtyLabel).not.toBe(fish.dirtyLabel);
  });

  it("cat has litter box label", () => {
    expect(speciesNeedInfo("cat").dirtyLabel).toContain("litter");
  });

  it("bird has cage labels", () => {
    const bird = speciesNeedInfo("bird");
    expect(bird.dirtyLabel).toContain("cage");
    expect(bird.exerciseLabel).toContain("out-of-cage");
  });

  it("falls back to generic for unknown species", () => {
    const info = speciesNeedInfo("pet");
    expect(info.dirtyLabel).toBeTruthy();
    expect(info.exerciseAction).toBeTruthy();
  });

  it("dirty signal uses species label", () => {
    const s = stateWith({ hunger: 80, attention: 80, energy: 80, cleanliness: 10, exercise: 80 });
    const sig = currentSignal(s, "Biscuit", "dog");
    expect(sig.kind).toBe("dirty");
    expect(sig.line).toContain("muddy paws");
    const fishSig = currentSignal(s, "Bubbles", "fish");
    expect(fishSig.line).toContain("tank water");
  });

  it("exercise signal uses species label", () => {
    const s = stateWith({ hunger: 80, attention: 80, energy: 80, cleanliness: 80, exercise: 10 });
    const sig = currentSignal(s, "Biscuit", "dog");
    expect(sig.kind).toBe("needsExercise");
    expect(sig.line).toContain("walk");
    expect(sig.actionLabel).toContain("walk");
  });
});

describe("pet needs — track-aware fulfillment hints", () => {
  it("real track references real-world actions", () => {
    const hint = fulfillmentHint("hunger", "real", "Biscuit", "dog");
    expect(hint).toContain("Biscuit");
    expect(hint.toLowerCase()).toContain("fed");
  });

  it("shelter track references visits and kindness", () => {
    const hint = fulfillmentHint("attention", "shelter", "Luna", "cat");
    expect(hint).toContain("Luna");
    expect(hint.toLowerCase()).toMatch(/visit|kindness/);
  });

  it("virtual track references in-app play", () => {
    const hint = fulfillmentHint("hunger", "virtual", "Jack", "dog");
    expect(hint).toContain("Jack");
    expect(hint.toLowerCase()).toContain("snack");
  });

  it("all hints pass the guilt check", () => {
    const needs = ["hunger", "attention", "energy", "cleanliness", "exercise"] as const;
    const contexts = ["real", "virtual", "shelter"] as const;
    for (const n of needs)
      for (const c of contexts) expect(() => fulfillmentHint(n, c, "Testy", "dog")).not.toThrow();
  });
});

describe("pet needs — pet-agnostic copy", () => {
  it("needLines uses the given pet name", () => {
    const lines = needLines("Biscuit", "dog");
    expect(lines.hungry.line).toContain("Biscuit");
    expect(lines.hungry.line).not.toContain("Jack");
  });

  it("works for shelter animals", () => {
    const lines = needLines("Luna", "cat");
    expect(lines.wantsPlay.line).toContain("Luna");
  });

  it("welcomeBackLine uses the pet name, never guilts", () => {
    for (const h of [1, 8, 30, 100]) {
      const line = welcomeBackLine(h, "Biscuit");
      expect(line).toContain("Biscuit");
      expect(() => assertNoGuilt(line)).not.toThrow();
      expect(line.toLowerCase()).not.toContain("where were you");
    }
  });
});

describe("pet needs — signals are invitations, never guilt", () => {
  it("signals hunger when hunger is very low", () => {
    const s = stateWith({ hunger: 10 });
    const sig = currentSignal(s, "Biscuit", "dog");
    expect(sig.kind).toBe("hungry");
    expect(sig.line).toContain("tummy");
  });

  it("signals dirty when cleanliness is very low", () => {
    const s = stateWith({ cleanliness: 10 });
    const sig = currentSignal(s, "Biscuit", "dog");
    expect(sig.kind).toBe("dirty");
  });

  it("signals resting when sleeping", () => {
    const s = stateWith({ sleeping: true });
    expect(currentSignal(s, "Biscuit").kind).toBe("resting");
  });

  it("signals happy when all needs are met", () => {
    const s = stateWith({ hunger: 90, attention: 90, energy: 90, cleanliness: 90, exercise: 90 });
    expect(currentSignal(s, "Biscuit").kind).toBe("happy");
  });

  it("low-everything gives gentle needsLove, not blame", () => {
    const s = stateWith({ hunger: 25, attention: 25, energy: 25, cleanliness: 25, exercise: 25 });
    const sig = currentSignal(s, "Biscuit");
    expect(sig.kind).toBe("needsLove");
    expect(sig.line.toLowerCase()).not.toContain("your fault");
    expect(sig.line.toLowerCase()).not.toContain("because you");
  });
});

describe("pet needs — no-guilt language enforcement", () => {
  it("every guilt phrase is non-empty", () => {
    expect(GUILT_PHRASES.length).toBeGreaterThan(5);
    for (const p of GUILT_PHRASES) expect(p.length).toBeGreaterThan(0);
  });

  it("assertNoGuilt throws on banned phrases (dev/test)", () => {
    expect(() => assertNoGuilt("you forgot to feed me")).toThrow();
    expect(() => assertNoGuilt("I missed you so much")).toThrow();
    expect(() => assertNoGuilt("sad because you left")).toThrow();
    expect(() => assertNoGuilt("don't you love me?")).toThrow();
    expect(() => assertNoGuilt("😭😭😭")).toThrow();
  });

  it("assertNoGuilt passes warm invitation copy", () => {
    expect(assertNoGuilt("Biscuit's tummy is rumbling…")).toBe(true);
    expect(assertNoGuilt("Luna wants to play!")).toBe(true);
    expect(assertNoGuilt("Jack is happy to see you!")).toBe(true);
    expect(assertNoGuilt("Biscuit could use some love")).toBe(true);
  });
});
