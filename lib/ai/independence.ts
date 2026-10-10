/**
 * Independence Milestones — the celebrated journey of needing less help.
 *
 * Independence is NOT a scored trait. It is a journey of moments, detected
 * deterministically from mission event patterns and celebrated — never
 * measured. "The light gets dimmer as the kid shines brighter" (lantern
 * philosophy made visible).
 *
 * Milestones are achievements of autonomy: doing things without reminders,
 * without help, returning after time away. The parent sees "Maya needed
 * you less this month — that's the goal working." The child sees "You did
 * that all by yourself!"
 *
 * Zero LLM calls. Pure functions over coarse event data.
 */

export interface IndependenceEvent {
  completedAt: string; // ISO timestamp
  status: "pending" | "approved" | "rejected";
  difficulty: string;
  category: string;
  /** Optional: true when the parent actively helped. Absent = unknown. */
  parentHelped?: boolean;
}

export interface IndependenceMilestone {
  id: string;
  title: string;
  /** Strength-first, celebratory. Never comparative, never shaming. */
  description: string;
  emoji: string;
  /** ISO timestamp when achieved, or null if not yet. */
  achievedAt: string | null;
  /** 0..1 progress toward this milestone (1 = achieved). */
  progress: number;
  /** Kid-friendly progress label, e.g. "3 of 5". Empty when achieved. */
  progressLabel: string;
}

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function daysBetween(aMs: number, bMs: number): number {
  return Math.floor(Math.abs(aMs - bMs) / DAY_MS);
}

interface ApprovedEvent {
  atMs: number;
  difficulty: string;
  category: string;
  parentHelped?: boolean;
}

function approvedEvents(events: readonly IndependenceEvent[]): ApprovedEvent[] {
  return events
    .filter((e) => e.status === "approved")
    .map((e) => ({
      atMs: toMs(e.completedAt),
      difficulty: e.difficulty,
      category: e.category,
      parentHelped: e.parentHelped,
    }))
    .filter((e) => e.atMs > 0)
    .sort((a, b) => a.atMs - b.atMs);
}

