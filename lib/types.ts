export type LevelKey = "easy" | "medium" | "hard" | "super_hard";
export type Role = "parent" | "child";
export type BankCategory = "earn" | "save" | "spend" | "give";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Child = {
  id: string;
  name: string;
  age: number;
  secretCode: string;
  photoUrl?: string;
  points: number;
  coins: number;
  level: LevelKey;
  streakDays: number;
  /** Local YYYY-MM-DD of the last day a streak was extended. Powers true per-day streaks. */
  lastStreakDate?: string;
};

export type Pet = {
  id: string;
  name: string;
  species: string;
  favoriteFood: string;
  careNotes: string;
  vet: string;
  medicine: string;
  photoUrl?: string;
};

export type Mission = {
  id: string;
  title: string;
  category: "pet_care" | "chore" | "kindness" | "money" | "community";
  difficulty: LevelKey;
  points: number;
  coins: number;
  allowanceDollars?: number;
  assignedChildId?: string;
  petId?: string;
  question: string;
  status: ApprovalStatus;
  completedBy?: string;
  note?: string;
};

export type BankTransaction = {
  id: string;
  childId: string;
  category: BankCategory;
  amount: number;
  description: string;
  activityId?: string;
  goalId?: string;
  status: ApprovalStatus;
};

export type SavingsGoal = {
  id: string;
  childId: string;
  title: string;
  target: number;
  saved: number;
  type: "toy" | "pet_food" | "treats" | "donation" | "family_reward";
  sharedWithTrustedFamilies?: boolean;
  causeNote?: string;
  /** Parent-funded seed dollars added when a giving goal is created. */
  seededByParent?: number;
  /** ISO date when saved first reached target. */
  completedAt?: string;
  /** ISO date when a parent confirmed the real-world donation happened. */
  donationConfirmedAt?: string;
};

export type MemoryMoment = {
  id: string;
  childId: string;
  petId?: string;
  mood: "kind" | "silly" | "cranky" | "proud" | "helper";
  note: string;
};
