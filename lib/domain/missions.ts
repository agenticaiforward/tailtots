/**
 * Mission domain logic: age-appropriateness, life-skill mapping,
 * fairness summaries, and kid-facing explanations.
 */
import type { Child, Mission } from "@/lib/types";
import { difficultyAgeGuidance } from "./starter-data";
import type { LifeSkillKey } from "./family-types";
import { getLifeSkillLabel } from "./badges";

export function isMissionAgeAppropriate(mission: Mission, child: Child): boolean {
  return child.age >= difficultyAgeGuidance[mission.difficulty].minAge;
}

export function getAgeFitCopy(mission: Mission, child?: Child): string {
  if (!child) return "Assign a kid to see age fit.";
  const guidance = difficultyAgeGuidance[mission.difficulty];
  return isMissionAgeAppropriate(mission, child)
    ? `Good age fit for ${child.name}. Suggested for ${guidance.label.toLowerCase()}.`
    : `${child.name} is younger than the ${guidance.label.toLowerCase()} guidance. Parent supervision recommended.`;
}

export function getMissionLifeSkill(mission: Mission): LifeSkillKey {
  if (mission.category === "kindness") return "empathy";
  if (mission.category === "community") return "teamwork";
  if (mission.category === "money") return "leadership";
  if (mission.category === "chore") return "time";
  return "responsibility";
}

export function getKidMissionReason(mission: Mission, child?: Child): string {
  if (!child) return "A grown-up will choose the right helper.";
  const ageCopy = isMissionAgeAppropriate(mission, child) ? "it fits your age" : "a grown-up will help because it is harder";
  const skillCopy = getLifeSkillLabel(getMissionLifeSkill(mission)).toLowerCase();
  return `${ageCopy}, it builds ${skillCopy}, and it keeps points fair with the family.`;
}

export type FairnessSummary = {
  spread: number;
  label: string;
  detail: string;
};

/** Compare planned (not yet approved) points across children. */
export function getFairnessSummary(missions: Mission[], children: Child[]): FairnessSummary {
  const plannedPoints = children.map((child) => ({
    child,
    points: missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sorted = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  return {
    spread,
    label: spread <= 8 ? "Balanced today" : "Needs balancing",
    detail:
      spread <= 8
        ? "Kids are set up to finish with similar points."
        : `${highest?.child.name ?? "One child"} has ${spread} more planned points than ${lowest?.child.name ?? "another child"}.`,
  };
}