/** Longest run of consecutive-day completions. */
function longestStreakDays(approved: ApprovedEvent[]): number {
  if (approved.length === 0) return 0;
  const days = new Set(approved.map((e) => Math.floor(e.atMs / DAY_MS)));
  const sorted = [...days].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

function mk(
  id: string,
  title: string,
  description: string,
  emoji: string,
  achievedAt: string | null,
  progress: number,
  progressLabel: string,
): IndependenceMilestone {
  return { id, title, description, emoji, achievedAt, progress, progressLabel };
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Detect independence milestones from mission events. Deterministic.
 * Milestones celebrate autonomy — they are never scores, never labels.
 */
export function detectIndependenceMilestones(
  events: readonly IndependenceEvent[],
  nowMs: number = Date.now(),
): IndependenceMilestone[] {
  const approved = approvedEvents(events);
  const out: IndependenceMilestone[] = [];

  // 1. First steps — the very first approved mission.
  if (approved.length >= 1) {
    out.push(
      mk(
        "first-steps",
        "First Steps",
        "The journey started — the first mission done!",
        "👣",
        isoOf(approved[0].atMs),
        1,
        "",
      ),
    );
  } else {
    out.push(mk("first-steps", "First Steps", "The first mission is waiting — what an adventure to begin!", "👣", null, 0, "0 of 1"));
  }

  // 2. Steady rhythm — 3-day streak.
  const streak = longestStreakDays(approved);
  out.push(
    streak >= 3
      ? mk("steady-rhythm", "Steady Rhythm", "Three days in a row — all you!", "🥁", null, 1, "")
      : mk("steady-rhythm", "Steady Rhythm", "Three days in a row builds a rhythm that's yours.", "🥁", null, Math.min(1, streak / 3), `${streak} of 3 days`),
  );
  // Note: achievedAt for streak milestones is intentionally null — streaks
  // are ongoing rhythms, not one-time events. The celebration is in the now.

  // 3. Week warrior — 7-day streak.
  out.push(
    streak >= 7
      ? mk("week-warrior", "Week Warrior", "A whole week of showing up — that's independence in action.", "🛡️", null, 1, "")
      : mk("week-warrior", "Week Warrior", "A full week of missions — can you imagine?", "🛡️", null, Math.min(1, streak / 7), `${streak} of 7 days`),
  );

  // 4. Brave solo — first hard mission approved.
  const firstHard = approved.find((e) => e.difficulty === "hard");
  out.push(
    firstHard
      ? mk("brave-solo", "Brave Solo", "Took on a hard one and saw it through!", "🦁", isoOf(firstHard.atMs), 1, "")
      : mk("brave-solo", "Brave Solo", "A hard mission is waiting for a brave try.", "🦁", null, 0, "0 of 1"),
  );

  // 5. Explorer — missions approved in 4+ distinct categories.
  const cats = new Set(approved.map((e) => e.category));
  out.push(
    cats.size >= 4
      ? mk("explorer", "Explorer", `Tried missions in ${cats.size} different areas — curiosity with legs!`, "🧭", null, 1, "")
      : mk("explorer", "Explorer", "Every new kind of mission is a new trail.", "🧭", null, Math.min(1, cats.size / 4), `${cats.size} of 4 areas`),
  );

  // 6. Comeback — returned after 3+ days away and completed a mission.
  let comebackAt: number | null = null;
  for (let i = 1; i < approved.length; i++) {
    if (daysBetween(approved[i].atMs, approved[i - 1].atMs) >= 3) {
      comebackAt = approved[i].atMs;
      break;
    }
  }
  out.push(
    comebackAt !== null
      ? mk("comeback", "Comeback Kid", "Came back after time away and jumped right in — that's resilience.", "💪", isoOf(comebackAt), 1, "")
      : mk("comeback", "Comeback Kid", "Breaks are okay. Coming back is what counts.", "💪", null, 0, ""),
  );

  // 7. Helper-free run — 5 approved in a row with parentHelped explicitly false.
  // Only measurable when the data exists; otherwise stays locked without pressure.
  const helperFlags = approved.map((e) => e.parentHelped);
  const hasHelperData = helperFlags.some((f) => f !== undefined);
  let helperFreeRun = 0;
  let bestHelperFreeRun = 0;
  for (const f of helperFlags) {
    if (f === false) {
      helperFreeRun += 1;
      bestHelperFreeRun = Math.max(bestHelperFreeRun, helperFreeRun);
    } else {
      helperFreeRun = 0;
    }
  }
  out.push(
    bestHelperFreeRun >= 5
      ? mk("helper-free", "All By Myself", "Five missions with no help needed — look how far you've come!", "🌟", null, 1, "")
      : hasHelperData
        ? mk("helper-free", "All By Myself", "Doing it solo, one mission at a time.", "🌟", null, Math.min(1, bestHelperFreeRun / 5), `${bestHelperFreeRun} of 5 solo`)
        : mk("helper-free", "All By Myself", "Someday you'll look back at how much you can do alone.", "🌟", null, 0, ""),
  );

  // 8. Marathon — 25 lifetime approved missions.
  out.push(
    approved.length >= 25
      ? mk("marathon", "Marathon", `${approved.length} missions and counting — what a journey!`, "🏅", null, 1, "")
      : mk("marathon", "Marathon", "Every mission is a step. Keep walking.", "🏅", null, Math.min(1, approved.length / 25), `${approved.length} of 25`),
  );

  return out;
}

/**
 * Parent-facing summary of independence growth. Strength-first, calm.
 * Never a score — a story about needing less help over time.
 */
export function independenceSummaryForParent(
  milestones: readonly IndependenceMilestone[],
  childName: string,
): string {
  const achieved = milestones.filter((m) => m.progress >= 1);
  if (achieved.length === 0) {
    return `${childName} is just getting started — every independence journey begins with a single step.`;
  }
  const latest = achieved[achieved.length - 1];
  return (
    `${childName} has unlocked ${achieved.length} independence ${achieved.length === 1 ? "milestone" : "milestones"} — ` +
    `most recently "${latest.title}." ${childName} is doing more on ${childName === "you" ? "your" : "their"} own, ` +
    `and that's exactly the goal working.`
  );
}

/**
 * Convert newly-achieved milestones into Weekly-Insight-compatible copy.
 * Returns null when nothing new to celebrate (the insight ranker decides).
 */
export function milestoneInsightCopy(
  milestone: IndependenceMilestone,
  childName: string,
): { strength: string; observation: string; suggestion: string } | null {
  if (milestone.progress < 1) return null;
  return {
    strength: `${childName} just unlocked "${milestone.title}" ${milestone.emoji}`,
    observation: `${milestone.description} Independence isn't about needing nobody — it's about knowing you can.`,
    suggestion: `Celebrate it together, then step back a little further next time. That's the lantern dimming as ${childName} shines brighter.`,
  };
}
