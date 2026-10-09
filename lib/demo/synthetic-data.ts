/**
 * Synthetic demo family data — carefully crafted, realistic, deterministic.
 *
 * Three children with distinct behavioral patterns designed to showcase the
 * AI systems:
 * - Maya (5): struggles on Thursdays (long school day), low confidence early
 *   that improves over time. Picks easy missions, avoids hard ones.
 * - Leo (8): confidence dip in weeks 5-8 (more skips, stops attempting hard
 *   missions), strong in kindness, weak in perseverance.
 * - Ava (11): thriving — high completion, attempts harder missions, long streaks.
 *
 * Every number on the AI Insights dashboard is computed by the REAL algorithms
 * in lib/ai/* from this data. Nothing is hardcoded.
 */

import type { MissionCategory, MissionDifficulty, MissionSkill } from "../ai/mission-engine";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic so the demo is stable.
// ---------------------------------------------------------------------------

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoChild {
  id: string;
  name: string;
  age: number;
  seed: number;
  blurb: string;
  streakDays: number;
  lastStreakDate: string | null;
}

export interface DemoPet {
  name: string;
  species: string;
  careNeeds: string;
}

/** One mission's full lifecycle — the atomic unit of synthetic history. */
export interface DemoMission {
  taskId: string;
  childId: string;
  category: MissionCategory;
  difficulty: MissionDifficulty;
  skill: MissionSkill;
  assignedAt: string; // ISO
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  skipped: boolean;
  expired: boolean;
  minutesToComplete: number | null;
  editedByParent: boolean;
  reflected: boolean; // did the child do the reflection step?
}

export interface DemoBadge {
  childId: string;
  skill: MissionSkill;
  earnedAt: string;
}

export interface DemoBankTx {
  childId: string;
  category: "earn" | "spend" | "give" | "save";
  amount: number;
  approved: boolean;
  createdAt: string;
}

