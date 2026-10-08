/**
 * kid-bank.ts — pure helpers for the Kid Bank jar-metaphor redesign (Feedback R2).
 *
 * The bank model stays on the existing BankTransaction / SavingsGoal shapes:
 * - category "earn" (status "approved") = dollars auto-credited when a parent
 *   approves a completed job, or when a kid converts points at the parent-set
 *   rate. This is the "money you earned" pool.
 * - category "save" | "spend" | "give" (status "approved") = the kid's own
 *   jar moves. Kids allocate instantly — no second parent approval. Parents
 *   set the points-to-dollar rate and guardrails UPFRONT (KidBankSettings).
 * - A kid's own reversal is an approved transaction with a negative amount
 *   and the same goalId, so goal progress and jar math stay exact.
 *
 * Jar math is derived, never stored:
 *   unallocated = earned − (save + spend + give)
 * Legacy pending save/give requests (pre-R2 flow) are ignored by the jars
 * until a parent approves or rejects them in the Approvals panel — the data
 * model is migrated, not broken.
 */

import type { BankTransaction, SavingsGoal } from "@/lib/types";

/** The three kid jars. */
export type KidJarKey = "save" | "spend" | "give";

export const KID_JAR_KEYS: KidJarKey[] = ["save", "spend", "give"];

/**
 * Guardrails a parent sets UPFRONT (stored additively on ParentProfile).
 * The kid then moves money freely inside these rails — no per-move approval.
 */
export type KidBankSettings = {
  /** Max dollars a kid may move into a jar in a single tap. 0 = no cap. */
  maxSingleJarMove: number;
  /** Max dollars the Spend jar may hold at once. 0 = no cap. */
  spendJarCap: number;
  /** Kid can undo their own jar moves from the money-story list. */
  allowKidUndo: boolean;
};

export const defaultKidBankSettings: KidBankSettings = {
  maxSingleJarMove: 25,
  spendJarCap: 0,
  allowKidUndo: true,
};

/** Derived per-kid balances. Everything is computed from approved transactions. */
export type JarBalances = {
  /** Gross approved earnings (parent-approved jobs + point conversions). */
  earned: number;
  /** Approved dollars the kid put in the SAVE jar (includes negative reversals). */
  save: number;
  /** Approved dollars the kid put in the SPEND jar. */
  spend: number;
  /** Approved dollars the kid put in the GIVE jar. */
  give: number;
  /** Not yet sorted into a jar: earned − (save + spend + give). */
  unallocated: number;
};

function sumApproved(transactions: BankTransaction[], childId: string, category: BankTransaction["category"]): number {
  return transactions
    .filter((tx) => tx.childId === childId && tx.status === "approved" && tx.category === category)
    .reduce((total, tx) => total + tx.amount, 0);
}

/** Compute a kid's jar balances. Pending requests never count — only approved money. */
export function kidJarBalances(childId: string, transactions: BankTransaction[]): JarBalances {
  const earned = sumApproved(transactions, childId, "earn");
  const save = sumApproved(transactions, childId, "save");
  const spend = sumApproved(transactions, childId, "spend");
  const give = sumApproved(transactions, childId, "give");
  const unallocated = Math.max(0, earned - save - spend - give);
  return { earned, save, spend, give, unallocated };
}

/** Fill percent for the liquid animation. scale = the tallest jar (min 25) so jars stay comparable. */
export function jarFillPercent(balance: number, scale: number): number {
  if (balance <= 0) return 0;
  const safeScale = Math.max(25, scale, balance);
  return Math.min(100, Math.max(10, (balance / safeScale) * 100));
}

export type JarMoveRequest = {
  category: KidJarKey;
  amount: number;
  goalId?: string;
};

/**
 * Kid-friendly reason a jar move is blocked, or null when the move is fine.
 * Guardrail copy is written for the kid reading over a parent's shoulder.
 */
export function jarMoveGuardrails(args: {
  balances: JarBalances;
  settings: KidBankSettings;
  request: JarMoveRequest;
}): string | null {
  const { balances, settings, request } = args;
  const amount = Math.floor(request.amount);
  if (!Number.isFinite(amount) || amount < 1) return "Pick at least $1 to move.";
  if (amount > balances.unallocated) return `That's more than your $${balances.unallocated} waiting to be sorted.`;
  if (settings.maxSingleJarMove > 0 && amount > settings.maxSingleJarMove) {
    return `One move can be $${settings.maxSingleJarMove} at most — a grown-up set that limit.`;
  }
  if (request.category === "spend" && settings.spendJarCap > 0 && balances.spend + amount > settings.spendJarCap) {
    return `Your Spend jar can hold $${settings.spendJarCap} at most — spend some with your family first!`;
  }
  return null;
}

