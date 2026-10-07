import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_DIRECTORY, neighborhoodSuggestionsForZip, normalizeZip } from "../neighborhoods";

describe("normalizeZip", () => {
  it("accepts a plain 5-digit ZIP", () => {
    expect(normalizeZip("75034")).toBe("75034");
  });
  it("strips dashes and spaces (ZIP+4 style)", () => {
    expect(normalizeZip("75034-1234")).toBe("75034");
    expect(normalizeZip(" 75035 ")).toBe("75035");
  });
  it("rejects short, long, or non-numeric input", () => {
    expect(normalizeZip("7503")).toBeNull();
    expect(normalizeZip("750345")).toBeNull();
    expect(normalizeZip("abcde")).toBeNull();
    expect(normalizeZip("")).toBeNull();
  });
});

describe("neighborhoodSuggestionsForZip", () => {
  it("returns curated suggestions for a known ZIP", () => {
    const suggestions = neighborhoodSuggestionsForZip("75034");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toEqual(NEIGHBORHOOD_DIRECTORY["75034"]);
  });
  it("returns generic fallback labels for an unknown-but-valid ZIP", () => {
    const suggestions = neighborhoodSuggestionsForZip("99999");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions).toContain("My apartment / rental community");
  });
  it("returns nothing for invalid input", () => {
    expect(neighborhoodSuggestionsForZip("nope")).toEqual([]);
    expect(neighborhoodSuggestionsForZip("")).toEqual([]);
  });
  it("never mutates the directory when returning suggestions", () => {
    const before = [...NEIGHBORHOOD_DIRECTORY["75034"]];
    neighborhoodSuggestionsForZip("75034").push("Mutant");
    expect(NEIGHBORHOOD_DIRECTORY["75034"]).toEqual(before);
  });
});
