"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";
import {
  isSupabaseConfigured,
  loadFamilyAccountSnapshot,
  saveFamilyAccountSnapshot,
  sendParentMagicLink,
  signOutParentAccount,
  submitFeedback,
  submitLaunchInterest,
  supabase,
} from "@/lib/supabase";
import type {
  BankCategory,
  BankTransaction,
  Child,
  LevelKey,
  MemoryMoment,
  Mission,
  Pet,
  Role,
  SavingsGoal,
} from "@/lib/types";
import {
  ensureFamilyForCurrentUser,
  pullFamilyState,
  pushFamilyState,
  type FamilySyncState,
} from "@/lib/family-cloud";

const levelLabels: Record<LevelKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  super_hard: "Super Hard",
};

const difficultyAgeGuidance: Record<LevelKey, { minAge: number; label: string }> = {
  easy: { minAge: 4, label: "Ages 4+" },
  medium: { minAge: 7, label: "Ages 7+" },
  hard: { minAge: 10, label: "Ages 10+" },
  super_hard: { minAge: 13, label: "Ages 13+" },
};

const starterChildren: Child[] = [
  { id: "sahasra", name: "Maya", age: 6, secretCode: "", points: 180, coins: 26, level: "medium", streakDays: 5, photoUrl: "/demo-faces/maya.jpg" },
  { id: "aarush", name: "Leo", age: 9, secretCode: "", points: 72, coins: 14, level: "easy", streakDays: 2, photoUrl: "/demo-faces/leo.jpg" },
];

const starterPets: Pet[] = [
  {
    id: "jack",
    name: "Jack",
    species: "Guinea pig",
    favoriteFood: "Romaine",
    careNotes: "Fresh hay, clean cage corners, quiet handling.",
    vet: "Green Trail Vet",
    medicine: "None",
    photoUrl: "/demo-faces/pets/jack.jpg",
  },
  {
    id: "jamie",
    name: "Jamie",
    species: "Guinea pig",
    favoriteFood: "Bell pepper",
    careNotes: "Check water bottle, refill hay, and keep the bedding dry.",
    vet: "Family Pet Clinic",
    medicine: "None",
    photoUrl: "/demo-faces/pets/jamie.jpg",
  },
  {
    id: "captain",
    name: "Captain",
    species: "Tortoise",
    favoriteFood: "Leafy greens",
    careNotes: "Fresh greens, clean water, and a warm basking spot.",
    vet: "Exotic Pet Clinic",
    medicine: "None",
    photoUrl: "/demo-faces/pets/captain.jpg",
  },
  {
    id: "rb",
    name: "RB",
    species: "Fish",
    favoriteFood: "Fish flakes",
    careNotes: "Feed a small pinch and check that the water looks clear.",
    vet: "Aquatic care store",
    medicine: "None",
    photoUrl: "/demo-faces/pets/rb.jpg",
  },
];

type ParentProfile = {
  id: string;
  name: string;
  photoUrl?: string;
};

type PhotoCropDraft = {
  targetType: "parent" | "child" | "pet";
  targetId: string;
  label: string;
  imageUrl: string;
  fit: "cover" | "contain";
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels?: Area;
};

type PhotoCropTarget = Pick<PhotoCropDraft, "targetType" | "targetId" | "label" | "fit">;
type LifeSkillKey = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";
type TrustSignalKey = "parent_gate" | "age_fit" | "no_messaging" | "adult_nearby" | "private_child";

type BadgeAward = {
  id: string;
  childId: string;
  title: string;
  skill: LifeSkillKey;
  note: string;
  awardedAt: string;
};

type NeighborhoodJob = {
  id: string;
  title: string;
  family: string;
  pet: string;
  time: string;
  rewardDollars: number;
  badgeTitle: string;
  assignedChildIds: string[];
  visibleToKids: boolean;
  checklist: string[];
  safety: string;
  minAge?: number;
  skillFocus?: LifeSkillKey;
  trustSignals?: TrustSignalKey[];
  status: "posted" | "accepted" | "approved" | "completed";
  acceptedBy?: string;
  missionId?: string;
  /**
   * Parent-side only: the parent recorded sending a thank-you/response to the
   * posting parent after approving completion. Local-only (no cloud column).
   * The message is always anonymized — "a neighborhood family", never kid PII.
   */
  posterThanked?: boolean;
};

type KidScheduleItem = {
  id: string;
  childId: string;
  day: string;
  time: string;
  title: string;
  kind: "pet" | "school" | "family" | "hobby";
  note: string;
};

const starterParents: ParentProfile[] = [{ id: "parent-1", name: "Parent", photoUrl: "/demo-faces/parent.jpg" }];

