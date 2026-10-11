import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  currentLegIndex,
  currentShelterStageIndex,
  formatMiles,
  getJourneyState,
  journeyProgress,
  journeyTraitBoosts,
  loadJourneyMap,
  markLegCelebrated,
  milesPerMission,
  MISSIONS_PER_JOURNEY,
  recordJourneyMission,
  recordShelterMission,
  startJourney,
  JOURNEY_STORAGE_KEY,
} from "../journey";
import { getJourneyAnimal, getShelterAnimal, JOURNEY_ANIMALS } from "../animals";

// In-memory localStorage mock
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
});

beforeEach(() => {
  delete store[JOURNEY_STORAGE_KEY];
});

describe("journey math", () => {
  it("animal leg miles sum to total distance", () => {
    for (const a of JOURNEY_ANIMALS) {
      const sum = a.legs.reduce((s, l) => s + l.miles, 0);
      expect(sum).toBe(a.totalDistanceMi);
    }
  });

  it("each animal has 5-8 legs", () => {
    for (const a of JOURNEY_ANIMALS) {
      expect(a.legs.length).toBeGreaterThanOrEqual(5);
      expect(a.legs.length).toBeLessThanOrEqual(8);
    }
  });

  it("milesPerMission completes the journey in MISSIONS_PER_JOURNEY missions", () => {
    for (const a of JOURNEY_ANIMALS) {
      expect(milesPerMission(a) * MISSIONS_PER_JOURNEY).toBeCloseTo(a.totalDistanceMi, 6);
    }
  });

  it("starts at leg 0 with zero progress", () => {
    const s = startJourney("kid1", "wild", "monarch");
    expect(currentLegIndex(s)).toBe(0);
    expect(journeyProgress(s)).toBe(0);
  });

  it("missions advance legs monotonically", () => {
    startJourney("kid1", "wild", "monarch");
    let lastLeg = 0;
    for (let i = 0; i < MISSIONS_PER_JOURNEY; i++) {
      const award = recordJourneyMission("kid1");
      expect(award).not.toBeNull();
      expect(award!.currentLegIndex).toBeGreaterThanOrEqual(lastLeg);
      lastLeg = award!.currentLegIndex;
    }
  });

  it("completes the journey after MISSIONS_PER_JOURNEY missions", () => {
    startJourney("kid1", "wild", "monarch");
    let award = null;
    for (let i = 0; i < MISSIONS_PER_JOURNEY; i++) {
      award = recordJourneyMission("kid1");
    }
    expect(award!.journeyJustCompleted).toBe(true);
    expect(journeyProgress(award!.state)).toBe(1);
    // Further missions don't re-trigger completion
    const again = recordJourneyMission("kid1");
    expect(again!.journeyJustCompleted).toBe(false);
  });

  it("unlocks a new leg at the right moment", () => {
    startJourney("kid1", "wild", "monarch");
    // Monarch leg 0 is 450 miles; 75 miles/mission → leg 1 after 6 missions
    const per = milesPerMission(getJourneyAnimal("monarch")!);
    const missionsToLeg1 = Math.ceil(450 / per);
    let unlocked = false;
    for (let i = 0; i < missionsToLeg1; i++) {
      const a = recordJourneyMission("kid1");
      if (a!.newLegUnlocked) unlocked = true;
    }
    expect(unlocked).toBe(true);
    expect(currentLegIndex(getJourneyState("kid1")!)).toBe(1);
  });

  it("no-ops when the child has no journey", () => {
    expect(recordJourneyMission("ghost")).toBeNull();
  });

  it("markLegCelebrated is idempotent", () => {
    startJourney("kid1", "wild", "monarch");
    markLegCelebrated("kid1", 2);
    markLegCelebrated("kid1", 2);
    expect(getJourneyState("kid1")!.celebratedLegs).toEqual([2]);
  });

  it("switching animals restarts progress", () => {
    startJourney("kid1", "wild", "monarch");
    recordJourneyMission("kid1");
    const s = startJourney("kid1", "wild", "tern");
    expect(s.animalId).toBe("tern");
    expect(s.missionsCompleted).toBe(0);
    expect(s.milesEarned).toBe(0);
  });
});

