/**
 * Character curriculum: 4 traits × 3 levels (Sprout → Grow → Flourish), each
 * level a pack of 4 concrete real-world missions. Missions are taught through
 * doing — every mission is a real-world action a 5–12 year old can do, never a
 * worksheet or a lecture.
 *
 * Curriculum missions are instantiated as regular Mission objects (see
 * instantiateCurriculumMissions) so they flow through the existing
 * assign → complete → parent-approve → badge pipeline unchanged. The
 * `curriculum` tag on the mission lets progression be *derived* from mission
 * state: a level is complete when every template missionKey in the pack has at
 * least one parent-approved instance for the child, and a trait-level badge is
 * awarded idempotently (see detectNewlyCompletedCurriculumLevels).
 */

import type {
  CharacterTraitKey,
  LevelKey,
  Mission,
} from "./types";

/** Skill-meter key a trait's level badges feed (existing LifeSkillKey set). */
export type TraitSkill = "responsibility" | "empathy" | "leadership";

export type CurriculumMissionTemplate = {
  /** Stable key within the trait+level pack, e.g. "resp-s1-water". */
  key: string;
  title: string;
  category: Mission["category"];
  difficulty: LevelKey;
  points: number;
  coins: number;
  question: string;
  /** Inclusive age band this mission is written for (site serves 5–12). */
  minAge: number;
  maxAge: number;
  /**
   * Pet-free alternative. When the family has no pets (or the kid is on the
   * readiness track), instantiateCurriculumMissions swaps in noPetTitle /
   * noPetQuestion so no kid is ever asked to do something impossible.
   */
  noPetTitle?: string;
  noPetQuestion?: string;
};

export type CurriculumLevel = {
  /** 0-based index: 0 = Sprout, 1 = Grow, 2 = Flourish. */
  index: number;
  name: string;
  tagline: string;
  ageBand: string;
  missions: CurriculumMissionTemplate[];
};

export type CharacterTrait = {
  key: CharacterTraitKey;
  label: string;
  emoji: string;
  /** Gradient stops reused by the picker/progress UI (matches site palette). */
  colors: string;
  blurb: string;
  /** Existing skill meter this trait's badges feed. */
  skill: TraitSkill;
  levels: CurriculumLevel[];
};

export const CURRICULUM_LEVEL_NAMES = ["Sprout", "Grow", "Flourish"] as const;

export const TRAIT_SKILL: Record<CharacterTraitKey, TraitSkill> = {
  responsibility: "responsibility",
  empathy: "empathy",
  kindness: "empathy",
  leadership: "leadership",
};

export const TRAIT_META: Record<CharacterTraitKey, { label: string; emoji: string; colors: string; blurb: string }> = {
  responsibility: {
    label: "Responsibility",
    emoji: "🌱",
    colors: "from-[#86efac] via-[#4ade80] to-[#165a4b]",
    blurb: "Owning real jobs — pet care, home routines, and keeping your word.",
  },
  empathy: {
    label: "Empathy",
    emoji: "💛",
    colors: "from-[#ffd166] via-[#f4b400] to-[#f47b20]",
    blurb: "Noticing feelings — in animals and people — and responding with care.",
  },
  kindness: {
    label: "Kindness",
    emoji: "🤝",
    colors: "from-[#f9a8d4] via-[#f472b6] to-[#6d3ed1]",
    blurb: "Doing good on purpose — helping, sharing, and giving to others.",
  },
  leadership: {
    label: "Leadership",
    emoji: "⭐",
    colors: "from-[#93c5fd] via-[#4f8df7] to-[#1d4ed8]",
    blurb: "Leading with fairness — organizing, teaching, and lifting others up.",
  },
};

/* ------------------------------------------------------------------ */
/* Responsibility 🌱                                                   */
/* ------------------------------------------------------------------ */

const responsibilitySprout: CurriculumMissionTemplate[] = [
  {
    key: "resp-s1-water",
    title: "Fresh water morning",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Was the water fresh and full this morning?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Plant water check",
    noPetQuestion: "Did you water the thirsty plant and check the soil with a fingertip?",
  },
  {
    key: "resp-s1-breakfast",
    title: "Breakfast on time, no reminders",
    category: "pet_care",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "Did it happen on time with zero reminders?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Breakfast table, no reminders",
    noPetQuestion: "Did you set the table (or clear it) without being asked?",
  },
  {
    key: "resp-s1-tidy",
    title: "5-minute toy tidy-up",
    category: "chore",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Is the room tidy? Did you beat your best time?",
    minAge: 5,
    maxAge: 7,
  },
  {
    key: "resp-s1-bedtime",
    title: "Bedtime reset",
    category: "chore",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "Clothes ready for tomorrow? Hamper used?",
    minAge: 5,
    maxAge: 7,
  },
];

