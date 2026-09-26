import { describe, expect, it } from "vitest";
import type { BankTransaction, Child, Mission } from "@/lib/types";
import { FAMILY_TALK_SIGN_OFF_ID, MILESTONES, milestoneProgress, summarizeJourney } from "@/lib/domain/readiness";

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

function completedMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    title: "Done mission",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 0,
    question: "",
    status: "approved",
    completedBy: "c1",
    assignedChildId: "c1",
    ...overrides,
  };
}

function giveTx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    childId: "c1",
    category: "give",
    amount: 2,
    description: "Shelter gift",
    status: "approved",
    ...overrides,
  };
}

describe("milestoneProgress", () => {
  it("reads the care rhythm from the child's streak", () => {
    expect(milestoneProgress("care-rhythm", child({ streakDays: 5 }), [], [])).toBe(5);
  });

  it("counts completed pet-care missions", () => {
    const missions = [
      completedMission({ category: "pet_care" }),
      completedMission({ category: "pet_care" }),
      completedMission({ category: "chore" }),
    ];
    expect(milestoneProgress("pet-care-pro", child(), missions, [])).toBe(2);
  });

  it("counts kindness and community missions as quests", () => {
    const missions = [
      completedMission({ category: "kindness" }),
      completedMission({ category: "community" }),
      completedMission({ category: "pet_care" }),
    ];
    expect(milestoneProgress("kindness-quest", child(), missions, [])).toBe(2);
  });

  it("counts parent-approved missions as trust", () => {
    const missions = [
      completedMission({ status: "approved" }),
      completedMission({ status: "pending" }),
    ];
    expect(milestoneProgress("parent-trust", child(), missions, [])).toBe(1);
  });

  it("counts approved giving transactions", () => {
    const txs = [giveTx(), giveTx({ status: "pending" }), giveTx({ category: "earn" })];
    expect(milestoneProgress("giving-heart", child(), [], txs)).toBe(1);
  });

  it("returns 0 for unknown milestone ids", () => {
    expect(milestoneProgress("nope", child(), [], [])).toBe(0);
  });

  it("only counts the child's own activity", () => {
    const missions = [completedMission({ completedBy: "other", assignedChildId: "other" })];
    expect(milestoneProgress("pet-care-pro", child(), missions, [])).toBe(0);
    expect(milestoneProgress("giving-heart", child(), [], [giveTx({ childId: "other" })])).toBe(0);
  });
});

describe("summarizeJourney", () => {
  it("starts at 0% with no activity", () => {
    const summary = summarizeJourney(child(), [], [], []);
    expect(summary.completeCount).toBe(0);
    expect(summary.journeyPct).toBe(0);
    expect(summary.readyForTalk).toBe(false);
    expect(summary.states).toHaveLength(MILESTONES.length);
  });

  it("reaches 100% and unlocks the family talk when every milestone is met", () => {
    const kid = child({ streakDays: 9 });
    const missions = [
      ...Array.from({ length: 12 }, () => completedMission({ category: "pet_care" })),
      ...Array.from({ length: 3 }, () => completedMission({ category: "kindness" })),
    ];
    const summary = summarizeJourney(kid, missions, [giveTx()], []);
    expect(summary.completeCount).toBe(MILESTONES.length);
    expect(summary.journeyPct).toBe(100);
    expect(summary.readyForTalk).toBe(true);
    expect(summary.talkSignOff).toBeUndefined();
  });

  it("attaches parent sign-offs to their milestones", () => {
    const kid = child({ streakDays: 9 });
    const signOffs = [{ milestoneId: "care-rhythm", childId: "c1", signedAt: "today" }];
    const summary = summarizeJourney(kid, [], [], signOffs);
    const care = summary.states.find((s) => s.milestone.id === "care-rhythm");
    expect(care?.isComplete).toBe(true);
    expect(care?.signOff?.signedAt).toBe("today");
  });

  it("recognizes the family-talk sign-off separately from milestones", () => {
    const summary = summarizeJourney(child(), [], [], [
      { milestoneId: FAMILY_TALK_SIGN_OFF_ID, childId: "c1", signedAt: "today" },
    ]);
    expect(summary.talkSignOff?.milestoneId).toBe(FAMILY_TALK_SIGN_OFF_ID);
    expect(summary.completeCount).toBe(0);
  });
});
