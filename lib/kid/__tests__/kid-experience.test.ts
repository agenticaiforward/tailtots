import { describe, expect, it } from "vitest";
import type { Mission } from "@/lib/types";
import { getAgeMode, nextAgeMode, AGE_MODE_META } from "@/app/components/AgeMode";
import { evolutionStageFor, nextEvolutionStage } from "@/app/components/PetEvolution";
import { braveTriesFromMissions } from "@/app/components/BraveTryStreak";
import { stonesFromMissions } from "@/app/components/MemoryStones";

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    title: "Test mission",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Done?",
    status: "pending",
    ...overrides,
  };
}

describe("age ladder", () => {
  it("maps ages to the right mode", () => {
    expect(getAgeMode(4)).toBe("sprout");
    expect(getAgeMode(6)).toBe("sprout");
    expect(getAgeMode(7)).toBe("grow");
    expect(getAgeMode(9)).toBe("grow");
    expect(getAgeMode(10)).toBe("thrive");
    expect(getAgeMode(12)).toBe("thrive");
  });

  it("clamps out-of-range ages", () => {
    expect(getAgeMode(3)).toBe("sprout");
    expect(getAgeMode(15)).toBe("thrive");
  });

  it("walks the ladder forward only", () => {
    expect(nextAgeMode("sprout")).toBe("grow");
    expect(nextAgeMode("grow")).toBe("thrive");
    expect(nextAgeMode("thrive")).toBeNull();
  });

  it("has distinct copy per mode", () => {
    const taglines = new Set(Object.values(AGE_MODE_META).map((m) => m.tagline));
    expect(taglines.size).toBe(3);
  });
});

describe("pet evolution", () => {
  it("starts as an egg", () => {
    expect(evolutionStageFor(0).stage).toBe("egg");
    expect(evolutionStageFor(4).stage).toBe("egg");
  });

  it("hatches at 5 missions", () => {
    expect(evolutionStageFor(5).stage).toBe("baby");
  });

  it("progresses through all five stages", () => {
    expect(evolutionStageFor(15).stage).toBe("junior");
    expect(evolutionStageFor(30).stage).toBe("adult");
    expect(evolutionStageFor(60).stage).toBe("wise");
    expect(evolutionStageFor(200).stage).toBe("wise");
  });

  it("points to the next stage", () => {
    expect(nextEvolutionStage(0)?.stage).toBe("baby");
    expect(nextEvolutionStage(59)?.stage).toBe("wise");
    expect(nextEvolutionStage(60)).toBeNull();
  });
});

describe("brave tries", () => {
  it("counts hard missions the kid engaged with", () => {
    const missions = [
      mission({ id: "a", difficulty: "hard", completedBy: "kid1" }),
      mission({ id: "b", difficulty: "super_hard", note: "tried my best" }),
      mission({ id: "c", difficulty: "hard" }), // not engaged — no try
      mission({ id: "d", difficulty: "easy", completedBy: "kid1" }), // easy — no try
    ];
    const tries = braveTriesFromMissions(missions);
    expect(tries.map((t) => t.missionId).sort()).toEqual(["a", "b"]);
  });

  it("attempting without completing still counts", () => {
    const missions = [mission({ id: "a", difficulty: "hard", note: "too tricky but I tried" })];
    const tries = braveTriesFromMissions(missions);
    expect(tries).toHaveLength(1);
    expect(tries[0].outcome).toBe("attempted");
  });

  it("scopes to the child", () => {
    const missions = [
      mission({ id: "a", difficulty: "hard", completedBy: "kid1", assignedChildId: "kid1" }),
      mission({ id: "b", difficulty: "hard", completedBy: "kid2", assignedChildId: "kid2" }),
    ];
    expect(braveTriesFromMissions(missions, "kid1")).toHaveLength(1);
  });
});

describe("memory stones", () => {
  it("creates one stone per completed mission", () => {
    const missions = [
      mission({ id: "a", completedBy: "kid1" }),
      mission({ id: "b", status: "approved" }),
      mission({ id: "c" }), // not completed
    ];
    const stones = stonesFromMissions(missions);
    expect(stones).toHaveLength(2);
  });

  it("gives deterministic unique visuals", () => {
    const m1 = mission({ id: "stone-a" });
    const m2 = mission({ id: "stone-b" });
    const [s1] = stonesFromMissions([{ ...m1, completedBy: "k" }]);
    const [s2] = stonesFromMissions([{ ...m2, completedBy: "k" }]);
    const [s1b] = stonesFromMissions([{ ...m1, completedBy: "k" }]);
    expect(s1.gradient).toBe(s1b.gradient); // deterministic
    expect(s1.gradient === s2.gradient && s1.rotation === s2.rotation).toBe(false);
  });

  it("tags curriculum missions with trait colors", () => {
    const missions = [
      mission({ id: "a", completedBy: "k", curriculum: { trait: "kindness", level: 0, missionKey: "k" } }),
    ];
    const [stone] = stonesFromMissions(missions);
    expect(stone.traitColor).toBeTruthy();
    expect(stone.traitLabel).toBe("kindness");
  });
});
