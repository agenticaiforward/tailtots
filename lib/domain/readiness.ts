/**
 * Pet Ready Family journey: milestone definitions and progress derivation.
 *
 * The journey documents consistency over 8–12 weeks. It proves readiness;
 * it never promises a pet — the final decision always belongs to the parent.
 */
import type { BankTransaction, Child, Mission } from "@/lib/types";
import type { ReadinessSignOff } from "./family-types";

export type MilestoneDef = {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
};

export const MILESTONES: MilestoneDef[] = [
  {
    id: "care-rhythm",
    title: "Daily care rhythm",
    description: "Show up for a pet every day. Consistency matters more than perfection.",
    target: 7,
    unit: "day streak",
  },
  {
    id: "pet-care-pro",
    title: "Hands-on pet care",
    description: "Finish pet-care missions: fresh food and water, clean space, comfort checks.",
    target: 12,
    unit: "missions",
  },
  {
    id: "kindness-quest",
    title: "Kindness beyond home",
    description: "Join kindness or community missions — shelter help, giving, volunteering.",
    target: 3,
    unit: "quests",
  },
  {
    id: "parent-trust",
    title: "Parent sign-offs",
    description: "Missions reviewed and approved by a parent. Trust is built in the open.",
    target: 10,
    unit: "approvals",
  },
  {
    id: "giving-heart",
    title: "Giving heart",
    description: "Move Kid Bank money to giving — caring for animals beyond your own home.",
    target: 1,
    unit: "gift",
  },
];

/** Special sign-off id for the final family conversation (not a milestone). */
export const FAMILY_TALK_SIGN_OFF_ID = "family-talk";

export function milestoneProgress(
  milestoneId: string,
  child: Child,
  missions: Mission[],
  transactions: BankTransaction[],
): number {
  const childMissions = missions.filter(
    (mission) => mission.completedBy === child.id || mission.assignedChildId === child.id,
  );
  switch (milestoneId) {
    case "care-rhythm":
      return child.streakDays;
    case "pet-care-pro":
      return childMissions.filter((mission) => mission.category === "pet_care" && mission.completedBy === child.id).length;
    case "kindness-quest":
      return childMissions.filter(
        (mission) =>
          (mission.category === "kindness" || mission.category === "community") && mission.completedBy === child.id,
      ).length;
    case "parent-trust":
      return childMissions.filter((mission) => mission.status === "approved").length;
    case "giving-heart":
      return transactions.filter(
        (tx) => tx.childId === child.id && tx.category === "give" && tx.status === "approved",
      ).length;
    default:
      return 0;
  }
}

export type MilestoneState = {
  milestone: MilestoneDef;
  progress: number;
  isComplete: boolean;
  signOff: ReadinessSignOff | undefined;
};

export type JourneySummary = {
  states: MilestoneState[];
  completeCount: number;
  journeyPct: number;
  readyForTalk: boolean;
  talkSignOff: ReadinessSignOff | undefined;
};

export function summarizeJourney(
  child: Child,
  missions: Mission[],
  transactions: BankTransaction[],
  signOffs: ReadinessSignOff[],
): JourneySummary {
  const states = MILESTONES.map((milestone) => {
    const progress = milestoneProgress(milestone.id, child, missions, transactions);
    const isComplete = progress >= milestone.target;
    const signOff = signOffs.find((s) => s.milestoneId === milestone.id && s.childId === child.id);
    return { milestone, progress, isComplete, signOff };
  });
  const completeCount = states.filter((s) => s.isComplete).length;
  return {
    states,
    completeCount,
    journeyPct: Math.round((completeCount / MILESTONES.length) * 100),
    readyForTalk: completeCount === MILESTONES.length,
    talkSignOff: signOffs.find((s) => s.milestoneId === FAMILY_TALK_SIGN_OFF_ID && s.childId === child.id),
  };
}
