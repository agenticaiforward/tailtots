import { describe, expect, it } from "vitest";
import type { Child, Mission } from "@/lib/types";
import {
  getAgeFitCopy,
  getFairnessSummary,
  getKidMissionReason,
  getMissionLifeSkill,
  isMissionAgeAppropriate,
} from "@/lib/domain/missions";

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

function child(overrides: Partial<Child> = {}): Child {
  return {
    id: "c1",
    name: "Kid",
    age: 8,
    secretCode: "",
    points: 0,
    coins: 0,
    level: "easy",
    streakDays: 0,
    ...overrides,
  };
}

describe("isMissionAgeAppropriate", () => {
  it("matches the difficulty age guidance bands", () => {
    expect(isMissionAgeAppropriate(mission({ difficulty: "easy" }), child({ age: 4 }))).toBe(true);
    expect(isMissionAgeAppropriate(mission({ difficulty: "easy" }), child({ age: 3 }))).toBe(false);
    expect(isMissionAgeAppropriate(mission({ difficulty: "medium" }), child({ age: 7 }))).toBe(true);
    expect(isMissionAgeAppropriate(mission({ difficulty: "medium" }), child({ age: 6 }))).toBe(false);
    expect(isMissionAgeAppropriate(mission({ difficulty: "hard" }), child({ age: 10 }))).toBe(true);
    expect(isMissionAgeAppropriate(mission({ difficulty: "hard" }), child({ age: 9 }))).toBe(false);
    expect(isMissionAgeAppropriate(mission({ difficulty: "super_hard" }), child({ age: 13 }))).toBe(true);
    expect(isMissionAgeAppropriate(mission({ difficulty: "super_hard" }), child({ age: 12 }))).toBe(false);
  });
});

describe("getAgeFitCopy", () => {
  it("explains assignment when no child is given", () => {
    expect(getAgeFitCopy(mission())).toBe("Assign a kid to see age fit.");
  });

  it("confirms a good fit and suggests supervision otherwise", () => {
    expect(getAgeFitCopy(mission({ difficulty: "easy" }), child({ age: 8, name: "Aarush" }))).toContain("Good age fit");
    expect(getAgeFitCopy(mission({ difficulty: "super_hard" }), child({ age: 8, name: "Aarush" }))).toContain(
      "Parent supervision recommended",
    );
  });
});

describe("getMissionLifeSkill", () => {
  it("maps each category to its life skill", () => {
    expect(getMissionLifeSkill(mission({ category: "pet_care" }))).toBe("responsibility");
    expect(getMissionLifeSkill(mission({ category: "kindness" }))).toBe("empathy");
    expect(getMissionLifeSkill(mission({ category: "community" }))).toBe("teamwork");
    expect(getMissionLifeSkill(mission({ category: "money" }))).toBe("leadership");
    expect(getMissionLifeSkill(mission({ category: "chore" }))).toBe("time");
  });
});

describe("getKidMissionReason", () => {
  it("defers to a grown-up when no child is assigned", () => {
    expect(getKidMissionReason(mission())).toBe("A grown-up will choose the right helper.");
  });

  it("mentions age fit and the life skill for an assigned child", () => {
    const reason = getKidMissionReason(mission({ category: "kindness" }), child({ age: 8 }));
    expect(reason).toContain("it fits your age");
    expect(reason).toContain("empathy");
  });
});

describe("getFairnessSummary", () => {
  const kidA = child({ id: "a", name: "A" });
  const kidB = child({ id: "b", name: "B" });

  it("reports balanced when planned points are close", () => {
    const missions = [
      mission({ id: "1", assignedChildId: "a", points: 10 }),
      mission({ id: "2", assignedChildId: "b", points: 12 }),
    ];
    const summary = getFairnessSummary(missions, [kidA, kidB]);
    expect(summary.spread).toBe(2);
    expect(summary.label).toBe("Balanced today");
  });

  it("flags imbalance and names the children", () => {
    const missions = [
      mission({ id: "1", assignedChildId: "a", points: 30 }),
      mission({ id: "2", assignedChildId: "b", points: 5 }),
    ];
    const summary = getFairnessSummary(missions, [kidA, kidB]);
    expect(summary.spread).toBe(25);
    expect(summary.label).toBe("Needs balancing");
    expect(summary.detail).toContain("A");
    expect(summary.detail).toContain("B");
  });

  it("ignores approved missions when planning", () => {
    const missions = [mission({ id: "1", assignedChildId: "a", points: 100, status: "approved" })];
    expect(getFairnessSummary(missions, [kidA, kidB]).spread).toBe(0);
  });
});
