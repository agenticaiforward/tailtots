import { describe, expect, it } from "vitest";
import type { BankTransaction, SavingsGoal } from "@/lib/types";
import { goalProgress, summarizeKidBank } from "@/lib/domain/bank";

function tx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    childId: "c1",
    category: "earn",
    amount: 5,
    description: "Test",
    status: "approved",
    ...overrides,
  };
}

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "g1",
    childId: "c1",
    title: "Goal",
    target: 20,
    saved: 5,
    type: "toy",
    ...overrides,
  };
}

describe("summarizeKidBank", () => {
  it("computes the spendable balance from approved transactions only", () => {
    const transactions = [
      tx({ category: "earn", amount: 10 }),
      tx({ category: "earn", amount: 4, status: "pending" }),
      tx({ category: "spend", amount: 3 }),
      tx({ category: "give", amount: 2 }),
    ];
    const summary = summarizeKidBank(transactions, [], "c1");
    expect(summary.approvedAllowance).toBe(10);
    expect(summary.spentOrGiven).toBe(5);
    expect(summary.savedForGoals).toBe(0);
    expect(summary.availableBalance).toBe(5);
  });

  it("earmarks saved-for-goals money from the balance", () => {
    const summary = summarizeKidBank([tx({ category: "earn", amount: 10 })], [goal({ saved: 6 })], "c1");
    expect(summary.savedForGoals).toBe(6);
    expect(summary.availableBalance).toBe(4);
  });

  it("never goes below zero", () => {
    const summary = summarizeKidBank([tx({ category: "spend", amount: 50 })], [goal({ saved: 50 })], "c1");
    expect(summary.availableBalance).toBe(0);
  });

  it("ignores other children's money", () => {
    const summary = summarizeKidBank([tx({ childId: "other", amount: 100 })], [goal({ childId: "other", saved: 40 })], "c1");
    expect(summary.availableBalance).toBe(0);
    expect(summary.savedForGoals).toBe(0);
  });
});

describe("goalProgress", () => {
  it("returns a capped percentage", () => {
    expect(goalProgress(goal({ target: 20, saved: 5 }))).toBe(25);
    expect(goalProgress(goal({ target: 20, saved: 40 }))).toBe(100);
    expect(goalProgress(goal({ target: 0, saved: 5 }))).toBe(0);
  });
});