/** Kid-friendly description for a jar-move transaction. */
export function jarMoveDescription(request: JarMoveRequest, childName: string): string {
  const jarName = request.category === "save" ? "SAVE" : request.category === "spend" ? "SPEND" : "GIVE";
  return `${childName} put $${request.amount} in the ${jarName} jar`;
}

/**
 * Build the approved transaction for a kid's jar move. status is "approved"
 * immediately — the decided flow has NO second parent approval.
 */
export function buildJarMoveTx(childId: string, request: JarMoveRequest, childName: string, txId: string): BankTransaction {
  return {
    id: txId,
    childId,
    category: request.category,
    amount: Math.floor(request.amount),
    goalId: request.goalId,
    description: jarMoveDescription({ ...request, amount: Math.floor(request.amount) }, childName),
    status: "approved",
  };
}

/**
 * Exact reversal of a kid's own jar move: same category, same goalId, negative
 * amount. Applying it (and decrementing goal progress by the same amount)
 * restores the balances precisely.
 */
export function reverseJarMove(tx: BankTransaction, undoTxId: string): BankTransaction {
  return {
    id: undoTxId,
    childId: tx.childId,
    category: tx.category,
    amount: -tx.amount,
    goalId: tx.goalId,
    description: `Undone: $${tx.amount} back to the bank`,
    status: "approved",
  };
}

/** Only the kid's own approved jar moves (save/spend/give, positive amounts) can be undone. */
export function isUndoableJarMove(tx: BankTransaction, childId: string): boolean {
  return (
    tx.childId === childId &&
    tx.status === "approved" &&
    (tx.category === "save" || tx.category === "spend" || tx.category === "give") &&
    tx.amount > 0
  );
}

/** Dollars a kid's points are worth at the parent-set rate (whole dollars only). */
export function pointsToDollars(points: number, pointsPerDollar: number): { dollars: number; pointsUsed: number } {
  const rate = Math.max(1, Math.floor(pointsPerDollar) || 20);
  const dollars = Math.floor(Math.max(0, points) / rate);
  return { dollars, pointsUsed: dollars * rate };
}

/* ------------------------------------------------------------------ */
/* Drives (school PTO / neighborhood / animal-shelter giving goals)    */
/* ------------------------------------------------------------------ */

/** Drive kinds a parent can enroll a kid in. Derived from causeNote — no schema change. */
export type DriveKind = "pto" | "neighborhood" | "shelter" | "kindness" | "save";

export const DRIVE_KIND_META: Record<Exclude<DriveKind, "save">, { label: string; emoji: string; causeNote: string }> = {
  pto: { label: "School PTO drive", emoji: "🏫", causeNote: "School PTO drive" },
  neighborhood: { label: "Neighborhood drive", emoji: "🏘️", causeNote: "Neighborhood drive" },
  shelter: { label: "Animal shelter drive", emoji: "🐾", causeNote: "Animal shelter drive" },
  kindness: { label: "Other kindness", emoji: "💛", causeNote: "Other kindness" },
};

/** Map a goal to its drive kind from its causeNote text. */
export function driveKindFromGoal(goal: Pick<SavingsGoal, "type" | "causeNote">): DriveKind {
  if (goal.type !== "donation") return "save";
  const note = (goal.causeNote ?? "").toLowerCase();
  if (note.includes("pto") || note.includes("classroom")) return "pto";
  if (note.includes("neighborhood")) return "neighborhood";
  if (note.includes("shelter") || note.includes("rescue")) return "shelter";
  return "kindness";
}

/** Donation goals visible on the kid side: the kid's own + shared family drives. */
export function kidVisibleDrives(childId: string, goals: SavingsGoal[], isParentView: boolean): SavingsGoal[] {
  return goals.filter(
    (goal) =>
      goal.type === "donation" &&
      (isParentView || goal.visibleToKids !== false) &&
      (goal.childId === childId || (goal.sharedWithTrustedFamilies && goal.childId !== childId)),
  );
}

/** The drive to feature on the GIVE jar ring: the most-funded incomplete drive, else the newest. */
export function featuredDrive(drives: SavingsGoal[]): SavingsGoal | undefined {
  const open = drives.filter((goal) => !goal.completedAt);
  const pool = open.length ? open : drives;
  return [...pool].sort((a, b) => b.saved / Math.max(1, b.target) - a.saved / Math.max(1, a.target))[0];
}

/** Progress 0..1 for a drive. */
export function driveProgress(goal: SavingsGoal): number {
  return Math.min(1, Math.max(0, goal.saved / Math.max(1, goal.target)));
}
