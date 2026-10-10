/**
 * TailTots Ecosystem — Mission Provider framework (charter model).
 *
 * Shelters, schools, and PTOs plug in as "mission providers": they supply
 * the place, the people, and the real work; the platform supplies the kits,
 * the records, and the distribution. Borrowed from the Scouts charter model:
 * the org owns the local experience, the platform owns the connective tissue.
 *
 * Provider missions feed the Mission Engine as `community`-category missions
 * (the category already exists in MISSION_CATEGORIES).
 */
import type { EcoContext } from "./types";

/** Organization kind. */
export type ProviderKind = "shelter" | "school" | "pto";

export const PROVIDER_KINDS: readonly ProviderKind[] = ["shelter", "school", "pto"] as const;

export const PROVIDER_KIND_LABELS: Record<ProviderKind, string> = {
  shelter: "Animal shelter",
  school: "School",
  pto: "PTO / parent group",
};

export const PROVIDER_KIND_EMOJI: Record<ProviderKind, string> = {
  shelter: "🐾",
  school: "🏫",
  pto: "🎉",
};

/** How closely an adult must supervise this level. */
export type SupervisionLevel = "direct" | "nearby" | "independent";

export const SUPERVISION_LABELS: Record<SupervisionLevel, string> = {
  direct: "Direct — adult alongside the child",
  nearby: "Nearby — adult in the same room/area",
  independent: "Independent — adult checks in after",
};

export interface LadderTask {
  id: string;
  title: string;
  prompt: string;
  /** Typical minutes. */
  minutes: number;
  /** Strength tags this task practices, e.g. ["kindness", "patience"]. */
  skillTags: string[];
}

export interface LadderLevel {
  id: string;
  name: string;
  /** Rung label, e.g. "Rung 1". */
  rung: number;
  minAge: number;
  maxAge: number;
  supervision: SupervisionLevel;
  tasks: LadderTask[];
  /** What unlocks the next rung (plain language). */
  unlockRule: string;
}

export interface SkillLadder {
  id: string;
  name: string;
  description: string;
  levels: LadderLevel[];
}

export interface MissionProvider {
  id: string;
  kind: ProviderKind;
  name: string;
  contactEmail: string;
  /** Where the work happens (address or "on campus"). */
  location: string;
  ladders: SkillLadder[];
  /** EcoContext this provider's events belong to. */
  ecoContext: EcoContext;
  enrolledAt: string; // ISO
}

/** A mission seed the Mission Engine can plan from (community category). */
export interface ProviderMissionSeed {
  providerId: string;
  providerKind: ProviderKind;
  ladderId: string;
  levelId: string;
  taskId: string;
  title: string;
  prompt: string;
  minutes: number;
  skillTags: string[];
  minAge: number;
  maxAge: number;
  supervision: SupervisionLevel;
}

function taskId(provider: string, ladder: string, level: string, n: number): string {
  return `${provider}.${ladder}.${level}.t${n}`;
}

// ---------------------------------------------------------------------------
// Seed ladders
// ---------------------------------------------------------------------------

/**
 * Shelter ladder — based on the junior-volunteer pattern (foundations first,
 * then animal contact, then ambassadorship). Real work: socializing shy cats,
 * reading to rabbits, supervised dog walking.
 */
export const SHELTER_LADDER: SkillLadder = {
  id: "shelter-paws",
  name: "Shelter Paws",
  description: "Real volunteer work with shelter animals — from quiet helper to youth ambassador.",
  levels: [
    {
      id: "shelter-paws.helper",
      name: "Helper",
      rung: 1,
      minAge: 6,
      maxAge: 12,
      supervision: "direct",
      unlockRule: "Complete 3 Helper tasks with your grown-up beside you.",
      tasks: [
        {
          id: taskId("shelter", "paws", "helper", 1),
          title: "Toy maker",
          prompt: "Make a simple braided toy from old t-shirts for the shelter cats. Bring it on your next visit.",
          minutes: 20,
          skillTags: ["kindness", "creativity"],
        },
        {
          id: taskId("shelter", "paws", "helper", 2),
          title: "Quiet reader",
          prompt: "Sit near the rabbit room and read a book out loud for 10 minutes. Calm voices help shy animals feel safe.",
          minutes: 15,
          skillTags: ["patience", "kindness"],
        },
        {
          id: taskId("shelter", "paws", "helper", 3),
          title: "Treat trail",
          prompt: "With a grown-up, help scatter treats in the enrichment garden for the dogs to sniff out.",
          minutes: 15,
          skillTags: ["responsibility", "kindness"],
        },
      ],
    },
    {
      id: "shelter-paws.buddy",
      name: "Buddy",
      rung: 2,
      minAge: 8,
      maxAge: 12,
      supervision: "nearby",
      unlockRule: "Finish the Helper rung and get a staff thumbs-up.",
      tasks: [
        {
          id: taskId("shelter", "paws", "buddy", 1),
          title: "Shy-cat socializer",
          prompt: "Spend 15 quiet minutes near a shy cat's kennel — reading, drawing, or just sitting. Let the cat come to you.",
          minutes: 20,
          skillTags: ["patience", "empathy"],
        },
        {
          id: taskId("shelter", "paws", "buddy", 2),
          title: "Walk partner",
          prompt: "Walk a calm shelter dog with a grown-up holding the leash with you. Practice loose-leash walking together.",
          minutes: 25,
          skillTags: ["responsibility", "self-control"],
        },
        {
          id: taskId("shelter", "paws", "buddy", 3),
          title: "Kennel artist",
          prompt: "Make a cheerful name card for one animal waiting for adoption — draw what makes them special.",
          minutes: 20,
          skillTags: ["kindness", "creativity"],
        },
      ],
    },
    {
      id: "shelter-paws.ambassador",
      name: "Ambassador",
      rung: 3,
      minAge: 10,
      maxAge: 12,
      supervision: "nearby",
      unlockRule: "Finish the Buddy rung and co-lead one adoption-day activity.",
      tasks: [
        {
          id: taskId("shelter", "paws", "ambassador", 1),
          title: "Adoption-day greeter",
          prompt: "Welcome visitors at an adoption event and tell them one true, kind thing about an animal you know.",
          minutes: 45,
          skillTags: ["confidence", "kindness"],
        },
        {
          id: taskId("shelter", "paws", "ambassador", 2),
          title: "Donation driver",
          prompt: "Run a 2-week donation drive for one shelter need (blankets, food, toys). Track it on your Giving page.",
          minutes: 30,
          skillTags: ["leadership", "perseverance"],
        },
      ],
    },
  ],
};

