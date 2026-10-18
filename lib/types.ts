export type LevelKey = "easy" | "medium" | "hard" | "super_hard";
export type Role = "parent" | "child";
export type BankCategory = "earn" | "save" | "spend" | "give";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/** Character-curriculum trait keys (see lib/character-curriculum.ts). */
export type CharacterTraitKey = "responsibility" | "empathy" | "kindness" | "leadership";

export type Child = {
  id: string;
  /**
   * COPPA/GDPR data minimization: kid sub-profiles carry a nickname/first name
   * and age ONLY. Never store surnames, birthdates, addresses, school names,
   * or contact info on a child record. photoUrl is parent-uploaded with
   * parental consent; secretCode powers the parent-gated kid sign-in.
   */
  name: string;
  age: number;
  secretCode: string;
  /**
   * Parent-set gate for the kid profile: chosen by the parent at profile
   * creation or later from Parent Review. Local-only (never synced to the
   * cloud row); additive and optional.
   */
  passcode?: string;
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

/**
 * RealLifeEntry — a real-world thing the kid actually did, logged by the kid
 * (picture-first) or parent: a book they read (with title), a chore they did,
 * a kind act, a skill they practiced. The AI mission engine and insights
 * reference these real experiences when teaching traits — "you finished
 * 'Charlotte's Web', that's perseverance like Wilbur" — and ask reflective
 * questions tied to them. Real life is the curriculum; AI connects the dots.
 */
export type RealLifeEntry = {
  id: string;
  childId: string;
  kind: "book" | "chore" | "kind-act" | "skill" | "reflection";
  /** Book title, chore name, or short label — the kid's own words. */
  title: string;
  /** Optional extra: author, what they did, who it helped. */
  detail?: string;
  /** Local YYYY-MM-DD when it happened. */
  date: string;
  /** Traits this experience evidences — suggested by AI, confirmed by parent. */
  traits?: string[];
  /** A reflective question the AI asked about this entry (kid answers verbally/with parent). */
  wonderQuestion?: string;
};

/**
 * ParentCheckIn — the parent's weekly voice interview (Oct 17, 2026):
 * three spoken answers (a win, a watch-out, one practice focus), saved
 * with the family state and shown back to the parent. Text only — the
 * audio is never stored.
 */
export type ParentCheckIn = {
  id: string;
  /** Local YYYY-MM-DD of the check-in. */
  date: string;
  win: string;
  worry: string;
  practice: string;
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
  /** Parent control: when false, the mission is hidden from kid views. Defaults to visible. */
  visibleToKids?: boolean;
  /**
   * Character-curriculum tag. Set when the mission was instantiated from a
   * curriculum level pack (lib/character-curriculum.ts). Level completion is
   * derived from approved curriculum-tagged missions — no separate progress
   * table needed. Survives localStorage and the snapshot blob; the relational
   * tasks table does not carry it (progress re-derives from level badges).
   */
  curriculum?: {
    trait: CharacterTraitKey;
    /** 0-based level index (0 = Sprout, 1 = Grow, 2 = Flourish). */
    level: number;
    /** Template key within the level pack, e.g. "resp-s1-water". */
    missionKey: string;
  };
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
  createdAt?: string;
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
  /** Parent control: when false, the goal is hidden from kid views. Defaults to visible. */
  visibleToKids?: boolean;
};

export type MemoryMoment = {
  id: string;
  childId: string;
  petId?: string;
  mood: "kind" | "silly" | "cranky" | "proud" | "helper";
  note: string;
};
