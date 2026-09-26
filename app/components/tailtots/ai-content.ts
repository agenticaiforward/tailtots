import type { Child, Mission } from "@/lib/types";
import type { LifeSkillKey } from "@/lib/domain/family-types";
import { getLifeSkillLabel } from "@/lib/domain";
export function buildKidAiSuggestion(questionId: string, petName: string, childName: string) {
  const suggestions: Record<string, { title: string; body: string }> = {
    care: {
      title: `${childName}, try a calm care check.`,
      body: `Look at ${petName}'s food, water, comfort, and space. Pick one thing to fix, then ask a parent to review it with you.`,
    },
    fact: {
      title: `${petName} notices routines.`,
      body: "Many pets feel safer when care happens in the same gentle order each day. That is why small habits matter.",
    },
    hobby: {
      title: "Turn care into a mini project.",
      body: `Draw ${petName}'s favorite snack, make a simple care chart, or build a small paper maze or observation journal with a parent nearby.`,
    },
    quote: {
      title: "Kindness grows by practice.",
      body: "A small helpful action today can become a strong life skill tomorrow.",
    },
  };
  return suggestions[questionId] ?? suggestions.care;
}

export function buildSmartMissions(petType: string, routine: string) {
  const pet = petType.trim() || "pet";
  const routineParts = routine.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 3);
  const baseParts = routineParts.length ? routineParts : ["fresh food", "clean water", "comfort check"];
  return baseParts.map((part, index) => `${index + 1}. ${pet} mission: ${part}. Kid step: do it, notice one thing, then ask parent to approve.`);
}

export function buildLifeSkillChores(skill: string, goal: string, childProfiles: Child[]) {
  const label = getLifeSkillLabel((skill as LifeSkillKey) || "responsibility");
  const sortedKids = [...childProfiles].sort((a, b) => a.age - b.age);
  const younger = sortedKids[0];
  const older = sortedKids[sortedKids.length - 1];
  const purpose = goal.trim() || `Teach ${label.toLowerCase()} through simple care routines`;
  return [
    `${younger?.name ?? "Younger child"}: easy mission, 10-12 points. Notice one pet need and tell a parent. Purpose: ${purpose}.`,
    `${older?.name ?? "Older child"}: medium mission, 16-20 points. Complete a care checklist and help reset supplies.`,
    "Parent rule: reward effort and completion, not speed. If one child gets harder work, add enough points so weekly totals stay close.",
    "Kid-facing wording: show helpful next steps and badges, not rankings or judgment.",
  ];
}

export function buildFairnessPlan(missions: Mission[], childProfiles: Child[]) {
  if (!childProfiles.length) return ["Add children first so TailTots can balance tasks."];
  const totals = childProfiles.map((child) => {
    const assigned = missions.filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved");
    return {
      child,
      points: assigned.reduce((sum, mission) => sum + mission.points, 0),
      count: assigned.length,
    };
  });
  const max = Math.max(...totals.map((item) => item.points), 0);
  return totals.map(({ child, points, count }) => {
    const gap = max - points;
    return `${child.name}, age ${child.age}: ${count} open task${count === 1 ? "" : "s"}, ${points} planned points${gap ? `, add about ${gap} points or one easier helper task to balance` : ", balanced for this plan"}.`;
  });
}

export function buildCareChecklist(notes: string) {
  const parts = notes.split(".").map((part) => part.trim()).filter(Boolean).slice(0, 4);
  const safeParts = parts.length ? parts : ["Check food", "Check water", "Use gentle hands"];
  return safeParts.map((part, index) => `${index + 1}. ${part}. Parent note: confirm before kid handles anything risky.`);
}

export function buildMemoryMoment(note: string) {
  const cleanNote = note.trim() || "A kind pet care moment happened today.";
  return `Today we noticed responsibility in action: ${cleanNote} It was a small moment, but it showed care, attention, and growing confidence.`;
}

export function buildPassportSummary(petType: string, petAge: string, routine: string, notes: string) {
  return `${petType || "Pet"} (${petAge || "age not set"}) needs a calm routine: ${routine || "food, water, and comfort checks"}. Parent care note: ${notes || "Keep instructions simple and confirm safety first."}`;
}

export function buildPhotoJournal(moment: string) {
  const cleanMoment = moment.trim() || "A sweet pet moment";
  return `${cleanMoment}. Suggested caption: "A little care today made our pet feel safe, seen, and loved."`;
}
