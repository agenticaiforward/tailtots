/**
 * Badge and life-skill domain logic.
 */
import type { Child } from "@/lib/types";
import type { BadgeAward, LifeSkillKey } from "./family-types";

export function getLifeSkillLabel(skill: LifeSkillKey): string {
  const labels: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility",
    empathy: "Empathy",
    teamwork: "Teamwork",
    leadership: "Leadership",
    time: "Time management",
  };
  return labels[skill];
}

export function getBadgeTitle(skill: LifeSkillKey): string {
  const titles: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility Star",
    empathy: "Kind Heart",
    teamwork: "Team Helper",
    leadership: "Junior Leader",
    time: "On-Time Helper",
  };
  return titles[skill];
}

export type FamilySkillSummary = {
  topSkill: LifeSkillKey;
  topLabel: string;
  totalBadges: number;
};

export function getFamilySkillSummary(badges: BadgeAward[], children: Child[]): FamilySkillSummary {
  const counts = (["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => ({
    skill,
    count: badges.filter((badge) => badge.skill === skill && children.some((child) => child.id === badge.childId)).length,
  }));
  const top = [...counts].sort((a, b) => b.count - a.count)[0];
  return {
    topSkill: top?.skill ?? "responsibility",
    topLabel: top?.count ? getLifeSkillLabel(top.skill) : "First value badge ready",
    totalBadges: counts.reduce((sum, item) => sum + item.count, 0),
  };
}