const responsibilityGrow: CurriculumMissionTemplate[] = [
  {
    key: "resp-s2-routine",
    title: "Own the evening routine",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What did you notice during your check?",
    minAge: 7,
    maxAge: 10,
    noPetTitle: "Own the evening plant routine",
    noPetQuestion: "Did you check every plant, water the thirsty ones, and turn them toward the light?",
  },
  {
    key: "resp-s2-laundry",
    title: "Laundry helper: one full load",
    category: "chore",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Is every piece folded and put away?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "resp-s2-space",
    title: "Pet space refresh",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What changed in the space after your refresh?",
    minAge: 7,
    maxAge: 10,
    noPetTitle: "Room corner deep-clean",
    noPetQuestion: "Is your corner dusted, tidy, and guest-ready?",
  },
  {
    key: "resp-s2-reminder",
    title: "Reminder keeper for a week",
    category: "chore",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Did you remember all 7 days? What helped you remember?",
    minAge: 8,
    maxAge: 10,
  },
];

const responsibilityFlourish: CurriculumMissionTemplate[] = [
  {
    key: "resp-s3-vetprep",
    title: "Vet visit prep",
    category: "pet_care",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What did you learn about your pet while preparing?",
    minAge: 9,
    maxAge: 12,
    noPetTitle: "Shelter animal research",
    noPetQuestion: "What 5 facts did you write down about what that animal needs?",
  },
  {
    key: "resp-s3-meals",
    title: "Meal helper week",
    category: "chore",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "Which two dinners did you help with, and what was your job?",
    minAge: 10,
    maxAge: 12,
  },
  {
    key: "resp-s3-budget",
    title: "Pet budget tracker",
    category: "money",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What was the total? What surprised you?",
    minAge: 10,
    maxAge: 12,
    noPetTitle: "Grocery receipt tracker",
    noPetQuestion: "Did you write down 10 items with prices and add them up?",
  },
  {
    key: "resp-s3-planner",
    title: "My week, my plan",
    category: "chore",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "Which 5 days did you follow your plan? What would you change?",
    minAge: 9,
    maxAge: 12,
  },
];

/* ------------------------------------------------------------------ */
/* Empathy 💛                                                          */
/* ------------------------------------------------------------------ */

const empathySprout: CurriculumMissionTemplate[] = [
  {
    key: "emp-s1-detective",
    title: "Feelings detective",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "What feeling did you spot, and what gave it away?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Backyard feelings detective",
    noPetQuestion: "What were the birds or squirrels feeling? How could you tell?",
  },
  {
    key: "emp-s1-comfort",
    title: "2-minute comfort check",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Lean in or move away? What did you learn?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Calm cuddle practice",
    noPetQuestion: "Did slow breathing feel calm? What did you notice?",
  },
  {
    key: "emp-s1-sorry",
    title: "Sorry and fix-it",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "What was your fix-it? How did they react?",
    minAge: 5,
    maxAge: 7,
  },
  {
    key: "emp-s1-thanks",
    title: "Thank-you card delivery",
    category: "kindness",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Who got your card? How did giving it feel?",
    minAge: 5,
    maxAge: 7,
  },
];

const empathyGrow: CurriculumMissionTemplate[] = [
  {
    key: "emp-s2-welcome",
    title: "Welcome someone new",
    category: "community",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Who did you include? What did you do?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "emp-s2-bodylang",
    title: "Pet body-language study",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Which 3 signs did you learn? When did you spot them?",
    minAge: 7,
    maxAge: 10,
    noPetTitle: "Animal body-language study",
    noPetQuestion: "Which 3 signs did you learn? When did you spot one?",
  },
  {
    key: "emp-s2-listen",
    title: "Listening ears: 3 full minutes",
    category: "kindness",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What did you hear? Did they feel listened to?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "emp-s2-shelter",
    title: "Shelter kindness craft",
    category: "kindness",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What did you make? How do you hope it helps?",
    minAge: 8,
    maxAge: 10,
  },
];

