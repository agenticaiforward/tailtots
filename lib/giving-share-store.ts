/**
 * Giving-goal family share links — "Let grandparents chip in."
 *
 * A parent picks a savings/giving goal and generates a shareable link
 * `#giving/<shareId>`. Family members who open the link see ONLY the
 * family-facing snapshot: the goal name, the cause, how much is saved of
 * the target, and a warm message from the parent. No kid names, no kid
 * details, no family details, no way to navigate into the app.
 *
 * Privacy rules (mirrored in GivingShareView and the share-creation UI):
 *  - Share ids are crypto.randomUUID() — unguessable, no child PII in the URL.
 *  - The record is a parent-curated snapshot: the parent reviews and edits
 *    the exact goal name / cause / message family will see before a link is
 *    created. The store never persists childId, kid names, or raw goal
 *    metadata — structurally, there is no field for it.
 *  - Sharing is parent-initiated only; links can be revoked, and revoked or
 *    unknown links render a friendly "no longer active" state.
 *
 * Default backend is localStorage (works offline, no server needed). The
 * store syncs across tabs via `storage` events, so a revoked link stops
 * working everywhere at once.
 *
 * The store is written against the `GivingShareStore` interface so the
 * backend is a swappable adapter: see the commented-out
 * `SupabaseGivingShareStore` skeleton at the bottom for the cloud version
 * (table: giving_goal_shares; migration:
 * supabase/migrations/20261006_giving_goal_shares.sql). localStorage stays
 * the default and the app must never break when Supabase is unreachable.
 */

import type { SavingsGoal } from "./types";

export type GivingShareStatus = "active" | "revoked";

/** The exact family-facing content the parent approves before sharing. */
export interface GivingShareInput {
  /** The id of the goal in the parent's family state (not shown to family). */
  goalId: string;
  /** Family-facing goal name, reviewed by the parent (may differ from the in-app title). */
  goalTitle: string;
  /** Family-facing cause label, e.g. "Animal shelter". Reviewed by the parent. */
  cause: string;
  /** Snapshot of progress; refreshed by syncGoalProgress while the app runs. */
  saved: number;
  target: number;
  /** Parent's first name as shown to family. Defaults to "A TailTots parent". */
  parentName: string;
  /** Warm note from the parent to the family. */
  parentMessage: string;
}

export interface GivingShareRecord extends GivingShareInput {
  id: string;
  status: GivingShareStatus;
  createdAt: number;
  revokedAt?: number;
}

export interface GivingShareStore {
  // Methods may be sync (localStorage) or async (Supabase REST) — callers
  // should always `await` them.
  createShare(input: GivingShareInput): GivingShareRecord | Promise<GivingShareRecord>;
  getShare(id: string): GivingShareRecord | null | Promise<GivingShareRecord | null>;
  /** All shares, optionally filtered to one goal (newest first). */
  listShares(goalId?: string): GivingShareRecord[] | Promise<GivingShareRecord[]>;
  /** Refresh the saved/target snapshot on active shares of one goal. */
  syncGoalProgress(goalId: string, saved: number, target: number): void | Promise<void>;
  /** Revoke a link. Revoked links render "no longer active". */
  revokeShare(id: string): GivingShareRecord | null | Promise<GivingShareRecord | null>;
  /** Subscribe to changes (cross-tab sync). Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY = "tailtots-giving-shares-v1";

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to Math.random fallback */
  }
  return `gs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): Record<string, GivingShareRecord> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GivingShareRecord>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* corrupted storage — treat as empty rather than crashing */
  }
  return {};
}

function writeAll(shares: Record<string, GivingShareRecord>): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
  } catch {
    /* quota/full — the in-memory copy still works for this tab */
  }
}

/** Parse `#giving/<shareId>` out of a location hash. Returns null when absent. */
export function parseGivingHash(hash: string): string | null {
  const match = /^#giving\/([A-Za-z0-9._~-]+)\/?$/.exec((hash || "").trim());
  return match ? match[1] : null;
}

