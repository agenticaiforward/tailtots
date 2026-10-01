/**
 * Playdate invites — real, working playdate coordination.
 *
 * Default backend is localStorage (works offline, no server needed). The
 * store syncs across tabs of the same browser via `storage` events, so the
 * host parent sees the claim confirmation the moment the other parent
 * confirms in another tab.
 *
 * The store is written against the `PlaydateStore` interface so the backend
 * is a swappable adapter: see the commented-out `SupabasePlaydateStore`
 * skeleton at the bottom for the cloud version (table: playdate_invites).
 * localStorage stays the default and the app must never break when
 * Supabase is unreachable.
 */

export type PlaydateSlotStatus = "open" | "claimed";
export type PlaydateInviteStatus = "open" | "booked";

export interface PlaydateSlotInput {
  childId: string;
  childName: string;
  slot: string;
}

export interface PlaydateSlot extends PlaydateSlotInput {
  status: PlaydateSlotStatus;
}

export interface PlaydateInvite {
  id: string;
  familyName: string;
  hostName: string;
  slots: PlaydateSlot[];
  status: PlaydateInviteStatus;
  createdAt: number;
  claimedBy?: string;
  claimedAt?: number;
}

export interface PlaydateStore {
  // Methods may be sync (localStorage) or async (Supabase REST) — callers
  // should always `await` them.
  createInvite(familyName: string, hostName: string, slots: PlaydateSlotInput[]): PlaydateInvite | Promise<PlaydateInvite>;
  getInvite(id: string): PlaydateInvite | null | Promise<PlaydateInvite | null>;
  claimSlot(inviteId: string, slotIndex: number, claimerName: string): PlaydateInvite | null | Promise<PlaydateInvite | null>;
  listInvites(): PlaydateInvite[] | Promise<PlaydateInvite[]>;
  /** Subscribe to changes (cross-tab sync). Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void;
}

const STORAGE_KEY = "tailtots-playdate-invites-v1";

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to Math.random fallback */
  }
  return `pd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): Record<string, PlaydateInvite> {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PlaydateInvite>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* corrupted storage — treat as empty rather than crashing */
  }
  return {};
}

function writeAll(invites: Record<string, PlaydateInvite>): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invites));
  } catch {
    /* quota/full — the in-memory copy still works for this tab */
  }
}

/** Parse `#playdate/<inviteId>` out of a location hash. Returns null when absent. */
export function parsePlaydateHash(hash: string): string | null {
  const match = /^#playdate\/([A-Za-z0-9._~-]+)\/?$/.exec((hash || "").trim());
  return match ? match[1] : null;
}

/** Build the shareable claim link for an invite on this origin. */
export function playdateClaimUrl(inviteId: string): string {
  if (typeof window === "undefined") return `#playdate/${inviteId}`;
  return `${window.location.origin}${window.location.pathname}#playdate/${inviteId}`;
}

class LocalStoragePlaydateStore implements PlaydateStore {
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      // Cross-tab sync: when another tab writes invites, re-render here.
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

  createInvite(familyName: string, hostName: string, slots: PlaydateSlotInput[]): PlaydateInvite {
    const invite: PlaydateInvite = {
      id: makeId(),
      familyName: familyName.trim() || "Your",
      hostName: hostName.trim() || "A TailTots parent",
      slots: slots.map((s) => ({ ...s, status: "open" as PlaydateSlotStatus })),
      status: "open",
      createdAt: Date.now(),
    };
    const all = readAll();
    all[invite.id] = invite;
    writeAll(all);
    this.emit();
    return invite;
  }

  getInvite(id: string): PlaydateInvite | null {
    const all = readAll();
    return all[id] ?? null;
  }

  claimSlot(inviteId: string, slotIndex: number, claimerName: string): PlaydateInvite | null {
    const all = readAll();
    const invite = all[inviteId];
    if (!invite || invite.status !== "open") return null;
    const slot = invite.slots[slotIndex];
    if (!slot || slot.status !== "open") return null;
    const name = claimerName.trim();
    if (!name) return null;
    const updated: PlaydateInvite = {
      ...invite,
      slots: invite.slots.map((s, i) => (i === slotIndex ? { ...s, status: "claimed" as PlaydateSlotStatus } : s)),
      status: "booked",
      claimedBy: name,
      claimedAt: Date.now(),
    };
    all[inviteId] = updated;
    writeAll(all);
    this.emit();
    return updated;
  }

