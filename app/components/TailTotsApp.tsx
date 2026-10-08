"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";
import { PlaydateClaimView } from "./PlaydateClaimView";
import { GivingShareView } from "./GivingShareView";
import { parsePlaydateHash, playdateClaimUrl, playdateStore, configurePlaydateStore } from "@/lib/playdate-store";
import type { PlaydateInvite } from "@/lib/playdate-store";
// Feedback R2 — schedule stream: 15-min week grid, calendar import, claim notifications.
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  SCHEDULE_DAYS,
  SCHEDULE_GOOGLE_OAUTH_CONFIGURED,
  SCHEDULE_APPLE_CALENDAR_CONFIGURED,
  eventToBusySlotKeys,
  expandSlotLabel,
  formatEventWhen,
  formatHourLabel,
  formatTime12,
  isCanonicalSlotKey,
  mergeSlotKeys,
  parseIcs,
  slotKey,
  type ParsedCalendarEvent,
  type ScheduleDay,
} from "@/lib/schedule-calendar";
import {
  appendPlaydateNotifications,
  buildClaimNotification,
  markAllPlaydateNotificationsRead,
  readPlaydateNotifications,
  unreadPlaydateNotificationCount,
  type NewPlaydateNotification,
  type PlaydateNotification,
} from "@/lib/playdate-notifications";
import {
  buildShareInputFromGoal,
  familyShareMessage,
  givingShareStore,
  givingShareUrl,
  parseGivingHash,
} from "@/lib/giving-share-store";
import type { GivingShareRecord } from "@/lib/giving-share-store";
import { buildJobFamilySummary, jobVisibleInZip } from "@/lib/neighborhood-helpers";
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
  CharacterTraitKey,
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
import {
  BUDDY_BOOST_CATEGORIES,
  dailyBoostCacheKey,
  fetchDailyBoost,
  gatedBoostSlot,
  readDailyBoostCache,
  todayLocalDateKey,
  writeDailyBoostCache,
  type CachedDailyBoost,
} from "@/lib/ai/daily-boost";
import { ageBandForAge as domainAgeBandForAge } from "@/lib/ai/ideas";
import { fetchConversationPrompt } from "@/lib/ai/conversation-prompt";
import { fetchCopilotInsights, type PatternInsightRow } from "@/lib/ai/copilot";
import { normalizeZip, neighborhoodSuggestionsForZip } from "@/lib/neighborhoods";
import {
  PET_CHORE_SKILLS,
  buildLocalPetChoreSet,
  fetchPetChores,
  loadChoreHistory,
  saveChoreHistory,
  type ChoreSetRecord,
  type PetChoreDraft,
  type PetChoreSkill,
} from "@/lib/ai/pet-chores";
import {
  analyzeFairness,
  fairnessCoachFallback,
  fetchFairnessCoaching,
  type RebalanceMove,
} from "@/lib/ai/fairness";
import {
  brightestPillar,
  buildFlourishingSnapshot,
  computeFlourishScores,
  flourishFallbackNarrative,
  type FlourishBankInput,
  type FlourishBadgeInput,
  type FlourishEventInput,
  type FlourishingSnapshot,
} from "@/lib/ai/flourishing";
import { FlourishingPanel } from "./FlourishingPanel";
import {
  buildCurriculumLevelBadge,
  CHARACTER_TRAITS,
  curriculumLevelBadgeId,
  detectNewlyCompletedCurriculumLevels,
  getChildCurriculumSummary,
  instantiateCurriculumMissions,
  openCurriculumMissionKeys,
  traitByKey,
} from "@/lib/character-curriculum";
import {
  DRIVE_KIND_META,
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
  type DriveKind,
  type JarBalances,
  type KidBankSettings,
  type KidJarKey,
} from "@/lib/kid-bank";

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
  /**
   * Feedback R2 (Kid Bank): guardrails the parent sets UPFRONT so kids can
   * allocate their own earnings into jars with no per-move approval.
   * Additive + optional — old snapshots simply get the defaults.
   */
  bankSettings?: KidBankSettings;
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
   * R2-29: ZIP the job belongs to. Jobs without a ZIP are the family's own
   * posts (or legacy demo data) and always show to the parent.
   */
  zip?: string;
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
    assignedChildId: "sahasra",
    petId: "jack",
    question: "Did Jack get fresh food, hay, and water?",
    status: "pending",
    completedBy: "sahasra",
    note: "Gave Jack fresh hay and refilled the water bottle!",
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
  { id: "tx-seed-save", childId: "sahasra", category: "save", amount: 12, description: "Saved for Guinea pig tunnel", goalId: "goal-1", status: "approved" },
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
    zip: "75034",
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
    zip: "75034",
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
  { id: "home", label: "Home Hub" },
  { id: "schedule", label: "Schedule" },
  { id: "pets", label: "Pet Passports" },
  { id: "pet-helper", label: "AI Buddy" },
  { id: "bank", label: "Kid Bank" },
  { id: "approvals", label: "Parent Review" },
  { id: "setup", label: "Family Setup" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "growth", label: "Growth Log" },
];

const kidTabIds = ["missions", "home", "schedule", "pets", "pet-helper", "bank", "neighborhood"];
const parentTabIds = ["vision", "approvals", "setup", "schedule", "pets", "neighborhood", "growth"];
const defaultParentPasscode = "4321";

const savedFamilyStateKey = "tailtots-family-state-v1";
const legacySavedFamilyStateKey = "pawpal-family-state-v1";
// Stream B: playdate free-time windows (Schedule tab, Step 1) survive reload.
const PLAYDATE_AVAILABILITY_KEY = "tailtots-playdate-availability-v1";

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
  // Stream: R2 family-setup — chosen neighborhood/apartment for job/chore discovery.
  familyNeighborhood?: string;
  aiBuddyCategories?: string[];
  aiBuddyDailyRotate?: boolean;
  /** Feedback R2 — AI buddy stream: parent-authored AI Buddy questions that surface as chips. */
  buddyParentQuestions?: BuddyParentQuestion[];
  /** Feedback R2 — AI buddy stream: parent override of the safe-social heading + content (null = default). */
  socialPracticeOverride?: SocialPracticeOverride | null;
};

/**
 * Feedback R2 — AI Buddy: a parent-authored question that surfaces in the
 * kid's AI Buddy as a predefined chip (no open chat). Gated against the
 * parent's aiBuddyCategories at render time, same as the built-in chips.
 */
type BuddyParentQuestion = {
  id: string;
  question: string;
  answerTitle: string;
  answerBody: string;
  /** One of the buddy categories ("Pet care" | "Chores & routine" | "Kindness & feelings" | "Money & saving"). */
  category: string;
  createdAt: string; // ISO
};

/**
 * Feedback R2 — Safe social practice: one parent-authored practice scenario.
 * The parent overrides both the section heading and the scenario content; the
 * kid view renders these instead of the built-in scenarios, with the built-in
 * set as the permanent default fallback.
 */
type SocialPracticeParentScenario = {
  title: string;
  situation: string;
  /** The "what to do" coaching the kid reveals for this scenario. */
  coaching: string;
};

