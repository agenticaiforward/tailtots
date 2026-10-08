/**
 * family-cloud.ts — TailTots relational cloud-sync data layer.
 *
 * Syncs the app's family state (children, pets, missions, Kid Bank, savings
 * goals, badges, neighborhood jobs, memory moments) to the relational Supabase
 * tables, keyed by stable `client_id` values (see
 * supabase/migrations/20260926_client_id.sql). Every function takes the
 * Supabase client as a parameter so the logic is testable with a stub.
 *
 * Security model: only the anon-key client carrying the signed-in parent's JWT
 * is ever used here — never service_role. Row-level security on every table
 * restricts reads/writes to the parent's own family, so cross-family isolation
 * is enforced by the database, not by app code. No secrets appear in this file.
 *
 * Sync semantics:
 * - Push is idempotent: everything is an upsert against the (family_id|child_id,
 *   client_id) unique indexes, so pushing the same state twice is a no-op and a
 *   failed push is safe to retry.
 * - Push is upsert-only. Local deletions do NOT propagate to the cloud (except
 *   stale task_completions, see below) — a v1 limitation documented below.
 * - Child secret codes are one-way: push syncs a locally-set code to the cloud
 *   via the set_child_secret_code RPC; pull never reads the hash back.
 *
 * Known v1 gaps (fields with no DB column; they stay in the local snapshot blob):
 * - Child.photoUrl / Pet.photoUrl — data URLs are too heavy for row sync.
 * - Mission.question — no column on tasks.
 * - Mission.assignedChildId for missions with no completion — assignment only
 *   survives the round trip once a completion exists (completedBy).
 * - Mission.allowanceDollars — flows into kid_bank_transactions as an earn
 *   transaction via the app's approval flow, not as its own column.
 * - BankTransaction.activityId / goalId — no columns.
 * - NeighborhoodJob.visibleToKids (pull defaults to false, the safe value),
 *   minAge, skillFocus, trustSignals, missionId — no columns.
 * - task_completions.reviewed_at — the app does not track it; left NULL.
 */

import { supabase } from "@/lib/supabase";
import type {
  ApprovalStatus,
  BankCategory,
  BankTransaction,
  Child,
  LevelKey,
  MemoryMoment,
  Mission,
  Pet,
  SavingsGoal,
} from "@/lib/types";

/** Supabase client shape this module needs, derived from the app singleton. */
export type FamilyCloudClient = NonNullable<typeof supabase>;

/** Life-skill keys shared by badge awards (mirrors the app's LifeSkillKey). */
export type BadgeSkill = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";

/** Badge award shape (mirrors the BadgeAward type in app/components/TailTotsApp.tsx). */
export interface BadgeAward {
  id: string;
  childId: string;
  title: string;
  skill: BadgeSkill;
  note: string;
  awardedAt: string;
}

/** Trust-signal keys (mirrors the app's TrustSignalKey; no DB column in v1). */
export type TrustSignalKey =
  | "parent_gate"
  | "age_fit"
  | "no_messaging"
  | "adult_nearby"
  | "private_child";

/** Neighborhood job shape (mirrors the NeighborhoodJob type in TailTotsApp.tsx). */
export interface NeighborhoodJob {
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
  skillFocus?: BadgeSkill;
  trustSignals?: TrustSignalKey[];
  status: "posted" | "accepted" | "approved" | "completed";
  acceptedBy?: string;
  missionId?: string;
}

/** Whole family state, in app shapes, for push and pull. */
export interface FamilySyncState {
  children: Child[];
  pets: Pet[];
  missions: Mission[];
  bankTransactions: BankTransaction[];
  savingsGoals: SavingsGoal[];
  badgeAwards: BadgeAward[];
  neighborhoodJobs: NeighborhoodJob[];
  memoryMoments: MemoryMoment[];
}

/** Result of pullFamilyState — identical shape to FamilySyncState. */
export type PulledFamilyState = FamilySyncState;

// ---------------------------------------------------------------------------
// Money helpers — the app stores dollars (floats); the DB stores integer cents.
// Confirmed: BankTransaction amounts render as `$${tx.amount}` (e.g. "Save $2"),
// SavingsGoal.saved accumulates transaction.amount, and NeighborhoodJob uses
// rewardDollars which flows into Mission.allowanceDollars (also $-rendered).
// ---------------------------------------------------------------------------

