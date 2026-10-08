import { describe, expect, it } from "vitest";
import { buildJobFamilySummary, jobVisibleInZip } from "../neighborhood-helpers";

describe("jobVisibleInZip", () => {
  it("shows everything when the family ZIP is not set", () => {
    expect(jobVisibleInZip("75034", "")).toBe(true);
    expect(jobVisibleInZip("90210", "123")).toBe(true);
    expect(jobVisibleInZip(undefined, "")).toBe(true);
  });

  it("always shows jobs without a ZIP (family's own posts / legacy data)", () => {
    expect(jobVisibleInZip(undefined, "75034")).toBe(true);
  });

  it("filters to the family's ZIP once it is set", () => {
    expect(jobVisibleInZip("75034", "75034")).toBe(true);
    expect(jobVisibleInZip("90210", "75034")).toBe(false);
    expect(jobVisibleInZip("75035", "75034")).toBe(false);
  });
});

describe("buildJobFamilySummary", () => {
  const base = {
    title: "Care visit for Milo",
    pet: "Milo the rabbit",
    time: "Tuesday, 4:30 PM",
    rewardDollars: 4,
    badgeTitle: "Kind Neighbor",
    skillLabel: "Empathy",
    safety: "Parent stays nearby; no cage cleaning yet.",
  };

  it("includes the job facts a grandparent needs", () => {
    const text = buildJobFamilySummary(base);
    expect(text).toContain("Care visit for Milo");
    expect(text).toContain("Milo the rabbit");
    expect(text).toContain("Tuesday, 4:30 PM");
    expect(text).toContain("$4 allowance");
    expect(text).toContain("Empathy");
    expect(text).toContain("Parent stays nearby");
  });

  it("falls back to the badge title when there is no money reward", () => {
    const text = buildJobFamilySummary({ ...base, rewardDollars: 0 });
    expect(text).toContain("Kind Neighbor");
    expect(text).not.toContain("$0");
  });

  it("carries the no-kid-details promise", () => {
    const text = buildJobFamilySummary(base);
    expect(text).toContain("No kid details are ever shared");
    // The summary builder never receives family/kid identifiers at all.
    expect(text).not.toContain("Patel family");
    expect(text).not.toContain("sahasra");
  });
});
