import { describe, expect, it } from "vitest";

import type { BankTransaction, SavingsGoal } from "../types";
import {
  KID_JAR_KEYS,
  buildJarMoveTx,
  defaultKidBankSettings,
  driveKindFromGoal,
  driveProgress,
  featuredDrive,
  isUndoableJarMove,
  jarFillPercent,
  jarMoveGuardrails,
  kidJarBalances,
  kidVisibleDrives,
  pointsToDollars,
  reverseJarMove,
} from "../kid-bank";

function tx(partial: Partial<BankTransaction> & { id: string }): BankTransaction {
  return {
    childId: "sahasra",
    category: "earn",
    amount: 1,
    description: "test",
    status: "approved",
    ...partial,
  };
}

function goal(partial: Partial<SavingsGoal> & { id: string }): SavingsGoal {
  return {
    childId: "sahasra",
    title: "Test",
    target: 20,
    saved: 0,
    type: "family_reward",
    ...partial,
  };
}

describe("kidJarBalances", () => {
  it("splits approved earnings into jars and leaves the rest unallocated", () => {
    const transactions = [
      tx({ id: "e1", category: "earn", amount: 10 }),
      tx({ id: "s1", category: "save", amount: 4 }),
      tx({ id: "g1", category: "give", amount: 2 }),
      tx({ id: "sp1", category: "spend", amount: 1 }),
    ];
    expect(kidJarBalances("sahasra", transactions)).toEqual({
      earned: 10,
      save: 4,
      spend: 1,
      give: 2,
      unallocated: 3,
    });
  });

  it("ignores pending requests and other kids' money", () => {
    const transactions = [
      tx({ id: "e1", category: "earn", amount: 10 }),
      tx({ id: "p1", category: "save", amount: 5, status: "pending" }),
      tx({ id: "o1", category: "earn", amount: 100, childId: "aarush" }),
    ];
    const balances = kidJarBalances("sahasra", transactions);
    expect(balances.unallocated).toBe(10);
    expect(balances.save).toBe(0);
  });

  it("never goes negative and supports reversals", () => {
    const move = tx({ id: "m1", category: "save", amount: 6 });
    const undo = reverseJarMove(move, "m1-undo");
    const balances = kidJarBalances("sahasra", [tx({ id: "e1", category: "earn", amount: 10 }), move, undo]);
    expect(undo.amount).toBe(-6);
    expect(balances.save).toBe(0);
    expect(balances.unallocated).toBe(10);
  });

  it("exposes the three jar keys", () => {
    expect(KID_JAR_KEYS).toEqual(["save", "spend", "give"]);
  });
});

describe("jarFillPercent", () => {
  it("is empty at zero and never exceeds 100", () => {
    expect(jarFillPercent(0, 25)).toBe(0);
    expect(jarFillPercent(50, 25)).toBe(100);
  });

  it("gives a visible sliver for small balances", () => {
    const pct = jarFillPercent(1, 25);
    expect(pct).toBeGreaterThanOrEqual(10);
    expect(pct).toBeLessThan(20);
  });
});

describe("jarMoveGuardrails", () => {
  const balances = { earned: 20, save: 0, spend: 0, give: 0, unallocated: 8 };

  it("allows a normal move", () => {
    expect(jarMoveGuardrails({ balances, settings: defaultKidBankSettings, request: { category: "save", amount: 5 } })).toBeNull();
  });

  it("blocks moves bigger than the unallocated pool", () => {
    const reason = jarMoveGuardrails({ balances, settings: defaultKidBankSettings, request: { category: "give", amount: 9 } });
    expect(reason).toMatch(/\$8/);
  });

  it("blocks moves above the parent's per-tap cap", () => {
    const reason = jarMoveGuardrails({
      balances: { ...balances, unallocated: 100 },
      settings: { ...defaultKidBankSettings, maxSingleJarMove: 10 },
      request: { category: "spend", amount: 11 },
    });
    expect(reason).toMatch(/\$10/);
  });

  it("blocks spend moves that would overflow the spend-jar cap", () => {
    const reason = jarMoveGuardrails({
      balances: { ...balances, spend: 18, unallocated: 10 },
      settings: { ...defaultKidBankSettings, spendJarCap: 20 },
      request: { category: "spend", amount: 5 },
    });
    expect(reason).toMatch(/\$20/);
  });

  it("treats a zero cap as unlimited", () => {
    expect(
      jarMoveGuardrails({
        balances: { ...balances, unallocated: 500 },
        settings: { maxSingleJarMove: 0, spendJarCap: 0, allowKidUndo: true },
        request: { category: "spend", amount: 500 },
      }),
    ).toBeNull();
  });
});

