import { describe, expect, it } from "vitest";
import {
  SEASONS,
  buildPhysicalExtensionPrompt,
  parsePhysicalExtensionResponse,
  suggestPhysicalExtension,
} from "../physical-bridge";

describe("suggestPhysicalExtension", () => {
  it("maps a category to a concrete activity", () => {
    const ext = suggestPhysicalExtension({
      category: "pet_care",
      missionTheme: "brushing the dog",
      season: "spring",
      ageBand: "4-6",
    });
    expect(ext).not.toBeNull();
    expect(ext!.title).toBeTruthy();
    expect(ext!.description).toContain("Spring twist");
    expect(ext!.minutes).toBeGreaterThan(0);
    expect(ext!.materials.length).toBeGreaterThan(0);
  });
  it("is deterministic for the same theme", () => {
    const input = {
      category: "kindness",
      missionTheme: "helping a neighbor",
      season: "fall" as const,
      ageBand: "7-9",
    };
    expect(suggestPhysicalExtension(input)).toEqual(suggestPhysicalExtension(input));
  });
  it("returns null for unknown categories", () => {
    expect(
      suggestPhysicalExtension({
        category: "quantum_physics",
        missionTheme: "entanglement",
        season: "winter",
        ageBand: "10-12",
      }),
    ).toBeNull();
  });
  it("applies the seasonal twist", () => {
    const winter = suggestPhysicalExtension({
      category: "chore",
      missionTheme: "tidying",
      season: "winter",
      ageBand: "4-6",
    });
    expect(winter!.description).toContain("Winter twist");
  });
});

describe("buildPhysicalExtensionPrompt", () => {
  it("includes category, season, and age band", () => {
    const prompt = buildPhysicalExtensionPrompt({
      category: "kindness",
      missionTheme: "thank-you cards",
      season: "summer",
      ageBand: "7-9",
    });
    expect(prompt).toContain("kindness");
    expect(prompt).toContain("summer");
    expect(prompt).toContain("7-9");
  });
  it("constrains the LLM to household materials and calm tone", () => {
    const prompt = buildPhysicalExtensionPrompt({
      category: "money",
      missionTheme: "coin sorting",
      season: "spring",
      ageBand: "4-6",
    });
    expect(prompt).toMatch(/household/i);
    expect(prompt).not.toMatch(/!/);
  });
});

describe("parsePhysicalExtensionResponse", () => {
  it("accepts reasonable suggestions", () => {
    const text = "Build a blanket fort together and read one book inside it.";
    expect(parsePhysicalExtensionResponse(text)).toBe(text);
  });
  it("rejects too-short or too-long output", () => {
    expect(parsePhysicalExtensionResponse("Go outside.")).toBeNull();
    expect(parsePhysicalExtensionResponse("x".repeat(500))).toBeNull();
  });
});

describe("SEASONS", () => {
  it("covers all four seasons", () => {
    expect(SEASONS).toEqual(["spring", "summer", "fall", "winter"]);
  });
});
