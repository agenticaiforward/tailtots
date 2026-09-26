/**
 * Seed content and shared constants for the family domain.
 *
 * Pure data: no I/O, no React, safe to import from tests, the Alexa skill
 * docs, or anywhere else. Avatar visuals live in
 * `app/components/tailtots/avatar-looks.ts` (presentation layer).
 */
import type {
  BankTransaction,
  Child,
  LevelKey,
  MemoryMoment,
  Mission,
  Pet,
  SavingsGoal,
} from "@/lib/types";
import type {
  BadgeAward,
  KidScheduleItem,
  NeighborhoodJob,
  ParentProfile,
  SavedFamilyState,
} from "./family-types";

export const levelLabels: Record<LevelKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  super_hard: "Super Hard",
};

export const difficultyAgeGuidance: Record<LevelKey, { minAge: number; label: string }> = {
  easy: { minAge: 4, label: "Ages 4+" },
  medium: { minAge: 7, label: "Ages 7+" },
  hard: { minAge: 10, label: "Ages 10+" },
  super_hard: { minAge: 13, label: "Ages 13+" },
};

export const starterChildren: Child[] = [
  { id: "sahasra", name: "Sahasra", age: 6, secretCode: "", points: 180, coins: 26, level: "medium", streakDays: 5 },
  { id: "aarush", name: "Aarush", age: 9, secretCode: "", points: 72, coins: 14, level: "easy", streakDays: 2 },
];

export const starterPets: Pet[] = [
  {
    id: "jack",
    name: "Jack",
    species: "Guinea pig",
    favoriteFood: "Romaine",
    careNotes: "Fresh hay, clean cage corners, quiet handling.",
    vet: "Green Trail Vet",
    medicine: "None",
  },
  {
    id: "jamie",
    name: "Jamie",
    species: "Guinea pig",
    favoriteFood: "Bell pepper",
    careNotes: "Check water bottle, refill hay, and keep the bedding dry.",
    vet: "Family Pet Clinic",
    medicine: "None",
  },
  {
    id: "captain",
    name: "Captain",
    species: "Tortoise",
    favoriteFood: "Leafy greens",
    careNotes: "Fresh greens, clean water, and a warm basking spot.",
    vet: "Exotic Pet Clinic",
    medicine: "None",
  },
  {
    id: "rb",
    name: "RB",
    species: "Fish",
    favoriteFood: "Fish flakes",
    careNotes: "Feed a small pinch and check that the water looks clear.",
    vet: "Aquatic care store",
    medicine: "None",
  },
];

export const starterParents: ParentProfile[] = [{ id: "parent-1", name: "Parent" }];

export const starterMissions: Mission[] = [
  {
    id: "feed-jack",
    title: "Feed Jack breakfast",
    category: "pet_care",
    difficulty: "easy",
    points: 12,
    coins: 2,
    allowanceDollars: 0,
    assignedChildId: "aarush",
    petId: "jack",
    question: "Did Jack get fresh food, hay, and water?",
    status: "pending",
  },
  {
    id: "clean-jamie",
    title: "Clean Jamie's cage corner",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    allowanceDollars: 1,
    assignedChildId: "aarush",
    petId: "jamie",
    question: "What did you notice that made Jamie more comfortable?",
    status: "pending",
  },
  {
    id: "check-captain",
    title: "Check Captain's basking spot",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    allowanceDollars: 1,
    assignedChildId: "aarush",
    petId: "captain",
    question: "Was Captain's light, water, and greens ready?",
    status: "pending",
  },
  {
    id: "feed-rb",
    title: "Feed RB",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    allowanceDollars: 0,
    assignedChildId: "sahasra",
    petId: "rb",
    question: "Did RB get a small pinch of food?",
    status: "pending",
  },
  {
    id: "water-plants",
    title: "Water front plants with parent check",
    category: "chore",
    difficulty: "medium",
    points: 18,
    coins: 4,
    allowanceDollars: 3,
    assignedChildId: "aarush",
    question: "Were the plants watered gently and did a parent check the area?",
    status: "pending",
  },
  {
    id: "kind-note",
    title: "Kindness check-in",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 0,
    allowanceDollars: 0,
    assignedChildId: "sahasra",
    question: "How did you know your pet felt safe or happy today?",
    status: "pending",
  },
];

