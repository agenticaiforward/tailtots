/**
 * Zod schemas for the persisted family snapshot.
 *
 * Used when restoring from localStorage and when writing/reading the
 * Supabase `family_account_snapshots` jsonb column. Corrupt or hostile
 * payloads fail closed: `safeParseFamilyState` returns a failure result
 * instead of throwing, and callers fall back to a clean state.
 */
import { z } from "zod";
import type { SavedFamilyState } from "@/lib/domain/family-types";

const levelKeySchema = z.enum(["easy", "medium", "hard", "super_hard"]);
const approvalStatusSchema = z.enum(["pending", "approved", "rejected"]);
const bankCategorySchema = z.enum(["earn", "save", "spend", "give"]);
const lifeSkillSchema = z.enum(["responsibility", "empathy", "teamwork", "leadership", "time"]);
const trustSignalSchema = z.enum(["parent_gate", "age_fit", "no_messaging", "adult_nearby", "private_child"]);
const missionCategorySchema = z.enum(["pet_care", "chore", "kindness", "money", "community"]);

const childSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  age: z.number().int().min(3).max(18),
  secretCode: z.string().max(32).default(""),
  photoUrl: z.string().max(2048).optional(),
  points: z.number().int().min(0).default(0),
  coins: z.number().int().min(0).default(0),
  level: levelKeySchema.default("easy"),
  streakDays: z.number().int().min(0).default(0),
});

const petSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  species: z.string().min(1).max(64),
  favoriteFood: z.string().max(128).default(""),
  careNotes: z.string().max(1024).default(""),
  vet: z.string().max(128).default(""),
  medicine: z.string().max(256).default(""),
  photoUrl: z.string().max(2048).optional(),
});

const missionSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  category: missionCategorySchema,
  difficulty: levelKeySchema,
  points: z.number().int().min(0).max(1000),
  coins: z.number().int().min(0).max(1000),
  allowanceDollars: z.number().min(0).max(10000).optional(),
  assignedChildId: z.string().max(64).optional(),
  petId: z.string().max(64).optional(),
  question: z.string().max(512).default(""),
  status: approvalStatusSchema,
  completedBy: z.string().max(64).optional(),
  note: z.string().max(1024).optional(),
});

const bankTransactionSchema = z.object({
  id: z.string().min(1).max(64),
  childId: z.string().min(1).max(64),
  category: bankCategorySchema,
  amount: z.number().min(0).max(100000),
  description: z.string().min(1).max(256),
  activityId: z.string().max(64).optional(),
  goalId: z.string().max(64).optional(),
  status: approvalStatusSchema,
});

const savingsGoalSchema = z.object({
  id: z.string().min(1).max(64),
  childId: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  target: z.number().min(0).max(1000000),
  saved: z.number().min(0).max(1000000),
  type: z.enum(["toy", "pet_food", "treats", "donation", "family_reward"]),
  sharedWithTrustedFamilies: z.boolean().optional(),
  causeNote: z.string().max(512).optional(),
});

const badgeAwardSchema = z.object({
  id: z.string().min(1).max(64),
  childId: z.string().min(1).max(64),
  title: z.string().min(1).max(128),
  skill: lifeSkillSchema,
  note: z.string().max(1024).default(""),
  awardedAt: z.string().max(64).default(""),
});

const neighborhoodJobSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  family: z.string().min(1).max(128),
  pet: z.string().min(1).max(128),
  time: z.string().max(128).default(""),
  rewardDollars: z.number().min(0).max(100000).default(0),
  badgeTitle: z.string().max(128).default("Trusted Helper"),
  assignedChildIds: z.array(z.string().max(64)).default([]),
  visibleToKids: z.boolean().default(false),
  checklist: z.array(z.string().max(256)).default([]),
  safety: z.string().max(1024).default(""),
  minAge: z.number().int().min(3).max(18).optional(),
  skillFocus: lifeSkillSchema.optional(),
  trustSignals: z.array(trustSignalSchema).optional(),
  status: z.enum(["posted", "accepted", "approved", "completed"]).default("posted"),
  acceptedBy: z.string().max(64).optional(),
  missionId: z.string().max(64).optional(),
  groupId: z.string().max(64).optional(),
});

const neighborhoodGroupSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(48),
  note: z.string().max(80).default(""),
  inviteCode: z.string().min(1).max(16),
  memberNames: z.array(z.string().max(64)).default([]),
  createdAt: z.string().max(64).default(""),
});

const memoryMomentSchema = z.object({
  id: z.string().min(1).max(64),
  childId: z.string().min(1).max(64),
  petId: z.string().max(64).optional(),
  mood: z.enum(["kind", "silly", "cranky", "proud", "helper"]),
  note: z.string().min(1).max(1024),
});

const readinessSignOffSchema = z.object({
  milestoneId: z.string().min(1).max(64),
  childId: z.string().min(1).max(64),
  signedAt: z.string().max(64).default(""),
});

const parentProfileSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  photoUrl: z.string().max(2048).optional(),
});

export const savedFamilyStateSchema = z.object({
  familyName: z.string().max(128).optional(),
  // Never persisted to disk by the app, but accepted on restore for
  // forward compatibility; always re-stripped before saving.
  parentPasscode: z.string().max(32).optional(),
  parents: z.array(parentProfileSchema).default([]),
  children: z.array(childSchema).default([]),
  pets: z.array(petSchema).default([]),
  missions: z.array(missionSchema).default([]),
  transactions: z.array(bankTransactionSchema).default([]),
  goals: z.array(savingsGoalSchema).default([]),
  badges: z.array(badgeAwardSchema).default([]),
  neighborhoodJobs: z.array(neighborhoodJobSchema).default([]),
  neighborhoodGroups: z.array(neighborhoodGroupSchema).default([]),
  moments: z.array(memoryMomentSchema).default([]),
  familyPhotoUrl: z.string().max(8192).optional(),
  activeChildId: z.string().max(64).optional(),
  readinessSignOffs: z.array(readinessSignOffSchema).default([]),
});

export type SavedFamilyStateInput = z.input<typeof savedFamilyStateSchema>;

export function safeParseFamilyState(value: unknown):
  | { ok: true; state: SavedFamilyState }
  | { ok: false; issues: string } {
  const result = savedFamilyStateSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, state: result.data as SavedFamilyState };
}
