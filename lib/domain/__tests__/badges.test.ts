import { describe, expect, it } from "vitest";
import type { Child } from "@/lib/types";
import type { BadgeAward } from "@/lib/domain/family-types";
import { getBadgeTitle, getFamilySkillSummary, getLifeSkillLabel } from "@/lib/domain/badges";

function child(overrides: Partial<Child> = {}): Child {
  return {
    id: "c1",
    name: "Kid",
    age: 8,
    secretCode: "",
    points: 0,
    coins: 0,
    level: "easy",
    streakDays: 0,
    ...overrides,
  };
}

function badge(overrides: Partial<BadgeAward> = {}): BadgeAward {
  return {
    id: `b-${Math.random().toString(36).slice(2)}`,
    childId: "c1",
    title: "Badge",
    skill: "responsibility",
    note: "",
    awardedAt: "",
    ...overrides,
  };
}

describe("labels and titles", () => {
  it("labels every life skill", () => {
    expect(getLifeSkillLabel("responsibility")).toBe("Responsibility");
    expect(getLifeSkillLabel("empathy")).toBe("Empathy");
    expect(getLifeSkillLabel("teamwork")).toBe("Teamwork");
    expect(getLifeSkillLabel("leadership")).toBe("Leadership");
    expect(getLifeSkillLabel("time")).toBe("Time management");
  });

  it("titles every badge", () => {
    expect(getBadgeTitle("responsibility")).toBe("Responsibility Star");
    expect(getBadgeTitle("empathy")).toBe("Kind Heart");
    expect(getBadgeTitle("teamwork")).toBe("Team Helper");
    expect(getBadgeTitle("leadership")).toBe("Junior Leader");
    expect(getBadgeTitle("time")).toBe("On-Time Helper");
  });
});

describe("getFamilySkillSummary", () => {
  it("finds the top skill across the family's children", () => {
    const kids = [child({ id: "c1" }), child({ id: "c2" })];
    const badges = [
      badge({ childId: "c1", skill: "empathy" }),
      badge({ childId: "c2", skill: "empathy" }),
      badge({ childId: "c1", skill: "responsibility" }),
      badge({ childId: "ghost", skill: "teamwork" }),
    ];
    const summary = getFamilySkillSummary(badges, kids);
    expect(summary.topSkill).toBe("empathy");
    expect(summary.topLabel).toBe("Empathy");
    expect(summary.totalBadges).toBe(3);
  });

  it("handles an empty badge shelf", () => {
    const summary = getFamilySkillSummary([], [child()]);
    expect(summary.totalBadges).toBe(0);
    expect(summary.topLabel).toBe("First value badge ready");
  });
});