const empathyFlourish: CurriculumMissionTemplate[] = [
  {
    key: "emp-s3-perspective",
    title: "Perspective swap interview",
    category: "kindness",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What surprised you most about their story?",
    minAge: 9,
    maxAge: 12,
  },
  {
    key: "emp-s3-calmcoach",
    title: "Calm-down coach",
    category: "kindness",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What trick did you teach? Did it help?",
    minAge: 10,
    maxAge: 12,
  },
  {
    key: "emp-s3-advocate",
    title: "Animal advocate",
    category: "community",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What change did you make for animals?",
    minAge: 9,
    maxAge: 12,
    noPetTitle: "Animal cause helper",
    noPetQuestion: "What real thing did you do for the cause you picked?",
  },
  {
    key: "emp-s3-gratitude",
    title: "Gratitude week",
    category: "kindness",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "Which night's gratitude was hardest to think of? Why?",
    minAge: 9,
    maxAge: 12,
  },
];

/* ------------------------------------------------------------------ */
/* Kindness 🤝                                                         */
/* ------------------------------------------------------------------ */

const kindnessSprout: CurriculumMissionTemplate[] = [
  {
    key: "kind-s1-hello",
    title: "Helper hello",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "What did you do? Did they smile?",
    minAge: 5,
    maxAge: 7,
  },
  {
    key: "kind-s1-share",
    title: "Share one favorite thing",
    category: "kindness",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "What did you share? How did it feel?",
    minAge: 5,
    maxAge: 7,
  },
  {
    key: "kind-s1-treat",
    title: "Pet treat surprise",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "What was the surprise? What happened?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Neighbor surprise",
    noPetQuestion: "What surprise did you leave? (With a parent's help.)",
  },
  {
    key: "kind-s1-jar",
    title: "Kind-words jar",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "Which note made someone happiest?",
    minAge: 6,
    maxAge: 7,
  },
];

const kindnessGrow: CurriculumMissionTemplate[] = [
  {
    key: "kind-s2-toys",
    title: "Toy giveaway: 3 toys",
    category: "kindness",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Which 3 toys? Where did they go?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "kind-s2-neighbor",
    title: "Neighbor helper",
    category: "community",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What job did you do? What did your neighbor say?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "kind-s2-stand",
    title: "Mini fundraiser: give half",
    category: "money",
    difficulty: "medium",
    points: 18,
    coins: 4,
    question: "How much did you raise? Which cause gets it?",
    minAge: 8,
    maxAge: 10,
  },
  {
    key: "kind-s2-secret",
    title: "Secret kind week",
    category: "kindness",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Which secret act was your favorite?",
    minAge: 7,
    maxAge: 10,
  },
];

const kindnessFlourish: CurriculumMissionTemplate[] = [
  {
    key: "kind-s3-goal",
    title: "Giving goal champion",
    category: "money",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What cause did you pick? How will you earn the $5?",
    minAge: 9,
    maxAge: 12,
  },
  {
    key: "kind-s3-teach",
    title: "Teach a skill",
    category: "community",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What did you teach? What was the hardest part of teaching?",
    minAge: 10,
    maxAge: 12,
  },
  {
    key: "kind-s3-helper",
    title: "Thank a community helper",
    category: "kindness",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "Who did you thank? What did you say?",
    minAge: 9,
    maxAge: 12,
  },
  {
    key: "kind-s3-fixit",
    title: "Fix-it crew: one thing, start to finish",
    category: "chore",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What did you fix? How long did it take?",
    minAge: 9,
    maxAge: 12,
  },
];

/* ------------------------------------------------------------------ */
/* Leadership ⭐                                                       */
/* ------------------------------------------------------------------ */

const leadershipSprout: CurriculumMissionTemplate[] = [
  {
    key: "lead-s1-lineleader",
    title: "Line leader cleanup",
    category: "chore",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "Who did what? Did you finish in 10 minutes?",
    minAge: 5,
    maxAge: 7,
  },
  {
    key: "lead-s1-trainer",
    title: "Pet trainer minute",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "What trick? How many tries did it take?",
    minAge: 5,
    maxAge: 7,
    noPetTitle: "Trick coach",
    noPetQuestion: "What 3-step routine did you coach? Who learned it?",
  },
  {
    key: "lead-s1-captain",
    title: "Game captain",
    category: "community",
    difficulty: "easy",
    points: 12,
    coins: 2,
    question: "What game? Did everyone get a fair turn?",
    minAge: 6,
    maxAge: 7,
  },
  {
    key: "lead-s1-morning",
    title: "Morning starter",
    category: "chore",
    difficulty: "easy",
    points: 10,
    coins: 1,
    question: "Which 3 mornings? How did you help without nagging?",
    minAge: 5,
    maxAge: 7,
  },
];