/** School ladder — classroom kindness, teacher-supervised, SEL-aligned. */
export const SCHOOL_LADDER: SkillLadder = {
  id: "school-kindness-crew",
  name: "Kindness Crew",
  description: "Classroom missions that practice empathy, respect, and teamwork — assigned by teachers.",
  levels: [
    {
      id: "school-kindness-crew.helper",
      name: "Helper",
      rung: 1,
      minAge: 4,
      maxAge: 12,
      supervision: "direct",
      unlockRule: "Complete 3 Helper missions in class.",
      tasks: [
        {
          id: taskId("school", "crew", "helper", 1),
          title: "Welcome buddy",
          prompt: "Notice someone sitting alone at lunch or recess and invite them to join you — kindly, no pressure.",
          minutes: 10,
          skillTags: ["empathy", "kindness"],
        },
        {
          id: taskId("school", "crew", "helper", 2),
          title: "Tidy teammate",
          prompt: "Without being asked, tidy one shared space — the book corner, the art shelf, the cubbies.",
          minutes: 10,
          skillTags: ["responsibility", "respect"],
        },
        {
          id: taskId("school", "crew", "helper", 3),
          title: "Thank-you note",
          prompt: "Write a thank-you note to someone who helps your class — a custodian, a lunch helper, a volunteer.",
          minutes: 15,
          skillTags: ["kindness", "respect"],
        },
      ],
    },
    {
      id: "school-kindness-crew.leader",
      name: "Leader",
      rung: 2,
      minAge: 7,
      maxAge: 12,
      supervision: "nearby",
      unlockRule: "Finish the Helper rung and be nominated by a classmate.",
      tasks: [
        {
          id: taskId("school", "crew", "leader", 1),
          title: "Peace helper",
          prompt: "When you see a small disagreement, offer to listen to both sides — then help find one fair idea.",
          minutes: 15,
          skillTags: ["empathy", "self-control"],
        },
        {
          id: taskId("school", "crew", "leader", 2),
          title: "New-kid guide",
          prompt: "Show a new student around for a day: where things are, how lunch works, one fun fact about the class.",
          minutes: 30,
          skillTags: ["kindness", "confidence"],
        },
        {
          id: taskId("school", "crew", "leader", 3),
          title: "Class project captain",
          prompt: "Lead a small group project — make sure everyone gets a turn to talk before deciding.",
          minutes: 30,
          skillTags: ["leadership", "patience"],
        },
      ],
    },
  ],
};

