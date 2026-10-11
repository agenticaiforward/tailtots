import { describe, expect, it } from "vitest";
import {
  GUILT_PHRASES,
  assertNoGuilt,
  celebrateMission,
  clampNeed,
  currentSignal,
  decayNeeds,
  feedPet,
  freshNeedsState,
  happinessFrom,
  needLevel,
  playWithPet,
  setSleeping,
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

  it("sleeping slows hunger/attention decay and restores energy", () => {
    const awake = stateWith({ hunger: 80, attention: 80, energy: 50, sleeping: false, updatedAt: 0 });
    const asleep = stateWith({ hunger: 80, attention: 80, energy: 50, sleeping: true, updatedAt: 0 });
    const t = 4 * 3_600_000;
    const awakeAfter = decayNeeds(awake, t);
    const asleepAfter = decayNeeds(asleep, t);
    expect(asleepAfter.hunger).toBeGreaterThan(awakeAfter.hunger);
    expect(asleepAfter.attention).toBeGreaterThan(awakeAfter.attention);
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
  it("happiness is the average of the three needs", () => {
    const s = stateWith({ hunger: 60, attention: 90, energy: 30 });
    expect(happinessFrom(s)).toBe(60);
  });

  it("needLevel buckets correctly", () => {
    expect(needLevel(85)).toBe("full");
    expect(needLevel(55)).toBe("okay");
    expect(needLevel(25)).toBe("low");
    expect(needLevel(5)).toBe("empty");
  });
});

describe("pet needs — signals are invitations, never guilt", () => {
  it("signals hunger when hunger is very low", () => {
    const s = stateWith({ hunger: 10, attention: 80, energy: 80 });
    const sig = currentSignal(s);
    expect(sig.kind).toBe("hungry");
    expect(sig.line).toContain("tummy");
  });

  it("signals wantsPlay when attention is very low", () => {
    const s = stateWith({ hunger: 80, attention: 10, energy: 80 });
    const sig = currentSignal(s);
    expect(sig.kind).toBe("wantsPlay");
  });

  it("signals sleepy when energy is very low", () => {
    const s = stateWith({ hunger: 80, attention: 80, energy: 10 });
    const sig = currentSignal(s);
    expect(sig.kind).toBe("sleepy");
  });

  it("signals resting when sleeping", () => {
    const s = stateWith({ sleeping: true });
    expect(currentSignal(s).kind).toBe("resting");
  });

  it("signals happy when all needs are met", () => {
    const s = stateWith({ hunger: 90, attention: 90, energy: 90 });
    expect(currentSignal(s).kind).toBe("happy");
  });

  it("low-everything gives gentle needsLove, not blame", () => {
    const s = stateWith({ hunger: 25, attention: 25, energy: 25 });
    const sig = currentSignal(s);
    expect(sig.kind).toBe("needsLove");
    expect(sig.line.toLowerCase()).not.toContain("your fault");
    expect(sig.line.toLowerCase()).not.toContain("because you");
  });
});

describe("pet needs — no-guilt language enforcement", () => {
  it("every guilt phrase is non-empty and meaningful", () => {
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
    expect(assertNoGuilt("Jack's tummy is rumbling…")).toBe(true);
    expect(assertNoGuilt("Jack wants to play!")).toBe(true);
    expect(assertNoGuilt("Jack is happy to see you!")).toBe(true);
    expect(assertNoGuilt("Jack could use some love")).toBe(true);
  });

  it("welcome-back lines never guilt about absence", () => {
    for (const h of [1, 8, 30, 100]) {
      const line = welcomeBackLine(h);
      expect(() => assertNoGuilt(line)).not.toThrow();
      expect(line.toLowerCase()).not.toContain("where were you");
      expect(line.toLowerCase()).not.toContain("finally");
    }
  });
});