const leadershipGrow: CurriculumMissionTemplate[] = [
  {
    key: "lead-s2-meeting",
    title: "Family meeting leader",
    category: "chore",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What got decided at your meeting?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "lead-s2-teacher",
    title: "Pet care teacher",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "What did you teach? What question did they ask?",
    minAge: 8,
    maxAge: 10,
    noPetTitle: "Plant care teacher",
    noPetQuestion: "What did you teach? What question did they ask?",
  },
  {
    key: "lead-s2-cleanup",
    title: "Park cleanup crew",
    category: "community",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "How much did your crew collect?",
    minAge: 7,
    maxAge: 10,
  },
  {
    key: "lead-s2-buddy",
    title: "Buddy system week",
    category: "kindness",
    difficulty: "medium",
    points: 18,
    coins: 3,
    question: "Who was your buddy? What did they need most?",
    minAge: 8,
    maxAge: 10,
  },
];

const leadershipFlourish: CurriculumMissionTemplate[] = [
  {
    key: "lead-s3-project",
    title: "Project planner",
    category: "money",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What's the project? What are the first 3 steps?",
    minAge: 10,
    maxAge: 12,
  },
  {
    key: "lead-s3-captain",
    title: "Team captain",
    category: "community",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What did you captain? How did you keep it fair?",
    minAge: 9,
    maxAge: 12,
  },
  {
    key: "lead-s3-safety",
    title: "Home safety inspector",
    category: "chore",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What did your inspection find?",
    minAge: 10,
    maxAge: 12,
  },
  {
    key: "lead-s3-mentor",
    title: "Mentor moment",
    category: "kindness",
    difficulty: "hard",
    points: 24,
    coins: 4,
    question: "What was hard for them? What helped?",
    minAge: 9,
    maxAge: 12,
  },
];

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function makeLevel(index: number, tagline: string, ageBand: string, missions: CurriculumMissionTemplate[]): CurriculumLevel {
  return { index, name: CURRICULUM_LEVEL_NAMES[index], tagline, ageBand, missions };
}

export const CHARACTER_TRAITS: CharacterTrait[] = [
  {
    key: "responsibility",
    ...TRAIT_META.responsibility,
    skill: TRAIT_SKILL.responsibility,
    levels: [
      makeLevel(0, "Small jobs, done without being asked.", "Ages 5–7", responsibilitySprout),
      makeLevel(1, "Own a real routine, start to finish.", "Ages 7–10", responsibilityGrow),
      makeLevel(2, "Plan it, track it, see it through.", "Ages 9–12", responsibilityFlourish),
    ],
  },
  {
    key: "empathy",
    ...TRAIT_META.empathy,
    skill: TRAIT_SKILL.empathy,
    levels: [
      makeLevel(0, "Notice feelings — in animals and people.", "Ages 5–7", empathySprout),
      makeLevel(1, "Step into someone else's shoes.", "Ages 7–10", empathyGrow),
      makeLevel(2, "Understand deeply, then act on it.", "Ages 9–12", empathyFlourish),
    ],
  },
  {
    key: "kindness",
    ...TRAIT_META.kindness,
    skill: TRAIT_SKILL.kindness,
    levels: [
      makeLevel(0, "Kindness you can do today.", "Ages 5–7", kindnessSprout),
      makeLevel(1, "Kindness that leaves the house.", "Ages 7–10", kindnessGrow),
      makeLevel(2, "Kindness with a plan.", "Ages 9–12", kindnessFlourish),
    ],
  },
  {
    key: "leadership",
    ...TRAIT_META.leadership,
    skill: TRAIT_SKILL.leadership,
    levels: [
      makeLevel(0, "Lead the small stuff well.", "Ages 5–7", leadershipSprout),
      makeLevel(1, "Organize people, keep it fair.", "Ages 7–10", leadershipGrow),
      makeLevel(2, "Plan it, captain it, mentor through it.", "Ages 9–12", leadershipFlourish),
    ],
  },
];