/** Build the shareable family link for a share on this origin. */
export function givingShareUrl(shareId: string): string {
  if (typeof window === "undefined") return `#giving/${shareId}`;
  return `${window.location.origin}${window.location.pathname}#giving/${shareId}`;
}

/**
 * Generic family-facing cause label for a goal type. Used as the default
 * cause in the share composer — deliberately NOT the raw `causeNote`, which
 * may contain kid details the parent hasn't reviewed for family.
 */
export function goalCauseLabel(goal: SavingsGoal): string {
  switch (goal.type) {
    case "donation":
      return "Charity donation";
    case "pet_food":
      return "Pet food";
    case "treats":
      return "Pet treats";
    case "family_reward":
      return "Family reward";
    case "toy":
      return "A special toy";
    default:
      return "Savings goal";
  }
}

/**
 * Build the family-facing share input for a goal. Only the parent-curated
 * snapshot fields survive — childId, kid names, and raw goal metadata are
 * never copied into the record.
 */
export function buildShareInputFromGoal(
  goal: SavingsGoal,
  overrides?: Partial<Omit<GivingShareInput, "goalId" | "saved" | "target">>
): GivingShareInput {
  const parentName = (overrides?.parentName ?? "").trim() || "A TailTots parent";
  const goalTitle = (overrides?.goalTitle ?? goal.title).trim() || "A savings goal";
  const cause = (overrides?.cause ?? goalCauseLabel(goal)).trim() || goalCauseLabel(goal);
  const parentMessage =
    (overrides?.parentMessage ?? "").trim() ||
    `Hi! Our family is working toward "${goalTitle}". If you'd like to chip in, just let me know — I'll add it through TailTots. ❤️`;
  return {
    goalId: goal.id,
    goalTitle,
    cause,
    saved: goal.saved,
    target: goal.target,
    parentName,
    parentMessage,
  };
}

/**
 * The warm text message the parent can copy alongside the link when they
 * text/email it to family.
 */
export function familyShareMessage(share: GivingShareRecord): string {
  return `${share.parentName} shared a TailTots giving goal: "${share.goalTitle}" (${share.cause}) — $${share.saved} saved of $${share.target} so far. View it here: ${givingShareUrl(share.id)} — chipping in goes through the parent. 🐾`;
}

