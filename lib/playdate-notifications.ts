/**
 * In-app notifications for playdate claims (feedback round 2, schedule stream).
 *
 * Two notification moments, both in-app:
 * - Host (parent 0): when another parent claims a slot on one of their
 *   invites, the Schedule panel detects the open→booked transition via its
 *   playdate-store subscription and appends a "claim" notification here.
 * - Accepting parent: the claim page (PlaydateClaimView) records a
 *   "claim-receipt" via `recordClaimReceiptFromInvite` the moment their
 *   claim succeeds — their in-app confirmation, visible in their own
 *   Schedule panel notification inbox too.
 *
 * Stored in localStorage (per browser). The cloud path is the
 * `playdate_invites` table itself — the host's panel re-reads it live via
 * Supabase realtime (with a polling fallback), so no separate server push
 * is needed for in-app delivery.
 */

/* ------------------------------------------------------------------ */
/* EMAIL GAP (feedback R2 item 20)                                     */
/*                                                                     */
/* The task asks that BOTH parents also be notified by email when a    */
/* claim happens. This repo has NO email provider (no Resend,          */
/* SendGrid, Postmark, or similar) and no server route that could hold */
/* an API key, so email is NOT implemented — only the in-app channel   */
/* above. Exactly what is needed to close the gap:                     */
/*                                                                     */
/*  1. An email provider account + API key (e.g. Resend). The key must  */
/*     live server-side only — a Cloudflare Worker secret / env var,   */
/*     never in client code.                                           */
/*  2. A server endpoint (e.g. POST /api/notify-playdate-claim) that   */
/*     the claim page calls after a successful `claimSlot`, sending   */
/*     one email to the host and one to the claimer.                   */
/*  3. Email addresses for both parents. The `playdate_invites` table  */
/*     deliberately stores first names only (privacy contract: no      */
/*     contact details on invites), so the schema/flow needs a way to  */
/*     capture them — e.g. optional email fields on invite creation    */
/*     and on the claim page, stored in a separate private table keyed */
/*     by invite id with RLS restricted to the owning parent.          */
/*  4. A Supabase trigger or Worker cron as a fallback for claims made */
/*     while the claimer's browser is offline before the POST fires.   */
/* ------------------------------------------------------------------ */

import type { PlaydateInvite } from "./playdate-store";

export type PlaydateNotificationKind = "claim" | "claim-receipt";


export interface PlaydateNotification {
  id: string;
  kind: PlaydateNotificationKind;
  /** Invite this notification is about (dedupe key together with kind). */
  inviteId: string;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

const STORAGE_KEY = "tailtots-playdate-notifications-v1";
const MAX_NOTIFICATIONS = 40;

function makeId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `pdn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Read all notifications, newest first. Never throws. */
export function readPlaydateNotifications(): PlaydateNotification[] {
  if (!storageAvailable()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter(
      (n): n is PlaydateNotification =>
        !!n && typeof n === "object" && typeof (n as { id?: unknown }).id === "string",
    );
    return clean.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writePlaydateNotifications(list: PlaydateNotification[]): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    /* quota — in-memory behavior still works for this session */
  }
}

export interface NewPlaydateNotification {
  kind: PlaydateNotificationKind;
  inviteId: string;
  title: string;
  body: string;
  createdAt?: number;
}

/**
 * Append notifications, skipping duplicates (same kind + inviteId keeps the
 * first). Returns the full newest-first list.
 */
export function appendPlaydateNotifications(items: NewPlaydateNotification[]): PlaydateNotification[] {
  const existing = readPlaydateNotifications();
  const seen = new Set(existing.map((n) => `${n.kind}|${n.inviteId}`));
  const fresh: PlaydateNotification[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.inviteId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push({
      id: makeId(),
      kind: item.kind,
      inviteId: item.inviteId,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt ?? Date.now(),
      read: false,
    });
  }
  const next = [...fresh, ...existing]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_NOTIFICATIONS);
  writePlaydateNotifications(next);
  return next;
}

/** Mark every notification read. Returns the updated list. */
export function markAllPlaydateNotificationsRead(): PlaydateNotification[] {
  const next = readPlaydateNotifications().map((n) => ({ ...n, read: true }));
  writePlaydateNotifications(next);
  return next;
}

export function unreadPlaydateNotificationCount(list: PlaydateNotification[]): number {
  return list.filter((n) => !n.read).length;
}

export interface ClaimNotificationInput {
  inviteId: string;
  hostName: string;
  claimedBy: string;
  slotLabel: string;
  childName: string;
  claimedAt?: number;
}

/** Host-side notification: "X claimed <slot>". */
export function buildClaimNotification(input: ClaimNotificationInput): NewPlaydateNotification {
  return {
    kind: "claim",
    inviteId: input.inviteId,
    title: `🎉 ${input.claimedBy} claimed a playdate time`,
    body: `${input.claimedBy} picked ${input.slotLabel} for a playdate with ${input.childName}. That time is now closed to everyone else — reach out parent-to-parent to coordinate pickup.`,
    createdAt: input.claimedAt,
  };
}

export interface ClaimReceiptInput {
  inviteId: string;
  hostName: string;
  familyName: string;
  slotLabel: string;
  childName: string;
  claimedBy: string;
  claimedAt?: number;
}

/**
 * One-line hook for the claim page (PlaydateClaimView): build the accepting
 * parent's receipt from the claimed invite and record it. Returns the
 * stored receipt.
 */
export function recordClaimReceiptFromInvite(
  invite: Pick<PlaydateInvite, "id" | "hostName" | "familyName" | "slots" | "claimedAt">,
  claimerName: string,
): PlaydateNotification {
  const claimedSlot = invite.slots.find((s) => s.status === "claimed");
  return recordClaimReceiptNotification({
    inviteId: invite.id,
    hostName: invite.hostName,
    familyName: invite.familyName,
    slotLabel: claimedSlot?.slot ?? "",
    childName: claimedSlot?.childName ?? "",
    claimedBy: claimerName.trim(),
    claimedAt: invite.claimedAt,
  });
}

/**
 * Accepting-parent notification receipt, recorded on the claim page the
 * moment their claim succeeds. Also returned (not just stored) so the
 * claim page can render it immediately.
 */
export function recordClaimReceiptNotification(input: ClaimReceiptInput): PlaydateNotification {
  const receipt: NewPlaydateNotification = {
    kind: "claim-receipt",
    inviteId: input.inviteId,
    title: `✅ Playdate booked with the ${input.familyName} family`,
    body: `You claimed ${input.slotLabel} for a playdate with ${input.childName}. ${input.hostName} has been notified in their TailTots schedule and will confirm details with you parent-to-parent.`,
    createdAt: input.claimedAt,
  };
  const list = appendPlaydateNotifications([receipt]);
  return (
    list.find((n) => n.kind === "claim-receipt" && n.inviteId === input.inviteId) ?? {
      id: makeId(),
      ...receipt,
      createdAt: receipt.createdAt ?? Date.now(),
      read: false,
    }
  );
}
