import { describe, expect, it } from "vitest";
import {
  EVOLUTION_THRESHOLDS,
  buildPetPersonalityPrompt,
  generatePetPersonality,
  missionsToNextStage,
  parsePetPersonalityResponse,
  petEvolutionStage,
  speciesBaseFor,
} from "../pet-personality";

describe("petEvolutionStage", () => {
  it("starts at egg", () => {
    expect(petEvolutionStage(0)).toBe("egg");
    expect(petEvolutionStage(4)).toBe("egg");
  });
  it("progresses through stages at thresholds", () => {
    expect(petEvolutionStage(5)).toBe("baby");
    expect(petEvolutionStage(25)).toBe("junior");
    expect(petEvolutionStage(75)).toBe("adult");
    expect(petEvolutionStage(150)).toBe("wise");
    expect(petEvolutionStage(999)).toBe("wise");
  });
  it("handles negatives and fractions", () => {
    expect(petEvolutionStage(-3)).toBe("egg");
    expect(petEvolutionStage(24.9)).toBe("baby");
  });
});

describe("missionsToNextStage", () => {
  it("counts down to the next threshold", () => {
    expect(missionsToNextStage(0)).toBe(5);
    expect(missionsToNextStage(20)).toBe(5);
  });
  it("returns null at max stage", () => {
    expect(missionsToNextStage(150)).toBeNull();
    expect(missionsToNextStage(500)).toBeNull();
  });
});

describe("speciesBaseFor", () => {
  it("returns known species traits", () => {
    const dog = speciesBaseFor("dog");
    expect(dog.energy).toBeTruthy();
    expect(dog.quirk).toBeTruthy();
  });
  it("is case-insensitive", () => {
    expect(speciesBaseFor("Guinea Pig").quirk).toContain("popcorn");
  });
  it("falls back for unknown species", () => {
    const x = speciesBaseFor("axolotl");
    expect(x.energy).toBe("curious");
  });
});

describe("generatePetPersonality", () => {
  it("builds deterministic bones from species + trait bands", () => {
    const p = generatePetPersonality({
      species: "dog",
      childTraitBands: { confidence: "blooming", empathy: "steady" },
      evolutionStage: "junior",
      totalCompletedMissions: 30,
    });
    expect(p.species).toBe("dog");
    expect(p.evolutionStage).toBe("junior");
    expect(p.tendencies.length).toBeGreaterThan(0);
    expect(p.tendencies.join(" ")).toContain("brave tries");
  });
  it("always produces at least one tendency", () => {
    const p = generatePetPersonality({
      species: "fish",
      childTraitBands: {},
      evolutionStage: "egg",
      totalCompletedMissions: 0,
    });
    expect(p.tendencies.length).toBeGreaterThan(0);
  });
  it("is deterministic — same input, same output", () => {
    const input = {
      species: "cat",
      childTraitBands: { curiosity: "blooming" as const },
      evolutionStage: "baby" as const,
      totalCompletedMissions: 6,
    };
    expect(generatePetPersonality(input)).toEqual(generatePetPersonality(input));
  });
});

describe("buildPetPersonalityPrompt", () => {
  it("includes species and stage but no PII", () => {
    const prompt = buildPetPersonalityPrompt({
      personality: generatePetPersonality({
        species: "rabbit",
        childTraitBands: { empathy: "blooming" },
        evolutionStage: "adult",
        totalCompletedMissions: 80,
      }),
      occasion: "evolved",
    });
    expect(prompt).toContain("rabbit");
    expect(prompt).toContain("adult");
    expect(prompt).not.toMatch(/maya|aarush|sahasra/i);
  });
  it("varies by occasion", () => {
    const base = {
      personality: generatePetPersonality({
        species: "dog",
        childTraitBands: {},
        evolutionStage: "baby",
        totalCompletedMissions: 5,
      }),
    };
    const evolved = buildPetPersonalityPrompt({ ...base, occasion: "evolved" });
    const daily = buildPetPersonalityPrompt({ ...base, occasion: "daily" });
    expect(evolved).not.toBe(daily);
  });
});

describe("parsePetPersonalityResponse", () => {
  it("accepts reasonable snippets", () => {
    expect(parsePetPersonalityResponse("Biscuit did a happy spin.")).toBe("Biscuit did a happy spin.");
  });
  it("rejects empty or absurd lengths", () => {
    expect(parsePetPersonalityResponse("hi")).toBeNull();
    expect(parsePetPersonalityResponse("x".repeat(500))).toBeNull();
  });
});

describe("EVOLUTION_THRESHOLDS", () => {
  it("is strictly increasing", () => {
    const t = [
      EVOLUTION_THRESHOLDS.egg,
      EVOLUTION_THRESHOLDS.baby,
      EVOLUTION_THRESHOLDS.junior,
      EVOLUTION_THRESHOLDS.adult,
      EVOLUTION_THRESHOLDS.wise,
    ];
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
  });
});