type SocialPracticeOverride = {
  heading: string;
  intro: string;
  scenarios: SocialPracticeParentScenario[];
  updatedAt: string; // ISO
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
function withGoalProgress(goal: SavingsGoal, added: number, now = new Date().toISOString()): SavingsGoal {  const saved = Math.max(0, Math.min(goal.target, goal.saved + added));
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
  // Playdate claim route: `#playdate/<inviteId>` renders the other parent's
  // claim view instead of the app.
  const [playdateRouteId, setPlaydateRouteId] = useState<string | null>(() =>
    typeof window !== "undefined" ? parsePlaydateHash(window.location.hash) : null
  );
  // Giving-goal family share route: `#giving/<shareId>` renders the family
  // member's view instead of the app.
  const [givingRouteId, setGivingRouteId] = useState<string | null>(() =>
    typeof window !== "undefined" ? parseGivingHash(window.location.hash) : null
  );
  useEffect(() => {
    const onHashChange = () => {
      setPlaydateRouteId(parsePlaydateHash(window.location.hash));
      setGivingRouteId(parseGivingHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
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
  // Playdate availability (parent-only Schedule tab): per-kid free-time
  // windows. Real invites live in the playdate store (lib/playdate-store.ts);
  // claimed slots are read back from the family's invites below.
  // Stream B: availability survives reload via localStorage.
  const [kidAvailability, setKidAvailability] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(PLAYDATE_AVAILABILITY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      const clean: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof key === "string" && Array.isArray(value) && value.every((s) => typeof s === "string")) {
          clean[key] = value;
        }
      }
      return clean;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PLAYDATE_AVAILABILITY_KEY, JSON.stringify(kidAvailability));
    } catch {
      /* quota — availability still works for this session */
    }
  }, [kidAvailability]);
  // Parent controls for the kid's AI Buddy: which predefined question
  // categories the kid may ask, and whether new questions rotate daily.
  const [aiBuddyCategories, setAiBuddyCategories] = useState<string[]>([
    "Pet care",
    "Chores & routine",
    "Kindness & feelings",
    "Money & saving",
  ]);
  const [aiBuddyDailyRotate, setAiBuddyDailyRotate] = useState(true);
  // Feedback R2 — AI buddy stream: parent-set AI Buddy questions and the
  // parent's safe-social content override. Persisted with the family snapshot.
  const [buddyParentQuestions, setBuddyParentQuestions] = useState<BuddyParentQuestion[]>([]);
  const [socialPracticeOverride, setSocialPracticeOverride] = useState<SocialPracticeOverride | null>(null);
  const [familyZip, setFamilyZip] = useState("");
  // Stream: R2 — chosen neighborhood/apartment from the family-setup ZIP picker.
  const [familyNeighborhood, setFamilyNeighborhood] = useState("");
  // Stream: R2 — dedicated signup/signin pages ("signup" | "signin" | null).
  const [authPage, setAuthPage] = useState<null | "signup" | "signin">(null);
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
  // Playdate invites live in the Schedule tab's store, but Parent Review's
  // notification badge counts claimed (booked) invites too — subscribe here.
  const [playdateInvites, setPlaydateInvites] = useState<PlaydateInvite[]>([]);
  const [ackPlaydateIds, setAckPlaydateIds] = useState<string[]>(() => loadAckedPlaydateIds());
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
  useEffect(() => {
    let cancelled = false;
    async function loadInvites() {
      try {
        const all = await playdateStore.listInvites();
        if (!cancelled) setPlaydateInvites(all);
      } catch {
        if (!cancelled) setPlaydateInvites([]);
      }
    }
    loadInvites();
    const unsubscribe = playdateStore.subscribe(loadInvites);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  /** Playdate claims needing parent eyes: booked by the other family, not yet reviewed. */
  const pendingPlaydates = useMemo(
    () => playdateInvites.filter((invite) => invite.status === "booked" && !ackPlaydateIds.includes(invite.id)),
    [playdateInvites, ackPlaydateIds],
  );
  const parentPendingCount = pendingApprovals.length + pendingPlaydates.length;
  function acknowledgePlaydate(inviteId: string) {
    setAckPlaydateIds((ids) => {
      if (ids.includes(inviteId)) return ids;
      const next = [...ids, inviteId];
      saveAckedPlaydateIds(next);
      return next;
    });
  }
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

  // Keep active giving-goal share links' progress snapshots fresh as the
  // parent's goals change (approvals, contributions, seeds).
  useEffect(() => {
    for (const goal of goals) {
      void givingShareStore.syncGoalProgress(goal.id, goal.saved, goal.target);
    }
  }, [goals]);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    const handleSession = (userId: string | null, email: string) => {
      if (!isMounted) return;
      setCloudAccountEmail(email);
      // Stream B: signed-in parents get cloud-backed playdate invites
      // (cross-device); signed-out keeps the localStorage behavior.
      configurePlaydateStore({ client: supabase, signedIn: userId !== null });
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

  // Stream C: parent-authenticated daily buddy-boost prefetch. Once per day,
  // when a parent Supabase session exists, fetch a genuinely AI-generated
  // buddy boost and cache it in localStorage keyed by date. The kid UI only
  // ever reads the cached value — predefined content, no open chat. The
  // request carries no kid PII: only the date, a coarse age band (from the
  // youngest child's age, so it is safe for every kid), and the parent-set
  // buddy categories (parent config, not kid data). Signed out / offline /
  // on failure, the kid panel keeps its local date-rotation fallback.
  const [aiDailyBoost, setAiDailyBoost] = useState<CachedDailyBoost | null>(null);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    const ensureDailyBoost = async () => {
      const dateKey = todayLocalDateKey();
      try {
        const cached = readDailyBoostCache(dailyBoostCacheKey(dateKey), dateKey);
        if (cached) {
          if (!cancelled) setAiDailyBoost(cached);
          return;
        }
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const youngest = [...children].sort((a, b) => a.age - b.age)[0];
        const boost = await fetchDailyBoost({
          token,
          date: dateKey,
          ageBand: youngest ? domainAgeBandForAge(youngest.age) : "7-9",
          categories: aiBuddyCategories,
        });
        if (!boost) return;
        writeDailyBoostCache(dailyBoostCacheKey(dateKey), boost);
        if (!cancelled) setAiDailyBoost(boost);
      } catch {
        // Offline or unavailable: the kid panel's local fallback stands in.
      }
    };
    void ensureDailyBoost();
    return () => {
      cancelled = true;
    };
  }, [children, aiBuddyCategories, cloudAccountEmail]);

  // Stream R2: after a magic-link sign-in completes on a dedicated auth page,
  // close the page and land the parent on Family Setup in real mode. The
  // sign-in bootstrap above already pulled (or prepared) their cloud family.
  // Navigation is a reaction to the sign-in event, not part of rendering.
  useEffect(() => {
    if (!cloudAccountEmail || !authPage) return;
    queueMicrotask(() => {
      setAuthPage(null);
      setAppMode("real");
      setRole("parent");
      setIsParentUnlocked(true);
      setActiveTab("setup");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudAccountEmail]);

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    saveFamilyState({ familyName, parentPasscode, parents, children, pets, missions, transactions, goals, badges, neighborhoodJobs, moments, studiedAnimals, socialPracticeDone, familyPhotoUrl, activeChildId, certificates, pointsPerDollar, dailyChecksEnabled, maxDailyChecks, familyZip, familyNeighborhood, aiBuddyCategories, aiBuddyDailyRotate, buddyParentQuestions, socialPracticeOverride });
    setLastSavedAt(new Date());
  }, [activeChildId, aiBuddyCategories, aiBuddyDailyRotate, badges, buddyParentQuestions, certificates, children, dailyChecksEnabled, familyName, familyPhotoUrl, familyZip, familyNeighborhood, goals, hasLoadedSavedState, maxDailyChecks, missions, moments, neighborhoodJobs, parentPasscode, parents, pets, pointsPerDollar, socialPracticeOverride, studiedAnimals, socialPracticeDone, transactions]);

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

  // Character curriculum progression: when every mission in a trait level is
  // parent-approved, award the trait-level badge (e.g. "Responsibility Sprout").
  // Detection is idempotent — levels with a badge already awarded are skipped —
  // and the badge's skill feeds the existing skill meters in the Growth Log.
  useEffect(() => {
    if (!hasLoadedSavedState) return;
    const completions = detectNewlyCompletedCurriculumLevels(missions, badges, children.map((child) => child.id));
    if (completions.length === 0) return;
    queueMicrotask(() => {
      setBadges((prev) => {
        const awards = completions
          .filter((completion) => !prev.some((badge) => badge.id === curriculumLevelBadgeId(completion.childId, completion.traitKey, completion.levelIndex)))
          .map((completion) => {
            const child = children.find((kid) => kid.id === completion.childId);
            return buildCurriculumLevelBadge(completion.childId, child?.name ?? "Your kid", completion.traitKey, completion.levelIndex);
          });
        return awards.length ? [...awards, ...prev] : prev;
      });
    });
  }, [badges, children, hasLoadedSavedState, missions]);

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
      familyNeighborhood,
      aiBuddyCategories,
      aiBuddyDailyRotate,
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
    setFamilyNeighborhood(snapshot.familyNeighborhood ?? "");
    setAiBuddyCategories(snapshot.aiBuddyCategories ?? ["Pet care", "Chores & routine", "Kindness & feelings", "Money & saving"]);
    setAiBuddyDailyRotate(snapshot.aiBuddyDailyRotate ?? true);
    setBuddyParentQuestions(snapshot.buddyParentQuestions ?? []);
    setSocialPracticeOverride(snapshot.socialPracticeOverride ?? null);
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

  /**
   * Stream R2: the real-path entry. A new parent leaves the demo behind and
   * lands on Family Setup with a fresh, empty family — never the sample data.
   * If this device already has a saved family with kids, restore that instead
   * of blanking it (signing in later pulls their cloud family anyway).
   */
  function startFreshFamilySetup() {
    const saved = loadSavedFamilyState();
    if (saved && saved.children.length > 0) {
      applyFamilySnapshot(saved);
    } else {
      applyFamilySnapshot({
        familyName: "My Family",
        parentPasscode: defaultParentPasscode,
        parents: starterParents,
        children: [],
        pets: [],
        missions: [],
        transactions: [],
        goals: [],
        badges: [],
        neighborhoodJobs: [],
        moments: [],
        activeChildId: "",
      });
    }
    setAppMode("real");
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("setup");
    setAuthPage(null);
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
   * Parent Review: set or change a kid profile's passcode (additive Child
   * field, settable at profile creation or later). Empty clears it.
   * Parent-only — the passcode card lives on the parent tab.
   */
  function setChildPasscode(childId: string, passcode: string) {
    const clean = passcode.trim();
    setChildren((items) =>
      items.map((child) => (child.id === childId ? { ...child, passcode: clean || undefined } : child)),
    );
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

  /**
   * Character curriculum: one-tap assignment of a trait+level mission pack.
   * Missions are real Mission objects tagged with `curriculum`, so they flow
   * through the normal kid checklist → complete → parent approve pipeline.
   * Templates whose missionKey already has an open (non-approved) instance
   * for the kid are skipped, so re-tapping never duplicates missions.
   */
  function assignCurriculumMissions(traitKey: CharacterTraitKey, levelIndex: number, childId: string) {
    const openKeys = openCurriculumMissionKeys(childId, traitKey, levelIndex, missions);
    const pack = instantiateCurriculumMissions(traitKey, levelIndex, childId, { hasPet: pets.length > 0 });
    const fresh = pack.filter((mission) => !openKeys.has(mission.curriculum!.missionKey));
    if (fresh.length === 0) return;
    setMissions((items) => [...fresh, ...items]);
  }

  /**
   * Parent Review → AI pet-chores builder: turn a generated chore set into
   * real missions for one kid. Skill tags map to mission categories so the
   * life-skill labels (and badge flow) track them like any other mission.
   */
  function addChoreMissions(drafts: PetChoreDraft[], childId: string) {
    if (!drafts.length || !childId) return;
    const now = Date.now();
    const fresh: Mission[] = drafts.map((draft, index) => ({
      id: `mission-chore-${now}-${index}`,
      title: draft.title,
      category: choreSkillToCategory(draft.skill),
      difficulty: draft.difficulty,
      points: draft.points,
      coins: Math.max(1, Math.round(draft.points / 6)),
      petId: draft.petId,
      assignedChildId: childId,
      question: draft.detail || `Skill focus: ${getLifeSkillLabel(draft.skill)}. What did you notice while doing it?`,
      status: "pending",
    }));
    setMissions((items) => [...fresh, ...items]);
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
    createBankGoal({
      title: newGoal.title,
      target: Number(newGoal.target) || 25,
      kind: newGoal.kind,
      cause: newGoal.cause,
      seed: Number(newGoal.seed) || 0,
    });
    setNewGoal({ title: "", target: "25", kind: "save", cause: "Animal shelter", seed: "" });
  }

  /**
   * Feedback R2 — Kid Bank decided flow (additive; nothing else changed).
   * Parent approves a completed job → dollars AUTO-CREDIT as an approved
   * "earn" transaction (see approveMission). The KID then chooses which jar
   * (save/spend/give) it goes into via kidAllocateJar — INSTANT, no second
   * parent approval. Parents set the points-to-dollar rate + guardrails
   * UPFRONT (ParentProfile.bankSettings); this function only enforces them.
   * Returns the new transaction id (for the kid's undo list) or null.
   */
  const activeBankSettings: KidBankSettings = { ...defaultKidBankSettings, ...(parents[0]?.bankSettings ?? {}) };

  function updateBankSettings(next: KidBankSettings) {
    setParents((items) =>
      items.length
        ? items.map((parent, index) => (index === 0 ? { ...parent, bankSettings: next } : parent))
        : [{ ...starterParents[0], bankSettings: next }],
    );
  }

  function kidAllocateJar(category: KidJarKey, amount: number, goalId?: string): string | null {
    if (!activeChild) return null;
    const balances = kidJarBalances(activeChild.id, transactions);
    const blocked = jarMoveGuardrails({ balances, settings: activeBankSettings, request: { category, amount, goalId } });
    if (blocked) return null;
    const txId = `tx-${Date.now()}`;
    const created = buildJarMoveTx(activeChild.id, { category, amount, goalId }, activeChild.name, txId);
    setTransactions((items) => [created, ...items]);
    if (goalId && (category === "save" || category === "give")) {
      setGoals((items) => items.map((item) => (item.id === goalId ? withGoalProgress(item, created.amount) : item)));
    }
    return txId;
  }

  /** Undo one of the kid's own jar moves: exact reversal, also backs out goal progress. */
  function undoKidJarMove(txId: string): boolean {
    const original = transactions.find((item) => item.id === txId);
    if (!original || !activeChild || !isUndoableJarMove(original, activeChild.id)) return false;
    const undo = reverseJarMove(original, `tx-${Date.now()}`);
    setTransactions((items) => [undo, ...items]);
    if (undo.goalId) {
      setGoals((items) => items.map((item) => (item.id === undo.goalId ? withGoalProgress(item, undo.amount) : item)));
    }
    return true;
  }

  /** Kid turns points into dollars at the parent-set rate (approval happened upfront, via the rate). */
  function convertPointsToDollars(): void {
    if (!activeChild) return;
    const { dollars, pointsUsed } = pointsToDollars(activeChild.points, pointsPerDollar);
    if (dollars < 1) return;
    setChildren((items) =>
      items.map((child) => (child.id === activeChild.id ? { ...child, points: child.points - pointsUsed } : child)),
    );
    setTransactions((items) => [
      {
        id: `tx-${Date.now()}`,
        childId: activeChild.id,
        category: "earn",
        amount: dollars,
        description: `${activeChild.name} turned ${pointsUsed} points into dollars`,
        status: "approved",
      },
      ...items,
    ]);
  }

  /** Parameterized goal creator behind both the parent drive-enrollment form and the kid's own goal creator. */
  function createBankGoal(draft: { title: string; target: number; kind: "save" | "give"; cause: string; seed?: number }) {
    if (!activeChild || !draft.title.trim()) return;
    const isGiving = draft.kind === "give";
    const target = Math.max(1, Math.floor(draft.target || 25));
    const seed = isGiving ? Math.max(0, Math.floor(draft.seed ?? 0)) : 0;
    const now = new Date().toISOString();
    const created: SavingsGoal = {
      id: `goal-${Date.now()}`,
      childId: activeChild.id,
      title: draft.title.trim(),
      target,
      saved: 0,
      type: isGiving ? "donation" : "family_reward",
      sharedWithTrustedFamilies: isGiving,
      causeNote: isGiving ? draft.cause : "Parent can choose to share this goal with trusted families.",
      seededByParent: isGiving && seed > 0 ? seed : undefined,
    };
    setGoals((items) => [seed > 0 ? withGoalProgress(created, seed, now) : created, ...items]);
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
    // Feedback R2: parent-authored practice ids (parent-social-*) are tracked
    // in the same map but never count toward the built-in Safe Social Star —
    // that badge is for completing the TailTots default scenario set.
    const defaultDone = updated.filter((id) => !id.startsWith("parent-social-"));
    if (
      defaultDone.length >= socialScenarios.length &&
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

  // Other-parent playdate claim view: a dedicated screen, not the app.
  if (playdateRouteId) {
    return <PlaydateClaimView inviteId={playdateRouteId} />;
  }

  // Family member's giving-goal view: a dedicated screen, not the app.
  // Shows only the parent-curated snapshot — never kid details.
  if (givingRouteId) {
    return <GivingShareView shareId={givingRouteId} />;
  }

  // Stream R2: dedicated parent signup / signin pages — full screens, not a
  // modal buried in setup. Built on the same magic-link flow.
  if (authPage) {
    return (
      <ParentAuthView
        mode={authPage}
        accountDraft={accountDraft}
        setAccountDraft={setAccountDraft}
        accountStatus={accountStatus}
        accountMessage={accountMessage}
        sendParentSignInLink={sendParentSignInLink}
        magicLinkSent={magicLinkSent}
        onSwitchMode={() => {
          setMagicLinkSent(false);
          setAccountMessage("");
          setAuthPage(authPage === "signup" ? "signin" : "signup");
        }}
        onBack={() => setAuthPage(null)}
        onSkip={startFreshFamilySetup}
      />
    );
  }

  return (
    <main className="tailtots-app min-h-screen bg-[#faf8f0] text-[#17231f]">
      <header className="sticky top-0 z-20 border-b border-[#ded8c7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
            <img src="/tailtots-logo.png" alt="TailTots logo" className="h-12 w-auto shrink-0 rounded-lg object-contain sm:h-14" />
            <div className="min-w-0">
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
            {role === "child" && (
              <ChildProfileDropdown
                activeChild={activeChild}
                childProfiles={children}
                requestChildSwitch={requestChildSwitch}
              />
            )}
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
            {/* Stream R2: persistent demo/real mode banner with one-tap path switching. */}
            <div
              role="status"
              aria-live="polite"
              className={`flex min-h-10 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${
                appMode === "demo" ? "border-[#f0c96a] bg-[#fff4d8] text-[#7a4b12]" : "border-[#165a4b]/30 bg-[#e7f4ef] text-[#0d3b30]"
              }`}
            >
              {appMode === "demo" ? (
                <>
                  <span aria-hidden="true">🧪</span>
                  <span>Demo mode — you&apos;re exploring the sample family. Nothing here is real.</span>
                  <button onClick={startFreshFamilySetup} className="tt-btn-press min-h-9 rounded-lg bg-[#17231f] px-3 py-1.5 text-xs font-black text-white">
                    Set up my family →
                  </button>
                </>
              ) : (
                <>
                  <span aria-hidden="true">🏠</span>
                  <span>
                    Your family — real setup{cloudAccountEmail ? ` · signed in as ${cloudAccountEmail}` : " · saved on this device"}
                    {cloudSyncOn ? " · cloud sync on" : ""}.
                  </span>
                  <button onClick={openParentDemo} className="tt-btn-press min-h-9 rounded-lg border-2 border-[#165a4b]/40 bg-white px-3 py-1.5 text-xs font-black text-[#0d3b30]">
                    Explore the demo
                  </button>
                  {!cloudAccountEmail && (
                    <button onClick={() => setAuthPage("signin")} className="tt-btn-press min-h-9 rounded-lg px-3 py-1.5 text-xs font-black text-[#165a4b] underline">
                      Have an account? Sign in
                    </button>
                  )}
                </>
              )}
            </div>
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
                {tab.id === "approvals" && role === "parent" && parentPendingCount > 0 && (
                  <span
                    className="ml-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#d92626] px-1.5 text-[11px] font-black text-white"
                    role="status"
                    aria-label={`${parentPendingCount} items need your review`}
                  >
                    {parentPendingCount}
                  </span>
                )}
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
              openSignup={() => setAuthPage("signup")}
              openSignin={() => setAuthPage("signin")}
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
          {visibleActiveTab === "home" && role === "child" && (
            <KidHomeHub
              activeChild={activeChild}
              missions={missions}
              transactions={transactions}
              badges={badges}
              setActiveTab={setActiveTab}
            />
          )}
          {visibleActiveTab === "missions" && (
            <>
              {role === "child" && dailyChecksEnabled && !checksExhausted && (
                <div className="mb-4 rounded-2xl border-2 border-tt-sun bg-tt-sun/15 p-4 text-center shadow-sm" role="status" aria-live="polite">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-tt-tang">⚡ Check-ins today</p>
                  <p className="mt-1 text-2xl font-black text-tt-navy">
                    {Math.max(0, maxDailyChecks - checksUsed)}{" "}
                    <span className="text-base font-bold text-tt-ink-soft">of {maxDailyChecks} left</span>
                  </p>
                  <div className="mx-auto mt-2 h-3 max-w-xs overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-3 rounded-full bg-tt-tang transition-all"
                      style={{ width: `${Math.min(100, (checksUsed / Math.max(1, maxDailyChecks)) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-tt-ink-soft">Short, sweet check-ins — about a minute each. 🌟</p>
                </div>
              )}
              <Hero
                child={activeChild}
                childProfiles={children}
                setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
                pendingCount={pendingApprovals.length}
                taskProgress={taskProgress}
                approvedMissionCount={activeApprovedMissionCount}
                setActiveTab={setActiveTab}
                role={role}
              />
              <MissionsPanel
                activeChild={activeChild}
                missions={role === "parent" ? activeChildMissions : kidVisibleMissions}
                pets={pets}
                allChildren={children}
                badges={badges}
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
          {visibleActiveTab === "schedule" && role === "parent" && (
            <SchedulePanel
              familyName={familyName}
              childProfiles={children}
              kidAvailability={kidAvailability}
              setKidAvailability={setKidAvailability}
            />
          )}
          {visibleActiveTab === "schedule" && role === "child" && (
            <KidScheduleView
              activeChild={activeChild}
              kidAvailability={kidAvailability}
            />
          )}
          {visibleActiveTab === "pets" && (
            <PassportPanel
              pets={pets}
              missions={missions}
              allowEditing={role === "parent"}
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
              childProfiles={children}
              socialPracticeDone={socialPracticeDone}
              onAnswerSocialScenario={answerSocialScenario}
              scheduleItems={scheduleItems}
              onHelperUse={logHelperUse}
              aiBuddyCategories={aiBuddyCategories}
              aiBuddyDailyRotate={aiBuddyDailyRotate}
              aiDailyBoost={aiDailyBoost}
              parentQuestions={buddyParentQuestions}
              socialOverride={socialPracticeOverride}
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
              setPointsPerDollar={setPointsPerDollar}
              bankSettings={activeBankSettings}
              onBankSettingsChange={updateBankSettings}
              allocateToJar={kidAllocateJar}
              undoJarMove={undoKidJarMove}
              convertPointsToDollars={convertPointsToDollars}
              createBankGoal={createBankGoal}
            />
          )}
          {visibleActiveTab === "approvals" && (
            <div className="space-y-4">
              <NotificationsCard
                missions={missions}
                transactions={transactions}
                childProfiles={children}
                pendingPlaydates={pendingPlaydates}
                acknowledgePlaydate={acknowledgePlaydate}
                setActiveTab={setActiveTab}
              />
              <MissionAssignmentPanel
                missions={missions}
                childProfiles={children}
                badges={badges}
                assignMission={assignMission}
                autoBalanceMissions={autoBalanceMissions}
              />
              <PetChoreBuilderCard
                pets={pets}
                childProfiles={children}
                parentSignedIn={Boolean(cloudAccountEmail)}
                addChoreMissions={addChoreMissions}
              />
              <AskKidPromptCard childProfiles={children} parentSignedIn={Boolean(cloudAccountEmail)} />
              <CopilotPanel childProfiles={children} cloudFamilyId={cloudFamilyId} />
              <ApprovalsPanel
                missions={missions}
                transactions={transactions}
                childProfiles={children}
                pets={pets}
                approveMission={approveMission}
                approveTransaction={approveTransaction}
                rejectMission={rejectMission}
                rejectTransaction={rejectTransaction}
                fillJobTemplate={fillJobTemplate}
                onTemplateUsed={() => setActiveTab("neighborhood")}
              />
              <KidPasscodeCard childProfiles={children} setChildPasscode={setChildPasscode} />
              {/* Feedback R2 — AI buddy stream: parent-only editors (Parent Review is parent-only; kids never see this tab). */}
              <BuddyParentQuestionsEditor
                questions={buddyParentQuestions}
                onChange={setBuddyParentQuestions}
                categories={[...BUDDY_BOOST_CATEGORIES]}
              />
              <SocialPracticeOverrideEditor override={socialPracticeOverride} onChange={setSocialPracticeOverride} />
            </div>
          )}
          {visibleActiveTab === "setup" && (
            <FamilySetupPanel
              cloudAccountEmail={cloudAccountEmail}
              accountStatus={accountStatus}
              accountMessage={accountMessage}
              onOpenSignup={() => setAuthPage("signup")}
              onOpenSignin={() => setAuthPage("signin")}
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
              familyZip={familyZip}
              setFamilyZip={setFamilyZip}
              familyNeighborhood={familyNeighborhood}
              setFamilyNeighborhood={setFamilyNeighborhood}
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
              aiBuddyCategories={aiBuddyCategories}
              setAiBuddyCategories={setAiBuddyCategories}
              aiBuddyDailyRotate={aiBuddyDailyRotate}
              setAiBuddyDailyRotate={setAiBuddyDailyRotate}
              appMode={appMode}
              onResetDemo={() => {
                loadDemoFamily();
                setActiveTab("setup");
              }}
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
              assignCurriculumMissions={assignCurriculumMissions}
              transactions={transactions}
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


function VisionLandingPanel({
  openParentDemo,
  openKidDemo,
  openSignup,
  openSignin,
  previewChildName,
  previewFamilyName,
}: {
  openParentDemo: () => void;
  openKidDemo: () => void;
  openSignup: () => void;
  openSignin: () => void;
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
  const kidsPetPhotos = [
    ["African American family — kid + dog", "/landing/household-african-american-dog.jpg"],
    ["South Asian family — kid + cat", "/landing/household-south-asian-cat.jpg"],
    ["East Asian family — kid + rabbit", "/landing/household-east-asian-rabbit.jpg"],
    ["Latino family — kid + guinea pig", "/landing/household-latino-guinea-pig.jpg"],
  ];

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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-tt-pine">
              For parents of kids 5–12
            </p>
            <h2 className="tt-display mt-3 max-w-2xl text-[2.75rem] font-black leading-[1.04] text-tt-navy sm:text-6xl">
              Raising <span className="relative inline-block px-1"><span className="absolute inset-0 -rotate-1 rounded bg-tt-sun/70" aria-hidden="true" /><span className="relative italic">happy, responsible, empathetic humans</span></span> takes ten minutes a day.
            </h2>
            <p className="mt-4 max-w-xl text-lg font-bold leading-7 text-tt-navy-soft">
              Everyday moments — feeding the dog, finishing chores, choosing kindness — become real-world skills you’ll actually see grow. They live it all day; you track it in minutes.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              The child who cares for animals grows up caring for people. Parent-approved and closed: no strangers, no chats, no doomscroll.
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
                👨‍👩‍👧 Join the first 500 founding families
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
                  {launchInterestStatus === "saving" ? "Saving…" : "Claim our spot 🚀"}
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

      {/* ============ HOW IT WORKS: 5-step strip ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">How it actually works</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight text-tt-ink sm:text-3xl">Five steps. Ten minutes a day.</h3>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible">
          {journeySteps.map(([emoji, title, desc], idx) => (
            <div key={title} className="min-w-[220px] flex-1 rounded-2xl border border-tt-line bg-tt-cream p-4 sm:min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-tt-pine text-sm font-black text-white">{idx + 1}</span>
                <span className="text-xl" aria-hidden="true">{emoji}</span>
              </div>
              <p className="mt-2 text-sm font-black text-tt-ink">{title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ DOCTRINE: the 10-second parent version ============ */}
      {/* ============ WHO IT'S FOR: strong habits, three kinds of kids ============ */}
      <section className="-mx-3 border-y-2 border-tt-pine/40 bg-tt-pine p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">Who TailTots is for 🐾</p>
        <h3 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Strong habits. Real responsibility. Whichever kid you’ve got.</h3>
        <div className="mt-4 rounded-2xl ring-1 ring-white/15">
          <table className="w-full border-collapse bg-white/10 text-xs">
            <thead>
              <tr className="border-b border-white/15">
                <th className="p-2 text-left">
                  <img src="/landing/kid-dog.jpg" alt="Kid hugging their dog" className="h-20 w-full rounded-xl object-cover" loading="lazy" />
                </th>
                <th className="p-2 text-center">
                  <p className="text-xs font-black leading-tight">Have<br />pets</p>
                </th>
                <th className="p-2 text-center">
                  <p className="text-xs font-black leading-tight">Want<br />pets</p>
                </th>
                <th className="p-2 text-center">
                  <p className="text-xs font-black leading-tight">Can't have<br />pets</p>
                </th>
              </tr>
            </thead>
            <tbody className="font-semibold text-white/85">
              <tr className="border-b border-white/10">
                <td className="p-2">Kid Bank</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-2">Skill missions</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-2">Kindness missions</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-2">Streaks & certificates</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="border-b border-white/10">
                <td className="p-2">Parent approvals</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-2">Real pet routine</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center text-white/30">—</td>
                <td className="p-2 text-center text-white/30">—</td>
              </tr>
              <tr className="border-b border-white/10 bg-white/5">
                <td className="p-2">Readiness certificate</td>
                <td className="p-2 text-center text-white/30">—</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center text-white/30">—</td>
              </tr>
              <tr className="bg-white/5">
                <td className="p-2">Shelter giving</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
              <tr className="bg-white/5">
                <td className="p-2">School & PTO donations</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
                <td className="p-2 text-center">✅</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm font-semibold leading-6 text-white/80">
            Same habits, same responsibility, same nag-free mornings — whichever kid you’ve got.
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
            {/* Stream R2: explicit entry choice — demo path vs real path. */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <p className="text-sm font-black text-white">🧪 Explore the demo</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/60">Sample family included. Nothing leaves your device in the demo.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={openKidDemo} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-5 py-3 text-sm font-black text-tt-ink shadow-lg">
                    🧒 Kid demo
                  </button>
                  <button onClick={openParentDemo} className="tt-btn-press min-h-12 rounded-xl border-2 border-white/30 bg-white/10 px-5 py-3 text-sm font-black text-white">
                    🧑‍💼 Parent side
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-tt-sun/15 p-4 ring-1 ring-tt-sun/40">
                <p className="text-sm font-black text-white">🏠 Set up my family</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/60">Your real family — kids, pets, photos. Parent account optional.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={openSignup} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-5 py-3 text-sm font-black text-tt-ink shadow-lg">
                    Create parent account
                  </button>
                  <button onClick={openSignin} className="tt-btn-press min-h-12 rounded-xl border-2 border-tt-sun/50 bg-transparent px-5 py-3 text-sm font-black text-tt-sun">
                    Sign in
                  </button>
                </div>
              </div>
            </div>
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

      {/* ============ SAFETY: the non-negotiable ============ */}
      <section className="-mx-3 border-y border-tt-line bg-tt-cream p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">Safety, by design</p>
        <h3 className="mt-1 max-w-2xl text-2xl font-black tracking-tight text-tt-ink sm:text-3xl">Your child will never talk to a stranger on TailTots. Period.</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["🚫", "No strangers"],
            ["💬", "No open chats"],
            ["✅", "You approve everything"],
            ["🔒", "Closed family circle"],
          ].map(([emoji, title]) => (
            <div key={title} className="rounded-2xl border border-tt-line bg-white p-4 text-center">
              <p className="text-3xl" aria-hidden="true">{emoji}</p>
              <p className="mt-2 text-sm font-black text-tt-ink">{title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ ORIGIN: where this came from ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">Why we built this</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-tt-ink sm:text-3xl">"Why don't all homes have pets? Don't they like pets?"</h3>
          <p className="mt-3 text-[15px] font-semibold leading-7 text-tt-ink-soft">
            My kids asked me that one day. Our guinea pigs, tortoise, and fish had taught them
            patience and responsibility no lecture could — and I realized every child deserves that,
            pet or no pet. So I built TailTots. If it helped them, maybe it can help yours too.
          </p>
        </div>
      </section>



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

function formatClaimedAt(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Feedback R2 — schedule stream: 15-min week grid + calendar import.   */
/* Pure slot/ICS helpers live in lib/schedule-calendar.ts (unit-tested) */
/* and notification helpers in lib/playdate-notifications.ts. The      */
/* components below are the SchedulePanel region of this file.         */
/* ------------------------------------------------------------------ */

const SCHEDULE_BUSY_STORAGE_KEY = "tailtots-schedule-busy-v1";

interface ScheduleBusyImport {
  id: string;
  fileName: string;
  importedAt: number;
  eventCount: number;
  /** Busy keys this import added (for undo). */
  addedBusyKeys: string[];
  /** Availability selections this import cleared, per kid (for undo). */
  removedByKid: Record<string, string[]>;
}

interface ScheduleBusyState {
  keys: string[];
  imports: ScheduleBusyImport[];
}

function readScheduleBusyState(): ScheduleBusyState {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return { keys: [], imports: [] };
  try {
    const raw = localStorage.getItem(SCHEDULE_BUSY_STORAGE_KEY);
    if (!raw) return { keys: [], imports: [] };
    const parsed = JSON.parse(raw) as Partial<ScheduleBusyState>;
    const keys = Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === "string") : [];
    const imports = Array.isArray(parsed.imports)
      ? parsed.imports.filter(
          (i): i is ScheduleBusyImport => !!i && typeof (i as ScheduleBusyImport).id === "string",
        )
      : [];
    return { keys, imports };
  } catch {
    return { keys: [], imports: [] };
  }
}

function writeScheduleBusyState(state: ScheduleBusyState): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SCHEDULE_BUSY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota — busy state still works for this session */
  }
}

function makeScheduleId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `sch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** One kid's 15-minute week grid. Busy (imported) and claimed slots are locked. */
function KidWeekGrid({
  childId,
  childName,
  selectedKeys,
  busyKeys,
  claimedKeys,
  legacyLabels,
  claimedLegacyLabels,
  onToggleKey,
  onSetKeys,
  onRemoveLegacy,
}: {
  childId: string;
  childName: string;
  /** Canonical 15-min keys currently selected for this kid. */
  selectedKeys: string[];
  /** Imported-calendar busy keys (all kids). */
  busyKeys: Set<string>;
  /** Claimed keys, global `${childId}|${key}` format. */
  claimedKeys: Set<string>;
  /** Older human-label selections that predate the 15-min grid. */
  legacyLabels: string[];
  claimedLegacyLabels: Set<string>;
  onToggleKey: (childId: string, key: string) => void;
  onSetKeys: (childId: string, keys: string[], select: boolean) => void;
  onRemoveLegacy: (childId: string, label: string) => void;
}) {
  const [activeDay, setActiveDay] = useState<ScheduleDay>("Mon");
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const mergedSummary = useMemo(() => mergeSlotKeys(selectedKeys), [selectedKeys]);

  const daySelectedCount = (day: ScheduleDay) => selectedKeys.filter((k) => k.startsWith(`${day}|`)).length;

  function dayKeys(day: ScheduleDay): string[] {
    const keys: string[] = [];
    for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
      for (let q = 0; q < 60; q += 15) keys.push(slotKey(day, h, q));
    }
    return keys;
  }

  const presets: Array<{ label: string; days: ScheduleDay[]; startHour: number; endHour: number }> = [
    { label: "Weekday afternoons · 3–6 PM", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startHour: 15, endHour: 18 },
    { label: "Weekend mornings · 9 AM–12 PM", days: ["Sat", "Sun"], startHour: 9, endHour: 12 },
  ];

  function applyPreset(preset: (typeof presets)[number]) {
    const keys: string[] = [];
    for (const day of preset.days) {
      for (let h = preset.startHour; h < preset.endHour; h++) {
        for (let q = 0; q < 60; q += 15) keys.push(slotKey(day, h, q));
      }
    }
    onSetKeys(childId, keys, true);
  }

  const hours: number[] = [];
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) hours.push(h);

  return (
    <div className="rounded-lg bg-[#faf8f0] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black">{childName}</p>
        <p className="text-xs font-bold text-[#4f625b]">
          {selectedKeys.length > 0
            ? `${selectedKeys.length} × 15-min slot${selectedKeys.length === 1 ? "" : "s"} selected`
            : "Tap times to mark them free"}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => applyPreset(preset)}
            className="tt-btn-press min-h-9 rounded-full border-2 border-[#ded8c7] bg-white px-3 py-1 text-xs font-black text-[#165a4b]"
          >
            + {preset.label}
          </button>
        ))}
        {selectedKeys.length > 0 && (
          <button
            type="button"
            onClick={() => onSetKeys(childId, selectedKeys, false)}
            className="tt-btn-press min-h-9 rounded-full border-2 border-[#ded8c7] bg-white px-3 py-1 text-xs font-black text-[#b3541e]"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label={`${childName} weekday`}>
        {SCHEDULE_DAYS.map((day) => {
          const active = activeDay === day;
          const count = daySelectedCount(day);
          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDay(day)}
              className={`tt-btn-press min-h-10 rounded-lg px-2.5 py-1 text-xs font-black ${
                active ? "bg-[#165a4b] text-white" : "bg-white text-[#4f625b] ring-1 ring-[#ded8c7]"
              }`}
            >
              {day}
              {count > 0 && <span className={`ml-1 ${active ? "text-[#ffe9a8]" : "text-[#165a4b]"}`}>·{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onSetKeys(childId, dayKeys(activeDay), true)}
          className="text-xs font-black text-[#165a4b] underline decoration-[#165a4b]/30 underline-offset-2"
        >
          Select all {activeDay}
        </button>
        <button
          type="button"
          onClick={() => onSetKeys(childId, dayKeys(activeDay), false)}
          className="text-xs font-black text-[#4f625b] underline decoration-[#4f625b]/30 underline-offset-2"
        >
          Clear {activeDay}
        </button>
      </div>

      <div className="mt-2 grid gap-1.5" role="group" aria-label={`${childName} ${activeDay} times`}>
        {hours.map((h) => (
          <div key={h} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-black text-[#4f625b]">{formatHourLabel(h)}</span>
            <div className="grid flex-1 grid-cols-4 gap-1">
              {[0, 15, 30, 45].map((q) => {
                const key = slotKey(activeDay, h, q);
                const selected = selectedSet.has(key);
                const busy = busyKeys.has(key);
                const claimed = claimedKeys.has(`${childId}|${key}`);
                const disabled = busy || claimed;
                const label = `${activeDay} ${formatTime12(h, q)}`;
                return (
                  <button
                    key={q}
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggleKey(childId, key)}
                    title={claimed ? `${label} · already booked` : busy ? `${label} · busy (imported calendar)` : label}
                    aria-pressed={selected}
                    className={`tt-btn-press min-h-9 rounded-md border-2 px-1 py-1 text-[11px] font-bold disabled:cursor-not-allowed ${
                      claimed
                        ? "border-[#ded8c7] bg-[#f1ede2] text-[#a09a8c] line-through"
                        : busy
                          ? "border-[#ded8c7] bg-[#f1ede2] text-[#a09a8c]"
                          : selected
                            ? "border-[#165a4b] bg-[#e7f4ef] text-[#165a4b]"
                            : "border-[#ded8c7] bg-white text-[#4f625b]"
                    }`}
                  >
                    {formatTime12(h, q)}
                    {claimed ? " · booked" : busy ? " · busy" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {mergedSummary.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mergedSummary.map((label) => (
            <span key={label} className="rounded-full bg-[#e7f4ef] px-2.5 py-1 text-xs font-black text-[#165a4b]">
              {label}
            </span>
          ))}
        </div>
      )}

      {legacyLabels.length > 0 && (
        <div className="mt-3 rounded-lg bg-white p-2.5 ring-1 ring-[#ded8c7]">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#a09a8c]">Earlier saved times</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {legacyLabels.map((label) => {
              const claimed = claimedLegacyLabels.has(label);
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    claimed ? "bg-[#f1ede2] text-[#a09a8c] line-through" : "bg-[#eef2ff] text-[#2563eb]"
                  }`}
                >
                  {label}
                  {claimed ? (
                    " · booked"
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemoveLegacy(childId, label)}
                      aria-label={`Remove ${label}`}
                      className="tt-btn-press ml-0.5 font-black"
                    >
                      ×
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Calendar import: Google / Apple connect buttons (UI complete, but NOT
 * wired — the repo has no OAuth credentials; see the SCHEDULE_*_CONFIGURED
 * flags and the OAuth gap notes in lib/schedule-calendar.ts) plus a fully
 * working .ics file import that maps events onto busy 15-minute slots.
 */
function CalendarImportCard({
  busyState,
  setBusyState,
  kidAvailability,
  setKidAvailability,
  childProfiles,
}: {
  busyState: ScheduleBusyState;
  setBusyState: (state: ScheduleBusyState) => void;
  kidAvailability: Record<string, string[]>;
  setKidAvailability: (value: Record<string, string[]>) => void;
  childProfiles: Child[];
}) {
  const [oauthNotice, setOauthNotice] = useState<null | "google" | "apple">(null);
  const [review, setReview] = useState<{ fileName: string; events: ParsedCalendarEvent[] } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handlePickedFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError("");
    setMessage("");
    file
      .text()
      .then((text) => {
        const events = parseIcs(text);
        if (events.length === 0) {
          setReview(null);
          setError(`No calendar events found in ${file.name}. Make sure it's a valid .ics calendar file.`);
          return;
        }
        setReview({ fileName: file.name, events });
      })
      .catch(() => {
        setReview(null);
        setError("Couldn't read that file — try exporting the .ics again.");
      });
  }

  function applyImport() {
    if (!review) return;
    const busyKeys = new Set<string>();
    for (const event of review.events) {
      for (const key of eventToBusySlotKeys(event)) busyKeys.add(key);
    }
    const existing = new Set(busyState.keys);
    const addedBusyKeys = [...busyKeys].filter((k) => !existing.has(k));
    const removedByKid: Record<string, string[]> = {};
    const nextAvailability = { ...kidAvailability };
    let clearedCount = 0;
    for (const child of childProfiles) {
      const current = nextAvailability[child.id] ?? [];
      const removed = current.filter((k) => isCanonicalSlotKey(k) && busyKeys.has(k));
      if (removed.length > 0) {
        removedByKid[child.id] = removed;
        clearedCount += removed.length;
        nextAvailability[child.id] = current.filter((k) => !busyKeys.has(k));
      }
    }
    const record: ScheduleBusyImport = {
      id: makeScheduleId(),
      fileName: review.fileName,
      importedAt: Date.now(),
      eventCount: review.events.length,
      addedBusyKeys,
      removedByKid,
    };
    setBusyState({ keys: [...existing, ...addedBusyKeys], imports: [record, ...busyState.imports].slice(0, 20) });
    setKidAvailability(nextAvailability);
    setMessage(
      `Imported ${review.events.length} event${review.events.length === 1 ? "" : "s"} from ${review.fileName} — ` +
        `${busyKeys.size} busy 15-min slot${busyKeys.size === 1 ? "" : "s"} blocked in the weekly grid` +
        (clearedCount > 0 ? `, ${clearedCount} selected time${clearedCount === 1 ? "" : "s"} cleared` : "") +
        ".",
    );
    setReview(null);
  }

  function undoImport(id: string) {
    const record = busyState.imports.find((i) => i.id === id);
    if (!record) return;
    const others = busyState.imports.filter((i) => i.id !== id);
    const otherKeys = new Set(others.flatMap((i) => i.addedBusyKeys));
    const keys = busyState.keys.filter((k) => !record.addedBusyKeys.includes(k) || otherKeys.has(k));
    const nextAvailability = { ...kidAvailability };
    for (const child of childProfiles) {
      const restore = record.removedByKid[child.id] ?? [];
      if (restore.length > 0) {
        const current = new Set(nextAvailability[child.id] ?? []);
        for (const k of restore) current.add(k);
        nextAvailability[child.id] = [...current];
      }
    }
    setBusyState({ keys, imports: others });
    setKidAvailability(nextAvailability);
    setMessage(`Undid the ${record.fileName} import — its busy blocks are gone and cleared times were restored.`);
  }

  const oauthCopy =
    oauthNotice === "google" ? (
      <>
        <p className="text-sm font-black">Google Calendar isn&apos;t connected yet</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">
          One-time setup is needed first: a Google Cloud OAuth 2.0 Client ID with the Calendar readonly scope
          (flag <code>SCHEDULE_GOOGLE_OAUTH_CONFIGURED</code> in{" "}
          <code>lib/schedule-calendar.ts</code>). Until then, export your Google Calendar as{" "}
          <code>.ics</code> (Google Calendar → Settings → Import &amp; export) and use the .ics import below — it
          works today, no sign-in needed.
        </p>
      </>
    ) : (
      <>
        <p className="text-sm font-black">Apple Calendar (iPhone) can&apos;t connect on the web</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">
          Apple offers no web sign-in for iCloud Calendar. Two paths instead: (1) in the TailTots iPhone app, grant
          calendar access (EventKit — flag <code>SCHEDULE_APPLE_CALENDAR_CONFIGURED</code> in{" "}
          <code>lib/schedule-calendar.ts</code>); or (2) export an <code>.ics</code> from iCloud.com (Calendar →
          Settings → Advanced → export) and import it below — it works today.
        </p>
      </>
    );

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Step 1b · sync your calendar</p>
      <h3 className="mt-2 text-2xl font-black">Import busy times</h3>
      <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        Connect a calendar or drop in an <code>.ics</code> file — imported events block the matching times in the
        grid above so you never offer a time you&apos;re busy. The weekly template repeats by weekday: a Tuesday
        class blocks Tuesdays.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOauthNotice(oauthNotice === "google" ? null : "google")}
          className="tt-btn-press min-h-11 rounded-lg border-2 border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]"
        >
          📅 Connect Google Calendar{" "}
          {!SCHEDULE_GOOGLE_OAUTH_CONFIGURED && (
            <span className="ml-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] text-[#92400e]">needs setup</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setOauthNotice(oauthNotice === "apple" ? null : "apple")}
          className="tt-btn-press min-h-11 rounded-lg border-2 border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]"
        >
          🍎 Connect Apple Calendar{" "}
          {!SCHEDULE_APPLE_CALENDAR_CONFIGURED && (
            <span className="ml-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] text-[#92400e]">needs setup</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          aria-label="Import .ics calendar file"
          onChange={(e) => handlePickedFile(e.target)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
        >
          📂 Import .ics file
        </button>
      </div>

      {oauthNotice && (
        <div className="mt-3 max-w-3xl rounded-lg bg-[#fffbeb] p-4 ring-1 ring-[#fde68a]">
          {oauthCopy}
          {/* OAuth gap (feedback R2 item 19): these buttons are UI-complete but
              unwired — SCHEDULE_GOOGLE_OAUTH_CONFIGURED /
              SCHEDULE_APPLE_CALENDAR_CONFIGURED are false in
              lib/schedule-calendar.ts because the repo has no OAuth
              credentials. See the gap notes there for exactly what's needed. */}
        </div>
      )}

      {error && <p className="mt-3 max-w-3xl rounded-lg bg-[#fdeee4] p-3 text-sm font-bold text-[#b3541e]">{error}</p>}
      {message && !review && (
        <p className="mt-3 max-w-3xl rounded-lg bg-[#e7f4ef] p-3 text-sm font-bold text-[#165a4b]" role="status">
          {message}
        </p>
      )}

      {review && (
        <div className="mt-3 max-w-3xl rounded-lg border-2 border-[#2563eb] bg-[#f4f7ff] p-4">
          <p className="text-sm font-black">
            {review.fileName} — {review.events.length} event{review.events.length === 1 ? "" : "s"} found
          </p>
          <ul className="mt-2 grid gap-1">
            {review.events.slice(0, 8).map((event, i) => (
              <li key={`${event.uid}-${i}`} className="text-sm font-semibold text-[#4f625b]">
                • <b className="text-[#17231f]">{event.summary}</b> — {formatEventWhen(event)}
              </li>
            ))}
          </ul>
          {review.events.length > 8 && (
            <p className="mt-1 text-xs font-bold text-[#4f625b]">+ {review.events.length - 8} more</p>
          )}
          <p className="mt-2 text-xs font-semibold leading-5 text-[#4f625b]">
            These will block the matching weekday in your weekly grid (a Tuesday event blocks Tuesdays). Any
            currently-selected times that overlap will be cleared — you can undo the whole import afterwards.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyImport}
              className="tt-btn-press min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white"
            >
              Block these times
            </button>
            <button
              type="button"
              onClick={() => setReview(null)}
              className="tt-btn-press min-h-11 rounded-lg border-2 border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#4f625b]"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {busyState.imports.length > 0 && (
        <div className="mt-3 max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a09a8c]">Imported calendars</p>
          <ul className="mt-1.5 grid gap-1.5">
            {busyState.imports.map((imp) => (
              <li
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#faf8f0] px-3 py-2 ring-1 ring-[#ded8c7]"
              >
                <span className="text-sm font-bold text-[#4f625b]">
                  📂 {imp.fileName} · {imp.eventCount} event{imp.eventCount === 1 ? "" : "s"} ·{" "}
                  {formatClaimedAt(imp.importedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => undoImport(imp.id)}
                  className="tt-btn-press text-xs font-black text-[#b3541e] underline underline-offset-2"
                >
                  Undo import
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Kid-friendly home hub: overview of their day, stats, and quick links. */
function KidHomeHub({
  activeChild,
  missions,
  transactions,
  badges,
  setActiveTab,
}: {
  activeChild: Child | undefined;
  missions: Mission[];
  transactions: BankTransaction[];
  badges: BadgeAward[];
  setActiveTab: (tab: string) => void;
}) {
  const myMissions = missions.filter((m) => m.assignedChildId === activeChild?.id || m.completedBy === activeChild?.id);
  const todoCount = myMissions.filter((m) => !m.completedBy && m.status !== "approved").length;
  const waitingCount = myMissions.filter((m) => m.completedBy && m.status === "pending").length;
  const myBadges = badges.filter((b) => b.childId === activeChild?.id);
  const myEarned = transactions.filter((t) => t.childId === activeChild?.id && t.category === "earn" && t.status === "approved");
  const totalEarned = myEarned.reduce((sum, t) => sum + t.amount, 0);

  const quickLinks = [
    ["missions", "🎯", "Today's missions", `${todoCount} to do`],
    ["bank", "🫙", "Kid Bank", `$${totalEarned} earned`],
    ["pets", "🐾", "Pet Passports", "Meet your buddies"],
    ["schedule", "📅", "My schedule", "Free time"],
  ] as const;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Home hub</p>
        <h2 className="mt-2 text-2xl font-black text-[#17231f]">
          Hey{activeChild ? ` ${activeChild.name}` : ""}! 👋
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
          Here's your day at a glance. Pick something fun and go do it in the real world!
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#e7f4ef] p-3 text-center">
            <p className="text-2xl font-black text-[#165a4b]">{todoCount}</p>
            <p className="text-xs font-bold text-[#4f625b]">Missions to do</p>
          </div>
          <div className="rounded-lg bg-[#fff4d8] p-3 text-center">
            <p className="text-2xl font-black text-[#7a4b12]">{waitingCount}</p>
            <p className="text-xs font-bold text-[#4f625b]">Waiting for high-five</p>
          </div>
          <div className="rounded-lg bg-[#f2f8fd] p-3 text-center">
            <p className="text-2xl font-black text-[#1a56db]">{myBadges.length}</p>
            <p className="text-xs font-bold text-[#4f625b]">Badges earned</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {quickLinks.map(([tabId, emoji, label, sub]) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className="rounded-lg border border-[#ded8c7] bg-white p-4 text-left shadow-sm hover:border-[#165a4b] hover:bg-[#f8fffe]"
          >
            <p className="text-2xl" aria-hidden="true">{emoji}</p>
            <p className="mt-1 text-sm font-black text-[#17231f]">{label}</p>
            <p className="text-xs font-semibold text-[#4f625b]">{sub}</p>
          </button>
        ))}
      </div>
      {myBadges.length > 0 && (
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-sm font-black text-[#17231f]">🏅 Your latest badges</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {myBadges.slice(0, 3).map((badge) => (
              <span key={badge.id} className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black text-[#7a4b12]">
                {badge.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Kid-friendly read-only schedule view: shows their free time for playdates. */
function KidScheduleView({
  activeChild,
  kidAvailability,
}: {
  activeChild: Child | undefined;
  kidAvailability: Record<string, string[]>;
}) {
  const slots = activeChild ? kidAvailability[activeChild.id] ?? [] : [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slotsByDay: Record<string, string[]> = {};
  for (const slot of slots) {
    const [day, ...rest] = slot.split(" ");
    const time = rest.join(" ");
    if (!slotsByDay[day]) slotsByDay[day] = [];
    slotsByDay[day].push(time);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">My schedule</p>
        <h2 className="mt-2 text-2xl font-black text-[#17231f]">
          {activeChild ? `${activeChild.name}'s free time` : "Free time"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
          Times you're free for playdates and missions. Ask a grown-up to update this in the parent Schedule tab!
        </p>
      </div>
      {slots.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[#ded8c7] bg-[#faf8f0] p-6 text-center">
          <p className="text-lg font-black text-[#17231f]">No free time set yet 📅</p>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#4f625b]">
            Once a grown-up adds your free times, they'll show up here so you know when playdates can happen!
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dayNames.map((day) => (
            <div key={day} className="rounded-lg border border-[#ded8c7] bg-white p-4">
              <p className="text-sm font-black text-[#17231f]">{day}</p>
              {(slotsByDay[day] ?? []).length === 0 ? (
                <p className="mt-1 text-xs font-semibold text-[#8a8f8b]">Busy day</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(slotsByDay[day] ?? []).map((time) => (
                    <span key={time} className="rounded-full bg-[#e7f4ef] px-2 py-0.5 text-xs font-bold text-[#165a4b]">
                      {time}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SchedulePanel({
  familyName,
  childProfiles,
  kidAvailability,
  setKidAvailability,
}: {
  familyName: string;
  childProfiles: Child[];
  kidAvailability: Record<string, string[]>;
  setKidAvailability: (value: Record<string, string[]>) => void;
}) {
  const [invites, setInvites] = useState<PlaydateInvite[]>([]);
  const [hostName, setHostName] = useState("");
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [notifications, setNotifications] = useState<PlaydateNotification[]>(() => readPlaydateNotifications());
  const [claimToast, setClaimToast] = useState<string | null>(null);
  const [busyState, setBusyState] = useState<ScheduleBusyState>(() => readScheduleBusyState());
  const prevInvitesRef = useRef<PlaydateInvite[] | null>(null);
  const baselineDoneRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    writeScheduleBusyState(busyState);
  }, [busyState]);

  // Live list of this family's invites; refreshes when another tab (the
  // other parent's claim view) writes to the store.
  //
  // Feedback R2 item 20 — host-side in-app notification: when an invite flips
  // open→booked (another parent claimed a slot), record a notification and
  // pop a toast. The first load only sets the baseline so old bookings don't
  // re-notify; later loads are driven by the store subscription, i.e. real
  // changes. The accepting parent's receipt is recorded on the claim page
  // (PlaydateClaimView) and also lands in this inbox.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const all = await playdateStore.listInvites();
      if (cancelled) return;
      setInvites(all);
      if (!baselineDoneRef.current) {
        baselineDoneRef.current = true;
        prevInvitesRef.current = all;
        return;
      }
      const prev = new Map((prevInvitesRef.current ?? []).map((invite) => [invite.id, invite]));
      const fresh: NewPlaydateNotification[] = [];
      for (const invite of all) {
        if (invite.status !== "booked" || !invite.claimedBy) continue;
        const old = prev.get(invite.id);
        if (old && old.status === "booked") continue;
        const slot = invite.slots.find((s) => s.status === "claimed");
        fresh.push(
          buildClaimNotification({
            inviteId: invite.id,
            hostName: invite.hostName,
            claimedBy: invite.claimedBy,
            slotLabel: slot?.slot ?? "a playdate time",
            childName: slot?.childName ?? "your kid",
            claimedAt: invite.claimedAt,
          }),
        );
      }
      if (fresh.length > 0) {
        setNotifications(appendPlaydateNotifications(fresh));
        setClaimToast(fresh[fresh.length - 1].title);
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setClaimToast(null), 9000);
      }
      prevInvitesRef.current = all;
    }
    load();
    const unsubscribe = playdateStore.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Slots already claimed across this family's invites can't be picked again.
  // Claimed labels (merged ranges or legacy labels) expand back to 15-min keys.
  const claimedKeys = useMemo(
    () => {
      const set = new Set<string>();
      for (const invite of invites) {
        for (const slot of invite.slots) {
          if (slot.status !== "claimed") continue;
          for (const key of expandSlotLabel(slot.slot)) set.add(`${slot.childId}|${key}`);
        }
      }
      return set;
    },
    [invites],
  );

  const busyKeySet = useMemo(() => new Set(busyState.keys), [busyState]);

  function setKeys(childId: string, keys: string[], select: boolean) {
    const allowed = keys.filter((k) => !busyKeySet.has(k) && !claimedKeys.has(`${childId}|${k}`));
    const next = new Set(kidAvailability[childId] ?? []);
    for (const k of allowed) {
      if (select) next.add(k);
      else next.delete(k);
    }
    setKidAvailability({ ...kidAvailability, [childId]: [...next] });
  }

  function toggleKey(childId: string, key: string) {
    const current = kidAvailability[childId] ?? [];
    setKeys(childId, [key], !current.includes(key));
  }

  function removeLegacyLabel(childId: string, label: string) {
    const current = kidAvailability[childId] ?? [];
    setKidAvailability({ ...kidAvailability, [childId]: current.filter((l) => l !== label) });
  }

  const openSelections = useMemo(
    () =>
      childProfiles.flatMap((child) => {
        const firstName = child.name.split(" ")[0];
        const raw = kidAvailability[child.id] ?? [];
        const keys = raw.filter((k) => isCanonicalSlotKey(k) && !claimedKeys.has(`${child.id}|${k}`));
        const legacy = raw.filter((k) => !isCanonicalSlotKey(k) && !claimedKeys.has(`${child.id}|${k}`));
        const merged = mergeSlotKeys(keys).map((slot) => ({ childId: child.id, childName: firstName, slot }));
        const legacySelections = legacy.map((slot) => ({ childId: child.id, childName: firstName, slot }));
        return [...merged, ...legacySelections];
      }),
    [childProfiles, kidAvailability, claimedKeys],
  );

  async function createInvite() {
    setCreateError("");
    if (openSelections.length === 0) {
      setCreateError("Select at least one free time in Step 1 first.");
      return;
    }
    try {
      const invite = await playdateStore.createInvite(familyName, hostName || "A TailTots parent", openSelections);
      setInvites(await playdateStore.listInvites());
      setJustCreatedId(invite.id);
    } catch (error) {
      // Cloud write failed (e.g. offline) — stay local-safe and say so.
      setCreateError(error instanceof Error ? error.message : "Couldn't create the invite. Please try again.");
    }
  }

  function copyInviteLink(invite: PlaydateInvite) {
    const url = playdateClaimUrl(invite.id);
    navigator.clipboard?.writeText(url).then(
      () => {
        setLinkCopiedId(invite.id);
        window.setTimeout(() => setLinkCopiedId((id) => (id === invite.id ? null : id)), 2500);
      },
      () => setLinkCopiedId(null)
    );
  }

  function markAllNotificationsRead() {
    setNotifications(markAllPlaydateNotificationsRead());
  }

  const unreadCount = unreadPlaydateNotificationCount(notifications);

  const latestClaim = useMemo(() => {
    const booked = invites.filter((i) => i.status === "booked" && i.claimedBy);
    booked.sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0));
    return booked[0];
  }, [invites]);
  const latestClaimedSlot = latestClaim?.slots.find((s) => s.status === "claimed");

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Schedule · parent tool</p>
        <h2 className="mt-2 text-3xl font-black">Playdate availability</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          Mark each kid&apos;s free times on the 15-minute weekly grid (or import your calendar to block busy times),
          create a real invite link, and send it to the other parents. The first parent to pick a time books it — the
          slot instantly becomes unavailable to everyone else, and you&apos;ll both be notified here the moment it
          happens. Only first names and time windows are ever shared; parent approves every plan before kids hear
          about it.
        </p>
      </div>

      {claimToast && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg border-2 border-[#165a4b] bg-[#e7f4ef] p-4 shadow-sm">
          <div>
            <p className="text-sm font-black text-[#165a4b]">{claimToast}</p>
            <p className="mt-1 text-xs font-semibold text-[#4f625b]">
              That time is now closed everywhere — it can&apos;t be double-booked. Details are in your notifications below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setClaimToast(null)}
            aria-label="Dismiss"
            className="tt-btn-press text-lg font-black text-[#165a4b]"
          >
            ×
          </button>
        </div>
      )}

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Step 1 · free time per kid</p>
        <h3 className="mt-2 text-2xl font-black">When is each kid free for a playdate?</h3>
        <p className="mt-1 max-w-3xl text-sm font-semibold text-[#4f625b]">
          Tap 15-minute blocks — adjacent picks merge into tidy windows on the invite. Booked times lock automatically.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {childProfiles.map((child) => {
            const raw = kidAvailability[child.id] ?? [];
            const selectedKeys = raw.filter(isCanonicalSlotKey);
            const legacyLabels = raw.filter((l) => !isCanonicalSlotKey(l));
            return (
              <KidWeekGrid
                key={child.id}
                childId={child.id}
                childName={child.name}
                selectedKeys={selectedKeys}
                busyKeys={busyKeySet}
                claimedKeys={claimedKeys}
                legacyLabels={legacyLabels}
                claimedLegacyLabels={new Set(legacyLabels.filter((l) => claimedKeys.has(`${child.id}|${l}`)))}
                onToggleKey={toggleKey}
                onSetKeys={setKeys}
                onRemoveLegacy={removeLegacyLabel}
              />
            );
          })}
        </div>
      </section>

      <CalendarImportCard
        busyState={busyState}
        setBusyState={setBusyState}
        kidAvailability={kidAvailability}
        setKidAvailability={setKidAvailability}
        childProfiles={childProfiles}
      />

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Step 2 · invite the other parent</p>
        <h3 className="mt-2 text-2xl font-black">Create a playdate invite</h3>
        <p className="mt-1 text-sm font-semibold text-[#4f625b]">
          {openSelections.length > 0
            ? `${openSelections.length} open time${openSelections.length === 1 ? "" : "s"} will go on the invite.`
            : "Select free times in Step 1 — they'll go on the invite."}
        </p>
        <label className="mt-3 block max-w-sm">
          <span className="text-sm font-black">Your first name (shown to the other parent)</span>
          <input
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="e.g. Naveen"
            maxLength={40}
            className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#ded8c7] bg-white px-3 py-2 text-sm font-bold"
          />
        </label>
        {createError && (
          <p className="mt-2 max-w-sm rounded-lg bg-[#fdeee4] p-3 text-sm font-bold text-[#b3541e]">{createError}</p>
        )}
        <button
          onClick={createInvite}
          disabled={openSelections.length === 0}
          className="tt-btn-press mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
        >
          Create playdate invite
        </button>
        <p className="mt-2 text-xs font-semibold text-[#4f625b]">
          The link opens a claim page for the other parent — first names and time windows only. No addresses, no kid
          last names, no contact details. Share it with 2–3 parents: the first to accept books the time, and it
          becomes unavailable to everyone else.
        </p>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">🔔 Notifications</p>
            <h3 className="mt-2 text-2xl font-black">
              Playdate updates{" "}
              {unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-[#2563eb] px-2.5 py-0.5 align-middle text-xs font-black text-white">
                  {unreadCount} new
                </span>
              )}
            </h3>
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="tt-btn-press min-h-9 rounded-lg border-2 border-[#ded8c7] bg-white px-3 py-1 text-xs font-black text-[#4f625b]"
            >
              Mark all read
            </button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
            Nothing yet. When another parent claims one of your invites you&apos;ll be notified here the moment it
            happens — and they get a confirmation receipt on their side too.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`rounded-lg p-3 ring-1 ${n.read ? "bg-[#faf8f0] ring-[#ded8c7]" : "bg-[#f4f7ff] ring-[#2563eb]/40"}`}
              >
                <p className="text-sm font-black text-[#17231f]">
                  {!n.read && <span className="mr-1.5 inline-block size-2 rounded-full bg-[#2563eb]" aria-label="unread" />}
                  {n.title}
                </p>
                <p className="mt-0.5 text-sm font-semibold leading-6 text-[#4f625b]">{n.body}</p>
                <p className="mt-1 text-[11px] font-bold text-[#a09a8c]">{formatClaimedAt(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invites.length > 0 && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Your invites</p>
          <h3 className="mt-2 text-2xl font-black">Share &amp; track</h3>
          <div className="mt-3 grid gap-3">
            {invites.map((invite) => {
              const url = playdateClaimUrl(invite.id);
              const claimedSlot = invite.slots.find((s) => s.status === "claimed");
              const isNew = justCreatedId === invite.id;
              return (
                <div key={invite.id} className={`rounded-lg border-2 p-4 ${isNew ? "border-[#2563eb] bg-[#f4f7ff]" : "border-[#ded8c7] bg-[#faf8f0]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black">
                      Invite · {invite.slots.length} time{invite.slots.length === 1 ? "" : "s"}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${invite.status === "booked" ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#eef2ff] text-[#2563eb]"}`}>
                        {invite.status === "booked" ? "Booked" : "Open"}
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-[#a09a8c]">{formatClaimedAt(invite.createdAt)} created</p>
                  </div>
                  {invite.status === "booked" && claimedSlot && (
                    <p className="mt-2 rounded-lg bg-[#e7f4ef] p-3 text-sm font-bold text-[#165a4b]">
                      ✅ {invite.claimedBy} claimed {claimedSlot.slot} for {claimedSlot.childName}
                      {invite.claimedAt ? ` · ${formatClaimedAt(invite.claimedAt)}` : ""}
                    </p>
                  )}
                  {invite.status === "open" && (
                    <>
                      <p className="mt-2 break-all rounded-lg bg-white p-3 text-sm font-black text-[#17231f] ring-1 ring-[#ded8c7]">{url}</p>
                      <button
                        onClick={() => copyInviteLink(invite)}
                        className="tt-btn-press mt-2 min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
                      >
                        {linkCopiedId === invite.id ? "Copied! Send it to the other parent ✓" : "Copy invite link"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {latestClaim && latestClaimedSlot && (
        <section className="rounded-lg border-2 border-[#165a4b] bg-[#e7f4ef] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Latest confirmation</p>
          <h3 className="mt-2 text-2xl font-black">
            ✅ {latestClaim.claimedBy} claimed {latestClaimedSlot.slot} for {latestClaimedSlot.childName}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#4f625b]">
            {latestClaim.claimedAt ? `Confirmed ${formatClaimedAt(latestClaim.claimedAt)}. ` : ""}
            That time is now closed everywhere — it can&apos;t be double-booked. Reach out parent-to-parent to
            coordinate pickup; kids don&apos;t see this thread.
          </p>
        </section>
      )}
    </section>
  );
}
/**
 * Feedback R2 — AI Buddy daily content: stable 32-bit seed from the local
 * calendar day (localDayKey) so the featured pet and the daily question /
 * mission / encouragement rotate once per day — deterministically per pet per
 * day — rather than per render.
 */
function hashDayKey(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (Math.imul(hash, 31) + dayKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Feedback R2 — AI Buddy guardrails: kids-related knowledge only. The Buddy
 * is chip-based Q&A (never open chat), and anything returned by the
 * parent-side AI endpoint is screened before it can become a chip label:
 * plain kid-safe text only — no links, emails, phone numbers, or essays.
 * Kid PII is never sent to the endpoint (species, counts, age band only).
 */
const BUDDY_GUARDRAIL_NOTE =
  "Safe topics only: pets, kindness, chores, saving, and growing up. The Buddy answers picked questions — there is no open chat.";

function isBuddySafeIdea(label: string): boolean {
  const text = label.trim();
  if (text.length === 0 || text.length > 140) return false;
  if (/https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w-]+/.test(text)) return false;
  if (/(^|\D)\+?\d[\d\s().-]{7,}\d/.test(text)) return false;
  return true;
}

function KidAiBuddyPanel({
  activeChild,
  pets,
  childProfiles,
  socialPracticeDone,
  onAnswerSocialScenario,
  scheduleItems,
  onHelperUse,
  aiBuddyCategories,
  aiBuddyDailyRotate,
  aiDailyBoost,
  parentQuestions,
  socialOverride,
}: {
  activeChild?: Child;
  pets: Pet[];
  childProfiles: Child[];
  socialPracticeDone: Record<string, string[]>;
  onAnswerSocialScenario: (childId: string, scenarioId: string) => void;
  scheduleItems: KidScheduleItem[];
  onHelperUse: (topic: string) => void;
  aiBuddyCategories: string[];
  aiBuddyDailyRotate: boolean;
  /** Today's parent-fetched AI boost, or null when signed out/offline — then
   *  the local date-rotation fallback renders instead. */
  aiDailyBoost?: CachedDailyBoost | null;
  /** Feedback R2: parent-authored questions that surface as buddy chips. */
  parentQuestions?: BuddyParentQuestion[];
  /** Feedback R2: parent override of the safe-social heading + content. */
  socialOverride?: SocialPracticeOverride | null;
}) {
  const dayKey = localDayKey();
  // Feedback R2: the featured pet rotates daily across the family's ACTUAL
  // pets — buddy content changes every day, per pet per day. No pets on file
  // falls back to the pet-neutral "your pet" phrasing below.
  const daySeed = hashDayKey(dayKey);
  const petOfDay = pets.length > 0 ? pets[daySeed % pets.length] : undefined;
  const petName = petOfDay?.name ?? "your pet";
  const petKind = petOfDay?.species ? ` the ${petOfDay.species.toLowerCase()}` : "";
  const childName = activeChild?.name ?? "Kid";
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [aiChipLabels, setAiChipLabels] = useState<string[] | null>(null);
  // Predefined question suggestions generated from family data: (a) the pets
  // the family onboarded, (b) non-pet topics, (c) the kid's interests from
  // hobby schedule items, (d) classes from school schedule items.
  const localChips = buildBuddyQuestionChips({ pets, scheduleItems, childId: activeChild?.id, childName, dayKey });
  // AI path: the parent-side /api/ai/ideas endpoint may craft question ideas
  // from non-identifying context only (species, counts, age band) — never kid
  // PII, and only with a parent session. Unreachable from the kid view, so the
  // local builder above is the graceful fallback that always works.
  // GUARDRAIL (Feedback R2): every returned idea is screened by
  // isBuddySafeIdea before it can become a chip — kids-related plain text
  // only, no links/contacts, and it still becomes a predefined chip (no open
  // chat), gated against the parent's aiBuddyCategories below.
  useEffect(() => {
    let cancelled = false;
    const ageBand = !activeChild ? "7-9" : activeChild.age <= 6 ? "4-6" : activeChild.age <= 9 ? "7-9" : "10-12";
    fetch("/api/ai/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        // NOTE: must be one of IDEA_LIFE_SKILLS in lib/ai/ideas.ts
        // ("responsibility" | "empathy" | "teamwork" | "leadership" | "time").
        lifeSkill: "responsibility",
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
          ? data.ideas.filter((item): item is string => typeof item === "string" && isBuddySafeIdea(item))
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
  // Feedback R2: parent-authored questions surface FIRST as buddy chips
  // (they follow the same category gating as built-in chips, below).
  const parentChips = parentQuestionChips(parentQuestions);
  const chips: BuddyChip[] = [
    ...parentChips,
    ...(aiChipLabels
      ? aiChipLabels.map((label, index) => ({
          id: `ai-${index}`,
          label,
          answerTitle: "Great question to explore!",
          answerBody: `Talk through "${label}" with a parent — wondering together is where the learning happens.`,
          category: "Pet care",
        }))
      : localChips),
  ].slice(0, 8);
  // Parent setting: only show question categories the parent allowed.
  const visibleChips = chips.filter((chip) => aiBuddyCategories.includes(chip.category));
  const kidQuestions: [string, string][] = visibleChips.map((chip) => [chip.id, chip.label]);
  const chipAnswers: Record<string, { title: string; body: string }> = {};
  for (const chip of visibleChips) chipAnswers[chip.id] = { title: chip.answerTitle, body: chip.answerBody };
  const aiSuggestion =
    (selectedQuestion ? chipAnswers[selectedQuestion] : undefined) ??
    chipAnswers[visibleChips[0]?.id ?? ""] ?? { title: "Ask away!", body: "Pick a question above to get a helpful answer." };
  // One suggested question per day, shown as the primary action.
  const suggestedQuestion = kidQuestions[new Date().getDate() % Math.max(1, kidQuestions.length)];
  const askQuestion = (id: string, label: string) => {
    setSelectedQuestion(id);
    onHelperUse(label);
    document.getElementById("ai-buddy-answer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const askSuggested = () => {
    if (!suggestedQuestion) return;
    askQuestion(suggestedQuestion[0], suggestedQuestion[1]);
  };
  // Daily buddy boost: when a parent is signed in, today's genuinely
  // AI-generated boost (parent-side fetch, cached per day) renders here —
  // each item only if its category is in the parent's allowed list. Signed
  // out / offline / on failure, the honest local date-rotation fallback
  // renders instead. The kid only ever sees predefined content: no open chat.
  const aiBoostForToday =
    aiDailyBoost && aiDailyBoost.date === todayLocalDateKey() ? aiDailyBoost : null;
  // Feedback R2: rotation is driven by the day seed (localDayKey), so the
  // question/mission/encouragement change together with the featured pet.
  const dayIndex = aiBuddyDailyRotate ? daySeed : 0;
  const dailyQuestions = [
    `What is one thing ${petName}${petKind} did today that made you smile?`,
    petOfDay
      ? `If ${petName} could talk, what would they thank you for this week?`
      : "If you had a pet, what is the first kind thing you would do for it?",
    "What is the kindest thing you did today — big or tiny?",
    "What chore felt easiest today, and what made it easy?",
    "What is one thing you want to get better at this week?",
    "Who helped you today, and how could you thank them?",
    "What are you most proud of doing by yourself lately?",
  ];
  const dailyMissions = [
    petOfDay
      ? `Give ${petName} a 10-second calm check: food, water, cozy spot.`
      : "Do a 10-second calm check of your room: one thing to tidy, one thing to put away.",
    "Tidy one shared space without being asked — then tell a parent.",
    "Teach someone one thing you learned this week.",
    petOfDay
      ? `Draw ${petName}'s dream home and label three things it needs.`
      : "Draw your dream pet's home and label three things it would need.",
    "Do a 2-minute kindness sprint: thank, help, or tidy.",
    petOfDay
      ? `Watch ${petName} quietly for ten seconds. Tell a parent one thing you noticed.`
      : "Watch the sky or trees quietly for ten seconds. Tell a parent one thing you noticed.",
    "Put one coin or dollar toward your savings goal today.",
  ];
  const dailyEncouragements = [
    "Small care done every day becomes a big, kind habit. 🌱",
    "Responsible kids aren't born — they're built one mission at a time. 💪",
    "You don't have to be perfect. You just have to keep going. 🌟",
    "Kindness counts even when nobody's watching. 💛",
    "Every \u2018I did it myself\u2019 makes the next one easier. 🚀",
    "Grown-ups notice your effort, even on the quiet days. 👀",
    "You're becoming someone people can count on. That's huge. 🏆",
  ];
  const dailyQuestion =
    gatedBoostSlot(aiBoostForToday, aiBuddyCategories, "question") ??
    dailyQuestions[dayIndex % dailyQuestions.length];
  const dailyMission =
    gatedBoostSlot(aiBoostForToday, aiBuddyCategories, "mission") ??
    dailyMissions[dayIndex % dailyMissions.length];
  const dailyEncouragement =
    gatedBoostSlot(aiBoostForToday, aiBuddyCategories, "encouragement") ??
    dailyEncouragements[dayIndex % dailyEncouragements.length];
  const boostIsAiGenerated = aiBoostForToday !== null;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Kid-safe AI buddy</p>
        <h2 className="mt-2 text-3xl font-black">Your AI Buddy has answers ✨</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          One safe question, one helpful answer — {activeChild?.name ?? "kiddo"} picks the question, the helper does the rest.
        </p>
        <p className="mt-2 max-w-2xl text-xs font-bold leading-5 text-[#165a4b]">🛡️ {BUDDY_GUARDRAIL_NOTE}</p>
        {suggestedQuestion && (
          <button
            onClick={askSuggested}
            className="tt-btn-press mt-4 min-h-14 w-full rounded-xl bg-[#165a4b] px-5 py-3 text-base font-black text-white sm:w-auto"
          >
            {suggestedQuestion[1]} →
          </button>
        )}
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">
          {boostIsAiGenerated ? "✨ AI-generated for today" : "Today's buddy boost"}
        </p>
        <h3 className="mt-2 text-2xl font-black">Today&apos;s buddy boost</h3>
        <div className="mt-4 grid gap-3">
          <article className="rounded-lg bg-[#f4efff] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">Question of the day</p>
            <p className="mt-1 text-base font-black leading-6">{dailyQuestion}</p>
          </article>
          <article className="rounded-lg bg-[#e7f4ef] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Tiny mission</p>
            <p className="mt-1 text-base font-black leading-6">{dailyMission}</p>
          </article>
          <article className="rounded-lg bg-[#fff4d8] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Encouragement</p>
            <p className="mt-1 text-base font-black leading-6">{dailyEncouragement}</p>
          </article>
        </div>
        {!aiBuddyDailyRotate && (
          <p className="mt-2 text-xs font-bold text-[#4f625b]">Daily rotation is off — your parent can turn it on in Family Setup.</p>
        )}
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Suggested for you</p>
        <h3 className="mt-2 text-2xl font-black">Tap a question to try</h3>
        {kidQuestions.length > 0 ? (
          <>
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
          </>
        ) : (
          <p className="mt-3 rounded-lg bg-[#faf8f0] p-4 text-sm font-bold text-[#4f625b]">
            Your parent is choosing which question topics you can explore — check back soon! 💭
          </p>
        )}
      </section>

      <SocialPracticeSection
        childProfiles={childProfiles}
        activeChildId={activeChild?.id}
        onSelectChild={undefined}
        done={socialPracticeDone}
        onAnswer={onAnswerSocialScenario}
        headingOverride={socialOverride?.heading}
        introOverride={socialOverride?.intro}
        overrideScenarios={
          socialOverride && socialOverride.scenarios.length > 0 ? socialOverride.scenarios : undefined
        }
      />
    </section>
  );
}

type BuddyChip = { id: string; label: string; answerTitle: string; answerBody: string; category: string };

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
  /** Local YYYY-MM-DD — rotates which of the family's pets get chips each day. */
  dayKey?: string;
}): BuddyChip[] {
  const { pets, scheduleItems, childId, childName, dayKey } = args;
  const chips: BuddyChip[] = [];
  // (a) pets the family onboarded — rotated daily (Feedback R2) so every pet
  // gets featured in turn; with no pets the non-pet topics below are the
  // sensible default.
  const petOffset = dayKey && pets.length > 0 ? hashDayKey(dayKey) % pets.length : 0;
  const orderedPets = [...pets.slice(petOffset), ...pets.slice(0, petOffset)];
  for (const item of orderedPets.slice(0, 2)) {
    chips.push({
      id: `pet-${item.id}`,
      label: `How can I help ${item.name} today?`,
      answerTitle: `${childName}, give ${item.name} a calm care check.`,
      answerBody: `Look at ${item.name}'s food, water, comfort, and space. Pick one small thing to improve, then ask a parent to review it with you.`,
      category: "Pet care",
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
      category: "Chores & routine",
    });
  }
  // (d) classes in their schedule.
  for (const item of kidItems.filter((entry) => entry.kind === "school").slice(0, 1)) {
    chips.push({
      id: `class-${item.id}`,
      label: `Make "${item.title}" more fun?`,
      answerTitle: `Turn "${item.title}" into a game.`,
      answerBody: `${item.note} Try teaching it back to a parent in your own words — explaining is the fastest way to learn it.`,
      category: "Chores & routine",
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
      category: "Kindness & feelings",
    },
    {
      id: "topic-hobby",
      label: "Suggest a screen-free hobby idea.",
      answerTitle: "Unplug and make something.",
      answerBody:
        "Build a paper maze, draw your pet's dream home, or start a 5-minute observation journal. Screen-free making builds patience and focus.",
      category: "Chores & routine",
    },
    {
      id: "topic-calm",
      label: "How can I practice patience today?",
      answerTitle: "Patience is a superpower.",
      answerBody:
        "Pick one slow thing today: watch your pet for ten quiet seconds, wait your turn without reminders, or finish a puzzle without rushing. Notice how it feels.",
      category: "Kindness & feelings",
    },
    {
      id: "topic-money",
      label: "How can I save up for something I want?",
      answerTitle: "Saving is a superpower too.",
      answerBody:
        "Pick one goal in your Kid Bank, then put a little toward it every time you earn. Watching the bar grow is the fun part — ask a parent to show you your points-to-dollars rate.",
      category: "Money & saving",
    },
  ];
  for (const topic of fallbackTopics) {
    if (chips.length >= 6) break;
    chips.push(topic);
  }
  return chips.slice(0, 6);
}

/**
 * Feedback R2: parent-authored questions become buddy chips. The parent wrote
 * them, so they are parent-approved by construction — still trimmed and capped
 * like every other chip, and gated against the parent's aiBuddyCategories at
 * render time in KidAiBuddyPanel.
 */
function parentQuestionChips(questions: BuddyParentQuestion[] | undefined): BuddyChip[] {
  if (!questions) return [];
  return questions
    .filter((item) => item.question.trim().length > 0 && item.answerBody.trim().length > 0)
    .slice(0, 3)
    .map((item) => ({
      id: `parent-q-${item.id}`,
      label: item.question.trim().slice(0, 140),
      answerTitle: item.answerTitle.trim() || "Picked by your parent!",
      answerBody: item.answerBody.trim(),
      category: item.category,
    }));
}

/**
 * Feedback R2 — parent-only sub-panel: parents set custom questions to track
 * from their parent profile, and the questions surface in the kid's AI Buddy
 * as predefined chips (no open chat). Rendered on the parent-only AI tab —
 * never in the kid view.
 */
function BuddyParentQuestionsEditor({
  questions,
  onChange,
  categories,
}: {
  questions: BuddyParentQuestion[];
  onChange: (next: BuddyParentQuestion[]) => void;
  categories: string[];
}) {
  const [draft, setDraft] = useState({ question: "", category: categories[0] ?? "Pet care", answerTitle: "", answerBody: "" });
  const canAdd = draft.question.trim().length > 0 && draft.answerBody.trim().length > 0;
  const addQuestion = () => {
    if (!canAdd) return;
    const next: BuddyParentQuestion = {
      id: `pq-${Date.now()}`,
      question: draft.question.trim().slice(0, 140),
      answerTitle: draft.answerTitle.trim().slice(0, 80),
      answerBody: draft.answerBody.trim().slice(0, 500),
      category: categories.includes(draft.category) ? draft.category : (categories[0] ?? "Pet care"),
      createdAt: new Date().toISOString(),
    };
    onChange([...questions, next]);
    setDraft({ question: "", category: categories[0] ?? "Pet care", answerTitle: "", answerBody: "" });
  };
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Parent only · AI Buddy</p>
      <h3 className="mt-2 text-2xl font-black">Questions you want your kid to explore</h3>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        Add a question and the answer you&apos;d like the Buddy to give. It appears in your kid&apos;s AI Buddy as a
        predefined question — no open chat — and follows the same topic filters as the built-in questions. When your
        kid asks it, the moment is logged in the activity feed so you can track it.
      </p>
      {questions.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {questions.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#f4efff] p-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#17231f]">{item.question}</p>
                <p className="mt-1 text-xs font-bold text-[#6d3ed1]">
                  {item.category} · {item.answerTitle || "Picked by your parent!"}
                </p>
              </div>
              <button
                onClick={() => onChange(questions.filter((entry) => entry.id !== item.id))}
                className="min-h-10 shrink-0 rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-xs font-black text-[#7a4b12]"
                aria-label={`Remove question: ${item.question}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid gap-3 rounded-lg bg-[#faf8f0] p-4">
        <label className="block text-sm font-black text-[#17231f]">
          Question for the Buddy
          <input
            value={draft.question}
            onChange={(event) => setDraft({ ...draft, question: event.target.value })}
            maxLength={140}
            placeholder="e.g. What should I do when Jack seems bored?"
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-black text-[#17231f]">
            Topic
            <select
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-black text-[#17231f]">
            Answer headline (optional)
            <input
              value={draft.answerTitle}
              onChange={(event) => setDraft({ ...draft, answerTitle: event.target.value })}
              maxLength={80}
              placeholder="Picked by your parent!"
              className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            />
          </label>
        </div>
        <label className="block text-sm font-black text-[#17231f]">
          The answer the Buddy gives
          <textarea
            value={draft.answerBody}
            onChange={(event) => setDraft({ ...draft, answerBody: event.target.value })}
            maxLength={500}
            rows={3}
            placeholder="Write the guidance you'd give — the Buddy shows it when your kid taps the question."
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
          />
        </label>
        <button
          onClick={addQuestion}
          disabled={!canAdd}
          className="min-h-11 justify-self-start rounded-lg bg-[#6d3ed1] px-5 py-2 text-sm font-black text-white disabled:opacity-40"
        >
          Add to my kid&apos;s Buddy
        </button>
      </div>
    </section>
  );
}

function ChildProfileDropdown({
  activeChild,
  childProfiles,
  requestChildSwitch,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  requestChildSwitch: (childId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const activeLook = getChildLook(activeChild?.id);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleSwitch(childId: string) {
    requestChildSwitch(childId);
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Switch kid profile, currently ${activeChild?.name ?? "no kid selected"}`}
        aria-expanded={isOpen}
        className="flex min-h-11 items-center gap-2 rounded-full border border-[#ded8c7] bg-white py-1 pl-1 pr-3 text-xs font-black text-[#17231f] shadow-sm"
      >
        <ProfilePhoto
          label={activeChild?.name ?? "Kid"}
          initial={activeLook.initial}
          colors={activeLook.colors}
          size="xs"
          variant="kid"
          hair={activeLook.hair}
          photoUrl={activeChild?.photoUrl}
        />
        <span className="max-w-20 truncate">{activeChild?.name ?? "Kid"}</span>
        <span aria-hidden="true" className={`text-[10px] transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[#ded8c7] bg-white shadow-lg">
          <p className="border-b border-[#ded8c7] bg-[#fff4d8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7a4b12]">
            Who is using TailTots?
          </p>
          <div className="max-h-64 overflow-y-auto p-2">
            {childProfiles.map((child) => {
              const look = getChildLook(child.id);
              const isActive = child.id === activeChild?.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => handleSwitch(child.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-black ${
                    isActive ? "bg-[#e7f4ef] text-[#165a4b]" : "text-[#17231f] hover:bg-[#faf8f0]"
                  }`}
                >
                  <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
                  <span className="min-w-0 flex-1 truncate">{child.name}</span>
                  {isActive && <span aria-hidden="true" className="text-[#165a4b]">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Hero({
  child,
  childProfiles,
  setActiveChildId,
  pendingCount,
  taskProgress,
  approvedMissionCount,
  setActiveTab,
  role,
}: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  pendingCount: number;
  taskProgress: number;
  approvedMissionCount: number;
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
            {role === "parent" && (
              <div className="mt-4 grid gap-3">
                <Meter label="Loving the app" value={childLook.love} color="#6d3ed1" />
                <Meter label="Happiness today" value={childLook.joy} color="#165a4b" />
              </div>
            )}
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

/**
 * Feedback R2 (kid In Today): the old chore-vs-pet-work differentiation (pet
 * photo + name vs. a "Chore" label) is gone from the mission list. The only
 * context tag that remains is for neighborhood/school tasks, which are the
 * missions created from neighborhood jobs and community drives
 * (`category: "community"`).
 */
function isNeighborhoodSchoolMission(mission: Mission): boolean {
  return mission.category === "community";
}

const MISSION_CATEGORY_VISUAL: Record<Mission["category"], { emoji: string; bg: string }> = {
  pet_care: { emoji: "🐾", bg: "bg-[#e7f4ef]" },
  chore: { emoji: "🧹", bg: "bg-[#fff4d8]" },
  kindness: { emoji: "💛", bg: "bg-[#ffe4e6]" },
  money: { emoji: "💰", bg: "bg-[#dcfce7]" },
  community: { emoji: "🤝", bg: "bg-[#e0f2fe]" },
};

/**
 * Mission card thumbnail: the linked pet's photo for pet missions
 * (falls back to the illustrated pet character), otherwise a category
 * emoji tile. No external images, no API calls.
 */
function MissionThumb({
  mission,
  pet,
  size = "md",
}: {
  mission: Pick<Mission, "category" | "title">;
  pet?: Pet;
  size?: "sm" | "md";
}) {
  if (pet) {
    const look = getPetLook(pet.id, pet);
    return (
      <ProfilePhoto
        label={pet.name}
        initial={look.face}
        colors={look.colors}
        size={size === "sm" ? "xs" : "md"}
        variant="pet"
        petKind={look.kind}
        photoUrl={pet.photoUrl}
      />
    );
  }
  const visual = MISSION_CATEGORY_VISUAL[mission.category] ?? MISSION_CATEGORY_VISUAL.chore;
  return (
    <div
      aria-hidden="true"
      title={mission.title}
      className={`grid shrink-0 place-items-center rounded-2xl ${visual.bg} ring-1 ring-black/5 ${
        size === "sm" ? "size-12 text-2xl" : "size-16 text-3xl"
      }`}
    >
      <span>{visual.emoji}</span>
    </div>
  );
}

function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  allChildren: Child[];
  badges: BadgeAward[];
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
      {!isKidView && props.activeChild && (
        <div className="mt-4 rounded-lg border border-[#ded8c7] bg-[#f0edff] p-4" aria-label="Character progress">
          <p className="text-sm font-black text-[#17231f]">🦸 Character journey</p>
          <p className="mt-1 text-xs font-bold text-[#4f625b]">
            {props.activeChild.name}&apos;s character track — grown-ups only, never shown to kids. Approve every mission in a level to award a star.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {getChildCurriculumSummary(props.activeChild.id, props.missions, props.badges).map((entry) => (
              <div key={entry.traitKey} className="rounded-lg bg-white p-3 text-center">
                <p className="text-2xl" aria-hidden="true">{entry.emoji}</p>
                <p className="mt-1 text-xs font-black">{entry.label}</p>
                <p className="mt-1 text-sm tracking-widest" aria-label={`${entry.levelsDone} of 3 ${entry.label} levels complete`}>
                  {entry.levels.map((levelEntry) => (
                    <span key={levelEntry.levelIndex} className={levelEntry.done ? "text-[#6d3ed1]" : "text-[#c9c2b2]"}>
                      {levelEntry.done ? "★" : "☆"}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div id="today-mission-list" className="mt-5 grid gap-3 scroll-mt-24">
        {props.missions.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] p-6 text-center">
            <p className="text-lg font-black text-[#0d3b30]">No missions yet 🐾</p>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-[#4f625b]">
              {isKidView
                ? "Your first mission is the start of the adventure — ask a grown-up to add one, or try the demo missions above!"
                : "Add the first mission so your kid has something to care for today — pet care, chores, or kindness."}
            </p>
            {isKidView && (
              <p className="mt-3 text-sm font-black text-[#165a4b]">Ask a grown-up to add your first one →</p>
            )}
          </div>
        )}
        {props.missions.map((mission) => {
          const skill = getMissionLifeSkill(mission);
          const pet = props.pets.find((item) => item.id === mission.petId);
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
                    <div className="flex items-center gap-3">
                      <MissionThumb mission={mission} pet={pet} />
                      <h3 className="text-xl font-black">{mission.title}</h3>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#4f625b]">{mission.question}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-black text-[#4f625b]">
                      {isNeighborhoodSchoolMission(mission) && (
                        <>
                          <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-black">Neighborhood</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span>+{mission.points} pts</span>
                      {curriculumMissionLabel(mission) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#6d3ed1]">{curriculumMissionLabel(mission)}</span>
                        </>
                      )}
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
                  {isNeighborhoodSchoolMission(mission) && (
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black">Neighborhood</span>
                  )}
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                    {mission.allowanceDollars ? `+$${mission.allowanceDollars}` : "No dollars"}
                  </span>
                  <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6d3ed1]">
                    {getLifeSkillLabel(skill)}
                  </span>
                  {curriculumMissionLabel(mission) && (
                    <span className="rounded-full bg-[#6d3ed1] px-3 py-1 text-xs font-black text-white">
                      {curriculumMissionLabel(mission)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <MissionThumb mission={mission} pet={pet} />
                  <h3 className="text-xl font-black">{mission.title}</h3>
                </div>
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

/**
 * R2-21: ONE unified passport design for kids and parents — the header, pet
 * medallion, care meters, and fact grid render identically in both views.
 * The single justified parent-only action is editing a passport's care
 * fields (vet, medicine, routines): kids see the same passport, read-only.
 */
function PassportPanel({ pets, missions, allowEditing, updatePet, updatePetPhoto, onStudyComplete, studiedAnimals }: {
  pets: Pet[];
  missions: Mission[];
  /** Parent-only: editing vet/medicine/care fields. Kids see the same passport, read-only. */
  allowEditing?: boolean;
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
            {allowEditing && (
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
          {allowEditing && editingPetId === pet.id ? (
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

/* ==================================================================
 * Kid Bank — jar-metaphor redesign (Feedback R2).
 *
 * Three jars — SAVE / SPEND / GIVE — with animated blue-liquid fills.
 * The decided flow: parent approves a completed job → dollars AUTO-CREDIT
 * as an approved "earn" transaction → the KID chooses which jar it goes
 * into, instantly, with NO second parent approval. Parents set the
 * points-to-dollar rate and guardrails UPFRONT (ParentProfile.bankSettings).
 *
 * Data model: unchanged BankTransaction / SavingsGoal shapes. Kid jar moves
 * are approved transactions (save/spend/give); the kid's own undo is a
 * negative-amount reversal with the same goalId, so goal progress stays
 * exact. Legacy pending save/give requests still work through the
 * Approvals panel — migrate, don't break.
 * ================================================================== */

type JarVisual = {
  key: KidJarKey;
  emoji: string;
  label: string;
  caption: string;
  liquidFrom: string;
  liquidTo: string;
};

const JAR_VISUALS: JarVisual[] = [
  {
    key: "save",
    emoji: "🏦",
    label: "SAVE jar",
    caption: "For your goals — toys, treats, big dreams!",
    liquidFrom: "#7dd3fc",
    liquidTo: "#2563eb",
  },
  {
    key: "spend",
    emoji: "🛍️",
    label: "SPEND jar",
    caption: "Money you can spend with your family.",
    liquidFrom: "#6ee7b7",
    liquidTo: "#059669",
  },
  {
    key: "give",
    emoji: "💛",
    label: "GIVE jar",
    caption: "Money helping others feel happy.",
    liquidFrom: "#fcd34d",
    liquidTo: "#f59e0b",
  },
];

const JAR_KEY_TO_VISUAL: Record<KidJarKey, JarVisual> = {
  save: JAR_VISUALS[0],
  spend: JAR_VISUALS[1],
  give: JAR_VISUALS[2],
};

function JarMeter({
  visual,
  balance,
  scale,
  ring,
}: {
  visual: JarVisual;
  balance: number;
  scale: number;
  ring?: ReactNode;
}) {
  const pct = jarFillPercent(balance, scale);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-3xl font-black text-[#17231f]">${balance}</p>
      <div className="relative mt-2">
        <div className="relative mx-auto h-48 w-32 overflow-hidden rounded-b-[2.5rem] rounded-t-[1rem] border-4 border-[#aec6dc] bg-[#eef5fb] shadow-[inset_0_2px_8px_rgba(23,35,31,0.12)]">
          {/* blue liquid */}
          <div
            className="absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
            style={{ height: `${pct}%` }}
            aria-hidden="true"
          >
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${visual.liquidTo}, ${visual.liquidFrom})` }}
            />
            <svg className="absolute -top-3 left-0 h-4 w-full" viewBox="0 0 100 12" preserveAspectRatio="none">
              <path d="M0 6 Q 12.5 0, 25 6 T 50 6 T 75 6 T 100 6 L100 12 L0 12 Z" fill={visual.liquidFrom} />
            </svg>
            {pct > 25 && <span className="absolute left-1/4 top-1/4 h-2 w-2 rounded-full bg-white/50" />}
            {pct > 45 && <span className="absolute right-1/4 top-1/2 h-1.5 w-1.5 rounded-full bg-white/40" />}
            {pct > 65 && <span className="absolute left-1/2 top-2/3 h-1 w-1 rounded-full bg-white/40" />}
          </div>
          {/* jar rim */}
          <div className="absolute inset-x-2 top-1 h-2 rounded-full bg-white/60" aria-hidden="true" />
        </div>
        {ring && <div className="absolute -right-7 -top-3">{ring}</div>}
      </div>
      <p className="mt-3 text-2xl" aria-hidden="true">{visual.emoji}</p>
      <p className="text-lg font-black text-[#17231f]">{visual.label}</p>
      <p className="max-w-40 text-xs font-bold leading-4 text-[#4f625b]">{visual.caption}</p>
    </div>
  );
}

/** Progress ring shown on the GIVE jar for the featured drive; taps scroll to the drive cards. */
function DriveProgressRing({ percent, label }: { percent: number; label: string }) {
  const radius = 15.9155;
  return (
    <a
      href="#kid-bank-drives"
      title={label}
      aria-label={label}
      className="tt-btn-press relative block h-14 w-14 rounded-full bg-white shadow-md ring-2 ring-[#f4b400]"
    >
      <svg viewBox="0 0 42 42" className="h-14 w-14 -rotate-90">
        <circle cx="21" cy="21" r={radius} fill="none" stroke="#f1e8d2" strokeWidth="5" />
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="none"
          stroke="#f4b400"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${Math.round(percent * 100)} 100`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[#7a4b12]">
        {Math.round(percent * 100)}%
      </span>
    </a>
  );
}

/**
 * The kid's money-sorting station: "money you earned → you decide where it goes."
 * Amount chips → tap a jar → (pick a goal/drive for SAVE/GIVE) → confirm.
 * Every move is instant and approved; the parent's guardrails are enforced.
 */
function JarAllocator({
  childName,
  balances,
  settings,
  saveGoals,
  drives,
  transactions,
  onAllocate,
  onUndo,
}: {
  childName: string;
  balances: JarBalances;
  settings: KidBankSettings;
  saveGoals: SavingsGoal[];
  drives: SavingsGoal[];
  transactions: BankTransaction[];
  onAllocate: (category: KidJarKey, amount: number, goalId?: string) => string | null;
  onUndo: (txId: string) => boolean;
}) {
  const maxPerTap = settings.maxSingleJarMove > 0 ? Math.min(balances.unallocated, settings.maxSingleJarMove) : balances.unallocated;
  const [amount, setAmount] = useState(5);
  const [pendingJar, setPendingJar] = useState<KidJarKey | null>(null);
  const [pickedGoalId, setPickedGoalId] = useState("");
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [sessionMoves, setSessionMoves] = useState<string[]>([]);

  const effectiveAmount = Math.max(1, Math.min(amount, Math.max(1, maxPerTap)));
  const pendingVisual = pendingJar ? JAR_KEY_TO_VISUAL[pendingJar] : null;
  const goalChoices = pendingJar === "save" ? saveGoals : pendingJar === "give" ? drives : [];
  const pickedGoal = goalChoices.find((goal) => goal.id === pickedGoalId);

  const startJar = (category: KidJarKey) => {
    setPendingJar(category);
    setPickedGoalId("");
    setBlockReason(null);
    setCelebration(null);
  };

  const confirmMove = () => {
    if (!pendingJar) return;
    const reason = jarMoveGuardrails({
      balances,
      settings,
      request: { category: pendingJar, amount: effectiveAmount, goalId: pickedGoalId || undefined },
    });
    if (reason) {
      setBlockReason(reason);
      return;
    }
    const txId = onAllocate(pendingJar, effectiveAmount, pickedGoalId || undefined);
    if (!txId) {
      setBlockReason("Hmm, that didn't go through — try again!");
      return;
    }
    setSessionMoves((ids) => [txId, ...ids].slice(0, 5));
    setCelebration(
      `🎉 You put $${effectiveAmount} in your ${pendingVisual!.label.toUpperCase()}${pickedGoal ? ` for “${pickedGoal.title}”` : ""}! Great choosing, ${childName}!`,
    );
    setPendingJar(null);
    setPickedGoalId("");
    setBlockReason(null);
  };

  const undoMove = (txId: string) => {
    if (onUndo(txId)) setSessionMoves((ids) => ids.filter((id) => id !== txId));
  };

  if (balances.unallocated <= 0 && sessionMoves.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-[#aec6dc] bg-[#f2f8fd] p-5 text-center">
        <p className="text-lg font-black text-[#17231f]">🫙 Your jars are all sorted!</p>
        <p className="mt-1 text-sm font-bold text-[#4f625b]">
          Finish a parent-approved mission to earn new money, then come back and sort it into jars.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Sort your money</p>
      <h3 className="mt-2 text-2xl font-black text-[#17231f]">
        🪙 ${balances.unallocated} waiting — <span className="text-[#2563eb]">you decide where it goes!</span>
      </h3>

      <p className="mt-4 text-sm font-black text-[#17231f]">1️⃣ How much?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[1, 2, 5].map((choice) => (
          <button
            key={choice}
            onClick={() => { setAmount(choice); setBlockReason(null); }}
            disabled={choice > maxPerTap}
            className={`min-h-12 rounded-lg px-5 py-2 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40 ${
              amount === choice && effectiveAmount !== maxPerTap ? "bg-[#2563eb] text-white" : "border-2 border-[#aec6dc] bg-white text-[#17231f]"
            }`}
          >
            ${choice}
          </button>
        ))}
        <button
          onClick={() => { setAmount(maxPerTap); setBlockReason(null); }}
          disabled={maxPerTap < 1}
          className={`min-h-12 rounded-lg px-5 py-2 text-lg font-black disabled:cursor-not-allowed disabled:opacity-40 ${
            amount === maxPerTap ? "bg-[#2563eb] text-white" : "border-2 border-[#aec6dc] bg-white text-[#17231f]"
          }`}
        >
          All ${maxPerTap}
        </button>
      </div>
      {settings.maxSingleJarMove > 0 && (
        <p className="mt-2 text-xs font-bold text-[#4f625b]">A grown-up set the biggest single move to ${settings.maxSingleJarMove}.</p>
      )}

      <p className="mt-5 text-sm font-black text-[#17231f]">2️⃣ Which jar?</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {JAR_VISUALS.map((visual) => (
          <button
            key={visual.key}
            onClick={() => startJar(visual.key)}
            className={`tt-btn-press min-h-16 rounded-xl border-2 px-2 py-3 text-center ${
              pendingJar === visual.key ? "border-[#17231f] bg-[#17231f] text-white" : "border-[#ded8c7] bg-[#faf8f0] text-[#17231f]"
            }`}
          >
            <span className="block text-2xl" aria-hidden="true">{visual.emoji}</span>
            <span className="block text-sm font-black">{visual.label}</span>
          </button>
        ))}
      </div>

      {pendingJar && (pendingJar === "save" || pendingJar === "give") && (
        <div className="mt-4">
          <p className="text-sm font-black text-[#17231f]">
            {pendingJar === "save" ? "3️⃣ Which goal should it grow?" : "3️⃣ Which kindness drive should it help?"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setPickedGoalId("")}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-black ${
                pickedGoalId === "" ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
              }`}
            >
              {pendingJar === "save" ? "🫙 Just my jar" : "💛 Just kindness"}
            </button>
            {goalChoices.map((goal) => (
              <button
                key={goal.id}
                onClick={() => setPickedGoalId(goal.id)}
                className={`min-h-11 rounded-full px-4 py-2 text-sm font-black ${
                  pickedGoalId === goal.id ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
                }`}
              >
                {goal.title} (${goal.saved}/${goal.target})
              </button>
            ))}
          </div>
          {!goalChoices.length && (
            <p className="mt-2 text-xs font-bold text-[#4f625b]">
              {pendingJar === "save" ? "No goals yet — your money will wait safely in the jar." : "No drives yet — your kindness will wait in the jar."}
            </p>
          )}
        </div>
      )}

      {pendingJar && (
        <div className="mt-4 rounded-lg bg-[#eef5fd] p-4">
          <p className="text-base font-black text-[#17231f]">
            Put ${effectiveAmount} in your {pendingVisual!.label.toUpperCase()}
            {pickedGoal ? ` for “${pickedGoal.title}”?` : "?"}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirmMove}
              className="tt-btn-press min-h-12 flex-1 rounded-lg bg-[#165a4b] px-5 py-3 text-base font-black text-white"
            >
              Yes, do it! 🎉
            </button>
            <button
              onClick={() => { setPendingJar(null); setBlockReason(null); }}
              className="min-h-12 rounded-lg border-2 border-[#ded8c7] bg-white px-5 py-3 text-base font-black text-[#4f625b]"
            >
              Wait
            </button>
          </div>
          {blockReason && <p className="mt-2 text-sm font-bold text-[#7a4b12]">{blockReason}</p>}
        </div>
      )}

      {celebration && (
        <p className="mt-4 rounded-lg bg-[#e7f4ef] p-4 text-center text-base font-black text-[#0d3b30]" role="status">
          {celebration}
        </p>
      )}

      {settings.allowKidUndo && sessionMoves.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#4f625b]">Changed your mind?</p>
          <div className="mt-2 grid gap-2">
            {sessionMoves.map((txId) => {
              const moved = transactions.find((tx) => tx.id === txId);
              if (!moved) return null;
              return (
                <div key={txId} className="flex items-center justify-between gap-3 rounded-lg bg-[#faf8f0] p-3">
                  <p className="text-sm font-bold text-[#4f625b]">{moved.description}</p>
                  <button
                    onClick={() => undoMove(txId)}
                    className="min-h-10 shrink-0 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]"
                  >
                    Undo ↩️
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** A kid's own savings goal card with a friendly progress bar. */
function SaveGoalCard({ goal }: { goal: SavingsGoal }) {
  const percent = Math.min(100, (goal.saved / Math.max(1, goal.target)) * 100);
  return (
    <article className="rounded-lg bg-[#faf8f0] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-black text-[#17231f]">🎯 {goal.title}</p>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#17231f]">${goal.saved}/${goal.target}</span>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-white">
        <div className="h-4 rounded-full bg-[#165a4b] transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm font-bold text-[#4f625b]">
        {goal.completedAt ? "🎉 Goal reached — amazing saving!" : `$${goal.target - goal.saved} left to go — your SAVE jar feeds this!`}
      </p>
    </article>
  );
}

/** A giving-drive card: progress anyone can read at a glance. */
function DriveCard({
  goal,
  transactions,
  childProfiles,
  isParentView,
  onConfirmDonation,
}: {
  goal: SavingsGoal;
  transactions: BankTransaction[];
  childProfiles: Child[];
  isParentView: boolean;
  onConfirmDonation: (goalId: string) => void;
}) {
  const kind = driveKindFromGoal(goal);
  const meta = kind === "save" ? null : DRIVE_KIND_META[kind];
  const percent = driveProgress(goal) * 100;
  const contributions = goalContributions(goal.id, transactions, childProfiles);
  return (
    <article className="rounded-lg bg-[#fff8ef] p-4 ring-1 ring-[#f4b400]/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-[#17231f]">{meta?.emoji ?? "💛"} {goal.title}</p>
          {meta && (
            <p className="mt-1 inline-block rounded-full bg-[#ffe9a8] px-2 py-0.5 text-xs font-black text-[#7a4b12]">{meta.label}</p>
          )}
          {goal.causeNote && meta && goal.causeNote !== meta.causeNote && (
            <p className="mt-1 text-xs font-bold text-[#69736f]">{goal.causeNote}</p>
          )}
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#17231f]">${goal.saved}/${goal.target}</span>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-white">
        <div className="h-4 rounded-full bg-[#f4b400] transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm font-bold text-[#4f625b]">
        {goal.donationConfirmedAt
          ? "🎉 Donated — thank you for the real-world kindness!"
          : goal.completedAt
            ? "Goal reached! Waiting for a grown-up to make the real donation."
            : `$${goal.target - goal.saved} left — your GIVE jar feeds this drive!`}
      </p>
      {goal.seededByParent ? (
        <p className="mt-1 text-xs font-bold text-[#69736f]">Grown-ups started it with ${goal.seededByParent} 🌱</p>
      ) : null}
      {contributions.length > 0 && (
        <p className="mt-1 text-xs font-bold text-[#69736f]">
          {contributions.map((entry) => `${entry.name} gave $${entry.amount}`).join(" · ")}
        </p>
      )}
      {goal.completedAt && !goal.donationConfirmedAt && isParentView && (
        <button
          onClick={() => onConfirmDonation(goal.id)}
          className="tt-btn-press mt-3 min-h-11 w-full rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white"
        >
          Confirm: we donated ${goal.target} ✓
        </button>
      )}
    </article>
  );
}

/**
 * Drive progress strip for OTHER tabs (the neighborhood stream renders this).
 * Pure presentational: goals in, drive cards out. No hooks, no side effects.
 */
export function DriveProgressMini({
  goals,
  childId,
  title = "💛 Kindness drives",
  maxItems = 3,
}: {
  goals: SavingsGoal[];
  childId?: string;
  title?: string;
  maxItems?: number;
}) {
  const drives = goals
    .filter(
      (goal) =>
        goal.type === "donation" &&
        goal.visibleToKids !== false &&
        (!childId || goal.childId === childId || goal.sharedWithTrustedFamilies),
    )
    .sort((a, b) => driveProgress(b) - driveProgress(a))
    .slice(0, Math.max(1, maxItems));
  if (!drives.length) return null;
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm" aria-label={title}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b400]">{title}</p>
      <div className="mt-3 grid gap-2">
        {drives.map((goal) => {
          const kind = driveKindFromGoal(goal);
          const emoji = kind === "save" ? "💛" : DRIVE_KIND_META[kind].emoji;
          const percent = driveProgress(goal) * 100;
          return (
            <div key={goal.id} className="rounded-lg bg-[#fff8ef] p-3 ring-1 ring-[#f4b400]/30">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-black text-[#17231f]">{emoji} {goal.title}</p>
                <p className="shrink-0 text-xs font-black text-[#7a4b12]">${goal.saved}/${goal.target}</p>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                <div className="h-2.5 rounded-full bg-[#f4b400]" style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Parent-only: the upfront rules. Set once → kids move their own money. */
function BankSettingsPanel({
  pointsPerDollar,
  setPointsPerDollar,
  settings,
  onSettingsChange,
}: {
  pointsPerDollar: number;
  setPointsPerDollar: (value: number) => void;
  settings: KidBankSettings;
  onSettingsChange: (settings: KidBankSettings) => void;
}) {
  const numberField =
    "mt-1 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-lg font-semibold text-[#17231f]";
  return (
    <div className="rounded-lg border-2 border-[#17231f] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#17231f]">🔒 Grown-up controls</p>
      <h3 className="mt-2 text-2xl font-black text-[#17231f]">Kid Bank rules</h3>
      <p className="mt-1 text-sm font-bold leading-6 text-[#4f625b]">
        Set these once. After that, your kids sort their own earnings into jars — no asking, no per-move approval.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-black text-[#17231f]">
          Points for $1
          <input
            className={numberField}
            inputMode="numeric"
            value={pointsPerDollar}
            onChange={(event) => setPointsPerDollar(Math.max(1, Number(event.target.value) || 20))}
          />
          <span className="mt-1 block text-xs font-bold text-[#4f625b]">Kids turn points into dollars at this rate, by themselves.</span>
        </label>
        <label className="block text-sm font-black text-[#17231f]">
          Biggest single jar move ($)
          <input
            className={numberField}
            inputMode="numeric"
            placeholder="0 = no limit"
            value={settings.maxSingleJarMove}
            onChange={(event) =>
              onSettingsChange({ ...settings, maxSingleJarMove: Math.max(0, Number(event.target.value) || 0) })
            }
          />
          <span className="mt-1 block text-xs font-bold text-[#4f625b]">Caps one tap. 0 means no cap.</span>
        </label>
        <label className="block text-sm font-black text-[#17231f]">
          Spend jar can hold ($)
          <input
            className={numberField}
            inputMode="numeric"
            placeholder="0 = no limit"
            value={settings.spendJarCap}
            onChange={(event) =>
              onSettingsChange({ ...settings, spendJarCap: Math.max(0, Number(event.target.value) || 0) })
            }
          />
          <span className="mt-1 block text-xs font-bold text-[#4f625b]">Kids spend with the family before piling on more.</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-[#faf8f0] p-4 text-sm font-black text-[#17231f]">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-[#165a4b]"
            checked={settings.allowKidUndo}
            onChange={(event) => onSettingsChange({ ...settings, allowKidUndo: event.target.checked })}
          />
          <span>
            Let kids undo their own jar moves
            <span className="mt-1 block text-xs font-bold text-[#4f625b]">Shows an “Undo” button on moves they just made.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

/** Parent-only: enroll the active kid in a school PTO, neighborhood, or shelter drive. */
function DriveEnrollmentForm({
  onCreate,
}: {
  onCreate: (draft: { title: string; target: number; kind: "save" | "give"; cause: string; seed?: number }) => void;
}) {
  const kinds = ["pto", "neighborhood", "shelter", "kindness"] as const;
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]>("shelter");
  const [target, setTarget] = useState("25");
  const [seed, setSeed] = useState("");
  const canSubmit = title.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onCreate({
      title: title.trim(),
      target: Math.max(1, Math.floor(Number(target) || 25)),
      kind: "give",
      cause: DRIVE_KIND_META[kind].causeNote,
      seed: Math.max(0, Math.floor(Number(seed) || 0)),
    });
    setTitle("");
    setTarget("25");
    setSeed("");
  };

  return (
    <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b400]">🔒 Grown-up controls</p>
      <h3 className="mt-2 text-2xl font-black text-[#17231f]">Enroll in a kindness drive</h3>
      <p className="mt-1 text-sm font-bold text-[#4f625b]">
        School PTO, neighborhood, or animal-shelter drives appear in your kid&apos;s bank right away — they feed it from their GIVE jar.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {kinds.map((option) => (
          <button
            key={option}
            onClick={() => setKind(option)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-black ${
              kind === option ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-[#faf8f0] text-[#17231f]"
            }`}
          >
            {DRIVE_KIND_META[option].emoji} {DRIVE_KIND_META[option].label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto]">
        <input
          className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold text-[#17231f]"
          placeholder="Example: Blankets for Sunny Paws Shelter"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold text-[#17231f]"
          inputMode="numeric"
          placeholder="$ target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <input
          className="rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold text-[#17231f]"
          inputMode="numeric"
          placeholder="Seed $"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
        />
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="tt-btn-press min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enroll 🌱
        </button>
      </div>
    </div>
  );
}

/** Kids start their own goals here — save or give, live immediately. */
function KidGoalCreator({
  onCreate,
}: {
  onCreate: (draft: { title: string; target: number; kind: "save" | "give"; cause: string; seed?: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("20");
  const [kind, setKind] = useState<"save" | "give">("save");

  const submit = () => {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      target: Math.max(1, Math.floor(Number(target) || 20)),
      kind,
      cause: kind === "give" ? "Kid's own kindness goal" : "",
      seed: 0,
    });
    setTitle("");
    setTarget("20");
    setKind("save");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tt-btn-press mt-3 min-h-12 w-full rounded-lg border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] px-4 py-3 text-base font-black text-[#0d3b30]"
      >
        + Start my own goal 🌱
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-lg bg-[#e7f4ef] p-4">
      <p className="text-base font-black text-[#0d3b30]">My new goal</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(["save", "give"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setKind(option)}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${
              kind === option ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
            }`}
          >
            {option === "save" ? "💰 Save for something" : "💛 Give kindness"}
          </button>
        ))}
      </div>
      <input
        className="mt-3 w-full rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold text-[#17231f]"
        placeholder={kind === "give" ? "Example: Toys for the shelter" : "Example: New skateboard"}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <input
          className="w-32 rounded-lg border border-[#ded8c7] px-4 py-3 font-semibold text-[#17231f]"
          inputMode="numeric"
          placeholder="$ goal"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <button
          onClick={submit}
          disabled={!title.trim()}
          className="tt-btn-press min-h-12 flex-1 rounded-lg bg-[#165a4b] px-5 py-3 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start it! 🚀
        </button>
        <button
          onClick={() => setOpen(false)}
          className="min-h-12 rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-sm font-black text-[#4f625b]"
        >
          Not yet
        </button>
      </div>
    </div>
  );
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
  setPointsPerDollar: (value: number) => void;
  bankSettings: KidBankSettings;
  onBankSettingsChange: (settings: KidBankSettings) => void;
  allocateToJar: (category: KidJarKey, amount: number, goalId?: string) => string | null;
  undoJarMove: (txId: string) => boolean;
  convertPointsToDollars: () => void;
  createBankGoal: (draft: { title: string; target: number; kind: "save" | "give"; cause: string; seed?: number }) => void;
}) {
  const childId = props.child?.id ?? "";
  const balances = useMemo(() => kidJarBalances(childId, props.transactions), [childId, props.transactions]);
  const childTransactions = props.transactions.filter((item) => item.childId === childId);
  const childLook = getChildLook(props.child?.id);
  const kidSaveGoals = props.goals.filter(
    (goal) => goal.childId === childId && goal.type !== "donation" && (props.isParentView || goal.visibleToKids !== false),
  );
  const drives = useMemo(
    () => kidVisibleDrives(childId, props.goals, props.isParentView),
    [childId, props.goals, props.isParentView],
  );
  const featured = featuredDrive(drives);
  const jarScale = Math.max(25, balances.save, balances.spend, balances.give);
  const points = props.child?.points ?? 0;
  const { dollars: pointDollars, pointsUsed } = pointsToDollars(points, props.pointsPerDollar);
  const pendingTransactions = childTransactions.filter((tx) => tx.status === "pending");
  const moneyStory = childTransactions.filter((tx) => tx.status !== "pending").slice(0, 6);

  const txIcon = (tx: BankTransaction) =>
    tx.amount < 0 ? "↩️" : tx.category === "earn" ? "🪙" : tx.category === "save" ? "🏦" : tx.category === "spend" ? "🛍️" : "💛";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
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
            <h2 className="mt-1 text-3xl font-black text-[#17231f]">{props.child?.name ?? "Kid"}&apos;s money jars</h2>
            <p className="mt-1 text-base font-bold text-[#4f625b]">Money you earned → <span className="text-[#2563eb]">you decide where it goes!</span> 🫙</p>
          </div>
        </div>
        {points > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#fff4d8] p-4">
            <p className="text-sm font-black text-[#7a4b12]">
              🐾 {points.toLocaleString()} points = ${pointDollars} <span className="font-bold">({props.pointsPerDollar} points = $1)</span>
            </p>
            {pointDollars > 0 ? (
              <button
                onClick={props.convertPointsToDollars}
                className="tt-btn-press min-h-11 rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white"
              >
                Turn {pointsUsed} points into ${pointDollars}! ✨
              </button>
            ) : (
              <p className="text-xs font-bold text-[#7a4b12]">Earn {props.pointsPerDollar - points} more points to make $1!</p>
            )}
          </div>
        )}
      </div>

      {balances.unallocated > 0 && (
        <div className="rounded-lg border-2 border-[#2563eb] bg-[#eef5fd] p-5 text-center shadow-sm">
          <p className="text-2xl font-black text-[#17231f]">🎉 You have ${balances.unallocated} to sort!</p>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">
            A grown-up approved your work and the money landed in your bank. Now <b>you</b> choose the jars — no asking needed!
          </p>
        </div>
      )}

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">The three jars</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          {JAR_VISUALS.map((visual) => (
            <JarMeter
              key={visual.key}
              visual={visual}
              balance={balances[visual.key]}
              scale={jarScale}
              ring={
                visual.key === "give" && featured
                  ? <DriveProgressRing percent={driveProgress(featured)} label={`${featured.title}: ${Math.round(driveProgress(featured) * 100)}% funded — tap to see drives`} />
                  : undefined
              }
            />
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-bold text-[#4f625b]">
          💧 Blue water rises as your jars fill up. {featured ? "Tap the gold ring on the GIVE jar to see your kindness drives!" : ""}
        </p>
      </div>

      <JarAllocator
        childName={props.child?.name ?? "Kid"}
        balances={balances}
        settings={props.bankSettings}
        saveGoals={kidSaveGoals}
        drives={drives}
        transactions={props.transactions}
        onAllocate={props.allocateToJar}
        onUndo={props.undoJarMove}
      />

      <div className="grid gap-4 2xl:grid-cols-2">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">My goals</p>
          <h3 className="mt-2 text-2xl font-black text-[#17231f]">What are you saving for?</h3>
          <div className="mt-4 grid gap-3">
            {!kidSaveGoals.length && (
              <div className="rounded-lg border-2 border-dashed border-[#165a4b] bg-[#e7f4ef] p-4 text-center">
                <p className="text-sm font-black text-[#0d3b30]">No goals yet — start your very own below! 🌱</p>
              </div>
            )}
            {kidSaveGoals.map((goal) => <SaveGoalCard key={goal.id} goal={goal} />)}
          </div>
          <KidGoalCreator onCreate={props.createBankGoal} />
        </div>

        <div id="kid-bank-drives" className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b400]">Kindness drives</p>
          <h3 className="mt-2 text-2xl font-black text-[#17231f]">Helping, together 💛</h3>
          <div className="mt-4 grid gap-3">
            {!drives.length && (
              <div className="rounded-lg border-2 border-dashed border-[#f4b400] bg-[#fff8ef] p-4 text-center">
                <p className="text-sm font-black text-[#7a4b12]">
                  {props.isParentView ? "No drives yet — enroll this kid in one below! 👇" : "No drives yet — ask a grown-up to enroll you in a kindness drive! 💛"}
                </p>
              </div>
            )}
            {drives.map((goal) => (
              <DriveCard
                key={goal.id}
                goal={goal}
                transactions={props.transactions}
                childProfiles={props.childProfiles}
                isParentView={props.isParentView}
                onConfirmDonation={props.confirmDonation}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-xs font-bold text-[#4f625b]">
            Feed a drive from your GIVE jar in the sorting station above ⬆️
          </p>
        </div>
      </div>

      {props.isParentView && (
        <div className="grid gap-4 2xl:grid-cols-2">
          <BankSettingsPanel
            pointsPerDollar={props.pointsPerDollar}
            setPointsPerDollar={props.setPointsPerDollar}
            settings={props.bankSettings}
            onSettingsChange={props.onBankSettingsChange}
          />
          <DriveEnrollmentForm onCreate={props.createBankGoal} />
        </div>
      )}

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-[#17231f]">Your money story 📖</h3>
        {pendingTransactions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b400]">⏳ Waiting for a grown-up</p>
            <div className="mt-2 grid gap-2">
              {pendingTransactions.map((tx) => (
                <p key={tx.id} className="rounded-lg border-2 border-[#f4b400] bg-[#fff4d8] p-3 text-sm font-semibold text-[#17231f]">
                  {txIcon(tx)} <b className="capitalize">{tx.category}</b> ${tx.amount}
                  <span className="mt-1 block font-bold text-[#7a4b12]">{tx.description}</span>
                </p>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 grid gap-2">
          {moneyStory.map((tx) => (
            <p key={tx.id} className="rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold text-[#4f625b]">
              {txIcon(tx)} <b className="capitalize">{tx.category}</b> {tx.amount < 0 ? `−$${Math.abs(tx.amount)}` : `$${tx.amount}`}
              <span className="mt-1 block">{tx.description}</span>
            </p>
          ))}
          {!moneyStory.length && !pendingTransactions.length && (
            <p className="rounded-lg bg-[#faf8f0] p-3 text-sm font-semibold text-[#4f625b]">
              No money moves yet — earn your first dollars by finishing a mission!
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Parent-side AI endpoints need the signed-in parent's access token. Null = signed out. */
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

/** Playdate claims the parent has already reviewed (local-only; Parent Review badge clears). */
const ACK_PLAYDATES_KEY = "tailtots-ack-playdates-v1";
function loadAckedPlaydateIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACK_PLAYDATES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function saveAckedPlaydateIds(ids: string[]): void {
  try {
    localStorage.setItem(ACK_PLAYDATES_KEY, JSON.stringify(ids));
  } catch {
    // Local-only acknowledgement; never blocks the notification flow.
  }
}

/** Pet-chore skill tag → mission category, so getMissionLifeSkill labels them trackably. */
function choreSkillToCategory(skill: PetChoreSkill): Mission["category"] {
  const map: Record<PetChoreSkill, Mission["category"]> = {
    responsibility: "pet_care",
    empathy: "kindness",
    teamwork: "community",
    leadership: "money",
    time: "chore",
  };
  return map[skill];
}

/**
 * Parent Copilot panel (Phase 2) — parent-only, lives at the top of Parent
 * Review. A pattern-READER, not a chatbot: the Worker runs deterministic
 * detection over mission activity and narrates precomputed facts into warm,
 * actionable sentences. Conscious-parenting voice throughout: every insight
 * points at what the PARENT can try together with their child — never at
 * what's wrong with the kid. Dismissible; no persistent profiles.
 */
function CopilotPanel(props: { childProfiles: Child[]; cloudFamilyId: string | null }) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [insights, setInsights] = useState<PatternInsightRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const activeChild =
    props.childProfiles.find((c) => c.id === selectedClientId) ?? props.childProfiles[0] ?? null;

  const loadInsights = useCallback(
    async (clientId: string) => {
      if (!props.cloudFamilyId || !supabase) {
        setError("Connect cloud sync in Family Setup to enable the Copilot.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await getParentAccessToken();
        if (!token) {
          setError("Sign in with your parent account to use the Copilot.");
          return;
        }
        const { data: childRow } = await supabase
          .from("children")
          .select("id")
          .eq("family_id", props.cloudFamilyId)
          .eq("client_id", clientId)
          .maybeSingle();
        if (!childRow?.id) {
          setError("This profile hasn't synced to the cloud yet.");
          return;
        }
        const result = await fetchCopilotInsights({ token, childId: childRow.id as string });
        if (!result.ok) {
          setError("The Copilot couldn't reach its pattern reader just now. Try again in a bit.");
          return;
        }
        setInsights(result.insights ?? []);
      } catch {
        setError("The Copilot couldn't reach its pattern reader just now. Try again in a bit.");
      } finally {
        setLoading(false);
      }
    },
    [props.cloudFamilyId],
  );

  useEffect(() => {
    if (!activeChild) return;
    // Defer past the effect body so state updates don't cascade synchronously.
    const timer = setTimeout(() => {
      void loadInsights(activeChild.id);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChild?.id, props.cloudFamilyId]);

  const dismissInsight = async (insight: PatternInsightRow) => {
    if (!supabase) return;
    setDismissingId(insight.id);
    try {
      // Best-effort: record who dismissed. Falls back to expiring the insight.
      let parentId: string | null = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        const authUserId = userData.user?.id;
        if (authUserId) {
          const { data: parentRow } = await supabase
            .from("parents")
            .select("id")
            .eq("auth_user_id", authUserId)
            .maybeSingle();
          parentId = (parentRow as { id?: string } | null)?.id ?? null;
        }
      } catch {
        parentId = null;
      }
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      await supabase
        .from("pattern_insights")
        .update(
          parentId
            ? { dismissed_by_parent_id: parentId }
            : { valid_until: yesterday },
        )
        .eq("id", insight.id);
      setInsights((prev) => prev.filter((i) => i.id !== insight.id));
    } finally {
      setDismissingId(null);
    }
  };

  const severityStyle: Record<string, string> = {
    act: "border-amber-300 bg-amber-50",
    watch: "border-sky-200 bg-sky-50",
    info: "border-emerald-200 bg-emerald-50",
  };
  const severityLabel: Record<string, string> = {
    act: "Worth a look",
    watch: "Gentle note",
    info: "Celebrate",
  };

  return (
    <section aria-label="Parent Copilot" className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Parent Copilot</h3>
          <p className="text-sm text-slate-500">
            Patterns from your family&apos;s mission activity — observations to act on, never diagnoses.
          </p>
        </div>
        {props.childProfiles.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Child
            <select
              value={activeChild?.id ?? ""}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
            >
              {props.childProfiles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-4">
        {loading && (
          <p className="text-sm text-slate-500">Reading {activeChild?.name ?? "your child"}&apos;s mission rhythms…</p>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => activeChild && loadInsights(activeChild.id)}
              className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Try again
            </button>
          </div>
        )}
        {!loading && !error && insights.length === 0 && (
          <p className="text-sm text-slate-500">
            No patterns to share yet — the Copilot spots rhythms after a couple of weeks of missions. Keep the streak warm.
          </p>
        )}
        {!loading && !error && insights.length > 0 && (
          <ul className="space-y-3">
            {insights.map((insight) => (
              <li
                key={insight.id}
                className={`rounded-xl border p-3 ${severityStyle[insight.severity] ?? severityStyle.info}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {severityLabel[insight.severity] ?? "Note"}
                      {activeChild ? ` · ${activeChild.name}` : ""}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-800">
                      {insight.narrative ?? "A new pattern was spotted — check back in a moment."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissInsight(insight)}
                    disabled={dismissingId === insight.id}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-50"
                    aria-label="Dismiss this insight"
                  >
                    {dismissingId === insight.id ? "…" : "Dismiss"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        The Copilot reads mission activity only (completions, timing, categories). It never sees names, notes, or photos, and it never gives medical or mental-health advice.
      </p>
    </section>
  );
}

function ApprovalsPanel(props: {
  missions: Mission[];
  transactions: BankTransaction[];
  childProfiles: Child[];
  pets?: Pet[];
  approveMission: (missionId: string) => void;
  approveTransaction: (transactionId: string) => void;
  rejectMission: (missionId: string, reason?: string) => void;
  rejectTransaction: (transactionId: string) => void;
  /** R2-27 (neighborhood stream): Skill Job Builder moved into Parent Review — fills the job draft. */
  fillJobTemplate: (skill: string) => void;
  /** R2-27: optional follow-up after a template is used (e.g. jump to the Neighborhood tab to post). */
  onTemplateUsed?: () => void;
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
            <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">No missions waiting right now. When your kid finishes a mission, it'll show up here for your high-five! 🌟</p>
          )}
          {pendingMissions.map((mission) => {
            const child = props.childProfiles.find((entry) => entry.id === mission.completedBy);
            const childLook = getChildLook(child?.id);
            const pet = props.pets?.find((item) => item.id === mission.petId);
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
                  <div className="mt-1 flex items-center gap-2">
                    <MissionThumb mission={mission} pet={pet} size="sm" />
                    <h3 className="text-xl font-black">{mission.title}</h3>
                  </div>
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
      {/* R2-27 (neighborhood stream): Skill Job Builder now lives in Parent Review. */}
      <SkillJobBuilder
        fillJobTemplate={(skill) => { props.fillJobTemplate(skill); props.onTemplateUsed?.(); }}
      />
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
  // Real fairness engine: workload analysis + concrete rebalancing proposals.
  const fairness = useMemo(() => analyzeFairness(props.missions, props.childProfiles), [props.missions, props.childProfiles]);
  const [coachTip, setCoachTip] = useState<string | null>(null);
  const [coachSource, setCoachSource] = useState<"live" | "demo" | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);

  async function askFairnessCoach() {
    setCoachLoading(true);
    try {
      const token = await getParentAccessToken();
      if (token) {
        const result = await fetchFairnessCoaching({ token, analysis: fairness });
        if (result.ok) {
          setCoachTip(result.tip);
          setCoachSource("live");
          return;
        }
      }
      setCoachTip(fairnessCoachFallback(fairness));
      setCoachSource("demo");
    } finally {
      setCoachLoading(false);
    }
  }

  function applyRebalancePlan(moves: RebalanceMove[]) {
    moves.forEach((move) => props.assignMission(move.missionId, move.toChildId));
  }

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
      <div className="mt-4 rounded-lg border border-[#ded8c7] bg-[#faf8f0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Fairness engine · AI-backed</p>
            <h3 className="mt-1 text-xl font-black">Workload analysis</h3>
          </div>
          {fairness.moves.length > 0 && (
            <span
              className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#d92626] px-2 text-xs font-black text-white"
              role="status"
              aria-label={`${fairness.moves.length} rebalancing suggestions`}
            >
              {fairness.moves.length}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">{fairness.insight}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {fairness.kids.map((kid) => (
            <div key={kid.childId} className="rounded-lg bg-white p-3">
              <p className="font-black">
                {kid.name} <span className="text-xs font-bold text-[#69736f]">· age {kid.age}</span>
              </p>
              <p className="mt-1 text-sm font-bold text-[#4f625b]">
                {kid.plannedPoints} planned pts · {kid.openCount} open · {kid.awaitingApproval} awaiting approval
              </p>
              <p className="mt-1 text-xs font-bold text-[#69736f]">
                Avg difficulty {kid.avgDifficulty ? kid.avgDifficulty.toFixed(1) : "—"}/4 · easy {kid.byDifficulty.easy} ·
                medium {kid.byDifficulty.medium} · hard {kid.byDifficulty.hard + kid.byDifficulty.super_hard}
              </p>
            </div>
          ))}
        </div>
        {fairness.moves.length > 0 && (
          <div className="mt-3 rounded-lg bg-white p-3">
            <p className="text-sm font-black">Suggested rebalancing — you stay in charge</p>
            <div className="mt-2 grid gap-2">
              {fairness.moves.map((move) => (
                <div key={move.missionId} className="rounded-lg bg-[#fff4d8] p-3">
                  <p className="text-sm font-black">
                    “{move.title}” ({move.points} pts): {move.fromName} → {move.toName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#4f625b]">{move.reason}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => applyRebalancePlan(fairness.moves)}
              className="tt-btn-press mt-3 min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white"
            >
              Apply rebalancing ({fairness.moves.length})
            </button>
          </div>
        )}
        <div className="mt-3">
          <button
            onClick={askFairnessCoach}
            disabled={coachLoading}
            className="min-h-11 rounded-lg bg-[#6d3ed1] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {coachLoading ? "Asking the coach…" : "Ask AI coach"}
          </button>
          {coachTip && (
            <div className="mt-2 rounded-lg bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6d3ed1]">
                {coachSource === "live" ? "✨ AI coach" : "Built-in coach · works offline"}
              </p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#17231f]">{coachTip}</p>
            </div>
          )}
        </div>
      </div>
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

/** Parent Review: red-dot notification center — missions, Kid Bank requests, playdate claims. */
function NotificationsCard(props: {
  missions: Mission[];
  transactions: BankTransaction[];
  childProfiles: Child[];
  pendingPlaydates: PlaydateInvite[];
  acknowledgePlaydate: (inviteId: string) => void;
  setActiveTab: (tab: string) => void;
}) {
  const pendingMissions = props.missions.filter((mission) => mission.completedBy && mission.status === "pending");
  const pendingTransactions = props.transactions.filter((tx) => tx.status === "pending");
  const total = pendingMissions.length + pendingTransactions.length + props.pendingPlaydates.length;
  const childName = (id?: string) => props.childProfiles.find((entry) => entry.id === id)?.name ?? "Kid";
  const countBadge = (count: number, label: string) => (
    <span
      className="ml-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[#d92626] px-2 text-xs font-black text-white"
      role="status"
      aria-label={label}
    >
      {count}
    </span>
  );
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm" aria-label="Notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d92626]">Notifications</p>
          {total > 0 && countBadge(total, `${total} items need your review`)}
        </div>
        <h2 className="text-2xl font-black">{total > 0 ? "Needs your review" : "All caught up 🎉"}</h2>
      </div>
      {total === 0 ? (
        <p className="mt-3 rounded-lg bg-[#e7f4ef] p-4 text-sm font-semibold text-[#165a4b]">
          Nothing waiting — you're all caught up! 🎉 Missions your kids finish, money requests, and playdate claims will appear here.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {pendingMissions.length > 0 && (
            <div className="rounded-lg bg-[#faf8f0] p-4">
              <p className="font-black">
                Missions waiting{countBadge(pendingMissions.length, `${pendingMissions.length} missions waiting`)}
              </p>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#4f625b]">
                {pendingMissions.slice(0, 3).map((mission) => (
                  <li key={mission.id}>
                    • “{mission.title}” — {childName(mission.completedBy)} finished it
                  </li>
                ))}
                {pendingMissions.length > 3 && <li>• +{pendingMissions.length - 3} more below</li>}
              </ul>
            </div>
          )}
          {pendingTransactions.length > 0 && (
            <div className="rounded-lg bg-[#fff4d8] p-4">
              <p className="font-black">
                Money requests{countBadge(pendingTransactions.length, `${pendingTransactions.length} money requests`)}
              </p>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#4f625b]">
                {pendingTransactions.slice(0, 3).map((tx) => (
                  <li key={tx.id}>
                    • ${tx.amount} {tx.category} — {childName(tx.childId)}: {tx.description}
                  </li>
                ))}
                {pendingTransactions.length > 3 && <li>• +{pendingTransactions.length - 3} more below</li>}
              </ul>
            </div>
          )}
          {props.pendingPlaydates.length > 0 && (
            <div className="rounded-lg bg-[#eef2ff] p-4">
              <p className="font-black">
                Playdate claims{countBadge(props.pendingPlaydates.length, `${props.pendingPlaydates.length} playdate claims`)}
              </p>
              <div className="mt-2 grid gap-2">
                {props.pendingPlaydates.map((invite) => {
                  const claimedSlot = invite.slots.find((slot) => slot.status === "claimed");
                  return (
                    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                      <p className="text-sm font-bold text-[#17231f]">
                        ✅ {invite.claimedBy} claimed {claimedSlot?.slot} for {claimedSlot?.childName}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => props.setActiveTab("schedule")}
                          className="min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-black text-white"
                        >
                          Open Schedule
                        </button>
                        <button
                          onClick={() => props.acknowledgePlaydate(invite.id)}
                          className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-xs font-black text-[#4f625b]"
                        >
                          Mark reviewed
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Parent Review: AI pet-chores builder — pick a skill, AI builds chores from your exact pets. */
function PetChoreBuilderCard(props: {
  pets: Pet[];
  childProfiles: Child[];
  parentSignedIn: boolean;
  addChoreMissions: (drafts: PetChoreDraft[], childId: string) => void;
}) {
  const [skill, setSkill] = useState<PetChoreSkill>("responsibility");
  const [skillSearch, setSkillSearch] = useState("");
  const [chores, setChores] = useState<PetChoreDraft[] | null>(null);
  const [choreSource, setChoreSource] = useState<"live" | "demo" | null>(null);
  const [choreLoading, setChoreLoading] = useState(false);
  const [history, setHistory] = useState<ChoreSetRecord[]>(() => loadChoreHistory());
  const [assignTo, setAssignTo] = useState(props.childProfiles[0]?.id ?? "");
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const filteredSkills = PET_CHORE_SKILLS.filter((option) =>
    getLifeSkillLabel(option).toLowerCase().includes(skillSearch.trim().toLowerCase()),
  );
  const petInputs = props.pets.map((pet) => ({ id: pet.id, name: pet.name, species: pet.species }));
  const ageBand = domainAgeBandForAge(props.childProfiles[0]?.age ?? 8);

  function recordHistory(source: "live" | "demo", next: PetChoreDraft[]) {
    const record: ChoreSetRecord = {
      id: `chores-${Date.now()}`,
      dateKey: todayLocalDateKey(),
      skill,
      petNames: petInputs.map((pet) => pet.name),
      chores: next,
      source,
    };
    setHistory((items) => {
      const updated = [record, ...items].slice(0, 20);
      saveChoreHistory(updated);
      return updated;
    });
  }

  async function generateChores() {
    setChoreLoading(true);
    setSavedFlash(null);
    try {
      const token = await getParentAccessToken();
      if (token) {
        const result = await fetchPetChores({ token, skill, ageBand, pets: petInputs });
        if (result.ok) {
          setChores(result.chores);
          setChoreSource("live");
          recordHistory("live", result.chores);
          return;
        }
      }
      // Honest local fallback: built from the family's exact pets, labeled as templates.
      const local = buildLocalPetChoreSet(petInputs, skill, ageBand);
      setChores(local);
      setChoreSource("demo");
      recordHistory("demo", local);
    } finally {
      setChoreLoading(false);
    }
  }

  function saveAsMissions() {
    if (!chores?.length || !assignTo) return;
    props.addChoreMissions(chores, assignTo);
    const kid = props.childProfiles.find((entry) => entry.id === assignTo);
    setSavedFlash(`${chores.length} missions saved for ${kid?.name ?? "your kid"} — they appear in Today's missions now.`);
  }

  function reuseRecord(record: ChoreSetRecord) {
    setSkill(record.skill);
    setChores(record.chores);
    setChoreSource(record.source);
    setSavedFlash(null);
  }

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm" aria-label="AI pet-chores builder">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">AI pet-chores builder</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Teach one skill today — AI builds the chores</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Pick the character or life skill to teach. The builder uses your family’s exact pets and returns 4–5 trackable
        chores, each tagged with the skill it grows. Nothing becomes a mission until you save it.
      </p>
      {props.pets.length === 0 ? (
        <p className="mt-4 rounded-lg bg-[#fff4d8] p-4 text-sm font-semibold text-[#7a4b12]">
          Add your pets in Pet Passports first — the builder crafts chores from your family’s exact pets.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-black text-[#17231f]">
              Skill to teach
              <select
                value={skill}
                onChange={(event) => setSkill(event.target.value as PetChoreSkill)}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold"
              >
                {(filteredSkills.length ? filteredSkills : PET_CHORE_SKILLS).map((option) => (
                  <option key={option} value={option}>
                    {getLifeSkillLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-black text-[#17231f]">
              Search skills
              <input
                value={skillSearch}
                onChange={(event) => setSkillSearch(event.target.value)}
                placeholder="Type to filter…"
                className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={generateChores}
              disabled={choreLoading}
              className="tt-btn-press min-h-11 rounded-lg bg-[#17231f] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              {choreLoading ? "Building chores…" : "Build chore set with AI"}
            </button>
            {!props.parentSignedIn && (
              <p className="text-xs font-semibold text-[#7a4b12]">
                Signed-in parents get live AI generation; otherwise built-in templates are used.
              </p>
            )}
          </div>
          {chores && (
            <div className="mt-4 rounded-lg bg-[#eef2ff] p-4">
              <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${choreSource === "live" ? "text-[#2563eb]" : "text-[#7a4b12]"}`}>
                {choreSource === "live" ? "✨ AI-built chore set — review before saving" : "Built-in templates · built from your exact pets"}
              </p>
              <div className="mt-2 grid gap-2">
                {chores.map((chore) => (
                  <div key={`${chore.title}-${chore.skill}`} className="rounded-lg bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6d3ed1]">
                        {getLifeSkillLabel(chore.skill)}
                      </span>
                      <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{chore.points} pts</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black capitalize ring-1 ring-[#ded8c7]">
                        {chore.difficulty}
                      </span>
                      {chore.petName && (
                        <span className="text-xs font-bold text-[#4f625b]">🐾 {chore.petName}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-black text-[#17231f]">{chore.title}</p>
                    {chore.detail && <p className="mt-1 text-sm font-semibold leading-5 text-[#4f625b]">{chore.detail}</p>}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-sm font-black text-[#17231f]">
                  Save for
                  <select
                    value={assignTo}
                    onChange={(event) => setAssignTo(event.target.value)}
                    className="ml-2 min-h-11 rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold"
                  >
                    {props.childProfiles.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={saveAsMissions}
                  disabled={!chores.length || !assignTo}
                  className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
                >
                  Save as today’s missions
                </button>
              </div>
              {savedFlash && (
                <p className="mt-2 rounded-lg bg-[#e7f4ef] p-3 text-sm font-semibold text-[#165a4b]">{savedFlash}</p>
              )}
            </div>
          )}
          {history.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#69736f]">Chore-set history</p>
              <div className="mt-2 grid gap-2">
                {history.map((record) => (
                  <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#faf8f0] p-3">
                    <p className="text-sm font-bold text-[#17231f]">
                      {record.dateKey} · {getLifeSkillLabel(record.skill)} · {record.petNames.join(", ") || "pets"} ·{" "}
                      {record.chores.length} chores
                      <span className="ml-2 text-xs font-bold text-[#69736f]">
                        {record.source === "live" ? "✨ AI" : "templates"}
                      </span>
                    </p>
                    <button
                      onClick={() => reuseRecord(record)}
                      className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-xs font-black text-[#17231f]"
                    >
                      Use for today
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Parent Review: "Ask your kid with AI" conversation prompts (relocated from the old AI tab). */
function AskKidPromptCard({ childProfiles, parentSignedIn }: { childProfiles: Child[]; parentSignedIn: boolean }) {
  const [askTopic, setAskTopic] = useState("kindness");
  const [askPrompt, setAskPrompt] = useState<string | null>(null);
  const [askPromptSource, setAskPromptSource] = useState<"live" | "demo" | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const askKidPrompts: Record<string, string[]> = {
    kindness: [
      "Tell me about a time you were kind to someone this week — how did it make you feel?",
      "If you could do one kind thing for our family tomorrow, what would it be?",
      "Who is someone that was kind to you lately, and how could you thank them?",
    ],
    patience: [
      "Tell me about a time you had to wait for something — what helped you stay patient?",
      "What is something hard that got easier because you kept practicing?",
      "When you feel like rushing, what could you do to slow down?",
    ],
    honesty: [
      "Why do you think telling the truth matters, even when it is hard?",
      "Tell me about a time you told the truth when it would have been easier not to.",
      "What would you do if a friend asked you to keep a secret that felt wrong?",
    ],
    responsibility: [
      "What is one job in our family that you feel proud to own?",
      "How do you think taking care of our pet teaches responsibility?",
      "What is something you want to be trusted with when you are older, and how are you earning it now?",
    ],
  };

  async function generateAskPrompt() {
    const applyLocalFallback = () => {
      const options = askKidPrompts[askTopic] ?? askKidPrompts.kindness;
      setAskPrompt(options[Math.floor(Math.random() * options.length)]);
      setAskPromptSource("demo");
    };
    setAskLoading(true);
    try {
      const accessToken = await getParentAccessToken();
      if (!accessToken) {
        applyLocalFallback();
        return;
      }
      const child = childProfiles[0];
      const result = await fetchConversationPrompt({
        token: accessToken,
        topic: askTopic,
        ageBand: child ? domainAgeBandForAge(child.age) : "7-9",
      });
      if (result.ok) {
        setAskPrompt(result.prompt);
        setAskPromptSource("live");
      } else {
        applyLocalFallback();
      }
    } catch {
      applyLocalFallback();
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm" aria-label="Ask your kid with AI">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">AI in the background</p>
      <h2 className="mt-2 text-2xl font-black">Ask your kid with AI 💬</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Pick a topic — AI writes one conversation prompt you can ask your kid tonight. Signed-in parents get a fresh
        AI-written prompt; otherwise a built-in demo prompt.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Conversation topic">
        {["kindness", "patience", "honesty", "responsibility"].map((topic) => (
          <button
            key={topic}
            onClick={() => {
              setAskTopic(topic);
              setAskPrompt(null);
              setAskPromptSource(null);
            }}
            className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black capitalize ${
              askTopic === topic ? "bg-[#6d3ed1] text-white" : "bg-white text-[#17231f] ring-2 ring-[#ded8c7]"
            }`}
          >
            {topic}
          </button>
        ))}
      </div>
      <button
        onClick={generateAskPrompt}
        disabled={askLoading}
        className="mt-3 min-h-11 rounded-lg bg-[#6d3ed1] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
      >
        {askLoading ? "Generating prompt…" : "Generate a prompt"}
      </button>
      {!parentSignedIn && (
        <p className="mt-2 text-xs font-semibold text-[#7a4b12]">
          AI prompts need a signed-in parent account — set one up in Family Setup, under Parent account. Until then you
          get the built-in demo prompts.
        </p>
      )}
      {askPrompt && (
        <div className="mt-3 rounded-lg bg-[#f4efff] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">
            {askPromptSource === "live" ? "✨ AI-generated prompt" : "Demo prompt · generated locally"}
          </p>
          <p className="mt-2 text-base font-black leading-6">“{askPrompt}”</p>
          <p className="mt-2 text-xs font-semibold text-[#4f625b]">
            Tip: ask it at dinner, listen fully, then share your own answer first next time.
          </p>
        </div>
      )}
    </section>
  );
}

/** Parent Review: parent-set passcode per kid profile (set at creation or later). */
function KidPasscodeCard(props: {
  childProfiles: Child[];
  setChildPasscode: (childId: string, passcode: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [flash, setFlash] = useState<string | null>(null);

  function save(childId: string, name: string) {
    const draft = (drafts[childId] ?? "").trim();
    if (!draft) return;
    props.setChildPasscode(childId, draft);
    setDrafts((items) => ({ ...items, [childId]: "" }));
    setFlash(`Passcode saved for ${name}.`);
  }

  function clear(childId: string, name: string) {
    props.setChildPasscode(childId, "");
    setFlash(`Passcode cleared for ${name}.`);
  }

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm" aria-label="Kid profile passcodes">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Kid profiles</p>
      <h2 className="mt-2 text-2xl font-black">Profile passcodes</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Set a passcode for each kid’s profile — settable when the profile is created or any time after, right here.
        Only a parent on this tab can set or change them.
      </p>
      {flash && <p className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-sm font-semibold text-[#165a4b]">{flash}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-lg bg-[#faf8f0] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-black">{child.name}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  child.passcode ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"
                }`}
              >
                {child.passcode ? "Passcode set" : "No passcode"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={12}
                value={drafts[child.id] ?? ""}
                onChange={(event) => setDrafts((items) => ({ ...items, [child.id]: event.target.value }))}
                placeholder={child.passcode ? "Enter a new passcode" : "Set a passcode"}
                aria-label={`Passcode for ${child.name}`}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-sm font-bold"
              />
              <button
                onClick={() => save(child.id, child.name)}
                disabled={!(drafts[child.id] ?? "").trim()}
                className="tt-btn-press min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {child.passcode ? "Change" : "Set"}
              </button>
              {child.passcode && (
                <button
                  onClick={() => clear(child.id, child.name)}
                  className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#b44421]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FamilySetupPanel(props: {
  cloudAccountEmail: string;
  accountStatus: "idle" | "saving" | "loading" | "error" | "saved";
  accountMessage: string;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
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
  familyZip: string;
  setFamilyZip: (value: string) => void;
  familyNeighborhood: string;
  setFamilyNeighborhood: (value: string) => void;
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
  aiBuddyCategories: string[];
  setAiBuddyCategories: (value: string[]) => void;
  aiBuddyDailyRotate: boolean;
  setAiBuddyDailyRotate: (value: boolean) => void;
  appMode: "demo" | "real";
  onResetDemo: () => void;
}) {
  // Stream R2: every step is a real, checkable setup task — no placeholder
  // steps, no duplicated tracking.
  const setupSteps = [
    ["Parent account", Boolean(props.cloudAccountEmail), props.cloudAccountEmail ? "Signed in" : "Create or sign in"],
    ["Household & neighborhood", Boolean(props.familyName.trim()) && Boolean(props.familyNeighborhood), props.familyNeighborhood || "Name your family + pick a ZIP"],
    ["Kids", props.childProfiles.length > 0, `${props.childProfiles.length} added`],
    ["Pets", props.pets.length > 0, `${props.pets.length} added`],
    ["AI Buddy", props.aiBuddyCategories.length > 0, props.aiBuddyCategories.length > 0 ? `${props.aiBuddyCategories.length} topics picked` : "Pick question topics below"],
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
        {props.appMode === "demo" && (
          <div className="mt-4 rounded-lg border border-dashed border-[#f0c96a] bg-[#fffdf5] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[#7a4b12]">Demo data</p>
                <p className="mt-1 text-xs font-semibold text-[#8a7a5a]">You're exploring with sample family data. Reset anytime to restore the original demo missions, jars, and moments.</p>
              </div>
              <button
                onClick={props.onResetDemo}
                className="min-h-11 shrink-0 rounded-lg border border-[#f0c96a] bg-white px-4 py-2 text-sm font-black text-[#7a4b12] hover:bg-[#fff4d8]"
              >
                ↺ Reset demo
              </button>
            </div>
          </div>
        )}
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

        {/* Stream R2: signup/signin live on dedicated pages now — this card
            just routes there instead of burying a form inside setup. */}
        {!props.cloudAccountEmail && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={props.onOpenSignup} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">
              Create parent account
            </button>
            <button onClick={props.onOpenSignin} className="min-h-12 rounded-lg border border-[#dce6f8] bg-white px-5 py-3 text-sm font-black text-[#1e3a8a]">
              Sign in
            </button>
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

      <NeighborhoodPickerCard
        familyZip={props.familyZip}
        setFamilyZip={props.setFamilyZip}
        familyNeighborhood={props.familyNeighborhood}
        setFamilyNeighborhood={props.setFamilyNeighborhood}
      />

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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">AI Buddy questions</p>
        <h3 className="mt-2 text-2xl font-black">Choose what your kid may ask the AI Buddy</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          The AI Buddy only suggests predefined questions — no open chat. Pick the topics your kid can explore.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["Pet care", "Chores & routine", "Kindness & feelings", "Money & saving"].map((category) => {
            const checked = props.aiBuddyCategories.includes(category);
            return (
              <label
                key={category}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 text-sm font-black ${checked ? "border-[#6d3ed1] bg-[#f4efff]" : "border-[#ded8c7] bg-white"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? props.aiBuddyCategories.filter((item) => item !== category)
                      : [...props.aiBuddyCategories, category];
                    props.setAiBuddyCategories(next);
                  }}
                  className="size-5 accent-[#6d3ed1]"
                />
                {category}
              </label>
            );
          })}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-bold text-[#4f625b]">
          <input
            type="checkbox"
            checked={props.aiBuddyDailyRotate}
            onChange={(event) => props.setAiBuddyDailyRotate(event.target.checked)}
            className="size-6 accent-[#6d3ed1]"
          />
          Let AI rotate new questions daily
        </label>
        {!props.aiBuddyDailyRotate && (
          <p className="mt-2 text-xs font-semibold text-[#4f625b]">Daily rotation is off — the AI Buddy repeats the same starter set.</p>
        )}
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Photo setup</p>
        <h3 className="mt-2 text-2xl font-black">One photo, guided cropping</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          Upload one family picture and TailTots walks you through cropping the parent and kids from that same photo — or set the picture as-is and skip cropping. Pets keep their own passport photos below.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {props.hasFamilyPhoto ? (
            <button
              onClick={props.pickProfilesFromSavedFamilyPhoto}
              className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white"
            >
              ✂️ Crop profiles from family photo
            </button>
          ) : (
            <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
              📸 Upload family photo — then crop each profile
              <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhotoAndPickProfiles(event.target.files?.[0])} />
            </label>
          )}
          <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-[#ded8c7] bg-white px-5 py-3 text-sm font-black text-[#17231f]">
            Just set the family picture (skip cropping)
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhoto(event.target.files?.[0])} />
          </label>
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
    </section>
  );
}

/**
 * Stream R2 (item 26): ZIP → neighborhood/apartment picker during family
 * setup. Manual and extensible (lib/neighborhoods.ts) — no external API.
 * The chosen ZIP + neighborhood are stored on family state as the foundation
 * for future neighborhood job/chore discovery.
 */
function NeighborhoodPickerCard(props: {
  familyZip: string;
  setFamilyZip: (value: string) => void;
  familyNeighborhood: string;
  setFamilyNeighborhood: (value: string) => void;
}) {
  const [customName, setCustomName] = useState("");
  const validZip = normalizeZip(props.familyZip);
  const suggestions = validZip ? neighborhoodSuggestionsForZip(validZip) : [];

  function applyCustomName() {
    const name = customName.trim();
    if (name) {
      props.setFamilyNeighborhood(name);
      setCustomName("");
    }
  }

  return (
    <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Neighborhood</p>
      <h3 className="mt-2 text-2xl font-black">Where does your family live?</h3>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Your ZIP plus your neighborhood or apartment community powers future neighborhood job and chore discovery. Only a ZIP and a place name are stored — never a street address.
      </p>
      {props.familyNeighborhood ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-[#eef2ff] p-4">
          <span className="rounded-full bg-[#1e3a8a] px-4 py-2 text-sm font-black text-white">
            📍 {props.familyNeighborhood}{validZip ? ` · ${validZip}` : ""}
          </span>
          <button
            onClick={() => props.setFamilyNeighborhood("")}
            className="min-h-10 rounded-lg border border-[#dce6f8] bg-white px-4 py-2 text-xs font-black text-[#1e3a8a]"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <label className="mt-4 block max-w-xs text-sm font-black text-[#17231f]">
            ZIP code
            <input
              className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
              value={props.familyZip}
              onChange={(event) => props.setFamilyZip(event.target.value)}
              inputMode="numeric"
              placeholder="75034"
              maxLength={10}
              aria-label="ZIP code"
            />
          </label>
          {props.familyZip && !validZip && (
            <p className="mt-2 text-sm font-bold text-[#b44421]">Enter a valid 5-digit ZIP code.</p>
          )}
          {validZip && (
            <div className="mt-4">
              <p className="text-sm font-black text-[#17231f]">Pick your neighborhood or apartment community</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => props.setFamilyNeighborhood(suggestion)}
                    className="tt-btn-press min-h-10 rounded-full border-2 border-[#dce6f8] bg-white px-4 py-2 text-xs font-black text-[#1e3a8a]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  className="min-h-11 rounded-lg border border-[#ded8c7] px-4 py-2 text-sm font-semibold"
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") applyCustomName(); }}
                  placeholder="Or type your own: e.g. Maple Grove Apartments"
                  aria-label="Custom neighborhood or apartment name"
                />
                <button onClick={applyCustomName} disabled={!customName.trim()} className="min-h-11 rounded-lg bg-[#1e3a8a] px-4 py-2 text-xs font-black text-white disabled:opacity-60">
                  Use this name
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Stream R2 (item 32): dedicated parent SIGN UP and SIGN IN pages — full
 * screens, not a modal buried in setup. Both build on the existing magic-link
 * flow (no passwords). After the link is tapped, the app session effect signs
 * the parent in and the main component routes them to Family Setup.
 */
function ParentAuthView(props: {
  mode: "signup" | "signin";
  accountDraft: { email: string };
  setAccountDraft: (value: { email: string }) => void;
  accountStatus: "idle" | "saving" | "loading" | "error" | "saved";
  accountMessage: string;
  sendParentSignInLink: () => void;
  magicLinkSent: boolean;
  onSwitchMode: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const isSignup = props.mode === "signup";
  return (
    <main className="tailtots-app grid min-h-screen place-items-center bg-[#faf8f0] px-4 py-10 text-[#17231f]">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between gap-3">
          <button onClick={props.onBack} className="tt-btn-press min-h-10 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-xs font-black text-[#17231f]">
            ← Start page
          </button>
          <img src="/tailtots-logo.png" alt="TailTots logo" className="h-12 w-auto rounded-lg object-contain" />
        </div>

        <div className="mt-6 rounded-3xl border border-[#ded8c7] bg-white p-6 shadow-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#165a4b]">{isSignup ? "New parent account" : "Returning parent"}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{isSignup ? "Create your parent account" : "Welcome back"}</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#4f625b]">
            {isSignup
              ? "One email, one magic link — no passwords to remember. Your family setup stays private to your account and syncs across your devices."
              : "We'll email you a fresh sign-in link — no password needed. Your family's cloud setup is waiting."}
          </p>

          <ol className="mt-5 grid gap-2">
            {["Enter your parent email below", "Tap the sign-in link we email you", isSignup ? "Add your kids, pets, and photos in Family Setup" : "Pick up right where you left off"].map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-xl bg-[#faf8f0] px-4 py-3 text-sm font-bold text-[#17231f]">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#165a4b] text-xs font-black text-white">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          <form
            className="mt-6"
            onSubmit={(event) => { event.preventDefault(); props.sendParentSignInLink(); }}
          >
            <label htmlFor="parent-auth-email" className="text-xs font-black uppercase tracking-[0.14em] text-[#4f625b]">
              Parent email
            </label>
            <input
              id="parent-auth-email"
              value={props.accountDraft.email}
              onChange={(event) => props.setAccountDraft({ email: event.target.value })}
              className="mt-2 w-full rounded-xl border-2 border-[#ded8c7] px-4 py-3 text-base font-semibold outline-none focus:border-[#165a4b]"
              inputMode="email"
              placeholder="you@example.com"
              type="email"
              required
            />
            <button
              type="submit"
              disabled={props.accountStatus === "loading"}
              className="tt-btn-press mt-3 min-h-12 w-full rounded-xl bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {props.accountStatus === "loading" ? "Sending…" : isSignup ? "Email me my sign-in link" : "Email me a sign-in link"}
            </button>
          </form>

          {props.magicLinkSent && (
            <div className="mt-4 rounded-xl bg-[#e7f4ef] px-4 py-3 text-sm font-bold text-[#165a4b]" role="status">
              ✉️ Check your inbox — tap the sign-in link to finish. The link expires in about an hour. You&apos;ll land straight in Family Setup.
            </div>
          )}
          {props.accountMessage && !props.magicLinkSent && (
            <p className={`mt-3 text-sm font-bold ${props.accountStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`} role="status">
              {props.accountMessage}
            </p>
          )}

          <div className="mt-6 border-t border-[#ded8c7] pt-5 text-center">
            <button onClick={props.onSwitchMode} className="text-sm font-black text-[#165a4b] underline">
              {isSignup ? "Already have a parent account? Sign in" : "New here? Create a parent account"}
            </button>
            {isSignup && (
              <p className="mt-3 text-xs font-semibold text-[#69736f]">
                Just exploring?{" "}
                <button onClick={props.onSkip} className="font-black text-[#17231f] underline">
                  Set up on this device without an account
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs font-semibold text-[#8a8f8b]">
          Kids never see this screen — parent accounts stay behind the parent passcode. Read our{" "}
          <a className="font-black text-[#165a4b] underline" href="https://tailtots.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}

/** Parent-to-parent referral: copy a shareable message. Never shown to kids. */
function CertificateCard(props: {
  child: Child;
  missions: Mission[];
  badges: BadgeAward[];
  certificates: Certificate[];
  familyName: string;
  hasPets: boolean;
}) {
  // R2-30: "Journey to certificate" is removed from the growth log — only an
  // actually earned certificate renders here.
  const earned = props.certificates.find((cert) => cert.childId === props.child.id);
  if (!earned) return null;
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

/**
 * Feedback R2 — parent-only sub-panel: the parent overrides the Safe social
 * practice heading AND content. The "Generate with AI" button reuses the
 * parent-side /api/ai/ideas pattern (parent access token, strict payload) with
 * an honest labeled local-template fallback — no API keys invented. Clearing
 * the override restores the TailTots default, which always points back to safe
 * social practice. Rendered on the parent-only AI tab — never in the kid view.
 */
async function getBuddyParentAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Honest local starter templates for the parent's safe-social override. */
const SOCIAL_OVERRIDE_TEMPLATES: SocialPracticeParentScenario[] = [
  {
    title: "The unkind comment",
    situation: "Someone writes something mean under your picture in the class gallery. Your stomach drops. What do you do?",
    coaching: "Don't reply — show a trusted adult. Starve the trolls: not replying is a power move, not weakness.",
  },
  {
    title: "The stranger friend request",
    situation: "A player with a cool avatar wants to be your friend in your game. You've never met them. What now?",
    coaching: "Ask a parent first. Cool avatars can hide anyone — real-life rule: you don't follow strangers home, online or off.",
  },
  {
    title: "The photo share",
    situation: "Your friend took a silly photo of you and wants to post it. You're not sure you like it. What do you say?",
    coaching: "Speak up: 'Ask me first — my face, my choice.' Good friends ask before they post.",
  },
];

function SocialPracticeOverrideEditor({
  override,
  onChange,
}: {
  override: SocialPracticeOverride | null;
  onChange: (next: SocialPracticeOverride | null) => void;
}) {
  const blankDraft = { heading: "", intro: "", scenarios: [] as SocialPracticeParentScenario[] };
  const cloneOverrideDraft = (src: SocialPracticeOverride | null) => (src
    ? { heading: src.heading, intro: src.intro, scenarios: src.scenarios.map((s) => ({ ...s })) }
    : { heading: blankDraft.heading, intro: blankDraft.intro, scenarios: [] as SocialPracticeParentScenario[] });
  const [draft, setDraft] = useState<{ heading: string; intro: string; scenarios: SocialPracticeParentScenario[] }>(
    () => cloneOverrideDraft(override),
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState<"live" | "demo" | null>(null);
  // Sync the draft when the parent's saved override changes (keyed on updatedAt
  // so editing the draft doesn't reset it). Render-time adjustment replaces the
  // old setState-in-effect (react-hooks/set-state-in-effect).
  const [prevOverrideUpdatedAt, setPrevOverrideUpdatedAt] = useState<string | undefined>(override?.updatedAt);
  if ((override?.updatedAt ?? null) !== (prevOverrideUpdatedAt ?? null)) {
    setPrevOverrideUpdatedAt(override?.updatedAt);
    setDraft(cloneOverrideDraft(override));
  }
  const update = (next: { heading: string; intro: string; scenarios: SocialPracticeParentScenario[] }) => {
    setDraft(next);
    onChange({ heading: next.heading, intro: next.intro, scenarios: next.scenarios, updatedAt: new Date().toISOString() });
  };
  const updateScenario = (index: number, patch: Partial<SocialPracticeParentScenario>) => {
    const scenarios = draft.scenarios.map((item, i) => (i === index ? { ...item, ...patch } : item));
    update({ ...draft, scenarios });
  };
  const addScenario = () => {
    if (draft.scenarios.length >= 6) return;
    update({ ...draft, scenarios: [...draft.scenarios, { title: "", situation: "", coaching: "" }] });
  };
  const removeScenario = (index: number) => {
    update({ ...draft, scenarios: draft.scenarios.filter((_, i) => i !== index) });
  };
  const restoreDefault = () => {
    setAiSource(null);
    onChange(null);
  };
  const generateWithAi = async () => {
    setAiLoading(true);
    setAiSource(null);
    const applyLocalFallback = () => {
      const room = Math.max(0, 6 - draft.scenarios.length);
      const templates = SOCIAL_OVERRIDE_TEMPLATES.slice(0, room).map((s) => ({ ...s }));
      if (templates.length > 0) update({ ...draft, scenarios: [...draft.scenarios, ...templates] });
      setAiSource("demo");
    };
    try {
      const accessToken = await getBuddyParentAccessToken();
      if (!accessToken) {
        // No signed-in parent: honest local starter templates instead of a dead button.
        applyLocalFallback();
        return;
      }
      const response = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        // Kids-data rule: parent-side only; the endpoint accepts a life skill
        // and a coarse age band — never kid PII.
        body: JSON.stringify({ lifeSkill: "empathy", ageBand: "7-9" }),
      });
      const data = (await response.json().catch(() => null)) as { ideas?: unknown } | null;
      const ideas = Array.isArray(data?.ideas)
        ? data.ideas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      if (!response.ok || ideas.length === 0) {
        applyLocalFallback();
        return;
      }
      const room = Math.max(0, 6 - draft.scenarios.length);
      const generated: SocialPracticeParentScenario[] = ideas.slice(0, room).map((idea, index) => ({
        title: idea.split(/[.!?]/)[0].trim().slice(0, 60) || `Practice idea ${index + 1}`,
        situation: idea.trim(),
        coaching: "Talk it through together first: what would you do, and which trusted adult could you tell?",
      }));
      if (generated.length > 0) update({ ...draft, scenarios: [...draft.scenarios, ...generated] });
      setAiSource("live");
    } catch {
      applyLocalFallback();
    } finally {
      setAiLoading(false);
    }
  };
  const hasOverride = override !== null && (override.heading.trim() !== "" || override.scenarios.length > 0);
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Parent only · Safe social practice</p>
      <h3 className="mt-2 text-2xl font-black">Your family&apos;s social practice content</h3>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        Override the heading and the practice scenarios your kid sees — or leave it alone and kids keep the TailTots
        default: Safe social practice (6 built-in scenarios).{" "}
        <span className="font-black text-[#17231f]">
          {hasOverride ? "Your custom content is live in your kid's Safe social practice." : "Kids currently see the TailTots default."}
        </span>
      </p>
      <div className="mt-4 grid gap-3">
        <label className="block text-sm font-black text-[#17231f]">
          Section heading
          <input
            value={draft.heading}
            onChange={(event) => update({ ...draft, heading: event.target.value })}
            maxLength={80}
            placeholder="e.g. Our family's online smarts"
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
          />
        </label>
        <label className="block text-sm font-black text-[#17231f]">
          Intro line
          <textarea
            value={draft.intro}
            onChange={(event) => update({ ...draft, intro: event.target.value })}
            maxLength={300}
            rows={2}
            placeholder="One line under the heading — leave blank to use the default."
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={generateWithAi}
          disabled={aiLoading}
          className="min-h-11 rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          {aiLoading ? "Generating..." : "✨ Generate starter scenarios with AI"}
        </button>
        {aiSource && (
          <p className="text-xs font-bold text-[#4f625b]">
            {aiSource === "live"
              ? "AI-generated starters — review and edit before your kid sees them."
              : "Built-in starter template (AI unavailable) — review and edit freely."}
          </p>
        )}
      </div>
      {draft.scenarios.length > 0 && (
        <div className="mt-4 grid gap-3">
          {draft.scenarios.map((scenario, index) => (
            <article key={index} className="rounded-lg bg-[#eef2ff] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-[#1e3a8a]">Scenario {index + 1}</p>
                <button
                  onClick={() => removeScenario(index)}
                  className="min-h-10 shrink-0 rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-xs font-black text-[#7a4b12]"
                  aria-label={`Remove scenario ${index + 1}`}
                >
                  Remove
                </button>
              </div>
              <label className="mt-2 block text-xs font-black text-[#17231f]">
                Title
                <input
                  value={scenario.title}
                  onChange={(event) => updateScenario(index, { title: event.target.value })}
                  maxLength={80}
                  placeholder="e.g. The unkind comment"
                  className="mt-1 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-sm font-semibold"
                />
              </label>
              <label className="mt-2 block text-xs font-black text-[#17231f]">
                Situation your kid practices
                <textarea
                  value={scenario.situation}
                  onChange={(event) => updateScenario(index, { situation: event.target.value })}
                  maxLength={400}
                  rows={2}
                  placeholder="Describe the tricky moment..."
                  className="mt-1 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-sm font-semibold"
                />
              </label>
              <label className="mt-2 block text-xs font-black text-[#17231f]">
                Coaching they reveal after thinking it through
                <textarea
                  value={scenario.coaching}
                  onChange={(event) => updateScenario(index, { coaching: event.target.value })}
                  maxLength={400}
                  rows={2}
                  placeholder="What should they do?"
                  className="mt-1 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 text-sm font-semibold"
                />
              </label>
            </article>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {draft.scenarios.length < 6 && (
          <button
            onClick={addScenario}
            className="min-h-11 rounded-lg border border-[#2563eb] bg-white px-5 py-2 text-sm font-black text-[#2563eb]"
          >
            + Add a scenario
          </button>
        )}
        {hasOverride && (
          <button
            onClick={restoreDefault}
            className="min-h-11 rounded-lg border border-[#ded8c7] bg-[#faf8f0] px-5 py-2 text-sm font-black text-[#7a4b12]"
          >
            Restore TailTots default
          </button>
        )}
      </div>
    </section>
  );
}

function SocialPracticeSection({ childProfiles, activeChildId, onSelectChild, done, onAnswer, headingOverride, introOverride, overrideScenarios }: {
  childProfiles: Child[];
  activeChildId?: string;
  onSelectChild?: (childId: string) => void;
  done: Record<string, string[]>;
  onAnswer: (childId: string, scenarioId: string) => void;
  /** Feedback R2: parent override of the heading + scenarios (default when unset). */
  headingOverride?: string;
  introOverride?: string;
  overrideScenarios?: SocialPracticeParentScenario[];
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(activeChildId);
  const [revealed, setRevealed] = useState<Record<string, number>>({});
  const childId = onSelectChild ? (selectedId ?? childProfiles[0]?.id) : (activeChildId ?? childProfiles[0]?.id);
  const child = childProfiles.find((item) => item.id === childId);
  // Feedback R2: a parent override replaces the built-in scenarios — each
  // parent scenario becomes one "think, then reveal the coaching" card with a
  // parent-namespaced id. Otherwise the TailTots default safe-social set
  // renders (the default always points back to safe social practice).
  const isOverride = Boolean(overrideScenarios && overrideScenarios.length > 0);
  const scenarios: {
    id: string;
    title: string;
    situation: string;
    choices: { text: string; best: boolean; feedback: string }[];
  }[] = isOverride
    ? (overrideScenarios ?? []).map((item, index) => ({
        id: `parent-social-${index}`,
        title: item.title.trim() || `Practice ${index + 1}`,
        situation: item.situation,
        choices: [{ text: "I've thought about it — show me what to do", best: true, feedback: item.coaching }],
      }))
    : socialScenarios;
  const doneAll = childId ? done[childId] ?? [] : [];
  const completed = doneAll.filter((id) => scenarios.some((scenario) => scenario.id === id));
  const intro = introOverride?.trim() || (isOverride
    ? `Practice tricky online moments with zero strangers, zero feeds, zero DMs — picked by your parent. ${child?.name ?? "Your kid"} thinks about what they'd do, then reveals the coaching.`
    : `Practice tricky online moments with zero strangers, zero feeds, zero DMs. Pick what you'd do, get instant coaching, and earn the Safe Social Star badge when ${child?.name ?? "your kid"} finishes all ${scenarios.length}.`);
  if (!child) return null;
  return (
    <section className="mt-5 rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">
        🌐 Safe social practice{isOverride && <span className="ml-2 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[#1e3a8a]">Picked by your parent</span>}
      </p>
      <h3 className="mt-2 text-2xl font-black">{headingOverride?.trim() || "Training wheels for real-world social life"}</h3>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        {intro}
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
          <div className="h-2 rounded-full bg-[#2563eb]" style={{ width: `${Math.round((completed.length / scenarios.length) * 100)}%` }} />
        </div>
        <span className="text-xs font-black text-[#1e3a8a]">{completed.length}/{scenarios.length} practiced</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {scenarios.map((scenario) => {
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

/**
 * Character curriculum picker (parent view, Growth tab). The parent picks a
 * kid, a trait, and a level, previews the level's real-world missions, and
 * assigns them all with one tap. Per-trait progress (levels completed) is
 * derived from mission + badge state, so it stays in sync automatically.
 */
function CharacterCurriculumPanel(props: {
  childProfiles: Child[];
  missions: Mission[];
  badges: BadgeAward[];
  activeChildId?: string;
  onSelectChild?: (childId: string) => void;
  hasPets: boolean;
  assignCurriculumMissions: (traitKey: CharacterTraitKey, levelIndex: number, childId: string) => void;
}) {
  const [selectedTrait, setSelectedTrait] = useState<CharacterTraitKey>("responsibility");
  const [selectedLevel, setSelectedLevel] = useState(0);
  const child = props.childProfiles.find((kid) => kid.id === props.activeChildId) ?? props.childProfiles[0];
  const trait = traitByKey(selectedTrait);
  const level = trait.levels[selectedLevel];
  const summary = child ? getChildCurriculumSummary(child.id, props.missions, props.badges) : [];
  const levelStatus = child
    ? summary.find((entry) => entry.traitKey === selectedTrait)?.levels[selectedLevel]
    : undefined;
  const openKeysForLevel = child ? openCurriculumMissionKeys(child.id, selectedTrait, selectedLevel, props.missions) : new Set<string>();
  const openCount = openKeysForLevel.size;

  return (
    <section className="mt-5 rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Character curriculum</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Character, on purpose — taught through missions</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
        Pick a trait and a level, then assign the whole mission pack with one tap. Missions land in your kid&apos;s
        normal Today checklist; when every mission in a level is approved, they earn a trait-level badge and their
        skill meters grow.
      </p>

      {props.childProfiles.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {props.childProfiles.map((kid) => (
            <button
              key={kid.id}
              onClick={() => props.onSelectChild?.(kid.id)}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-black ${
                child?.id === kid.id ? "bg-[#6d3ed1] text-white" : "bg-[#f0edff] text-[#6d3ed1]"
              }`}
            >
              {kid.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHARACTER_TRAITS.map((entry) => {
          const entrySummary = summary.find((item) => item.traitKey === entry.key);
          const isActive = entry.key === selectedTrait;
          return (
            <button
              key={entry.key}
              onClick={() => { setSelectedTrait(entry.key); setSelectedLevel(0); }}
              className={`rounded-lg border p-4 text-left ${isActive ? "border-[#6d3ed1] ring-2 ring-[#6d3ed1]/30" : "border-[#ded8c7]"}`}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-2xl ${entry.colors}`}>
                <span aria-hidden="true">{entry.emoji}</span>
              </div>
              <p className="mt-2 text-lg font-black">{entry.label}</p>
              <p className="mt-1 text-xs font-bold text-[#4f625b]">{entry.blurb}</p>
              <p className="mt-2 text-xs font-black text-[#6d3ed1]">
                {entrySummary ? `${entrySummary.levelsDone} of 3 levels complete` : "No kid selected"}
              </p>
              <div className="mt-2 flex gap-1">
                {entrySummary?.levels.map((levelEntry) => (
                  <span
                    key={levelEntry.levelIndex}
                    title={`${levelEntry.levelName}: ${levelEntry.done ? "complete" : `${levelEntry.approvedCount}/${levelEntry.total} missions approved`}`}
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      levelEntry.done ? "bg-[#6d3ed1] text-white" : "bg-[#ede8db] text-[#69736f]"
                    }`}
                  >
                    {levelEntry.done ? "★" : levelEntry.levelIndex + 1}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {trait.levels.map((levelEntry) => (
          <button
            key={levelEntry.index}
            onClick={() => setSelectedLevel(levelEntry.index)}
            className={`min-h-11 rounded-full px-4 py-2 text-sm font-black ${
              levelEntry.index === selectedLevel ? "bg-[#165a4b] text-white" : "bg-[#e7f4ef] text-[#165a4b]"
            }`}
          >
            {levelEntry.name} · {levelEntry.ageBand}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-[#faf8f0] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-black">
              {trait.emoji} {trait.label} — {level.name}
            </p>
            <p className="mt-1 text-sm font-semibold text-[#4f625b]">{level.tagline}</p>
            {levelStatus && (
              <p className="mt-1 text-xs font-black text-[#6d3ed1]">
                {levelStatus.done
                  ? "★ Level complete — badge earned"
                  : `${levelStatus.approvedCount} of ${levelStatus.total} missions approved`}
                {openCount > 0 && !levelStatus.done ? ` · ${openCount} already on the checklist` : ""}
              </p>
            )}
          </div>
          <button
            onClick={() => child && props.assignCurriculumMissions(selectedTrait, selectedLevel, child.id)}
            disabled={!child || (levelStatus?.done ?? false)}
            className="min-h-11 shrink-0 rounded-lg bg-[#6d3ed1] px-5 py-2 text-sm font-black text-white disabled:bg-[#ede8db] disabled:text-[#69736f]"
          >
            {levelStatus?.done
              ? "Level complete ★"
              : child
                ? `Assign all ${level.missions.length} to ${child.name}`
                : "Add a kid first"}
          </button>
        </div>
        {!props.hasPets && (
          <p className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-xs font-bold text-[#165a4b]">
            No-pet family: pet missions automatically use their no-pet alternative, so every mission is doable.
          </p>
        )}
        <div className="mt-3 grid gap-2">
          {level.missions.map((missionTemplate) => {
            const useNoPet = !props.hasPets && Boolean(missionTemplate.noPetTitle);
            const ageFit = child
              ? child.age >= missionTemplate.minAge && child.age <= missionTemplate.maxAge
              : true;
            return (
              <div key={missionTemplate.key} className="rounded-lg border border-[#ded8c7] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black ring-1 ring-[#ded8c7]">{levelLabels[missionTemplate.difficulty]}</span>
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{missionTemplate.points} pts</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${ageFit ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
                    Ages {missionTemplate.minAge}–{missionTemplate.maxAge}{ageFit ? "" : " · parent help"}
                  </span>
                  {useNoPet && (
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#2563eb]">No-pet version</span>
                  )}
                  {openKeysForLevel.has(missionTemplate.key) && (
                    <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6d3ed1]">On checklist</span>
                  )}
                </div>
                <p className="mt-2 text-sm font-black">{useNoPet ? missionTemplate.noPetTitle : missionTemplate.title}</p>
                <p className="mt-1 text-xs font-semibold text-[#4f625b]">{useNoPet ? missionTemplate.noPetQuestion : missionTemplate.question}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** R2-30: mood emoji for memory-moment cards in the growth log. */
const MOOD_EMOJI: Record<MemoryMoment["mood"], string> = {
  kind: "💛",
  silly: "😄",
  cranky: "😤",
  proud: "🏆",
  helper: "🤝",
};

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
  assignCurriculumMissions: (traitKey: CharacterTraitKey, levelIndex: number, childId: string) => void;
  transactions: BankTransaction[];
}) {
  // Phase 3 — PERMA Growth Log: local flourishing snapshot for the active
  // child, computed deterministically from missions + badges + Kid Bank.
  // Labeled "Built-in celebration" (mode: deterministic) — the signed-in
  // server route /api/ai/flourishing is the authoritative weekly snapshot.
  const flourishingSnapshot: FlourishingSnapshot | null = useMemo(() => {
    const childId = props.activeChildId ?? props.childProfiles[0]?.id;
    if (!childId) return null;
    const now = new Date().toISOString();
    const childMissions = props.missions.filter(
      (m) => m.assignedChildId === childId || m.completedBy === childId,
    );
    const events: FlourishEventInput[] = [];
    for (const m of childMissions) {
      events.push({
        eventType: "assigned",
        taskId: m.id,
        category: m.category,
        difficulty: m.difficulty,
        createdAt: now,
      });
      if (m.status === "approved") {
        events.push({ eventType: "started", taskId: m.id, category: m.category, difficulty: m.difficulty, createdAt: now });
        events.push({ eventType: "completed", taskId: m.id, category: m.category, difficulty: m.difficulty, createdAt: now });
      }
    }
    const badges: FlourishBadgeInput[] = props.badges
      .filter((b) => b.childId === childId)
      .map((b) => ({ skill: b.skill, earnedAt: b.awardedAt ?? now }));
    const bank: FlourishBankInput[] = props.transactions
      .filter((t) => t.childId === childId)
      .map((t) => ({ category: t.category, amount: t.amount, approved: t.status === "approved" }));
    if (events.length === 0 && badges.length === 0 && bank.length === 0) return null;
    const scores = computeFlourishScores(events, badges, bank, undefined, Date.now());
    return buildFlourishingSnapshot(
      childId,
      scores,
      undefined,
      flourishFallbackNarrative(brightestPillar(scores)),
      "deterministic",
      Date.now(),
    );
  }, [props.activeChildId, props.childProfiles, props.missions, props.badges, props.transactions]);
  const flourishingChild = props.childProfiles.find((c) => c.id === (props.activeChildId ?? props.childProfiles[0]?.id));
  // R2-30: life skills summarized per family (getFamilySkillSummary is read-only).
  const familySkills = getFamilySkillSummary(props.badges, props.childProfiles);
  const skillCounts = (["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => ({
    skill,
    label: skill === "time" ? "Time mgmt" : skill,
    count: props.badges.filter((badge) => badge.skill === skill && props.childProfiles.some((child) => child.id === badge.childId)).length,
  }));
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Character growth</p>
      <h2 className="mt-2 text-3xl font-black">Responsibility, empathy, kindness, leadership</h2>
      {/* Phase 3 — PERMA Growth Log: weekly flourishing bloom (parent view). */}
      <div className="mt-5">
        <FlourishingPanel snapshot={flourishingSnapshot} childName={flourishingChild?.name ?? "your child"} />
      </div>
      {/* R2-30: memory moments are the hero of the growth log. */}
      <div className="mt-5 overflow-hidden rounded-2xl border-2 border-[#6d3ed1]/25 bg-gradient-to-br from-[#f0edff] via-white to-[#faf8f0]">
        <div className="p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">🌟 Relive memory moments</p>
          <h3 className="mt-2 text-2xl font-black">The moments that made them proud</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
            {props.moments.length === 0
              ? "No moments saved yet — capture the first proud, kind, or silly moment below."
              : `${props.moments.length} moment${props.moments.length === 1 ? "" : "s"} worth reliving, saved by your family.`}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              placeholder="e.g. Maya waited calmly while Jack drank water…"
              className="min-w-0 flex-1 rounded-lg border border-[#ded8c7] bg-white px-3 py-3 font-semibold"
              value={props.momentDraft}
              onChange={(event) => props.setMomentDraft(event.target.value)}
            />
            <button onClick={props.addMoment} className="rounded-lg bg-[#6d3ed1] px-5 py-3 text-sm font-black text-white">Save moment</button>
          </div>
        </div>
        {props.moments.length > 0 && (
          <div className="grid gap-3 border-t border-[#6d3ed1]/15 bg-white/60 p-5 sm:grid-cols-2">
            {props.moments.map((moment) => {
              const child = props.childProfiles.find((entry) => entry.id === moment.childId);
              return (
                <article key={moment.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#ded8c7]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{MOOD_EMOJI[moment.mood]}</span>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#4f625b]">
                      {child?.name ?? "Family"} · feeling {moment.mood}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#17231f]">“{moment.note}”</p>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {/* R2-30: life skills, summarized per family. */}
      <div className="mt-5 rounded-lg bg-[#faf8f0] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Family life skills</p>
          <p className="text-sm font-black text-[#17231f]">{familySkills.topLabel} · {familySkills.totalBadges} badge{familySkills.totalBadges === 1 ? "" : "s"} earned</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {skillCounts.map(({ skill, label, count }) => (
            <div key={skill} className="rounded-lg bg-white p-3 text-center">
              <p className="text-2xl font-black text-[#6d3ed1]">{count}</p>
              <p className="mt-1 text-xs font-black capitalize text-[#4f625b]">{label}</p>
            </div>
          ))}
        </div>
      </div>
      <CharacterCurriculumPanel
        childProfiles={props.childProfiles}
        missions={props.missions}
        badges={props.badges}
        activeChildId={props.activeChildId}
        onSelectChild={props.onSelectChild}
        hasPets={props.hasPets}
        assignCurriculumMissions={props.assignCurriculumMissions}
      />
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
      {/* Safe social practice now lives in the kid's AI Buddy tab (parent-visible). */}
    </section>
  );
}

/**
 * R2-27: Skill Job Builder — extracted from NeighborhoodPanel into a
 * standalone component so it can live in Parent Review (ApprovalsPanel).
 * Parents start from the life skill they want to teach; "Use template" fills
 * the job draft, and the parent finishes + posts it from the Neighborhood tab.
 */
const SKILL_JOB_TEMPLATES: Array<[skill: string, title: string, detail: string]> = [
  ["Responsibility", "Morning pet check for a trusted neighbor", "Easy checklist, parent photo proof, 10-14 points"],
  ["Empathy", "Make a comfort card for a newly adopted pet", "Kindness badge, no money needed"],
  ["Teamwork", "Two-kid supply sorting task with parent", "Split points fairly, one shared family badge"],
  ["Leadership", "Older kid teaches a younger kid safe pet observation", "Higher points, parent nearby"],
];

function SkillJobBuilder({ fillJobTemplate, onUseTemplate }: {
  fillJobTemplate: (skill: string) => void;
  onUseTemplate?: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">Skill job builder</p>
      <h3 className="mt-2 text-2xl font-black">Post a job around the life skill you want to teach</h3>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
        Parents can start from a value, not just a task. TailTots can suggest checklist, points, money, and badge language before anything is visible to kids or neighbors.
        Using a template fills the job draft — finish and post it from the Neighborhood tab.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {SKILL_JOB_TEMPLATES.map(([skill, title, detail]) => (
          <article key={skill} className="rounded-lg bg-[#f0edff] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">{skill}</p>
            <p className="mt-2 text-base font-black leading-5">{title}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#4f625b]">{detail}</p>
            <button
              onClick={() => { fillJobTemplate(skill); onUseTemplate?.(); }}
              className="mt-3 min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#4c1d95]"
            >
              Use template
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * R2-28: "Share with family", defined once and shown wherever sharing happens.
 * Sharing means: the parent picks a giving goal or a neighborhood job, and
 * TailTots builds a family-safe summary — the title, the cause, and the
 * parent's first name only. No kid names, photos, ages, or addresses ever
 * leave this device. Extended family (grandparents, aunts, uncles) sees the
 * summary and chips in through the parent. Sharing is always
 * parent-initiated; goal links can be revoked any time.
 */
function ShareWithFamilyExplainer({ role }: { role: Role }) {
  return (
    <div className="rounded-lg bg-[#faf8f0] p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">What “share with family” means</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#17231f]">
        {role === "parent"
          ? "You pick a giving goal or a neighborhood job. TailTots makes a family-safe summary — the title, the cause, and your first name. Nothing else leaves this app: no kid names, photos, ages, or addresses. Grandparents, aunts, and uncles see the summary and chip in through you. Sharing is always started by you, and a goal link can be revoked any time."
          : "Grown-ups can share some goals with grandparents and family so they can cheer you on and chip in. Family never sees your name, photo, or details — only what your grown-up wrote."}
      </p>
    </div>
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
  transactions,
  setActiveTab,
  allMissions,
  toggleMissionVisibility,
  toggleGoalVisibility,
  familyZip,
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
  // Family share-link composer (parent only): the parent reviews the exact
  // goal name / cause / message family will see before a link is created.
  const [shareComposerFor, setShareComposerFor] = useState<string | null>(null);
  const [shareForm, setShareForm] = useState({ goalTitle: "", cause: "", parentName: "", parentMessage: "" });

  function openShareComposer(goal: SavingsGoal) {
    const defaults = buildShareInputFromGoal(goal);
    setShareForm({ goalTitle: defaults.goalTitle, cause: defaults.cause, parentName: "", parentMessage: defaults.parentMessage });
    setShareComposerFor(goal.id);
  }

  /** Generate the family share link — parent-initiated, unguessable id, no kid details stored. */
  async function createGoalShare(goal: SavingsGoal) {
    await givingShareStore.createShare(
      buildShareInputFromGoal(goal, {
        goalTitle: shareForm.goalTitle,
        cause: shareForm.cause,
        parentName: shareForm.parentName,
        parentMessage: shareForm.parentMessage,
      })
    );
    setShareComposerFor(null);
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
  // R2-29: zipcode-based jobs — when the family's ZIP is set, only jobs in
  // that ZIP show. Jobs without a ZIP are the family's own posts (or legacy
  // demo data) and always show.
  const zipReady = familyZip.length === 5;
  const visibleJobs = (
    role === "parent"
      ? jobs
      : jobs.filter((job) => job.visibleToKids && activeChild && job.assignedChildIds.includes(activeChild.id) && activeChild.age >= (job.minAge ?? 0))
  ).filter((job) => jobVisibleInZip(job.zip, familyZip));
  // Step 1 of the parent-gated flow: the parent picks from a popup which
  // posted neighborhood jobs are allowed. Only allowed jobs reach kid profiles.
  const [jobPickerOpen, setJobPickerOpen] = useState(false);
  const postedJobs = jobs.filter((job) => job.status === "posted").filter((job) => jobVisibleInZip(job.zip, familyZip));
  // R2-28: "share with family" on jobs — copies a sanitized summary (no kid
  // details) for the parent to paste into their own family chat.
  const [jobShareCopiedId, setJobShareCopiedId] = useState<string | null>(null);
  // R2-29: neighborhood friends — local-first demo, saved on this device only.
  const [neighborFriendIds, setNeighborFriendIds] = useState<string[]>([]);
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
  /** R2-28: copy a sanitized, family-safe job summary — never kid/family PII. */
  async function shareJobWithFamily(job: NeighborhoodJob) {
    const text = buildJobFamilySummary({
      title: job.title,
      pet: job.pet,
      time: job.time,
      rewardDollars: job.rewardDollars,
      badgeTitle: job.badgeTitle,
      skillLabel: getLifeSkillLabel(job.skillFocus ?? "teamwork"),
      safety: job.safety,
    });
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setJobShareCopiedId(job.id);
        window.setTimeout(() => setJobShareCopiedId((current) => (current === job.id ? null : current)), 2500);
      }
    } catch {
      /* clipboard unavailable — the goal share links still work */
    }
  }
  /** R2-29: local-first friends toggle for the demo nearby-families list. */
  function toggleNeighborFriend(id: string) {
    setNeighborFriendIds((ids) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]));
  }
  const friendFamilies = zipReady
    ? nearbyFamilies(familyZip).filter((family) => neighborFriendIds.includes(family.id))
    : [];
  const privacyRules = [
    "Parents approve every job before it appears to kids.",
    "Kids do not see addresses, phone numbers, or adult contact details.",
    "Applications show parent names and family intent first, not public child profiles.",
    "Completion proof goes to parents only before money, points, or badges are awarded.",
  ];

  return (
    <section className="space-y-4">
      {role === "parent" && (
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet jobs and safe playdates</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
          Parents post and approve every detail before kids can see anything. Kids only see parent-approved helper jobs, simple checklists, and rewards that teach responsibility, empathy, teamwork, leadership, and time management.
        </p>
      </div>
      )}

      {role === "parent" && (
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
      )}

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

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">{role === "parent" ? "Job pipeline" : "Jobs for you"}</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Kid confirmations waiting for final approval" : "Confirm a job, then wait for grown-up approval"}</h3>
        {zipReady && (
          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#2563eb]">Showing jobs in {familyZip} — your area</p>
        )}
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
                  <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_auto_1fr]">
                    <button
                      onClick={() => toggleJobVisibility(job.id)}
                      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${job.visibleToKids ? "bg-white text-[#b44421]" : "bg-[#2563eb] text-white"}`}
                    >
                      {job.visibleToKids ? "Remove kid visibility" : "Approve for kids to see"}
                    </button>
                    <button onClick={() => approveJob(job.id)} disabled={job.status !== "accepted"} className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:bg-[#b9b2a2]">Make final and add to Today</button>
                    <button
                      onClick={() => shareJobWithFamily(job)}
                      title="Copy a family-safe summary (no kid details) to paste into your family chat"
                      className="min-h-11 rounded-lg border border-[#165a4b] bg-white px-4 py-2 text-sm font-black text-[#165a4b]"
                    >
                      {jobShareCopiedId === job.id ? "Summary copied ✓" : "Share with family"}
                    </button>
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
        <div className="mt-4">
          <ShareWithFamilyExplainer role={role} />
        </div>
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
                  <>
                    <button
                      onClick={() => (shareComposerFor === goal.id ? setShareComposerFor(null) : openShareComposer(goal))}
                      className="mt-2 min-h-11 w-full rounded-lg border border-[#165a4b] bg-white px-4 py-2 text-sm font-black text-[#165a4b]"
                    >
                      {shareComposerFor === goal.id ? "Cancel sharing" : "Share this goal with family"}
                    </button>
                    {shareComposerFor === goal.id && (
                      <div className="mt-2 rounded-lg border-2 border-[#165a4b] bg-white p-3">
                        <p className="text-xs font-black text-[#165a4b]">
                          Family sees exactly what you write below — no kid names, no kid details.
                        </p>
                        <label className="mt-2 block">
                          <span className="text-xs font-black">Goal name (what family sees)</span>
                          <input
                            value={shareForm.goalTitle}
                            onChange={(e) => setShareForm((f) => ({ ...f, goalTitle: e.target.value }))}
                            maxLength={80}
                            className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#ded8c7] px-3 py-2 text-sm font-bold"
                          />
                        </label>
                        <label className="mt-2 block">
                          <span className="text-xs font-black">Cause (what family sees)</span>
                          <input
                            value={shareForm.cause}
                            onChange={(e) => setShareForm((f) => ({ ...f, cause: e.target.value }))}
                            maxLength={80}
                            className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#ded8c7] px-3 py-2 text-sm font-bold"
                          />
                        </label>
                        <label className="mt-2 block">
                          <span className="text-xs font-black">Your first name (what family sees)</span>
                          <input
                            value={shareForm.parentName}
                            onChange={(e) => setShareForm((f) => ({ ...f, parentName: e.target.value }))}
                            placeholder="e.g. Priya"
                            maxLength={40}
                            className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#ded8c7] px-3 py-2 text-sm font-bold"
                          />
                        </label>
                        <label className="mt-2 block">
                          <span className="text-xs font-black">A warm note to family</span>
                          <textarea
                            value={shareForm.parentMessage}
                            onChange={(e) => setShareForm((f) => ({ ...f, parentMessage: e.target.value }))}
                            maxLength={280}
                            rows={3}
                            className="mt-1 w-full rounded-lg border-2 border-[#ded8c7] px-3 py-2 text-sm font-bold"
                          />
                        </label>
                        <button
                          onClick={() => createGoalShare(goal)}
                          disabled={!shareForm.goalTitle.trim()}
                          className="mt-3 min-h-11 w-full rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:opacity-40"
                        >
                          Create family share link
                        </button>
                        <p className="mt-1 text-center text-[11px] font-semibold text-[#a09a8c]">
                          Unguessable link · you can revoke it any time
                        </p>
                      </div>
                    )}
                    <GoalFamilyShareLinks goalId={goal.id} />
                  </>
                )}
              </article>
            );
          })}
          {sharedGoals.length === 0 && (
            <p className="rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold text-[#4f625b]">
              {role === "parent"
                ? "No shared goals yet. Create a giving goal in Kid Bank, share it, then create a family share link so grandparents can chip in."
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
            Make friends with TailTots families in your ZIP code. Demo preview: families are anonymized and parent-gated — in the real app only opted-in families appear, and no child information is ever shown.
          </p>
          {!zipReady ? (
            <div className="mt-4 rounded-lg bg-[#faf8f0] p-4">
              <p className="text-sm font-black text-[#17231f]">🗺️ Set your ZIP code in Family setup</p>
              <p className="mt-1 text-sm font-semibold text-[#4f625b]">
                Add your ZIP in Family setup to discover nearby families and see neighborhood jobs in your area.
              </p>
            </div>
          ) : (
            <>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-[#2563eb]">Families near {familyZip}</p>
              {friendFamilies.length > 0 && (
                <div className="mt-3 rounded-lg bg-[#e7f4ef] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">
                    Your neighborhood friends ({friendFamilies.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {friendFamilies.map((family) => (
                      <span key={family.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#17231f]">
                        🤝 {family.name}
                        <button
                          onClick={() => toggleNeighborFriend(family.id)}
                          aria-label={`Remove ${family.name} from friends`}
                          className="rounded-full bg-[#faf8f0] px-2 py-0.5 text-[#b44421]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-[#4f625b]">
                    Demo: friends are saved on this device only. In the real app both families opt in — and no child details are ever shown.
                  </p>
                </div>
              )}
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {nearbyFamilies(familyZip).map((family) => {
                  const isFriend = neighborFriendIds.includes(family.id);
                  return (
                    <article key={family.id} className="rounded-lg bg-[#faf8f0] p-4">
                      <p className="text-base font-black">{family.name}</p>
                      <p className="mt-1 text-xs font-black text-[#2563eb]">{family.distance}</p>
                      <p className="mt-1 text-sm font-semibold text-[#4f625b]">{family.detail}</p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#69736f]">Demo family · anonymized</p>
                      <button
                        onClick={() => toggleNeighborFriend(family.id)}
                        className={`mt-3 min-h-10 w-full rounded-lg px-3 py-2 text-xs font-black ${isFriend ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#2563eb] text-white"}`}
                      >
                        {isFriend ? "✓ Friends" : "＋ Add as friend"}
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

    </section>
  );
}

/**
 * Parent-side list of active family share links for one goal: copy the
 * link or a warm family message, or revoke a link. Revoked links stop
 * working everywhere (cross-tab sync) and show a friendly inactive state.
 */
function GoalFamilyShareLinks({ goalId }: { goalId: string }) {
  const [shares, setShares] = useState<GivingShareRecord[]>([]);
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);
  const [messageCopiedId, setMessageCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await givingShareStore.listShares(goalId);
      if (!cancelled) setShares(list.filter((share) => share.status === "active"));
    }
    load();
    const unsubscribe = givingShareStore.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [goalId]);

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
        return true;
      } catch {
        return false;
      }
    }
  }

  function flash(setter: React.Dispatch<React.SetStateAction<string | null>>, id: string) {
    setter(id);
    window.setTimeout(() => setter((current) => (current === id ? null : current)), 2500);
  }

  async function revokeShare(id: string) {
    if (!window.confirm("Stop sharing this link? Family will see that it is no longer active.")) return;
    await givingShareStore.revokeShare(id);
  }

  if (shares.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg bg-[#faf8f0] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">
        Family share links ({shares.length})
      </p>
      <div className="mt-2 space-y-2">
        {shares.map((share) => (
          <div key={share.id} className="rounded-lg border border-[#ded8c7] bg-white p-3">
            <p className="break-all text-xs font-bold text-[#4f625b]">{givingShareUrl(share.id)}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#a09a8c]">
              Created {new Date(share.createdAt).toLocaleDateString()} · &ldquo;{share.goalTitle}&rdquo;
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  if (await copyText(givingShareUrl(share.id))) flash(setLinkCopiedId, share.id);
                }}
                className="min-h-10 rounded-lg bg-[#165a4b] px-3 py-1.5 text-xs font-black text-white"
              >
                {linkCopiedId === share.id ? "Link copied ✓" : "Copy link"}
              </button>
              <button
                onClick={async () => {
                  if (await copyText(familyShareMessage(share))) flash(setMessageCopiedId, share.id);
                }}
                className="min-h-10 rounded-lg border border-[#165a4b] px-3 py-1.5 text-xs font-black text-[#165a4b]"
              >
                {messageCopiedId === share.id ? "Message copied ✓" : "Copy family message"}
              </button>
              <button
                onClick={() => revokeShare(share.id)}
                className="min-h-10 rounded-lg px-3 py-1.5 text-xs font-black text-[#b3541e] hover:bg-[#fdeee4]"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
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

    </section>
  );
}

void LegacyNeighborhoodPanel;

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
        <div className="absolute -left-2 top-5 h-7 w-6 rounded-l-full bg-[#38bdf8] [clip-path:polygon(100%_50%,0_0,0_100%)] origin-right animate-[tail-wag_1.8s_ease-in-out_infinite]" />
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
        <div className="absolute -left-1 top-8 h-8 w-7 bg-[#38bdf8] [clip-path:polygon(100%_50%,0_0,0_100%)] origin-right animate-[tail-wag_1.8s_ease-in-out_infinite]" />
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

/** Kid-friendly chip label for a curriculum-tagged mission, e.g. "🌱 Responsibility · Sprout". */
function curriculumMissionLabel(mission: Mission): string | null {
  if (!mission.curriculum) return null;
  const trait = traitByKey(mission.curriculum.trait);
  const level = trait.levels[mission.curriculum.level];
  if (!level) return null;
  return `${trait.emoji} ${trait.label} · ${level.name}`;
}
