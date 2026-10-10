import { describe, expect, it } from "vitest";
import {
  CARE_NEED_OPTIONS,
  PET_TRACKS,
  READINESS_THRESHOLD,
  careNeedsLabel,
  heroPet,
  isValidPetTrack,
  readinessBlurb,
  readinessScore,
  readinessUnlocked,
  realPetFromInput,
  speciesEmoji,
  toMissionEnginePet,
} from "../pet-tracks";
import type { Pet } from "../types";

const pet = (over: Partial<Pet> = {}): Pet => ({
  id: "p1",
  name: "Biscuit",
  species: "Dog",
  favoriteFood: "Peanut butter",
  careNotes: "Feeding, Fresh water",
  vet: "",
  medicine: "",
  ...over,
});

describe("pet tracks", () => {
  it("defines exactly three tracks", () => {
    expect(PET_TRACKS.map((t) => t.id)).toEqual(["have", "want", "cant"]);
  });

  it("validates track ids", () => {
    expect(isValidPetTrack("have")).toBe(true);
    expect(isValidPetTrack("want")).toBe(true);
    expect(isValidPetTrack("cant")).toBe(true);
    expect(isValidPetTrack("dragon")).toBe(false);
    expect(isValidPetTrack(null)).toBe(false);
  });

  it("labels care needs from ids", () => {
    expect(careNeedsLabel(["feeding", "grooming"])).toBe("Feeding, Grooming / brushing");
    expect(careNeedsLabel([])).toBe("");
  });

  it("care options are non-empty and unique", () => {
    expect(CARE_NEED_OPTIONS.length).toBeGreaterThan(0);
    const ids = CARE_NEED_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("toMissionEnginePet", () => {
  it("maps to exactly the engine shape", () => {
    const out = toMissionEnginePet(pet());
    expect(out).toEqual({
      species: "Dog",
      name: "Biscuit",
      careNeeds: "Feeding, Fresh water; loves Peanut butter",
    });
    // No extra keys leak through
    expect(Object.keys(out).sort()).toEqual(["careNeeds", "name", "species"]);
  });

  it("omits empty name and careNeeds", () => {
    const out = toMissionEnginePet(pet({ name: "", careNotes: "", favoriteFood: "" }));
    expect(out).toEqual({ species: "Dog" });
  });
});

describe("realPetFromInput", () => {
  it("builds a Pet from onboarding input", () => {
    const p = realPetFromInput({
      name: "  Biscuit ",
      species: "Dog",
      age: "3 years",
      careNeedIds: ["feeding", "exercise"],
    });
    expect(p.name).toBe("Biscuit");
    expect(p.species).toBe("Dog");
    expect(p.careNotes).toBe("Feeding, Exercise / walks");
    expect(p.id).toMatch(/^pet-/);
  });

  it("falls back to Buddy for blank names", () => {
    expect(realPetFromInput({ name: "   ", species: "Cat", careNeedIds: [] }).name).toBe("Buddy");
  });
});

describe("readiness", () => {
  it("scores 0 for no activity", () => {
    expect(readinessScore({ careMissions: 0, streakDays: 0, activeDays30d: 0 })).toBe(0);
  });

  it("scores 100 at full marks", () => {
    expect(readinessScore({ careMissions: 40, streakDays: 14, activeDays30d: 21 })).toBe(100);
  });

  it("weights consistency highest", () => {
    const consistent = readinessScore({ careMissions: 0, streakDays: 0, activeDays30d: 21 });
    const streaky = readinessScore({ careMissions: 0, streakDays: 14, activeDays30d: 0 });
    expect(consistent).toBeGreaterThan(streaky);
  });

  it("unlocks at the threshold", () => {
    expect(readinessUnlocked({ careMissions: 40, streakDays: 14, activeDays30d: 21 })).toBe(true);
    expect(readinessUnlocked({ careMissions: 0, streakDays: 0, activeDays30d: 0 })).toBe(false);
    expect(READINESS_THRESHOLD).toBe(80);
  });

  it("blurbs change with score", () => {
    expect(readinessBlurb(90)).toContain("Ready");
    expect(readinessBlurb(10)).toContain("starts");
  });
});

describe("heroPet + speciesEmoji", () => {
  it("prefers the pet with a real photo", () => {
    const withPhoto = pet({ id: "a", photoUrl: "data:image/jpeg;base64,xxx" });
    const without = pet({ id: "b", photoUrl: undefined });
    expect(heroPet([without, withPhoto])?.id).toBe("a");
  });

  it("falls back to the first pet", () => {
    expect(heroPet([pet({ id: "x" })])?.id).toBe("x");
    expect(heroPet([])).toBeUndefined();
  });

  it("maps species to emoji", () => {
    expect(speciesEmoji("Golden Retriever Dog")).toBe("🐶");
    expect(speciesEmoji("cat")).toBe("🐱");
    expect(speciesEmoji("mystery beast")).toBe("🐾");
  });
});