export function traitByKey(key: CharacterTraitKey): CharacterTrait {
  const trait = CHARACTER_TRAITS.find((t) => t.key === key);
  if (!trait) throw new Error(`Unknown character trait: ${key}`);
  return trait;
}

export function traitLevel(traitKey: CharacterTraitKey, levelIndex: number): CurriculumLevel {
  const trait = traitByKey(traitKey);
  const level = trait.levels[levelIndex];
  if (!level) throw new Error(`Unknown level ${levelIndex} for trait ${traitKey}`);
  return level;
}

/** Badge title for a completed trait level, e.g. "Responsibility Sprout". */
export function curriculumLevelBadgeTitle(traitKey: CharacterTraitKey, levelIndex: number): string {
  const trait = traitByKey(traitKey);
  return `${trait.label} ${trait.levels[levelIndex].name}`;
}

/** Deterministic badge id so level awards are idempotent across sessions. */
export function curriculumLevelBadgeId(childId: string, traitKey: CharacterTraitKey, levelIndex: number): string {
  return `char-${childId}-${traitKey}-${levelIndex}`;
}

/* ------------------------------------------------------------------ */
/* Instantiation — templates → real Mission objects                    */
/* ------------------------------------------------------------------ */

export type InstantiateOptions = {
  /** When false, pet-assuming missions use their no-pet alternative copy. */
  hasPet: boolean;
  /** ID prefix override (defaults to a timestamped curriculum id). */
  idPrefix?: string;
};

/**
 * Build real Mission objects from a trait+level pack so they flow through the
 * existing assign → complete → parent-approve → badge pipeline. Missions are
 * tagged with `curriculum` so level completion can be derived later.
 */
export function instantiateCurriculumMissions(
  traitKey: CharacterTraitKey,
  levelIndex: number,
  childId: string,
  options: InstantiateOptions,
): Mission[] {
  const level = traitLevel(traitKey, levelIndex);
  const prefix = options.idPrefix ?? `curri-${Date.now()}`;
  return level.missions.map((template, slot) => {
    const useNoPet = !options.hasPet && Boolean(template.noPetTitle);
    return {
      id: `${prefix}-${traitKey}-l${levelIndex}-${slot}`,
      title: useNoPet ? template.noPetTitle! : template.title,
      category: template.category,
      difficulty: template.difficulty,
      points: template.points,
      coins: template.coins,
      allowanceDollars: 0,
      assignedChildId: childId,
      petId: undefined,
      question: useNoPet ? template.noPetQuestion! : template.question,
      status: "pending" as const,
      visibleToKids: true,
      curriculum: { trait: traitKey, level: levelIndex, missionKey: template.key },
    } satisfies Mission;
  });
}

/* ------------------------------------------------------------------ */
/* Progression — derived from mission + badge state                    */
/* ------------------------------------------------------------------ */

export type CurriculumLevelStatus = {
  traitKey: CharacterTraitKey;
  levelIndex: number;
  levelName: string;
  /** Template mission keys in the pack. */
  total: number;
  /** Distinct template keys with ≥1 approved instance for this child. */
  approvedCount: number;
  /** Level is complete: every pack mission approved at least once. */
  complete: boolean;
  /** Trait-level badge already awarded (also the cloud-persisted signal). */
  badgeAwarded: boolean;
  /** What the UI should treat as "done" (complete locally OR badged). */
  done: boolean;
};

export type BadgeLike = { childId: string; title: string };

/**
 * Status of one trait level for one child. Completion is keyed on distinct
 * template missionKeys so repeatMission copies and re-assignments can't
 * double-count, and a repeated level re-completes naturally.
 */