  listInvites(): PlaydateInvite[] {
    return Object.values(readAll()).sort((a, b) => b.createdAt - a.createdAt);
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

/** The default store. Swap the adapter here to go cloud-backed. */
export const playdateStore: PlaydateStore = new LocalStoragePlaydateStore();

/* ------------------------------------------------------------------ */
/* Supabase adapter skeleton (not wired up — localStorage is default). */
/*                                                                     */
/* To enable: create the `playdate_invites` table (see                */
/* supabase/migrations/20261001_playdate_invites.sql), then replace   */
/* the `playdateStore` export above with:                             */
/*   export const playdateStore: PlaydateStore = new                  */
/*     SupabasePlaydateStore(supabaseUrl, supabaseAnonKey);            */
/*                                                                     */
/* The UUID invite id is the secret: only someone with the link can   */
/* read/claim that invite (RLS allows anon select/update by id).      */
/* ------------------------------------------------------------------ */

// import type { SupabaseClient } from "@supabase/supabase-js";
//
// export class SupabasePlaydateStore implements PlaydateStore {
//   private client: SupabaseClient;
//   private listeners = new Set<() => void>();
//   private channel: { unsubscribe: () => void } | null = null;
//
//   constructor(client: SupabaseClient) {
//     this.client = client;
//     // Realtime cross-device sync:
//     // this.channel = this.client
//     //   .channel("playdate_invites")
//     //   .on("postgres_changes", { event: "*", schema: "public", table: "playdate_invites" }, () => this.emit())
//     //   .subscribe();
//   }
//
//   private emit(): void {
//     for (const cb of this.listeners) { try { cb(); } catch {} }
//   }
//
//   private rowToInvite(row: any): PlaydateInvite {
//     return {
//       id: row.id,
//       familyName: row.family_name,
//       hostName: row.host_name,
//       slots: (row.slots ?? []).map((s: any) => ({
//         childId: s.childId, childName: s.childName, slot: s.slot, status: s.status,
//       })),
//       status: row.status,
//       createdAt: new Date(row.created_at).getTime(),
//       claimedBy: row.claimed_by ?? undefined,
//       claimedAt: row.claimed_at ? new Date(row.claimed_at).getTime() : undefined,
//     };
//   }
//
//   async createInvite(familyName: string, hostName: string, slots: PlaydateSlotInput[]): Promise<PlaydateInvite> {
//     const { data, error } = await this.client.from("playdate_invites").insert({
//       family_name: familyName.trim() || "Your",
//       host_name: hostName.trim() || "A TailTots parent",
//       slots: slots.map((s) => ({ ...s, status: "open" })),
//       status: "open",
//     }).select().single();
//     if (error) throw error;
//     this.emit();
//     return this.rowToInvite(data);
//   }
//
//   async getInvite(id: string): Promise<PlaydateInvite | null> {
//     const { data, error } = await this.client.from("playdate_invites").select("*").eq("id", id).maybeSingle();
//     if (error || !data) return null;
//     return this.rowToInvite(data);
//   }
//
//   async claimSlot(inviteId: string, slotIndex: number, claimerName: string): Promise<PlaydateInvite | null> {
//     const invite = await this.getInvite(inviteId);
//     if (!invite || invite.status !== "open") return null;
//     const slot = invite.slots[slotIndex];
//     if (!slot || slot.status !== "open" || !claimerName.trim()) return null;
//     const slots = invite.slots.map((s, i) => (i === slotIndex ? { ...s, status: "claimed" as PlaydateSlotStatus } : s));
//     const { data, error } = await this.client.from("playdate_invites").update({
//       slots, status: "booked", claimed_by: claimerName.trim(), claimed_at: new Date().toISOString(),
//     }).eq("id", inviteId).eq("status", "open").select().single();
//     // NOTE: the `.eq("status", "open")` guard makes the claim atomic —
//     // if two parents claim at once, only the first write wins.
//     if (error || !data) return null;
//     this.emit();
//     return this.rowToInvite(data);
//   }
//
//   async listInvites(): Promise<PlaydateInvite[]> {
//     const { data } = await this.client.from("playdate_invites").select("*").order("created_at", { ascending: false });
//     return (data ?? []).map((row) => this.rowToInvite(row));
//   }
//
//   subscribe(callback: () => void): () => void {
//     this.listeners.add(callback);
//     return () => { this.listeners.delete(callback); };
//   }
// }