export interface DemoFamily {
  children: DemoChild[];
  pets: DemoPet[];
  missions: DemoMission[];
  badges: DemoBadge[];
  bank: DemoBankTx[];
  generatedAt: string;
  daysOfHistory: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const DEMO_CHILDREN: DemoChild[] = [
  {
    id: "demo-maya",
    name: "Maya",
    age: 5,
    seed: 42,
    blurb:
      "Age 5. Long school days on Thursdays tank her completion rate. Started out only picking easy missions — confidence is growing week by week.",
    streakDays: 3,
    lastStreakDate: null, // set at generation time
  },
  {
    id: "demo-leo",
    name: "Leo",
    age: 8,
    seed: 1337,
    blurb:
      "Age 8. Hit a rough patch in weeks 5–8 — more skips, stopped attempting hard missions. Strong in kindness, still building perseverance. Recovering now.",
    streakDays: 2,
    lastStreakDate: null,
  },
  {
    id: "demo-ava",
    name: "Ava",
    age: 11,
    seed: 9001,
    blurb:
      "Age 11. Thriving — high completion, regularly attempts medium and hard missions, long streaks. The AI keeps her challenged without overwhelming her.",
    streakDays: 12,
    lastStreakDate: null,
  },
];

export const DEMO_PETS: DemoPet[] = [
  {
    name: "Biscuit",
    species: "dog",
    careNeeds: "Daily 20-min walk; brushing 3x/week; joint supplement with dinner",
  },
  {
    name: "Pickles",
    species: "guinea pig",
    careNeeds: "Cage spot-clean 2x/week; gentle handling only; vitamin C drops daily",
  },
];

const CATEGORIES: MissionCategory[] = ["pet_care", "chore", "kindness", "money", "community"];

const CATEGORY_SKILL: Record<MissionCategory, MissionSkill> = {
  pet_care: "responsibility",
  chore: "time",
  kindness: "empathy",
  money: "responsibility",
  community: "teamwork",
};

const EXPECTED_MINUTES: Record<MissionDifficulty, number> = { easy: 8, medium: 12, hard: 20 };

// ---------------------------------------------------------------------------
// Per-child behavior profiles — these CREATE the patterns the AI detects.
// ---------------------------------------------------------------------------

interface BehaviorProfile {
  /** Base probability a mission gets completed (vs skipped/expired). */
  baseCompletion: number;
  /** Modifier applied on Thursdays (weekday 4). */
  thursdayModifier: number;
  /** Difficulty pick distribution [easy, medium, hard]. Can vary by week. */
  difficultyPick: (weekIndex: number) => [number, number, number];
  /** Completion modifier by week (for dips / growth arcs). */
  weekModifier: (weekIndex: number) => number;
  /** Category affinity: completion modifier per category. */
  categoryAffinity: Partial<Record<MissionCategory, number>>;
  /** Probability of doing the reflection step after completing. */
  reflectionRate: number;
  /** Probability parent edits/scaffolds the mission. */
  scaffoldRate: number;
  /** Minutes noise factor. */
  speedFactor: number;
}

const PROFILES: Record<string, BehaviorProfile> = {
  "demo-maya": {
    baseCompletion: 0.72,
    thursdayModifier: 0.3, // Thursdays are rough — long school day
    difficultyPick: (w) =>
      w < 4 ? [0.85, 0.13, 0.02] : w < 8 ? [0.7, 0.25, 0.05] : [0.55, 0.35, 0.1], // confidence grows
    weekModifier: (w) => (w < 3 ? 0.85 : 1.0), // slow start, then steady
    categoryAffinity: { pet_care: 1.15, kindness: 1.1, money: 0.8 },
    reflectionRate: 0.55,
    scaffoldRate: 0.3, // young — parent helps often
    speedFactor: 1.2, // takes a bit longer
  },
  "demo-leo": {
    baseCompletion: 0.68,
    thursdayModifier: 0.9,
    difficultyPick: (w) =>
      w >= 4 && w < 8 ? [0.8, 0.18, 0.02] : [0.45, 0.4, 0.15], // avoids hard during dip
    weekModifier: (w) => (w >= 4 && w < 8 ? 0.55 : w >= 8 ? 0.85 : 1.0), // the dip
    categoryAffinity: { kindness: 1.35, community: 1.2, chore: 0.7, money: 0.75 }, // kind heart, weak chores
    reflectionRate: 0.4, // skips reflection when struggling
    scaffoldRate: 0.45, // heavy parent help during dip
    speedFactor: 1.0,
  } as BehaviorProfile,
  "demo-ava": {
    baseCompletion: 0.87,
    thursdayModifier: 0.95,
    difficultyPick: () => [0.2, 0.5, 0.3], // seeks challenge
    weekModifier: () => 1.0,
    categoryAffinity: { community: 1.15, money: 1.1 },
    reflectionRate: 0.8,
    scaffoldRate: 0.08, // independent
    speedFactor: 0.85, // quick
  },
};

function pickWeighted<T>(rand: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export function generateDemoFamily(nowMs: number = Date.now(), days = 90): DemoFamily {
  const missions: DemoMission[] = [];
  const badges: DemoBadge[] = [];
  const bank: DemoBankTx[] = [];
  let taskCounter = 0;

  for (const child of DEMO_CHILDREN) {
    const rand = seededRandom(child.seed);
    const profile = PROFILES[child.id];

    for (let d = days; d >= 1; d--) {
      const dayMs = nowMs - d * DAY_MS;
      const day = new Date(dayMs);
      const weekday = day.getUTCDay();
      const weekIndex = Math.floor((days - d) / 7);

      // 1–3 missions per day (fewer on weekends for Maya, consistent for Ava)
      const missionCount = 1 + Math.floor(rand() * (child.id === "demo-ava" ? 3 : 2));
      if (child.id === "demo-maya" && (weekday === 0 || weekday === 6) && rand() < 0.3) continue;

      for (let m = 0; m < missionCount; m++) {
        taskCounter++;
        const taskId = `demo-task-${taskCounter}`;
        const category = pickWeighted(
          rand,
          CATEGORIES,
          CATEGORIES.map((c) => profile.categoryAffinity[c] ?? 1.0),
        );
        const skill = CATEGORY_SKILL[category];
        const [pe, pm, ph] = profile.difficultyPick(weekIndex);
        const difficulty = pickWeighted<MissionDifficulty>(rand, ["easy", "medium", "hard"], [pe, pm, ph]);

        const assignHour = 8 + Math.floor(rand() * 8); // 8am–4pm
        const assignedAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), assignHour)).toISOString();

        // Completion probability with all modifiers
        let pComplete = profile.baseCompletion * profile.weekModifier(weekIndex);
        if (weekday === 4) pComplete *= profile.thursdayModifier; // Thursday effect
        pComplete *= profile.categoryAffinity[category] ?? 1.0;
        if (difficulty === "hard") pComplete *= 0.75;
        if (difficulty === "easy") pComplete *= 1.1;
        pComplete = Math.min(0.97, Math.max(0.05, pComplete));

        const roll = rand();
        const completed = roll < pComplete;
        const skipped = !completed && rand() < 0.6;
        const expired = !completed && !skipped;

        const mission: DemoMission = {
          taskId,
          childId: child.id,
          category,
          difficulty,
          skill,
          assignedAt,
          startedAt: null,
          completedAt: null,
          approvedAt: null,
          skipped,
          expired,
          minutesToComplete: null,
          editedByParent: rand() < profile.scaffoldRate,
          reflected: false,
        };

        if (completed) {
          const startOffsetMin = 30 + Math.floor(rand() * 240);
          mission.startedAt = new Date(Date.parse(assignedAt) + startOffsetMin * 60_000).toISOString();
          // Minutes with noise; rush-throughs happen more on easy missions
          const expected = EXPECTED_MINUTES[difficulty];
          const rush = difficulty === "easy" && rand() < 0.18;
          const slow = rand() < 0.12;
          const minutes = rush
            ? Math.max(2, Math.round(expected * (0.3 + rand() * 0.15)))
            : slow
              ? Math.round(expected * (2.5 + rand()))
              : Math.round(expected * profile.speedFactor * (0.8 + rand() * 0.5));
          mission.minutesToComplete = minutes;
          mission.completedAt = new Date(Date.parse(mission.startedAt) + minutes * 60_000).toISOString();
          // Parent approves ~90% of completions (integrity signal)
          if (rand() < 0.92) {
            mission.approvedAt = new Date(Date.parse(mission.completedAt) + 60 * 60_000).toISOString();
            mission.reflected = rand() < profile.reflectionRate;
            badges.push({ childId: child.id, skill, earnedAt: mission.approvedAt });
            bank.push({ childId: child.id, category: "earn", amount: 10, approved: true, createdAt: mission.approvedAt });
          }
        } else if (skipped || !completed) {
          // Skipped missions sometimes get started first (abandonment signal for flow)
          if (rand() < 0.35) {
            const startOffsetMin = 30 + Math.floor(rand() * 120);
            mission.startedAt = new Date(Date.parse(assignedAt) + startOffsetMin * 60_000).toISOString();
          }
        }

        missions.push(mission);
      }
    }

