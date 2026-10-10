import { describe, expect, it } from "vitest";
import {
  PROVIDER_KIND_LABELS,
  PROVIDER_KINDS,
  PROVIDER_NEEDS,
  SCHOOL_LADDER,
  SHELTER_LADDER,
  PTO_LADDER,
  draftLadderFromNeeds,
  providerMissionSeeds,
  seedProviders,
  seedsForAge,
} from "../ecosystem/providers";

describe("mission providers — charter model", () => {
  it("defines the three provider kinds", () => {
    expect([...PROVIDER_KINDS]).toEqual(["shelter", "school", "pto"]);
    expect(PROVIDER_KIND_LABELS.shelter).toBeTruthy();
  });

  it("seeds one provider per kind with the right eco context", () => {
    const providers = seedProviders();
    expect(providers).toHaveLength(3);
    const byKind = Object.fromEntries(providers.map((p) => [p.kind, p]));
    expect(byKind.shelter.ecoContext).toBe("community");
    expect(byKind.school.ecoContext).toBe("school");
    expect(byKind.pto.ecoContext).toBe("community");
    for (const p of providers) {
      expect(p.ladders.length).toBeGreaterThan(0);
      expect(p.contactEmail).toContain("@");
    }
  });

  it("shelter ladder is progressive with age bands and supervision", () => {
    const rungs = SHELTER_LADDER.levels.map((l) => l.name);
    expect(rungs).toEqual(["Helper", "Buddy", "Ambassador"]);
    // supervision loosens as rungs progress
    expect(SHELTER_LADDER.levels[0].supervision).toBe("direct");
    // every level has an unlock rule and tasks with skill tags
    for (const level of SHELTER_LADDER.levels) {
      expect(level.unlockRule.length).toBeGreaterThan(0);
      expect(level.tasks.length).toBeGreaterThan(0);
      for (const t of level.tasks) {
        expect(t.skillTags.length).toBeGreaterThan(0);
        expect(t.minutes).toBeGreaterThan(0);
      }
    }
  });

  it("school ladder tasks carry SEL-relevant skill tags", () => {
    const tags = new Set(SCHOOL_LADDER.levels.flatMap((l) => l.tasks.flatMap((t) => t.skillTags)));
    expect(tags.has("empathy")).toBe(true);
    expect(tags.has("respect")).toBe(true);
  });

  it("PTO ladder covers participant and organizer rungs", () => {
    expect(PTO_LADDER.levels.map((l) => l.name)).toEqual(["Participant", "Organizer"]);
  });

  it("providerMissionSeeds flattens ladders into community mission seeds", () => {
    const providers = seedProviders();
    const shelter = providers.find((p) => p.kind === "shelter")!;
    const seeds = providerMissionSeeds(shelter);
    expect(seeds.length).toBeGreaterThan(0);
    for (const s of seeds) {
      expect(s.providerId).toBe(shelter.id);
      expect(s.providerKind).toBe("shelter");
      expect(s.minAge).toBeLessThanOrEqual(s.maxAge);
      expect(s.title).toContain(shelter.name);
    }
    // total seed count matches total tasks across levels
    const taskCount = SHELTER_LADDER.levels.reduce((a, l) => a + l.tasks.length, 0);
    expect(seeds).toHaveLength(taskCount);
  });

  it("seedsForAge filters by inclusive age bands", () => {
    const providers = seedProviders();
    const seeds = providers.flatMap(providerMissionSeeds);
    const forSix = seedsForAge(seeds, 6);
    const forTwelve = seedsForAge(seeds, 12);
    expect(forSix.length).toBeGreaterThan(0);
    expect(forTwelve.length).toBeGreaterThanOrEqual(forSix.length);
    for (const s of forSix) {
      expect(s.minAge).toBeLessThanOrEqual(6);
      expect(s.maxAge).toBeGreaterThanOrEqual(6);
    }
    // ambassador-level tasks (minAge 10) excluded for a 6-year-old
    expect(forSix.every((s) => s.minAge <= 6)).toBe(true);
  });

  it("PROVIDER_NEEDS covers every kind", () => {
    for (const kind of PROVIDER_KINDS) {
      expect(PROVIDER_NEEDS[kind].length).toBeGreaterThan(0);
    }
  });

  it("draftLadderFromNeeds builds a reviewable draft, never auto-publishes", () => {
    const draft = draftLadderFromNeeds("shelter", "Riverside Shelter", [
      "Dog walking",
      "Donation drives",
    ]);
    expect(draft.id).toMatch(/^draft-/);
    expect(draft.name).toMatch(/draft/i);
    expect(draft.description).toMatch(/review/i);
    const totalTasks = draft.levels.reduce((a, l) => a + l.tasks.length, 0);
    expect(totalTasks).toBeGreaterThan(0);
    // every task id is namespaced as a draft
    for (const l of draft.levels) {
      expect(l.id).toMatch(/^draft-/);
      for (const t of l.tasks) expect(t.id).toMatch(/^draft-/);
    }
  });

  it("draft with no matching needs falls back to full template", () => {
    const draft = draftLadderFromNeeds("school", "Riverside Elementary", ["Underwater basket weaving"]);
    const totalTasks = draft.levels.reduce((a, l) => a + l.tasks.length, 0);
    const templateTasks = SCHOOL_LADDER.levels.reduce((a, l) => a + l.tasks.length, 0);
    expect(totalTasks).toBe(templateTasks);
  });
});
