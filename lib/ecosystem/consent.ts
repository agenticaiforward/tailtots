/**
 * TailTots Ecosystem — consent management.
 *
 * Default deny: every cross-context read must be backed by an explicit,
 * unrevoked, unexpired ConsentGrant. Only the parent can grant or revoke
 * (COPPA: under-13 community participation requires parent enrollment).
 *
 * Pure functions. The grant store itself (localStorage / Supabase) lives in
 * the caller; these functions operate on plain arrays.
 */
import type { ConsentGrant, ConsentScope, EcoContext } from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface GrantConsentInput {
  childId: string;
  fromContext: EcoContext;
  toContext: EcoContext;
  /** Parent user id. Only parents can grant. */
  grantedBy: string;
  scope: ConsentScope[];
  /** Optional TTL in days (e.g. 270 for a school year). */
  expiresInDays?: number;
}

/**
 * Create a new consent grant. Same-context grants are meaningless and
 * rejected (visibility within a context needs no consent).
 */
export function grantConsent(
  input: GrantConsentInput,
): { ok: true; grant: ConsentGrant } | { ok: false; error: string } {
  if (!input.childId || !input.grantedBy) {
    return { ok: false, error: "childId and grantedBy (parent) are required." };
  }
  if (input.fromContext === input.toContext) {
    return { ok: false, error: "Same-context grants are not needed." };
  }
  if (!input.scope || input.scope.length === 0) {
    return { ok: false, error: "At least one consent scope is required." };
  }
  const grant: ConsentGrant = {
    id: uid("cg"),
    childId: input.childId,
    fromContext: input.fromContext,
    toContext: input.toContext,
    grantedBy: input.grantedBy,
    scope: [...input.scope],
    grantedAt: nowIso(),
    expiresAt:
      typeof input.expiresInDays === "number"
        ? new Date(Date.now() + input.expiresInDays * 86400000).toISOString()
        : undefined,
  };
  return { ok: true, grant };
}

/**
 * Revoke a grant. Revocation is immediate and total; revoked grants never
 * un-revoke — a new grant must be created. Returns the updated list.
 */
export function revokeConsent(grants: ConsentGrant[], grantId: string): ConsentGrant[] {
  return grants.map((g) =>
    g.id === grantId && !g.revokedAt ? { ...g, revokedAt: nowIso() } : g,
  );
}

/** True when the grant is currently active (not revoked, not expired). */
export function isGrantActive(grant: ConsentGrant, nowMs: number = Date.now()): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= nowMs) return false;
  return true;
}

/**
 * Default-deny consent check. Returns true only when an ACTIVE grant exists
 * for the exact child, direction, and scope.
 */
export function hasConsent(
  grants: ConsentGrant[],
  childId: string,
  fromContext: EcoContext,
  toContext: EcoContext,
  scope: ConsentScope,
  nowMs: number = Date.now(),
): boolean {
  if (fromContext === toContext) return true; // within-context needs no grant
  return grants.some(
    (g) =>
      g.childId === childId &&
      g.fromContext === fromContext &&
      g.toContext === toContext &&
      g.scope.includes(scope) &&
      isGrantActive(g, nowMs),
  );
}

/** All active grants for a child (for settings UI). */
export function activeGrantsForChild(
  grants: ConsentGrant[],
  childId: string,
  nowMs: number = Date.now(),
): ConsentGrant[] {
  return grants.filter((g) => g.childId === childId && isGrantActive(g, nowMs));
}

/**
 * Directions the parent has NOT yet consented to — used to render
 * "not shared" states honestly in the UI.
 */
export function missingConsentDirections(
  grants: ConsentGrant[],
  childId: string,
  scope: ConsentScope,
  nowMs: number = Date.now(),
): Array<{ from: EcoContext; to: EcoContext }> {
  const contexts: EcoContext[] = ["home", "school", "community"];
  const missing: Array<{ from: EcoContext; to: EcoContext }> = [];
  for (const from of contexts) {
    for (const to of contexts) {
      if (from === to) continue;
      if (!hasConsent(grants, childId, from, to, scope, nowMs)) {
        missing.push({ from, to });
      }
    }
  }
  return missing;
}