    // Bank: periodic spend / save / give
    const childBank = bank.filter((t) => t.childId === child.id && t.category === "earn");
    const totalEarned = childBank.reduce((a, t) => a + t.amount, 0);
    const r2 = seededRandom(child.seed + 999);
    let spent = 0;
    for (let i = 0; i < Math.floor(totalEarned / 50); i++) {
      const kind = r2() < 0.45 ? "save" : r2() < 0.7 ? "give" : "spend";
      const amount = 10 + Math.floor(r2() * 30);
      spent += amount;
      if (spent > totalEarned * 0.7) break;
      const txDay = Math.floor(r2() * days);
      bank.push({
        childId: child.id,
        category: kind,
        amount,
        approved: true,
        createdAt: new Date(nowMs - txDay * DAY_MS).toISOString(),
      });
    }
  }

  // Sort for determinism
  missions.sort((a, b) => a.assignedAt.localeCompare(b.assignedAt));
  badges.sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  bank.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const children = DEMO_CHILDREN.map((c) => ({
    ...c,
    lastStreakDate: new Date(nowMs - c.streakDays * DAY_MS).toISOString().slice(0, 10),
  }));

  return {
    children,
    pets: DEMO_PETS,
    missions,
    badges,
    bank,
    generatedAt: new Date(nowMs).toISOString(),
    daysOfHistory: days,
  };
}

// ---------------------------------------------------------------------------
// Adapters — convert demo missions into each algorithm's input format.
// ---------------------------------------------------------------------------

import type {
  SnapshotAwardInput,
  SnapshotCompletionInput,
} from "../ai/mission-engine";
import type { CopilotEventInput } from "../ai/copilot";
import type { FlourishBadgeInput, FlourishBankInput, FlourishEventInput } from "../ai/flourishing";
import type { FlowEventInput } from "../ai/flow-calibration";