export const starterGoals: SavingsGoal[] = [
  { id: "goal-1", childId: "sahasra", title: "Guinea pig tunnel", target: 24, saved: 15, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Helping Jack and Jamie get more enrichment." },
  { id: "goal-2", childId: "aarush", title: "Fish tank plant", target: 20, saved: 6, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Making RB's tank healthier and more fun." },
];

export const starterTransactions: BankTransaction[] = [
  { id: "tx-1", childId: "sahasra", category: "earn", amount: 3, description: "Earned from approved pet care missions", status: "approved" },
  { id: "tx-2", childId: "aarush", category: "save", amount: 2, description: "Save $2 for Fish tank plant", goalId: "goal-2", status: "pending" },
];

export const starterMoments: MemoryMoment[] = [
  { id: "moment-1", childId: "sahasra", petId: "jack", mood: "proud", note: "Jack waited calmly while Sahasra filled the water bowl." },
];

export const starterBadges: BadgeAward[] = [
  { id: "badge-1", childId: "sahasra", title: "Gentle Hands", skill: "empathy", note: "Stayed calm and gentle during Jack's water refill.", awardedAt: "Today" },
  { id: "badge-2", childId: "aarush", title: "On-Time Helper", skill: "time", note: "Remembered RB's breakfast before school.", awardedAt: "Today" },
];

export const starterNeighborhoodJobs: NeighborhoodJob[] = [
  {
    id: "job-milo",
    title: "Care visit for Milo",
    family: "Patel family",
    pet: "Milo the rabbit",
    time: "Tuesday, 4:30 PM",
    rewardDollars: 4,
    badgeTitle: "Kind Neighbor",
    assignedChildIds: ["sahasra", "aarush"],
    visibleToKids: false,
    checklist: ["Refill hay", "Check water bottle", "Send parent photo"],
    safety: "Parent stays nearby; no cage cleaning yet.",
    minAge: 8,
    skillFocus: "empathy",
    trustSignals: ["parent_gate", "age_fit", "adult_nearby", "private_child"],
    status: "posted",
  },
  {
    id: "job-sunny",
    title: "Morning check for Sunny",
    family: "Garcia family",
    pet: "Sunny the parakeet",
    time: "Saturday morning",
    rewardDollars: 0,
    badgeTitle: "Careful Observer",
    assignedChildIds: ["sahasra"],
    visibleToKids: false,
    checklist: ["Look at water cup", "Check food level", "Tell parent if cage looks messy"],
    safety: "No handling the bird; adult opens cage only.",
    minAge: 10,
    skillFocus: "responsibility",
    trustSignals: ["parent_gate", "age_fit", "no_messaging", "private_child"],
    status: "posted",
  },
];

export const starterScheduleItems: KidScheduleItem[] = [
  { id: "schedule-sahasra-1", childId: "sahasra", day: "Today", time: "7:30 AM", title: "RB breakfast check", kind: "pet", note: "Small pinch of food, then tell parent." },
  { id: "schedule-sahasra-2", childId: "sahasra", day: "Today", time: "5:45 PM", title: "Gentle pet moment", kind: "pet", note: "Notice one kind thing about Jack or Jamie." },
  { id: "schedule-sahasra-3", childId: "sahasra", day: "Wednesday", time: "4:30 PM", title: "Drawing and quiet pet time", kind: "hobby", note: "Draw one pet care idea after homework." },
  { id: "schedule-aarush-1", childId: "aarush", day: "Today", time: "7:15 AM", title: "Jack food and water", kind: "pet", note: "Check hay, food, and water before school." },
  { id: "schedule-aarush-2", childId: "aarush", day: "Saturday", time: "10:00 AM", title: "Plant helper round", kind: "family", note: "Water plants with parent check." },
  { id: "schedule-aarush-3", childId: "aarush", day: "Thursday", time: "5:00 PM", title: "Pet passport update", kind: "pet", note: "Add one observation about Captain or RB." },
];

export const familyStats = [
  ["Care rhythm", 88, "#f47b20"],
  ["Pet comfort", 91, "#0f766e"],
  ["Kid confidence", 86, "#2563eb"],
];

export const tabItems = [
  { id: "vision", label: "Vision" },
  { id: "missions", label: "Today" },
  { id: "schedule", label: "Schedule" },
  { id: "hub", label: "Home Hub" },
  { id: "pets", label: "Pet Passports" },
  { id: "pet-helper", label: "Pet Helper" },
  { id: "bank", label: "Kid Bank" },
  { id: "approvals", label: "Parent Review" },
  { id: "setup", label: "Family Setup" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "growth", label: "Growth Log" },
  { id: "ai", label: "AI" },
  { id: "ecosystem", label: "Ecosystem" },
];

export const kidTabIds = ["missions", "schedule", "hub", "pets", "pet-helper", "bank", "neighborhood", "growth"];
export const parentTabIds = ["vision", "approvals", "schedule", "hub", "pets", "neighborhood", "growth", "ai", "ecosystem"];

/**
 * The passcode shipped for first-run demos. It is a UI-level parent gate,
 * not a security boundary: anyone with the code (or the source) can open
 * parent screens. Real enforcement must live server-side (Supabase Auth +
 * RLS). See SECURITY.md.
 */
export const defaultParentPasscode = "4321";

export const savedFamilyStateKey = "tailtots-family-state-v1";
export const legacySavedFamilyStateKey = "pawpal-family-state-v1";

export const blankRealFamilyState: SavedFamilyState = {
  familyName: "My Family",
  parentPasscode: defaultParentPasscode,
  parents: [{ id: "parent-1", name: "Parent" }],
  children: [],
  pets: [],
  missions: [],
  transactions: [],
  goals: [],
  badges: [],
  neighborhoodJobs: [],
  moments: [],
  familyPhotoUrl: undefined,
  activeChildId: "",
  readinessSignOffs: [],
};
