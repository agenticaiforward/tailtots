/**
 * Playdate invites — real, working playdate coordination.
 *
 * Two backends, one interface:
 *
 * - `LocalStoragePlaydateStore` — same-browser invites. Works offline, no
 *   server needed. Syncs across tabs of the same browser via `storage`
 *   events, so the host parent sees the claim confirmation the moment the
 *   other parent confirms in another tab. Used for signed-out / demo mode.
 * - `SupabasePlaydateStore` — cloud invites (table: `playdate_invites`,
 *   see supabase/migrations/20261001_playdate_invites.sql). Used for
 *   signed-in parents so invites work cross-device: the host creates the
 *   invite on one device, the other parent opens the `#playdate/<id>` link
 *   on any device/browser and claims a slot. Live updates arrive via
 *   Supabase realtime, with a polling fallback if realtime can't connect.
 *
 * `playdateStore` (the default export used by the app) is a routing facade:
 * it sends *creates* to the cloud when a parent is signed in (and falls back
 * to localStorage when signed out), while *reads and claims* always try the
 * cloud first — so a `#playdate/<id>` claim link works for cloud invites even
 * when the other parent has no account (the migration's RLS policies allow
 * anonymous read/claim by invite id; the UUID id is the secret).
 *
 * Privacy contract (both backends): only first names + time windows are ever
 * shared. No addresses, no last names, no contact details. The host parent
 * approves every plan before kids hear about it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** Subscribe to changes (cross-tab / cross-device sync). Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void;
}

/** Thrown when a cloud write fails (e.g. Supabase unreachable). Callers
 *  should catch this and show a message — the app must never break. */
export class PlaydateStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "PlaydateStoreError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const STORAGE_KEY = "tailtots-playdate-invites-v1";
/** Invite ids this device created in the cloud (the table has no owner
 *  column by design — the UUID is the secret — so the host's own list is
 *  tracked locally and each invite is re-read by id under RLS). */
const CLOUD_IDS_KEY = "tailtots-playdate-cloud-ids-v1";
const MAX_CLOUD_IDS = 100;
/** Realtime fallback: re-emit so subscribers re-read, when the realtime
 *  channel can't connect. */
const POLL_FALLBACK_MS = 8000;

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

function readCloudIds(): string[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLOUD_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    /* corrupted — start fresh */
  }
  return [];
}