export function toSnapshotCompletions(missions: DemoMission[]): SnapshotCompletionInput[] {
  return missions.map((m) => ({
    completedAt: m.completedAt ?? m.assignedAt,
    status: m.approvedAt ? "approved" : m.completedAt ? "pending" : "rejected",
    category: m.category,
    difficulty: m.difficulty,
    skill: m.skill,
  }));
}

export function toSnapshotAwards(badges: DemoBadge[]): SnapshotAwardInput[] {
  return badges.map((b) => ({ skill: b.skill, awardedAt: b.earnedAt }));
}

export function toCopilotEvents(missions: DemoMission[]): CopilotEventInput[] {
  const out: CopilotEventInput[] = [];
  for (const m of missions) {
    const weekday = new Date(m.assignedAt).getUTCDay();
    out.push({
      eventType: "assigned",
      taskId: m.taskId,
      category: m.category,
      difficulty: m.difficulty,
      skill: m.skill,
      weekday,
      createdAt: m.assignedAt,
      minutesToComplete: null,
    });
    if (m.startedAt) {
      out.push({
        eventType: "started",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.startedAt,
        minutesToComplete: null,
      });
    }
    if (m.completedAt) {
      out.push({
        eventType: "completed",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.completedAt,
        minutesToComplete: m.minutesToComplete,
      });
    }
    if (m.approvedAt) {
      out.push({
        eventType: "approved",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.approvedAt,
        minutesToComplete: m.minutesToComplete,
      });
    }
    if (m.skipped) {
      out.push({
        eventType: "skipped",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.assignedAt,
        minutesToComplete: null,
      });
    }
    if (m.expired) {
      out.push({
        eventType: "expired",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.assignedAt,
        minutesToComplete: null,
      });
    }
    if (m.editedByParent) {
      out.push({
        eventType: "edited_by_parent",
        taskId: m.taskId,
        category: m.category,
        difficulty: m.difficulty,
        skill: m.skill,
        weekday,
        createdAt: m.assignedAt,
        minutesToComplete: null,
      });
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function toFlourishEvents(missions: DemoMission[]): FlourishEventInput[] {
  return toCopilotEvents(missions).map((e) => ({
    eventType: e.eventType,
    taskId: e.taskId,
    category: e.category,
    difficulty: e.difficulty,
    skill: e.skill,
    createdAt: e.createdAt,
  }));
}

export function toFlourishBadges(badges: DemoBadge[]): FlourishBadgeInput[] {
  return badges.map((b) => ({ skill: b.skill, earnedAt: b.earnedAt }));
}

export function toFlourishBank(bank: DemoBankTx[]): FlourishBankInput[] {
  return bank.map((t) => ({ category: t.category, amount: t.amount, approved: t.approved }));
}

export function toFlowEvents(childId: string, missions: DemoMission[]): FlowEventInput[] {
  const out: FlowEventInput[] = [];
  for (const m of missions) {
    out.push({
      childId,
      eventType: "assigned",
      category: m.category,
      difficulty: m.difficulty,
      createdAt: m.assignedAt,
    });
    if (m.startedAt) {
      out.push({
        childId,
        eventType: "started",
        category: m.category,
        difficulty: m.difficulty,
        createdAt: m.startedAt,
      });
    }
    if (m.completedAt) {
      out.push({
        childId,
        eventType: "completed",
        category: m.category,
        difficulty: m.difficulty,
        minutesToComplete: m.minutesToComplete ?? undefined,
        createdAt: m.completedAt,
      });
      // Reflection step tracked via minutesToComplete presence is enough;
      // skipped reflection is inferred when completed without reflection flag.
      if (!m.reflected) {
        out.push({
          childId,
          eventType: "skipped_reflection",
          category: m.category,
          difficulty: m.difficulty,
          createdAt: m.completedAt,
        });
      }
    }
    if (m.startedAt && !m.completedAt) {
      out.push({
        childId,
        eventType: "abandoned",
        category: m.category,
        difficulty: m.difficulty,
        createdAt: m.startedAt,
      });
    }
    if (m.editedByParent) {
      out.push({
        childId,
        eventType: "edited_by_parent",
        category: m.category,
        difficulty: m.difficulty,
        createdAt: m.assignedAt,
      });
    }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
