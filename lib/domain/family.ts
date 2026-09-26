/**
 * Family aggregate helpers: normalization, legacy migration, and trust labels.
 *
 * Pure functions over the persisted family state. Persistence itself lives in
 * `lib/services/family-state.ts`; validation in `lib/validation/family.ts`.
 */
import type { Child, Pet } from "@/lib/types";
import type { NeighborhoodJob, SavedFamilyState, TrustSignalKey } from "./family-types";
import { defaultParentPasscode, starterChildren, starterPets } from "./starter-data";

export function normalizeChildProfile(child: Child): Child {
  return {
    ...child,
    age: child.id === "sahasra" ? 6 : child.id === "aarush" ? 9 : child.age ?? 8,
    secretCode: "",
  };
}

export function normalizeNeighborhoodJob(job: NeighborhoodJob): NeighborhoodJob {
  return {
    ...job,
    visibleToKids: job.visibleToKids === true,
    minAge: job.minAge ?? 4,
    skillFocus: job.skillFocus ?? "teamwork",
    trustSignals: job.trustSignals?.length ? job.trustSignals : ["parent_gate", "age_fit", "private_child"],
  };
}

export function normalizePetProfile(pet: Pet): Pet {
  return pet.id === "jack" ? { ...pet, photoUrl: undefined } : pet;
}

/**
 * Migrate a previously saved family snapshot to the current shape.
 * Old demo identities ("maya"/"leo", "luna"/"mochi") are replaced with the
 * current starter family; everything else is normalized in place.
 */
export function migrateSavedFamilyState(state: SavedFamilyState): SavedFamilyState {
  const hasOldDemoKids = state.children.some((child) => child.id === "maya" || child.id === "leo");
  const hasOldDemoPets = state.pets.some((pet) => pet.id === "luna" || pet.id === "mochi");
  if (!hasOldDemoKids && !hasOldDemoPets) {
    return {
      ...state,
      children: state.children.map(normalizeChildProfile),
    };
  }

  return {
    ...state,
    children: starterChildren,
    pets: starterPets,
    activeChildId: state.activeChildId === "leo" ? "aarush" : "sahasra",
  };
}

export function getTrustSignalLabel(signal: TrustSignalKey): string {
  const labels: Record<TrustSignalKey, string> = {
    parent_gate: "Parent-gated",
    age_fit: "Age-fit",
    no_messaging: "No kid messaging",
    adult_nearby: "Adult nearby",
    private_child: "Child private",
  };
  return labels[signal];
}

/**
 * True when the parent gate still uses the shipped demo passcode.
 * Callers should nudge the parent to choose their own code; the gate is a
 * UI convenience, not a security boundary (see SECURITY.md).
 */
export function isDefaultParentPasscode(passcode: string | undefined): boolean {
  return passcode === defaultParentPasscode;
}