/** Dollars (app) -> integer cents (DB), rounded to the nearest cent. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Integer cents (DB) -> dollars (app), rounded to avoid float dust. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

// ---------------------------------------------------------------------------
// Narrowing helpers — coerce unknown DB values into app unions with safe
// fallbacks so a stray value can never crash the UI.
// ---------------------------------------------------------------------------

function asLevelKey(value: unknown): LevelKey {
  return value === "easy" || value === "medium" || value === "hard" || value === "super_hard"
    ? value
    : "easy";
}

function asMissionCategory(value: unknown): Mission["category"] {
  return value === "pet_care" || value === "chore" || value === "kindness" ||
    value === "money" || value === "community"
    ? value
    : "chore";
}

function asApprovalStatus(value: unknown): ApprovalStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function asBankCategory(value: unknown): BankCategory {
  return value === "earn" || value === "save" || value === "spend" || value === "give"
    ? value
    : "earn";
}

function asGoalType(value: unknown): SavingsGoal["type"] {
  return value === "toy" || value === "pet_food" || value === "treats" ||
    value === "donation" || value === "family_reward"
    ? value
    : "toy";
}

function asBadgeSkill(value: unknown): BadgeSkill {
  return value === "responsibility" || value === "empathy" || value === "teamwork" ||
    value === "leadership" || value === "time"
    ? value
    : "responsibility";
}

function asMomentMood(value: unknown): MemoryMoment["mood"] {
  return value === "kind" || value === "silly" || value === "cranky" ||
    value === "proud" || value === "helper"
    ? value
    : "proud";
}

function asJobStatus(value: unknown): NeighborhoodJob["status"] {
  return value === "accepted" || value === "approved" || value === "completed"
    ? value
    : "posted";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Narrow an unknown query payload to a row array without leaking `any`. */
function asRowArray<T>(data: unknown): T[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is T => typeof row === "object" && row !== null);
}