/** PTO ladder — family volunteering at community events. */
export const PTO_LADDER: SkillLadder = {
  id: "pto-community-crew",
  name: "Community Crew",
  description: "Family volunteer missions at PTO events — show up, help out, belong.",
  levels: [
    {
      id: "pto-community-crew.participant",
      name: "Participant",
      rung: 1,
      minAge: 4,
      maxAge: 12,
      supervision: "direct",
      unlockRule: "Join 2 PTO family events with your grown-up.",
      tasks: [
        {
          id: taskId("pto", "crew", "participant", 1),
          title: "Event helper",
          prompt: "At the next PTO event, help with one job for 15 minutes — handing out programs, holding the welcome sign.",
          minutes: 20,
          skillTags: ["responsibility", "kindness"],
        },
        {
          id: taskId("pto", "crew", "participant", 2),
          title: "Park clean-up crew",
          prompt: "Join the family park clean-up. Fill one bag with litter — and notice how the park looks after.",
          minutes: 30,
          skillTags: ["respect", "responsibility"],
        },
      ],
    },
    {
      id: "pto-community-crew.organizer",
      name: "Organizer",
      rung: 2,
      minAge: 8,
      maxAge: 12,
      supervision: "nearby",
      unlockRule: "Finish the Participant rung and co-plan one event station.",
      tasks: [
        {
          id: taskId("pto", "crew", "organizer", 1),
          title: "Station captain",
          prompt: "Run one station at a PTO event (face paint line, game booth). Greet every family that comes through.",
          minutes: 45,
          skillTags: ["leadership", "confidence"],
        },
        {
          id: taskId("pto", "crew", "organizer", 2),
          title: "Fundraiser friend",
          prompt: "Help count and sort fundraiser items, then write thank-you cards to three supporters.",
          minutes: 30,
          skillTags: ["perseverance", "kindness"],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Provider registry + mission seed generation
// ---------------------------------------------------------------------------

/** Seed providers — the charter partners the platform launches with. */
export function seedProviders(): MissionProvider[] {
  const now = new Date().toISOString();
  return [
    {
      id: "prov-sunny-shelter",
      kind: "shelter",
      name: "Sunny Acres Animal Shelter",
      contactEmail: "volunteer@example.org",
      location: "Demo city",
      ladders: [SHELTER_LADDER],
      ecoContext: "community",
      enrolledAt: now,
    },
    {
      id: "prov-maple-school",
      kind: "school",
      name: "Maple Grove Elementary",
      contactEmail: "office@example.org",
      location: "Demo city",
      ladders: [SCHOOL_LADDER],
      ecoContext: "school",
      enrolledAt: now,
    },
    {
      id: "prov-maple-pto",
      kind: "pto",
      name: "Maple Grove PTO",
      contactEmail: "pto@example.org",
      location: "Demo city",
      ladders: [PTO_LADDER],
      ecoContext: "community",
      enrolledAt: now,
    },
  ];
}

/**
 * Flatten a provider's ladders into mission seeds for the Mission Engine.
 * These become `community`-category missions, weighted like other categories.
 * Age-filtered at plan time.
 */
export function providerMissionSeeds(provider: MissionProvider): ProviderMissionSeed[] {
  const seeds: ProviderMissionSeed[] = [];
  for (const ladder of provider.ladders) {
    for (const level of ladder.levels) {
      for (const task of level.tasks) {
        seeds.push({
          providerId: provider.id,
          providerKind: provider.kind,
          ladderId: ladder.id,
          levelId: level.id,
          taskId: task.id,
          title: `${task.title} — with ${provider.name}`,
          prompt: task.prompt,
          minutes: task.minutes,
          skillTags: [...task.skillTags],
          minAge: level.minAge,
          maxAge: level.maxAge,
          supervision: level.supervision,
        });
      }
    }
  }
  return seeds;
}

/** Seeds appropriate for an age (inclusive bands). */
export function seedsForAge(seeds: ProviderMissionSeed[], age: number): ProviderMissionSeed[] {
  return seeds.filter((s) => age >= s.minAge && age <= s.maxAge);
}

/** Needs checklist options shown in the provider onboarding form. */
export const PROVIDER_NEEDS: Record<ProviderKind, string[]> = {
  shelter: [
    "Dog walking",
    "Socializing shy cats",
    "Reading to small animals",
    "Adoption-day greeters",
    "Donation drives",
    "Toy / blanket making",
  ],
  school: [
    "Classroom kindness missions",
    "Recess buddy program",
    "New-student welcome",
    "Conflict-resolution practice",
    "Thank-you note campaigns",
  ],
  pto: [
    "Event volunteers",
    "Park / campus clean-ups",
    "Fundraiser helpers",
    "Welcome committees",
    "Game-booth captains",
  ],
};

/**
 * Draft a starter ladder from a new provider's needs checklist. The provider
 * reviews and edits — the platform never auto-publishes. Template-based,
 * deterministic (no model call needed for the draft).
 */
export function draftLadderFromNeeds(
  kind: ProviderKind,
  providerName: string,
  needs: string[],
): SkillLadder {
  const base = kind === "shelter" ? SHELTER_LADDER : kind === "school" ? SCHOOL_LADDER : PTO_LADDER;
  const picked = new Set(needs);
  const levels: LadderLevel[] = base.levels.map((level) => ({
    ...level,
    id: `draft-${kind}.${level.id}`,
    tasks: level.tasks
      .filter((t) =>
        // Keep tasks whose title/prompt overlap a selected need (fuzzy keyword match).
        [...picked].some((need) => {
          const words = need.toLowerCase().split(/[\s/]+/);
          const hay = `${t.title} ${t.prompt}`.toLowerCase();
          return words.some((w) => w.length > 3 && hay.includes(w));
        }),
      )
      .map((t) => ({ ...t, id: `draft-${t.id}` })),
  })).filter((l) => l.tasks.length > 0);

  return {
    id: `draft-${kind}-ladder`,
    name: `${providerName} — starter ladder (draft)`,
    description: `Drafted from your needs checklist. Review each task before publishing — nothing goes live automatically.`,
    levels: levels.length > 0 ? levels : base.levels.map((l) => ({ ...l, id: `draft-${l.id}` })),
  };
}
