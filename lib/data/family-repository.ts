/**
 * Family data repository: snapshots, the parent-owned family bundle,
 * and the child secret-code RPCs.
 *
 * Snapshots are validated with zod on both write and read so a corrupt or
 * hostile `snapshot` jsonb row can never crash the app or poison types.
 */
import type { ApprovalStatus, BankCategory, LevelKey, Mission, SavingsGoal } from "@/lib/types";
import type { LifeSkillKey, SavedFamilyState } from "@/lib/domain/family-types";
import { AppError, ErrorCode, notConfiguredError, toUserMessage } from "@/lib/errors/app-error";
import { createLogger } from "@/lib/logging/logger";
import { safeParseFamilyState } from "@/lib/validation/family";
import { getSupabaseClient } from "./supabase-client";
import { requireCurrentUser } from "./auth";

const log = createLogger("data:family-repository");
const NOT_READY_MESSAGE = "Parent accounts are being prepared. Please try the demo for now.";

export type { LifeSkillKey };

export type BackendChild = {
  id: string;
  family_id: string;
  display_name: string;
  level_key: LevelKey;
  points: number;
  coins: number;
  streak_days: number;
};

export type BackendPet = {
  id: string;
  family_id: string;
  name: string;
  species: string;
  favorite_food: string | null;
  care_notes: string | null;
};

export type BackendBadgeAward = {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  skill: LifeSkillKey;
  note: string;
  awarded_at: string;
};

export type BackendNeighborhoodJob = {
  id: string;
  family_id: string;
  title: string;
  neighbor_family_name: string;
  pet_name: string;
  scheduled_for: string;
  reward_cents: number;
  badge_title: string;
  assigned_child_ids: string[];
  checklist: string[];
  safety_note: string;
  status: "posted" | "accepted" | "approved" | "completed" | "cancelled";
  accepted_by_child_id: string | null;
  task_id: string | null;
};

export type BackendFamilyBundle = {
  family: { id: string; name: string; care_motto: string | null };
  children: BackendChild[];
  pets: BackendPet[];
  tasks: Array<{
    id: string;
    family_id: string;
    pet_id: string | null;
    title: string;
    category: Mission["category"];
    difficulty: LevelKey;
    points: number;
    coins: number;
    is_active: boolean;
  }>;
  completions: Array<{
    id: string;
    task_id: string;
    child_id: string;
    status: ApprovalStatus;
    child_note: string | null;
  }>;
  bankTransactions: Array<{
    id: string;
    child_id: string;
    category: BankCategory;
    amount_cents: number;
    description: string;
    status: ApprovalStatus;
  }>;
  savingsGoals: Array<{
    id: string;
    child_id: string;
    title: string;
    target_cents: number;
    saved_cents: number;
    goal_type: SavingsGoal["type"];
  }>;
  badges: BackendBadgeAward[];
  neighborhoodJobs: BackendNeighborhoodJob[];
};

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw notConfiguredError(NOT_READY_MESSAGE);
  return client;
}

function wrapDbError(scope: string, error: unknown): AppError {
  log.error(scope, { error });
  return new AppError(ErrorCode.NETWORK, toUserMessage(error), { cause: error });
}

export async function saveFamilyAccountSnapshot(snapshot: SavedFamilyState): Promise<void> {
  const parsed = safeParseFamilyState(snapshot);
  if (!parsed.ok) {
    throw new AppError(ErrorCode.VALIDATION, "This family snapshot looks damaged and was not saved.", {
      cause: parsed.issues,
    });
  }
  const client = requireClient();
  const user = await requireCurrentUser();

  const { error } = await client.from("family_account_snapshots").upsert({
    auth_user_id: user.id,
    snapshot: parsed.state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw wrapDbError("saveFamilyAccountSnapshot failed", error);
}

export async function loadFamilyAccountSnapshot(): Promise<SavedFamilyState | null> {
  const client = requireClient();
  const user = await requireCurrentUser();

  const { data, error } = await client
    .from("family_account_snapshots")
    .select("snapshot")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) throw wrapDbError("loadFamilyAccountSnapshot failed", error);

  const raw = (data as { snapshot?: unknown } | null)?.snapshot ?? null;
  if (raw === null) return null;
  const parsed = safeParseFamilyState(raw);
  if (!parsed.ok) {
    log.warn("Discarding invalid family snapshot from cloud", { issues: parsed.issues });
    return null;
  }
  return parsed.state;
}

export async function createFamilyForCurrentUser(familyName: string, parentDisplayName: string): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.rpc("create_family_for_current_user", {
    family_name: familyName,
    parent_display_name: parentDisplayName,
  });
  if (error) throw wrapDbError("createFamilyForCurrentUser failed", error);
  return data as string;
}