describe("buildJarMoveTx / reverseJarMove / isUndoableJarMove", () => {
  it("builds an instantly-approved jar move", () => {
    const created = buildJarMoveTx("sahasra", { category: "give", amount: 3, goalId: "goal-9" }, "Maya", "tx-1");
    expect(created.status).toBe("approved");
    expect(created.goalId).toBe("goal-9");
    expect(created.description).toMatch(/Maya/);
  });

  it("only the kid's own positive approved jar moves are undoable", () => {
    expect(isUndoableJarMove(tx({ id: "a", category: "save", amount: 2 }), "sahasra")).toBe(true);
    expect(isUndoableJarMove(tx({ id: "b", category: "earn", amount: 2 }), "sahasra")).toBe(false);
    expect(isUndoableJarMove(tx({ id: "c", category: "save", amount: 2, status: "pending" }), "sahasra")).toBe(false);
    expect(isUndoableJarMove(tx({ id: "d", category: "save", amount: -2 }), "sahasra")).toBe(false);
    expect(isUndoableJarMove(tx({ id: "e", category: "save", amount: 2, childId: "aarush" }), "sahasra")).toBe(false);
  });
});

describe("pointsToDollars", () => {
  it("converts whole dollars at the parent rate", () => {
    expect(pointsToDollars(180, 20)).toEqual({ dollars: 9, pointsUsed: 180 });
    expect(pointsToDollars(25, 20)).toEqual({ dollars: 1, pointsUsed: 20 });
    expect(pointsToDollars(19, 20)).toEqual({ dollars: 0, pointsUsed: 0 });
  });
});

describe("drives", () => {
  it("derives the drive kind from causeNote", () => {
    expect(driveKindFromGoal(goal({ id: "d1", type: "donation", causeNote: "School PTO drive" }))).toBe("pto");
    expect(driveKindFromGoal(goal({ id: "d2", type: "donation", causeNote: "Neighborhood drive" }))).toBe("neighborhood");
    expect(driveKindFromGoal(goal({ id: "d3", type: "donation", causeNote: "Blankets for Sunny Paws Shelter" }))).toBe("shelter");
    expect(driveKindFromGoal(goal({ id: "d4", type: "donation", causeNote: "Other kindness" }))).toBe("kindness");
    expect(driveKindFromGoal(goal({ id: "d5", type: "toy" }))).toBe("save");
  });

  it("shows kids their own drives plus shared family drives", () => {
    const goals = [
      goal({ id: "mine", type: "donation", causeNote: "School PTO drive" }),
      goal({ id: "shared", type: "donation", causeNote: "Animal shelter drive", childId: "aarush", sharedWithTrustedFamilies: true }),
      goal({ id: "private", type: "donation", causeNote: "Neighborhood drive", childId: "aarush", sharedWithTrustedFamilies: false }),
      goal({ id: "toy", type: "toy" }),
    ];
    const visible = kidVisibleDrives("sahasra", goals, false).map((g) => g.id);
    expect(visible).toContain("mine");
    expect(visible).toContain("shared");
    expect(visible).not.toContain("private");
    expect(visible).not.toContain("toy");
  });

  it("hides kid-hidden drives from kids but not parents", () => {
    const goals = [goal({ id: "h", type: "donation", causeNote: "Other kindness", visibleToKids: false })];
    expect(kidVisibleDrives("sahasra", goals, false)).toHaveLength(0);
    expect(kidVisibleDrives("sahasra", goals, true)).toHaveLength(1);
  });

  it("features the most-funded incomplete drive", () => {
    const goals = [
      goal({ id: "a", type: "donation", saved: 2, target: 20 }),
      goal({ id: "b", type: "donation", saved: 15, target: 20 }),
      goal({ id: "c", type: "donation", saved: 20, target: 20, completedAt: "2026-10-01" }),
    ];
    expect(featuredDrive(goals)?.id).toBe("b");
    expect(driveProgress(goals[1])).toBe(0.75);
  });
});