export function getCurriculumLevelStatus(
  childId: string,
  traitKey: CharacterTraitKey,
  levelIndex: number,
  missions: Pick<Mission, "status" | "assignedChildId" | "completedBy" | "curriculum">[],
  badges: BadgeLike[],
): CurriculumLevelStatus {
  const level = traitLevel(traitKey, levelIndex);
  const packKeys = new Set(level.missions.map((m) => m.key));
  const approvedKeys = new Set<string>();
  for (const mission of missions) {
    const tag = mission.curriculum;
    if (!tag) continue;
    if (tag.trait !== traitKey || tag.level !== levelIndex) continue;
    if (!packKeys.has(tag.missionKey)) continue;
    const belongsToChild = mission.completedBy === childId || mission.assignedChildId === childId;
    if (!belongsToChild) continue;
    if (mission.status === "approved") approvedKeys.add(tag.missionKey);
  }
  const badgeAwarded = badges.some(
    (badge) => badge.childId === childId && badge.title === curriculumLevelBadgeTitle(traitKey, levelIndex),
  );
  const complete = approvedKeys.size >= packKeys.size;
  return {
    traitKey,
    levelIndex,
    levelName: level.name,
    total: packKeys.size,
    approvedCount: approvedKeys.size,
    complete,
    badgeAwarded,
    done: complete || badgeAwarded,
  };
}

export type ChildCurriculumSummary = {
  traitKey: CharacterTraitKey;
  label: string;
  emoji: string;
  levels: CurriculumLevelStatus[];
  levelsDone: number;
};

/** Per-trait curriculum summary for one child (drives the picker + progress UI). */
export function getChildCurriculumSummary(
  childId: string,
  missions: Pick<Mission, "status" | "assignedChildId" | "completedBy" | "curriculum">[],
  badges: BadgeLike[],
): ChildCurriculumSummary[] {
  return CHARACTER_TRAITS.map((trait) => {
    const levels = trait.levels.map((level) =>
      getCurriculumLevelStatus(childId, trait.key, level.index, missions, badges),
    );
    return {
      traitKey: trait.key,
      label: trait.label,
      emoji: trait.emoji,
      levels,
      levelsDone: levels.filter((l) => l.done).length,
    };
  });
}

export type CompletedCurriculumLevel = {
  childId: string;
  traitKey: CharacterTraitKey;
  levelIndex: number;
};

/**
 * Levels that are complete but have no trait-level badge yet. Call after
 * mission/badge state changes; award one badge per returned entry using
 * buildCurriculumLevelBadge. Idempotent: already-badged levels never return.
 */
export function detectNewlyCompletedCurriculumLevels(
  missions: Pick<Mission, "id" | "status" | "assignedChildId" | "completedBy" | "curriculum">[],
  badges: BadgeLike[],
  childIds: string[],
): CompletedCurriculumLevel[] {
  const found: CompletedCurriculumLevel[] = [];
  for (const childId of childIds) {
    for (const trait of CHARACTER_TRAITS) {
      for (const level of trait.levels) {
        const status = getCurriculumLevelStatus(childId, trait.key, level.index, missions, badges);
        if (status.complete && !status.badgeAwarded) {
          found.push({ childId, traitKey: trait.key, levelIndex: level.index });
        }
      }
    }
  }
  return found;
}

export type CurriculumBadgeAward = {
  id: string;
  childId: string;
  title: string;
  skill: TraitSkill;
  note: string;
  awardedAt: string;
};

/** Build the trait-level badge for a completed level. */
export function buildCurriculumLevelBadge(
  childId: string,
  childName: string,
  traitKey: CharacterTraitKey,
  levelIndex: number,
): CurriculumBadgeAward {
  const trait = traitByKey(traitKey);
  const level = trait.levels[levelIndex];
  return {
    id: curriculumLevelBadgeId(childId, traitKey, levelIndex),
    childId,
    title: curriculumLevelBadgeTitle(traitKey, levelIndex),
    skill: trait.skill,
    note: `${childName} completed the ${level.name} level of ${trait.label} — all ${level.missions.length} missions, parent-approved.`,
    awardedAt: "Today",
  };
}

/**
 * Curriculum missions whose template key already has an *open* (non-approved)
 * instance for this child — used to skip duplicates on re-assignment.
 */
export function openCurriculumMissionKeys(
  childId: string,
  traitKey: CharacterTraitKey,
  levelIndex: number,
  missions: Pick<Mission, "status" | "assignedChildId" | "completedBy" | "curriculum">[],
): Set<string> {
  const open = new Set<string>();
  for (const mission of missions) {
    const tag = mission.curriculum;
    if (!tag || tag.trait !== traitKey || tag.level !== levelIndex) continue;
    const belongsToChild = mission.completedBy === childId || mission.assignedChildId === childId;
    if (!belongsToChild) continue;
    if (mission.status !== "approved") open.add(tag.missionKey);
  }
  return open;
}