describe("shelter journeys", () => {
  it("progresses one stage per 8 missions", () => {
    startJourney("kid1", "shelter", "luna");
    for (let i = 0; i < 8; i++) recordShelterMission("kid1");
    expect(currentShelterStageIndex(getJourneyState("kid1")!)).toBe(1);
  });

  it("completes after 40 missions with Home stage reached", () => {
    startJourney("kid1", "shelter", "luna");
    let award = null;
    for (let i = 0; i < 40; i++) award = recordShelterMission("kid1");
    expect(award!.journeyJustCompleted).toBe(true);
    const animal = getShelterAnimal("luna")!;
    expect(animal.stages[award!.currentLegIndex].name).toBe("Home");
  });

  it("wild and shelter recorders respect journey kind", () => {
    startJourney("kid1", "shelter", "luna");
    expect(recordJourneyMission("kid1")).toBeNull();
    startJourney("kid2", "wild", "monarch");
    expect(recordShelterMission("kid2")).toBeNull();
  });
});

describe("trait boosts", () => {
  it("monarch waters perseverance proportional to progress", () => {
    startJourney("kid1", "wild", "monarch");
    for (let i = 0; i < 20; i++) recordJourneyMission("kid1");
    const boosts = journeyTraitBoosts(getJourneyState("kid1")!);
    expect(boosts.perseverance).toBeGreaterThan(0);
    expect(boosts.perseverance).toBeLessThanOrEqual(0.3);
    expect(Object.keys(boosts)).toEqual(["perseverance"]);
  });

  it("tern waters optimism and curiosity", () => {
    startJourney("kid1", "wild", "tern");
    for (let i = 0; i < 20; i++) recordJourneyMission("kid1");
    const boosts = journeyTraitBoosts(getJourneyState("kid1")!);
    expect(boosts.optimism).toBeGreaterThan(0);
    expect(boosts.curiosity).toBeGreaterThan(0);
  });

  it("shelter journeys water empathy and self-control", () => {
    startJourney("kid1", "shelter", "rocky");
    for (let i = 0; i < 16; i++) recordShelterMission("kid1");
    const boosts = journeyTraitBoosts(getJourneyState("kid1")!);
    expect(boosts.empathy).toBeGreaterThan(0);
    expect(boosts["self-control"]).toBeGreaterThan(0);
  });

  it("no boost at zero progress", () => {
    const s = startJourney("kid1", "wild", "monarch");
    expect(journeyTraitBoosts(s)).toEqual({});
  });

  it("all boosted traits are valid TailTots traits", () => {
    const valid = new Set([
      "confidence",
      "empathy",
      "self-control",
      "integrity",
      "curiosity",
      "perseverance",
      "optimism",
      "respect",
    ]);
    for (const a of JOURNEY_ANIMALS) {
      const s = startJourney(`kid-${a.id}`, "wild", a.id);
      for (let i = 0; i < 20; i++) recordJourneyMission(`kid-${a.id}`);
      const boosts = journeyTraitBoosts(getJourneyState(`kid-${a.id}`)!);
      for (const t of Object.keys(boosts)) {
        expect(valid.has(t), `${a.id} boosts invalid trait ${t}`).toBe(true);
      }
    }
  });
});

describe("persistence", () => {
  it("survives a reload via localStorage", () => {
    startJourney("kid1", "wild", "wildebeest");
    recordJourneyMission("kid1");
    recordJourneyMission("kid1");
    const reloaded = loadJourneyMap()["kid1"];
    expect(reloaded.missionsCompleted).toBe(2);
    expect(reloaded.milesEarned).toBeGreaterThan(0);
  });

  it("formatMiles renders whole numbers with commas", () => {
    expect(formatMiles(1250.7)).toBe("1,250");
    expect(formatMiles(0)).toBe("0");
  });
});
