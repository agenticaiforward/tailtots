import { describe, expect, it } from "vitest";
import type { Child, Pet } from "@/lib/types";
import type { NeighborhoodJob, SavedFamilyState } from "@/lib/domain/family-types";
import {
  isDefaultParentPasscode,
  migrateSavedFamilyState,
  normalizeChildProfile,
  normalizeNeighborhoodJob,
  normalizePetProfile,
} from "@/lib/domain/family";
import { defaultParentPasscode } from "@/lib/domain/starter-data";

function child(overrides: Partial<Child> = {}): Child {
  return {
    id: "x",
    name: "Kid",
    age: 10,
    secretCode: "1234",
    points: 0,
    coins: 0,
    level: "easy",
    streakDays: 0,
    ...overrides,
  };
}

describe("normalizeChildProfile", () => {
  it("always clears the secret code before persistence", () => {
    expect(normalizeChildProfile(child({ secretCode: "9999" })).secretCode).toBe("");
  });

  it("pins known demo kids to their canonical ages", () => {
    expect(normalizeChildProfile(child({ id: "sahasra", age: 12 })).age).toBe(6);
    expect(normalizeChildProfile(child({ id: "aarush", age: 3 })).age).toBe(9);
  });

  it("defaults unknown kids to age 8", () => {
    expect(normalizeChildProfile(child({ id: "new", age: undefined as unknown as number })).age).toBe(8);
  });
});

describe("normalizePetProfile", () => {
  it("strips the demo photo from jack", () => {
    const pet: Pet = {
      id: "jack",
      name: "Jack",
      species: "Guinea pig",
      favoriteFood: "",
      careNotes: "",
      vet: "",
      medicine: "",
      photoUrl: "data:image/png;base64,xxx",
    };
    expect(normalizePetProfile(pet).photoUrl).toBeUndefined();
  });

  it("leaves other pets untouched", () => {
    const pet: Pet = {
      id: "jamie",
      name: "Jamie",
      species: "Guinea pig",
      favoriteFood: "",
      careNotes: "",
      vet: "",
      medicine: "",
      photoUrl: "https://example.com/jamie.png",
    };
    expect(normalizePetProfile(pet).photoUrl).toBe("https://example.com/jamie.png");
  });
});

describe("normalizeNeighborhoodJob", () => {
  function job(overrides: Partial<NeighborhoodJob> = {}): NeighborhoodJob {
    return {
      id: "j1",
      title: "Job",
      family: "Family",
      pet: "Pet",
      time: "",
      rewardDollars: 0,
      badgeTitle: "",
      assignedChildIds: [],
      visibleToKids: true,
      checklist: [],
      safety: "",
      status: "posted",
      ...overrides,
    };
  }

  it("fills trust defaults", () => {
    const normalized = normalizeNeighborhoodJob(job({ visibleToKids: undefined as unknown as boolean }));
    expect(normalized.visibleToKids).toBe(false);
    expect(normalized.minAge).toBe(4);
    expect(normalized.skillFocus).toBe("teamwork");
    expect(normalized.trustSignals).toEqual(["parent_gate", "age_fit", "private_child"]);
  });

  it("keeps explicit trust signals", () => {
    const normalized = normalizeNeighborhoodJob(job({ trustSignals: ["no_messaging"] }));
    expect(normalized.trustSignals).toEqual(["no_messaging"]);
  });
});

describe("migrateSavedFamilyState", () => {
  function state(overrides: Partial<SavedFamilyState> = {}): SavedFamilyState {
    return {
      parents: [],
      children: [child({ id: "maya" })],
      pets: [],
      ...overrides,
    };
  }

  it("replaces legacy demo identities with the starter family", () => {
    const migrated = migrateSavedFamilyState(state());
    expect(migrated.children.some((c) => c.id === "maya")).toBe(false);
    expect(migrated.children.some((c) => c.id === "sahasra")).toBe(true);
  });

  it("remaps the legacy active child id", () => {
    const migrated = migrateSavedFamilyState(state({ activeChildId: "leo" }));
    expect(migrated.activeChildId).toBe("aarush");
  });

  it("normalizes current-family children in place", () => {
    const migrated = migrateSavedFamilyState(state({ children: [child({ id: "kid-1", secretCode: "5555" })] }));
    expect(migrated.children[0]?.secretCode).toBe("");
  });
});

describe("isDefaultParentPasscode", () => {
  it("detects the shipped demo passcode", () => {
    expect(isDefaultParentPasscode(defaultParentPasscode)).toBe(true);
    expect(isDefaultParentPasscode("9876")).toBe(false);
    expect(isDefaultParentPasscode(undefined)).toBe(false);
  });
});
