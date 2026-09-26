/**
 * Kid Bank domain math.
 *
 * Money model: only *approved* transactions move real balances. `earn`
 * adds allowance, `spend`/`give` subtract, and `save` earmarks money toward
 * savings goals (also subtracted from the spendable balance).
 */
import type { BankTransaction, SavingsGoal } from "@/lib/types";

export type KidBankSummary = {
  approvedAllowance: number;
  spentOrGiven: number;
  savedForGoals: number;
  availableBalance: number;
};

export function summarizeKidBank(
  transactions: BankTransaction[],
  goals: SavingsGoal[],
  childId: string | undefined,
): KidBankSummary {
  const childTransactions = transactions.filter((item) => item.childId === childId);
  const childGoals = goals.filter((item) => item.childId === childId);
  const approvedTransactions = childTransactions.filter((tx) => tx.status === "approved");
  const approvedAllowance = approvedTransactions
    .filter((tx) => tx.category === "earn")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const spentOrGiven = approvedTransactions
    .filter((tx) => tx.category === "spend" || tx.category === "give")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const savedForGoals = childGoals.reduce((sum, goal) => sum + goal.saved, 0);
  return {
    approvedAllowance,
    spentOrGiven,
    savedForGoals,
    availableBalance: Math.max(0, approvedAllowance - spentOrGiven - savedForGoals),
  };
}

export function goalProgress(goal: SavingsGoal): number {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.round((goal.saved / goal.target) * 100));
}
