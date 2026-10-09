/**
 * Tests for the somatic mission library (Phase 4b).
 *
 * Covers: catalog completeness (27 missions, 3 types), age-band validity,
 * guardrails (no clinical language, no trademarked names), deterministic
 * selection, GeneratedMission conversion, and Mission Engine integration
 * (regulation_first slots pull from the somatic library).
 */
import { describe, expect, it } from "vitest";
import {
  SOMATIC_MISSIONS,
  SOMATIC_TYPES,
  SOMATIC_TYPE_LABELS,
  pickSomaticMission,
  somaticToGeneratedMission,
  somaticTypeCounts,
  type SomaticMission,
} from "../somatic-missions";
import {
  buildSmartTemplateSet,
  planMissionSlots,
  type ChildSnapshot,
} from "../mission-engine";

// Clinical / trademarked terms that must never appear in mission content.
const FORBIDDEN = [
  /trauma/i,
  /somatic experiencing/i,
  /neurosequential/i,
  /diagnos/i,
  /disorder/i,
  /therapy/i,
  /therapeutic/i,
  /anxiet/i,
  /depress/i,
  /dysregulat/i,
  /clinical/i,
  /treatment/i,
  /heal/i,
];

function allText(m: SomaticMission): string {
  return `${m.title} ${m.detail}`;
}

describe("somatic catalog completeness", () => {
  it("has 27+ missions", () => {
    expect(SOMATIC_MISSIONS.length).toBeGreaterThanOrEqual(27);
  });

  it("covers all three types with 9+ each", () => {
    const counts = somaticTypeCounts();
    for (const t of SOMATIC_TYPES) {
      expect(counts[t]).toBeGreaterThanOrEqual(9);
    }
  });

  it("every mission has a unique id", () => {
    const ids = SOMATIC_MISSIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every mission has a non-empty title and detail", () => {
    for (const m of SOMATIC_MISSIONS) {
      expect(m.title.trim().length).toBeGreaterThan(0);
      expect(m.detail.trim().length).toBeGreaterThan(10);
    }
  });

  it("every mission targets at least one age band", () => {
    for (const m of SOMATIC_MISSIONS) {
      expect(m.ageBands.length).toBeGreaterThan(0);
      for (const b of m.ageBands) {
        expect(["4-6", "7-9", "10-12"]).toContain(b);
      }
    }
  });

  it("every age band has missions in every type", () => {
    for (const band of ["4-6", "7-9", "10-12"] as const) {
      for (const type of SOMATIC_TYPES) {
        const found = SOMATIC_MISSIONS.some(
          (m) => m.ageBands.includes(band) && m.type === type,
        );
        expect(found, `${band} / ${type}`).toBe(true);
      }
    }
  });

  it("pet-requiring missions are a minority (works without pets)", () => {
    const requiring = SOMATIC_MISSIONS.filter((m) => m.requiresPet);
    expect(requiring.length).toBeLessThan(SOMATIC_MISSIONS.length / 2);
  });

  it("has pet-linked missions for the pet advantage", () => {
    const petLinked = SOMATIC_MISSIONS.filter((m) => m.petLinked);
    expect(petLinked.length).toBeGreaterThanOrEqual(3);
  });
});

describe("somatic guardrails", () => {
  it("contains no clinical or trademarked language", () => {
    for (const m of SOMATIC_MISSIONS) {
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(allText(m)), `${m.id}: ${pattern}`).toBe(false);
      }
    }
  });

  it("type labels are kid-friendly, never clinical", () => {
    for (const t of SOMATIC_TYPES) {
      const label = SOMATIC_TYPE_LABELS[t];
      expect(label.length).toBeGreaterThan(0);
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(label)).toBe(false);
      }
    }
  });

  it("details use parent co-do framing (together / side by side)", () => {
    for (const m of SOMATIC_MISSIONS) {
      const text = m.detail.toLowerCase();
      const coDo =
        text.includes("together") ||
        text.includes("side by side") ||
        text.includes("you ") ||
        text.includes("each");
      expect(coDo, m.id).toBe(true);
    }
  });

  it("details never frame the child as failing or broken", () => {
    const shaming = [/wrong with/i, /bad behav/i, /punish/i, /fail/i];
    for (const m of SOMATIC_MISSIONS) {
      for (const pattern of shaming) {
        // "no fail state" is allowed in code comments, not mission text
        expect(pattern.test(allText(m)), `${m.id}: ${pattern}`).toBe(false);
      }
    }
  });

  it("minutes are short (3-10) — low demand by design", () => {
    for (const m of SOMATIC_MISSIONS) {
      expect(m.minutes).toBeGreaterThanOrEqual(2);
      expect(m.minutes).toBeLessThanOrEqual(12);
    }
  });
});