function addCloudId(id: string): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const ids = [id, ...readCloudIds().filter((existing) => existing !== id)].slice(0, MAX_CLOUD_IDS);
    localStorage.setItem(CLOUD_IDS_KEY, JSON.stringify(ids));
  } catch {
    /* quota — the invite itself still exists in the cloud */
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

function sanitizeSlots(raw: unknown): PlaydateSlot[] {
  if (!Array.isArray(raw)) return [];
  const slots: PlaydateSlot[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { childId, childName, slot, status } = entry as Record<string, unknown>;
    if (typeof childId !== "string" || typeof childName !== "string" || typeof slot !== "string") continue;
    slots.push({
      childId,
      // First names only — never persist anything longer than a first name.
      childName: childName.split(" ")[0].slice(0, 40),
      slot,
      status: status === "claimed" ? "claimed" : "open",
    });
  }
  return slots;
}

export class LocalStoragePlaydateStore implements PlaydateStore {
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

/** Cloud-backed invites for signed-in parents (table: `playdate_invites`).
 *
 * Race handling: `claimSlot` updates with `.eq("status", "open")`, which the
 * RLS update policy also enforces — if two parents claim at once, only the
 * first write matches a row, so the second gets `null` ("that time was just
 * taken") instead of a double booking.
 */
export class SupabasePlaydateStore implements PlaydateStore {
  private client: SupabaseClient;
  private listeners = new Set<() => void>();
  private channel: { unsubscribe: () => void } | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(client: SupabaseClient) {
    this.client = client;
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

  private rowToInvite(row: Record<string, unknown>): PlaydateInvite {
    return {
      id: String(row.id ?? ""),
      familyName: typeof row.family_name === "string" && row.family_name ? row.family_name : "Your",
      hostName: typeof row.host_name === "string" && row.host_name ? row.host_name : "A TailTots parent",
      slots: sanitizeSlots(row.slots),
      status: row.status === "booked" ? "booked" : "open",
      createdAt: row.created_at ? new Date(String(row.created_at)).getTime() : Date.now(),
      claimedBy: typeof row.claimed_by === "string" && row.claimed_by ? row.claimed_by : undefined,
      claimedAt: row.claimed_at ? new Date(String(row.claimed_at)).getTime() : undefined,
    };
  }

  /** Start realtime live updates; fall back to polling if realtime fails. */
  private ensureLiveSync(): void {
    if (this.channel || this.pollTimer) return;
    try {
      const channel = this.client.channel("tailtots-playdate-invites");
      this.channel = channel;
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playdate_invites" },
        // NOTE: the realtime payload is ignored on purpose — we only use it
        // as a "something changed" signal and re-read the specific invite by
        // id, so other families' rows are never rendered from the stream.
        () => this.emit(),
      );
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.startPollingFallback();
      });
    } catch {
      this.startPollingFallback();
    }
  }

  private startPollingFallback(): void {
    if (this.pollTimer) return;
    if (this.channel) {
      try {
        this.channel.unsubscribe();
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
    this.pollTimer = setInterval(() => this.emit(), POLL_FALLBACK_MS);
    // Don't keep a node test process alive for the poll timer.
    const timer = this.pollTimer as unknown as { unref?: () => void };
    if (typeof timer.unref === "function") timer.unref();
  }

  private stopLiveSync(): void {
    if (this.channel) {
      try {
        this.channel.unsubscribe();
      } catch {
        /* ignore */
      }
      this.channel = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async createInvite(familyName: string, hostName: string, slots: PlaydateSlotInput[]): Promise<PlaydateInvite> {
    const payload = {
      family_name: familyName.trim() || "Your",
      host_name: hostName.trim() || "A TailTots parent",
      // First names + time windows only — never addresses or contact details.
      slots: slots.map((s) => ({
        childId: s.childId,
        childName: s.childName.split(" ")[0].slice(0, 40),
        slot: s.slot,
        status: "open",
      })),
      status: "open",
    };
    let data: Record<string, unknown> | null = null;
    let error: unknown = null;
    try {
      const result = await this.client.from("playdate_invites").insert(payload).select().single();
      data = (result.data ?? null) as Record<string, unknown> | null;
      error = result.error ?? null;
    } catch (cause) {
      throw new PlaydateStoreError("Couldn't create the playdate invite — please check your connection and try again.", { cause });
    }
    if (error || !data) {
      throw new PlaydateStoreError("Couldn't create the playdate invite — please try again.", { cause: error });
    }
    const invite = this.rowToInvite(data);
    addCloudId(invite.id);
    this.emit();
    return invite;
  }

  async getInvite(id: string): Promise<PlaydateInvite | null> {
    if (!id) return null;
    try {
      const { data, error } = await this.client.from("playdate_invites").select("*").eq("id", id).maybeSingle();
      if (error || !data) return null;
      return this.rowToInvite(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async claimSlot(inviteId: string, slotIndex: number, claimerName: string): Promise<PlaydateInvite | null> {
    const name = claimerName.trim().slice(0, 40);
    if (!name) return null;
    const invite = await this.getInvite(inviteId);
    if (!invite || invite.status !== "open") return null;
    const slot = invite.slots[slotIndex];
    if (!slot || slot.status !== "open") return null;
    const slots = invite.slots.map((s, i) => (i === slotIndex ? { ...s, status: "claimed" as PlaydateSlotStatus } : s));
    try {
      const { data, error } = await this.client
        .from("playdate_invites")
        .update({
          slots,
          status: "booked",
          claimed_by: name,
          claimed_at: new Date().toISOString(),
        })
        // Atomic guard: only the first concurrent claim matches a row.
        .eq("id", inviteId)
        .eq("status", "open")
        .select()
        .single();
      if (error || !data) return null;
      this.emit();
      return this.rowToInvite(data as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async listInvites(): Promise<PlaydateInvite[]> {
    const ids = readCloudIds();
    if (ids.length === 0) return [];
    const invites: PlaydateInvite[] = [];
    for (const id of ids) {
      const invite = await this.getInvite(id);
      if (invite) invites.push(invite);
    }
    return invites.sort((a, b) => b.createdAt - a.createdAt);
  }

  subscribe(callback: () => void): () => void {
    const first = this.listeners.size === 0;
    this.listeners.add(callback);
    if (first) this.ensureLiveSync();
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) this.stopLiveSync();
    };
  }
}

/**
 * Routing facade: the store the app uses.
 *
 * - `createInvite` goes to the cloud when a parent is signed in (Supabase
 *   client configured via `configurePlaydateStore` + `signedIn`), and to
 *   localStorage otherwise (demo / signed-out mode).
 * - `getInvite` / `claimSlot` always try the cloud first when a client is
 *   configured, then fall back to localStorage — so the other parent can
 *   open a `#playdate/<id>` cloud link and claim a slot without an account.
 * - `listInvites` shows cloud invites for signed-in parents, local invites
 *   otherwise.
 */
class RoutingPlaydateStore implements PlaydateStore {
  private local = new LocalStoragePlaydateStore();
  private cloud: SupabasePlaydateStore | null = null;
  private lastClient: SupabaseClient | null = null;
  private signedIn = false;

  configure(client: SupabaseClient | null, signedIn: boolean): void {
    if (client !== this.lastClient) {
      this.lastClient = client;
      this.cloud = client ? new SupabasePlaydateStore(client) : null;
    }
    this.signedIn = signedIn && this.cloud !== null;
  }

  /** For tests/debugging: which backend the next create will use. */
  debugBackendForCreate(): "cloud" | "local" {
    return this.signedIn && this.cloud ? "cloud" : "local";
  }

  async createInvite(
    familyName: string,
    hostName: string,
    slots: PlaydateSlotInput[],
  ): Promise<PlaydateInvite> {
    if (this.signedIn && this.cloud) {
      // Throws PlaydateStoreError when the cloud write fails — the caller
      // shows a message instead of silently creating a local-only invite
      // whose link wouldn't work for the other parent.
      return this.cloud.createInvite(familyName, hostName, slots);
    }
    return this.local.createInvite(familyName, hostName, slots);
  }

  async getInvite(id: string): Promise<PlaydateInvite | null> {
    if (this.cloud) {
      const found = await this.cloud.getInvite(id);
      if (found) return found;
    }
    return this.local.getInvite(id);
  }

  async claimSlot(
    inviteId: string,
    slotIndex: number,
    claimerName: string,
  ): Promise<PlaydateInvite | null> {
    if (this.cloud) {
      const cloudInvite = await this.cloud.getInvite(inviteId);
      if (cloudInvite) {
        return this.cloud.claimSlot(inviteId, slotIndex, claimerName);
      }
    }
    return this.local.claimSlot(inviteId, slotIndex, claimerName);
  }

  async listInvites(): Promise<PlaydateInvite[]> {
    if (this.signedIn && this.cloud) {
      return this.cloud.listInvites();
    }
    return this.local.listInvites();
  }

  subscribe(callback: () => void): () => void {
    const unsubs = [this.local.subscribe(callback)];
    if (this.cloud) unsubs.push(this.cloud.subscribe(callback));
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }
}

/** The default store. Call `configurePlaydateStore` once Supabase config /
 *  auth state is known so signed-in parents get cloud invites. */
export const playdateStore: PlaydateStore = new RoutingPlaydateStore();

/**
 * Wire the cloud backend into the routing store. Call whenever the Supabase
 * client or the parent's signed-in state changes (e.g. on auth state change).
 * Passing `null` (or `signedIn: false`) keeps localStorage behavior.
 */
export function configurePlaydateStore(options: {
  client: SupabaseClient | null;
  signedIn: boolean;
}): void {
  (playdateStore as RoutingPlaydateStore).configure(options.client, options.signedIn);
}
