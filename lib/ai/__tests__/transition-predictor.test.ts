import { describe, expect, it } from "vitest";
import {
  AGE_MODE_RANGES,
  ageModeForAge,
  ceilingFractionForRatings,
  detectModeTransition,
  graduationMessage,
  nextMode,
} from "../transition-predictor";
import type { ChildSnapshot } from "../mission-engine";

function snapshot(overrides: Partial<ChildSnapshot> = {}): ChildSnapshot {
  return {
    ageBand: "5-7",
    age: 6,
    skillPoints14d: { responsibility: 0, empathy: 0, teamwork: 0, leadership: 0, time: 0 },
    skillPoints30d: { responsibility: 0, empathy: 0, teamwork: 0, leadership: 0, time: 0 },
    traitScores: {
      confidence: 0.5, empathy: 0.5, "self-control": 0.5, integrity: 0.5,
      curiosity: 0.5, perseverance: 0.5, optimism: 0.5,
    },
    traitWeights: {
      confidence: 0.14, empathy: 0.14, "self-control": 0.14, integrity: 0.14,
      curiosity: 0.14, perseverance: 0.15, optimism: 0.15,
    },
    weakestTraits: ["perseverance"],
    weakestSkill: "responsibility",
    strongestSkill: "empathy",
    completionRate14d: 0.7,
    completionRateByWeekday: {},
    weakWeekdays: [],
    completionRateByCategory: {},
    weakCategories: [],
    completionRateByDifficulty: {},
    daysSinceCompletion: 0,
    currentStreak: 5,
    assigned14d: 20,
    skipRejectRate14d: 0.1,
    calibratedDifficulty: {},
    pets: [{ species: "dog" }],
    lifetime: { totalBadges: 10, badgesBySkill: {}, totalCompletions: 40 },
    ...overrides,
  };
}

describe("ageModeForAge", () => {
  it("maps ages to modes", () => {
    expect(ageModeForAge(4)).toBe("sprout");
    expect(ageModeForAge(6)).toBe("sprout");
    expect(ageModeForAge(7)).toBe("grow");
    expect(ageModeForAge(9)).toBe("grow");
    expect(ageModeForAge(10)).toBe("thrive");
    expect(ageModeForAge(12)).toBe("thrive");
  });
  it("returns null for unknown age", () => {
    expect(ageModeForAge(null)).toBeNull();
  });
});

describe("nextMode", () => {
  it("steps through the ladder", () => {
    expect(nextMode("sprout")).toBe("grow");
    expect(nextMode("grow")).toBe("thrive");
    expect(nextMode("thrive")).toBeNull();
  });
});

describe("ceilingFractionForRatings", () => {
  it("computes the fraction at ceiling", () => {
    expect(ceilingFractionForRatings({ a: 1560, b: 1200, c: 1580 })).toBeCloseTo(2 / 3);
    expect(ceilingFractionForRatings({})).toBe(0);
    expect(ceilingFractionForRatings({ a: 1100 })).toBe(0);
  });
});

describe("detectModeTransition", () => {
  it("detects readiness when signals fire", () => {
    const t = detectModeTransition({
      snapshot: snapshot({
        age: 6,
        completionRateByDifficulty: { hard: 0.9 },
        lifetime: { totalBadges: 10, badgesBySkill: {}, totalCompletions: 40 },
      }),
      currentMode: "sprout",
      eloRatings: { pet_care: 1570, chore: 1580 },
      easySkipRate: 0.5,
    });
    expect(t.ready).toBe(true);
    expect(t.fromMode).toBe("sprout");
    expect(t.toMode).toBe("grow");
    expect(t.reasons.length).toBeGreaterThan(0);
  });
  it("does not graduate brand-new children", () => {
    const t = detectModeTransition({
      snapshot: snapshot({
        age: 6,
        completionRateByDifficulty: { hard: 0.95 },
        lifetime: { totalBadges: 1, badgesBySkill: {}, totalCompletions: 5 },
      }),
      currentMode: "sprout",
      eloRatings: { pet_care: 1590 },
    });
    expect(t.ready).toBe(false);
  });
  it("does not graduate from thrive (no next mode)", () => {
    const t = detectModeTransition({
      snapshot: snapshot({ age: 12, completionRateByDifficulty: { hard: 0.95 } }),
      currentMode: "thrive",
      eloRatings: { pet_care: 1600 },
    });
    expect(t.ready).toBe(false);
    expect(t.toMode).toBeNull();
  });
  it("stays put when no signals fire", () => {
    const t = detectModeTransition({
      snapshot: snapshot({ age: 5, completionRateByDifficulty: { easy: 0.7 } }),
      currentMode: "sprout",
      eloRatings: { pet_care: 1100 },
      easySkipRate: 0.1,
    });
    expect(t.ready).toBe(false);
    expect(t.confidence).toBeLessThan(0.5);
  });
});

describe("graduationMessage", () => {
  it("returns null when not ready", () => {
    expect(graduationMessage(detectModeTransition({
      snapshot: snapshot({ age: 5 }),
      currentMode: "sprout",
      eloRatings: {},
    }))).toBeNull();
  });
  it("celebrates the transition strength-first", () => {
    const t = detectModeTransition({
      snapshot: snapshot({
        age: 6,
        completionRateByDifficulty: { hard: 0.9 },
        lifetime: { totalBadges: 10, badgesBySkill: {}, totalCompletions: 40 },
      }),
      currentMode: "sprout",
      eloRatings: { pet_care: 1570, chore: 1580 },
    });
    const msg = graduationMessage(t);
    expect(msg).toContain("Grow");
    expect(msg).not.toMatch(/warning|alert|concern/i);
  });
});

describe("AGE_MODE_RANGES", () => {
  it("covers 4-12 without gaps", () => {
    expect(AGE_MODE_RANGES.sprout.min).toBe(4);
    expect(AGE_MODE_RANGES.thrive.max).toBe(12);
    expect(AGE_MODE_RANGES.sprout.max + 1).toBe(AGE_MODE_RANGES.grow.min);
    expect(AGE_MODE_RANGES.grow.max + 1).toBe(AGE_MODE_RANGES.thrive.min);
  });
});