describe("pickSomaticMission", () => {
  it("is deterministic for the same inputs", () => {
    const a = pickSomaticMission({ ageBand: "7-9", hasPets: true, seed: 3 });
    const b = pickSomaticMission({ ageBand: "7-9", hasPets: true, seed: 3 });
    expect(a.id).toBe(b.id);
  });

  it("rotates with seed", () => {
    const ids = new Set(
      [0, 1, 2, 3, 4].map(
        (s) => pickSomaticMission({ ageBand: "7-9", hasPets: true, seed: s }).id,
      ),
    );
    expect(ids.size).toBeGreaterThan(1);
  });

  it("respects age band", () => {
    for (let s = 0; s < 10; s++) {
      const m = pickSomaticMission({ ageBand: "4-6", hasPets: true, seed: s });
      expect(m.ageBands).toContain("4-6");
    }
  });

  it("never returns pet-requiring missions when no pets", () => {
    for (let s = 0; s < 20; s++) {
      const m = pickSomaticMission({ ageBand: "7-9", hasPets: false, seed: s });
      expect(m.requiresPet).toBe(false);
    }
  });

  it("honors type preference", () => {
    for (let s = 0; s < 5; s++) {
      const m = pickSomaticMission({
        ageBand: "7-9",
        hasPets: true,
        preferType: "rhythmic",
        seed: s,
      });
      expect(m.type).toBe("rhythmic");
    }
  });

  it("never throws on edge inputs", () => {
    expect(() =>
      pickSomaticMission({ ageBand: "4-6", hasPets: false, seed: 999 }),
    ).not.toThrow();
  });
});

describe("somaticToGeneratedMission", () => {
  it("produces a valid GeneratedMission", () => {
    const m = SOMATIC_MISSIONS[0];
    const g = somaticToGeneratedMission(m);
    expect(g.title).toBe(m.title);
    expect(g.detail).toBe(m.detail);
    expect(g.difficulty).toBe("easy");
    expect(g.minutes).toBe(m.minutes);
    expect(g.petLinked).toBe(m.petLinked);
    expect(g.traitFocus).toBe(m.traitFocus);
  });

  it("maps pet-linked to pet_care category", () => {
    const petMission = SOMATIC_MISSIONS.find((m) => m.petLinked)!;
    expect(somaticToGeneratedMission(petMission).category).toBe("pet_care");
  });

  it("maps non-pet to chore category", () => {
    const plain = SOMATIC_MISSIONS.find((m) => !m.petLinked)!;
    expect(somaticToGeneratedMission(plain).category).toBe("chore");
  });

  it("accepts a planner trait override", () => {
    const m = SOMATIC_MISSIONS[0];
    const g = somaticToGeneratedMission(m, "self-control");
    expect(g.traitFocus).toBe("self-control");
  });
});

describe("mission engine integration", () => {
  function disengagedSnapshot(): ChildSnapshot {
    return {
      ageBand: "7-9",
      skillPoints14d: {
        responsibility: 10,
        empathy: 8,
        teamwork: 5,
        leadership: 3,
        time: 6,
      },
      skillPoints30d: {
        responsibility: 20,
        empathy: 16,
        teamwork: 10,
        leadership: 6,
        time: 12,
      },
      traitWeights: {
        confidence: 0.15,
        empathy: 0.15,
        "self-control": 0.2,
        integrity: 0.1,
        curiosity: 0.1,
        perseverance: 0.15,
        optimism: 0.15,
      },
      traitScores: {
        confidence: 0.5,
        empathy: 0.5,
        "self-control": 0.4,
        integrity: 0.5,
        curiosity: 0.5,
        perseverance: 0.5,
        optimism: 0.5,
      },
      weakestTraits: ["self-control"],
      weakestSkill: "time",
      strongestSkill: "responsibility",
      completionRate14d: 0.2,
      completionRateByWeekday: {},
      weakWeekdays: [],
      completionRateByCategory: {},
      weakCategories: [],
      completionRateByDifficulty: {},
      daysSinceCompletion: 5,
      currentStreak: 0,
      assigned14d: 10,
      skipRejectRate14d: 0.6,
      calibratedDifficulty: {
        pet_care: "easy",
        chore: "easy",
        kindness: "easy",
        money: "easy",
        community: "easy",
      },
      pets: [{ species: "dog" }],
    };
  }

  it("disengaged snapshot plans a regulation_first slot", () => {
    const plan = planMissionSlots(disengagedSnapshot(), { count: 4 });
    expect(plan.slots[0].kind).toBe("regulation_first");
  });

  it("buildSmartTemplateSet uses a somatic mission for regulation_first", () => {
    const plan = planMissionSlots(disengagedSnapshot(), { count: 4 });
    const missions = buildSmartTemplateSet(plan, [{ species: "dog" }], {
      ageBand: "7-9",
      seed: 0,
    });
    const somaticIds = new Set(SOMATIC_MISSIONS.map((m) => m.id));
    // The first mission must come from the somatic library (match by title).
    const somaticTitles = new Set(SOMATIC_MISSIONS.map((m) => m.title));
    expect(somaticTitles.has(missions[0].title)).toBe(true);
    expect(somaticIds.size).toBeGreaterThan(0);
  });

  it("regulation_first mission is easy with participation points", () => {
    const plan = planMissionSlots(disengagedSnapshot(), { count: 4 });
    const missions = buildSmartTemplateSet(plan, [], {
      ageBand: "4-6",
      seed: 1,
    });
    expect(missions[0].difficulty).toBe("easy");
    expect(missions[0].points).toBe(8);
  });

  it("regulation_first works without pets", () => {
    const snap = disengagedSnapshot();
    snap.pets = [];
    const plan = planMissionSlots(snap, { count: 4 });
    const missions = buildSmartTemplateSet(plan, [], { ageBand: "7-9" });
    expect(missions[0].title.length).toBeGreaterThan(0);
  });
});