export async function loadPrimaryFamilyBundle(): Promise<BackendFamilyBundle | null> {
  const client = requireClient();
  const user = await requireCurrentUser();

  const { data: parentRows, error: parentError } = await client
    .from("parents")
    .select("family_id")
    .eq("auth_user_id", user.id)
    .limit(1);
  if (parentError) throw wrapDbError("loadPrimaryFamilyBundle(parents) failed", parentError);
  const familyId = (parentRows as Array<{ family_id: string }> | null)?.[0]?.family_id;
  if (!familyId) return null;

  const [
    familyResult,
    childrenResult,
    petsResult,
    tasksResult,
    completionsResult,
    bankResult,
    goalsResult,
    badgesResult,
    jobsResult,
  ] = await Promise.all([
    client.from("families").select("id,name,care_motto").eq("id", familyId).single(),
    client.from("children").select("id,family_id,display_name,level_key,points,coins,streak_days").eq("family_id", familyId).order("created_at"),
    client.from("pets").select("id,family_id,name,species,favorite_food,care_notes").eq("family_id", familyId).order("created_at"),
    client.from("tasks").select("id,family_id,pet_id,title,category,difficulty,points,coins,is_active").eq("family_id", familyId).eq("is_active", true).order("created_at"),
    client.from("task_completions").select("id,task_id,child_id,status,child_note").order("completed_at", { ascending: false }),
    client.from("kid_bank_transactions").select("id,child_id,category,amount_cents,description,status").order("created_at", { ascending: false }),
    client.from("savings_goals").select("id,child_id,title,target_cents,saved_cents,goal_type").order("created_at", { ascending: false }),
    client.from("badge_awards").select("id,family_id,child_id,title,skill,note,awarded_at").eq("family_id", familyId).order("awarded_at", { ascending: false }),
    client.from("neighborhood_jobs").select("id,family_id,title,neighbor_family_name,pet_name,scheduled_for,reward_cents,badge_title,assigned_child_ids,checklist,safety_note,status,accepted_by_child_id,task_id").eq("family_id", familyId).order("created_at", { ascending: false }),
  ]);

  const results = [familyResult, childrenResult, petsResult, tasksResult, completionsResult, bankResult, goalsResult, badgesResult, jobsResult];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw wrapDbError("loadPrimaryFamilyBundle failed", failed.error);

  return {
    family: familyResult.data,
    children: childrenResult.data ?? [],
    pets: petsResult.data ?? [],
    tasks: tasksResult.data ?? [],
    completions: completionsResult.data ?? [],
    bankTransactions: bankResult.data ?? [],
    savingsGoals: goalsResult.data ?? [],
    badges: badgesResult.data ?? [],
    neighborhoodJobs: jobsResult.data ?? [],
  } as BackendFamilyBundle;
}

export async function setChildSecretCode(childId: string, secretCode: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("set_child_secret_code", {
    p_child_id: childId,
    p_secret_code: secretCode,
  });
  if (error) throw wrapDbError("setChildSecretCode failed", error);
}

export async function verifyChildSecretCode(childId: string, secretCode: string): Promise<boolean> {
  const client = requireClient();
  const { data, error } = await client.rpc("verify_child_secret_code", {
    p_child_id: childId,
    p_secret_code: secretCode,
  });
  if (error) throw wrapDbError("verifyChildSecretCode failed", error);
  return Boolean(data);
}
