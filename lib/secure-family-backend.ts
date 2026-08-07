import { supabase } from "@/lib/supabase";
import type { ApprovalStatus, BankCategory, LevelKey, Mission, SavingsGoal } from "@/lib/types";

export type LifeSkillKey = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";

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

function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

export async function getCurrentUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function createFamilyForCurrentUser(familyName: string, parentDisplayName: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("create_family_for_current_user", {
    family_name: familyName,
    parent_display_name: parentDisplayName,
  });
  if (error) throw error;
  return data as string;
}

export async function loadPrimaryFamilyBundle(): Promise<BackendFamilyBundle | null> {
  const client = requireSupabase();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: parentRows, error: parentError } = await client
    .from("parents")
    .select("family_id")
    .eq("auth_user_id", user.id)
    .limit(1);
  if (parentError) throw parentError;
  const familyId = parentRows?.[0]?.family_id;
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
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;

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

export async function setChildSecretCode(childId: string, secretCode: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("set_child_secret_code", {
    p_child_id: childId,
    p_secret_code: secretCode,
  });
  if (error) throw error;
}

export async function verifyChildSecretCode(childId: string, secretCode: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("verify_child_secret_code", {
    p_child_id: childId,
    p_secret_code: secretCode,
  });
  if (error) throw error;
  return Boolean(data);
}