const starterMissions: Mission[] = [
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

const starterGoals: SavingsGoal[] = [
  { id: "goal-1", childId: "sahasra", title: "Guinea pig tunnel", target: 24, saved: 15, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Helping Jack and Jamie get more enrichment." },
  { id: "goal-2", childId: "aarush", title: "Fish tank plant", target: 20, saved: 6, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Making RB's tank healthier and more fun." },
];

const starterTransactions: BankTransaction[] = [
  { id: "tx-1", childId: "sahasra", category: "earn", amount: 3, description: "Earned from approved pet care missions", status: "approved" },
  { id: "tx-2", childId: "aarush", category: "save", amount: 2, description: "Save $2 for Fish tank plant", goalId: "goal-2", status: "pending" },
];

const starterMoments: MemoryMoment[] = [
  { id: "moment-1", childId: "sahasra", petId: "jack", mood: "proud", note: "Jack waited calmly while Maya filled the water bowl." },
];

const starterBadges: BadgeAward[] = [
  { id: "badge-1", childId: "sahasra", title: "Gentle Hands", skill: "empathy", note: "Stayed calm and gentle during Jack's water refill.", awardedAt: "Today" },
  { id: "badge-2", childId: "aarush", title: "On-Time Helper", skill: "time", note: "Remembered RB's breakfast before school.", awardedAt: "Today" },
];

const starterNeighborhoodJobs: NeighborhoodJob[] = [
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

const starterScheduleItems: KidScheduleItem[] = [
  { id: "schedule-sahasra-1", childId: "sahasra", day: "Today", time: "7:30 AM", title: "RB breakfast check", kind: "pet", note: "Small pinch of food, then tell parent." },
  { id: "schedule-sahasra-2", childId: "sahasra", day: "Today", time: "5:45 PM", title: "Gentle pet moment", kind: "pet", note: "Notice one kind thing about Jack or Jamie." },
  { id: "schedule-sahasra-3", childId: "sahasra", day: "Wednesday", time: "4:30 PM", title: "Drawing and quiet pet time", kind: "hobby", note: "Draw one pet care idea after homework." },
  { id: "schedule-aarush-1", childId: "aarush", day: "Today", time: "7:15 AM", title: "Jack food and water", kind: "pet", note: "Check hay, food, and water before school." },
  { id: "schedule-aarush-2", childId: "aarush", day: "Saturday", time: "10:00 AM", title: "Plant helper round", kind: "family", note: "Water plants with parent check." },
  { id: "schedule-aarush-3", childId: "aarush", day: "Thursday", time: "5:00 PM", title: "Pet passport update", kind: "pet", note: "Add one observation about Captain or RB." },
];

const childLooks: Record<string, { initial: string; colors: string; joy: number; love: number; hair: string }> = {
  sahasra: { initial: "M", colors: "from-[#ffcf70] via-[#ff8a65] to-[#6d3ed1]", joy: 92, love: 88, hair: "#4a2718" },
  aarush: { initial: "L", colors: "from-[#79d6ff] via-[#4ade80] to-[#2563eb]", joy: 78, love: 84, hair: "#1f2937" },
};

const petLooks: Record<string, { face: string; colors: string; happiness: number; loved: number; kind: PetKind }> = {
  jack: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 94, loved: 91, kind: "guinea" },
  jamie: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 83, loved: 89, kind: "guinea" },
  captain: { face: "C", colors: "from-[#86efac] via-[#65a30d] to-[#365314]", happiness: 88, loved: 90, kind: "tortoise" },
  rb: { face: "R", colors: "from-[#93c5fd] via-[#06b6d4] to-[#2563eb]", happiness: 86, loved: 87, kind: "fish" },
};

/** Illustrated storybook pet portraits. Shown whenever the family hasn't captured a real photo yet. */
const PET_PORTRAITS: Partial<Record<PetKind, string>> = {
  guinea: "/pets/pet-guinea-pig.png",
  tortoise: "/pets/pet-tortoise.png",
  fish: "/pets/pet-fish.png",
  dog: "/pets/pet-dog.png",
  cat: "/pets/pet-cat.png",
};

/** Guess a pet kind from free-text species so user-added pets get the right portrait. */
function inferPetKind(species?: string): PetKind {
  const s = (species ?? "").toLowerCase();
  if (s.includes("guinea")) return "guinea";
  if (s.includes("tortoise") || s.includes("turtle")) return "tortoise";
  if (s.includes("fish")) return "fish";
  if (s.includes("dog") || s.includes("puppy")) return "dog";
  if (s.includes("cat") || s.includes("kitten")) return "cat";
  if (s.includes("rabbit") || s.includes("bunny")) return "rabbit";
  if (s.includes("hamster")) return "hamster";
  if (s.includes("bird") || s.includes("parrot") || s.includes("budgie") || s.includes("cockatiel")) return "bird";
  return "pet";
}

/** Illustrated portrait for a pet kind, or undefined when only the CSS-drawn fallback exists. */
function petPortraitForKind(kind: PetKind): string | undefined {
  return PET_PORTRAITS[kind];
}

/**
 * Live pet mood + growth stage from real approved care missions.
 * The pet visibly thrives because the kid did real things — the anti-fade engine.
 */
function getPetCareStats(petId: string, missions: Mission[]): {
  approved: number;
  happiness: number;
  loved: number;
  mood: string;
  stage: string;
  stageRing: string;
} {
  const approved = missions.filter((m) => m.petId === petId && (m.status === "approved" || Boolean(m.completedBy))).length;
  const happiness = Math.min(98, 60 + approved * 5);
  const loved = Math.min(98, 66 + approved * 4);
  const mood = approved === 0 ? "Waiting to meet you" : approved < 5 ? "Warming up" : approved < 15 ? "Happy" : "Thriving";
  const stage = approved < 5 ? "New buddy" : approved < 15 ? "Rising star" : approved < 30 ? "Superstar" : "Legend";
  const stageRing = approved < 5 ? "ring-[#d8cfc0]" : approved < 15 ? "ring-[#d97706]" : approved < 30 ? "ring-[#94a3b8]" : "ring-[#f4b400]";
  return { approved, happiness, loved, mood, stage, stageRing };
}

const tabItems = [
  { id: "vision", label: "Vision" },
  { id: "missions", label: "Today" },
  { id: "schedule", label: "Schedule" },
  { id: "pets", label: "Pet Passports" },
  { id: "pet-helper", label: "AI Buddy" },
  { id: "bank", label: "Kid Bank" },
  { id: "approvals", label: "Parent Review" },
  { id: "setup", label: "Family Setup" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "growth", label: "Growth Log" },
  { id: "ai", label: "AI" },
];

const kidTabIds = ["missions", "schedule", "pets", "pet-helper", "bank", "neighborhood"];
const parentTabIds = ["vision", "approvals", "setup", "schedule", "pets", "neighborhood", "growth", "ai"];
const defaultParentPasscode = "4321";

const savedFamilyStateKey = "tailtots-family-state-v1";
const legacySavedFamilyStateKey = "pawpal-family-state-v1";

type SavedFamilyState = {
  familyName?: string;
  parentPasscode?: string;
  parents: ParentProfile[];
  children: Child[];
  pets: Pet[];
  missions?: Mission[];
  transactions?: BankTransaction[];
  goals?: SavingsGoal[];
  badges?: BadgeAward[];
  neighborhoodJobs?: NeighborhoodJob[];
  moments?: MemoryMoment[];
  studiedAnimals?: string[];
  socialPracticeDone?: Record<string, string[]>;
  certificates?: Certificate[];
  familyPhotoUrl?: string;
  activeChildId?: string;
  pointsPerDollar?: number;
  dailyChecksEnabled?: boolean;
  maxDailyChecks?: number;
  familyZip?: string;
};

/** An earned end-of-journey honor. One per child; a readiness certificate can upgrade to hero. */
type CertificateKind = "readiness" | "hero";
type Certificate = {
  id: string;
  childId: string;
  kind: CertificateKind;
  title: string;
  earnedAt: string; // ISO date string
};

const CERT_REQUIREMENTS = {
  readiness: { missions: 12, streak: 7, skills: 3 },
  hero: { missions: 20, streak: 14, skills: 3 },
} as const;

function certificateTitleFor(kind: CertificateKind): string {
  return kind === "hero" ? "Certified Pet Hero" : "Pet Readiness Certificate";
}

/** Self-contained printable certificate document (downloadable, shareable). */
function buildCertificateHtml(child: Child, cert: Certificate, familyName: string): string {
  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const childName = escapeHtml(child.name);
  const family = escapeHtml(familyName);
  const earnedDate = new Date(cert.earnedAt);
  const dateLabel = Number.isNaN(earnedDate.getTime())
    ? cert.earnedAt
    : earnedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const line = cert.kind === "hero"
    ? "for real pet care, proven over time — feeding, water, comfort, and responsibility, parent-approved"
    : "for completing the pet-care journey — learning the animal, owning the routine, and proving it over time";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>${cert.title} — ${childName}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; background: #faf8f0; display: flex; justify-content: center; padding: 48px 16px; margin: 0; }
  .cert { background: #fff; border: 6px double #6d3ed1; border-radius: 24px; max-width: 640px; width: 100%; padding: 56px 48px; text-align: center; }
  .kicker { font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #6d3ed1; font-weight: bold; }
  h1 { font-size: 40px; margin: 12px 0 4px; color: #17231f; }
  .name { font-size: 32px; font-weight: bold; color: #6d3ed1; margin: 16px 0 4px; }
  .family { font-size: 16px; color: #4f625b; }
  p.body { font-size: 17px; line-height: 1.7; color: #17231f; margin: 24px 0; }
  .date { font-size: 14px; color: #4f625b; margin-top: 24px; }
  .paws { font-size: 32px; margin-top: 16px; letter-spacing: 12px; }
  @media print { body { background: #fff; padding: 0; } .cert { border-width: 8px; } }
</style></head>
<body><div class="cert">
  <div class="kicker">TailTots · Official</div>
  <h1>${cert.title}</h1>
  <div class="name">${childName}</div>
  <div class="family">of the ${family} family</div>
  <p class="body">This certifies that <strong>${childName}</strong> earned this honor on ${dateLabel}, ${line}.</p>
  <div class="paws">🎓 🐾 ⭐</div>
  <div class="date">Awarded ${dateLabel} · tailtots.com</div>
</div></body></html>`;
}

function downloadCertificate(child: Child, cert: Certificate, familyName: string) {
  const blob = new Blob([buildCertificateHtml(child, cert, familyName)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${cert.title.replace(/[^a-z0-9]+/gi, "-")}-${child.name.replace(/[^a-z0-9]+/gi, "-")}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * True per-day streak: approving several missions on the same day counts once;
 * a missed day resets the streak to 1. Children saved before streak dates
 * existed keep their displayed streak once (legacy data assumed daily activity).
 */
function applyDailyStreak(child: Child, today = localDayKey()): Child {
  if (child.lastStreakDate === today) return child;
  const yesterday = localDayKey(new Date(Date.now() - 86400000));
  const continued = child.lastStreakDate === yesterday || (child.lastStreakDate == null && child.streakDays > 0);
  return { ...child, streakDays: continued ? child.streakDays + 1 : 1, lastStreakDate: today };
}

/**
 * Dollars in a goal that came from the kid's own earnings. Parent seed money
 * is family generosity, not the kid's wallet — it must never reduce the
 * child's spendable balance.
 */
function goalKidSaved(goal: SavingsGoal): number {
  return Math.max(0, goal.saved - (goal.seededByParent ?? 0));
}

/**
 * Add dollars to a goal and stamp completion the moment it is fully funded.
 */
function withGoalProgress(goal: SavingsGoal, added: number, now = new Date().toISOString()): SavingsGoal {  const saved = Math.min(goal.target, goal.saved + added);
  return {
    ...goal,
    saved,
    completedAt: goal.completedAt ?? (saved >= goal.target ? now : undefined),
  };
}

/**
 * ID-based merge of pulled relational rows over local state. Relational
 * columns win; snapshot-only fields (no DB column yet) are preserved from the
 * local copy so a cloud pull never wipes photos, questions, causes, or
 * parent visibility choices. Local-only items (not yet pushed) are kept.
 */
function mergeEntitiesById<T extends { id: string }>(
  current: T[],
  pulled: T[],
  mergeOne: (current: T, pulled: T) => T,
): T[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const merged = pulled.map((item) => {
    const existing = currentById.get(item.id);
    currentById.delete(item.id);
    return existing ? mergeOne(existing, item) : item;
  });
  return [...merged, ...currentById.values()];
}

function mergePulledChild(current: Child, pulled: Child): Child {
  return { ...pulled, photoUrl: current.photoUrl ?? pulled.photoUrl, secretCode: current.secretCode };
}

function mergePulledPet(current: Pet, pulled: Pet): Pet {
  return { ...pulled, photoUrl: current.photoUrl ?? pulled.photoUrl };
}

function mergePulledMission(current: Mission, pulled: Mission): Mission {
  return {
    ...pulled,
    question: current.question || pulled.question,
    allowanceDollars: current.allowanceDollars ?? pulled.allowanceDollars,
    assignedChildId: pulled.assignedChildId ?? current.assignedChildId,
    note: pulled.note ?? current.note,
  };
}

function mergePulledTransaction(current: BankTransaction, pulled: BankTransaction): BankTransaction {
  return {
    ...pulled,
    activityId: current.activityId ?? pulled.activityId,
    goalId: current.goalId ?? pulled.goalId,
  };
}

function mergePulledGoal(current: SavingsGoal, pulled: SavingsGoal): SavingsGoal {
  return {
    ...pulled,
    sharedWithTrustedFamilies: current.sharedWithTrustedFamilies ?? pulled.sharedWithTrustedFamilies,
    causeNote: current.causeNote ?? pulled.causeNote,
    seededByParent: current.seededByParent ?? pulled.seededByParent,
    completedAt: current.completedAt ?? pulled.completedAt,
    donationConfirmedAt: current.donationConfirmedAt ?? pulled.donationConfirmedAt,
  };
}

function mergePulledJob(current: NeighborhoodJob, pulled: NeighborhoodJob): NeighborhoodJob {
  return {
    ...pulled,
    visibleToKids: current.visibleToKids,
    minAge: current.minAge ?? pulled.minAge,
    skillFocus: current.skillFocus ?? pulled.skillFocus,
    trustSignals: current.trustSignals ?? pulled.trustSignals,
    missionId: current.missionId ?? pulled.missionId,
    posterThanked: current.posterThanked === true,
  };
}

/**
 * Journey progress toward an earnable certificate. The hero track (families
 * with a real pet) counts approved pet-care missions; the readiness track
 * counts approved missions of any kind.
 */
function getCertificateProgress(
  child: Child,
  missions: Mission[],
  badges: BadgeAward[],
  petCareOnly: boolean,
) {
  const required = petCareOnly ? CERT_REQUIREMENTS.hero : CERT_REQUIREMENTS.readiness;
  const approved = missions.filter((mission) => mission.status === "approved" && mission.completedBy === child.id);
  const counted = petCareOnly ? approved.filter((mission) => mission.category === "pet_care") : approved;
  const skillAreas = new Set(badges.filter((badge) => badge.childId === child.id).map((badge) => badge.skill)).size;
  return {
    missionsDone: counted.length,
    missionsRequired: required.missions,
    streakDays: child.streakDays,
    streakRequired: required.streak,
    skillAreas,
    skillsRequired: required.skills,
    eligible:
      counted.length >= required.missions &&
      child.streakDays >= required.streak &&
      skillAreas >= required.skills,
  };
}

export function TailTotsApp() {
  const [role, setRole] = useState<Role>("parent");
  const [activeTab, setActiveTab] = useState("vision");
  const [isParentUnlocked, setIsParentUnlocked] = useState(true);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [gateInput, setGateInput] = useState("");
  const [gateError, setGateError] = useState(false);
  const [gateNext, setGateNext] = useState<"approvals" | "contact">("approvals");
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [familyName, setFamilyName] = useState("Demo Crew");
  const [parentPasscode, setParentPasscode] = useState(defaultParentPasscode);
  // Parent-set controls: points-to-dollar conversion, daily check-in pacing, discovery ZIP.
  const [pointsPerDollar, setPointsPerDollar] = useState(20);
  const [dailyChecksEnabled, setDailyChecksEnabled] = useState(true);
  const [maxDailyChecks, setMaxDailyChecks] = useState(10);
  const [familyZip, setFamilyZip] = useState("");
  // Anti-addiction pacing: count kid check-ins per calendar day (localStorage so
  // the count survives reloads; ~1-minute sessions keep TailTots a helper, not a habit).
  const dailyChecksStorageKey = "tailtots-daily-checks-v1";
  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }
  const [checksUsed, setChecksUsed] = useState<number>(() => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(dailyChecksStorageKey) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.date === todayKey() && typeof parsed.count === "number") return parsed.count;
    } catch {}
    return 0;
  });
  /** Record one kid check-in for today. Called when entering the kid role. */
  function recordCheckIn() {
    if (!dailyChecksEnabled) return;
    const key = todayKey();
    let count = 0;
    try {
      const parsed = JSON.parse(localStorage.getItem(dailyChecksStorageKey) ?? "null");
      if (parsed && parsed.date === key && typeof parsed.count === "number") count = parsed.count;
    } catch {}
    const next = count + 1;
    try {
      localStorage.setItem(dailyChecksStorageKey, JSON.stringify({ date: key, count: next }));
    } catch {}
    setChecksUsed(next);
  }
  const checksExhausted = dailyChecksEnabled && role === "child" && checksUsed >= maxDailyChecks;
  const [parents, setParents] = useState(starterParents);
  const [children, setChildren] = useState(starterChildren);
  const [pets, setPets] = useState(starterPets);
  const [missions, setMissions] = useState(starterMissions);
  const [transactions, setTransactions] = useState(starterTransactions);
  const [goals, setGoals] = useState(starterGoals);
  const [badges, setBadges] = useState(starterBadges);
  const [neighborhoodJobs, setNeighborhoodJobs] = useState(starterNeighborhoodJobs);
  const [scheduleItems] = useState(starterScheduleItems);
  const [moments, setMoments] = useState<MemoryMoment[]>(starterMoments);
  const [studiedAnimals, setStudiedAnimals] = useState<string[]>([]);
  const [socialPracticeDone, setSocialPracticeDone] = useState<Record<string, string[]>>({});
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [justEarnedCertId, setJustEarnedCertId] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState(starterChildren[0]?.id ?? "");
  const [missionNote, setMissionNote] = useState("");
  const [nudgedMissionIds, setNudgedMissionIds] = useState<string[]>([]);
  const [newChild, setNewChild] = useState({ name: "", age: "8" });
  const [newPet, setNewPet] = useState({ name: "", species: "", food: "" });
  const [newGoal, setNewGoal] = useState({ title: "", target: "25", kind: "save" as "save" | "give", cause: "Animal shelter", seed: "" });
  const [momentDraft, setMomentDraft] = useState("A kind moment with our pet was...");
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState<string | undefined>();
  const [photoCropDraft, setPhotoCropDraft] = useState<PhotoCropDraft | undefined>();
  const [pendingPhotoCropQueue, setPendingPhotoCropQueue] = useState<PhotoCropTarget[]>([]);
  const [jobDraft, setJobDraft] = useState({
    title: "Pet sitting helper",
    family: "Neighbor family",
    pet: "Pet name",
    time: "Saturday, 10:00 AM",
    rewardDollars: "5",
    badgeTitle: "Trusted Helper",
    safety: "Parent confirms address and stays reachable.",
  });
  const [cloudAccountEmail, setCloudAccountEmail] = useState("");
  const [accountDraft, setAccountDraft] = useState({ email: "" });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving" | "loading" | "error" | "saved">("idle");
  const [accountMessage, setAccountMessage] = useState("");
  const [appMode, setAppMode] = useState<"demo" | "real">("demo");
  // Relational cloud sync (Supabase tables). Null when signed out or not bootstrapped yet.
  const [cloudFamilyId, setCloudFamilyId] = useState<string | null>(null);
  const [cloudSyncOn, setCloudSyncOn] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "working" | "error">("idle");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("");
  const cloudUserIdRef = useRef<string | null>(null);
  const applyingPullRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest-value refs so the sign-in bootstrap never uses stale closure state.
  const familyNameRef = useRef(familyName);
  familyNameRef.current = familyName;
  const parentsRef = useRef(parents);
  parentsRef.current = parents;
  /** Build the relational sync payload from the current app state. */
  const getCurrentFamilySyncState = useCallback((): FamilySyncState => {
    return {
      children,
      pets,
      missions: missions ?? [],
      bankTransactions: transactions ?? [],
      savingsGoals: goals ?? [],
      badgeAwards: badges ?? [],
      neighborhoodJobs: (neighborhoodJobs ?? []).map(normalizeNeighborhoodJob),
      memoryMoments: moments ?? [],
    };
  }, [badges, children, goals, missions, moments, neighborhoodJobs, pets, transactions]);
  /**
   * Apply pulled relational state over whatever is on screen. The relational
   * tables are authoritative for the columns they cover; snapshot-only fields
   * (photos, mission questions, goal causes, job visibility, parent list,
   * passcode, family photo) are preserved via ID-based merge so a cloud pull
   * never wipes them. Local-only items not yet pushed are kept.
   */
  const applyPulledFamilyState = useCallback(
    (pulled: NonNullable<Awaited<ReturnType<typeof pullFamilyState>>>) => {
      applyingPullRef.current = true;
      try {
        setChildren((current) =>
          mergeEntitiesById(
            current,
            pulled.children.map(normalizeChildProfile),
            mergePulledChild,
          ),
        );
        setPets((current) =>
          mergeEntitiesById(
            current,
            pulled.pets.map(normalizePetProfile),
            mergePulledPet,
          ),
        );
        setMissions((current) => mergeEntitiesById(current, pulled.missions, mergePulledMission));
        setTransactions((current) => mergeEntitiesById(current, pulled.bankTransactions, mergePulledTransaction));
        setGoals((current) => mergeEntitiesById(current, pulled.savingsGoals, mergePulledGoal));
        setBadges(() => pulled.badgeAwards);
        setNeighborhoodJobs((current) =>
          mergeEntitiesById(
            current,
            pulled.neighborhoodJobs.map(normalizeNeighborhoodJob),
            mergePulledJob,
          ),
        );
        setMoments(() => pulled.memoryMoments);
        if (pulled.children[0]) setActiveChildId(pulled.children[0].id);
      } finally {
        applyingPullRef.current = false;
      }
    },
    [],
  );
  /**
   * Sign-in bootstrap for the relational backend: ensure the parent's family
   * row exists, then pull the family's cloud data. A fresh (childless) family
   * does NOT auto-push — the parent opts in explicitly so demo content never
   * silently seeds their cloud.
   */
  const bootstrapCloudFamily = useCallback(async () => {
    if (!supabase) return;
    setCloudSyncStatus("working");
    setCloudSyncMessage("Connecting your family's cloud data...");
    try {
      const familyId = await ensureFamilyForCurrentUser(
        supabase,
        familyNameRef.current?.trim() || "My Family",
        parentsRef.current?.[0]?.name?.trim() || "Parent",
      );
      setCloudFamilyId(familyId);
      const pulled = await pullFamilyState(supabase, familyId);
      if (pulled) {
        applyPulledFamilyState(pulled);
        setCloudSyncOn(true);
        setAppMode("real");
        setCloudSyncStatus("idle");
        setCloudSyncMessage("Loaded your family's cloud data. Changes now save automatically.");
      } else {
        setCloudSyncStatus("idle");
        setCloudSyncMessage("Cloud family is ready. Turn on cloud sync below to keep this device's setup in your parent account.");
      }
    } catch (error) {
      setCloudSyncStatus("error");
      setCloudSyncMessage(error instanceof Error ? error.message : "Could not connect cloud data.");
    }
  }, [applyPulledFamilyState]);

  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0];
  const activePet = pets[0];
  const activeChildMissions = missions.filter((mission) => !mission.assignedChildId || mission.assignedChildId === activeChild?.id);
  // Kid-visible slice: parents can hide approved missions from kids in the parent controls.
  const kidVisibleMissions = activeChildMissions.filter((mission) => mission.visibleToKids !== false);
  const activeApprovedMissionCount = activeChildMissions.filter((mission) => mission.status === "approved").length;
  const activeCompletedMissionCount = activeChildMissions.filter((mission) => mission.completedBy).length;
  const taskProgress = Math.round((activeCompletedMissionCount / Math.max(1, activeChildMissions.length)) * 100);
  const familySkillSummary = useMemo(() => getFamilySkillSummary(badges, children), [badges, children]);

  const pendingApprovals = useMemo(
    () => [
      ...missions.filter((mission) => mission.status === "pending" && mission.completedBy),
      ...transactions.filter((transaction) => transaction.status === "pending"),
    ],
    [missions, transactions],
  );
  const visibleTabs = useMemo(
    () => tabItems.filter((tab) => (role === "parent" ? parentTabIds.includes(tab.id) : kidTabIds.includes(tab.id))),
    [role],
  );
  const visibleActiveTab = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id;
  const isRouteChooser = role === "parent" && visibleActiveTab === "vision";
  const operatorLabel = role === "parent" ? "Parent operating" : `${activeChild?.name ?? "Kid"} operating`;

  useEffect(() => {
    queueMicrotask(() => {
      const savedState = loadSavedFamilyState();
      if (savedState) {
        setFamilyName(savedState.familyName ?? "Demo Crew");
        setParentPasscode(defaultParentPasscode);
        setParents(savedState.parents);
        setChildren(savedState.children.map(normalizeChildProfile));
        setPets(savedState.pets.map(normalizePetProfile));
        setMissions(savedState.missions ?? starterMissions);
        setTransactions(savedState.transactions ?? starterTransactions);
        setGoals(savedState.goals ?? starterGoals);
        setBadges(savedState.badges ?? starterBadges);
        setNeighborhoodJobs(savedState.neighborhoodJobs ? savedState.neighborhoodJobs.map(normalizeNeighborhoodJob) : starterNeighborhoodJobs);
        setMoments(savedState.moments ?? starterMoments);
        setStudiedAnimals(savedState.studiedAnimals ?? []);
        setSocialPracticeDone(savedState.socialPracticeDone ?? {});
        setCertificates(savedState.certificates ?? []);
        setFamilyPhotoUrl(savedState.familyPhotoUrl);
        setActiveChildId(savedState.activeChildId ?? savedState.children?.[0]?.id ?? "");
      }
      setHasLoadedSavedState(true);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    const handleSession = (userId: string | null, email: string) => {
      if (!isMounted) return;
      setCloudAccountEmail(email);
      if (userId) {
        setMagicLinkSent(false);
        if (cloudUserIdRef.current !== userId) {
          cloudUserIdRef.current = userId;
          void bootstrapCloudFamily();
        }
      } else {
        cloudUserIdRef.current = null;
        setCloudFamilyId(null);
        setCloudSyncOn(false);
        setCloudSyncStatus("idle");
        setCloudSyncMessage("");
        setAppMode("demo");
        if (pushTimerRef.current) {
          clearTimeout(pushTimerRef.current);
          pushTimerRef.current = null;
        }
      }
    };
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session?.user.id ?? null, data.session?.user.email ?? "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session?.user.id ?? null, session?.user.email ?? "");
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, [bootstrapCloudFamily]);

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    saveFamilyState({ familyName, parentPasscode, parents, children, pets, missions, transactions, goals, badges, neighborhoodJobs, moments, studiedAnimals, socialPracticeDone, familyPhotoUrl, activeChildId, certificates, pointsPerDollar, dailyChecksEnabled, maxDailyChecks, familyZip });
    setLastSavedAt(new Date());
  }, [activeChildId, badges, certificates, children, dailyChecksEnabled, familyName, familyPhotoUrl, familyZip, goals, hasLoadedSavedState, maxDailyChecks, missions, moments, neighborhoodJobs, parentPasscode, parents, pets, pointsPerDollar, studiedAnimals, socialPracticeDone, transactions]);

  // Debounced relational cloud push: mirrors family state into the Supabase
  // tables a couple of seconds after any change, while cloud sync is on.
  useEffect(() => {
    if (!hasLoadedSavedState || !cloudSyncOn || !cloudFamilyId || !supabase) return;
    if (applyingPullRef.current) return;
    const client = supabase;
    const familyId = cloudFamilyId;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushTimerRef.current = null;
      setCloudSyncStatus("working");
      pushFamilyState(client, familyId, getCurrentFamilySyncState()).then(
        () => {
          setCloudSyncStatus("idle");
          setCloudSyncMessage("Cloud sync is on — changes now save automatically.");
        },
        (error) => {
          setCloudSyncStatus("error");
          setCloudSyncMessage(error instanceof Error ? error.message : "Cloud sync failed.");
        },
      );
    }, 2000);
    return () => {
      if (pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [activeChildId, badges, children, cloudFamilyId, cloudSyncOn, familyName, getCurrentFamilySyncState, goals, hasLoadedSavedState, missions, moments, neighborhoodJobs, parents, pets, transactions]);

  // Certificate awards: when a child's journey criteria are newly met, issue
  // the earned certificate (hero track for families with a real pet, readiness
  // otherwise). A readiness certificate upgrades to hero if hero criteria are
  // met later. Runs on the same data the Growth tab renders.
  useEffect(() => {
    if (!hasLoadedSavedState) return;
    const hasPets = pets.length > 0;
    const awards: Certificate[] = [];
    for (const child of children) {
      const existing = certificates.find((cert) => cert.childId === child.id);
      const heroEligible = hasPets && getCertificateProgress(child, missions, badges, true).eligible;
      const readinessEligible = getCertificateProgress(child, missions, badges, false).eligible;
      const kind: CertificateKind | null = heroEligible ? "hero" : readinessEligible ? "readiness" : null;
      if (!kind || existing?.kind === kind) continue;
      awards.push({
        id: `cert-${child.id}-${kind}-${Date.now()}`,
        childId: child.id,
        kind,
        title: certificateTitleFor(kind),
        earnedAt: new Date().toISOString(),
      });
    }
    if (awards.length === 0) return;
    // Apply outside the synchronous effect body: awarding is a reaction to
    // newly-eligible journey data, not part of rendering it.
    queueMicrotask(() => {
      setCertificates((prev) => {
        const awardedChildIds = new Set(awards.map((award) => award.childId));
        return [...prev.filter((cert) => !awardedChildIds.has(cert.childId)), ...awards];
      });
      setJustEarnedCertId(awards[awards.length - 1].id);
    });
  }, [badges, certificates, children, hasLoadedSavedState, missions, pets]);

  useEffect(() => {
    queueMicrotask(() => {
      const requestedTab = new URLSearchParams(window.location.search).get("tab");
      if (!requestedTab || !tabItems.some((tab) => tab.id === requestedTab)) return;
      setActiveTab(requestedTab);
    });
  }, []);

  function getCurrentFamilySnapshot(): SavedFamilyState {
    return {
      familyName,
      parentPasscode,
      parents,
      children,
      pets,
      missions,
      transactions,
      goals,
      badges,
      neighborhoodJobs,
      moments,
      studiedAnimals,
      socialPracticeDone,
      familyPhotoUrl,
      activeChildId,
      certificates,
      pointsPerDollar,
      dailyChecksEnabled,
      maxDailyChecks,
      familyZip,
    };
  }

  function applyFamilySnapshot(snapshot: SavedFamilyState) {
    setFamilyName(snapshot.familyName ?? "My Family");
    setParentPasscode(snapshot.parentPasscode ?? defaultParentPasscode);
    setParents(snapshot.parents ?? starterParents);
    setChildren(snapshot.children ? snapshot.children.map(normalizeChildProfile) : starterChildren);
    setPets(snapshot.pets ? snapshot.pets.map(normalizePetProfile) : starterPets);
    setMissions(snapshot.missions ?? starterMissions);
    setTransactions(snapshot.transactions ?? starterTransactions);
    setGoals(snapshot.goals ?? starterGoals);
    setBadges(snapshot.badges ?? starterBadges);
    setNeighborhoodJobs(snapshot.neighborhoodJobs ? snapshot.neighborhoodJobs.map(normalizeNeighborhoodJob) : starterNeighborhoodJobs);
    setMoments(snapshot.moments ?? starterMoments);
    setStudiedAnimals(snapshot.studiedAnimals ?? []);
    setSocialPracticeDone(snapshot.socialPracticeDone ?? {});
    setCertificates(snapshot.certificates ?? []);
    setFamilyPhotoUrl(snapshot.familyPhotoUrl);
    setActiveChildId(snapshot.activeChildId ?? snapshot.children?.[0]?.id ?? (snapshot.children ? "" : starterChildren[0]?.id ?? ""));
    setPointsPerDollar(snapshot.pointsPerDollar ?? 20);
    setDailyChecksEnabled(snapshot.dailyChecksEnabled ?? true);
    setMaxDailyChecks(snapshot.maxDailyChecks ?? 10);
    setFamilyZip(snapshot.familyZip ?? "");
  }

  function openRouteChooser() {
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("vision");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function openContactSection() {
    if (role === "child") {
      // Grown-ups only: contact lives in the parent area.
      setGateNext("contact");
      setGateInput("");
      setGateError(false);
      setParentGateOpen(true);
      return;
    }
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("vision");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById("landing-contact");
        if (!target) return;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      });
    });
  }

  function loadDemoFamily() {
    setAppMode("demo");
    applyFamilySnapshot({
      familyName: "Demo Crew",
      parentPasscode: defaultParentPasscode,
      parents: starterParents,
      children: starterChildren,
      pets: starterPets,
      missions: starterMissions,
      transactions: starterTransactions,
      goals: starterGoals,
      badges: starterBadges,
      neighborhoodJobs: starterNeighborhoodJobs,
      moments: starterMoments,
      activeChildId: starterChildren[0]?.id ?? "",
    });
  }

  function openParentDemo() {
    const saved = loadSavedFamilyState();
    if (saved && saved.children.length > 0) {
      applyFamilySnapshot(saved);
    } else {
      loadDemoFamily();
    }
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("approvals");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function openKidDemo() {
    const saved = loadSavedFamilyState();
    if (saved && saved.children.length > 0) {
      applyFamilySnapshot(saved);
    } else {
      loadDemoFamily();
    }
    setRole("child");
    recordCheckIn();
    setActiveChildId(saved?.activeChildId ?? starterChildren[0]?.id ?? "");
    setActiveTab("missions");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function sendParentSignInLink() {
    setAccountStatus("loading");
    setAccountMessage("");
    setMagicLinkSent(false);
    try {
      await sendParentMagicLink(accountDraft.email);
      setAccountStatus("saved");
      setMagicLinkSent(true);
      setAccountMessage(`Sign-in link sent to ${accountDraft.email.trim().toLowerCase()}. Check that inbox (and spam) — the link expires soon.`);
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not send the sign-in link.");
    }
  }

  async function saveCurrentFamilyAccount() {
    setAccountStatus("saving");
    setAccountMessage("");
    try {
      await saveFamilyAccountSnapshot(getCurrentFamilySnapshot());
      await flushCloudSyncNow();
      setAccountStatus("saved");
      setAccountMessage("Saved this family's profiles, photos, goals, points, Kid Bank, and parent settings to the account.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not save this family account.");
    }
  }

  async function loadCurrentFamilyAccount() {
    if (typeof window !== "undefined" && !window.confirm("Load the family setup saved to this parent account? This replaces the family setup on this device.")) {
      return;
    }
    setAccountStatus("loading");
    setAccountMessage("");
    try {
      const snapshot = await loadFamilyAccountSnapshot<SavedFamilyState>();
      if (!snapshot) {
        setAccountStatus("saved");
        setAccountMessage("No saved cloud family setup yet.");
        return;
      }
      applyFamilySnapshot(snapshot);
      // Relational tables are authoritative for the entities they cover: layer
      // the cloud pull over the snapshot so a stale snapshot can't regress them.
      // Snapshot-only fields (photos, passcode, parent list) stay as loaded.
      if (supabase && cloudFamilyId) {
        const pulled = await pullFamilyState(supabase, cloudFamilyId);
        if (pulled) applyPulledFamilyState(pulled);
      }
      setAccountStatus("saved");
      setAccountMessage("Loaded this family's cloud account.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not load this family account.");
    }
  }

  async function signOutParentAccountFromApp() {
    setAccountStatus("loading");
    setAccountMessage("");
    try {
      await signOutParentAccount();
      setCloudAccountEmail("");
      setAccountStatus("idle");
      setAccountMessage("Signed out. This device still keeps the local demo copy.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  /** Explicit opt-in: push this device's state to a fresh cloud family. */
  async function enableCloudSyncNow() {
    if (!supabase || !cloudFamilyId) return;
    setCloudSyncStatus("working");
    setCloudSyncMessage("Pushing this device's setup to your cloud family...");
    try {
      await pushFamilyState(supabase, cloudFamilyId, getCurrentFamilySyncState());
      setCloudSyncOn(true);
      setAppMode("real");
      setCloudSyncStatus("idle");
      setCloudSyncMessage("Cloud sync is on — changes now save automatically.");
    } catch (error) {
      setCloudSyncStatus("error");
      setCloudSyncMessage(error instanceof Error ? error.message : "Could not start cloud sync.");
    }
  }

  /** Immediate (non-debounced) relational push, used by explicit Save. */
  async function flushCloudSyncNow() {
    if (!supabase || !cloudFamilyId || !cloudSyncOn) return;
    if (pushTimerRef.current) {
      clearTimeout(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    setCloudSyncStatus("working");
    try {
      await pushFamilyState(supabase, cloudFamilyId, getCurrentFamilySyncState());
      setCloudSyncStatus("idle");
      setCloudSyncMessage("Cloud sync is on — changes now save automatically.");
    } catch (error) {
      setCloudSyncStatus("error");
      setCloudSyncMessage(error instanceof Error ? error.message : "Cloud sync failed.");
    }
  }

  function addChild() {
    if (!newChild.name.trim()) return;
    const child: Child = {
      id: `child-${Date.now()}`,
      name: newChild.name.trim(),
      age: Math.max(3, Math.min(18, Number(newChild.age) || 8)),
      secretCode: "",
      points: 0,
      coins: 0,
      level: "easy",
      streakDays: 0,
    };
    setChildren((items) => [...items, child]);
    setActiveChildId(child.id);
    setNewChild({ name: "", age: "8" });
  }

  /**
   * COPPA/GDPR deletion right: removing a kid profile permanently deletes ALL
   * of that child's data — missions, Kid Bank history, goals, badges, memory
   * moments, certificates, and neighborhood-job acceptances. Neighborhood jobs
   * the child had accepted revert to "posted" so the posting parent can offer
   * them again; the job itself is parent/poster data, not the child's.
   */
  function removeChild(childId: string) {
    const removedMissionIds = missions
      .filter((mission) => mission.assignedChildId === childId || mission.completedBy === childId)
      .map((mission) => mission.id);
    const removedMissionIdSet = new Set(removedMissionIds);
    setChildren((items) => items.filter((child) => child.id !== childId));
    setMissions((items) => items.filter((mission) => !removedMissionIdSet.has(mission.id)));
    setTransactions((items) => items.filter((transaction) => transaction.childId !== childId));
    setGoals((items) => items.filter((goal) => goal.childId !== childId));
    setBadges((items) => items.filter((badge) => badge.childId !== childId));
    setMoments((items) => items.filter((moment) => moment.childId !== childId));
    setCertificates((items) => items.filter((certificate) => certificate.childId !== childId));
    setNudgedMissionIds((ids) => ids.filter((id) => !removedMissionIdSet.has(id)));
    setNeighborhoodJobs((items) =>
      items.map((job) => {
        const assignedChildIds = job.assignedChildIds.filter((id) => id !== childId);
        if (job.acceptedBy !== childId) return { ...job, assignedChildIds };
        // The accepting kid is gone: release the job back to the parent inbox.
        return {
          ...job,
          assignedChildIds,
          acceptedBy: undefined,
          missionId: undefined,
          posterThanked: false,
          status: "posted" as const,
        };
      }),
    );
    setActiveChildId((current) => {
      if (current !== childId) return current;
      const remaining = children.filter((child) => child.id !== childId);
      return remaining[0]?.id ?? "";
    });
  }

  function addPet() {
    if (!newPet.name.trim() || !newPet.species.trim()) return;
    setPets((items) => [
      ...items,
      {
        id: `pet-${Date.now()}`,
        name: newPet.name.trim(),
        species: newPet.species.trim(),
        favoriteFood: newPet.food.trim() || "Add favorite food",
        careNotes: "Add care notes in the passport.",
        vet: "Add vet",
        medicine: "Add medicine",
      },
    ]);
    setNewPet({ name: "", species: "", food: "" });
  }

  function updateParent(parentId: string, updates: Partial<ParentProfile>) {
    setParents((items) => items.map((parent) => (parent.id === parentId ? { ...parent, ...updates } : parent)));
  }


  function updateChild(childId: string, updates: Partial<Child>) {
    setChildren((items) => items.map((child) => (child.id === childId ? normalizeChildProfile({ ...child, ...updates }) : child)));
  }

  function updatePet(petId: string, updates: Partial<Pet>) {
    setPets((items) => items.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet)));
  }

  async function updateFamilyPhoto(file?: File) {
    if (!file) return;
    const url = await resizeImageFile(file, 1200, 0.82);
    setFamilyPhotoUrl(url);
  }

  async function updateFamilyPhotoAndPickProfiles(file?: File) {
    if (!file) return;
    const cropSourceUrl = await fileToDataUrl(file);
    setFamilyPhotoUrl(await resizeImageFile(file, 1200, 0.82));
    startSharedPhotoProfilePicking(cropSourceUrl);
  }

  function pickProfilesFromSavedFamilyPhoto() {
    if (!familyPhotoUrl) return;
    startSharedPhotoProfilePicking(familyPhotoUrl);
  }

  function startSharedPhotoProfilePicking(imageUrl: string) {
    const targets: PhotoCropTarget[] = [
      ...parents.map((parent) => ({
        targetType: "parent" as const,
        targetId: parent.id,
        label: parent.name || "Parent",
        fit: "cover" as const,
      })),
      ...children.map((child) => ({
        targetType: "child" as const,
        targetId: child.id,
        label: child.name || "Kid",
        fit: "cover" as const,
      })),
    ];
    if (!targets.length) return;
    const [firstTarget, ...remainingTargets] = targets;
    setPendingPhotoCropQueue(remainingTargets);
    openPhotoCropFromUrl(firstTarget, imageUrl);
  }

  async function updateChildPhoto(childId: string, file?: File) {
    const child = children.find((item) => item.id === childId);
    await openPhotoCrop("child", childId, child?.name ?? "Child", file, "cover");
  }

  async function updatePetPhoto(petId: string, file?: File) {
    const pet = pets.find((item) => item.id === petId);
    await openPhotoCrop("pet", petId, pet?.name ?? "Pet", file, "contain");
  }

  async function updateParentPhoto(parentId: string, file?: File) {
    const parent = parents.find((item) => item.id === parentId);
    await openPhotoCrop("parent", parentId, parent?.name ?? "Parent", file, "cover");
  }

  async function openPhotoCrop(targetType: PhotoCropDraft["targetType"], targetId: string, label: string, file?: File, fit: PhotoCropDraft["fit"] = "cover") {
    if (!file) return;
    openPhotoCropFromUrl({ targetType, targetId, label, fit }, await fileToDataUrl(file));
  }

  function openPhotoCropFromUrl(target: PhotoCropTarget, imageUrl: string) {
    const isPerson = target.targetType === "parent" || target.targetType === "child";
    setPhotoCropDraft({
      ...target,
      imageUrl,
      crop: { x: 0, y: isPerson ? -12 : 0 },
      zoom: target.fit === "contain" ? 0.85 : isPerson ? 1.45 : 1.05,
    });
  }

  async function savePhotoCrop() {
    if (!photoCropDraft) return;
    const photoUrl = await cropProfileImage(photoCropDraft);
    if (photoCropDraft.targetType === "parent") {
      setParents((items) => items.map((parent) => (parent.id === photoCropDraft.targetId ? { ...parent, photoUrl } : parent)));
    }
    if (photoCropDraft.targetType === "child") {
      setChildren((items) => items.map((child) => (child.id === photoCropDraft.targetId ? { ...child, photoUrl } : child)));
    }
    if (photoCropDraft.targetType === "pet") {
      setPets((items) => items.map((pet) => (pet.id === photoCropDraft.targetId ? { ...pet, photoUrl } : pet)));
    }
    const [nextTarget, ...remainingTargets] = pendingPhotoCropQueue;
    if (nextTarget) {
      setPendingPhotoCropQueue(remainingTargets);
      openPhotoCropFromUrl(nextTarget, photoCropDraft.imageUrl);
      return;
    }
    setPhotoCropDraft(undefined);
  }

  function requestChildSwitch(childId: string) {
    setActiveChildId(childId);
  }

  function switchRole(nextRole: Role) {
    if (nextRole === "parent" && role === "child") {
      // Grown-up gate: a kid must not flip the toggle straight into parent controls.
      setGateNext("approvals");
      setGateInput("");
      setGateError(false);
      setParentGateOpen(true);
      return;
    }
    setRole(nextRole);
    if (nextRole === "child") recordCheckIn();
    setActiveTab(nextRole === "parent" ? "approvals" : "missions");
    if (nextRole === "parent") setIsParentUnlocked(true);
    if (nextRole === "child" && !activeChildId) setActiveChildId(children[0]?.id ?? starterChildren[0]?.id ?? "");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function submitParentGate() {
    if (gateInput === parentPasscode) {
      setParentGateOpen(false);
      setGateInput("");
      setRole("parent");
      setActiveTab("approvals");
      setIsParentUnlocked(true);
      const dest = gateNext;
      requestAnimationFrame(() => {
        if (dest === "contact") {
          const target = document.getElementById("landing-contact");
          if (target) {
            const targetTop = target.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
          }
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    } else {
      setGateError(true);
    }
  }

  function completeMission(missionId: string) {
    if (!activeChild) return;
    const missionToComplete = missions.find((mission) => mission.id === missionId);
    if (missionToComplete?.assignedChildId && missionToComplete.assignedChildId !== activeChild.id) return;
    setMissions((items) =>
      items.map((mission) =>
        mission.id === missionId
          ? { ...mission, completedBy: activeChild.id, note: missionNote || "Voice check-in saved.", status: "pending" }
          : mission,
      ),
    );
    setMissionNote("");
    // The streak rewards the kid's effort, not the parent's timing: completing
    // advances it once per day (applyDailyStreak's lastStreakDate guard keeps
    // multiple completions on the same day to a single bump). Parent approval
    // still gates coins/points/allowance; send-back leaves the streak alone.
    setChildren((items) => items.map((child) => (child.id === activeChild.id ? applyDailyStreak(child) : child)));
  }

  /** Repeat an approved mission: a fresh pending copy; the approved original stays as history. */
  function repeatMission(missionId: string) {
    const mission = missions.find((item) => item.id === missionId);
    if (!mission || mission.status !== "approved") return;
    setMissions((items) => [
      { ...mission, id: `mission-${Date.now()}`, status: "pending", completedBy: undefined, note: undefined },
      ...items,
    ]);
  }

  function approveMission(missionId: string) {
    const mission = missions.find((item) => item.id === missionId);
    if (!mission?.completedBy) return;
    setMissions((items) => items.map((item) => (item.id === missionId ? { ...item, status: "approved" } : item)));
    setNudgedMissionIds((ids) => ids.filter((id) => id !== missionId));
    setChildren((items) =>
      items.map((child) =>
        child.id === mission.completedBy
          ? { ...child, points: child.points + mission.points, coins: child.coins + mission.coins }
          : child,
      ),
    );
    const skill = getMissionLifeSkill(mission);
    setBadges((items) => [
      {
        id: `badge-${Date.now()}`,
        childId: mission.completedBy!,
        title: getBadgeTitle(skill),
        skill,
        note: `Approved: ${mission.title}`,
        awardedAt: "Today",
      },
      ...items,
    ]);
    if (mission.allowanceDollars && mission.allowanceDollars > 0) {
      setTransactions((items) => [
        {
          id: `tx-${Date.now()}`,
          childId: mission.completedBy!,
          category: "earn",
          amount: mission.allowanceDollars ?? 0,
          description: `Earned from approved task: ${mission.title}`,
          activityId: mission.id,
          status: "approved",
        },
        ...items,
      ]);
    }
    setNeighborhoodJobs((items) => items.map((job) => (job.missionId === missionId ? { ...job, status: "completed" } : job)));
  }

  function approveTransaction(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    setTransactions((items) => items.map((item) => (item.id === transactionId ? { ...item, status: "approved" } : item)));
    if (transaction.category === "save" && transaction.goalId) {
      setGoals((items) =>
        items.map((goal) =>
          goal.id === transaction.goalId ? withGoalProgress(goal, transaction.amount) : goal,
        ),
      );
    }
  }

  function rejectMission(missionId: string, reason?: string) {
    // The parent's reason becomes the mission note, so the kid sees it on the card. No schema change needed.
    setMissions((items) => items.map((mission) => (mission.id === missionId ? { ...mission, completedBy: undefined, note: reason ?? undefined, status: "rejected" } : mission)));
    setNudgedMissionIds((ids) => ids.filter((id) => id !== missionId));
  }

  function assignMission(missionId: string, childId: string) {
    setMissions((items) =>
      items.map((mission) =>
        mission.id === missionId
          ? { ...mission, assignedChildId: childId, completedBy: undefined, note: undefined, status: "pending" }
          : mission,
      ),
    );
  }

  function autoBalanceMissions() {
    if (!children.length) return;
    setMissions((items) => {
      const totals = Object.fromEntries(children.map((child) => [child.id, 0]));
      const shuffledOpenMissions = [...items]
        .filter((mission) => mission.status !== "approved" && !mission.completedBy)
        .sort(() => Math.random() - 0.5);
      const assignments = new Map<string, string>();

      shuffledOpenMissions.forEach((mission) => {
        const ageFitChildren = children.filter((child) => isMissionAgeAppropriate(mission, child));
        const eligibleChildren = ageFitChildren.length ? ageFitChildren : children;
        const nextChild = [...eligibleChildren].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))[0];
        if (!nextChild) return;
        assignments.set(mission.id, nextChild.id);
        totals[nextChild.id] = (totals[nextChild.id] ?? 0) + mission.points;
      });

      return items.map((mission) => (assignments.has(mission.id) ? { ...mission, assignedChildId: assignments.get(mission.id) } : mission));
    });
  }

  function rejectTransaction(transactionId: string) {
    setTransactions((items) => items.map((transaction) => (transaction.id === transactionId ? { ...transaction, status: "rejected" } : transaction)));
  }

  function requestBankMove(category: BankCategory, amount = category === "earn" ? 1 : 3, description?: string, goalId?: string) {
    if (!activeChild) return;
    const childTransactions = transactions.filter((item) => item.childId === activeChild.id && item.status === "approved");
    const approvedEarned = childTransactions.filter((item) => item.category === "earn").reduce((sum, item) => sum + item.amount, 0);
    const approvedSpentOrGiven = childTransactions.filter((item) => item.category === "spend" || item.category === "give").reduce((sum, item) => sum + item.amount, 0);
    const approvedGoalSavings = goals.filter((goal) => goal.childId === activeChild.id).reduce((sum, goal) => sum + goalKidSaved(goal), 0);
    const availableBalance = Math.max(0, approvedEarned - approvedSpentOrGiven - approvedGoalSavings);
    if ((category === "save" || category === "give" || category === "spend") && amount > availableBalance) return;
    setTransactions((items) => [
      {
        id: `tx-${Date.now()}`,
        childId: activeChild.id,
        category,
        amount,
        description: description ?? `${category.toUpperCase()} request from ${activeChild.name}`,
        goalId,
        status: "pending",
      },
      ...items,
    ]);
  }

  function addSavingsGoal() {
    if (!activeChild || !newGoal.title.trim()) return;
    const isGiving = newGoal.kind === "give";
    const seed = isGiving ? Math.max(0, Math.floor(Number(newGoal.seed) || 0)) : 0;
    const target = Math.max(1, Math.floor(Number(newGoal.target) || 25));
    const now = new Date().toISOString();
    const goal: SavingsGoal = {
      id: `goal-${Date.now()}`,
      childId: activeChild.id,
      title: newGoal.title.trim(),
      target,
      saved: 0,
      type: isGiving ? "donation" : "family_reward",
      sharedWithTrustedFamilies: isGiving,
      causeNote: isGiving ? newGoal.cause : "Parent can choose to share this goal with trusted families.",
      seededByParent: isGiving && seed > 0 ? seed : undefined,
    };
    setGoals((items) => [seed > 0 ? withGoalProgress(goal, seed, now) : goal, ...items]);
    setNewGoal({ title: "", target: "25", kind: "save", cause: "Animal shelter", seed: "" });
  }

  /** Parent confirms the real-world donation for a fully funded giving goal. */
  function confirmDonation(goalId: string) {
    const now = new Date().toISOString();
    setGoals((items) =>
      items.map((goal) =>
        goal.id === goalId && goal.type === "donation" && goal.completedAt && !goal.donationConfirmedAt
          ? { ...goal, donationConfirmedAt: now }
          : goal,
      ),
    );
  }

  function addMoment() {
    if (!activeChild || !momentDraft.trim()) return;
    setMoments((items) => [
      {
        id: `moment-${Date.now()}`,
        childId: activeChild.id,
        petId: activePet?.id,
        mood: "kind",
        note: momentDraft.trim(),
      },
      ...items,
    ]);
    setMomentDraft("");
  }

  /** Feed a kid's AI Buddy interaction into the parent's Growth Log. */
  function logHelperUse(topic: string) {
    const child = activeChild;
    if (!child) return;
    const today = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    setMoments((items) => [
      {
        id: `moment-buddy-${Date.now()}`,
        childId: child.id,
        mood: "helper",
        note: `Asked the AI Buddy about "${topic}" — ${today}.`,
      },
      ...items,
    ]);
  }

  /** Answer a social practice scenario; completing all six earns the Safe Social Star badge. */
  function answerSocialScenario(childId: string, scenarioId: string) {
    const done = socialPracticeDone[childId] ?? [];
    if (done.includes(scenarioId)) return;
    const updated = [...done, scenarioId];
    setSocialPracticeDone((prev) => ({ ...prev, [childId]: updated }));
    if (
      updated.length >= socialScenarios.length &&
      !badges.some((badge) => badge.childId === childId && badge.title === "Safe Social Star")
    ) {
      setBadges((items) => [
        {
          id: `badge-social-${Date.now()}`,
          childId,
          title: "Safe Social Star",
          skill: "empathy",
          note: "Completed all 6 safe social practice scenarios",
          awardedAt: "Today",
        },
        ...items,
      ]);
    }
  }

  /** Record that the family studied a learning passport (no-pet track). */
  function recordPassportStudy(animal: string) {
    const child = activeChild ?? children[0];
    if (!child || studiedAnimals.includes(animal)) return;
    setStudiedAnimals((items) => [...items, animal]);
    setMoments((items) => [
      {
        id: `moment-study-${Date.now()}`,
        childId: child.id,
        mood: "proud",
        note: `Studied the ${animal} learning passport — food, space, costs, lifespan, and real care needs.`,
      },
      ...items,
    ]);
  }

  const jobTemplateDrafts: Record<string, { title: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string }> = {
    Responsibility: { title: "Morning pet check for a trusted neighbor", pet: "Neighbor pet", time: "Weekday mornings, 15 minutes", rewardDollars: "4", badgeTitle: "Responsibility Star", safety: "Parent confirms the visit and stays reachable by phone." },
    Empathy: { title: "Make a comfort card for a newly adopted pet", pet: "Shelter buddy", time: "Any afternoon this week", rewardDollars: "0", badgeTitle: "Kindness Badge", safety: "Card is delivered by the parent — no kid-to-shelter contact." },
    Teamwork: { title: "Two-kid supply sorting task with parent", pet: "Neighbor pet", time: "Saturday with a parent", rewardDollars: "5", badgeTitle: "Team Player", safety: "Parent supervises the whole task; points split fairly." },
    Leadership: { title: "Older kid teaches a younger kid safe pet observation", pet: "Neighbor pet", time: "Weekend, 30 minutes", rewardDollars: "10", badgeTitle: "Junior Leader", safety: "Parent stays nearby the entire time; older kid leads, never alone." },
  };

  /** Fill the job draft from a skill template so "Use template" does real work. */
  function fillJobTemplate(skill: string) {
    const template = jobTemplateDrafts[skill];
    if (!template) return;
    setJobDraft({ title: template.title, family: "Neighbor family", pet: template.pet, time: template.time, rewardDollars: template.rewardDollars, badgeTitle: template.badgeTitle, safety: template.safety });
  }

  function postNeighborhoodJob() {
    const allowedChildren = children.map((child) => child.id);
    if (!jobDraft.title.trim() || !jobDraft.family.trim() || !jobDraft.pet.trim() || !allowedChildren.length) return;
    setNeighborhoodJobs((items) => [
      {
        id: `job-${Date.now()}`,
        title: jobDraft.title.trim(),
        family: jobDraft.family.trim(),
        pet: jobDraft.pet.trim(),
        time: jobDraft.time.trim() || "Parent scheduled",
        rewardDollars: Math.max(0, Number(jobDraft.rewardDollars) || 0),
        badgeTitle: jobDraft.badgeTitle.trim() || "Trusted Helper",
        assignedChildIds: allowedChildren,
        visibleToKids: false,
        checklist: ["Review the pet need", "Complete the parent-approved task", "Tell parent what you noticed"],
        safety: jobDraft.safety.trim() || "Parent confirms details first.",
        minAge: Math.min(...children.map((child) => child.age)),
        skillFocus: Number(jobDraft.rewardDollars) >= 8 ? "leadership" : "teamwork",
        trustSignals: ["parent_gate", "age_fit", "no_messaging", "adult_nearby", "private_child"],
        status: "posted",
      },
      ...items,
    ]);
    setJobDraft({ title: "Pet sitting helper", family: "Neighbor family", pet: "Pet name", time: "Saturday, 10:00 AM", rewardDollars: "5", badgeTitle: "Trusted Helper", safety: "Parent confirms address and stays reachable." });
  }

  function acceptNeighborhoodJob(jobId: string) {
    if (!activeChild) return;
    setNeighborhoodJobs((items) =>
      items.map((job) =>
        job.id === jobId && job.visibleToKids && job.assignedChildIds.includes(activeChild.id) && job.status === "posted"
          ? { ...job, acceptedBy: activeChild.id, status: "accepted" }
          : job,
      ),
    );
  }

  function toggleNeighborhoodJobVisibility(jobId: string) {
    setNeighborhoodJobs((items) =>
      items.map((job) =>
        job.id === jobId
          ? { ...job, visibleToKids: !job.visibleToKids, status: job.status === "posted" ? "posted" : job.status }
          : job,
      ),
    );
  }

  /** Let parents choose which approved missions kids can see (default: visible). */
  function toggleMissionVisibility(missionId: string) {
    setMissions((items) =>
      items.map((item) => (item.id === missionId ? { ...item, visibleToKids: !(item.visibleToKids ?? true) } : item)),
    );
  }

  /** Let parents choose which savings goals kids can see (default: visible). */
  function toggleGoalVisibility(goalId: string) {
    setGoals((items) =>
      items.map((item) => (item.id === goalId ? { ...item, visibleToKids: !(item.visibleToKids ?? true) } : item)),
    );
  }

  function approveNeighborhoodJob(jobId: string) {
    const job = neighborhoodJobs.find((item) => item.id === jobId);
    if (!job?.acceptedBy) return;
    const missionId = `mission-${job.id}`;
    if (!missions.some((mission) => mission.id === missionId)) {
      setMissions((items) => [
        {
          id: missionId,
          title: job.title,
          category: "community",
          difficulty: job.rewardDollars >= 8 ? "hard" : "medium",
          points: job.rewardDollars >= 8 ? 26 : 18,
          coins: job.rewardDollars > 0 ? 3 : 1,
          allowanceDollars: job.rewardDollars,
          assignedChildId: job.acceptedBy,
          question: `${job.checklist.join(" / ")}. What did you notice about ${job.pet}? Skill focus: ${getLifeSkillLabel(job.skillFocus ?? "teamwork")}.`,
          status: "pending",
        },
        ...items,
      ]);
    }
    setNeighborhoodJobs((items) => items.map((item) => (item.id === jobId ? { ...item, status: "approved", missionId } : item)));
  }

  /**
   * Step 4 of the parent-gated neighborhood flow: after the parent approves
   * the kid's completion, the parent (and only the parent) sends the
   * response to the posting parent. The message is anonymized — no kid PII.
   */
  function markPosterThanked(jobId: string) {
    setNeighborhoodJobs((items) =>
      items.map((job) => (job.id === jobId && job.status === "completed" ? { ...job, posterThanked: true } : job)),
    );
  }

  return (
    <main className="tailtots-app min-h-screen bg-[#faf8f0] text-[#17231f]">
      <header className="sticky top-0 z-20 border-b border-[#ded8c7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
            <img src="/tailtots-logo.png" alt="TailTots logo" className="h-12 w-auto shrink-0 rounded-lg object-contain sm:h-14" />
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight sm:text-xl">TailTots</h1>
              <p className="hidden text-xs font-bold text-[#69736f] sm:block">Parent-guided real-world growth.</p>
              {!isRouteChooser && (
                <p className="mt-1 inline-flex max-w-full items-center rounded-full bg-[#fff4d8] px-2 py-1 text-[11px] font-black leading-4 text-[#7a4b12] sm:hidden">
                  <span className="truncate">{operatorLabel}</span>
                </p>
              )}
            </div>
          </div>
          {!isRouteChooser && (
          <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <div className="hidden min-h-11 items-center rounded-full border border-[#ded8c7] bg-white px-4 text-xs font-black text-[#17231f] md:flex">
              {operatorLabel}
            </div>
            {role === "child" && dailyChecksEnabled && (
              <div
                className="flex min-h-11 items-center rounded-full border border-[#ded8c7] bg-[#e7f4ef] px-4 text-xs font-black text-[#165a4b]"
                title="About a minute per visit keeps TailTots a helper, not a habit."
              >
                ⚡ {Math.max(0, maxDailyChecks - checksUsed)} of {maxDailyChecks} check-ins left today
              </div>
            )}
            <div className="flex rounded-full border border-[#ded8c7] bg-[#faf8f0] p-1 text-xs font-black">
              {(["parent", "child"] as Role[]).map((item) => (
                <button
                  key={item}
                  aria-label={`Switch to ${item} mode`}
                  onClick={() => switchRole(item)}
                  className={`min-h-10 rounded-full px-3 py-2 capitalize sm:min-h-11 sm:px-5 ${role === item ? "bg-[#165a4b] text-white" : "text-[#4f625b]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </header>

      {!isRouteChooser && (
        <div className="border-b border-[#ded8c7] bg-[#ffffff]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:px-5">
            <button onClick={openRouteChooser} className="min-h-10 rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-xs font-black text-[#17231f]">
              Start page
            </button>
            <button onClick={openContactSection} className="min-h-10 rounded-lg bg-[#165a4b] px-3 py-2 text-xs font-black text-white">
              Contact us
            </button>
          </div>
        </div>
      )}

      <section className={`mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-5 md:gap-5 ${
        isRouteChooser ? "grid-cols-1" : "lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]"
      }`}>
        <aside className={`min-w-0 space-y-3 lg:space-y-4 ${isRouteChooser ? "hidden" : ""}`}>
          <div className="rounded-lg border border-[#ded8c7] bg-white p-3 shadow-sm">
            {familyPhotoUrl ? (
              <figure className="relative rotate-[-1.5deg] rounded-md bg-white p-3 pb-3 shadow-[0_12px_32px_rgba(23,35,31,0.20)] ring-1 ring-[#e5ddc8]">
                <span aria-hidden="true" className="absolute -top-2.5 left-8 z-10 h-6 w-20 -rotate-[8deg] rounded-[2px] bg-[#ffd166]/85 shadow-sm" />
                <span aria-hidden="true" className="absolute -top-2.5 right-8 z-10 h-6 w-20 rotate-[8deg] rounded-[2px] bg-[#7dd3fc]/75 shadow-sm" />
                <div className="overflow-hidden rounded-[3px]">
                  <img src={familyPhotoUrl} alt={`${familyName} family photo`} className="h-60 w-full object-cover sm:h-72 lg:h-[26rem]" />
                </div>
                <figcaption className="flex items-center justify-between gap-2 px-1 pt-3">
                  <p className="truncate text-sm font-black text-[#17231f]">The {familyName} family 📸</p>
                  <span className="shrink-0 rounded-full bg-[#e7f4ef] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#165a4b]">
                    {appMode === "real" ? "Your family" : "Demo family"}
                  </span>
                </figcaption>
              </figure>
            ) : (
              <div className="relative min-h-[220px] max-w-full overflow-hidden rounded-md bg-[linear-gradient(135deg,#165a4b,#f47b20_58%,#2563eb)] sm:min-h-[280px] lg:min-h-[430px]">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="absolute left-8 top-16 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#6d3ed1] shadow-sm animate-[reward-pop_2.8s_ease-in-out_infinite]">+coins</div>
                  <div className="absolute right-8 top-24 rounded-full bg-[#ffd166] px-3 py-1 text-xs font-black text-[#17231f] shadow-sm animate-[reward-pop_3.2s_ease-in-out_infinite]">badge</div>
                  <div className="absolute bottom-28 left-10 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#165a4b] shadow-sm animate-[reward-pop_3.5s_ease-in-out_infinite]">done</div>
                  <FamilyFaceParade parents={parents} childProfiles={children} pets={pets} animated />
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#165a4b] shadow-sm">
                  {appMode === "real" ? "Your family" : "Demo family"}
                </div>
              </div>
            )}
            <div className="px-1 pb-1 pt-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Household</p>
              <h2 className="text-2xl font-black leading-tight text-[#17231f] sm:text-3xl">{familyName}</h2>
              {role === "parent" && isParentUnlocked && (
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-xs font-black text-[#17231f] shadow-sm">
                  Family photo
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => updateFamilyPhoto(event.target.files?.[0])} />
                </label>
                <button onClick={() => setActiveTab("pets")} className="min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-xs font-black text-white shadow-sm">
                  Pets
                </button>
              </div>
              )}
            </div>
          </div>

          {role === "child" && (
            <ChildProfileSwitcher
              activeChild={activeChild}
              childProfiles={children}
              requestChildSwitch={requestChildSwitch}
            />
          )}

          {(role === "child" || isParentUnlocked) && (
          <nav className="grid grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:overflow-visible lg:pb-0">
            {visibleTabs.filter((tab) => tab.id !== "vision").map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 min-w-max rounded-lg px-4 py-3 text-left text-sm font-black lg:min-h-12 ${
                  visibleActiveTab === tab.id ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          )}
        </aside>

        <div className="space-y-5">
          {role === "parent" && visibleActiveTab === "vision" && (
            <VisionLandingPanel
              openParentDemo={openParentDemo}
              openKidDemo={openKidDemo}
              previewChildName={children[0]?.name ?? "Demo Kid"}
              previewFamilyName={familyName || "Demo Crew"}
            />
          )}
          {checksExhausted ? (
            <section className="rounded-3xl border border-[#ded8c7] bg-white p-8 text-center shadow-sm">
              <p className="text-5xl" aria-hidden="true">🌱</p>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#165a4b]">All paced for today</p>
              <h2 className="mt-2 text-3xl font-black">That's {maxDailyChecks} check-ins — nicely done!</h2>
              <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-[#4f625b]">
                About a minute per visit keeps TailTots a helper, not a habit. The app will be right here tomorrow — go play, rest, and come back fresh. 💛
              </p>
              <p className="mt-3 text-xs font-bold text-[#69736f]">Grown-ups: adjust or pause check-ins anytime in Family Setup.</p>
            </section>
          ) : (
          (role === "child" || isParentUnlocked) && (
          <>
          {visibleActiveTab === "missions" && (
            <>
              <Hero
                child={activeChild}
                childProfiles={children}
                setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
                pendingCount={pendingApprovals.length}
                taskProgress={taskProgress}
                approvedMissionCount={activeApprovedMissionCount}
                pets={pets}
                setActiveTab={setActiveTab}
                role={role}
              />
              <MissionsPanel
                activeChild={activeChild}
                missions={role === "parent" ? activeChildMissions : kidVisibleMissions}
                pets={pets}
                allChildren={children}
                missionNote={missionNote}
                setMissionNote={setMissionNote}
                completeMission={completeMission}
                repeatMission={repeatMission}
                role={role}
                nudgedMissionIds={nudgedMissionIds}
                onNudgeMission={(missionId) => setNudgedMissionIds((ids) => (ids.includes(missionId) ? ids : [...ids, missionId]))}
              />
            </>
          )}
          {visibleActiveTab === "schedule" && (
            <SchedulePanel
              activeChild={activeChild}
              childProfiles={children}
              missions={role === "parent" ? missions : kidVisibleMissions}
              scheduleItems={scheduleItems}
              role={role}
              setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
              familyName={familyName}
            />
          )}
          {visibleActiveTab === "pets" && (
            <PassportPanel
              pets={pets}
              missions={missions}
              isParentView={role === "parent"}
              updatePet={updatePet}
              updatePetPhoto={role === "parent" ? updatePetPhoto : undefined}
              onStudyComplete={recordPassportStudy}
              studiedAnimals={studiedAnimals}
            />
          )}
          {visibleActiveTab === "pet-helper" && (
            <KidAiBuddyPanel
              activeChild={activeChild}
              pets={pets}
              moments={moments}
              childProfiles={children}
              socialPracticeDone={socialPracticeDone}
              onAnswerSocialScenario={answerSocialScenario}
              scheduleItems={scheduleItems}
              onHelperUse={logHelperUse}
            />
          )}
          {visibleActiveTab === "bank" && (
            <BankPanel
              child={activeChild}
              childProfiles={children}
              setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
              transactions={transactions}
              goals={goals}
              requestBankMove={requestBankMove}
              newGoal={newGoal}
              setNewGoal={setNewGoal}
              addSavingsGoal={addSavingsGoal}
              confirmDonation={confirmDonation}
              isParentView={role === "parent"}
              setActiveTab={setActiveTab}
              pointsPerDollar={pointsPerDollar}
            />
          )}
          {visibleActiveTab === "approvals" && (
            <div className="space-y-4">
              <EnterpriseReadinessPanel />
              <MissionAssignmentPanel
                missions={missions}
                childProfiles={children}
                badges={badges}
                assignMission={assignMission}
                autoBalanceMissions={autoBalanceMissions}
              />
              <ApprovalsPanel
                missions={missions}
                transactions={transactions}
                childProfiles={children}
                approveMission={approveMission}
                approveTransaction={approveTransaction}
                rejectMission={rejectMission}
                rejectTransaction={rejectTransaction}
              />
            </div>
          )}
          {visibleActiveTab === "setup" && (
            <FamilySetupPanel
              cloudAccountEmail={cloudAccountEmail}
              accountDraft={accountDraft}
              setAccountDraft={setAccountDraft}
              accountStatus={accountStatus}
              accountMessage={accountMessage}
              sendParentSignInLink={sendParentSignInLink}
              magicLinkSent={magicLinkSent}
              signOutParentAccount={signOutParentAccountFromApp}
              saveCurrentFamilyAccount={saveCurrentFamilyAccount}
              loadCurrentFamilyAccount={loadCurrentFamilyAccount}
              cloudFamilyReady={cloudFamilyId !== null}
              cloudSyncOn={cloudSyncOn}
              cloudSyncStatus={cloudSyncStatus}
              cloudSyncMessage={cloudSyncMessage}
              enableCloudSyncNow={enableCloudSyncNow}
              familyName={familyName}
              setFamilyName={setFamilyName}
              lastSavedAt={lastSavedAt}
              parents={parents}
              updateParent={updateParent}
              updateParentPhoto={updateParentPhoto}
              childProfiles={children}
              updateChild={updateChild}
              updateChildPhoto={updateChildPhoto}
              pets={pets}
              updatePet={updatePet}
              updatePetPhoto={updatePetPhoto}
              newChild={newChild}
              setNewChild={setNewChild}
              addChild={addChild}
              removeChild={removeChild}
              newPet={newPet}
              setNewPet={setNewPet}
              addPet={addPet}
              updateFamilyPhoto={updateFamilyPhoto}
              updateFamilyPhotoAndPickProfiles={updateFamilyPhotoAndPickProfiles}
              pickProfilesFromSavedFamilyPhoto={pickProfilesFromSavedFamilyPhoto}
              hasFamilyPhoto={Boolean(familyPhotoUrl)}
              parentPasscode={parentPasscode}
              setParentPasscode={setParentPasscode}
              pointsPerDollar={pointsPerDollar}
              setPointsPerDollar={setPointsPerDollar}
              dailyChecksEnabled={dailyChecksEnabled}
              setDailyChecksEnabled={setDailyChecksEnabled}
              maxDailyChecks={maxDailyChecks}
              setMaxDailyChecks={setMaxDailyChecks}
            />
          )}
          {visibleActiveTab === "growth" && role === "parent" && (
            <GrowthPanel
              childProfiles={children}
              badges={badges}
              moments={moments}
              momentDraft={momentDraft}
              setMomentDraft={setMomentDraft}
              addMoment={addMoment}
              missions={missions}
              certificates={certificates}
              familyName={familyName}
              hasPets={pets.length > 0}
              activeChildId={activeChild?.id}
              onSelectChild={role === "parent" ? setActiveChildId : undefined}
              socialPracticeDone={socialPracticeDone}
              onAnswerSocialScenario={answerSocialScenario}
            />
          )}
          {visibleActiveTab === "neighborhood" && (
            <NeighborhoodPanel
              goals={goals}
              childProfiles={children}
              activeChild={activeChild}
              role={role}
              jobs={neighborhoodJobs}
              jobDraft={jobDraft}
              setJobDraft={setJobDraft}
              postJob={postNeighborhoodJob}
              acceptJob={acceptNeighborhoodJob}
              approveJob={approveNeighborhoodJob}
              toggleJobVisibility={toggleNeighborhoodJobVisibility}
              markPosterThanked={markPosterThanked}
              fillJobTemplate={fillJobTemplate}
              transactions={transactions}
              setActiveTab={setActiveTab}
              allMissions={missions}
              toggleMissionVisibility={toggleMissionVisibility}
              toggleGoalVisibility={toggleGoalVisibility}
              familyZip={familyZip}
              setFamilyZip={setFamilyZip}
            />
          )}
          {visibleActiveTab === "ai" && <AIPanel childProfiles={children} missions={missions} parentSignedIn={Boolean(cloudAccountEmail)} />}
          </>
          ))}
        </div>
      </section>
      {photoCropDraft && (
        <PhotoCropModal
          draft={photoCropDraft}
          setDraft={setPhotoCropDraft}
          saveCrop={savePhotoCrop}
          close={() => {
            setPendingPhotoCropQueue([]);
            setPhotoCropDraft(undefined);
          }}
        />
      )}
      {parentGateOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17231f]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Grown-ups only">
          <div className="tt-animate-pop-in w-full max-w-sm rounded-3xl border border-[#ded8c7] bg-white p-6 text-center shadow-2xl sm:p-8">
            <p className="text-5xl" aria-hidden="true">🔒</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-[#165a4b]">Grown-ups only</p>
            <p className="mt-2 text-xl font-black text-[#17231f]">Enter the parent passcode</p>
            <p className="mx-auto mt-2 max-w-xs text-sm font-semibold leading-6 text-[#4f625b]">
              Parent controls stay behind your passcode. You can change it anytime in Family Setup.
            </p>
            <label className="mt-4 block text-left text-xs font-black uppercase tracking-[0.14em] text-[#4f625b]">
              Parent passcode
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={gateInput}
                onChange={(event) => { setGateInput(event.target.value); setGateError(false); }}
                onKeyDown={(event) => { if (event.key === "Enter") submitParentGate(); }}
                placeholder="••••"
                className={`mt-2 w-full rounded-xl border-2 bg-white px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-[#17231f] outline-none ${gateError ? "border-red-500" : "border-[#ded8c7] focus:border-[#165a4b]"}`}
              />
            </label>
            {gateError && <p className="mt-2 text-sm font-black text-red-600">That passcode did not match. Try again.</p>}
            <p className="mt-3 text-xs font-semibold text-[#8a8f8b]">Demo passcode: 4321 — change it in Family Setup.</p>
            <div className="mt-4 grid gap-2">
              <button
                onClick={submitParentGate}
                className="tt-btn-press min-h-12 w-full rounded-xl bg-[#165a4b] px-5 py-3 text-sm font-black text-white"
              >
                Unlock parent mode
              </button>
              <button
                onClick={() => setParentGateOpen(false)}
                className="tt-btn-press min-h-12 w-full rounded-xl border-2 border-[#ded8c7] bg-white px-5 py-3 text-sm font-black text-[#4f625b]"
              >
                Back to kid mode
              </button>
            </div>
          </div>
        </div>
      )}
      {(() => {
        // Full-screen takeover: a certificate moment should interrupt whatever tab is active.
        const earned = certificates.find((cert) => cert.id === justEarnedCertId);
        if (!earned) return null;
        const earnedChild = children.find((child) => child.id === earned.childId);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#17231f]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Certificate earned">
            <div className="tt-animate-pop-in w-full max-w-md rounded-3xl border-4 border-double border-[#6d3ed1]/40 bg-white p-6 text-center shadow-2xl sm:p-8">
              <p className="text-5xl" aria-hidden="true">🎓</p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-[#6d3ed1]">Certificate earned</p>
              <p className="mt-2 text-2xl font-black text-[#17231f]">{earnedChild?.name ?? "Your kid"} just earned: {earned.title}!</p>
              <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#4f625b]">
                {earned.kind === "hero"
                  ? "Real pet care, proven over time. From pet owner to pet hero — frame it."
                  : "The pet-care journey, completed. This is the case for a real pet — framed and ready."}
              </p>
              <div className="mt-6 grid gap-2">
                <button
                  onClick={() => { if (earnedChild) downloadCertificate(earnedChild, earned, familyName); }}
                  className="tt-btn-press min-h-12 w-full rounded-xl bg-[#6d3ed1] px-5 py-3 text-sm font-black text-white"
                >
                  🖨️ Print / save the certificate
                </button>
                <button
                  onClick={() => setJustEarnedCertId(null)}
                  className="tt-btn-press min-h-12 w-full rounded-xl border-2 border-[#6d3ed1]/30 bg-white px-5 py-3 text-sm font-black text-[#6d3ed1]"
                >
                  Celebrate 🎉
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

function CountUp({ to, prefix, durationMs }: { to: number; prefix?: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [value, setValue] = useState(() => (reducedMotion ? to : 0));
  const [started, setStarted] = useState(() => reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, to]);
  useEffect(() => {
    if (!started || reducedMotion) return;
    const total = durationMs ?? 1300;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, reducedMotion, to, durationMs]);
  return (
    <span ref={ref}>
      {prefix ?? ""}
      {value.toLocaleString()}
    </span>
  );
}

function ShelterGivingShowcase() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">🐶 Shelter giving, fundraising-style</p>
          <h4 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">Real dogs. Real goals. Real bragging rights.</h4>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/70 ring-1 ring-white/15">
          Illustrative example
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/70">
        You set the goal and fund it — your kid picks the cause and works for it. Here’s what a family giving goal looks like when it’s running:
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { emoji: "🦴", to: 1200, label: "treats funded", note: "one good deed at a time" },
          { emoji: "🚶", to: 340, label: "shelter walks logged", note: "real legs, real dogs" },
          { emoji: "🧸", to: 85, label: "toy drives completed", note: "squeaky ones preferred" },
        ].map((stat) => (
          <div key={stat.label} className="tt-card-lift rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/15">
            <p className="text-2xl" aria-hidden="true">{stat.emoji}</p>
            <p className="mt-1 text-3xl font-black text-tt-sun">
              <CountUp to={stat.to} />
            </p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-white/80">{stat.label}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/55">{stat.note} · example figures</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/70">Example goal thermometer</p>
          <p className="mt-1 text-sm font-black text-white">Chew-toy fund for Sunny Paws Shelter</p>
          <div className="mt-4 flex items-end justify-center gap-4">
            <div className="relative h-44 w-10 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20" role="img" aria-label="Example goal thermometer showing 65 percent raised">
              <div className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-tt-tang to-tt-sun" style={{ height: "65%" }} />
              <div className="absolute inset-x-0 bottom-0 flex items-start justify-center pt-2 text-[11px] font-black text-tt-ink">65%</div>
            </div>
            <div className="pb-1 text-sm font-bold leading-6 text-white/75">
              <p><span className="text-lg font-black text-tt-sun">$65</span> raised</p>
              <p>of an example <span className="font-black text-white">$100</span> goal</p>
              <p className="mt-2 text-xs font-semibold text-white/60">Every mission nudges the mercury. Kids can literally watch kindness rise. 🌡️</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {[
            { title: "Example: Senior-dog blanket drive", meta: "Kid picked · Parent funded", pct: 80, line: "12 of 15 blankets — the shelter naps are about to get luxurious." },
            { title: "Example: New-leash-on-life fund", meta: "Kid picked · Parent funded", pct: 45, line: "Almost halfway to 20 leashes. The dogs are already practicing their strut." },
          ].map((card) => (
            <article key={card.title} className="tt-card-lift rounded-2xl bg-white p-4 text-tt-ink shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">{card.title}</p>
                <span className="rounded-full bg-tt-pine-tint px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-tt-pine">{card.meta}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-tt-sand">
                <div className="h-3 rounded-full bg-gradient-to-r from-tt-pine to-tt-tang" style={{ width: `${card.pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-tt-ink-soft">{card.line}</span>
                <span className="ml-2 shrink-0 font-black text-tt-pine">{card.pct}%</span>
              </div>
            </article>
          ))}
          <p className="text-[11px] font-semibold text-white/55">Campaign-style cards, parent-funded, kid-earned. Figures shown are examples, not real totals.</p>
        </div>
      </div>
    </div>
  );
}

function VisionLandingPanel({
  openParentDemo,
  openKidDemo,
  previewChildName,
  previewFamilyName,
}: {
  openParentDemo: () => void;
  openKidDemo: () => void;
  previewChildName: string;
  previewFamilyName: string;
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [launchInterest, setLaunchInterest] = useState({ email: "" });
  const [launchInterestStatus, setLaunchInterestStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [launchInterestMessage, setLaunchInterestMessage] = useState("");
  // Once a visitor joins, every launch form collapses into a "you're in" note (persisted per device).
  const [launchJoined, setLaunchJoined] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("tt-launch-joined") === "1";
    } catch {
      return false; // private mode: stay unjoined
    }
  });
  const [feedbackDraft, setFeedbackDraft] = useState({ email: "", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [certCelebrating, setCertCelebrating] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const journeySteps = [
    ["🔍", "Learn the animal", "Pet Passports decode what the pet really needs — food, space, costs, lifespan. Fantasy out, respect in."],
    ["🎯", "Own the routine", "Daily age-fit missions. Have a pet? Your kid takes over the real routine — feeding, water, comfort checks, for real this time. Don’t? Parent-set home and community chores: the nagging you already do becomes the training ground."],
    ["📈", "Prove it over time", "Streaks plus your approvals build the proof record — day after day, toward sixty and beyond. Certificates mark the milestones along the way. This answers “will they stick with it?”"],
    ["🎓", "Earn the certificate", "The proof record, framed. No pet yet? It’s the case for one. Have one? It’s the title: Certified Pet Hero."],
    ["🌟", "Grow beyond the routine", "Missions grow with your kid — skills, money smarts, and giving: donate, fund real causes, build real-world confidence. Same missions, every doorway."],
  ];
  const platformPillars = [
    ["🌐", "Safe social practice", "Training wheels for real-world social life. Kids practice teamwork, leadership, and empathy — with zero strangers, zero feeds, zero DMs."],
    ["🦸", "Character, on purpose", "Responsibility, kindness, honesty: a real character curriculum taught through missions, not lectures."],
    ["🛠️", "Skills that compound", "Time, money, helping at home — the unglamorous skills that quietly run adulthood."],
    ["🐶", "Real shelter dogs", "Kindness that leaves the screen. Kids work toward real giving for real dogs waiting in real shelters."],
    ["🧹", "Chores & neighborhood", "Helper missions at home and around the block. The real world is the playground."],
    ["🎯", "Parent-set donation goals", "You set the goal and fund it — your kid picks the cause and works for it. Giving, earned."],
  ];
  const trustChips = [
    "Private by design",
    "Parents approve everything",
    "Guided AI — never open chat",
    "No rankings, no ads, no strangers",
  ];
  const kidsPetPhotos = [
    ["African American family — kid + dog", "/landing/household-african-american-dog.jpg"],
    ["South Asian family — kid + cat", "/landing/household-south-asian-cat.jpg"],
    ["East Asian family — kid + rabbit", "/landing/household-east-asian-rabbit.jpg"],
    ["Latino family — kid + guinea pig", "/landing/household-latino-guinea-pig.jpg"],
  ];
  const kindnessPrompts = [
    "Leave a painted rock where a neighbor will find it. 🪨",
    "Teach your pet one tiny new trick. Treats help. 🦜",
    "Draw a thank-you card for your mail carrier. ✉️",
    "Donate one toy you’ve outgrown. Someone’s treasure awaits. 🧸",
    "Water a thirsty plant like it’s a VIP guest. 🌱",
    "Ask a grandparent about their first pet. Take notes. 📞",
    "Pick up 5 pieces of litter on your street. Captain Planet mode. 🌍",
    "Build your pet a blanket-fort lounge. Interior design counts. 🏕️",
    "Write down the funniest thing your pet did today. 📝",
    "Share a snack with a sibling. Yes, even the good one. 🍪",
  ];
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const todayPrompt = kindnessPrompts[dayOfYear % kindnessPrompts.length];

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  async function joinLaunchList() {
    setLaunchInterestStatus("saving");
    setLaunchInterestMessage("");
    try {
      const result = await submitLaunchInterest({
        email: launchInterest.email,
        source: "vision-landing",
      });
      setLaunchInterestStatus("saved");
      setLaunchInterestMessage(result.mode === "cloud" ? "You’re on the list! Check your inbox for tail wags soon. 🐾" : "Thanks — you’re on the TailTots update list.");
      setLaunchInterest({ email: "" });
      setLaunchJoined(true);
      try { window.localStorage.setItem("tt-launch-joined", "1"); } catch { /* private mode */ }
    } catch (error) {
      setLaunchInterestStatus("error");
      setLaunchInterestMessage(error instanceof Error ? error.message : "Could not save this signup yet.");
    }
  }

  async function sendWebsiteFeedback() {
    setFeedbackStatus("saving");
    setFeedbackMessage("");
    try {
      const result = await submitFeedback({
        email: feedbackDraft.email,
        message: feedbackDraft.message,
        source: "vision-contact",
      });
      setFeedbackStatus("saved");
      setFeedbackMessage(result.mode === "cloud" ? "Thanks — your note reached TailTots." : "Thanks — your note was saved on this device.");
      setFeedbackDraft({ email: "", message: "" });
    } catch (error) {
      setFeedbackStatus("error");
      setFeedbackMessage(error instanceof Error ? error.message : "Could not send this note yet.");
    }
  }

  async function shareText(text: string, okMessage: string) {
    setShareMessage("");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "TailTots", text });
        setShareMessage("Shared! You’re officially a TailTots ambassador. 🎉");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMessage(okMessage);
      } else {
        setShareMessage("Copy this page’s link and send it to your favorite parent. 💌");
      }
    } catch {
      setShareMessage("");
    }
  }

  const scrollToLandingSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    const fixedHeaderOffset = 150;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - fixedHeaderOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  };

  return (
    <section className="space-y-5">
      {showBackToTop && (
        <button
          onClick={() => scrollToLandingSection("landing-home")}
          className="tt-btn-press fixed bottom-5 right-5 z-40 min-h-11 rounded-full bg-tt-pine px-4 py-2 text-sm font-black text-white shadow-lg ring-1 ring-white/50"
          aria-label="Back to top"
        >
          Top
        </button>
      )}

      {/* ============ HERO: the pet-led hook ============ */}
      <div id="landing-home" className="relative -mx-3 scroll-mt-36 overflow-hidden border-y border-tt-line bg-tt-cream text-tt-ink shadow-sm sm:mx-0 sm:rounded-3xl sm:border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_8%,rgba(255,209,102,0.4),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_92%_88%,rgba(22,90,75,0.14),transparent_70%)]" aria-hidden="true" />
        <svg className="pointer-events-none absolute bottom-16 left-[6%] hidden w-64 text-tt-pine opacity-[0.13] md:block lg:w-80" viewBox="0 0 320 80" aria-hidden="true">
          <defs>
            <g id="tt-paw">
              <ellipse cx="0" cy="8" rx="9" ry="7" />
              <circle cx="-12" cy="-4" r="3.6" /><circle cx="-4" cy="-9" r="3.6" /><circle cx="5" cy="-9" r="3.6" /><circle cx="13" cy="-4" r="3.6" />
            </g>
          </defs>
          <g fill="currentColor">
            <use href="#tt-paw" transform="translate(24,54) rotate(-18)" />
            <use href="#tt-paw" transform="translate(104,62) rotate(12)" />
            <use href="#tt-paw" transform="translate(184,48) rotate(-10)" />
            <use href="#tt-paw" transform="translate(264,58) rotate(16)" />
          </g>
        </svg>
        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center xl:p-10">
          <div className="min-w-0">
            <h2 className="tt-display mt-4 max-w-2xl text-[2.75rem] font-black leading-[1.04] text-tt-navy sm:text-6xl">
              The pet is the <span className="relative inline-block px-1"><span className="absolute inset-0 -rotate-1 rounded bg-tt-sun/70" aria-hidden="true" /><span className="relative italic">hook.</span></span> The skills are the point.
            </h2>
            <p className="mt-4 max-w-xl text-lg font-bold leading-7 text-tt-navy-soft">
              It starts with the question you’ve heard 47 times — “Can we get a puppy?!” — and turns into real life skills you can actually see: responsibility kept, empathy grown, confidence earned.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              Three doors in: kids who <strong className="font-black text-tt-navy">have</strong> a pet, kids <strong className="font-black text-tt-navy">earning</strong> the right to get one, and kids growing through <strong className="font-black text-tt-navy">shelter giving and life skills</strong>. Parent-approved missions, about 30 seconds of your day — and a kid who starts stepping up on their own.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              No strangers, no chats, no doomscroll. Just capable kids, lighter parenting — and a little of your evening back, including that cup of coffee, finally finished hot.
            </p>

            {/* PRIMARY: launch capture. SECONDARY: kid demo. Never equal weight. */}
            {launchJoined ? (
              <p className="mt-6 max-w-xl rounded-2xl border-2 border-tt-pine bg-tt-pine-tint p-4 text-sm font-black text-tt-pine">
                🎉 You’re on the launch list! Watch your inbox for tail wags.
              </p>
            ) : (
            <form
              className="mt-6 max-w-xl rounded-2xl border-2 border-tt-pine bg-white p-3 shadow-[0_10px_30px_-12px_rgba(22,90,75,0.35)] sm:p-4"
              onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
            >
              <label htmlFor="hero-launch-email" className="text-xs font-black uppercase tracking-[0.14em] text-tt-pine">
                👨‍👩‍👧 Get your family on the launch list
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  id="hero-launch-email"
                  value={launchInterest.email}
                  onChange={(event) => setLaunchInterest({ email: event.target.value })}
                  className="min-h-12 rounded-xl border border-tt-line bg-tt-cream px-4 text-sm font-bold text-tt-ink placeholder:text-tt-ink-faint"
                  inputMode="email"
                  placeholder="Parent email (no spam, only tail wags)"
                  type="email"
                  required
                />
                <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press min-h-12 rounded-xl bg-tt-tang px-6 py-3 text-sm font-black text-white shadow-md disabled:opacity-60">
                  {launchInterestStatus === "saving" ? "Saving…" : "Join free 🚀"}
                </button>
              </div>
              {launchInterestMessage && (
                <p className={`mt-2 text-sm font-bold ${launchInterestStatus === "error" ? "text-[#b44421]" : "text-tt-pine"}`} role="status">
                  {launchInterestMessage}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-tt-ink-faint">Free for families. Unsubscribe anytime. Your inbox stays boring; your kids won’t.</p>
            </form>
            )}

            <button onClick={openKidDemo} className="tt-btn-press group mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-tt-pine underline decoration-tt-sun decoration-[3px] underline-offset-4">
              <span aria-hidden="true">👀</span> Skeptical? Let your kid try a mission first
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </button>
          </div>

          {/* Real product visual: the actual Mission Mode UI, alive */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="tt-animate-float-slow absolute -left-4 -top-6 z-10 rotate-[-8deg] rounded-2xl border border-tt-line bg-white px-4 py-3 shadow-lg" aria-hidden="true">
              <p className="text-2xl">📚</p>
              <p className="mt-1 text-[11px] font-black text-tt-ink">Reading practice — Done ✓</p>
            </div>
            <div className="tt-animate-float absolute -right-3 top-1/3 z-10 rotate-[7deg] rounded-2xl border border-tt-line bg-white px-4 py-3 shadow-lg" aria-hidden="true">
              <p className="text-2xl">🏅</p>
              <p className="text-[11px] font-black text-tt-ink">+8 points!</p>
            </div>
            <article className="tt-card-lift tt-animate-pop-in relative rounded-3xl border border-tt-line bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-tang">Mission Mode</p>
                <span className="rounded-full bg-tt-pine-tint px-3 py-1 text-[11px] font-black text-tt-pine">Parent approved ✓</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <ProfilePhoto label="TailTots pet Jack" initial="J" colors={petLooks.jack.colors} size="md" variant="pet" petKind="guinea" />
                <p className="text-base font-black leading-6 text-tt-ink">Hi Maya. Jack needs fresh water and a comfort check.</p>
              </div>
              <ol className="mt-4 grid gap-2">
                {["Fill the bottle", "Check the bowl", "Notice how Jack responds"].map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-xl bg-tt-cream px-3 py-2.5 text-sm font-bold text-tt-ink-soft">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tt-pine text-xs font-black text-white">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <button onClick={openKidDemo} className="tt-btn-press mt-4 min-h-12 w-full rounded-xl bg-tt-pine px-5 py-3 text-sm font-black text-white">
                Start this mission →
              </button>
              <p className="mt-2 text-center text-xs font-semibold text-tt-ink-faint">This is the real kid screen — not a mockup. Go on, tap it.</p>
            </article>
          </div>
        </div>

        {/* marquee of playful proof */}
        <div className="relative overflow-hidden border-t border-tt-line bg-white/70 py-3" aria-hidden="true">
          <div className="tt-marquee-track gap-8 text-sm font-black text-tt-navy-soft">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-8">
                {["🐾 Real pets, real chores", "💰 Kid Bank: earn · save · give", "🎯 Parent-set giving goals", "🐶 Giving goals for shelter dogs", "🛡️ Parents approve everything", "🚫 Zero stranger chat", "🏅 Badges worth bragging about", "🤖 Guided AI, kid-safe"].map((item) => (
                  <span key={`${copy}-${item}`} className="whitespace-nowrap">{item}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ HERO ILLUSTRATION: the dream, painted ============ */}
      <section aria-label="A TailTots evening at home" className="-mx-3 overflow-hidden border-y border-tt-line bg-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border">
        <div className="grid items-center gap-6 p-5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-tang">6:47 PM at your house</p>
            <h3 className="mt-2 text-2xl tt-display font-black text-tt-navy sm:text-3xl">This is what responsibility looks like.</h3>
            <p className="mt-2 max-w-lg text-[15px] font-semibold leading-6 text-tt-ink-soft">
              No nagging. No charts on the fridge. Just a kid who noticed the water bowl was low — because Jack, Captain, and RB are <em>their</em> crew now.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-lg ring-1 ring-tt-line">
            <img src="/hero-kids-pets.png" alt="Two kids caring for their guinea pig, tortoise, and fish at home" className="w-full object-cover" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ============ DOCTRINE: the 10-second parent version ============ */}
      <section aria-label="The TailTots doctrine" className="relative -mx-3 overflow-hidden border-y border-tt-line bg-tt-night text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(255,209,102,0.08),transparent_70%)]" aria-hidden="true" />
        <div className="relative p-5 sm:p-8 lg:p-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-tt-sun">The TailTots doctrine</p>
          <h3 className="tt-display mt-3 max-w-3xl text-4xl font-black leading-[1.05] sm:text-5xl">
            The 10-second version,<br />in plain parent language.
          </h3>
          <p className="mt-4 max-w-3xl text-[15px] font-semibold leading-7 text-white/70">
            No lectures. No sticker charts you’ll forget by Friday. Just small daily missions that quietly build a capable, caring kid — with proof you can actually see.
          </p>

          <ol className="mt-8">
            {[
              ["What changes", "A more responsible, empathetic, confident kid — grown one small daily mission at a time."],
              ["How it happens", "Pet care, kindness, chores, and giving missions your kid actually wants to do — about 30 seconds of your day."],
              ["How you’ll see it", "One-tap approval from you. Streaks and certificates built from real effort — no nagging required."],
              ["Where it all lives", "Character, money skills, shelter giving, and neighborhood missions — one safe place, no strangers, no extra apps."],
            ].map(([title, body], index) => (
              <li key={title} className="grid grid-cols-[3rem_1fr] items-baseline gap-4 border-t border-white/15 py-5 last:border-b sm:grid-cols-[4rem_1fr]">
                <span className="tt-display text-3xl font-black text-[#ff8a65] sm:text-4xl" aria-hidden="true">{index + 1}</span>
                <div>
                  <p className="tt-display text-2xl font-black sm:text-3xl">{title}</p>
                  <p className="mt-1 text-[15px] font-semibold text-white/65">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ FOMO STRIP: founding-family window, directly under the hero ============ */}
      <section aria-label="Founding families" className="relative -mx-3 overflow-hidden border-y border-tt-pine/30 bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-tt-sun/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-tt-tang/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-tt-sun ring-1 ring-white/15">
              <span className="tt-animate-sparkle" aria-hidden="true">🔥</span> Founding 500 · strictly optional, extremely tempting
            </p>
            <h3 className="mt-3 max-w-xl text-2xl font-black tracking-tight sm:text-3xl">
              We’re opening TailTots to our first 500 founding families.
            </h3>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
              Founders get early access, a founding-family badge their kids will absolutely brag about, and first dibs on shelter-giving goals.
              The window closes at launch — no fake countdown, just a real door that shuts when we ship.
            </p>
          </div>
          {launchJoined ? (
            <p className="w-full max-w-md shrink-0 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-black text-tt-sun backdrop-blur">
              🎉 You’re in! Your founding-family spot is claimed.
            </p>
          ) : (
          <form
            className="w-full max-w-md shrink-0 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4"
            onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
          >
            <label htmlFor="fomo-launch-email" className="text-xs font-black uppercase tracking-[0.14em] text-tt-sun">
              🐾 Claim a founding-family spot
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                id="fomo-launch-email"
                value={launchInterest.email}
                onChange={(event) => setLaunchInterest({ email: event.target.value })}
                className="min-h-12 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white placeholder:text-white/50"
                inputMode="email"
                placeholder="Parent email"
                type="email"
                required
              />
              <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press tt-animate-wiggle-hover min-h-12 rounded-xl bg-tt-tang px-6 py-3 text-sm font-black text-white shadow-md disabled:opacity-60">
                {launchInterestStatus === "saving" ? "Saving…" : "Save my spot"}
              </button>
            </div>
            {launchInterestMessage && (
              <p className={`mt-2 text-sm font-bold ${launchInterestStatus === "error" ? "text-tt-sun" : "text-white"}`} role="status">
                {launchInterestMessage}
              </p>
            )}
            <p className="mt-2 text-[11px] font-semibold text-white/55">Free for families. One email. Zero spam, only tail wags.</p>
          </form>
          )}
        </div>
      </section>

      {/* ============ PET PROMISE: photos + the required language ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-tang">Exhibit A: your camera roll 📸</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-2xl tt-display font-black text-tt-navy sm:text-3xl">Built around the bond kids already have with animals.</h3>
          <p className="text-sm font-bold text-tt-ink-faint">Several households, different backgrounds — the same bond</p>
        </div>
        <p className="mt-2 max-w-3xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
          That bond is the doorway. On the other side: kids doing <span className="font-black text-tt-ink">real good in the real world</span> —
          caring for shelter dogs, helping neighbors, and earning the giving they choose. Cuteness in, character out.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kidsPetPhotos.map(([label, src]) => (
            <div key={label} className="tt-card-lift group overflow-hidden rounded-2xl bg-tt-sand shadow-sm">
              <img src={src} alt={`${label} learning responsibility with TailTots`} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.04]" loading="lazy" />
            </div>
          ))}
        </div>
        <aside className="mt-4 rounded-2xl border-2 border-dashed border-tt-tang/50 bg-tt-tang-soft/40 p-4">
          <p className="text-sm font-black text-tt-navy">Our pet promise — the fine print we’re proud of:</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tt-ink-soft">
            A pet is never a prize. Adoption is not guaranteed. Parents make the final decision. TailTots readiness does not replace shelter screening.
          </p>
        </aside>
      </section>

      {/* ============ FAST TRACK: three doorways in ============ */}
      <section className="-mx-3 border-y-2 border-tt-pine/40 bg-tt-pine p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">Three doorways in 🐾</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Every family gets a doorway.</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-2xl" aria-hidden="true">🐾</p>
            <p className="mt-1 text-base font-black">Have a pet? You’re the fast track.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/80">
              The biggest crowd. Your kid takes over the real routine — feeding schedules they actually follow, training missions, vet-visit prep —
              and levels up to shelter-hero giving. From “we have a dog” to “my kid <em>runs</em> the dog.”
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-2xl" aria-hidden="true">🎓</p>
            <p className="mt-1 text-base font-black">Want a pet? Earn the case for one.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/80">
              Parent-set home and community missions build the proof record — day after day — toward the Pet Readiness Certificate.
              The real question it answers: will they stick with it?
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-2xl" aria-hidden="true">💛</p>
            <p className="mt-1 text-base font-black">Giving hearts & skill builders.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/80">
              No pet needed. Kids fund real shelter dogs and learn non-pet life skills — money smarts, chores, neighborhood kindness —
              with certificates marking every milestone.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm font-semibold leading-6 text-white/80">
            All three doorways open onto the same giving loop — every crowd can fund real shelter dogs. 🐶
          </p>
          <a href="#landing-demo" className="tt-btn-press min-h-12 shrink-0 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink">
            See it in action →
          </a>
        </div>
      </section>

      {/* ============ DEMO: the aha moment ============ */}
      <section id="landing-demo" className="-mx-3 scroll-mt-36 border-y border-tt-line bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">The aha moment · 60 seconds</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Here is your schedule. Here is your progress towards your goals:</h3>
            <p className="mt-3 max-w-lg text-[15px] font-semibold leading-6 text-white/75">
              One glance tells your kid what’s next — and you, without a single nag, whether it’s done. Every “done” is parent-approved
              and feeds streaks, savings goals, and certificates. Have a pet? Missions run on your real one. Don’t? They build toward it.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={openKidDemo} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink shadow-lg">
                🧒 Try the kid demo
              </button>
              <button onClick={openParentDemo} className="tt-btn-press min-h-12 rounded-xl border-2 border-white/30 bg-white/10 px-6 py-3 text-sm font-black text-white">
                🧑‍💼 See the parent side
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-white/60">Sample family included. Nothing leaves your device in the demo.</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-tt-sun">Today’s plan · {previewChildName}</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <span className="text-sm font-bold"><span aria-hidden="true">📚</span> Reading practice · 15 min</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-tt-sun ring-1 ring-white/15">🔥 12-day streak</span>
                  <span className="rounded-full bg-tt-pine px-2.5 py-1 text-[11px] font-black text-white">Done ✓</span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <span className="text-sm font-bold"><span aria-hidden="true">🐕</span> Feed Max + fresh water</span>
                <span className="shrink-0 rounded-full bg-tt-pine px-2.5 py-1 text-[11px] font-black text-white">Done ✓</span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
                <span className="text-sm font-bold"><span aria-hidden="true">🧹</span> Tidy the living room</span>
                <span className="shrink-0 rounded-full bg-tt-pine px-2.5 py-1 text-[11px] font-black text-white">Done ✓</span>
              </li>
            </ul>
            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-tt-sun">Savings goals</p>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span><span aria-hidden="true">👟</span> Cool shoes</span>
                  <span className="text-white/70">$42 of $60</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[70%] rounded-full bg-tt-sun" />
                </div>
              </div>
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span><span aria-hidden="true">🏰</span> Disney trip</span>
                  <span className="text-white/70">$135 of $500</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full w-[27%] rounded-full bg-tt-sun" />
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs font-semibold text-white/60">Tap “done” each day. Streaks grow. Goals fill up. You approve everything.</p>
          </div>
        </div>
      </section>

      {/* ============ THE JOURNEY: how it actually works, three doorways ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">How it actually works 🗺️</p>
        <h3 className="mt-2 max-w-2xl text-2xl tt-display font-black text-tt-navy sm:text-3xl">From “already done, Mom” to “we funded a shelter dog.”</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tt-ink-soft">
          Every kid walks the same road — mission, action, your approval, streak. Three doorways open onto it: kids who already have a pet (the big crowd,
          real routine from day one), kids who want one (parent-set missions building toward the Pet Readiness Certificate), and kids who donate to shelters
          while learning non-pet life skills. Same road. Same nag-free mornings for you.
        </p>
        <aside className="mt-4 max-w-3xl rounded-2xl border-2 border-tt-pine/30 bg-tt-pine-tint p-4">
          <p className="text-sm font-bold leading-6 text-tt-ink-soft">
            <span aria-hidden="true">🐾 </span><span className="font-black text-tt-navy">Have a pet?</span> Start at step 2 — and it’s not practice. It’s the real routine,
            transferred from you to your kid, with streaks proving it stuck.
            <span aria-hidden="true"> 💛 </span><span className="font-black text-tt-navy">No pet?</span> Every doorway includes shelter-giving missions —
            all three crowds fund real dogs. 🐶
          </p>
        </aside>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {journeySteps.map(([emoji, title, body], index) => (
            <li key={title} className="tt-card-lift relative overflow-hidden rounded-2xl bg-tt-cream p-5">
              <span className="pointer-events-none absolute -right-2 -top-4 select-none text-[5rem] font-black text-tt-pine/10" aria-hidden="true">{index + 1}</span>
              <span className="relative z-10 grid size-10 place-items-center rounded-full bg-tt-pine text-base" aria-hidden="true">{emoji}</span>
              <p className="mt-3 text-base font-black text-tt-ink">{index + 1}. {title}</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-tt-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-tt-ink-soft">
          Your job? Approve missions — about 30 seconds a day. TailTots does the nagging. <span className="font-black text-tt-ink">No PhD in parenting required.</span>
        </p>
      </section>

      {/* ============ PLATFORM: pet care is the hook, this is the one-stop ============ */}
      <section id="landing-platform" className="relative -mx-3 scroll-mt-36 overflow-hidden border-y border-tt-line bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,209,102,0.10),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-tt-pine/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-tt-grape/30 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">One app · The whole childhood</p>
          <h3 className="mt-2 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">Pet care is the hook. This is the platform.</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/75">
            TailTots is the one stop for raising capable, kind kids — safe social practice, character, skills, chores, neighborhood adventures,
            and giving goals for real shelter dogs. Each arrives as the next chapter of the same loop — never feature sprawl. Crisp on the surface, deep underneath.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {platformPillars.map(([emoji, title, body]) => (
              <article key={title} className="tt-card-lift rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
                <p className="text-2xl" aria-hidden="true">{emoji}</p>
                <p className="mt-2 text-lg font-black">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-white/70">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">Every mission grows something real</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["🐾 Responsibility", "❤️ Kindness & Empathy", "💰 Money Skills", "🤝 Teamwork & Leadership", "🌎 Community", "🎁 Bragging rights"].map((chip) => (
                <span key={chip} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/15">{chip}</span>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-white/60">Start with pet care. End up with a kid who budgets. Funny how that works.</p>
          </div>
          <ShelterGivingShowcase />
        </div>
      </section>

      {/* ============ CERTIFICATE: Pet Readiness Certificate ============ */}
      <section className="-mx-3 border-y border-tt-line bg-gradient-to-br from-tt-grape-soft via-white to-tt-sky p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-grape">Proof of character 🎓</p>
            <h3 className="mt-2 text-2xl tt-display font-black text-tt-navy sm:text-3xl">The Pet Readiness Certificate</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
              Earned through sustained, parent-approved responsibility — never bought, never tapped into existence. Someday your kid will wave this in your face at the shelter. You’ll be ready — and weirdly proud.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => { setCertCelebrating(true); window.setTimeout(() => setCertCelebrating(false), 1800); }}
                className="tt-btn-press tt-animate-wiggle-hover min-h-12 rounded-xl bg-tt-grape px-6 py-3 text-sm font-black text-white shadow-lg"
              >
                🎓 Preview the certificate
              </button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            {certCelebrating && (
              <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
                {["🎉", "⭐", "🐾", "💛", "🎊", "🌟"].map((emoji, i) => (
                  <span key={i} className="tt-confetti-piece absolute text-2xl" style={{ left: `${8 + i * 15}%`, top: "10%", animationDelay: `${i * 0.12}s` }}>{emoji}</span>
                ))}
              </div>
            )}
            <div className={`tt-card-lift rounded-3xl border-4 border-double border-tt-grape/40 bg-white p-6 text-center shadow-xl ${certCelebrating ? "tt-animate-wiggle-hover" : ""}`}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-tt-grape">TailTots · Official</p>
              <p className="mt-1 text-2xl font-black text-tt-navy">Pet Readiness Certificate</p>
              <p className="mx-auto mt-3 max-w-[16rem] text-sm font-semibold leading-6 text-tt-ink-soft">
                This certifies that <span className="font-black text-tt-ink">{previewChildName}</span> of the <span className="font-black text-tt-ink">{previewFamilyName}</span> is growing into a responsible pet human — one mission at a time.
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 text-3xl" aria-hidden="true">
                <span>🐹</span><span>🐶</span><span>🐱</span>
              </div>
              <p className="mt-4 border-t border-dashed border-tt-line pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-tt-ink-faint">Parent approved · Shelter respected</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DAILY KINDNESS: the reason to come back ============ */}
      <section className="-mx-3 border-y border-tt-line bg-gradient-to-br from-tt-sun-soft via-white to-tt-pine-tint p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8" aria-label="Today's kindness prompt">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-tt-tang shadow-sm">
            <span className="tt-animate-bounce-soft" aria-hidden="true">💛</span> Today’s kindness prompt
          </p>
          <p className="tt-animate-pop-in mt-4 text-2xl font-black leading-snug text-tt-navy sm:text-3xl" key={todayPrompt}>
            {todayPrompt}
          </p>
          <p className="mt-3 text-sm font-semibold text-tt-ink-soft">A new one every day. Like a tiny gym for big hearts. Come back tomorrow — we’ll be here.</p>
        </div>
      </section>

      {/* ============ SAFETY: one punchy line ============ */}
      <section className="relative -mx-3 overflow-hidden border-y border-tt-line bg-white p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none text-[11rem] opacity-[0.06]" aria-hidden="true">🛡️</div>
        <div className="pointer-events-none absolute -left-10 -top-10 select-none text-[8rem] opacity-[0.05]" aria-hidden="true">🔒</div>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">Safety, without the lecture</p>
          <h3 className="mt-3 text-3xl font-black leading-tight tracking-tight text-tt-navy sm:text-4xl">
            Your child will never talk to a stranger on TailTots. <span className="underline decoration-tt-sun decoration-4 underline-offset-4">Period.</span>
          </h3>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {trustChips.map((chip) => (
              <span key={chip} className="rounded-full border border-tt-line-blue bg-tt-sky px-4 py-2 text-xs font-black text-tt-navy">🛡️ {chip}</span>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-tt-ink-soft">Progress stays inside your family. Adults approve missions, rewards, jobs, sharing, and every money move.</p>
        </div>
      </section>

      {/* ============ FOUNDER STORY: exactly once ============ */}
      <section className="-mx-3 border-y border-tt-line bg-tt-sun-soft/50 p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-4xl" aria-hidden="true">🐹🐢🐟</p>
          <h3 className="mt-2 text-2xl tt-display font-black text-tt-navy sm:text-3xl">It started with two guinea pigs, a tortoise, a tank of fish — and one big question.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] font-semibold leading-7 text-tt-ink-soft">
            “Why can’t all the kids in the world have a pet?” That was the question the kids kept asking. It turned into a bigger one: what if everyday responsibilities felt
            like adventures? So we built TailTots — a way for every kid to live the pet-care journey, the feeding schedules, the patience, the pride, whether or not
            their family is ready for the real thing yet. What began with animals grew into a bigger mission: helping kids build responsibility, kindness, confidence,
            money skills, and independence through real-world experiences.
          </p>
          <p className="mt-3 text-sm font-black text-tt-navy">Founded by kids. Built for kids. Approved by parents. 🐾</p>
        </div>
      </section>

      {/* ============ FINAL LAUNCH CTA ============ */}
      <section id="landing-real-app" className="-mx-3 scroll-mt-36 overflow-hidden border-y border-tt-pine/40 bg-tt-pine p-6 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border-2 sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-4xl tt-animate-bounce-soft" aria-hidden="true">🚀</p>
          <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Don’t miss the launch. Your kids won’t let you.</h3>
          <p className="mx-auto mt-3 max-w-xl text-[15px] font-semibold leading-6 text-white/80">
            Free family accounts, early rewards, and launch updates. One email — that’s the whole commitment. (The missions are the fun part.)
          </p>
          <p className="mx-auto mt-3 inline-flex max-w-xl items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-tt-sun ring-1 ring-white/20">
            <span aria-hidden="true">⏳</span> Founding-family window closes at launch — no fake countdown, just a real door
          </p>
          {launchJoined ? (
            <p className="mx-auto mt-5 max-w-lg rounded-xl bg-white/10 p-4 text-sm font-black text-tt-sun ring-1 ring-white/20">
              🎉 You’re counted in! See you at launch.
            </p>
          ) : (
          <form
            className="mx-auto mt-5 grid max-w-lg gap-2 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
          >
            <label htmlFor="final-launch-email" className="sr-only">Parent email</label>
            <input
              id="final-launch-email"
              value={launchInterest.email}
              onChange={(event) => setLaunchInterest({ email: event.target.value })}
              className="min-h-12 rounded-xl border-2 border-white/30 bg-white/10 px-4 text-sm font-bold text-white placeholder:text-white/60"
              inputMode="email"
              placeholder="Parent email"
              type="email"
              required
            />
            <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink disabled:opacity-60">
              {launchInterestStatus === "saving" ? "Saving…" : "Count us in 🎉"}
            </button>
          </form>
          )}
          {launchInterestMessage && (
            <p className={`mt-3 text-sm font-bold ${launchInterestStatus === "error" ? "text-tt-sun" : "text-white"}`} role="status">
              {launchInterestMessage}
            </p>
          )}
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="landing-contact" className="-mx-3 scroll-mt-36 border-y border-tt-line bg-[#eef2ff] p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h3 className="text-2xl tt-display font-black text-tt-navy sm:text-3xl">Questions, feedback, or partnership ideas?</h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tt-ink-soft">
              Send a note here or email <a className="font-black text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-4" href="mailto:hello@tailtots.com">hello@tailtots.com</a>. We read everything — usually with a guinea pig on our lap.
            </p>
          </div>
          <div className="rounded-2xl border border-tt-line-blue bg-white p-4 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <label htmlFor="feedback-email" className="sr-only">Your email, optional</label>
              <input
                id="feedback-email"
                value={feedbackDraft.email}
                onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, email: event.target.value }))}
                className="min-h-11 rounded-xl border border-tt-line-blue px-3 text-sm font-bold"
                inputMode="email"
                placeholder="Your email, optional"
                type="email"
              />
              <input
                className="min-h-11 rounded-xl border border-tt-line-blue px-3 text-sm font-bold"
                value="TailTots website feedback"
                readOnly
                aria-label="Feedback topic"
              />
            </div>
            <label htmlFor="feedback-message" className="sr-only">Your message</label>
            <textarea
              id="feedback-message"
              value={feedbackDraft.message}
              onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, message: event.target.value }))}
              className="mt-2 min-h-28 w-full rounded-xl border border-tt-line-blue px-3 py-3 text-sm font-bold"
              placeholder="Ask a question, share feedback, or tell us what would make TailTots useful for your family."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={sendWebsiteFeedback}
                disabled={feedbackStatus === "saving"}
                className="tt-btn-press min-h-11 rounded-xl bg-tt-pine px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {feedbackStatus === "saving" ? "Sending…" : "Send feedback"}
              </button>
              {feedbackMessage && (
                <p className={`text-sm font-bold ${feedbackStatus === "error" ? "text-[#b44421]" : "text-tt-pine"}`} role="status">
                  {feedbackMessage}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-tt-line pt-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs font-black text-tt-navy">🐾 TailTots — parent-guided real-world growth.</p>
          <p className="text-[11px] font-semibold text-tt-ink-faint">Made with guinea-pig supervision · <a className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2" href="mailto:hello@tailtots.com">hello@tailtots.com</a> · <a className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2" href="https://tailtots.com/privacy" target="_blank" rel="noreferrer">Privacy</a> · <a className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2" href="https://tailtots.com/terms" target="_blank" rel="noreferrer">Terms</a></p>
        </div>
      </section>
    </section>
  );
}

function SchedulePanel({
  activeChild,
  familyName,
  childProfiles,
  missions,
  scheduleItems,
  role,
  setActiveChildId,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  missions: Mission[];
  scheduleItems: KidScheduleItem[];
  role: Role;
  setActiveChildId: (childId: string) => void;
  familyName: string;
}) {
  const isParent = role === "parent";
  const [availabilityCopied, setAvailabilityCopied] = useState(false);
  const [scheduleFilterChildId, setScheduleFilterChildId] = useState<string | null>(null);
  const visibleItems = scheduleItems.filter((item) => {
    if (!isParent) return item.childId === activeChild?.id;
    if (scheduleFilterChildId) return item.childId === scheduleFilterChildId;
    return true;
  });
  const visibleMissions = missions.filter((mission) => (isParent ? true : !mission.assignedChildId || mission.assignedChildId === activeChild?.id)).slice(0, 4);
  const familyCode = familyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "family";
  // Preview of the future share link. No kid names, addresses, or contact
  // details ever go in the link — the other parent sees only time windows.
  const familyAvailabilityLink = `tailtots.com/availability/${familyCode}`;
  const playdateWindows = [
    ["Weekday calm visit", "Tuesday or Thursday, 4:30-6:00 PM", "Parent confirms address, pet temperament, and adult presence."],
    ["Weekend pet hello", "Saturday, 10:00 AM-12:00 PM", "Good for supervised pet introductions or shared care learning."],
    ["Shelter kindness block", "Sunday afternoon", "Parent-reviewed volunteer or donation activity with badge credit."],
  ];
  // Real rolling seven-day window. Existing schedule items use weekday labels ("Today", "Wednesday"…),
  // so map them onto this week's real weekday names without changing the data model.
  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    return {
      weekday,
      isToday: offset === 0,
      heading: offset === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    };
  });
  const itemsForWeekday = (weekday: string) =>
    visibleItems.filter((item) =>
      item.day === "Today" ? weekDays[0].weekday === weekday : item.day.toLowerCase() === weekday.toLowerCase()
    );
  // Missions carry no dates, so completion dots describe each child's current mission state on the Today column.
  const dotChildren = isParent ? childProfiles : childProfiles.filter((child) => child.id === activeChild?.id);
  const childMissionDot = (childId: string): "full" | "partial" | "none" => {
    const relevant = missions.filter((mission) => !mission.assignedChildId || mission.assignedChildId === childId);
    if (!relevant.length) return "none";
    if (relevant.every((mission) => mission.status === "approved")) return "full";
    if (relevant.some((mission) => mission.status === "approved" || mission.completedBy)) return "partial";
    return "none";
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">{isParent ? "Family calendar" : `${activeChild?.name ?? "Kid"} calendar`}</p>
            <h2 className="mt-2 text-3xl font-black">{isParent ? "Schedules without kid pressure" : "Your day, nice and simple"}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
              {isParent ? "Parents can review the rhythm for each child without showing private parent controls in kid mode." : "See what is next, what pet needs care, and what can wait for a grown-up."}
            </p>
          </div>
          {isParent && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter schedule by child">
              <button
                onClick={() => setScheduleFilterChildId(null)}
                aria-pressed={scheduleFilterChildId === null}
                className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-black ${scheduleFilterChildId === null ? "border-[#165a4b] bg-[#165a4b] text-white" : "border-[#ded8c7] bg-white text-[#17231f]"}`}
              >
                All kids
              </button>
              {childProfiles.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setScheduleFilterChildId(scheduleFilterChildId === child.id ? null : child.id)}
                  aria-pressed={scheduleFilterChildId === child.id}
                  className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-black ${scheduleFilterChildId === child.id ? "border-[#165a4b] bg-[#165a4b] text-white" : "border-[#ded8c7] bg-white text-[#17231f]"}`}
                >
                  {child.name}, {child.age}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">{isParent ? (scheduleFilterChildId ? `${childProfiles.find((c) => c.id === scheduleFilterChildId)?.name ?? "Kid"} only` : "Combined view") : "My week"}</p>
            <h3 className="mt-2 text-2xl font-black">{isParent ? (scheduleFilterChildId ? "One child's schedule" : "All kids in one family calendar") : "Your own schedule"}</h3>
          </div>
          {isParent && <span className="rounded-lg bg-[#f0edff] px-4 py-2 text-sm font-black text-[#4c1d95]">Parent-only combined calendar</span>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {weekDays.map((day) => {
            const dayItems = itemsForWeekday(day.weekday);
            if (!dayItems.length) {
              // Truly empty days collapse to a slim row — no filler copy.
              return (
                <div key={day.weekday} className="flex items-center justify-between rounded-lg bg-[#faf8f0] px-3 py-2 text-xs font-bold text-[#69736f]">
                  <span>{day.heading}</span>
                  <span>Free day</span>
                </div>
              );
            }
            return (
              <article key={day.weekday} className={`rounded-lg bg-[#faf8f0] p-3 ${day.isToday ? "ring-2 ring-[#f47b20]" : ""}`}>
                <p className="text-sm font-black text-[#17231f]">{day.heading}</p>
                {day.isToday && (
                  <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Mission completion">
                    {dotChildren.map((child) => {
                      const dot = childMissionDot(child.id);
                      if (dot === "none") return null;
                      return (
                        <span
                          key={child.id}
                          title={`${child.name}: ${dot === "full" ? "all missions approved" : "some progress"}`}
                          className={`inline-block h-3 w-3 rounded-full ${dot === "full" ? "bg-[#165a4b]" : "border-2 border-[#165a4b] bg-transparent"}`}
                        />
                      );
                    })}
                  </div>
                )}
                <div className="mt-3 grid gap-2">
                  {dayItems.map((item) => {
                    const child = childProfiles.find((profile) => profile.id === item.childId);
                    return (
                      <div key={item.id} className="rounded-lg bg-white p-3">
                        <p className="text-xs font-black text-[#165a4b]">{item.time}</p>
                        <p className="mt-1 text-sm font-black leading-5">{item.title}</p>
                        {isParent && <p className="mt-1 text-xs font-bold text-[#4f625b]">{child?.name ?? "Family"}</p>}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isParent && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Playdate availability</p>
          <h3 className="mt-2 text-2xl font-black">Share safe times with a dynamic family link</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
            Parents can share availability without exposing child profiles, home address, or direct kid messaging. The other family requests a time, and the parent approves before kids see anything.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg bg-[#eef2ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#2563eb]">Share link preview</p>
              <p className="mt-2 break-all rounded-lg bg-white p-3 text-sm font-black text-[#17231f]">{familyAvailabilityLink}</p>
              <button
                onClick={() => {
                  const summary = [`${familyName} — playdate availability (via TailTots)`,
                    ...playdateWindows.map(([title, time]) => `• ${title}: ${time}`),
                    "Parent approves every plan before kids hear about it. No addresses or kid details shared here.",
                  ].join("\n");
                  navigator.clipboard?.writeText(summary).then(
                    () => {
                      setAvailabilityCopied(true);
                      window.setTimeout(() => setAvailabilityCopied(false), 2500);
                    },
                    () => setAvailabilityCopied(false),
                  );
                }}
                className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white"
              >
                {availabilityCopied ? "Copied! Paste it to the other parent ✓" : "Copy share text"}
              </button>
            </div>
            <div className="grid gap-2">
              {playdateWindows.map(([title, time, note]) => (
                <article key={title} className="rounded-lg bg-[#e7f4ef] p-3">
                  <p className="text-sm font-black">{title}</p>
                  <p className="mt-1 text-xs font-bold text-[#165a4b]">{time}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#4f625b]">{note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Schedule</p>
          <div className="mt-4 grid gap-3">
            {visibleItems.map((item) => {
              const child = childProfiles.find((profile) => profile.id === item.childId);
              return (
                <article key={item.id} className="grid gap-3 rounded-lg bg-[#faf8f0] p-4 sm:grid-cols-[110px_1fr]">
                  <div className="rounded-lg bg-white p-3 text-sm font-black text-[#165a4b]">
                    <span className="block">{item.day}</span>
                    <span className="block text-[#4f625b]">{item.time}</span>
                  </div>
                  <div>
                    <p className="text-lg font-black">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#4f625b]">{item.note}</p>
                    {isParent && <p className="mt-2 text-xs font-black text-[#165a4b]">{child?.name ?? "Kid"}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Today missions</p>
          <div className="mt-4 grid gap-3">
            {visibleMissions.map((mission) => (
              <article key={mission.id} className="rounded-lg bg-[#fff4d8] p-4">
                <p className="text-lg font-black">{mission.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#4f625b]">{mission.question}</p>
                <p className="mt-2 text-xs font-black text-[#7a4b12]">+{mission.points} points after parent approval</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function KidAiBuddyPanel({
  activeChild,
  pets,
  moments,
  childProfiles: _childProfiles,
  socialPracticeDone: _socialPracticeDone,
  onAnswerSocialScenario: _onAnswerSocialScenario,
  scheduleItems,
  onHelperUse,
}: {
  activeChild?: Child;
  pets: Pet[];
  moments: MemoryMoment[];
  childProfiles: Child[];
  socialPracticeDone: Record<string, string[]>;
  onAnswerSocialScenario: (childId: string, scenarioId: string) => void;
  scheduleItems: KidScheduleItem[];
  onHelperUse: (topic: string) => void;
}) {
  const pet = pets[0];
  const petName = pet?.name ?? "your pet";
  const childName = activeChild?.name ?? "Kid";
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [aiChipLabels, setAiChipLabels] = useState<string[] | null>(null);
  // Predefined question suggestions generated from family data: (a) the pets
  // the family onboarded, (b) non-pet topics, (c) the kid's interests from
  // hobby schedule items, (d) classes from school schedule items.
  const localChips = buildBuddyQuestionChips({ pets, scheduleItems, childId: activeChild?.id, childName });
  // AI path: the parent-side /api/ai/ideas endpoint may craft question ideas
  // from non-identifying context only (species, counts, age band) — never kid
  // PII, and only with a parent session. Unreachable from the kid view, so the
  // local builder above is the graceful fallback that always works.
  useEffect(() => {
    let cancelled = false;
    const ageBand = !activeChild ? "7-9" : activeChild.age <= 6 ? "4-6" : activeChild.age <= 9 ? "7-9" : "10-12";
    fetch("/api/ai/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lifeSkill: "curiosity",
        ageBand,
        context: {
          petKinds: [...new Set(pets.map((item) => item.species))].slice(0, 4),
          hobbyCount: scheduleItems.filter((item) => item.kind === "hobby").length,
          schoolCount: scheduleItems.filter((item) => item.kind === "school").length,
        },
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { ideas?: unknown } | null) => {
        if (cancelled) return;
        const ideas = Array.isArray(data?.ideas)
          ? data.ideas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          : [];
        if (ideas.length > 0) setAiChipLabels(ideas.slice(0, 6));
      })
      .catch(() => {
        // Graceful fallback: keep the local chips.
      });
    return () => {
      cancelled = true;
    };
  }, [activeChild, pets, scheduleItems]);
  const chips: BuddyChip[] = aiChipLabels
    ? aiChipLabels.map((label, index) => ({
        id: `ai-${index}`,
        label,
        answerTitle: "Great question to explore!",
        answerBody: `Talk through "${label}" with a parent — wondering together is where the learning happens.`,
      }))
    : localChips;
  const kidQuestions: [string, string][] = chips.map((chip) => [chip.id, chip.label]);
  const chipAnswers: Record<string, { title: string; body: string }> = {};
  for (const chip of chips) chipAnswers[chip.id] = { title: chip.answerTitle, body: chip.answerBody };
  const aiSuggestion =
    (selectedQuestion ? chipAnswers[selectedQuestion] : undefined) ??
    chipAnswers[chips[0]?.id ?? ""] ?? { title: "Ask away!", body: "Pick a question above to get a helpful answer." };
  // One suggested question per day, shown as the primary action.
  const suggestedQuestion = kidQuestions[new Date().getDate() % kidQuestions.length];
  const askQuestion = (id: string, label: string) => {
    setSelectedQuestion(id);
    onHelperUse(label);
    document.getElementById("ai-buddy-answer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const askSuggested = () => {
    if (!suggestedQuestion) return;
    askQuestion(suggestedQuestion[0], suggestedQuestion[1]);
  };
  const helperCards = [
    ["Daily quote", "Small care done every day becomes a big kind habit."],
    ["Pet fact", `${petName} feels safer when food, water, sound, and handling stay calm and predictable.`],
    ["Try today", `Look closely at ${petName} for ten quiet seconds, then tell a parent one thing you noticed.`],
    ["Hobby spark", "Draw your pet's dream home, build a paper maze, or write a tiny care story."],
  ];
  const recentMoment = moments.find((moment) => moment.childId === activeChild?.id);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Kid-safe AI buddy</p>
        <h2 className="mt-2 text-3xl font-black">Your AI Buddy has answers ✨</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          One safe question, one helpful answer — {activeChild?.name ?? "kiddo"} picks the question, the helper does the rest.
        </p>
        <button
          onClick={askSuggested}
          className="tt-btn-press mt-4 min-h-14 w-full rounded-xl bg-[#165a4b] px-5 py-3 text-base font-black text-white sm:w-auto"
        >
          {suggestedQuestion[1]} →
        </button>
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Suggested for you</p>
        <h3 className="mt-2 text-2xl font-black">Tap a question to try</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {kidQuestions.map(([id, question]) => (
            <button
              key={id}
              onClick={() => askQuestion(id, question)}
              className={`min-h-14 rounded-lg px-4 py-3 text-left text-sm font-black leading-5 ${
                selectedQuestion === id ? "bg-[#165a4b] text-white" : "border border-[#ded8c7] bg-[#faf8f0] text-[#17231f]"
              }`}
            >
              {question}
            </button>
          ))}
        </div>
        <div key={selectedQuestion ?? "default"} id="ai-buddy-answer" className="mt-4 scroll-mt-24 rounded-lg bg-[#e7f4ef] p-4 animate-[answer-pop_0.6s_ease-out]">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">TailTots suggestion ✨ new!</p>
          <p className="mt-2 text-lg font-black leading-7">{aiSuggestion.title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">{aiSuggestion.body}</p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {helperCards.map(([title, body]) => (
          <article key={title} className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">{body}</p>
          </article>
        ))}
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Your care memory</p>
        <p className="mt-3 text-lg font-black">{recentMoment?.note ?? "Complete a care mission and your kind pet moment can show here."}</p>
      </section>
      <p className="text-center text-xs font-bold text-[#69736f]">
        For parents: guided prompts only — no open chat. Kid-safe by design.
      </p>
    </section>
  );
}

type BuddyChip = { id: string; label: string; answerTitle: string; answerBody: string };

/**
 * Predefined AI Buddy question suggestions generated from family data:
 * (a) the pets the family onboarded, (b) non-pet topics, (c) the kid's
 * interests from hobby schedule items, (d) classes from school schedule items.
 * The non-pet topics double as the graceful fallback when family data is thin.
 */
function buildBuddyQuestionChips(args: {
  pets: Pet[];
  scheduleItems: KidScheduleItem[];
  childId?: string;
  childName: string;
}): BuddyChip[] {
  const { pets, scheduleItems, childId, childName } = args;
  const chips: BuddyChip[] = [];
  // (a) pets the family onboarded.
  for (const item of pets.slice(0, 2)) {
    chips.push({
      id: `pet-${item.id}`,
      label: `How can I help ${item.name} today?`,
      answerTitle: `${childName}, give ${item.name} a calm care check.`,
      answerBody: `Look at ${item.name}'s food, water, comfort, and space. Pick one small thing to improve, then ask a parent to review it with you.`,
    });
  }
  const kidItems = scheduleItems.filter((item) => !childId || item.childId === childId);
  // (c) the kid's interests, from hobby schedule items.
  for (const item of kidItems.filter((entry) => entry.kind === "hobby").slice(0, 2)) {
    chips.push({
      id: `hobby-${item.id}`,
      label: "A new hobby idea for me?",
      answerTitle: `Try a twist on "${item.title}".`,
      answerBody: `${item.note} Ask a parent to try a 5-minute variation with you today.`,
    });
  }
  // (d) classes in their schedule.
  for (const item of kidItems.filter((entry) => entry.kind === "school").slice(0, 1)) {
    chips.push({
      id: `class-${item.id}`,
      label: `Make "${item.title}" more fun?`,
      answerTitle: `Turn "${item.title}" into a game.`,
      answerBody: `${item.note} Try teaching it back to a parent in your own words — explaining is the fastest way to learn it.`,
    });
  }
  // (b) non-pet topics — always available, and the graceful fallback when the
  // family hasn't onboarded pets or schedule items yet.
  const fallbackTopics: BuddyChip[] = [
    {
      id: "topic-kindness",
      label: "Give me a 2-minute kindness mission.",
      answerTitle: "Kindness in two minutes.",
      answerBody:
        "Do one tiny kind thing right now — tidy a shared space, thank a parent, or draw a cheerful note for someone. Small kindness practiced daily becomes character.",
    },
    {
      id: "topic-hobby",
      label: "Suggest a screen-free hobby idea.",
      answerTitle: "Unplug and make something.",
      answerBody:
        "Build a paper maze, draw your pet's dream home, or start a 5-minute observation journal. Screen-free making builds patience and focus.",
    },
    {
      id: "topic-calm",
      label: "How can I practice patience today?",
      answerTitle: "Patience is a superpower.",
      answerBody:
        "Pick one slow thing today: watch your pet for ten quiet seconds, wait your turn without reminders, or finish a puzzle without rushing. Notice how it feels.",
    },
  ];
  for (const topic of fallbackTopics) {
    if (chips.length >= 6) break;
    chips.push(topic);
  }
  return chips.slice(0, 6);
}

function ChildProfileSwitcher({
  activeChild,
  childProfiles,
  requestChildSwitch,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  requestChildSwitch: (childId: string) => void;
}) {
  const activeLook = getChildLook(activeChild?.id);

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-[#fff4d8] p-4 shadow-sm" aria-label="Child profile switcher">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a4b12]">Who is using TailTots?</p>
      <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg bg-white p-3">
        <ProfilePhoto
          label={activeChild?.name ?? "Kid"}
          initial={activeLook.initial}
          colors={activeLook.colors}
          variant="kid"
          hair={activeLook.hair}
          photoUrl={activeChild?.photoUrl}
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#17231f]">{activeChild?.name ?? "Choose a kid"}</p>
          <p className="text-xs font-bold text-[#7a4b12]">Active profile on this screen</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {childProfiles.map((child) => {
          const look = getChildLook(child.id);
          const isActive = child.id === activeChild?.id;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => requestChildSwitch(child.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black ${
                isActive ? "border-[#f47b20] bg-[#17231f] text-white" : "border-[#e1d5b9] bg-white text-[#17231f]"
              }`}
            >
              <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
              <span className="min-w-0 flex-1 truncate">{child.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.1em] ${isActive ? "bg-white text-[#17231f]" : "bg-[#faf8f0] text-[#7a4b12]"}`}>
                {isActive ? "Using now" : "Switch"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Hero({
  child,
  childProfiles,
  setActiveChildId,
  pendingCount,
  taskProgress,
  approvedMissionCount,
  pets,
  setActiveTab,
  role,
}: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  pendingCount: number;
  taskProgress: number;
  approvedMissionCount: number;
  pets: Pet[];
  setActiveTab: (tab: string) => void;
  role: Role;
}) {
  const childLook = getChildLook(child?.id);
  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="overflow-hidden rounded-lg bg-[#165a4b] text-white shadow-sm">
        <div className="p-4">
          <div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => document.getElementById("today-mission-list")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="min-h-11 rounded-lg bg-[#f47b20] px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                Start today&apos;s missions
              </button>
              {role === "parent" && (
                <button onClick={() => setActiveTab("setup")} className="min-h-11 rounded-lg border border-white/35 bg-white/10 px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                  Manage family setup
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/15 bg-white/8 p-4 sm:grid-cols-3">
          {[
            ["Missions approved", String(approvedMissionCount), "real work, parent-verified"],
            ["Care streak", `${child?.streakDays ?? 0} day${(child?.streakDays ?? 0) === 1 ? "" : "s"}`, "one day at a time"],
            ["Waiting on review", String(pendingCount), "a parent high-five is next"],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-lg bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/70">{label}</p>
              <p className="mt-1 text-3xl font-black text-white">{value}</p>
              <p className="mt-1 text-xs font-bold text-white/60">{detail}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3">
              <ProfilePhoto label={child?.name ?? "Kid"} initial={childLook.initial} colors={childLook.colors} variant="kid" hair={childLook.hair} photoUrl={child?.photoUrl} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Selected child</p>
                <h3 className="text-2xl font-black">{child?.name ?? "Add a child"}</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {childProfiles.map((item) => {
                const look = getChildLook(item.id);
                const isSelected = item.id === child?.id;
                return (
                  <div key={item.id} className={`rounded-lg border ${isSelected ? "border-[#f47b20] bg-[#fff4d8]" : "border-[#ded8c7] bg-[#faf8f0]"}`}>
                    <button
                      onClick={() => setActiveChildId(item.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm font-black text-[#17231f]"
                    >
                      <ProfilePhoto label={item.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={item.photoUrl} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div>
              <div className="mb-2 flex justify-between text-sm font-black">
                <span>Task progress</span>
                <span>{taskProgress}%</span>
              </div>
              <div className="h-4 rounded-full bg-[#f5f1e5]">
                <div className="h-4 rounded-full bg-[#f47b20]" style={{ width: `${taskProgress}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-[#ecf7f0] p-3 text-[#0d3b30]"><b className="block text-lg">{child?.points ?? 0}</b>points</span>
              <span className="rounded-lg bg-[#fff4d8] p-3 text-[#7a4b12]"><b className="block text-lg">{approvedMissionCount}</b>approved</span>
              <span className="rounded-lg bg-[#eef4ff] p-3 text-[#1e3a8a]"><b className="block text-lg">{pendingCount}</b>pending</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Meter label="Loving the app" value={childLook.love} color="#6d3ed1" />
              <Meter label="Happiness today" value={childLook.joy} color="#165a4b" />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#faf8f0] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Active pets</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pets.map((item) => {
              const look = getPetLook(item.id, item);
              return (
                <div key={item.id} className="grid place-items-center gap-1 rounded-lg bg-white p-2 text-center text-[11px] font-black">
                  <ProfilePhoto label={item.name} initial={look.face} colors={look.colors} size="xs" variant="pet" petKind={look.kind} photoUrl={item.photoUrl} />
                  <span className="max-w-full truncate">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={() => setActiveTab("pets")} className="mt-auto min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          View pet passports
        </button>
      </div>
    </section>
  );
}

function loadSavedFamilyState() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(savedFamilyStateKey) ?? window.localStorage.getItem(legacySavedFamilyStateKey);
    return raw ? migrateSavedFamilyState(JSON.parse(raw) as SavedFamilyState) : undefined;
  } catch {
    return undefined;
  }
}

function migrateSavedFamilyState(state: SavedFamilyState): SavedFamilyState {
  const hasOldDemoKids = state.children.some((child) => child.id === "maya" || child.id === "leo");
  const hasOldDemoPets = state.pets.some((pet) => pet.id === "luna" || pet.id === "mochi");
  if (!hasOldDemoKids && !hasOldDemoPets) {
    return {
      ...state,
      children: state.children.map(normalizeChildProfile),
    };
  }

  return {
    ...state,
    children: starterChildren,
    pets: starterPets,
    activeChildId: state.activeChildId === "leo" ? "aarush" : "sahasra",
  };
}

function saveFamilyState(state: SavedFamilyState) {
  if (typeof window === "undefined") return;
  const safeState: SavedFamilyState = {
    ...state,
    parentPasscode: undefined,
    children: state.children.map(normalizeChildProfile),
    pets: state.pets.map(normalizePetProfile),
    neighborhoodJobs: state.neighborhoodJobs.map(normalizeNeighborhoodJob),
  };
  try {
    window.localStorage.setItem(savedFamilyStateKey, JSON.stringify(safeState));
  } catch {
    try {
      window.localStorage.setItem(savedFamilyStateKey, JSON.stringify({ ...safeState, familyPhotoUrl: undefined }));
    } catch {
      // Supabase storage will replace local image persistence later.
    }
  }
}

function normalizeChildProfile(child: Child): Child {
  return {
    ...child,
    age: child.id === "sahasra" ? 6 : child.id === "aarush" ? 9 : child.age ?? 8,
    secretCode: "",
  };
}

function normalizeNeighborhoodJob(job: NeighborhoodJob): NeighborhoodJob {
  return {
    ...job,
    visibleToKids: job.visibleToKids === true,
    minAge: job.minAge ?? 4,
    skillFocus: job.skillFocus ?? "teamwork",
    trustSignals: job.trustSignals?.length ? job.trustSignals : ["parent_gate", "age_fit", "private_child"],
    posterThanked: job.posterThanked === true,
  };
}

/**
 * Parent-to-parent thank-you text for a completed neighborhood job.
 * Anonymized by design: the poster learns "a neighborhood family" completed
 * the job — never a kid's name, photo, or age. This is the ONLY cross-family
 * text the app generates for neighborhood jobs.
 */
export function buildPosterThankYou(job: Pick<NeighborhoodJob, "title" | "pet" | "time">): string {
  return [
    `Hi! A neighborhood family just completed your TailTots helper job: "${job.title}".`,
    job.pet ? `Job: ${job.pet}.` : "",
    job.time ? `When: ${job.time}.` : "",
    "Thank you for trusting the neighborhood loop — a parent supervised every step, and your posting made a kid's day more capable and kind. — via TailTots (parent to parent)",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizePetProfile(pet: Pet): Pet {
  return pet;
}

function isMissionAgeAppropriate(mission: Mission, child: Child) {
  return child.age >= difficultyAgeGuidance[mission.difficulty].minAge;
}

function getAgeFitCopy(mission: Mission, child?: Child) {
  if (!child) return "Assign a kid to see age fit.";
  const guidance = difficultyAgeGuidance[mission.difficulty];
  return isMissionAgeAppropriate(mission, child)
    ? `Good age fit for ${child.name}. Suggested for ${guidance.label.toLowerCase()}.`
    : `${child.name} is younger than the ${guidance.label.toLowerCase()} guidance. Parent supervision recommended.`;
}

function PhotoCropModal({
  draft,
  setDraft,
  saveCrop,
  close,
}: {
  draft: PhotoCropDraft;
  setDraft: (draft: PhotoCropDraft) => void;
  saveCrop: () => void;
  close: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(draft.imageUrl);
  const minZoom = draft.fit === "contain" ? 0.55 : 1;
  const maxZoom = draft.fit === "contain" ? 3.2 : 3.6;
  const zoomStep = draft.fit === "contain" ? 0.1 : 0.12;
  const updateZoom = (zoom: number) => setDraft({ ...draft, zoom: Math.min(maxZoom, Math.max(minZoom, zoom)) });
  const resetCrop = () => {
    const isPerson = draft.targetType === "parent" || draft.targetType === "child";
    setDraft({ ...draft, crop: { x: 0, y: isPerson ? -12 : 0 }, zoom: draft.fit === "contain" ? 0.85 : isPerson ? 1.45 : 1.05, croppedAreaPixels: undefined });
  };

  useEffect(() => {
    let isActive = true;
    cropProfileImage(draft)
      .then((url) => {
        if (isActive) setPreviewUrl(url);
      })
      .catch(() => {
        if (isActive) setPreviewUrl(draft.imageUrl);
      });
    return () => {
      isActive = false;
    };
  }, [draft]);

  return (
    <div className="fixed inset-0 z-50 grid overflow-y-auto bg-[#17231f]/60 p-4 backdrop-blur-sm">
      <section className="m-auto w-full max-w-4xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#ded8c7] pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Head-focused profile crop</p>
            <h2 className="mt-2 text-3xl font-black">Fit {draft.label}&apos;s face into the character</h2>
            <p className="mt-2 text-sm font-semibold text-[#4f625b]">People photos start zoomed toward the head, ears, and hair so background stays out of the animated profile.</p>
          </div>
          <button onClick={close} className="rounded-lg border border-[#ded8c7] px-4 py-2 text-sm font-black">Close</button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="overflow-hidden rounded-lg border border-[#ded8c7] bg-[#0b100e]">
            <div className="relative h-[360px] touch-none sm:h-[430px]">
              <Cropper
                image={draft.imageUrl}
                crop={draft.crop}
                zoom={draft.zoom}
                minZoom={minZoom}
                maxZoom={maxZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit={draft.fit === "contain" ? "contain" : "cover"}
                restrictPosition={draft.fit === "contain" ? false : true}
                onCropChange={(crop) => setDraft({ ...draft, crop })}
                onZoomChange={(zoom) => updateZoom(zoom)}
                onCropComplete={(_, croppedAreaPixels) => setDraft({ ...draft, croppedAreaPixels })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 bg-[#faf8f0] px-4 py-3 text-sm font-black text-[#17231f]">
              <span>{draft.fit === "contain" ? "Pet mode keeps more of the body visible" : "Face mode fills the profile circle"}</span>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-[#4f625b]">Drag photo</span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-lg bg-[#faf8f0] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a4b12]">Final shape</p>
              <div className="mt-4 grid place-items-center">
                <div className="relative size-36 overflow-hidden rounded-full border-4 border-white bg-[#ded8c7] shadow-sm">
                  <Image src={previewUrl} alt={`${draft.label} selected photo`} fill sizes="144px" className="object-cover" unoptimized />
                </div>
              </div>
              <p className="mt-4 text-center text-sm font-black">{draft.label}</p>
            </div>

            <label className="block text-sm font-black">
              Zoom
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step="0.01"
                value={draft.zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => updateZoom(draft.zoom - zoomStep)} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Zoom out
              </button>
              <button onClick={() => updateZoom(draft.zoom + zoomStep)} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Zoom in
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={resetCrop} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Reset
              </button>
              <button onClick={saveCrop} className="min-h-12 rounded-lg bg-[#165a4b] px-4 py-3 text-sm font-black text-white">
                Save photo
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

async function cropProfileImage(draft: PhotoCropDraft) {
  const image = await loadImage(draft.imageUrl);
  const canvas = document.createElement("canvas");
  const outputSize = 256;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) return draft.imageUrl;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);

  const area = draft.croppedAreaPixels ?? {
    x: 0,
    y: 0,
    width: Math.min(image.width, image.height),
    height: Math.min(image.width, image.height),
  };

  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  context.restore();

  return canvas.toDataURL("image/jpeg", 0.86);
}

async function resizeImageFile(file: File, maxSize: number, quality: number) {
  const image = await loadImage(await fileToDataUrl(file));
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return fileToDataUrl(file);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FamilyFaceParade({
  parents,
  childProfiles,
  pets,
  compact = false,
  animated = false,
}: {
  parents: ParentProfile[];
  childProfiles: Child[];
  pets: Pet[];
  compact?: boolean;
  animated?: boolean;
}) {
  const people = [
    ...parents.map((parent) => ({ id: parent.id, name: parent.name, photoUrl: parent.photoUrl, initial: parent.name.trim()[0]?.toUpperCase() ?? "P", colors: "from-[#ffd166] via-[#f47b20] to-[#6d3ed1]", hair: "#4a2718" })),
    ...childProfiles.map((child) => {
      const look = getChildLook(child.id);
      return { id: child.id, name: child.name, photoUrl: child.photoUrl, initial: look.initial, colors: look.colors, hair: look.hair };
    }),
  ];
  const visiblePets = compact ? pets.slice(0, 1) : pets;

  if (animated) {
    return (
      <div className="flex max-w-full flex-wrap items-end justify-center gap-1 overflow-hidden px-3 sm:gap-2">
        {people.map((person, index) => (
          <AnimatedFamilyCharacter
            key={person.id}
            tone={["#ffd166", "#f6b38a", "#c58b6a", "#f4c7a1"][index % 4]}
            shirt={["#165a4b", "#6d3ed1", "#f47b20", "#2563eb"][index % 4]}
            delay={`${index * 0.12}s`}
            photoUrl={person.photoUrl}
            label={person.name}
          />
        ))}
        {visiblePets.map((pet, index) => (
          <AnimatedPetBuddy key={pet.id} color={index % 2 === 0 ? "#f47b20" : "#165a4b"} delay={`${(people.length + index) * 0.12}s`} photoUrl={pet.photoUrl} label={pet.name} kind={getPetLook(pet.id, pet).kind} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex ${compact ? "-space-x-4" : "-space-x-3"}`}>
      {people.map((person) => {
        return (
          <ProfilePhoto
            key={person.id}
            label={person.name}
            initial={person.initial}
            colors={person.colors}
            size={compact ? "xs" : "md"}
            variant="kid"
            hair={person.hair}
            photoUrl={person.photoUrl}
          />
        );
      })}
      {visiblePets.map((pet) => {
        const look = getPetLook(pet.id, pet);
        return <ProfilePhoto key={pet.id} label={pet.name} initial={look.face} colors={look.colors} size={compact ? "xs" : "md"} variant="pet" petKind={look.kind} photoUrl={pet.photoUrl} />;
      })}
    </div>
  );
}

function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  allChildren: Child[];
  missionNote: string;
  setMissionNote: (value: string) => void;
  completeMission: (missionId: string) => void;
  repeatMission: (missionId: string) => void;
  role: Role;
  nudgedMissionIds: string[];
  onNudgeMission: (missionId: string) => void;
}) {
  const isKidView = props.role === "child";
  const [confirmingMissionId, setConfirmingMissionId] = useState<string | null>(null);
  const [patienceMissionId, setPatienceMissionId] = useState<string | null>(null);
  const tapPatience = (missionId: string) => {
    setPatienceMissionId(missionId);
    window.setTimeout(() => setPatienceMissionId((current) => (current === missionId ? null : current)), 2600);
  };
  // Pet status card: the first pet is the kid's "today" companion.
  const statusPet = props.pets[0];
  const statusPetLook = statusPet ? getPetLook(statusPet.id, statusPet) : null;
  const statusPetStats = statusPet ? getPetCareStats(statusPet.id, props.missions) : null;
  const firstOpenNeed = statusPet
    ? props.missions.find((mission) => mission.petId === statusPet.id && !mission.completedBy && mission.status !== "approved")
    : undefined;
  const scrollToMissions = () => document.getElementById("today-mission-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const pawgressTotal = props.missions.length;
  const pawgressDone = props.missions.filter((mission) => mission.completedBy || mission.status === "approved").length;
  const pawgressPct = pawgressTotal === 0 ? 0 : Math.round((pawgressDone / pawgressTotal) * 100);
  const pawgressMessage =
    pawgressTotal === 0
      ? "No missions yet — the paws are napping. 😴"
      : pawgressPct === 100
        ? "All paws accounted for! Legendary status: achieved. 🏆"
        : pawgressPct >= 50
          ? "Over halfway! Somewhere, a guinea pig is impressed. 🐹"
          : pawgressPct > 0
            ? "Paws warming up… the treat jar is watching. 🦴"
            : "The paws are idle. Suspiciously idle. 🐾";
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Today</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Today&apos;s care and helper missions</h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#4f625b]">
            Pick a mission, do it in the real world, then send it for a parent high-five.
          </p>
        </div>
      </div>
      {isKidView && statusPet && statusPetStats && statusPetLook && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#ded8c7] bg-[#faf8f0]">
          <div className="flex items-center gap-4 p-4">
            <PetMedallion
              label={statusPet.name}
              petKind={statusPetLook.kind}
              photoUrl={statusPet.photoUrl}
              stage={statusPetStats.stage}
              stageRing={statusPetStats.stageRing}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-black">{statusPet.name}</p>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black ring-1 ring-[#ded8c7]">{statusPetStats.stage}</span>
                <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#0d3b30]">{statusPetStats.mood}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[#4f625b]">
                {firstOpenNeed ? `${statusPet.name} is waiting on: “${firstOpenNeed.title}” 🐾` : statusPetStats.approved === 0 ? `Say hi to ${statusPet.name} — your first care mission is below! 👋` : `${statusPet.name} is all cared for — nice work! 🌟`}
              </p>
            </div>
          </div>
          <button onClick={scrollToMissions} className="tt-btn-press w-full bg-[#165a4b] px-4 py-3 text-sm font-black text-white">
            Check on {statusPet.name} →
          </button>
        </div>
      )}
      {isKidView && !statusPet && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] p-4">
          <p className="text-lg font-black text-[#0d3b30]">Your future pet is waiting… 🐾</p>
          <p className="mt-1 text-sm font-semibold text-[#4f625b]">
            Every mission below is practice for the real thing. Finish them and you build the case for a pet of your own.
          </p>
          <button onClick={scrollToMissions} className="tt-btn-press mt-3 min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">
            Start the readiness path →
          </button>
        </div>
      )}
      <div className="mt-4 rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4" aria-label="Mission progress">
        <div className="flex items-center justify-between gap-2 text-sm font-black">
          <span>🐾 Pawgress</span>
          <span>{pawgressDone}/{pawgressTotal} · {pawgressPct}%</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#f5f1e5]" role="progressbar" aria-valuenow={pawgressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Pawgress">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-[#f47b20] to-[#ffd166] transition-[width] duration-700"
            style={{ width: `${pawgressPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-bold text-[#4f625b]">{pawgressMessage}</p>
      </div>
      <div id="today-mission-list" className="mt-5 grid gap-3 scroll-mt-24">
        {props.missions.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] p-6 text-center">
            <p className="text-lg font-black text-[#0d3b30]">No missions yet 🐾</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#4f625b]">
              {isKidView
                ? "Your first mission is the start of the adventure."
                : "Add the first mission so your kid has something to care for today."}
            </p>
            {isKidView && (
              <p className="mt-3 text-sm font-black text-[#165a4b]">Ask a grown-up to add your first one →</p>
            )}
          </div>
        )}
        {props.missions.map((mission) => {
          const pet = props.pets.find((item) => item.id === mission.petId);
          const skill = getMissionLifeSkill(mission);
          const assignedChild = props.allChildren.find((child) => child.id === mission.assignedChildId);
          const missionDone = Boolean(mission.completedBy) || mission.status === "approved";
          return (
            <article
              key={mission.id}
              className={`relative grid gap-4 overflow-hidden rounded-lg border p-4 lg:grid-cols-[1fr_auto] lg:items-center ${
                missionDone
                  ? "border-[#165a4b]/40 bg-[#e7f4ef] shadow-[0_8px_24px_-12px_rgba(22,90,75,0.45)]"
                  : "border-[#ded8c7] bg-[#faf8f0]"
              }`}
            >
              {missionDone && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {["🎉", "⭐", "🐾", "💛"].map((emoji, i) => (
                    <span key={i} className="tt-confetti-piece absolute text-xl" style={{ left: `${12 + i * 24}%`, top: "8%", animationDelay: `${i * 0.15}s` }}>{emoji}</span>
                  ))}
                </div>
              )}
              {isKidView ? (
                <>
                  <div>
                    <h3 className="text-xl font-black">{mission.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{mission.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-[#4f625b]">
                      {pet ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ProfilePhoto
                            label={pet.name}
                            initial={getPetLook(pet.id, pet).face}
                            colors={getPetLook(pet.id, pet).colors}
                            size="xs"
                            variant="pet"
                            petKind={getPetLook(pet.id, pet).kind}
                            photoUrl={pet.photoUrl}
                          />
                          {pet.name}
                        </span>
                      ) : (
                        <span className="capitalize">{mission.category.replace("_", " ")}</span>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>+{mission.points} pts</span>
                    </div>
                    {mission.status === "rejected" && mission.note && (
                      <p className="mt-2 rounded-lg bg-[#fff4d8] p-2 text-xs font-bold text-[#7a4b12]">↩️ Sent back: {mission.note}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {confirmingMissionId === mission.id ? (
                      <div className="rounded-lg bg-white p-3 ring-1 ring-[#ded8c7]">
                        <label className="text-xs font-black uppercase tracking-[0.12em] text-[#165a4b]">
                          Step 2 · What did you notice?
                          <textarea
                            value={props.missionNote}
                            onChange={(event) => props.setMissionNote(event.target.value)}
                            className="mt-2 min-h-20 w-full rounded-lg border border-[#ded8c7] bg-[#faf8f0] px-3 py-2 text-sm font-semibold"
                            placeholder="What did you notice?"
                          />
                        </label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setConfirmingMissionId(null)}
                            className="tt-btn-press min-h-11 rounded-lg border-2 border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#4f625b]"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => { props.completeMission(mission.id); setConfirmingMissionId(null); }}
                            className="tt-btn-press min-h-11 rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white"
                          >
                            Send for high-five →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (mission.status === "approved") return;
                          if (mission.completedBy) tapPatience(mission.id);
                          else setConfirmingMissionId(mission.id);
                        }}
                        disabled={!props.activeChild || mission.status === "approved"}
                        className={`tt-btn-press min-h-14 w-full rounded-lg px-6 py-3 text-base font-black disabled:opacity-95 lg:w-auto ${
                          mission.status === "approved"
                            ? "bg-[#165a4b] text-white"
                            : mission.completedBy
                              ? "bg-[#ffd166] text-[#7a4b12]"
                              : "bg-[#f47b20] text-white"
                        }`}
                      >
                        {mission.status === "approved" ? "Approved ✓" : mission.completedBy ? "⏳ Sent for a parent high-five" : "Mark done"}
                      </button>
                    )}
                    {patienceMissionId === mission.id && (
                      <p className="text-center text-xs font-black text-[#7a4b12]">Still waiting — nice patience! 🌟</p>
                    )}
                    {mission.completedBy && mission.status !== "approved" && (
                      props.nudgedMissionIds.includes(mission.id) ? (
                        <p className="text-center text-xs font-black text-[#165a4b]">Nudged ✓ — a parent got the memo</p>
                      ) : (
                        <button
                          onClick={() => props.onNudgeMission(mission.id)}
                          className="tt-btn-press min-h-10 rounded-lg border-2 border-dashed border-[#f4b400] bg-[#fff4d8] px-4 py-2 text-xs font-black text-[#7a4b12]"
                        >
                          Nudge parent 👋
                        </button>
                      )
                    )}
                    {mission.status === "approved" && (
                      <button
                        onClick={() => props.repeatMission(mission.id)}
                        className="min-h-11 rounded-lg border border-[#165a4b] bg-white px-4 py-2 text-sm font-black text-[#165a4b]"
                      >
                        Do again 🔁
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                  {pet ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ef] py-1 pl-1 pr-3 text-xs font-black">
                      <ProfilePhoto label={pet.name} initial={getPetLook(pet.id, pet).face} colors={getPetLook(pet.id, pet).colors} size="xs" variant="pet" petKind={getPetLook(pet.id, pet).kind} photoUrl={pet.photoUrl} />
                      {pet.name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black capitalize">{mission.category.replace("_", " ")}</span>
                  )}
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                    {mission.allowanceDollars ? `+$${mission.allowanceDollars}` : "No dollars"}
                  </span>
                  <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6d3ed1]">
                    {getLifeSkillLabel(skill)}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-black">{mission.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#4f625b]">{mission.question}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#165a4b]">
                    Why this is for you: {getKidMissionReason(mission, props.activeChild)}
                  </p>
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#7a4b12]">
                    Fairness note: {assignedChild ? `${assignedChild.name} owns this one task.` : "Parent can assign one owner so kids do not fight over it."}
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <button
                  onClick={() => props.completeMission(mission.id)}
                  disabled={!props.activeChild || mission.status === "approved"}
                  className={`tt-btn-press min-h-14 w-full rounded-lg px-6 py-3 text-base font-black text-white disabled:bg-[#b9b2a2] lg:w-auto ${missionDone ? "bg-[#165a4b]" : "bg-[#f47b20]"}`}
                >
                  {mission.status === "approved" ? "Approved ✓" : mission.completedBy ? "Needs approval 👀" : "Mark done"}
                </button>
                {missionDone && (
                  <p className="text-center text-xs font-black text-[#165a4b] lg:text-right">
                    {mission.status === "approved" ? "🎉 Mission crushed. Treats earned." : "🎉 Done! Awaiting the parent high-five."}
                  </p>
                )}
                {mission.status === "approved" && (
                  <button
                    onClick={() => props.repeatMission(mission.id)}
                    className="min-h-11 rounded-lg border border-[#165a4b] bg-white px-4 py-2 text-sm font-black text-[#165a4b]"
                  >
                    Do again 🔁
                  </button>
                )}
              </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const socialScenarios: {
  id: string;
  title: string;
  situation: string;
  choices: { text: string; best: boolean; feedback: string }[];
}[] = [
  {
    id: "unkind-comment",
    title: "The unkind comment",
    situation: "Someone writes 'your drawing is bad' under your picture in the class gallery. Your stomach drops. What do you do?",
    choices: [
      { text: "Write something mean back", best: false, feedback: "Fighting back feels good for a second, then the whole thing gets bigger. Mean replies are screenshots forever." },
      { text: "Don't reply. Show a trusted adult.", best: true, feedback: "Exactly right. Starve the trolls, loop in a grown-up. Not replying is a power move, not weakness." },
      { text: "Post something embarrassing about them", best: false, feedback: "Revenge posts make YOU the bully in the story. Tell an adult instead — that's the strong move." },
    ],
  },
  {
    id: "stranger-friend",
    title: "The stranger friend request",
    situation: "A player with a cool avatar wants to be your friend in your game. You've never met them. They seem nice. What now?",
    choices: [
      { text: "Accept — more friends is more fun!", best: false, feedback: "Cool avatars can hide anyone. Strangers don't become friends just by clicking accept." },
      { text: "Ask a parent first", best: true, feedback: "Perfect. Real-life rule: you don't follow strangers home, and you don't friend them online without a parent check." },
      { text: "Share your username publicly to get even more friends", best: false, feedback: "Public usernames invite exactly the people you don't want. Keep your circle small and parent-approved." },
    ],
  },
  {
    id: "photo-share",
    title: "The photo share",
    situation: "Your friend took a silly photo of you and wants to post it. You're not sure you like it. What do you say?",
    choices: [
      { text: "Say nothing — it's just a photo", best: false, feedback: "If it bothers you, it matters. Your face, your choice — always okay to speak up." },
      { text: "'Ask me first — my face, my choice'", best: true, feedback: "Nailed it. Consent isn't just a grown-up word. Good friends ask before they post." },
      { text: "Post an embarrassing photo of them back", best: false, feedback: "Photo wars have no winners. Use your words: 'please don't post that of me.'" },
    ],
  },
  {
    id: "group-pile-on",
    title: "The group chat pile-on",
    situation: "Everyone in the group chat is laughing at one kid's mistake. It feels funny… and also kind of wrong. What do you do?",
    choices: [
      { text: "Laugh along — everyone else is", best: false, feedback: "'Everyone else is' is how pile-ons happen. The kid being laughed at sees every single message." },
      { text: "Say nothing and keep scrolling", best: false, feedback: "Silence is safer than joining in, but kindness is braver. Even leaving the chat sends a message." },
      { text: "Say something kind, or leave the chat", best: true, feedback: "That's leadership. One person standing up changes the whole temperature of a group chat." },
    ],
  },
  {
    id: "personal-info",
    title: "The personal info ask",
    situation: "A new online friend asks what school you go to and what time you walk home. They seem friendly. What do you share?",
    choices: [
      { text: "Tell them — they're nice", best: false, feedback: "'Nice' online means nothing. School, address, routines — these never go to online-only friends. Ever." },
      { text: "Keep it private — real friends don't need that info", best: true, feedback: "Exactly. Personal details are need-to-know, and an online stranger never needs to know." },
      { text: "Make something up", best: false, feedback: "Lying dodges this one, but the habit is risky. The real skill is a clean 'I don't share that online.'" },
    ],
  },
  {
    id: "teammate-struggle",
    title: "The struggling teammate",
    situation: "In a team game, one player keeps messing up and your team is losing. Some players are getting mad at them. You…?",
    choices: [
      { text: "Tell them they're ruining the game", best: false, feedback: "Yelling at a teammate has never once made anyone play better. It just makes them feel small." },
      { text: "Quit the game in frustration", best: false, feedback: "Quitting on a team teaches quitting. There's a better play here." },
      { text: "Encourage them and share one tip", best: true, feedback: "That's a captain's move. Teams win on encouragement — and you just practiced real leadership." },
    ],
  },
];

const learningPassports: { animal: string; tagline: string; facts: [string, string][] }[] = [
  {
    animal: "Dog",
    tagline: "The classic best friend — and the biggest commitment",
    facts: [
      ["🍖 Food", "Measured meals twice a day. Chocolate, grapes, and onions are dangerous — no table scraps roulette."],
      ["🏡 Space", "Daily walks plus room to play. A tired dog is a happy dog; a bored dog redecorates your couch."],
      ["💰 Costs", "Vet bills are the big surprise — checkups, vaccines, and the occasional swallowed sock."],
      ["⏳ Lifespan", "Roughly a decade or more. This is a 'rest of childhood' promise, not a summer hobby."],
      ["💛 Care", "Training, fresh water always, and being part of the family — dogs need their people."],
    ],
  },
  {
    animal: "Cat",
    tagline: "Independent — until 3am zoomies",
    facts: [
      ["🍖 Food", "Regular meals and constant fresh water. Cats are picky because they can be."],
      ["🏡 Space", "Vertical space matters — shelves and scratching posts beat a bigger floor."],
      ["💰 Costs", "Litter, food, and vet care add up quietly. Spaying/neutering is part of responsible ownership."],
      ["⏳ Lifespan", "Well into the teens. Your kindergartner's cat may see them off to college."],
      ["💛 Care", "Daily litter box scooping, play sessions, and respecting the 'pet me, but only like this' rules."],
    ],
  },
  {
    animal: "Guinea pig",
    tagline: "Small, social, and louder than expected",
    facts: [
      ["🍖 Food", "Unlimited hay always, plus vitamin C veggies daily. Their teeth never stop growing — hay files them."],
      ["🏡 Space", "Much bigger homes than pet stores suggest — and they need a same-species friend. Lonely is not okay."],
      ["💰 Costs", "Bedding, hay, and veggies are ongoing. Exotic vets cost more than cat-and-dog vets."],
      ["⏳ Lifespan", "About 5–7 years. Short enough to grasp, long enough to matter."],
      ["💛 Care", "Gentle handling, clean bedding, and floor time. They wheek when they're happy — you'll learn the sound."],
    ],
  },
  {
    animal: "Fish",
    tagline: "Calm to watch, chemistry to keep",
    facts: [
      ["🍖 Food", "A tiny pinch once or twice a day. Overfeeding is the #1 beginner mistake — it pollutes the water."],
      ["🏡 Space", "Bigger tanks are easier, not harder — small bowls swing wildly in temperature and chemistry."],
      ["💰 Costs", "Filter, heater, water conditioner, and test kit before the fish. The setup costs more than the fish."],
      ["⏳ Lifespan", "Years, not weeks — when the water is right. Most early losses are water problems, not fish problems."],
      ["💛 Care", "Partial water changes weekly and testing the water. You're really keeping water; the fish just live in it."],
    ],
  },
];

function PassportPanel({ pets, missions, isParentView, updatePet, updatePetPhoto, onStudyComplete, studiedAnimals }: {
  pets: Pet[];
  missions: Mission[];
  isParentView: boolean;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
  updatePetPhoto?: (petId: string, file?: File) => void;
  onStudyComplete: (animal: string) => void;
  studiedAnimals: string[];
}) {
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Pet passports</p>
        <h2 className="mt-2 text-3xl font-black">Everything kids need to care correctly</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          Each passport keeps the pet&apos;s food, care notes, vet, and medicine in one place so kids do not have to guess.
          {isParentView && pets.length > 0 && " Parents can edit any passport — vet changes, new medicine, new routines."}
        </p>
      </div>
      {pets.length === 0 && (
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">📚 No pet yet? Start here</p>
          <h3 className="mt-2 text-2xl font-black">Learning passports</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
            No pet needed to start becoming responsible. Study an animal&apos;s real needs — food, space, costs, lifespan —
            and it counts as journey progress in the Growth Log.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {learningPassports.map((passport) => {
              const studied = studiedAnimals.includes(passport.animal);
              return (
                <article key={passport.animal} className="rounded-lg bg-[#faf8f0] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-black">{passport.animal}</h4>
                      <p className="text-xs font-bold text-[#4f625b]">{passport.tagline}</p>
                    </div>
                    {studied && <span className="rounded-full bg-[#165a4b] px-3 py-1 text-xs font-black text-white">Studied ✓</span>}
                  </div>
                  <dl className="mt-3 grid gap-2">
                    {passport.facts.map(([label, fact]) => (
                      <div key={label} className="rounded-lg bg-white p-3 text-sm">
                        <dt className="font-black">{label}</dt>
                        <dd className="mt-1 font-semibold leading-5 text-[#4f625b]">{fact}</dd>
                      </div>
                    ))}
                  </dl>
                  {!studied && (
                    <button
                      onClick={() => onStudyComplete(passport.animal)}
                      className="mt-3 min-h-11 w-full rounded-lg bg-[#6d3ed1] px-4 py-2 text-sm font-black text-white"
                    >
                      We studied the {passport.animal} ✓
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {pets.map((pet) => {
          const care = getPetCareStats(pet.id, missions);
          return (
          <article key={pet.id} className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <PetMedallion label={pet.name} petKind={getPetLook(pet.id, pet).kind} photoUrl={pet.photoUrl} stage={care.stage} stageRing={care.stageRing} />
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">{pet.name}&apos;s passport</p>
              <h2 className="text-3xl font-black">{pet.name}</h2>
              <p className="text-sm font-black text-[#165a4b]">{pet.species}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">{care.mood}</span>
                <span className={`rounded-full bg-white px-3 py-1 text-xs font-black ring-2 ${care.stageRing}`}>{care.stage} · {care.approved} care {care.approved === 1 ? "mission" : "missions"}</span>
              </div>
              {updatePetPhoto && (
              <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-[#165a4b] px-3 py-2 text-xs font-black text-white">
                Capture pet photo
                <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => updatePetPhoto(pet.id, event.target.files?.[0])} />
              </label>
              )}
            </div>
            {isParentView && (
              <button
                onClick={() => setEditingPetId(editingPetId === pet.id ? null : pet.id)}
                className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]"
              >
                {editingPetId === pet.id ? "Done" : "Edit"}
              </button>
            )}
          </div>
          <div className="mt-5 grid gap-3">
            <Meter label={`${pet.name} happiness`} value={care.happiness} color="#f47b20" />
            <Meter label={`${pet.name} feeling loved`} value={care.loved} color="#165a4b" />
          </div>
          {isParentView && editingPetId === pet.id ? (
            <div className="mt-5 grid gap-3">
              <label className="block text-sm font-black">Name
                <input className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.name} onChange={(event) => updatePet(pet.id, { name: event.target.value })} />
              </label>
              <label className="block text-sm font-black">Species
                <input className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.species} onChange={(event) => updatePet(pet.id, { species: event.target.value })} />
              </label>
              <label className="block text-sm font-black">Favorite food
                <input className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.favoriteFood} onChange={(event) => updatePet(pet.id, { favoriteFood: event.target.value })} />
              </label>
              <label className="block text-sm font-black">Care notes
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.careNotes} onChange={(event) => updatePet(pet.id, { careNotes: event.target.value })} />
              </label>
              <label className="block text-sm font-black">Vet
                <input className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.vet} onChange={(event) => updatePet(pet.id, { vet: event.target.value })} />
              </label>
              <label className="block text-sm font-black">Medicine
                <input className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" value={pet.medicine} onChange={(event) => updatePet(pet.id, { medicine: event.target.value })} />
              </label>
            </div>
          ) : (
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-lg bg-[#faf8f0] p-3"><dt className="font-black">Favorite food</dt><dd>{pet.favoriteFood}</dd></div>
            <div className="rounded-lg bg-[#faf8f0] p-3"><dt className="font-black">Care notes</dt><dd>{pet.careNotes}</dd></div>
            <div className="rounded-lg bg-[#faf8f0] p-3"><dt className="font-black">Vet</dt><dd>{pet.vet}</dd></div>
            <div className="rounded-lg bg-[#faf8f0] p-3"><dt className="font-black">Medicine</dt><dd>{pet.medicine}</dd></div>
          </dl>
          )}
          </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Approved per-child contributions to a pooled goal, from save transactions.
 * Parent seed money is shown separately on the goal card.
 */
function goalContributions(
  goalId: string,
  transactions: BankTransaction[],
  childProfiles: Child[],
): { name: string; amount: number }[] {
  const sums = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.goalId === goalId && tx.status === "approved" && tx.category === "save") {
      sums.set(tx.childId, (sums.get(tx.childId) ?? 0) + tx.amount);
    }
  }
  return [...sums.entries()].map(([childId, amount]) => ({
    name: childProfiles.find((child) => child.id === childId)?.name ?? "Family",
    amount,
  }));
}

function BankPanel(props: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  transactions: BankTransaction[];
  goals: SavingsGoal[];
  requestBankMove: (category: BankCategory, amount?: number, description?: string, goalId?: string) => void;
  newGoal: { title: string; target: string; kind: "save" | "give"; cause: string; seed: string };
  setNewGoal: (value: { title: string; target: string; kind: "save" | "give"; cause: string; seed: string }) => void;
  addSavingsGoal: () => void;
  confirmDonation: (goalId: string) => void;
  isParentView: boolean;
  setActiveTab: (tab: string) => void;
  pointsPerDollar: number;
}) {
  type KidMoneyCategory = Exclude<BankCategory, "earn" | "spend">;
  const childTransactions = props.transactions.filter((item) => item.childId === props.child?.id);
  const childGoals = props.goals.filter((item) => item.childId === props.child?.id && (props.isParentView || item.visibleToKids !== false));
  const childLook = getChildLook(props.child?.id);
  const approvedTransactions = childTransactions.filter((tx) => tx.status === "approved");
  const approvedAllowance = approvedTransactions.filter((tx) => tx.category === "earn").reduce((sum, tx) => sum + tx.amount, 0);
  const spentOrGiven = approvedTransactions.filter((tx) => tx.category === "spend" || tx.category === "give").reduce((sum, tx) => sum + tx.amount, 0);
  const savedForGoals = childGoals.reduce((sum, goal) => sum + goalKidSaved(goal), 0);
  const availableBalance = Math.max(0, approvedAllowance - spentOrGiven - savedForGoals);
  const earnedActivityTransactions = childTransactions.filter((tx) => tx.category === "earn" && tx.status === "approved").slice(0, 4);
  const givePurposes = ["Animal shelter", "Classroom cause", "Neighborhood helper fund", "Pet rescue", "Other kindness"];
  const [moneyDraft, setMoneyDraft] = useState({
    category: "save" as KidMoneyCategory,
    amount: "3",
    reason: "",
    goalId: childGoals[0]?.id ?? "",
  });
  const [showGrownUpHint, setShowGrownUpHint] = useState(false);
  const saveGoalOptions = [
    ...childGoals,
    ...props.goals.filter(
      (goal) => goal.childId !== props.child?.id && goal.type === "donation" && goal.sharedWithTrustedFamilies && (props.isParentView || goal.visibleToKids !== false) && !childGoals.some((mine) => mine.id === goal.id),
    ),
  ];
  const selectedGoalId = saveGoalOptions.some((goal) => goal.id === moneyDraft.goalId) ? moneyDraft.goalId : saveGoalOptions[0]?.id ?? "";
  const requestedAmount = Math.max(1, Number(moneyDraft.amount) || 1);
  const submitMoneyRequest = () => {
    if (requestedAmount > availableBalance) return;
    const selectedGoal = saveGoalOptions.find((goal) => goal.id === selectedGoalId);
    if (moneyDraft.category === "save" && !selectedGoal) return;
    const defaultReason =
      moneyDraft.category === "save"
          ? `Save for ${selectedGoal?.title}`
        : "Give money for kindness";
    const actionLabel = moneyDraft.category === "save" ? "Save" : "Give";
    props.requestBankMove(
      moneyDraft.category,
      requestedAmount,
      `${actionLabel} $${requestedAmount}: ${moneyDraft.reason.trim() || defaultReason}`,
      moneyDraft.category === "save" ? selectedGoal?.id : undefined,
    );
    setMoneyDraft({ ...moneyDraft, amount: "3", reason: "" });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          Back to Today
        </button>
        <button onClick={() => props.setActiveTab("pets")} className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]">
          Pet Passports
        </button>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Choose kid bank</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {props.childProfiles.map((childProfile) => {
            const look = getChildLook(childProfile.id);
            const isSelected = childProfile.id === props.child?.id;
            return (
              <button
                key={childProfile.id}
                onClick={() => props.setActiveChildId(childProfile.id)}
                className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black ${
                  isSelected ? "border-[#f47b20] bg-[#fff4d8] text-[#17231f] ring-2 ring-[#f47b20]/20" : "border-[#ded8c7] bg-[#faf8f0] text-[#4f625b]"
                }`}
              >
                <ProfilePhoto label={childProfile.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={childProfile.photoUrl} />
                <span className="min-w-0 flex-1 truncate">{childProfile.name}</span>
                {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <ProfilePhoto
              label={props.child?.name ?? "Kid"}
              initial={childLook.initial}
              colors={childLook.colors}
              size="lg"
              variant="kid"
              hair={childLook.hair}
              photoUrl={props.child?.photoUrl}
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Kid Bank</p>
              <h2 className="mt-1 text-3xl font-black">{props.child?.name ?? "Kid"}&apos;s money choices</h2>
              <p className="mt-1 text-sm font-semibold text-[#4f625b]">💰 Dollars are real allowance · 🪙 Coins are just for fun</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#fff4d8] px-4 py-3">
              <p className="text-2xl font-black">${availableBalance}</p>
              <p className="text-xs font-black text-[#7a4b12]">dollars available</p>
            </div>
            <div className="rounded-lg bg-[#e7f4ef] px-4 py-3">
              <p className="text-2xl font-black">${savedForGoals}</p>
              <p className="text-xs font-black text-[#165a4b]">dollars in goals</p>
            </div>
            <div className="rounded-lg bg-[#eef2ff] px-4 py-3">
              <p className="text-2xl font-black">{props.child?.coins ?? 0}</p>
              <p className="text-xs font-black text-[#2563eb]">reward coins</p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-bold text-[#4f625b]">
            🐾 {(props.child?.points ?? 0).toLocaleString()} points = ${(((props.child?.points ?? 0) / Math.max(1, props.pointsPerDollar)).toFixed(2))} at your family's rate ({props.pointsPerDollar} points = $1)
            {props.isParentView ? " — adjust the rate in Family Setup." : ""}
          </p>
          {availableBalance === 0 && (
            <div className="mt-3 rounded-lg border-2 border-dashed border-[#f47b20] bg-[#fff8ef] p-4 text-center">
              <p className="text-base font-black text-[#7a4b12]">You have $0 right now — that's okay!</p>
              <p className="mt-1 text-sm font-bold text-[#7a4b12]">Finish a parent-assigned mission to earn your first dollars, then come back here to save or give.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">My goals</p>
          <h3 className="mt-2 text-2xl font-black">What are you saving for?</h3>
          <div className="mt-4 grid gap-3">
            {!childGoals.length && (
              props.isParentView ? (
                <div className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">
                  No goals yet — start the first one below 👇
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] p-4 text-center">
                  <p className="text-sm font-black text-[#0d3b30]">No goals yet — ask a parent to start one with you 🌱</p>
                  <button
                    onClick={() => setShowGrownUpHint((show) => !show)}
                    className="tt-btn-press mt-3 min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
                  >
                    Show this to a grown-up →
                  </button>
                  {showGrownUpHint && (
                    <p className="mx-auto mt-2 max-w-xs text-xs font-bold text-[#4f625b]">
                      A grown-up can start a save or give goal for you from the Parent side 🌱
                    </p>
                  )}
                </div>
              )
            )}
            {childGoals.map((goal) => {
              const percent = Math.min(100, (goal.saved / goal.target) * 100);
              const isDonation = goal.type === "donation";
              return (
                <article key={goal.id} className="rounded-lg bg-[#faf8f0] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">
                        {isDonation ? "💛 " : ""}{goal.title}
                      </p>
                      {isDonation && goal.causeNote && (
                        <p className="mt-1 inline-block rounded-full bg-[#ffe9a8] px-2 py-0.5 text-xs font-black text-[#7a4b12]">{goal.causeNote}</p>
                      )}
                      <p className="mt-1 text-sm font-bold text-[#4f625b]">
                        {goal.donationConfirmedAt
                          ? "🎉 Donated — thank you for the real-world kindness!"
                          : goal.completedAt
                            ? "Goal reached! Waiting for parent to confirm the donation."
                            : `$${goal.target - goal.saved} left to go`}
                      </p>
                      {isDonation && goal.seededByParent ? (
                        <p className="mt-1 text-xs font-bold text-[#69736f]">Parent seeded ${goal.seededByParent} to start</p>
                      ) : null}
                      <p className="mt-1 text-xs font-bold text-[#69736f]">
                        {goal.sharedWithTrustedFamilies ? "Shared with trusted families as a cause" : "Private goal"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black">${goal.saved}/${goal.target}</span>
                  </div>
                  <div className="mt-3 h-4 rounded-full bg-white">
                    <div className={`h-4 rounded-full ${isDonation ? "bg-[#f4b400]" : "bg-[#165a4b]"}`} style={{ width: `${percent}%` }} />
                  </div>
                  {isDonation && goal.completedAt && !goal.donationConfirmedAt && props.isParentView && (
                    <button
                      onClick={() => props.confirmDonation(goal.id)}
                      className="mt-3 min-h-11 w-full rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
                    >
                      Confirm: we donated ${goal.target} to {goal.causeNote ?? "the cause"} ✓
                    </button>
                  )}
                  {!goal.completedAt && (
                    <p className="mt-3 rounded-lg bg-white p-3 text-xs font-bold text-[#4f625b]">
                      Use the choices panel to move available dollars into this goal.
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {props.isParentView && (
          <div className="mt-4 rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Start a new goal</h4>
            {props.isParentView && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["save", "give"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => props.setNewGoal({ ...props.newGoal, kind })}
                    className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${props.newGoal.kind === kind ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"}`}
                  >
                    {kind === "save" ? "💰 Save for something" : "💛 Giving goal"}
                  </button>
                ))}
              </div>
            )}
            {props.isParentView && props.newGoal.kind === "give" && (
              <p className="mt-2 text-xs font-bold leading-5 text-[#7a4b12]">
                You set the goal and fund the start — your kid picks it and works toward it. Giving, earned.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold"
                placeholder={props.newGoal.kind === "give" ? "Example: Blankets for Sunny Paws Shelter" : "Example: Captain treats"}
                value={props.newGoal.title}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, title: event.target.value })}
              />
              <input
                className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold"
                inputMode="numeric"
                placeholder="$ target"
                value={props.newGoal.target}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, target: event.target.value })}
              />
              <button onClick={props.addSavingsGoal} className="min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Add goal</button>
            </div>
            {props.isParentView && props.newGoal.kind === "give" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-black">
                  Cause
                  <select
                    className="mt-1 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 font-semibold"
                    value={props.newGoal.cause}
                    onChange={(event) => props.setNewGoal({ ...props.newGoal, cause: event.target.value })}
                  >
                    {["Animal shelter", "Pet rescue", "Classroom cause", "Neighborhood helper fund", "Other kindness"].map((cause) => (
                      <option key={cause} value={cause}>{cause}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-black">
                  Parent seed $
                  <input
                    className="mt-1 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold"
                    inputMode="numeric"
                    placeholder="0"
                    value={props.newGoal.seed}
                    onChange={(event) => props.setNewGoal({ ...props.newGoal, seed: event.target.value })}
                  />
                </label>
              </div>
            )}
          </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f47b20]">Use available dollars</p>
            <h3 className="mt-2 text-3xl font-black">Choose a money jar</h3>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#4f625b]">Dollars come from parent-assigned tasks. Kids can save for a goal or give to a parent-approved cause.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["save", "give"] as KidMoneyCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setMoneyDraft({ ...moneyDraft, category, reason: "" })}
                  className={`min-h-16 rounded-lg px-4 py-3 text-lg font-black ${
                    moneyDraft.category === category ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-[#faf8f0] text-[#17231f]"
                  }`}
                >
                  {category === "save" ? "Save to goal" : "Give/help"}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-lg font-black">
              Amount
              <div className="mt-3 grid grid-cols-4 gap-3">
                {["1", "2", "5", "10"].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setMoneyDraft({ ...moneyDraft, amount })}
                    className={`min-h-14 rounded-lg px-3 py-2 text-lg font-black ${
                      moneyDraft.amount === amount ? "bg-[#f47b20] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <input
                className="mt-3 w-full rounded-lg border border-[#ded8c7] px-4 py-4 text-lg font-semibold"
                inputMode="numeric"
                value={moneyDraft.amount}
                onChange={(event) => setMoneyDraft({ ...moneyDraft, amount: event.target.value })}
                placeholder="Other amount"
              />
            </label>
            <label className="mt-5 block text-lg font-black">
              {moneyDraft.category === "save" ? "Which goal?" : "Which cause?"}
              {moneyDraft.category === "save" ? (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={selectedGoalId}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, goalId: event.target.value })}
                >
                  {saveGoalOptions.map((goal) => {
                    const owner = props.childProfiles.find((child) => child.id === goal.childId);
                    const pooled = goal.childId !== props.child?.id;
                    return <option key={goal.id} value={goal.id}>{pooled ? `Shared with family: ${goal.title} (${owner?.name ?? "family"})` : goal.title} (${goal.saved}/${goal.target})</option>;
                  })}
                </select>
              ) : (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={moneyDraft.reason}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, reason: event.target.value })}
                >
                  <option value="">Choose a purpose</option>
                  {givePurposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
                </select>
              )}
            </label>
            <button
              onClick={submitMoneyRequest}
              disabled={requestedAmount > availableBalance || (moneyDraft.category === "save" && !saveGoalOptions.length)}
              className="mt-5 min-h-14 w-full rounded-lg bg-[#165a4b] px-5 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9b2a2]"
            >
              Ask parent to approve {moneyDraft.category} ${requestedAmount}
            </button>
            {moneyDraft.category === "save" && !saveGoalOptions.length && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">Add a goal before saving dollars.</p>
            )}
            {requestedAmount > availableBalance && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">That is more than the available dollars.</p>
            )}
            <div className="mt-4 rounded-lg bg-[#faf8f0] p-4 text-base font-bold leading-6 text-[#4f625b]">
              To earn dollars, finish parent-assigned tasks. This panel only moves approved dollars into savings or giving.
            </div>
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="font-black">Allowance approved for activities</h3>
            {earnedActivityTransactions.map((tx) => (
              <p key={tx.id} className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-sm font-semibold">
                <b>+${tx.amount}</b>
                <span className="mt-1 block">{tx.description}</span>
              </p>
            ))}
            {!earnedActivityTransactions.length && <p className="mt-3 rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold text-[#4f625b]">Approved allowance tied to activities will show here.</p>}
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <h3 className="font-black">Waiting and history</h3>
          {childTransactions.some((tx) => tx.status === "pending") && (
            <div className="mt-3 grid gap-2">
              {childTransactions.filter((tx) => tx.status === "pending").map((tx) => (
                <p key={tx.id} className="rounded-lg border-2 border-[#f4b400] bg-[#fff4d8] p-3 text-sm font-semibold">
                  <b className="capitalize">{tx.category}</b> ${tx.amount} · <span className="font-black text-[#7a4b12]">waiting</span>
                  <span className="mt-1 block">{tx.description}</span>
                </p>
              ))}
            </div>
          )}
          <div className="mt-2 grid gap-2">
            {childTransactions.filter((tx) => tx.status !== "pending").map((tx) => (
              <p key={tx.id} className="rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold text-[#4f625b]">
                <b className="capitalize">{tx.category}</b> ${tx.amount} · <span className="font-black">done</span>
                <span className="mt-1 block">{tx.description}</span>
              </p>
            ))}
          </div>
          {!childTransactions.length && <p className="mt-3 rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold text-[#4f625b]">No bank moves yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-3 shadow-sm sm:hidden">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-12 w-full rounded-lg bg-[#17231f] px-4 py-3 text-sm font-black text-white">
          Back to Today
        </button>
      </div>
    </section>
  );
}

function ApprovalsPanel(props: {
  missions: Mission[];
  transactions: BankTransaction[];
  childProfiles: Child[];
  approveMission: (missionId: string) => void;
  approveTransaction: (transactionId: string) => void;
  rejectMission: (missionId: string, reason?: string) => void;
  rejectTransaction: (transactionId: string) => void;
}) {
  const pendingMissions = props.missions.filter((mission) => mission.completedBy && mission.status === "pending");
  const pendingTransactions = props.transactions.filter((tx) => tx.status === "pending");
  const [sendBackFor, setSendBackFor] = useState<string | null>(null);
  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Missions</p>
            <h2 className="mt-1 text-2xl font-black">Kid missions waiting on you</h2>
          </div>
          {pendingMissions.length > 0 && (
            <button
              onClick={() => pendingMissions.forEach((mission) => props.approveMission(mission.id))}
              className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white"
            >
              Approve all ({pendingMissions.length})
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3">
          {!pendingMissions.length && (
            <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">No missions waiting right now.</p>
          )}
          {pendingMissions.map((mission) => {
            const child = props.childProfiles.find((entry) => entry.id === mission.completedBy);
            const childLook = getChildLook(child?.id);
            return (
              <article key={mission.id} className="flex gap-4 rounded-lg bg-[#faf8f0] p-4">
                <ProfilePhoto
                  label={child?.name ?? "Kid"}
                  initial={childLook.initial}
                  colors={childLook.colors}
                  size="md"
                  variant="kid"
                  hair={childLook.hair}
                  photoUrl={child?.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#4f625b]">{child?.name ?? "Kid"} finished</p>
                  <h3 className="mt-1 text-xl font-black">{mission.title}</h3>
                  {mission.note ? (
                    <p className="mt-2 rounded-lg bg-white p-3 text-sm font-semibold leading-6 text-[#17231f]">“{mission.note}”</p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold italic text-[#69736f]">No note from {child?.name ?? "kid"} this time.</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black">🪙 +{mission.coins} coins</span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black">🔥 {child?.streakDays ?? 0}-day streak</span>
                    {mission.allowanceDollars ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black">💰 +${mission.allowanceDollars}</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => props.approveMission(mission.id)}
                      className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white"
                    >
                      Approve
                    </button>
                    {sendBackFor === mission.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { props.rejectMission(mission.id, "Not done yet — give it another try! 💪"); setSendBackFor(null); }}
                          className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#b44421]"
                        >
                          Not done yet
                        </button>
                        <button
                          onClick={() => { props.rejectMission(mission.id, "Needs a photo — snap one and send it again 📸"); setSendBackFor(null); }}
                          className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#b44421]"
                        >
                          Needs a photo
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setSendBackFor(mission.id)} className="min-h-11 px-2 py-2 text-sm font-bold text-[#69736f] underline underline-offset-2">
                        Send back
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Kid Bank</p>
            <h2 className="mt-1 text-2xl font-black">Money requests</h2>
          </div>
          {pendingTransactions.length > 0 && (
            <button
              onClick={() => pendingTransactions.forEach((tx) => props.approveTransaction(tx.id))}
              className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white"
            >
              Approve all ({pendingTransactions.length})
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3">
          {!pendingTransactions.length && (
            <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">No money requests waiting right now.</p>
          )}
          {pendingTransactions.map((tx) => {
            const child = props.childProfiles.find((entry) => entry.id === tx.childId);
            const childLook = getChildLook(child?.id);
            return (
              <article key={tx.id} className="flex gap-4 rounded-lg bg-[#fff4d8] p-4">
                <ProfilePhoto
                  label={child?.name ?? "Kid"}
                  initial={childLook.initial}
                  colors={childLook.colors}
                  size="md"
                  variant="kid"
                  hair={childLook.hair}
                  photoUrl={child?.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-black capitalize">{tx.category} · ${tx.amount}</h3>
                  <p className="mt-1 text-sm font-semibold text-[#17231f]">{tx.description}</p>
                  <p className="mt-1 text-xs font-bold text-[#4f625b]">{child?.name ?? "Kid"} requested this</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => props.approveTransaction(tx.id)}
                      className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white"
                    >
                      Approve
                    </button>
                    <button onClick={() => props.rejectTransaction(tx.id)} className="min-h-11 px-2 py-2 text-sm font-bold text-[#69736f] underline underline-offset-2">
                      Decline
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MissionAssignmentPanel(props: {
  missions: Mission[];
  childProfiles: Child[];
  badges: BadgeAward[];
  assignMission: (missionId: string, childId: string) => void;
  autoBalanceMissions: () => void;
}) {
  const plannedPoints = props.childProfiles.map((child) => ({
    child,
    points: props.missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sortedPoints = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sortedPoints[0];
  const highest = sortedPoints[sortedPoints.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  const familySkillSummary = getFamilySkillSummary(props.badges, props.childProfiles);

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Fair mission assignment</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">One owner per task, balanced points</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Kids only see missions assigned to their profile. Harder work is worth more, and auto-balance prefers age-fit tasks before evening out points.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={props.autoBalanceMissions} className="min-h-11 rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white">
          Auto balance tasks
        </button>
        <span className="inline-flex min-h-11 items-center rounded-lg bg-[#eef2ff] px-4 py-2 text-sm font-black text-[#2563eb]">
          Harder tasks automatically carry more points
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Fairness engine</p>
          <p className="mt-2 text-lg font-black">Fairness, not first-click competition</p>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">Every task has one owner, age guidance, and point balancing across kids.</p>
        </div>
        <div className="rounded-lg bg-[#f0edff] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">Values tracked</p>
          <p className="mt-2 text-lg font-black">{familySkillSummary.topLabel}</p>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">Badges become parent-visible proof of growth, not just stickers.</p>
        </div>
        <div className="rounded-lg bg-[#fff4d8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Current spread</p>
          <p className="mt-2 text-lg font-black">{spread} planned points</p>
          <p className="mt-1 text-sm font-bold text-[#7a4b12]">Keep kids near the same total while harder work still earns more.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {plannedPoints.map(({ child, points }) => (
          <div key={child.id} className="rounded-lg bg-[#faf8f0] p-4">
            <p className="text-lg font-black">{child.name}</p>
            <p className="mt-1 text-sm font-bold text-[#4f625b]">Age {child.age} • {points} planned points today</p>
          </div>
        ))}
      </div>
      <p className={`mt-3 rounded-lg p-3 text-sm font-black ${spread <= 8 ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
        {spread <= 8
          ? "Looks balanced. Kids should finish with similar points if they complete their assignments."
          : `${highest?.child.name ?? "One kid"} has ${spread} more planned points than ${lowest?.child.name ?? "another kid"}. Move one mission to rebalance.`}
      </p>
      <div className="mt-4 grid gap-3">
        {props.missions.map((mission) => (
          <article key={mission.id} className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4 md:grid-cols-[1fr_190px] md:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#2563eb]">{difficultyAgeGuidance[mission.difficulty].label}</span>
                <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6d3ed1]">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                {mission.status === "approved" && <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">Approved</span>}
              </div>
              <h3 className="mt-2 text-lg font-black">{mission.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#4f625b]">{mission.question}</p>
              <p className="mt-2 text-xs font-black text-[#7a4b12]">{getAgeFitCopy(mission, props.childProfiles.find((child) => child.id === mission.assignedChildId))}</p>
            </div>
            <label className="text-sm font-black text-[#17231f]">
              Assigned kid
              <select
                value={mission.assignedChildId ?? props.childProfiles[0]?.id ?? ""}
                onChange={(event) => props.assignMission(mission.id, event.target.value)}
                disabled={mission.status === "approved"}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold disabled:bg-[#ede8db]"
              >
                {props.childProfiles.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnterpriseReadinessPanel() {
  const checks = [
    ["Child privacy", "Kids are not searchable, and community actions stay parent-led."],
    ["Reward governance", "Points, dollars, badges, and giving requests require parent approval."],
    ["Life-skills evidence", "Badges roll up into responsibility, empathy, teamwork, leadership, and time management."],
    ["Deployment path", "PWA-ready for phone, tablet, and home hub screens before native app investment."],
  ];

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Family safety model</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Parent-controlled, kid-simple, values-measurable</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map(([title, body]) => (
          <article key={title} className="rounded-lg bg-white/10 p-4">
            <p className="text-base font-black">{title}</p>
            <p className="mt-2 text-sm font-semibold leading-5 text-white/75">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FamilySetupPanel(props: {
  cloudAccountEmail: string;
  accountDraft: { email: string };
  setAccountDraft: (value: { email: string }) => void;
  accountStatus: "idle" | "saving" | "loading" | "error" | "saved";
  accountMessage: string;
  sendParentSignInLink: () => void;
  magicLinkSent: boolean;
  signOutParentAccount: () => void;
  saveCurrentFamilyAccount: () => void;
  loadCurrentFamilyAccount: () => void;
  cloudFamilyReady: boolean;
  cloudSyncOn: boolean;
  cloudSyncStatus: "idle" | "working" | "error";
  cloudSyncMessage: string;
  enableCloudSyncNow: () => void;
  familyName: string;
  setFamilyName: (value: string) => void;
  lastSavedAt: Date | null;
  parents: ParentProfile[];
  updateParent: (parentId: string, updates: Partial<ParentProfile>) => void;
  updateParentPhoto: (parentId: string, file?: File) => void;
  childProfiles: Child[];
  updateChild: (childId: string, updates: Partial<Child>) => void;
  updateChildPhoto: (childId: string, file?: File) => void;
  pets: Pet[];
  updatePet: (petId: string, updates: Partial<Pet>) => void;
  updatePetPhoto: (petId: string, file?: File) => void;
  newChild: { name: string; age: string };
  setNewChild: (value: { name: string; age: string }) => void;
  addChild: () => void;
  removeChild: (childId: string) => void;
  newPet: { name: string; species: string; food: string };
  setNewPet: (value: { name: string; species: string; food: string }) => void;
  addPet: () => void;
  updateFamilyPhoto: (file?: File) => void;
  updateFamilyPhotoAndPickProfiles: (file?: File) => void;
  pickProfilesFromSavedFamilyPhoto: () => void;
  hasFamilyPhoto: boolean;
  parentPasscode: string;
  setParentPasscode: (value: string) => void;
  pointsPerDollar: number;
  setPointsPerDollar: (value: number) => void;
  dailyChecksEnabled: boolean;
  setDailyChecksEnabled: (value: boolean) => void;
  maxDailyChecks: number;
  setMaxDailyChecks: (value: number) => void;
}) {
  const setupSteps = [
    ["Parent account", Boolean(props.cloudAccountEmail), props.cloudAccountEmail ? "Signed in" : "Create or sign in"],
    ["Household", Boolean(props.familyName.trim()), props.familyName.trim() || "Name your family"],
    ["Kids", props.childProfiles.length > 0, `${props.childProfiles.length} added`],
    ["Pets", props.pets.length > 0, `${props.pets.length} added`],
    ["First goals", true, "Use Today and Kid Bank next"],
  ] as const;
  const completedSteps = setupSteps.filter(([, done]) => done).length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#ffffff] p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Real family setup</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Start simple. Add the family pieces first.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
              Set up the parent account, household, kids, and pets. TailTots can grow into goals, rewards, and Kid Bank after the first mission.
              Read our <a className="font-black text-[#165a4b] underline" href="https://tailtots.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
            </p>
          </div>
          <div className="rounded-lg bg-[#165a4b] px-4 py-3 text-sm font-black text-white">
            {completedSteps} of {setupSteps.length} ready
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {setupSteps.map(([label, done, detail]) => (
            <div key={label} className={`rounded-lg border p-3 ${done ? "border-[#ded8c7] bg-[#e7f4ef]" : "border-[#ded8c7] bg-white"}`}>
              <p className="text-sm font-black text-[#17231f]">{label}</p>
              <p className={`mt-1 text-xs font-bold ${done ? "text-[#165a4b]" : "text-[#7a4b12]"}`}>{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#dce6f8] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Parent account</p>
            <h2 className="mt-2 text-3xl font-black">Save this family setup</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
              A signed-in parent account can keep this family&apos;s profiles, family photos, kids, pets, goals, points, coins, Kid Bank, badges, and parent settings together.
            </p>
          </div>
          <div className={`rounded-lg px-4 py-3 text-sm font-black ${props.cloudAccountEmail ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
            {props.cloudAccountEmail ? `Signed in: ${props.cloudAccountEmail}` : isSupabaseConfigured ? "Ready for account sign in" : "Account setup"}
          </div>
        </div>

        {!props.cloudAccountEmail && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={props.accountDraft.email}
              onChange={(event) => props.setAccountDraft({ email: event.target.value })}
              className="min-h-12 rounded-lg border border-[#dce6f8] px-4 py-3 font-semibold"
              inputMode="email"
              placeholder="Parent email"
              type="email"
              aria-label="Parent email"
            />
            <button onClick={props.sendParentSignInLink} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {props.accountStatus === "loading" ? "Sending..." : "Email me a sign-in link"}
            </button>
          </div>
        )}

        {!props.cloudAccountEmail && props.magicLinkSent && (
          <div className="mt-3 rounded-lg bg-[#e7f4ef] px-4 py-3 text-sm font-bold text-[#165a4b]">
            Check your email — tap the sign-in link to finish signing in. The link expires in about an hour.
          </div>
        )}

        {isSupabaseConfigured && props.cloudAccountEmail && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={props.saveCurrentFamilyAccount} disabled={props.accountStatus === "saving"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {props.accountStatus === "saving" ? "Saving..." : "Save to parent account"}
            </button>
            <button onClick={props.loadCurrentFamilyAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#dce6f8] bg-white px-5 py-3 text-sm font-black text-[#1e3a8a] disabled:opacity-60">
              Load from parent account
            </button>
            <button onClick={props.signOutParentAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#ded8c7] bg-[#faf8f0] px-5 py-3 text-sm font-black text-[#7a4b12] disabled:opacity-60">
              Sign out
            </button>
          </div>
        )}

        {props.accountMessage && (
          <p className={`mt-3 text-sm font-bold ${props.accountStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`}>
            {props.accountMessage}
          </p>
        )}

        {props.cloudAccountEmail && props.cloudFamilyReady && !props.cloudSyncOn && (
          <div className="mt-4 rounded-lg border border-[#dce6f8] bg-[#eef2ff] p-4">
            <p className="text-sm font-black text-[#1e3a8a]">Cloud sync is ready — turn it on?</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">
              This pushes the kids, pets, missions, Kid Bank, goals, badges, and jobs on this device into your family&apos;s private cloud tables, then keeps them in sync automatically.
            </p>
            <button
              onClick={props.enableCloudSyncNow}
              disabled={props.cloudSyncStatus === "working"}
              className="mt-3 min-h-12 rounded-lg bg-[#1e3a8a] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {props.cloudSyncStatus === "working" ? "Starting sync..." : "Turn on cloud sync"}
            </button>
          </div>
        )}

        {props.cloudSyncOn && (
          <div className={`mt-4 rounded-lg border p-4 ${props.cloudSyncStatus === "error" ? "border-[#e8b4a0] bg-[#fdf1ec]" : "border-[#ded8c7] bg-[#e7f4ef]"}`}>
            <p className={`text-sm font-black ${props.cloudSyncStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`}>
              {props.cloudSyncStatus === "working" ? "Syncing with your family's cloud..." : props.cloudSyncStatus === "error" ? "Cloud sync hit a snag" : "Cloud sync is on"}
            </p>
            {props.cloudSyncMessage && (
              <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">{props.cloudSyncMessage}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Family setup</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-black">Household, kids, and pets</h2>
          {props.lastSavedAt && (
            <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#0d3b30]" aria-live="polite">
              Saved ✓ {props.lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          This is the control room for who uses TailTots. Keep parent info simple, make each kid easy to recognize, and make every pet passport easy to scan.
        </p>
        <label className="mt-5 block text-sm font-black text-[#17231f]">
          Household name
          <input
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            value={props.familyName}
            onChange={(event) => props.setFamilyName(event.target.value)}
            placeholder="The Smith Crew"
          />
        </label>
        <label className="mt-4 block max-w-xs text-sm font-black text-[#17231f]">
          Parent passcode
          <input
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            value={props.parentPasscode}
            onChange={(event) => props.setParentPasscode(event.target.value)}
            inputMode="numeric"
            placeholder="4321"
          />
        </label>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Healthy app habits</p>
        <h3 className="mt-2 text-2xl font-black">Pacing and points, set by you</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          About a minute per visit keeps TailTots a helper, not a habit. Limit how many times kids can open the app each day, and set what their points are worth in dollars.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg bg-[#faf8f0] p-4">
          <input
            type="checkbox"
            checked={props.dailyChecksEnabled}
            onChange={(event) => props.setDailyChecksEnabled(event.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-sm font-black text-[#17231f]">Limit kid check-ins per day</span>
        </label>
        {props.dailyChecksEnabled && (
          <label className="mt-3 block max-w-xs text-sm font-black text-[#17231f]">
            Max check-ins per day
            <input
              type="number"
              min={1}
              max={50}
              value={props.maxDailyChecks}
              onChange={(event) => props.setMaxDailyChecks(Math.max(1, Math.min(50, Number(event.target.value) || 10)))}
              className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            />
          </label>
        )}
        <label className="mt-4 block max-w-xs text-sm font-black text-[#17231f]">
          Points per $1
          <input
            type="number"
            min={1}
            value={props.pointsPerDollar}
            onChange={(event) => props.setPointsPerDollar(Math.max(1, Number(event.target.value) || 20))}
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
          />
          <span className="mt-1 block text-xs font-semibold text-[#4f625b]">Kids see the converted value in Kid Bank; only parents set the rate.</span>
        </label>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Photo setup</p>
        <h3 className="mt-2 text-2xl font-black">Pick each profile photo correctly</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          Upload one family picture and TailTots will walk you through cropping the parent and kids from that same photo. Pets can still use their own passport photos below.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
            Upload family photo and pick profiles
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhotoAndPickProfiles(event.target.files?.[0])} />
          </label>
          <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-[#ded8c7] bg-white px-5 py-3 text-sm font-black text-[#17231f]">
            Set family picture only
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhoto(event.target.files?.[0])} />
          </label>
          <button
            onClick={props.pickProfilesFromSavedFamilyPhoto}
            disabled={!props.hasFamilyPhoto}
            title={props.hasFamilyPhoto ? "Crop profile photos from the family picture" : "Upload a family photo first"}
            className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b9b2a2]"
          >
            Pick profiles from current family photo
          </button>
          {!props.hasFamilyPhoto && (
            <p className="text-xs font-semibold text-[#69736f]">Upload a family photo first to pick profiles from it.</p>
          )}
        </div>
      </div>

      <section className="grid gap-4 2xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Parents</p>
          <h3 className="mt-2 text-2xl font-black">Grown-up profiles</h3>
          <div className="mt-4 grid gap-3">
            {props.parents.map((parent) => (
              <article key={parent.id} className="rounded-lg bg-[#faf8f0] p-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto label={parent.name} initial={parent.name.trim()[0]?.toUpperCase() ?? "P"} colors="from-[#ffd166] via-[#f47b20] to-[#6d3ed1]" variant="kid" hair="#4a2718" photoUrl={parent.photoUrl} />
                  <label className="min-w-0 flex-1 text-sm font-black">
                    Parent name
                    <input
                      className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold"
                      value={parent.name}
                      onChange={(event) => props.updateParent(parent.id, { name: event.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-xs font-black text-[#17231f]">
                  Upload parent face
                  <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateParentPhoto(parent.id, event.target.files?.[0])} />
                </label>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Kids</p>
          <h3 className="mt-2 text-2xl font-black">Kid profiles</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {props.childProfiles.map((child) => {
              const look = getChildLook(child.id);
              return (
                <article key={child.id} className="rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4">
                  <div className="flex items-center gap-3">
                    <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black">{child.name || "Kid profile"}</p>
                      <p className="text-xs font-bold text-[#69736f]">Age {child.age} • {levelLabels[child.level]} helper</p>
                    </div>
                  </div>
                  <label className="mt-4 block text-sm font-black">
                    Kid name
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={child.name} onChange={(event) => props.updateChild(child.id, { name: event.target.value })} />
                  </label>
                  <label className="mt-3 block text-sm font-black">
                    Age
                    <input
                      className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold"
                      value={child.age}
                      onChange={(event) => props.updateChild(child.id, { age: Math.max(3, Math.min(18, Number(event.target.value) || child.age || 8)) })}
                      inputMode="numeric"
                      type="number"
                      min={3}
                      max={18}
                    />
                  </label>
                  <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-xs font-black text-[#17231f]">
                    Capture kid face
                    <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateChildPhoto(child.id, event.target.files?.[0])} />
                  </label>
                  <button
                    onClick={() => {
                      if (window.confirm(`Remove ${child.name || "this kid"}'s profile? This permanently deletes their missions, Kid Bank history, goals, badges, and all other data.`)) {
                        props.removeChild(child.id);
                      }
                    }}
                    className="mt-3 min-h-11 rounded-lg border border-[#e5b8b8] bg-white px-4 py-2 text-xs font-black text-[#b44421]"
                  >
                    Remove profile
                  </button>
                </article>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Add another kid</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" placeholder="Child name" value={props.newChild.name} onChange={(event) => props.setNewChild({ ...props.newChild, name: event.target.value })} />
              <input className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" placeholder="Age" value={props.newChild.age} onChange={(event) => props.setNewChild({ ...props.newChild, age: event.target.value })} inputMode="numeric" type="number" min={3} max={18} />
              <button onClick={props.addChild} className="min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Add kid</button>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Pets</p>
        <h3 className="mt-2 text-2xl font-black">Pet passports</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {props.pets.map((pet) => {
            const look = getPetLook(pet.id, pet);
            return (
              <article key={pet.id} className="rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto label={pet.name} initial={look.face} colors={look.colors} variant="pet" petKind={look.kind} photoUrl={pet.photoUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black">{pet.name || "Pet profile"}</p>
                    <p className="text-xs font-bold text-[#69736f]">{pet.species || "Species"}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-black">
                    Pet name
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.name} onChange={(event) => props.updatePet(pet.id, { name: event.target.value })} />
                  </label>
                  <label className="text-sm font-black">
                    Species
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.species} onChange={(event) => props.updatePet(pet.id, { species: event.target.value })} />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-black">
                  Favorite food
                  <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.favoriteFood} onChange={(event) => props.updatePet(pet.id, { favoriteFood: event.target.value })} />
                </label>
                <label className="mt-3 block text-sm font-black">
                  Care notes
                  <textarea className="mt-2 min-h-24 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.careNotes} onChange={(event) => props.updatePet(pet.id, { careNotes: event.target.value })} />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-black">
                    Vet
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.vet} onChange={(event) => props.updatePet(pet.id, { vet: event.target.value })} />
                  </label>
                  <label className="text-sm font-black">
                    Medicine
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.medicine} onChange={(event) => props.updatePet(pet.id, { medicine: event.target.value })} />
                  </label>
                </div>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#165a4b] px-4 py-2 text-xs font-black text-white">
                  Capture pet face
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => props.updatePetPhoto(pet.id, event.target.files?.[0])} />
                </label>
              </article>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
          <h4 className="text-lg font-black">Add another pet</h4>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" placeholder="Pet name" value={props.newPet.name} onChange={(event) => props.setNewPet({ ...props.newPet, name: event.target.value })} />
            <input className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" placeholder="Species" value={props.newPet.species} onChange={(event) => props.setNewPet({ ...props.newPet, species: event.target.value })} />
            <input className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold" placeholder="Favorite food" value={props.newPet.food} onChange={(event) => props.setNewPet({ ...props.newPet, food: event.target.value })} />
            <button onClick={props.addPet} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">Add pet</button>
          </div>
        </div>
      </div>
      <ReferralBlock />
    </section>
  );
}

/** Parent-to-parent referral: copy a shareable message. Never shown to kids. */
function ReferralBlock() {
  const [referralCopied, setReferralCopied] = useState(false);
  async function copyReferral() {
    const message =
      "Know a parent who heard \"can we get a puppy?!\" 🐾 TailTots turns that begging into real-world responsibility: kids earn pet care through AI-guided missions while parents stay in control. Parent-to-parent invite — no kid accounts needed to start.";
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const area = document.createElement("textarea");
      area.value = message;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setReferralCopied(true);
    window.setTimeout(() => setReferralCopied(false), 2500);
  }
  return (
    <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Spread the word</p>
      <h3 className="mt-2 text-2xl font-black">Know a parent who heard &ldquo;can we get a puppy?!&rdquo;</h3>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Copy this parent-to-parent invite and send it their way. TailTots turns &ldquo;can we get a puppy?!&rdquo; into real-world responsibility — kids earn pet care through AI-guided missions while parents stay in control.
      </p>
      <button onClick={copyReferral} className="mt-4 min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">
        {referralCopied ? "Invite copied ✓" : "Copy referral invite"}
      </button>
    </div>
  );
}

function CertificateCard(props: {
  child: Child;
  missions: Mission[];
  badges: BadgeAward[];
  certificates: Certificate[];
  familyName: string;
  hasPets: boolean;
}) {
  const earned = props.certificates.find((cert) => cert.childId === props.child.id);
  const progress = getCertificateProgress(props.child, props.missions, props.badges, props.hasPets);
  const trackLabel = props.hasPets ? "Certified Pet Hero track" : "Pet Readiness track";
  if (earned) {
    const earnedDate = new Date(earned.earnedAt);
    const dateLabel = Number.isNaN(earnedDate.getTime())
      ? earned.earnedAt
      : earnedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    return (
      <div className="mt-4 rounded-3xl border-4 border-double border-[#6d3ed1]/40 bg-white p-5 text-center shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6d3ed1]">TailTots · Official</p>
        <p className="mt-1 text-xl font-black text-[#17231f]">{earned.title}</p>
        <p className="mx-auto mt-2 max-w-[18rem] text-sm font-semibold leading-6 text-[#4f625b]">
          This certifies that <span className="font-black text-[#17231f]">{props.child.name}</span> of the{" "}
          <span className="font-black text-[#17231f]">{props.familyName}</span> family earned this honor on {dateLabel} —
          real missions, parent-approved, streak kept alive.
        </p>
        <div className="mt-3 flex items-center justify-center gap-4 text-2xl" aria-hidden="true">
          <span>🎓</span><span>🐾</span><span>⭐</span>
        </div>
        <button
          onClick={() => downloadCertificate(props.child, earned, props.familyName)}
          className="mt-4 min-h-11 rounded-lg bg-[#6d3ed1] px-5 py-2 text-sm font-black text-white"
        >
          Download certificate 🖨️
        </button>
        <p className="mt-2 text-xs font-semibold text-[#4f625b]">Saves as a printable page — frame it, or share it with grandparents.</p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-lg border border-[#e3ddc9] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-[#17231f]">🎓 Journey to the certificate</p>
        <span className="rounded-full bg-[#f0edff] px-2 py-1 text-[11px] font-black text-[#4c1d95]">{trackLabel}</span>
      </div>
      <div className="mt-3 grid gap-2">
        <Meter
          label={props.hasPets ? "Approved pet-care missions" : "Approved missions"}
          value={Math.min(100, Math.round((progress.missionsDone / progress.missionsRequired) * 100))}
          color="#6d3ed1"
        />
        <p className="-mt-1 text-right text-xs font-bold text-[#4f625b]">{progress.missionsDone}/{progress.missionsRequired}</p>
        <Meter label="Streak days" value={Math.min(100, Math.round((progress.streakDays / progress.streakRequired) * 100))} color="#f47b20" />
        <p className="-mt-1 text-right text-xs font-bold text-[#4f625b]">{progress.streakDays}/{progress.streakRequired}</p>
        <Meter label="Life-skill areas with badges" value={Math.min(100, Math.round((progress.skillAreas / progress.skillsRequired) * 100))} color="#165a4b" />
        <p className="-mt-1 text-right text-xs font-bold text-[#4f625b]">{progress.skillAreas}/{progress.skillsRequired}</p>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#4f625b]">
        {props.hasPets
          ? "Finish the journey to become a Certified Pet Hero — real pet care, proven over time."
          : "Finish the journey to earn the Pet Readiness Certificate — the case for a real pet."}
      </p>
    </div>
  );
}

function SocialPracticeSection({ childProfiles, activeChildId, onSelectChild, done, onAnswer }: {
  childProfiles: Child[];
  activeChildId?: string;
  onSelectChild?: (childId: string) => void;
  done: Record<string, string[]>;
  onAnswer: (childId: string, scenarioId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(activeChildId);
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const childId = onSelectChild ? (selectedId ?? childProfiles[0]?.id) : (activeChildId ?? childProfiles[0]?.id);
  const child = childProfiles.find((item) => item.id === childId);
  const completed = childId ? done[childId] ?? [] : [];
  if (!child) return null;
  return (
    <section className="mt-5 rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">🌐 Safe social practice</p>
      <h3 className="mt-2 text-2xl font-black">Training wheels for real-world social life</h3>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        Practice tricky online moments with zero strangers, zero feeds, zero DMs. Pick what you&apos;d do, get instant coaching,
        and earn the Safe Social Star badge when {child.name} finishes all {socialScenarios.length}.
      </p>
      {onSelectChild && childProfiles.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {childProfiles.map((item) => (
            <button
              key={item.id}
              onClick={() => { setSelectedId(item.id); onSelectChild(item.id); }}
              className={`min-h-10 rounded-full px-4 py-2 text-xs font-black ${item.id === childId ? "bg-[#2563eb] text-white" : "bg-[#eef2ff] text-[#1e3a8a]"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-[#eef2ff]">
          <div className="h-2 rounded-full bg-[#2563eb]" style={{ width: `${Math.round((completed.length / socialScenarios.length) * 100)}%` }} />
        </div>
        <span className="text-xs font-black text-[#1e3a8a]">{completed.length}/{socialScenarios.length} practiced</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {socialScenarios.map((scenario) => {
          const isDone = completed.includes(scenario.id);
          const picked = revealed[scenario.id];
          const shownFeedback = picked !== undefined
            ? scenario.choices[picked].feedback
            : scenario.choices.find((choice) => choice.best)?.feedback;
          return (
            <article key={scenario.id} className="rounded-lg bg-[#faf8f0] p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-black">{scenario.title}</h4>
                {isDone && <span className="shrink-0 rounded-full bg-[#2563eb] px-3 py-1 text-xs font-black text-white">Practiced ✓</span>}
              </div>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{scenario.situation}</p>
              {isDone ? (
                <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-5 text-[#1e3a8a]">💡 {shownFeedback}</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {scenario.choices.map((choice, index) => (
                    <button
                      key={choice.text}
                      onClick={() => { setRevealed((prev) => ({ ...prev, [scenario.id]: index })); onAnswer(child.id, scenario.id); }}
                      className="min-h-11 rounded-lg border border-[#dce6f8] bg-white px-3 py-2 text-left text-sm font-bold text-[#17231f] hover:bg-[#eef2ff]"
                    >
                      {choice.text}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function GrowthPanel(props: {
  childProfiles: Child[];
  badges: BadgeAward[];
  moments: MemoryMoment[];
  momentDraft: string;
  setMomentDraft: (value: string) => void;
  addMoment: () => void;
  missions: Mission[];
  certificates: Certificate[];
  familyName: string;
  hasPets: boolean;
  activeChildId?: string;
  onSelectChild?: (childId: string) => void;
  socialPracticeDone: Record<string, string[]>;
  onAnswerSocialScenario: (childId: string, scenarioId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Character growth</p>
      <h2 className="mt-2 text-3xl font-black">Responsibility, empathy, kindness, leadership</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-lg bg-[#faf8f0] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <ProfilePhoto label={child.name} initial={getChildLook(child.id).initial} colors={getChildLook(child.id).colors} variant="kid" hair={getChildLook(child.id).hair} photoUrl={child.photoUrl} />
                <h3 className="truncate text-xl font-black">{child.name}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[child.level]}</span>
            </div>
            <CertificateCard
              child={child}
              missions={props.missions}
              badges={props.badges}
              certificates={props.certificates}
              familyName={props.familyName}
              hasPets={props.hasPets}
            />
            <div className="mt-4 grid gap-3">
              <Meter label="Task progress" value={Math.min(100, Math.round((child.points / 220) * 100))} color="#f47b20" />
              <Meter label="Loving it" value={getChildLook(child.id).love} color="#6d3ed1" />
              <Meter label="Happiness" value={getChildLook(child.id).joy} color="#165a4b" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-white p-3">{child.points}<br />points</span>
              <span className="rounded-lg bg-white p-3">{child.streakDays}<br />streak</span>
              <span className="rounded-lg bg-white p-3">{child.coins}<br />coins</span>
            </div>
            <div className="mt-4 grid gap-2">
              {(["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => {
                const count = props.badges.filter((badge) => badge.childId === child.id && badge.skill === skill).length;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-xs font-black capitalize">
                      <span>{skill === "time" ? "Time management" : skill}</span>
                      <span>{count} badge{count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-[#6d3ed1]" style={{ width: `${Math.min(100, count * 25)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {props.badges.filter((badge) => badge.childId === child.id).slice(0, 3).map((badge) => (
                <p key={badge.id} className="rounded-lg bg-white p-3 text-xs font-bold text-[#4f625b]">
                  <b className="block text-sm text-[#17231f]">{badge.title}</b>
                  {badge.note}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SocialPracticeSection
        childProfiles={props.childProfiles}
        activeChildId={props.activeChildId}
        onSelectChild={props.onSelectChild}
        done={props.socialPracticeDone}
        onAnswer={props.onAnswerSocialScenario}
      />
      <div className="mt-5 rounded-lg bg-[#f0edff] p-4">
        <h3 className="font-black">Memory moments</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" value={props.momentDraft} onChange={(event) => props.setMomentDraft(event.target.value)} />
          <button onClick={props.addMoment} className="rounded-lg bg-[#6d3ed1] px-5 py-3 text-sm font-black text-white">Save moment</button>
        </div>
        {props.moments.map((moment) => (
          <p key={moment.id} className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold">{moment.note}</p>
        ))}
      </div>
    </section>
  );
}

function NeighborhoodPanel({
  goals,
  childProfiles,
  activeChild,
  role,
  jobs,
  jobDraft,
  setJobDraft,
  postJob,
  acceptJob,
  approveJob,
  toggleJobVisibility,
  markPosterThanked,
  fillJobTemplate,
  transactions,
  setActiveTab,
  allMissions,
  toggleMissionVisibility,
  toggleGoalVisibility,
  familyZip,
  setFamilyZip,
}: {
  goals: SavingsGoal[];
  childProfiles: Child[];
  activeChild?: Child;
  role: Role;
  jobs: NeighborhoodJob[];
  jobDraft: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string };
  setJobDraft: (value: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string }) => void;
  postJob: () => void;
  acceptJob: (jobId: string) => void;
  approveJob: (jobId: string) => void;
  toggleJobVisibility: (jobId: string) => void;
  markPosterThanked: (jobId: string) => void;
  fillJobTemplate: (skill: string) => void;
  transactions: BankTransaction[];
  setActiveTab: (tab: string) => void;
  allMissions: Mission[];
  toggleMissionVisibility: (missionId: string) => void;
  toggleGoalVisibility: (goalId: string) => void;
  familyZip: string;
  setFamilyZip: (zip: string) => void;
}) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies && (role === "parent" || goal.visibleToKids !== false));
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null);

  /** Copy a parent-to-parent share message for a goal — grandparents chip in; no kid accounts, no kid details. */
  async function shareGoalWithFamily(goal: SavingsGoal) {
    const message = `${activeChild?.name ?? "Our kid"} is saving $${goal.saved} of $${goal.target} for "${goal.title}" via TailTots 🐾 — reply here if you'd like to chip in! (Shared by a parent; kids can't share or see contacts.)`;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const area = document.createElement("textarea");
      area.value = message;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setShareCopiedId(goal.id);
    window.setTimeout(() => setShareCopiedId((current) => (current === goal.id ? null : current)), 2500);
  }

  /** Anonymized demo families derived deterministically from the ZIP — no child data, labeled demo. */
  function nearbyFamilies(zip: string) {
    let hash = 0;
    for (const ch of zip) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const names = ["The M. family", "The R. family", "The S. family", "The T. family", "The A. family", "The P. family"];
    const pets = ["1 dog", "2 cats", "a guinea pig", "a rabbit", "a tortoise", "a parakeet"];
    const interests = ["weekend hikes", "shelter volunteering", "backyard gardening", "pet photography", "dog training basics"];
    return [0, 1, 2].map((i) => ({
      id: `${zip}-${i}`,
      name: names[(hash + i * 2) % names.length],
      distance: `${(1 + ((hash >> (i * 3)) % 40) / 10).toFixed(1)} mi away`,
      detail: `${pets[(hash + i) % pets.length]} · into ${interests[(hash + i * 3) % interests.length]}`,
    }));
  }
  const visibleJobs =
    role === "parent"
      ? jobs
      : jobs.filter((job) => job.visibleToKids && activeChild && job.assignedChildIds.includes(activeChild.id) && activeChild.age >= (job.minAge ?? 0));
  // Step 1 of the parent-gated flow: the parent picks from a popup which
  // posted neighborhood jobs are allowed. Only allowed jobs reach kid profiles.
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const postedJobs = jobs.filter((job) => job.status === "posted");
  // Step 4: after approving completion, the parent sends the poster response.
  const [thankYouJobId, setThankYouJobId] = useState<string | null>(null);
  const [thankYouCopied, setThankYouCopied] = useState(false);

  async function copyThankYou(text: string) {
    setThankYouCopied(false);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setThankYouCopied(true);
      }
    } catch {
      setThankYouCopied(false);
    }
  }
  const skillJobTemplates = [
    ["Responsibility", "Morning pet check for a trusted neighbor", "Easy checklist, parent photo proof, 10-14 points"],
    ["Empathy", "Make a comfort card for a newly adopted pet", "Kindness badge, no money needed"],
    ["Teamwork", "Two-kid supply sorting task with parent", "Split points fairly, one shared family badge"],
    ["Leadership", "Older kid teaches a younger kid safe pet observation", "Higher points, parent nearby"],
  ];
  const privacyRules = role === "child"
    ? [
        "Grown-ups check every job first to keep you safe.",
        "You never see addresses or phone numbers — only the fun job.",
        "Your grown-up handles all the applying and talking.",
        "You earn points and badges after your grown-up says the job is done.",
      ]
    : [
        "Parents approve every job before it appears to kids.",
        "Kids do not see addresses, phone numbers, or adult contact details.",
        "Applications show parent names and family intent first, not public child profiles.",
        "Completion proof goes to parents only before money, points, or badges are awarded.",
      ];
  const shelterPrograms = [
    ["Shelter reading buddy", "Kids read calmly near adoptable pets while staff and parents supervise.", "Empathy badge"],
    ["Donation helper", "Families collect towels, food, or toys and log the kindness mission.", "Community Kindness badge"],
    ["Adoption learning day", "Parent-approved shelter visit teaches pet needs before adoption.", "Responsible Pet Friend badge"],
    ["Junior volunteer quest", "Age-fit volunteer tasks from a partner shelter, always parent-confirmed.", "Helping Hands badge"],
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet jobs and safe playdates</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          Parents post and approve every detail before kids can see anything. Kids only see parent-approved helper jobs, simple checklists, and rewards that teach responsibility, empathy, teamwork, leadership, and time management.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parent picks neighborhood jobs in the popup",
          "Only allowed jobs appear in the kid's profile",
          "Kid completes the job — proof goes to the parent, never the poster",
          "Parent approves, then thanks the poster parent-to-parent",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#17231f]">{step}</p>
          </div>
        ))}
      </div>

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Parent gate</p>
              <h3 className="mt-2 text-2xl font-black">Choose which neighborhood jobs your kids may see</h3>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
                {postedJobs.length === 0
                  ? "No posted jobs are waiting right now. New jobs from the neighborhood land here first — never directly with kids."
                  : `${postedJobs.length} posted job${postedJobs.length === 1 ? " is" : "s are"} waiting for your pick. Only jobs you allow appear in your kid's profile.`}
              </p>
            </div>
            <button
              onClick={() => setJobPickerOpen(true)}
              className="min-h-12 shrink-0 rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-black text-white"
            >
              Review neighborhood jobs
            </button>
          </div>
        </section>
      )}

      {role === "parent" && jobPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Choose neighborhood jobs">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Neighborhood job inbox</p>
                <h3 className="mt-2 text-2xl font-black">Allow jobs for your kids</h3>
                <p className="mt-2 text-sm font-semibold text-[#4f625b]">
                  Pick the jobs your kids may see. Nothing here reaches a kid profile until you allow it — and kids never see who posted.
                </p>
              </div>
              <button
                onClick={() => setJobPickerOpen(false)}
                aria-label="Close job picker"
                className="min-h-11 min-w-11 rounded-lg bg-[#faf8f0] px-3 py-2 text-lg font-black text-[#4f625b]"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {postedJobs.map((job) => (
                <article key={job.id} className="rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-black">{job.title}</p>
                      <p className="mt-1 text-sm font-semibold text-[#4f625b]">{job.family} • {job.pet} • {job.time}</p>
                      <p className="mt-1 text-sm font-black text-[#7a4b12]">{job.rewardDollars ? `$${job.rewardDollars} allowance` : job.badgeTitle}</p>
                    </div>
                    <button
                      onClick={() => toggleJobVisibility(job.id)}
                      className={`min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-black ${job.visibleToKids ? "bg-white text-[#b44421] border border-[#ded8c7]" : "bg-[#2563eb] text-white"}`}
                    >
                      {job.visibleToKids ? "Remove from kids" : "Allow for kids"}
                    </button>
                  </div>
                </article>
              ))}
              {postedJobs.length === 0 && (
                <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">No posted jobs waiting.</p>
              )}
            </div>
            <button
              onClick={() => setJobPickerOpen(false)}
              className="mt-4 min-h-12 w-full rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white"
            >
              Done — {jobs.filter((job) => job.visibleToKids).length} job{jobs.filter((job) => job.visibleToKids).length === 1 ? "" : "s"} visible to kids
            </button>
          </div>
        </div>
      )}

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Post a job</p>
          <h3 className="mt-2 text-2xl font-black">Create a parent-screened helper mission</h3>
          <p className="mt-2 text-sm font-semibold text-[#4f625b]">New jobs stay hidden from kids until a parent explicitly approves them for kid view below.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} placeholder="Job title" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.family} onChange={(event) => setJobDraft({ ...jobDraft, family: event.target.value })} placeholder="Family" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.pet} onChange={(event) => setJobDraft({ ...jobDraft, pet: event.target.value })} placeholder="Pet" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.time} onChange={(event) => setJobDraft({ ...jobDraft, time: event.target.value })} placeholder="Time" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.rewardDollars} onChange={(event) => setJobDraft({ ...jobDraft, rewardDollars: event.target.value })} inputMode="numeric" placeholder="$ reward" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.badgeTitle} onChange={(event) => setJobDraft({ ...jobDraft, badgeTitle: event.target.value })} placeholder="Badge" />
          </div>
          <textarea className="mt-3 min-h-20 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.safety} onChange={(event) => setJobDraft({ ...jobDraft, safety: event.target.value })} placeholder="Safety note" />
          <button onClick={postJob} className="mt-3 min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">Save for parent review</button>
        </section>
      )}

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Skill job builder</p>
          <h3 className="mt-2 text-2xl font-black">Post a job around the life skill you want to teach</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
            Parents can start from a value, not just a task. TailTots can suggest checklist, points, money, and badge language before anything is visible to kids or neighbors.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {skillJobTemplates.map(([skill, title, detail]) => (
              <article key={skill} className="rounded-lg bg-[#f0edff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">{skill}</p>
                <p className="mt-2 text-base font-black leading-5">{title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#4f625b]">{detail}</p>
                <button onClick={() => fillJobTemplate(skill)} className="mt-3 min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#4c1d95]">Use template</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">{role === "parent" ? "Job pipeline" : "Jobs for you"}</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Kid confirmations waiting for final approval" : "Confirm a job, then wait for grown-up approval"}</h3>
        <div className="mt-4 grid gap-3">
          {visibleJobs.map((job) => {
            const acceptedChild = childProfiles.find((child) => child.id === job.acceptedBy);
            const skill = job.skillFocus ?? "teamwork";
            return (
              <article key={job.id} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{job.title}</p>
                    {/* Kids-data rule: kid surfaces show the job only — never the posting family's name. */}
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{role === "parent" ? `${job.family} • ` : ""}{job.pet} • {job.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{job.rewardDollars ? `$${job.rewardDollars} allowance` : job.badgeTitle}</p>
                    {role === "parent" && acceptedChild && <p className="mt-1 text-xs font-black text-[#165a4b]">Accepted by {acceptedChild.name}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#6d3ed1]">{getLifeSkillLabel(skill)}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2563eb]">Age {job.minAge ?? 4}+</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{job.status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${job.visibleToKids ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-white text-[#b44421]"}`}>
                      {job.visibleToKids ? "Parent approved for kids" : "Hidden until parent approves"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#17231f]">
                      {job.checklist.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#17231f]">{job.safety}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(job.trustSignals ?? ["parent_gate", "private_child"]).map((signal) => (
                    <span key={signal} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">
                      {getTrustSignalLabel(signal)}
                    </span>
                  ))}
                </div>
                {role === "child" && job.status === "posted" && (
                  <button onClick={() => acceptJob(job.id)} className="mt-3 min-h-12 w-full rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white">Confirm I want this job</button>
                )}
                {role === "child" && job.status !== "posted" && (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm font-black text-[#4f625b]">{job.status === "accepted" ? "Waiting for a parent to make it final." : job.status === "approved" ? "Added to Today. Money goes to Kid Bank after parent approves completion." : "Completed and paid if this job had allowance."}</p>
                )}
                {role === "parent" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr]">
                    <button
                      onClick={() => toggleJobVisibility(job.id)}
                      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${job.visibleToKids ? "bg-white text-[#b44421]" : "bg-[#2563eb] text-white"}`}
                    >
                      {job.visibleToKids ? "Remove kid visibility" : "Approve for kids to see"}
                    </button>
                    <button onClick={() => approveJob(job.id)} disabled={job.status !== "accepted"} className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:bg-[#b9b2a2]">Make final and add to Today</button>
                    <p className="rounded-lg bg-white p-3 text-xs font-bold text-[#4f625b]">Allowed kids: {job.assignedChildIds.map((id) => childProfiles.find((child) => child.id === id)?.name).filter(Boolean).join(", ")}</p>
                  </div>
                )}
                {role === "parent" && job.status === "completed" && !job.posterThanked && (
                  <div className="mt-3 rounded-lg bg-white p-4">
                    {thankYouJobId === job.id ? (
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Thank the poster — parent to parent</p>
                        <p className="mt-2 whitespace-pre-line rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold leading-6 text-[#17231f]">{buildPosterThankYou(job)}</p>
                        <p className="mt-2 text-xs font-bold text-[#4f625b]">
                          Anonymized on purpose: the poster reads “a neighborhood family” — never your kid&apos;s name, photo, or age.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => copyThankYou(buildPosterThankYou(job))}
                            className="min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white"
                          >
                            {thankYouCopied && thankYouJobId === job.id ? "Copied ✓" : "Copy message"}
                          </button>
                          <button
                            onClick={() => { markPosterThanked(job.id); setThankYouJobId(null); }}
                            className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
                          >
                            Mark as sent
                          </button>
                          <button
                            onClick={() => setThankYouJobId(null)}
                            className="min-h-11 rounded-lg bg-[#faf8f0] px-4 py-2 text-sm font-black text-[#4f625b]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setThankYouJobId(job.id); setThankYouCopied(false); }}
                        className="min-h-11 rounded-lg bg-[#7a4b12] px-4 py-2 text-sm font-black text-white"
                      >
                        Send thank-you to poster
                      </button>
                    )}
                  </div>
                )}
                {role === "parent" && job.status === "completed" && job.posterThanked && (
                  <p className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-sm font-black text-[#165a4b]">Thank-you sent to the poster ✓ — parent to parent, anonymized.</p>
                )}
              </article>
            );
          })}
          {!visibleJobs.length && <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">No parent-approved jobs are available yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Privacy and trust</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Why families can safely apply for jobs" : "Grown-ups keep every job safe"}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {privacyRules.map((rule) => (
            <p key={rule} className="rounded-lg bg-[#e7f4ef] p-4 text-sm font-black leading-5 text-[#165a4b]">{rule}</p>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Shelters and adoption</p>
        <h3 className="mt-2 text-2xl font-black">Partner with shelters for adoption learning and volunteer badges</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          TailTots can let animal shelters post parent-approved learning missions, adoption-readiness visits, donation drives, and supervised volunteer opportunities for families in the network.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {shelterPrograms.map(([title, detail, badge]) => (
            <article key={title} className="rounded-lg bg-[#fff4d8] p-4">
              <p className="text-base font-black leading-5">{title}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#4f625b]">{detail}</p>
              <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{badge}</p>
            </article>
          ))}
        </div>
      </section>

      {role === "parent" && (
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Choose what kids can see</p>
          <h3 className="mt-2 text-2xl font-black">You control what's visible</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
            Approved missions and donation goals are visible to kids by default. Hide any you&apos;re not ready to show yet — neighborhood jobs are picked separately in the review popup above.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm font-black">Approved missions</p>
              <div className="mt-2 space-y-2">
                {allMissions.filter((mission) => mission.status === "approved").map((mission) => (
                  <div key={mission.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#faf8f0] p-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{mission.title}</span>
                    <button
                      onClick={() => toggleMissionVisibility(mission.id)}
                      aria-pressed={mission.visibleToKids ?? true}
                      className={`min-h-10 rounded-lg px-3 py-2 text-xs font-black ${mission.visibleToKids === false ? "bg-[#ded8c7] text-[#4f625b]" : "bg-[#165a4b] text-white"}`}
                    >
                      {mission.visibleToKids === false ? "Hidden" : "Visible"}
                    </button>
                  </div>
                ))}
                {allMissions.filter((mission) => mission.status === "approved").length === 0 && (
                  <p className="text-sm font-semibold text-[#4f625b]">No approved missions yet.</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-black">Shared donation goals</p>
              <div className="mt-2 space-y-2">
                {goals.filter((goal) => goal.sharedWithTrustedFamilies && goal.type === "donation").map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#faf8f0] p-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{goal.title}</span>
                    <button
                      onClick={() => toggleGoalVisibility(goal.id)}
                      aria-pressed={goal.visibleToKids ?? true}
                      className={`min-h-10 rounded-lg px-3 py-2 text-xs font-black ${goal.visibleToKids === false ? "bg-[#ded8c7] text-[#4f625b]" : "bg-[#165a4b] text-white"}`}
                    >
                      {goal.visibleToKids === false ? "Hidden" : "Visible"}
                    </button>
                  </div>
                ))}
                {goals.filter((goal) => goal.sharedWithTrustedFamilies && goal.type === "donation").length === 0 && (
                  <p className="text-sm font-semibold text-[#4f625b]">No shared donation goals yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">{role === "parent" ? "Share with family" : "Giving goals"}</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Let grandparents chip in" : "Giving goals your family shares"}</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          {role === "parent"
            ? "Pick a goal your kid is working toward and share it with family — grandparents, aunts, uncles. They see the goal (never kid details) and chip in through you. Sharing is always parent-initiated, and no child is publicly searchable."
            : "These are donation goals your grown-up shared with the family — shelters, schools, and neighborhood causes. Every dollar moves only after a parent approves."}
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            const contributions = goalContributions(goal.id, transactions, childProfiles);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Started by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#165a4b]" style={{ width: `${percent}%` }} />
                </div>
                {(contributions.length > 0 || goal.seededByParent) && (
                  <p className="mt-2 text-xs font-bold text-[#4f625b]">
                    {[
                      ...contributions.map((c) => `${c.name} $${c.amount}`),
                      ...(goal.seededByParent ? [`Parent seed $${goal.seededByParent}`] : []),
                    ].join(" · ")}
                  </p>
                )}
                <button
                  onClick={() => setActiveTab("bank")}
                  className="mt-3 min-h-11 w-full rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
                >
                  Contribute in Kid Bank →
                </button>
                {role === "parent" && (
                  <button
                    onClick={() => shareGoalWithFamily(goal)}
                    className="mt-2 min-h-11 w-full rounded-lg border border-[#165a4b] bg-white px-4 py-2 text-sm font-black text-[#165a4b]"
                  >
                    {shareCopiedId === goal.id ? "Family share message copied ✓" : "Copy family share message"}
                  </button>
                )}
              </article>
            );
          })}
          {sharedGoals.length === 0 && (
            <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">
              {role === "parent"
                ? "No shared goals yet. Create a giving goal in Kid Bank, share it, then copy a family message so grandparents can chip in."
                : "No shared goals yet — ask a grown-up to share one with the family."}
            </p>
          )}
        </div>
      </div>

      {role === "parent" && (
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Nearby families</p>
          <h3 className="mt-2 text-2xl font-black">Discover families near you</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
            Enter your ZIP code to preview nearby TailTots families. Demo preview: families are anonymized and parent-gated — in the real app only opted-in families appear, and no child information is ever shown.
          </p>
          <div className="mt-4 max-w-xs">
            <label htmlFor="family-zip" className="text-xs font-black uppercase tracking-[0.14em] text-[#4f625b]">ZIP code</label>
            <input
              id="family-zip"
              value={familyZip}
              onChange={(e) => setFamilyZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              placeholder="e.g. 75034"
              inputMode="numeric"
              className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-[#faf8f0] px-3 py-2 text-sm font-bold"
            />
          </div>
          {familyZip.length === 5 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {nearbyFamilies(familyZip).map((family) => (
                <article key={family.id} className="rounded-lg bg-[#faf8f0] p-4">
                  <p className="text-base font-black">{family.name}</p>
                  <p className="mt-1 text-xs font-black text-[#2563eb]">{family.distance}</p>
                  <p className="mt-1 text-sm font-semibold text-[#4f625b]">{family.detail}</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#69736f]">Demo family · anonymized</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm font-semibold text-[#4f625b]">Enter all 5 digits to see nearby families.</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

function LegacyNeighborhoodPanel({ goals, childProfiles }: { goals: SavingsGoal[]; childProfiles: Child[] }) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies);
  const trustedFamilies = [
    { name: "Patel family", pets: "Milo the rabbit", match: "Small pet care, after school", status: "Parent-approved" },
    { name: "Garcia family", pets: "Sunny the parakeet", match: "Bird care, weekend mornings", status: "Meet-and-greet" },
  ];
  const sittingRequests = [
    {
      title: "Care visit for Milo",
      family: "Patel family",
      pet: "Milo the rabbit",
      time: "Tuesday, 4:30 PM",
      reward: "$4 allowance",
      status: "Parent checklist needed",
      steps: ["Refill hay", "Check water bottle", "Send parent photo"],
      safety: "Parent stays nearby; no cage cleaning yet.",
    },
    {
      title: "Morning check for Sunny",
      family: "Garcia family",
      pet: "Sunny the parakeet",
      time: "Saturday morning",
      reward: "Kindness badge",
      status: "Needs meet-and-greet",
      steps: ["Look at water cup", "Check food level", "Tell parent if cage looks messy"],
      safety: "No handling the bird; adult opens cage only.",
    },
  ];
  const helperJobs = [
    { title: "Lawn mowing helper", family: "Patel family", time: "Friday, 5:00 PM", reward: "$12 allowance", safety: "Parent checks mower safety and stays reachable." },
    { title: "Bring bins to curb", family: "Garcia family", time: "Monday evening", reward: "$3 allowance", safety: "Stay on driveway; parent confirms address first." },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet friends and helper requests</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          Kids do not browse or message other kids. Parents discover nearby pet families, compare pets and schedules, then decide whether a playdate, shared care task, or pet-sitting request is safe to show.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parents match by pet type, distance, and availability",
          "Parents chat and schedule first",
          "Kids only see approved date or helper task",
          "Parent closes the loop with pickup, reward, and notes",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#17231f]">{step}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Family matching</p>
          <h3 className="mt-2 text-2xl font-black">Pet families parents can review</h3>
          <div className="mt-4 grid gap-3">
            {trustedFamilies.map((family) => (
              <article key={family.name} className="rounded-lg bg-[#faf8f0] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{family.name}</p>
                    <p className="text-sm font-semibold text-[#4f625b]">{family.pets}</p>
                    <p className="mt-1 text-xs font-bold text-[#69736f]">{family.match}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">{family.status}</span>
                </div>
              </article>
            ))}
          </div>
          <button className="mt-4 min-h-12 rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
            Review pet family match
          </button>
        </div>

        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent calendar</p>
          <h3 className="mt-2 text-2xl font-black">Pet care requests before kids see them</h3>
          <div className="mt-4 grid gap-3">
            {sittingRequests.map((request) => (
              <article key={request.title} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{request.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{request.family} - {request.pet} - {request.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{request.reward}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{request.status}</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#17231f]">
                      {request.steps.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#17231f]">{request.safety}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Create kid care mission</button>
                  <button className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black">Confirm adult details</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Family-supported goals</p>
        <h3 className="mt-2 text-2xl font-black">Trusted families can help a cause</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          Parents can expose selected goals to trusted families so a neighbor can support the purpose, like pet enrichment or care supplies. The child is not publicly searchable, and parents control who sees it.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Parent-shared by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#165a4b]" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Offer support</button>
                  <button className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black">Message parent</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Pet-sitting and helper workflow</p>
        <h3 className="mt-2 text-2xl font-black">What a parent must approve</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pet needs", "Food, water, medicine, handling limits, and what not to do."],
            ["Job details", "Address, parent contact, time window, tools, pickup/dropoff, and emergency backup."],
            ["Kid mission", "A simple checklist with proof photo or parent note."],
            ["Reward", "Allowance dollars for jobs, reward coins for app progress, or kindness badges for favors."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#faf8f0] p-4">
              <h4 className="font-black">{title}</h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Neighborhood helper jobs</p>
        <h3 className="mt-2 text-2xl font-black">Parent-approved ways kids can earn allowance</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {helperJobs.map((job) => (
            <article key={job.title} className="rounded-lg bg-[#eef2ff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{job.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#4f625b]">{job.family} - {job.time}</p>
                  <p className="mt-1 text-sm font-black text-[#1e3a8a]">{job.reward}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2563eb]">Parent-led</span>
              </div>
              <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-[#17231f]">{job.safety}</p>
              <button className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white">Create helper mission</button>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

void LegacyNeighborhoodPanel;

function AIPanel({ childProfiles, missions, parentSignedIn }: { childProfiles: Child[]; missions: Mission[]; parentSignedIn: boolean }) {
  const currentUses = [
    ["Local parent tools", "TailTots now has template-powered helpers for missions, care checklists, memories, summaries, journals, and insights."],
    ["AI ideas are live for parents", "The Life Skill Chore Planner can generate activity ideas with Cloudflare Workers AI. Parents review every suggestion before it becomes a mission."],
  ];
  const [aiDraft, setAiDraft] = useState({
    petType: "Guinea pig",
    petAge: "2 years",
    routine: "Morning hay, fresh water, veggie treat, quick cage check",
    vetNotes: "Handle gently. Watch water bottle level. No loud noises near cage.",
    memoryNote: "A calm care moment today: food, water, and a gentle check-in.",
    photoMoment: "Captain basking after fresh greens",
    lifeSkill: "responsibility",
    choreGoal: "Teach responsibility through morning pet care and one family helper task",
  });
  const smartMissions = buildSmartMissions(aiDraft.petType, aiDraft.routine);
  const lifeSkillMissions = buildLifeSkillChores(aiDraft.lifeSkill, aiDraft.choreGoal, childProfiles);
  const fairnessPlan = buildFairnessPlan(missions, childProfiles);
  const coachChecklist = buildCareChecklist(aiDraft.vetNotes);
  const memoryMoment = buildMemoryMoment(aiDraft.memoryNote);
  const passportSummary = buildPassportSummary(aiDraft.petType, aiDraft.petAge, aiDraft.routine, aiDraft.vetNotes);
  const photoJournal = buildPhotoJournal(aiDraft.photoMoment);
  const [aiIdeas, setAiIdeas] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Where the shown ideas came from: "live" for the real AI endpoint, "demo"
  // for the built-in fallback (there is no /api/ai/ideas route in this repo
  // build, so the demo path is the one that runs here — labeled honestly).
  const [aiIdeasSource, setAiIdeasSource] = useState<"live" | "demo" | null>(null);
  const [aiIdeasNote, setAiIdeasNote] = useState<string | null>(null);

  function ageBandForAge(age: number): "4-6" | "7-9" | "10-12" {
    if (age <= 6) return "4-6";
    if (age <= 9) return "7-9";
    return "10-12";
  }

  async function getParentAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  async function generateAiIdeas() {
    const child = childProfiles[0];
    setAiLoading(true);
    setAiError(null);
    try {
      const accessToken = await getParentAccessToken();
      if (!accessToken) {
        // No signed-in parent: show the clearly-labeled demo fallback instead of a dead button.
        setAiIdeas(lifeSkillMissions.slice(0, 5));
        setAiIdeasSource("demo");
        setAiIdeasNote("Demo ideas — connect AI in settings for live generation.");
        setAiError(null);
        return;
      }
      const response = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        // Kids-data rule: the AI is parent-side only. Send the life skill and a
        // coarse age band — never a child's name or any other kid PII.
        body: JSON.stringify({
          lifeSkill: aiDraft.lifeSkill,
          ageBand: child ? ageBandForAge(child.age) : "7-9",
        }),
      });
      const data = (await response.json()) as { ideas?: unknown };
      const ideas = Array.isArray(data.ideas)
        ? data.ideas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      if (response.ok && ideas.length > 0) {
        setAiIdeas(ideas);
        setAiIdeasSource("live");
        setAiIdeasNote("AI-generated ideas — review before saving as a mission.");
      } else {
        setAiIdeas(lifeSkillMissions.slice(0, 5));
        setAiIdeasSource("demo");
        setAiIdeasNote("Demo ideas — the live AI helper is unavailable right now.");
      }
      setAiError(null);
    } catch {
      setAiIdeas(lifeSkillMissions.slice(0, 5));
      setAiIdeasSource("demo");
      setAiIdeasNote("Demo ideas — the live AI helper is unavailable right now.");
      setAiError(null);
    } finally {
      setAiLoading(false);
    }
  }
  // Insights only from real family data — no invented identities or observations.
  const realInsights: string[] = [];
  const streakLeader = [...childProfiles].sort((a, b) => b.streakDays - a.streakDays)[0];
  if (streakLeader && streakLeader.streakDays > 0) {
    realInsights.push(`${streakLeader.name} has a ${streakLeader.streakDays}-day care streak going.`);
  }
  const waitingForReview = missions.filter((mission) => mission.status === "pending" && mission.completedBy).length;
  if (waitingForReview > 0) {
    realInsights.push(`${waitingForReview} mission${waitingForReview === 1 ? " is" : "s are"} waiting for parent review.`);
  }
  const approvedSoFar = missions.filter((mission) => mission.status === "approved").length;
  if (approvedSoFar > 0) {
    realInsights.push(`${approvedSoFar} mission${approvedSoFar === 1 ? "" : "s"} approved — the consistency is adding up.`);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Parent tools</p>
        <h2 className="mt-2 text-3xl font-black">You stay in charge — AI does the planning</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#dce7e2]">
          TailTots keeps tabs on your kids building pre-adulthood skills with minimal work from you: AI-generated missions target character and life skills — responsibility, empathy, teamwork — and nothing becomes a mission until you choose it.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">AI now</p>
          <h3 className="mt-2 text-2xl font-black">What exists today</h3>
          <div className="mt-4 grid gap-3">
            {currentUses.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#faf8f0] p-4">
                <h4 className="font-black">{title}</h4>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Guardrails</p>
          <h3 className="mt-2 text-2xl font-black">Rules for kid-safe AI</h3>
          <ul className="mt-4 grid gap-3 text-sm font-semibold leading-5 text-[#4f625b]">
            <li className="rounded-lg bg-[#fff4d8] p-3">Parents control AI setup, publishing, and social sharing.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Kids get simple prompts and choices, not an unrestricted AI chat.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Pet health guidance stays parent-facing and avoids diagnosis.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Anything public needs parent approval before it leaves the family.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">AI tools</p>
        <h3 className="mt-2 text-2xl font-black">Parent-side helpers you can use now</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
                    The planner below can generate ideas with AI, or keep using the built-in templates. Nothing is
          saved until a parent chooses it.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-[#eef2ff] p-4">
            <h4 className="text-lg font-black">Life Skill Chore Planner</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select className="rounded-lg border border-[#dce6f8] px-3 py-3 text-sm font-semibold" value={aiDraft.lifeSkill} onChange={(event) => setAiDraft({ ...aiDraft, lifeSkill: event.target.value })}>
                <option value="responsibility">Responsibility</option>
                <option value="empathy">Empathy</option>
                <option value="teamwork">Teamwork</option>
                <option value="leadership">Leadership</option>
                <option value="time">Time habits</option>
              </select>
              <input className="rounded-lg border border-[#dce6f8] px-3 py-3 text-sm font-semibold" value={aiDraft.choreGoal} onChange={(event) => setAiDraft({ ...aiDraft, choreGoal: event.target.value })} placeholder="What value should chores teach?" />
            </div>
            <button
              type="button"
              onClick={generateAiIdeas}
              disabled={aiLoading}
              className="mt-3 min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50"
            >
              {aiLoading ? "Generating ideas\u2026" : "Generate with AI"}
            </button>
            {!parentSignedIn && (
              <p className="mt-2 text-xs font-semibold text-[#7a4b12]">
                AI ideas need a signed-in parent account — set one up in Family Setup, under Parent account.
              </p>
            )}
            {aiError && (
              <p className="mt-2 text-xs font-semibold text-[#7a4b12]">{aiError}</p>
            )}
            {aiIdeas && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${aiIdeasSource === "live" ? "text-[#2563eb]" : "text-[#7a4b12]"}`}>
                  {aiIdeasNote ?? (aiIdeasSource === "live" ? "AI-generated ideas — review before saving as a mission" : "Demo ideas — connect AI in settings for live generation.")}
                </p>
                <div className="mt-2 grid gap-2">
                  {aiIdeas.map((idea) => (
                    <p key={idea} className="rounded-lg bg-[#eef2ff] p-3 text-sm font-semibold leading-5">{idea}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {lifeSkillMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Fair Chore Distributor</h4>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">Harder work earns more points, but the weekly plan aims for similar totals if everyone completes their assigned chores.</p>
            <div className="mt-3 grid gap-2">
              {fairnessPlan.map((line) => <p key={line} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{line}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#faf8f0] p-4">
            <h4 className="text-lg font-black">Smart Mission Generator</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petType} onChange={(event) => setAiDraft({ ...aiDraft, petType: event.target.value })} placeholder="Pet type" />
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petAge} onChange={(event) => setAiDraft({ ...aiDraft, petAge: event.target.value })} placeholder="Pet age" />
            </div>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.routine} onChange={(event) => setAiDraft({ ...aiDraft, routine: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {smartMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#faf8f0] p-4">
            <h4 className="text-lg font-black">Pet Care Coach</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.vetNotes} onChange={(event) => setAiDraft({ ...aiDraft, vetNotes: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {coachChecklist.map((item) => <p key={item} className="rounded-lg bg-white p-3 text-sm font-semibold">{item}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Memory Moment Writer</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.memoryNote} onChange={(event) => setAiDraft({ ...aiDraft, memoryNote: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{memoryMoment}</p>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Pet Passport Summary</h4>
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{passportSummary}</p>
            <h4 className="mt-4 text-lg font-black">Photo Pet Journal</h4>
            <input className="mt-3 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.photoMoment} onChange={(event) => setAiDraft({ ...aiDraft, photoMoment: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{photoJournal}</p>
          </section>
        </div>

        {realInsights.length > 0 && (
          <section className="mt-4 rounded-lg bg-[#eef2ff] p-4">
            <h4 className="text-lg font-black">Family Insights</h4>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {realInsights.map((insight) => <p key={insight} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{insight}</p>)}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}

function buildSmartMissions(petType: string, routine: string) {
  const pet = petType.trim() || "pet";
  const routineParts = routine.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 3);
  const baseParts = routineParts.length ? routineParts : ["fresh food", "clean water", "comfort check"];
  return baseParts.map((part, index) => `${index + 1}. ${pet} mission: ${part}. Kid step: do it, notice one thing, then ask parent to approve.`);
}

function buildLifeSkillChores(skill: string, goal: string, childProfiles: Child[]) {
  const label = getLifeSkillLabel((skill as LifeSkillKey) || "responsibility");
  const sortedKids = [...childProfiles].sort((a, b) => a.age - b.age);
  const younger = sortedKids[0];
  const older = sortedKids[sortedKids.length - 1];
  const purpose = goal.trim() || `Teach ${label.toLowerCase()} through simple care routines`;
  return [
    `${younger?.name ?? "Younger child"}: easy mission, 10-12 points. Notice one pet need and tell a parent. Purpose: ${purpose}.`,
    `${older?.name ?? "Older child"}: medium mission, 16-20 points. Complete a care checklist and help reset supplies.`,
    "Parent rule: reward effort and completion, not speed. If one child gets harder work, add enough points so weekly totals stay close.",
    "Kid-facing wording: show helpful next steps and badges, not rankings or judgment.",
  ];
}

function buildFairnessPlan(missions: Mission[], childProfiles: Child[]) {
  if (!childProfiles.length) return ["Add children first so TailTots can balance tasks."];
  const totals = childProfiles.map((child) => {
    const assigned = missions.filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved");
    return {
      child,
      points: assigned.reduce((sum, mission) => sum + mission.points, 0),
      count: assigned.length,
    };
  });
  const max = Math.max(...totals.map((item) => item.points), 0);
  return totals.map(({ child, points, count }) => {
    const gap = max - points;
    return `${child.name}, age ${child.age}: ${count} open task${count === 1 ? "" : "s"}, ${points} planned points${gap ? `, add about ${gap} points or one easier helper task to balance` : ", balanced for this plan"}.`;
  });
}

function buildCareChecklist(notes: string) {
  const parts = notes.split(".").map((part) => part.trim()).filter(Boolean).slice(0, 4);
  const safeParts = parts.length ? parts : ["Check food", "Check water", "Use gentle hands"];
  return safeParts.map((part, index) => `${index + 1}. ${part}. Parent note: confirm before kid handles anything risky.`);
}

function buildMemoryMoment(note: string) {
  const cleanNote = note.trim() || "A kind pet care moment happened today.";
  return `Today we noticed responsibility in action: ${cleanNote} It was a small moment, but it showed care, attention, and growing confidence.`;
}

function buildPassportSummary(petType: string, petAge: string, routine: string, notes: string) {
  return `${petType || "Pet"} (${petAge || "age not set"}) needs a calm routine: ${routine || "food, water, and comfort checks"}. Parent care note: ${notes || "Keep instructions simple and confirm safety first."}`;
}

function buildPhotoJournal(moment: string) {
  const cleanMoment = moment.trim() || "A sweet pet moment";
  return `${cleanMoment}. Suggested caption: "A little care today made our pet feel safe, seen, and loved."`;
}

/** Layered portrait medallion for pet photos: stage-colored dashed "sticker" ring,
 *  soft shadow, sparkle, and a stage ribbon — like a prize badge. */
function PetMedallion({
  label,
  petKind,
  photoUrl,
  stage,
  stageRing,
}: {
  label: string;
  petKind: PetKind;
  photoUrl?: string;
  stage: string;
  stageRing: string;
}) {
  const dashBorder = stageRing.replace("ring-", "border-");
  return (
    <div className="relative w-fit shrink-0 px-2 pb-7 pt-2">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute right-0.5 top-0 z-10 size-6 rotate-12 text-[#f4b400] drop-shadow-sm" fill="currentColor">
        <path d="M12 2c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z" />
      </svg>
      <div className={`rounded-[1.75rem] border-4 border-dashed ${dashBorder} bg-white p-2 shadow-[0_10px_28px_rgba(23,35,31,0.16)]`}>
        <PetCharacter kind={petKind} size="lg" photoUrl={photoUrl} label={label} />
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#17231f] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd166] shadow-lg ring-2 ring-white">
        ★ {stage}
      </div>
    </div>
  );
}

function ProfilePhoto({
  label,
  initial,
  colors,
  size = "md",
  variant = "kid",
  hair = "#2f1b12",
  petKind = "pet",
  photoUrl,
}: {
  label: string;
  initial: string;
  colors: string;
  size?: "xs" | "md" | "lg";
  variant?: "kid" | "pet";
  hair?: string;
  petKind?: PetKind;
  photoUrl?: string;
}) {
  const sizeClass = size === "lg" ? "h-28 w-24 text-4xl" : size === "xs" ? "h-8 w-8 text-xs" : "h-20 w-16 text-2xl";
  return (
    <div
      aria-label={`${label} animated profile`}
      className={`${sizeClass} relative grid shrink-0 place-items-center overflow-visible rounded-lg font-black text-white`}
      title={`${label} animated profile`}
    >
      <div className={`absolute inset-x-2 bottom-0 h-4 rounded-full bg-gradient-to-r ${colors} opacity-30 blur-sm`} />
      <div className="relative">
        {variant === "pet" ? (
          <PetCharacter kind={petKind} size={size} photoUrl={photoUrl} label={label} />
        ) : (
          <KidCharacter initial={initial} hair={hair} size={size} photoUrl={photoUrl} label={label} />
        )}
      </div>
    </div>
  );
}

function KidCharacter({
  initial,
  hair,
  size,
  photoUrl,
  label,
}: {
  initial: string;
  hair: string;
  size: "xs" | "md" | "lg";
  photoUrl?: string;
  label: string;
}) {
  const compact = size === "xs";
  return (
    <div className={`relative ${compact ? "scale-[0.45]" : size === "lg" ? "scale-110" : "scale-90"} animate-[character-bob_2.8s_ease-in-out_infinite]`}>
      <div className="absolute -left-5 top-6 h-7 w-3 origin-top rounded-full bg-[#8b5cf6] ring-2 ring-white animate-[arm-wave_1.8s_ease-in-out_infinite]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#ffd6a5] ring-2 ring-white" />
      </div>
      <div className="absolute -right-5 top-7 h-7 w-3 origin-top rounded-full bg-[#0ea5e9] ring-2 ring-white animate-[arm-wave_2.1s_ease-in-out_infinite_reverse]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#ffd6a5] ring-2 ring-white" />
      </div>
      <div className="relative size-14 overflow-hidden rounded-full bg-[#ffe7c2] shadow-inner ring-2 ring-white/80">
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label} captured face`} fill sizes="64px" className="object-cover object-center" unoptimized />
        ) : (
          <>
            <div className="absolute -top-2 left-2 right-2 h-5 rounded-t-full" style={{ backgroundColor: hair }} />
            <div className="absolute left-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute right-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute bottom-3 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
          </>
        )}
      </div>
      <div className="mx-auto -mt-1 grid h-8 w-12 place-items-center rounded-t-2xl bg-white/90 text-sm font-black text-[#17231f]">
        {initial}
      </div>
    </div>
  );
}

function PetCharacter({
  kind,
  size,
  photoUrl,
  label,
}: {
  kind: PetKind;
  size: "xs" | "md" | "lg";
  photoUrl?: string;
  label: string;
}) {
  const compact = size === "xs";
  // Illustrated storybook portrait wins over the CSS-drawn fallback whenever we have one.
  const portrait = petPortraitForKind(kind);
  if (portrait && !photoUrl) {
    const frame = size === "xs" ? "size-8" : size === "lg" ? "size-28" : "size-16";
    return (
      <div className="relative animate-[pet-wiggle_2.4s_ease-in-out_infinite]">
        <img src={portrait} alt={`${label} illustrated portrait`} className={`${frame} rounded-2xl object-cover shadow-md ring-2 ring-white`} />
      </div>
    );
  }
  // Real photo is the hero: the animal's actual face fills the circle, with
  // species accessories (ears, tail, whiskers…) composited around it.
  if (photoUrl) {
    return (
      <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"}`}>
        <PetBuddyFace kind={kind} photoUrl={photoUrl} label={label} size={size} />
      </div>
    );
  }
  const isFish = kind === "fish";
  const isTortoise = kind === "tortoise";
  const isGuinea = kind === "guinea";
  if (isFish && !photoUrl) {
    return (
      <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[fish-swim_2.6s_ease-in-out_infinite]`}>
        <div className="absolute -left-3 top-7 size-4 rounded-full bg-[#bae6fd] opacity-80 animate-[bubble-rise_2.4s_ease-in-out_infinite]" />
        <div className="absolute -right-2 top-5 h-7 w-6 rounded-r-full bg-[#38bdf8] [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
        <div className="relative h-14 w-20 overflow-hidden rounded-[999px] bg-[#06b6d4] shadow-inner ring-2 ring-white/80">
          <div className="absolute left-2 top-1 h-12 w-12 rounded-full bg-[#67e8f9]" />
          <div className="absolute right-5 top-5 size-2 rounded-full bg-[#17231f]" />
          <div className="absolute bottom-2 left-8 h-3 w-8 rounded-full bg-[#0e7490] opacity-35" />
        </div>
      </div>
    );
  }

  if (isTortoise && !photoUrl) {
    return (
      <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[tortoise-step_3s_ease-in-out_infinite]`}>
        <div className="absolute left-0 top-10 size-4 rounded-full bg-[#84cc16] ring-2 ring-white" />
        <div className="absolute right-2 top-12 h-3 w-4 rounded-full bg-[#65a30d]" />
        <div className="absolute bottom-2 left-3 size-4 rounded-full bg-[#65a30d]" />
        <div className="absolute bottom-2 right-4 size-4 rounded-full bg-[#65a30d]" />
        <div className="relative h-14 w-20 rounded-[999px] bg-[#365314] shadow-inner ring-2 ring-white/80">
          <div className="absolute inset-2 rounded-[999px] bg-[#86efac]" />
          <div className="absolute left-8 top-4 h-6 w-1 rounded-full bg-[#365314] opacity-40" />
          <div className="absolute left-5 top-6 h-1 w-10 rounded-full bg-[#365314] opacity-35" />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[pet-wiggle_2.4s_ease-in-out_infinite]`}>
      {kind === "dog" ? (
        <>
          <div className="absolute -left-4 top-2 h-9 w-5 rotate-[-22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_1.9s_ease-in-out_infinite]" />
          <div className="absolute -right-4 top-2 h-9 w-5 rotate-[22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_2.1s_ease-in-out_infinite_reverse]" />
        </>
      ) : (
        <>
          <div className={`absolute -left-2 top-0 rounded-full ${isGuinea ? "size-6 bg-[#f7d7aa]" : "size-5 bg-[#f7d7aa]"}`} />
          <div className={`absolute -right-2 top-0 rounded-full ${isGuinea ? "size-6 bg-[#f7d7aa]" : "size-5 bg-[#f7d7aa]"}`} />
        </>
      )}
      <div className={`relative size-16 overflow-hidden rounded-full shadow-inner ring-2 ring-white/80 ${isGuinea ? "bg-[#d97706]" : "bg-[#f9d8a7]"}`}>
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label} pet photo`} fill sizes="72px" className="bg-white object-contain p-1" unoptimized />
        ) : (
          <>
            {isGuinea && <div className="absolute -left-2 top-2 h-14 w-9 rounded-full bg-[#fbbf24]" />}
            {isGuinea ? (
              <>
                <div className="absolute left-3.5 top-5 size-3 rounded-full bg-[#3b2417] shadow-sm">
                  <span className="absolute left-1 top-0.5 size-1 rounded-full bg-white/90" />
                </div>
                <div className="absolute right-3.5 top-5 size-3 rounded-full bg-[#3b2417] shadow-sm">
                  <span className="absolute left-1 top-0.5 size-1 rounded-full bg-white/90" />
                </div>
                <div className="absolute left-1/2 top-8 size-2.5 -translate-x-1/2 rounded-full bg-[#7c2d12]" />
                <div className="absolute bottom-4 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#7c2d12]" />
                <div className="absolute bottom-5 left-[1.15rem] h-1 w-3 rounded-full bg-[#fef3c7]/70" />
                <div className="absolute bottom-5 right-[1.15rem] h-1 w-3 rounded-full bg-[#fef3c7]/70" />
              </>
            ) : (
              <>
                <div className="absolute left-4 top-6 size-2 rounded-full bg-[#17231f]" />
                <div className="absolute right-4 top-6 size-2 rounded-full bg-[#17231f]" />
                <div className="absolute left-1/2 top-8 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
                <div className="absolute bottom-3 left-1/2 h-2 w-6 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
                <div className="absolute -bottom-1 right-2 h-3 w-6 rounded-full bg-[#ff7a7a] animate-[tongue-pop_2.5s_ease-in-out_infinite]" />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnimatedFamilyCharacter({
  tone,
  shirt,
  delay,
  photoUrl,
  label,
}: {
  tone: string;
  shirt: string;
  delay: string;
  photoUrl?: string;
  label?: string;
}) {
  return (
    <div className="relative h-24 w-16 animate-[character-bob_2.6s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <span className="absolute -right-2 -top-2 size-3 rounded-full bg-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.9)] animate-[reward-pop_2.4s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-0 size-12 -translate-x-1/2 overflow-hidden rounded-full shadow-inner ring-2 ring-white/80" style={{ backgroundColor: tone }}>
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label ?? "Family member"} captured face`} fill sizes="56px" className="object-cover" unoptimized />
        ) : (
          <>
            <div className="absolute left-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute right-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute bottom-2 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
          </>
        )}
      </div>
      <div className="absolute bottom-0 left-1/2 h-12 w-14 -translate-x-1/2 rounded-t-3xl" style={{ backgroundColor: shirt }} />
      <div className="absolute bottom-7 left-0 h-8 w-3 origin-top rounded-full bg-[#8b5cf6] ring-2 ring-white animate-[arm-wave_1.7s_ease-in-out_infinite]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full ring-2 ring-white" style={{ backgroundColor: tone }} />
      </div>
      <div className="absolute bottom-7 right-0 h-8 w-3 origin-top rounded-full bg-[#0ea5e9] ring-2 ring-white animate-[arm-wave_2s_ease-in-out_infinite_reverse]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full ring-2 ring-white" style={{ backgroundColor: tone }} />
      </div>
    </div>
  );
}

function AnimatedPetBuddy({ color, delay, photoUrl, label, kind = "pet" }: { color: string; delay: string; photoUrl?: string; label?: string; kind?: PetKind }) {
  // Illustrated storybook portrait wins over the CSS-drawn fallback whenever we have one.
  if (!photoUrl) {
    const portrait = petPortraitForKind(kind);
    if (portrait) {
      return (
        <div className="relative h-20 w-20 animate-[pet-wiggle_2.1s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
          <img src={portrait} alt={`${label ?? "Pet"} illustrated portrait`} className="size-20 rounded-2xl object-cover shadow-md ring-2 ring-white/80" />
        </div>
      );
    }
  }
  if (!photoUrl && kind === "fish") {
    return (
      <div className="relative h-20 w-20 animate-[fish-swim_2.4s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
        <div className="absolute left-2 top-7 size-3 rounded-full bg-[#bae6fd] animate-[bubble-rise_2.4s_ease-in-out_infinite]" />
        <div className="absolute right-3 top-8 h-8 w-7 bg-[#38bdf8] [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
        <div className="absolute bottom-4 left-1/2 h-12 w-16 -translate-x-1/2 rounded-[999px] bg-[#06b6d4] ring-2 ring-white/80">
          <div className="absolute right-5 top-4 size-2 rounded-full bg-[#17231f]" />
        </div>
      </div>
    );
  }
  if (!photoUrl && kind === "tortoise") {
    return (
      <div className="relative h-20 w-20 animate-[tortoise-step_3s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
        <div className="absolute left-2 top-9 size-4 rounded-full bg-[#84cc16] ring-2 ring-white" />
        <div className="absolute bottom-3 left-1/2 h-12 w-16 -translate-x-1/2 rounded-[999px] bg-[#365314] ring-2 ring-white/80">
          <div className="absolute inset-2 rounded-[999px] bg-[#86efac]" />
        </div>
      </div>
    );
  }
  // Real pet photo: the animal's actual face with species-correct accessories
  // (ears, tail, whiskers…) from the pet-buddy library.
  if (photoUrl) {
    return (
      <div className="relative h-24 w-20 animate-[pet-wiggle_2.1s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
        <PetBuddyFace kind={kind} photoUrl={photoUrl} label={label ?? "Pet"} size="md" className="absolute bottom-0 left-1/2 -translate-x-1/2" />
      </div>
    );
  }
  return (
    <div className="relative h-20 w-20 animate-[pet-wiggle_2.1s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <div className="absolute left-2 top-3 h-9 w-5 -rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute right-2 top-3 h-9 w-5 rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute bottom-0 left-1/2 size-16 -translate-x-1/2 overflow-hidden rounded-full ring-2 ring-white/80" style={{ backgroundColor: color }}>
        <div className="absolute left-5 top-7 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute right-5 top-7 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute bottom-4 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
      </div>
    </div>
  );
}

function Meter({ label, value, color, dark = false }: { label: string; value: number; color: string; dark?: boolean }) {
  return (
    <div>
      <div className={`mb-2 flex justify-between text-xs font-black ${dark ? "text-white" : "text-[#17231f]"}`}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className={`h-3 rounded-full ${dark ? "bg-white/20" : "bg-[#ece5d2]"}`}>
        <div className="h-3 rounded-full" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function getChildLook(childId?: string) {
  return childLooks[childId ?? ""] ?? { initial: "K", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", joy: 80, love: 80, hair: "#2f1b12" };
}

function getPetLook(petId?: string, pet?: Pet) {
  const known = petLooks[petId ?? ""];
  if (known) return known;
  return { face: "P", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", happiness: 80, loved: 80, kind: inferPetKind(pet?.species) };
}

function getMissionLifeSkill(mission: Mission): LifeSkillKey {
  if (mission.category === "kindness") return "empathy";
  if (mission.category === "community") return "teamwork";
  if (mission.category === "money") return "leadership";
  if (mission.category === "chore") return "time";
  return "responsibility";
}

function getLifeSkillLabel(skill: LifeSkillKey) {
  const labels: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility",
    empathy: "Empathy",
    teamwork: "Teamwork",
    leadership: "Leadership",
    time: "Time management",
  };
  return labels[skill];
}

function getTrustSignalLabel(signal: TrustSignalKey) {
  const labels: Record<TrustSignalKey, string> = {
    parent_gate: "Parent-gated",
    age_fit: "Age-fit",
    no_messaging: "No kid messaging",
    adult_nearby: "Adult nearby",
    private_child: "Child private",
  };
  return labels[signal];
}

function getKidMissionReason(mission: Mission, child?: Child) {
  if (!child) return "A grown-up will choose the right helper.";
  const ageCopy = isMissionAgeAppropriate(mission, child) ? "it fits your age" : "a grown-up will help because it is harder";
  const skillCopy = getLifeSkillLabel(getMissionLifeSkill(mission)).toLowerCase();
  return `${ageCopy}, it builds ${skillCopy}, and it keeps points fair with the family.`;
}

function getFairnessSummary(missions: Mission[], children: Child[], isKidView = false) {
  const plannedPoints = children.map((child) => ({
    child,
    points: missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sorted = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  const balanced = spread <= 8;
  return {
    spread,
    label: balanced ? "Balanced today" : isKidView ? "Fair turns for everyone" : "Needs balancing",
    detail: balanced
      ? isKidView
        ? "Everyone gets fair turns today. Finish your missions to shine!"
        : "Kids are set up to finish with similar points."
      : isKidView
        ? "Grown-ups are balancing everyone's turns behind the scenes."
        : `${highest?.child.name ?? "One child"} has ${spread} more planned points than ${lowest?.child.name ?? "another child"}.`,
  };
}

function getFamilySkillSummary(badges: BadgeAward[], children: Child[]) {
  const counts = (["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => ({
    skill,
    count: badges.filter((badge) => badge.skill === skill && children.some((child) => child.id === badge.childId)).length,
  }));
  const top = [...counts].sort((a, b) => b.count - a.count)[0];
  return {
    topSkill: top?.skill ?? "responsibility",
    topLabel: top?.count ? getLifeSkillLabel(top.skill) : "First value badge ready",
    totalBadges: counts.reduce((sum, item) => sum + item.count, 0),
  };
}

function getBadgeTitle(skill: LifeSkillKey) {
  const titles: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility Star",
    empathy: "Kind Heart",
    teamwork: "Team Helper",
    leadership: "Junior Leader",
    time: "On-Time Helper",
  };
  return titles[skill];
}