class LocalStorageGivingShareStore implements GivingShareStore {
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      // Cross-tab sync: when another tab writes shares, re-render here.
      window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY) this.emit();
      });
    }
  }

  private emit(): void {
    for (const cb of this.listeners) {
      try {
        cb();
      } catch {
        /* listener errors must not break the store */
      }
    }
  }

  createShare(input: GivingShareInput): GivingShareRecord {
    const record: GivingShareRecord = {
      ...input,
      goalTitle: input.goalTitle.trim() || "A savings goal",
      cause: input.cause.trim() || "Savings goal",
      parentName: input.parentName.trim() || "A TailTots parent",
      id: makeId(),
      status: "active",
      createdAt: Date.now(),
    };
    const all = readAll();
    all[record.id] = record;
    writeAll(all);
    this.emit();
    return record;
  }

  getShare(id: string): GivingShareRecord | null {
    const all = readAll();
    return all[id] ?? null;
  }

  listShares(goalId?: string): GivingShareRecord[] {
    return Object.values(readAll())
      .filter((share) => !goalId || share.goalId === goalId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  syncGoalProgress(goalId: string, saved: number, target: number): void {
    const all = readAll();
    let changed = false;
    for (const share of Object.values(all)) {
      if (share.goalId === goalId && share.status === "active" && (share.saved !== saved || share.target !== target)) {
        all[share.id] = { ...share, saved, target };
        changed = true;
      }
    }
    if (changed) {
      writeAll(all);
      this.emit();
    }
  }

  revokeShare(id: string): GivingShareRecord | null {
    const all = readAll();
    const share = all[id];
    if (!share) return null;
    const revoked: GivingShareRecord = { ...share, status: "revoked", revokedAt: Date.now() };
    all[id] = revoked;
    writeAll(all);
    this.emit();
    return revoked;
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

/** The default store. Swap the adapter here to go cloud-backed. */
export const givingShareStore: GivingShareStore = new LocalStorageGivingShareStore();

/* ------------------------------------------------------------------ */
/* Supabase adapter skeleton (not wired up — localStorage is default). */
/*                                                                     */
/* To enable: create the `giving_goal_shares` table (see                */
/* supabase/migrations/20261006_giving_goal_shares.sql), then replace   */
/* the `givingShareStore` export above with:                           */
/*   export const givingShareStore: GivingShareStore = new              */
/*     SupabaseGivingShareStore(supabaseUrl, supabaseAnonKey);           */
/*                                                                     */
/* The UUID share id is the secret: only someone with the link can read */
/* that share (RLS allows anon select by id). Family viewers can never  */
/* update or revoke — revocation is the owning parent's job (or an      */
/* authenticated parent session scoped by goal ownership).             */
/* ------------------------------------------------------------------ */

// import type { SupabaseClient } from "@supabase/supabase-js";
//
// export class SupabaseGivingShareStore implements GivingShareStore {
//   private client: SupabaseClient;
//   private listeners = new Set<() => void>();
//
//   constructor(client: SupabaseClient) {
//     this.client = client;
//   }
//
//   private emit(): void {
//     for (const cb of this.listeners) { try { cb(); } catch {} }
//   }
//
//   private rowToShare(row: any): GivingShareRecord {
//     return {
//       id: row.id,
//       goalId: row.goal_id,
//       goalTitle: row.goal_title,
//       cause: row.cause,
//       saved: Number(row.saved),
//       target: Number(row.target),
//       parentName: row.parent_name,
//       parentMessage: row.parent_message,
//       status: row.status,
//       createdAt: new Date(row.created_at).getTime(),
//       revokedAt: row.revoked_at ? new Date(row.revoked_at).getTime() : undefined,
//     };
//   }
//
//   async createShare(input: GivingShareInput): Promise<GivingShareRecord> {
//     const { data, error } = await this.client.from("giving_goal_shares").insert({
//       goal_id: input.goalId,
//       goal_title: input.goalTitle,
//       cause: input.cause,
//       saved: input.saved,
//       target: input.target,
//       parent_name: input.parentName,
//       parent_message: input.parentMessage,
//       status: "active",
//     }).select().single();
//     if (error) throw error;
//     this.emit();
//     return this.rowToShare(data);
//   }
//
//   async getShare(id: string): Promise<GivingShareRecord | null> {
//     const { data, error } = await this.client.from("giving_goal_shares").select("*").eq("id", id).maybeSingle();
//     if (error || !data) return null;
//     return this.rowToShare(data);
//   }
//
//   async listShares(goalId?: string): Promise<GivingShareRecord[]> {
//     let query = this.client.from("giving_goal_shares").select("*").order("created_at", { ascending: false });
//     if (goalId) query = query.eq("goal_id", goalId);
//     const { data } = await query;
//     return (data ?? []).map((row) => this.rowToShare(row));
//   }
//
//   async syncGoalProgress(goalId: string, saved: number, target: number): Promise<void> {
//     const { error } = await this.client.from("giving_goal_shares")
//       .update({ saved, target }).eq("goal_id", goalId).eq("status", "active");
//     if (!error) this.emit();
//   }
//
//   async revokeShare(id: string): Promise<GivingShareRecord | null> {
//     const { data, error } = await this.client.from("giving_goal_shares")
//       .update({ status: "revoked", revoked_at: new Date().toISOString() })
//       .eq("id", id).eq("status", "active").select().single();
//     if (error || !data) return null;
//     this.emit();
//     return this.rowToShare(data);
//   }
//
//   subscribe(callback: () => void): () => void {
//     this.listeners.add(callback);
//     return () => { this.listeners.delete(callback); };
//   }
// }