/** App id for a pulled row: the stable client_id, or a cloud- fallback. */
export function appIdForRow(row: { id: string; client_id: string | null }): string {
  return row.client_id ?? `cloud-${row.id.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// DB row shapes (selected columns)
// ---------------------------------------------------------------------------

export interface DbChildRow {
  id: string; family_id: string; display_name: string; level_key: string;
  points: number; coins: number; streak_days: number; age: number | null;
  last_streak_date: string | null;
  client_id: string | null;
}
export interface DbPetRow {
  id: string; family_id: string; name: string; species: string;
  favorite_food: string | null; care_notes: string | null; client_id: string | null;
}
export interface DbPetPassportRow {
  pet_id: string; vet_name: string | null; medication_notes: string | null;
}
export interface DbTaskRow {
  id: string; family_id: string; pet_id: string | null; title: string; category: string;
  difficulty: string; points: number; coins: number; is_active: boolean; client_id: string | null;
}
export interface DbCompletionRow {
  id: string; task_id: string; child_id: string; status: string;
  child_note: string | null; completed_at: string; client_id: string | null;
}
export interface DbBankTxRow {
  id: string; child_id: string; category: string; amount_cents: number;
  description: string; status: string; client_id: string | null;
}
export interface DbGoalRow {
  id: string; child_id: string; title: string; target_cents: number;
  saved_cents: number; goal_type: string; client_id: string | null;
}
export interface DbBadgeRow {
  id: string; family_id: string; child_id: string; title: string; skill: string;
  note: string; awarded_at: string; client_id: string | null;
}
export interface DbJobRow {
  id: string; family_id: string; title: string; neighbor_family_name: string;
  pet_name: string; scheduled_for: string; reward_cents: number; badge_title: string;
  assigned_child_ids: string[] | null; checklist: string[] | null; safety_note: string;
  status: string; accepted_by_child_id: string | null; client_id: string | null;
}
export interface DbMomentRow {
  id: string; family_id: string; child_id: string; pet_id: string | null;
  mood: string; note: string; client_id: string | null;
}

// ---------------------------------------------------------------------------
// Pure mappers: app -> DB
// ---------------------------------------------------------------------------

export interface ChildRowUpsert {
  family_id: string; display_name: string; level_key: LevelKey; points: number;
  coins: number; streak_days: number; age: number; client_id: string;
  last_streak_date: string | null;
}

/**
 * Child -> children row. secretCode is intentionally omitted (synced separately
 * via the set_child_secret_code RPC) and photoUrl stays in the snapshot blob.
 * The DB default ('pending') satisfies the NOT NULL secret_code_hash on insert,
 * and conflict-updates never touch the column, so a set code is never clobbered.
 */
export function mapChildToRow(familyId: string, child: Child): ChildRowUpsert {
  return {
    family_id: familyId,
    display_name: child.name,
    level_key: child.level,
    points: child.points,
    coins: child.coins,
    streak_days: child.streakDays,
    age: child.age,
    client_id: child.id,
    last_streak_date: child.lastStreakDate ?? null,
  };
}

export interface PetRowUpsert {
  family_id: string; name: string; species: string; favorite_food: string | null;
  care_notes: string | null; client_id: string;
}

/** Pet -> pets row. photoUrl stays in the snapshot blob (data URLs too heavy). */
export function mapPetToRow(familyId: string, pet: Pet): PetRowUpsert {
  return {
    family_id: familyId,
    name: pet.name,
    species: pet.species,
    favorite_food: pet.favoriteFood || null,
    care_notes: pet.careNotes || null,
    client_id: pet.id,
  };
}

export interface PetPassportUpsert {
  pet_id: string; vet_name: string | null; medication_notes: string | null;
}

/** Pet vet/medicine -> pet_passports row (upserted on pet_id). */
export function mapPetToPassportRow(petUuid: string, pet: Pet): PetPassportUpsert {
  return {
    pet_id: petUuid,
    vet_name: pet.vet || null,
    medication_notes: pet.medicine || null,
  };
}

export interface TaskRowUpsert {
  family_id: string; pet_id: string | null; title: string; category: Mission["category"];
  difficulty: LevelKey; points: number; coins: number; is_active: boolean; client_id: string;
}

/**
 * Mission -> tasks row. pet_id resolves through the pet uuid map (null when the
 * mission has no pet or the pet is not part of this push). The tasks table has
 * no status column — Mission.status lives on the completion row.
 */
export function mapMissionToTaskRow(
  familyId: string,
  mission: Mission,
  petIdMap: Map<string, string>,
): TaskRowUpsert {
  return {
    family_id: familyId,
    pet_id: mission.petId ? (petIdMap.get(mission.petId) ?? null) : null,
    title: mission.title,
    category: mission.category,
    difficulty: mission.difficulty,
    points: mission.points,
    coins: mission.coins,
    is_active: true,
    client_id: mission.id,
  };
}

export interface CompletionRowUpsert {
  task_id: string; child_id: string; status: ApprovalStatus;
  child_note: string | null; client_id: string;
}

/**
 * Mission -> task_completions row. Returns null when the mission has no
 * completedBy (caller deletes any stale completion for it) or when the child
 * is unknown to this push (completion is dropped rather than mis-attributed).
 */
export function mapMissionToCompletionRow(
  mission: Mission,
  taskUuid: string,
  childIdMap: Map<string, string>,
): CompletionRowUpsert | null {
  if (!mission.completedBy) return null;
  const childUuid = childIdMap.get(mission.completedBy);
  if (!childUuid) return null;
  return {
    task_id: taskUuid,
    child_id: childUuid,
    status: mission.status,
    child_note: mission.note ?? null,
    client_id: mission.id,
  };
}

export interface BankTxRowUpsert {
  child_id: string; category: BankCategory; amount_cents: number;
  description: string; status: ApprovalStatus; client_id: string;
}

/** BankTransaction -> kid_bank_transactions row. Throws on unknown child. */
export function mapBankTxToRow(
  tx: BankTransaction,
  childIdMap: Map<string, string>,
): BankTxRowUpsert {
  const childUuid = childIdMap.get(tx.childId);
  if (!childUuid) {
    throw new Error(
      `Cannot sync bank transaction "${tx.id}": unknown child "${tx.childId}".`,
    );
  }
  return {
    child_id: childUuid,
    category: tx.category,
    amount_cents: dollarsToCents(tx.amount),
    description: tx.description,
    status: tx.status,
    client_id: tx.id,
  };
}

export interface GoalRowUpsert {
  child_id: string; title: string; target_cents: number; saved_cents: number;
  goal_type: SavingsGoal["type"]; client_id: string;
}

/** SavingsGoal -> savings_goals row (dollars -> cents). Throws on unknown child. */
export function mapGoalToRow(
  goal: SavingsGoal,
  childIdMap: Map<string, string>,
): GoalRowUpsert {
  const childUuid = childIdMap.get(goal.childId);
  if (!childUuid) {
    throw new Error(`Cannot sync savings goal "${goal.id}": unknown child "${goal.childId}".`);
  }
  return {
    child_id: childUuid,
    title: goal.title,
    target_cents: dollarsToCents(goal.target),
    saved_cents: dollarsToCents(goal.saved),
    goal_type: goal.type,
    client_id: goal.id,
  };
}

export interface BadgeRowUpsert {
  family_id: string; child_id: string; title: string; skill: BadgeSkill;
  note: string; awarded_at: string; client_id: string;
}

/** BadgeAward -> badge_awards row. Throws on unknown child. */
export function mapBadgeToRow(
  familyId: string,
  badge: BadgeAward,
  childIdMap: Map<string, string>,
): BadgeRowUpsert {
  const childUuid = childIdMap.get(badge.childId);
  if (!childUuid) {
    throw new Error(`Cannot sync badge "${badge.id}": unknown child "${badge.childId}".`);
  }
  return {
    family_id: familyId,
    child_id: childUuid,
    title: badge.title,
    skill: badge.skill,
    note: badge.note,
    awarded_at: badge.awardedAt,
    client_id: badge.id,
  };
}

export interface JobRowUpsert {
  family_id: string; title: string; neighbor_family_name: string; pet_name: string;
  scheduled_for: string; reward_cents: number; badge_title: string;
  assigned_child_ids: string[]; checklist: string[]; safety_note: string;
  status: NeighborhoodJob["status"]; accepted_by_child_id: string | null; client_id: string;
}

/**
 * NeighborhoodJob -> neighborhood_jobs row (rewardDollars -> reward_cents).
 * Unknown assigned children are dropped; unknown acceptedBy becomes null.
 * visibleToKids / minAge / skillFocus / trustSignals / missionId / posterThanked
 * have no columns — known v1 gaps (all default to safe values on pull).
 */
export function mapJobToRow(
  familyId: string,
  job: NeighborhoodJob,
  childIdMap: Map<string, string>,
): JobRowUpsert {
  return {
    family_id: familyId,
    title: job.title,
    neighbor_family_name: job.family,
    pet_name: job.pet,
    scheduled_for: job.time,
    reward_cents: dollarsToCents(job.rewardDollars),
    badge_title: job.badgeTitle,
    assigned_child_ids: job.assignedChildIds
      .map((id) => childIdMap.get(id))
      .filter((uuid): uuid is string => typeof uuid === "string"),
    checklist: job.checklist,
    safety_note: job.safety,
    status: job.status,
    accepted_by_child_id: job.acceptedBy ? (childIdMap.get(job.acceptedBy) ?? null) : null,
    client_id: job.id,
  };
}

export interface MomentRowUpsert {
  family_id: string; child_id: string; pet_id: string | null;
  mood: MemoryMoment["mood"]; note: string; client_id: string;
}

/** MemoryMoment -> memory_moments row. Throws on unknown child. */
export function mapMomentToRow(
  familyId: string,
  moment: MemoryMoment,
  childIdMap: Map<string, string>,
  petIdMap: Map<string, string>,
): MomentRowUpsert {
  const childUuid = childIdMap.get(moment.childId);
  if (!childUuid) {
    throw new Error(`Cannot sync memory moment "${moment.id}": unknown child "${moment.childId}".`);
  }
  return {
    family_id: familyId,
    child_id: childUuid,
    pet_id: moment.petId ? (petIdMap.get(moment.petId) ?? null) : null,
    mood: moment.mood,
    note: moment.note,
    client_id: moment.id,
  };
}

// ---------------------------------------------------------------------------
// Pure mappers: DB -> app
// ---------------------------------------------------------------------------

/** children row -> Child. secretCode can never be read back (hash only). */
export function mapRowToChild(row: DbChildRow): Child {
  return {
    id: appIdForRow(row),
    name: row.display_name,
    age: row.age ?? 0,
    secretCode: "",
    points: asNumber(row.points),
    coins: asNumber(row.coins),
    level: asLevelKey(row.level_key),
    streakDays: asNumber(row.streak_days),
    lastStreakDate: row.last_streak_date ?? undefined,
  };
}

/** pets row (+ passport) -> Pet. */
export function mapRowToPet(row: DbPetRow, passport: DbPetPassportRow | null): Pet {
  return {
    id: appIdForRow(row),
    name: row.name,
    species: row.species,
    favoriteFood: row.favorite_food ?? "",
    careNotes: row.care_notes ?? "",
    vet: passport?.vet_name ?? "",
    medicine: passport?.medication_notes ?? "",
  };
}

/**
 * tasks row + its completions (newest first) -> Mission. The task table has no
 * status column: status/completedBy/note come from the latest completion; a
 * task with no completion maps to a pending Mission with no completedBy.
 */
export function mapRowToMission(
  task: DbTaskRow,
  completionsNewestFirst: DbCompletionRow[],
  childUuidToAppId: Map<string, string>,
  petUuidToAppId: Map<string, string>,
): Mission {
  const latest = completionsNewestFirst[0] ?? null;
  const completedBy = latest ? childUuidToAppId.get(latest.child_id) : undefined;
  const mission: Mission = {
    id: appIdForRow(task),
    title: task.title,
    category: asMissionCategory(task.category),
    difficulty: asLevelKey(task.difficulty),
    points: asNumber(task.points),
    coins: asNumber(task.coins),
    question: "", // v1 gap: no column on tasks
    status: latest ? asApprovalStatus(latest.status) : "pending",
  };
  const petAppId = task.pet_id ? petUuidToAppId.get(task.pet_id) : undefined;
  if (petAppId) mission.petId = petAppId;
  if (completedBy) {
    mission.completedBy = completedBy;
    mission.assignedChildId = completedBy;
  }
  if (latest?.child_note) mission.note = latest.child_note;
  return mission;
}

/** kid_bank_transactions row -> BankTransaction (cents -> dollars). */
export function mapRowToBankTx(
  row: DbBankTxRow,
  childUuidToAppId: Map<string, string>,
): BankTransaction {
  return {
    id: appIdForRow(row),
    childId: childUuidToAppId.get(row.child_id) ?? row.child_id,
    category: asBankCategory(row.category),
    amount: centsToDollars(row.amount_cents),
    description: row.description,
    status: asApprovalStatus(row.status),
  };
}

/** savings_goals row -> SavingsGoal (cents -> dollars). */
export function mapRowToGoal(
  row: DbGoalRow,
  childUuidToAppId: Map<string, string>,
): SavingsGoal {
  return {
    id: appIdForRow(row),
    childId: childUuidToAppId.get(row.child_id) ?? row.child_id,
    title: row.title,
    target: centsToDollars(row.target_cents),
    saved: centsToDollars(row.saved_cents),
    type: asGoalType(row.goal_type),
  };
}

/** badge_awards row -> BadgeAward. */
export function mapRowToBadge(
  row: DbBadgeRow,
  childUuidToAppId: Map<string, string>,
): BadgeAward {
  return {
    id: appIdForRow(row),
    childId: childUuidToAppId.get(row.child_id) ?? row.child_id,
    title: row.title,
    skill: asBadgeSkill(row.skill),
    note: row.note,
    awardedAt: row.awarded_at,
  };
}

/**
 * neighborhood_jobs row -> NeighborhoodJob (reward_cents -> rewardDollars).
 * visibleToKids defaults to false (safe); minAge/skillFocus/trustSignals/
 * missionId/posterThanked have no columns — v1 gaps.
 */
export function mapRowToJob(
  row: DbJobRow,
  childUuidToAppId: Map<string, string>,
): NeighborhoodJob {
  const acceptedBy = row.accepted_by_child_id
    ? childUuidToAppId.get(row.accepted_by_child_id)
    : undefined;
  const job: NeighborhoodJob = {
    id: appIdForRow(row),
    title: row.title,
    family: row.neighbor_family_name,
    pet: row.pet_name,
    time: row.scheduled_for,
    rewardDollars: centsToDollars(row.reward_cents),
    badgeTitle: row.badge_title,
    assignedChildIds: asStringArray(row.assigned_child_ids)
      .map((uuid) => childUuidToAppId.get(uuid) ?? uuid),
    visibleToKids: false,
    checklist: asStringArray(row.checklist),
    safety: row.safety_note,
    status: asJobStatus(row.status),
  };
  if (acceptedBy) job.acceptedBy = acceptedBy;
  return job;
}

/** memory_moments row -> MemoryMoment. */
export function mapRowToMoment(
  row: DbMomentRow,
  childUuidToAppId: Map<string, string>,
  petUuidToAppId: Map<string, string>,
): MemoryMoment {
  const moment: MemoryMoment = {
    id: appIdForRow(row),
    childId: childUuidToAppId.get(row.child_id) ?? row.child_id,
    mood: asMomentMood(row.mood),
    note: row.note,
  };
  const petAppId = row.pet_id ? petUuidToAppId.get(row.pet_id) : undefined;
  if (petAppId) moment.petId = petAppId;
  return moment;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

function throwIfError(error: unknown, table: string, op: string): void {
  if (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "unknown error";
    throw new Error(`Cloud sync failed: ${op} on "${table}" — ${message}`);
  }
}

async function selectWhere(
  client: FamilyCloudClient,
  table: string,
  column: string,
  value: string,
  columns: string,
  orderBy?: string,
): Promise<unknown> {
  let query = client.from(table).select(columns).eq(column, value);
  if (orderBy) query = query.order(orderBy);
  const { data, error } = await query;
  throwIfError(error, table, "select");
  return data;
}

async function selectWhereIn(
  client: FamilyCloudClient,
  table: string,
  column: string,
  values: string[],
  columns: string,
  orderBy?: string,
): Promise<unknown> {
  if (values.length === 0) return [];
  let query = client.from(table).select(columns).in(column, values);
  if (orderBy) query = query.order(orderBy, { ascending: false });
  const { data, error } = await query;
  throwIfError(error, table, "select");
  return data;
}

// ---------------------------------------------------------------------------
// ensureFamilyForCurrentUser
// ---------------------------------------------------------------------------

/**
 * Return the family_id for the signed-in parent, creating the family (via the
 * create_family_for_current_user RPC) only when the parent has none yet.
 * Check-first means we never create duplicate families for the same user.
 */
export async function ensureFamilyForCurrentUser(
  client: FamilyCloudClient,
  familyName: string,
  parentDisplayName: string,
): Promise<string> {
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError, "auth", "getUser");
  const userId = (userData as { user?: { id?: string } } | null)?.user?.id;
  if (!userId) {
    throw new Error("Cloud sync failed: sign in with a parent account first.");
  }

  const existing = asRowArray<{ family_id: string }>(
    await selectWhere(client, "parents", "auth_user_id", userId, "family_id"),
  );
  const familyId = existing[0]?.family_id;
  if (familyId) return familyId;

  const { data, error } = await client.rpc("create_family_for_current_user", {
    family_name: familyName,
    parent_display_name: parentDisplayName,
  });
  throwIfError(error, "families", "create_family_for_current_user");
  if (typeof data !== "string" || !data) {
    throw new Error("Cloud sync failed: create_family_for_current_user returned no family id.");
  }
  return data;
}

// ---------------------------------------------------------------------------
// pushFamilyState
// ---------------------------------------------------------------------------

const SECRET_CODE_PATTERN = /^[0-9]{4,8}$/;

/**
 * Upsert the whole app state to the relational tables in dependency order:
 * children -> pets (+ pet_passports) -> tasks -> task_completions ->
 * kid_bank_transactions -> savings_goals -> badge_awards -> neighborhood_jobs
 * -> memory_moments.
 *
 * Child/pet/task references resolve through client_id -> uuid maps built during
 * the push. Idempotent: safe to retry after a failure.
 */
export async function pushFamilyState(
  client: FamilyCloudClient,
  familyId: string,
  state: FamilySyncState,
): Promise<void> {
  // 1. Children (upsert omits secret_code_hash; see mapChildToRow).
  const childIdMap = new Map<string, string>();
  if (state.children.length > 0) {
    const rows = state.children.map((child) => mapChildToRow(familyId, child));
    const { data, error } = await client
      .from("children")
      .upsert(rows, { onConflict: "family_id,client_id" })
      .select("id,client_id");
    throwIfError(error, "children", "upsert");
    for (const row of asRowArray<{ id: string; client_id: string | null }>(data)) {
      if (row.client_id) childIdMap.set(row.client_id, row.id);
    }
    // Sync locally-set child codes via the RPC (never stored as plain text).
    for (const child of state.children) {
      const childUuid = childIdMap.get(child.id);
      if (childUuid && SECRET_CODE_PATTERN.test(child.secretCode)) {
        const { error: rpcError } = await client.rpc("set_child_secret_code", {
          p_child_id: childUuid,
          p_secret_code: child.secretCode,
        });
        throwIfError(rpcError, "children", "set_child_secret_code");
      }
    }
  }

  // 2. Pets + pet passports.
  const petIdMap = new Map<string, string>();
  if (state.pets.length > 0) {
    const rows = state.pets.map((pet) => mapPetToRow(familyId, pet));
    const { data, error } = await client
      .from("pets")
      .upsert(rows, { onConflict: "family_id,client_id" })
      .select("id,client_id");
    throwIfError(error, "pets", "upsert");
    for (const row of asRowArray<{ id: string; client_id: string | null }>(data)) {
      if (row.client_id) petIdMap.set(row.client_id, row.id);
    }
    const passports: PetPassportUpsert[] = [];
    for (const pet of state.pets) {
      const petUuid = petIdMap.get(pet.id);
      if (petUuid) passports.push(mapPetToPassportRow(petUuid, pet));
    }
    if (passports.length > 0) {
      const { error: passportError } = await client
        .from("pet_passports")
        .upsert(passports, { onConflict: "pet_id" });
      throwIfError(passportError, "pet_passports", "upsert");
    }
  }

  // 3. Tasks, then 4. their completions.
  if (state.missions.length > 0) {
    const taskIdMap = new Map<string, string>();
    const taskRows = state.missions.map((mission) =>
      mapMissionToTaskRow(familyId, mission, petIdMap),
    );
    const { data, error } = await client
      .from("tasks")
      .upsert(taskRows, { onConflict: "family_id,client_id" })
      .select("id,client_id");
    throwIfError(error, "tasks", "upsert");
    for (const row of asRowArray<{ id: string; client_id: string | null }>(data)) {
      if (row.client_id) taskIdMap.set(row.client_id, row.id);
    }

    const completionRows: CompletionRowUpsert[] = [];
    const staleCompletionClientIds: string[] = [];
    for (const mission of state.missions) {
      const taskUuid = taskIdMap.get(mission.id);
      if (!taskUuid) continue;
      const completion = mapMissionToCompletionRow(mission, taskUuid, childIdMap);
      if (completion) completionRows.push(completion);
      else staleCompletionClientIds.push(mission.id);
    }
    if (completionRows.length > 0) {
      const { error: completionError } = await client
        .from("task_completions")
        .upsert(completionRows, { onConflict: "child_id,client_id" });
      throwIfError(completionError, "task_completions", "upsert");
    }
    if (staleCompletionClientIds.length > 0) {
      const { error: deleteError } = await client
        .from("task_completions")
        .delete()
        .in("client_id", staleCompletionClientIds);
      throwIfError(deleteError, "task_completions", "delete stale");
    }
  }

  // 5. Kid Bank transactions.
  if (state.bankTransactions.length > 0) {
    const rows = state.bankTransactions.map((tx) => mapBankTxToRow(tx, childIdMap));
    const { error } = await client
      .from("kid_bank_transactions")
      .upsert(rows, { onConflict: "child_id,client_id" });
    throwIfError(error, "kid_bank_transactions", "upsert");
  }

  // 6. Savings goals.
  if (state.savingsGoals.length > 0) {
    const rows = state.savingsGoals.map((goal) => mapGoalToRow(goal, childIdMap));
    const { error } = await client
      .from("savings_goals")
      .upsert(rows, { onConflict: "child_id,client_id" });
    throwIfError(error, "savings_goals", "upsert");
  }

  // 7. Badge awards.
  if (state.badgeAwards.length > 0) {
    const rows = state.badgeAwards.map((badge) => mapBadgeToRow(familyId, badge, childIdMap));
    const { error } = await client
      .from("badge_awards")
      .upsert(rows, { onConflict: "family_id,client_id" });
    throwIfError(error, "badge_awards", "upsert");
  }

  // 8. Neighborhood jobs.
  if (state.neighborhoodJobs.length > 0) {
    const rows = state.neighborhoodJobs.map((job) => mapJobToRow(familyId, job, childIdMap));
    const { error } = await client
      .from("neighborhood_jobs")
      .upsert(rows, { onConflict: "family_id,client_id" });
    throwIfError(error, "neighborhood_jobs", "upsert");
  }

  // 9. Memory moments.
  if (state.memoryMoments.length > 0) {
    const rows = state.memoryMoments.map((moment) =>
      mapMomentToRow(familyId, moment, childIdMap, petIdMap),
    );
    const { error } = await client
      .from("memory_moments")
      .upsert(rows, { onConflict: "child_id,client_id" });
    throwIfError(error, "memory_moments", "upsert");
  }
}

// ---------------------------------------------------------------------------
// pullFamilyState
// ---------------------------------------------------------------------------

/**
 * Load the family's relational state and map it back to app shapes.
 * Returns null when the family has no children yet (fresh family — nothing
 * meaningful to pull).
 */
export async function pullFamilyState(
  client: FamilyCloudClient,
  familyId: string,
): Promise<PulledFamilyState | null> {
  const childRows = asRowArray<DbChildRow>(
    await selectWhere(
      client, "children", "family_id", familyId,
      "id,family_id,display_name,level_key,points,coins,streak_days,age,last_streak_date,client_id",
      "created_at",
    ),
  );
  if (childRows.length === 0) return null;

  const childIds = childRows.map((c) => c.id);
  const childUuidToAppId = new Map(childRows.map((c) => [c.id, appIdForRow(c)] as const));

  const [
    petRowsRaw,
    taskRowsRaw,
    bankRowsRaw,
    goalRowsRaw,
    badgeRowsRaw,
    jobRowsRaw,
    momentRowsRaw,
  ] = await Promise.all([
    selectWhere(client, "pets", "family_id", familyId,
      "id,family_id,name,species,favorite_food,care_notes,client_id", "created_at"),
    selectWhere(client, "tasks", "family_id", familyId,
      "id,family_id,pet_id,title,category,difficulty,points,coins,is_active,client_id", "created_at"),
    selectWhereIn(client, "kid_bank_transactions", "child_id", childIds,
      "id,child_id,category,amount_cents,description,status,client_id", "created_at"),
    selectWhereIn(client, "savings_goals", "child_id", childIds,
      "id,child_id,title,target_cents,saved_cents,goal_type,client_id", "created_at"),
    selectWhere(client, "badge_awards", "family_id", familyId,
      "id,family_id,child_id,title,skill,note,awarded_at,client_id", "awarded_at"),
    selectWhere(client, "neighborhood_jobs", "family_id", familyId,
      "id,family_id,title,neighbor_family_name,pet_name,scheduled_for,reward_cents,badge_title,assigned_child_ids,checklist,safety_note,status,accepted_by_child_id,client_id",
      "created_at"),
    selectWhereIn(client, "memory_moments", "child_id", childIds,
      "id,family_id,child_id,pet_id,mood,note,client_id", "created_at"),
  ]);

  const petRows = asRowArray<DbPetRow>(petRowsRaw);
  const taskRows = asRowArray<DbTaskRow>(taskRowsRaw);
  const petUuidToAppId = new Map(petRows.map((p) => [p.id, appIdForRow(p)] as const));

  const passportRows = asRowArray<DbPetPassportRow>(
    await selectWhereIn(client, "pet_passports", "pet_id",
      petRows.map((p) => p.id), "pet_id,vet_name,medication_notes"),
  );
  const passportByPetId = new Map(passportRows.map((p) => [p.pet_id, p] as const));

  const completionRows = asRowArray<DbCompletionRow>(
    await selectWhereIn(client, "task_completions", "task_id",
      taskRows.map((t) => t.id),
      "id,task_id,child_id,status,child_note,completed_at,client_id", "completed_at"),
  );
  const completionsByTask = new Map<string, DbCompletionRow[]>();
  for (const completion of completionRows) {
    const list = completionsByTask.get(completion.task_id) ?? [];
    list.push(completion);
    completionsByTask.set(completion.task_id, list);
  }

  return {
    children: childRows.map(mapRowToChild),
    pets: petRows.map((p) => mapRowToPet(p, passportByPetId.get(p.id) ?? null)),
    missions: taskRows.map((t) =>
      mapRowToMission(t, completionsByTask.get(t.id) ?? [], childUuidToAppId, petUuidToAppId),
    ),
    bankTransactions: asRowArray<DbBankTxRow>(bankRowsRaw)
      .map((r) => mapRowToBankTx(r, childUuidToAppId)),
    savingsGoals: asRowArray<DbGoalRow>(goalRowsRaw)
      .map((r) => mapRowToGoal(r, childUuidToAppId)),
    badgeAwards: asRowArray<DbBadgeRow>(badgeRowsRaw)
      .map((r) => mapRowToBadge(r, childUuidToAppId)),
    neighborhoodJobs: asRowArray<DbJobRow>(jobRowsRaw)
      .map((r) => mapRowToJob(r, childUuidToAppId)),
    memoryMoments: asRowArray<DbMomentRow>(momentRowsRaw)
      .map((r) => mapRowToMoment(r, childUuidToAppId, petUuidToAppId)),
  };
}
