/**
 * Family state service: orchestrates the local-first family snapshot.
 *
 * - Reads validate with zod (`safeParseFamilyState`), then migrate.
 * - Writes strip the parent passcode and survive quota errors.
 * - UI components call these functions; they never touch `localStorage`
 *   or Supabase directly.
 */
import type { SavedFamilyState } from "@/lib/domain/family-types";
import { migrateSavedFamilyState, normalizeChildProfile, normalizeNeighborhoodJob, normalizePetProfile } from "@/lib/domain/family";
import { legacySavedFamilyStateKey, savedFamilyStateKey } from "@/lib/domain/starter-data";
import { createLogger } from "@/lib/logging/logger";
import { safeParseFamilyState } from "@/lib/validation/family";

const log = createLogger("services:family-state");

function readRawState(): unknown | undefined {
  if (typeof window === "undefined") return undefined;
  const raw =
    window.localStorage.getItem(savedFamilyStateKey) ??
    window.localStorage.getItem(legacySavedFamilyStateKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    log.warn("Saved family state is not valid JSON; starting fresh", { error });
    return undefined;
  }
}

/**
 * Load the locally saved family state, or `undefined` when there is none
 * (or it fails validation — corrupt saves fail closed to a clean demo).
 */
export function loadSavedFamilyState(): SavedFamilyState | undefined {
  const raw = readRawState();
  if (raw === undefined) return undefined;
  const parsed = safeParseFamilyState(raw);
  if (!parsed.ok) {
    log.warn("Saved family state failed validation; starting fresh", { issues: parsed.issues });
    return undefined;
  }
  return migrateSavedFamilyState(parsed.state);
}

/**
 * Persist the family state locally. The parent passcode is never written to
 * disk; child profiles are normalized on the way out.
 */
export function saveFamilyState(state: SavedFamilyState): void {
  if (typeof window === "undefined") return;
  const safeState: SavedFamilyState = {
    ...state,
    parentPasscode: undefined,
    children: state.children.map(normalizeChildProfile),
    pets: state.pets.map(normalizePetProfile),
    neighborhoodJobs: (state.neighborhoodJobs ?? []).map(normalizeNeighborhoodJob),
  };
  try {
    window.localStorage.setItem(savedFamilyStateKey, JSON.stringify(safeState));
  } catch (error) {
    log.warn("Family state did not fit in localStorage; retrying without the family photo", { error });
    try {
      window.localStorage.setItem(savedFamilyStateKey, JSON.stringify({ ...safeState, familyPhotoUrl: undefined }));
    } catch (retryError) {
      // Local persistence is best-effort in demo mode; the cloud snapshot
      // (Supabase) is the durable store. Never crash the UI over this.
      log.error("Family state could not be persisted locally", { error: retryError });
    }
  }
}

export { migrateSavedFamilyState };
