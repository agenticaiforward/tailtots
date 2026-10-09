/**
 * Flow Calibration — Phase 4a (AI-native).
 *
 * Keeps each child in the "just right" zone per mission category: not bored
 * (too easy), not shut down (too hard). This operationalizes the flow concept
 * as a deterministic adaptive controller — never a clinical claim, never a
 * label on the child. All scores are internal-only relative signals.
 *
 * Design (from the AI-native research):
 * - Elo-style Kid Readiness Ratings per child x category. Small K-factor so
 *   ratings move gently — kids are not chess players.
 * - Asymmetric rules: back off after 2 hard signals, step up after 3 easy
 *   signals. Frustration kills engagement faster than boredom does.
 * - "Brave Try": attempting a stretch mission is data, not failure. Awarded,
 *   celebrated, never penalized.
 * - Scaffold fading: 3 consecutive wins at a band -> less help, celebrated.
 * - Parent nudges in the conscious-parenting voice: parent-empowering,
 *   companionship over authority, joy celebrated, zero shame.
 *
 * Guardrails: parent-side only. No clinical terms. No child PII leaves this
 * module — nudges use a {name} placeholder filled by the UI, never sent to
 * any model. Deterministic: same events in -> same calibration out.
 */

import {
  MISSION_CATEGORIES,
  MISSION_DIFFICULTIES,
  type MissionCategory,
  type MissionDifficulty,
} from "./mission-engine";
import type { IdeaAgeBand } from "./ideas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Starting Elo rating for every child x category. */
export const ELO_START_RATING = 1200;
/** K-factor tuned for kids: ratings move in small, gentle steps. */
export const ELO_K_FACTOR = 16;
export const ELO_MIN_RATING = 800;
export const ELO_MAX_RATING = 1600;

/** Mission difficulty expressed as an Elo-style rating. */
export const DIFFICULTY_RATINGS: Record<MissionDifficulty, number> = {
  easy: 1000,
  medium: 1200,
  hard: 1400,
};

/** Expected minutes per difficulty band (used for rush/long-duration signals). */
export const EXPECTED_MINUTES: Record<MissionDifficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 15,
};

/** Hard signals needed to step a band DOWN (asymmetric: fast back-off). */
export const HARD_SIGNALS_TO_STEP_DOWN = 2;
/** Easy signals needed to step a band UP (asymmetric: slow step-up). */
export const EASY_SIGNALS_TO_STEP_UP = 3;
/** Consecutive wins at a band before scaffolding fades. */
export const WINS_TO_FADE_SCAFFOLD = 3;
/** Minimum events in a category window before signals count. */
export const MIN_EVENTS_FOR_SIGNALS = 4;

const DAY_MS = 86_400_000;
const SIGNAL_WINDOW_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal event shape the flow engine needs. Mirrors mission_events rows. */
export interface FlowEventInput {
  childId: string;
  eventType: string;
  category?: string;
  difficulty?: string;
  minutesToComplete?: number;
  createdAt: string; // ISO timestamp
}

export interface EloRatingState {
  childId: string;
  category: MissionCategory;
  rating: number;
  gamesPlayed: number;
}

export type FlowOutcome = "completed" | "abandoned" | "attempted";

export interface EasySignalCounts {
  rushThrough: number;
  skippedReflection: number;
  cherryPick: number;
  total: number;
}

export interface HardSignalCounts {
  abandonment: number;
  longDuration: number;
  heavyScaffold: number;
  total: number;
}

export interface FlowSignals {
  category: MissionCategory;
  sampleSize: number;
  easy: EasySignalCounts;
  hard: HardSignalCounts;
}

export interface BraveTryAward {
  childId: string;
  category: MissionCategory;
  attemptedDifficulty: MissionDifficulty;
  ratingAtAttempt: number;
  awardedAt: string; // ISO timestamp
}

export type ScaffoldLevel = "full" | "light" | "independent";

export interface ScaffoldFadeEvent {
  childId: string;
  category: MissionCategory;
  fromLevel: ScaffoldLevel;
  toLevel: ScaffoldLevel;
  consecutiveWins: number;
}

export interface BandCalibration {
  category: MissionCategory;
  band: MissionDifficulty;
  previousBand: MissionDifficulty | null;
  moved: boolean;
  moveDirection: "up" | "down" | "none";
  eloRating: number;
  reason: string; // behavioral description only, never a label
}

export type NudgeKind =
  | "step_up"
  | "step_down"
  | "brave_try"
  | "scaffold_fade"
  | "steady";

const CATEGORY_LABELS: Record<MissionCategory, string> = {
  pet_care: "pet-care",
  chore: "chore",
  kindness: "kindness",
  money: "money",
  community: "community",
};

// ---------------------------------------------------------------------------
// Elo rating math
// ---------------------------------------------------------------------------

/** Expected score for a child rating vs a mission rating (standard Elo). */
export function expectedScore(childRating: number, missionRating: number): number {
  return 1 / (1 + Math.pow(10, (missionRating - childRating) / 400));
}

/**
 * Update a child's Elo rating after a mission outcome.
 * - completed (approved): full win
 * - abandoned (started, never finished): soft loss (half K — kids get grace)
 * - attempted (stretch try, Brave Try): no rating change — data, not failure
 */
export function updateEloRating(
  current: number,
  missionDifficulty: MissionDifficulty,
  outcome: FlowOutcome,
  kFactor: number = ELO_K_FACTOR,
): number {
  const missionRating = DIFFICULTY_RATINGS[missionDifficulty];
  const expected = expectedScore(current, missionRating);
  let next: number;
  if (outcome === "completed") {
    next = current + kFactor * (1 - expected);
  } else if (outcome === "abandoned") {
    next = current - kFactor * 0.5 * expected;
  } else {
    next = current; // attempted: no penalty, ever
  }
  return Math.round(Math.min(ELO_MAX_RATING, Math.max(ELO_MIN_RATING, next)));
}

/** Build the initial rating state for a child x category. */
export function initialEloState(childId: string, category: MissionCategory): EloRatingState {
  return { childId, category, rating: ELO_START_RATING, gamesPlayed: 0 };
}

/** Map an Elo rating to a difficulty band, clamped by the age-band ceiling. */
export function bandForRating(rating: number, ageBand: IdeaAgeBand): MissionDifficulty {
  const ceiling: MissionDifficulty = ageBand === "10-12" ? "hard" : ageBand === "7-9" ? "medium" : "easy";
  const ceilingIdx = MISSION_DIFFICULTIES.indexOf(ceiling);
  let band: MissionDifficulty = rating >= 1300 ? "hard" : rating >= 1100 ? "medium" : "easy";
  if (MISSION_DIFFICULTIES.indexOf(band) > ceilingIdx) band = ceiling;
  return band;
}

// ---------------------------------------------------------------------------
// Signal detection (30-day window, per child x category)
// ---------------------------------------------------------------------------

function isMissionDifficulty(d: unknown): d is MissionDifficulty {
  return d === "easy" || d === "medium" || d === "hard";
}

function inWindow(createdAt: string, now: number): boolean {
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && now - t <= SIGNAL_WINDOW_DAYS * DAY_MS && t <= now;
}

/**
 * Detect too-easy / too-hard signals from mission events.
 * All signals are behavioral (durations, choices, outcomes) — never labels.
 */
export function detectFlowSignals(
  childId: string,
  events: FlowEventInput[],
  now: number = Date.now(),
): FlowSignals[] {
  const out: FlowSignals[] = [];
  for (const category of MISSION_CATEGORIES) {
    const rows = events.filter(
      (e) => e.childId === childId && e.category === category && inWindow(e.createdAt, now),
    );
    const easy: EasySignalCounts = { rushThrough: 0, skippedReflection: 0, cherryPick: 0, total: 0 };
    const hard: HardSignalCounts = { abandonment: 0, longDuration: 0, heavyScaffold: 0, total: 0 };
    if (rows.length < MIN_EVENTS_FOR_SIGNALS) {
      out.push({ category, sampleSize: rows.length, easy, hard });
      continue;
    }

    const completed = rows.filter((e) => e.eventType === "completed" || e.eventType === "approved");
    const checkins = rows.filter((e) => e.eventType === "checkin").length;

    for (const e of completed) {
      const diff = isMissionDifficulty(e.difficulty) ? e.difficulty : "medium";
      const expected = EXPECTED_MINUTES[diff];
      if (typeof e.minutesToComplete === "number" && e.minutesToComplete > 0) {
        if (e.minutesToComplete < expected * 0.5) easy.rushThrough += 1;
        if (e.minutesToComplete > expected * 3) hard.longDuration += 1;
      }
    }
    // Skipped reflection: completions with no check-in tap anywhere in window.
    if (completed.length >= 3 && checkins === 0) {
      easy.skippedReflection = completed.length;
    }
    // Cherry-picking: only easy missions attempted while harder ones were assigned.
    const assignedDiffs = new Set(
      rows.filter((e) => e.eventType === "assigned" && isMissionDifficulty(e.difficulty)).map((e) => e.difficulty),
    );
    const attemptedDiffs = new Set(
      rows.filter((e) => (e.eventType === "started" || e.eventType === "completed") && isMissionDifficulty(e.difficulty)).map((e) => e.difficulty),
    );
    if ((assignedDiffs.has("medium") || assignedDiffs.has("hard")) && attemptedDiffs.size === 1 && attemptedDiffs.has("easy")) {
      easy.cherryPick = attemptedDiffs.size; // 1: the pattern itself is the signal
    }
    // Abandonment: started but later expired or skipped, never completed.
    const startedIds = new Set(rows.filter((e) => e.eventType === "started").map((e) => taskKey(e)));
    const finishedIds = new Set(
      rows.filter((e) => e.eventType === "completed" || e.eventType === "approved").map((e) => taskKey(e)),
    );
    const droppedIds = new Set(
      rows.filter((e) => e.eventType === "expired" || e.eventType === "skipped").map((e) => taskKey(e)),
    );
    for (const id of startedIds) {
      if (!finishedIds.has(id) && (droppedIds.has(id) || true)) hard.abandonment += 1;
    }
    // Heavy scaffold: parent edited the mission before it was completed.
    const editedIds = new Set(rows.filter((e) => e.eventType === "edited_by_parent").map((e) => taskKey(e)));
    for (const id of editedIds) {
      if (finishedIds.has(id)) hard.heavyScaffold += 1;
    }

    easy.total = easy.rushThrough + easy.skippedReflection + easy.cherryPick;
    hard.total = hard.abandonment + hard.longDuration + hard.heavyScaffold;
    out.push({ category, sampleSize: rows.length, easy, hard });
  }
  return out;
}

function taskKey(e: FlowEventInput): string {
  return `${e.childId}|${e.category ?? "?"}|${e.createdAt}`;
}

// ---------------------------------------------------------------------------
// Asymmetric band calibration
// ---------------------------------------------------------------------------

/**
 * Calibrate one category's band from signals + Elo rating.
 * - 2+ hard signals -> step DOWN one band (fast back-off)
 * - 3+ easy signals -> step UP one band (slow step-up)
 * - Otherwise the Elo-implied band wins, moved at most one step per run.
 * Never above the age-band ceiling, never below easy.
 */
export function calibrateFlowBand(
  signals: FlowSignals,
  currentBand: MissionDifficulty,
  eloRating: number,
  ageBand: IdeaAgeBand,
): BandCalibration {
  const idx = MISSION_DIFFICULTIES.indexOf(currentBand);
  const ceiling: MissionDifficulty = ageBand === "10-12" ? "hard" : ageBand === "7-9" ? "medium" : "easy";
  const ceilingIdx = MISSION_DIFFICULTIES.indexOf(ceiling);
  const eloBand = bandForRating(eloRating, ageBand);

  let target = currentBand;
  let reason = "Holding steady — missions are landing in the just-right zone.";
  let moveDirection: BandCalibration["moveDirection"] = "none";

  if (signals.sampleSize >= MIN_EVENTS_FOR_SIGNALS && signals.hard.total >= HARD_SIGNALS_TO_STEP_DOWN) {
    target = MISSION_DIFFICULTIES[Math.max(0, idx - 1)];
    moveDirection = target === currentBand ? "none" : "down";
    reason =
      `Easing off: ${signals.hard.total} signs missions felt too hard lately ` +
      `(unfinished tries, long slogs, or lots of parent help). Every try should end in a win.`;
  } else if (signals.sampleSize >= MIN_EVENTS_FOR_SIGNALS && signals.easy.total >= EASY_SIGNALS_TO_STEP_UP) {
    target = MISSION_DIFFICULTIES[Math.min(ceilingIdx, idx + 1)];
    moveDirection = target === currentBand ? "none" : "up";
    reason =
      `Ready for more: ${signals.easy.total} signs missions felt too easy lately ` +
      `(quick finishes, skipped reflections). Time for a bigger stretch.`;
  } else if (eloBand !== currentBand) {
    // Elo drift: move one step toward the Elo-implied band.
    const eloIdx = MISSION_DIFFICULTIES.indexOf(eloBand);
    const step = Math.sign(eloIdx - idx);
    target = MISSION_DIFFICULTIES[Math.min(ceilingIdx, Math.max(0, idx + step))];
    moveDirection = target === currentBand ? "none" : step > 0 ? "up" : "down";
    if (moveDirection !== "none") {
      reason =
        moveDirection === "up"
          ? "Steady wins are adding up — opening the next level of challenge."
          : "Recent tries suggest a gentler level for now — confidence first.";
    }
  }

  return {
    category: signals.category,
    band: target,
    previousBand: currentBand,
    moved: moveDirection !== "none",
    moveDirection,
    eloRating,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Brave Try badge
// ---------------------------------------------------------------------------

/**
 * A stretch mission is one rated 100+ points above the child's current rating.
 * Attempting (starting) one that isn't completed earns a Brave Try: awarded,
 * celebrated, never penalized. Returns null when it isn't a stretch attempt.
 */
export function detectBraveTry(
  childId: string,
  category: MissionCategory,
  attemptedDifficulty: MissionDifficulty,
  childRating: number,
  completed: boolean,
  now: number = Date.now(),
): BraveTryAward | null {
  if (completed) return null;
  const stretch = DIFFICULTY_RATINGS[attemptedDifficulty] - childRating >= 100;
  if (!stretch) return null;
  return {
    childId,
    category,
    attemptedDifficulty,
    ratingAtAttempt: childRating,
    awardedAt: new Date(now).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Scaffold fading
// ---------------------------------------------------------------------------

/**
 * Track consecutive approved completions at the current band. After
 * WINS_TO_FADE_SCAFFOLD straight wins, scaffolding fades one level and the
 * fade is celebrated — independence growing, noticed out loud.
 */
export function trackScaffoldFade(
  childId: string,
  category: MissionCategory,
  recentOutcomes: Array<"win" | "other">, // most-recent-first, already filtered to this band
  currentLevel: ScaffoldLevel,
): ScaffoldFadeEvent | null {
  let wins = 0;
  for (const o of recentOutcomes) {
    if (o === "win") wins += 1;
    else break;
  }
  if (wins < WINS_TO_FADE_SCAFFOLD || currentLevel === "independent") return null;
  const toLevel: ScaffoldLevel = currentLevel === "full" ? "light" : "independent";
  return { childId, category, fromLevel: currentLevel, toLevel, consecutiveWins: wins };
}

// ---------------------------------------------------------------------------
// Parent nudge copy (deterministic, conscious-parenting voice)
// ---------------------------------------------------------------------------

/**
 * Warm parent-facing copy for difficulty events. Uses a {name} placeholder —
 * the UI fills the child's name; nothing here is ever sent to a model.
 * Voice: parent-empowering, companionship, celebrate joy and brave tries,
 * never shame, never clinical, forward-looking.
 */
export function buildDifficultyNudge(
  kind: NudgeKind,
  category: MissionCategory,
  extra?: { fromBand?: MissionDifficulty; toBand?: MissionDifficulty },
): string {
  const label = CATEGORY_LABELS[category];
  switch (kind) {
    case "step_up":
      return (
        `{name} is ready for bigger challenges — we've opened up ${extra?.toBand ?? "harder"} ${label} missions. ` +
        `Celebrate the stretch together; the trying is the win.`
      );
    case "step_down":
      return (
        `We're easing ${label} missions for now so every try ends in a win. ` +
        `Joy first, challenge follows — {name} will climb back when ready, together with you.`
      );
    case "brave_try":
      return (
        `{name} took a brave try at a stretch ${label} mission. That's the muscle that matters. ` +
        `We celebrated the attempt — no penalty, just pride.`
      );
    case "scaffold_fade":
      return (
        `{name} is doing ${label} missions with less help now — real independence growing. ` +
        `Notice it out loud together; being seen is the reward.`
      );
    case "steady":
      return (
        `{name}'s ${label} missions are landing in the just-right zone — not too easy, not too hard. ` +
        `That's where growth lives. Keep going together.`
      );
  }
}

// ---------------------------------------------------------------------------
// Full calibration pass: signals -> Elo -> bands (pure, testable)
// ---------------------------------------------------------------------------

export interface FlowCalibrationInput {
  childId: string;
  ageBand: IdeaAgeBand;
  events: FlowEventInput[];
  /** Current stored bands per category (from difficulty_calibration). */
  currentBands: Partial<Record<MissionCategory, MissionDifficulty>>;
  /** Current Elo states per category. */
  eloStates: Partial<Record<MissionCategory, EloRatingState>>;
  now?: number;
}

export interface FlowCalibrationResult {
  bands: Partial<Record<MissionCategory, MissionDifficulty>>;
  calibrations: BandCalibration[];
  eloStates: Record<MissionCategory, EloRatingState>;
  nudges: Array<{ category: MissionCategory; kind: NudgeKind; copy: string }>;
}

/**
 * Run one full calibration pass. Pure function: same inputs -> same outputs.
 * Intended for the weekly cron and the on-demand Worker route.
 */
export function runFlowCalibration(input: FlowCalibrationInput): FlowCalibrationResult {
  const now = input.now ?? Date.now();
  const defaultBand: MissionDifficulty = input.ageBand === "10-12" ? "medium" : "easy";

  const signals = detectFlowSignals(input.childId, input.events, now);
  const bands: Partial<Record<MissionCategory, MissionDifficulty>> = {};
  const calibrations: BandCalibration[] = [];
  const eloStates = {} as Record<MissionCategory, EloRatingState>;
  const nudges: FlowCalibrationResult["nudges"] = [];

  for (const sig of signals) {
    const currentBand = input.currentBands[sig.category] ?? defaultBand;
    const elo = input.eloStates[sig.category] ?? initialEloState(input.childId, sig.category);
    const cal = calibrateFlowBand(sig, currentBand, elo.rating, input.ageBand);
    bands[sig.category] = cal.band;
    calibrations.push(cal);
    eloStates[sig.category] = elo;

    if (cal.moved) {
      const kind: NudgeKind = cal.moveDirection === "up" ? "step_up" : "step_down";
      nudges.push({
        category: sig.category,
        kind,
        copy: buildDifficultyNudge(kind, sig.category, { fromBand: cal.previousBand ?? undefined, toBand: cal.band }),
      });
    }
  }

  return { bands, calibrations, eloStates, nudges };
}

// ---------------------------------------------------------------------------
// Client helper (follows the fetchMissionSet pattern)
// ---------------------------------------------------------------------------

export interface FlowCalibrationResponse {
  bands: Partial<Record<MissionCategory, MissionDifficulty>>;
  calibrations: Array<{
    category: string;
    band: string;
    previousBand: string | null;
    moved: boolean;
    moveDirection: string;
    reason: string;
  }>;
  nudges: Array<{ category: string; kind: string; copy: string }>;
}

export async function fetchFlowCalibration(options: {
  fetchFn?: typeof fetch;
  token: string | null;
  childId: string;
  endpoint?: string;
}): Promise<{ ok: true; data: FlowCalibrationResponse } | { ok: false; error: string }> {
  const { fetchFn = fetch, token, childId, endpoint = "/api/ai/flow-calibration" } = options;
  if (!token) return { ok: false, error: "no token" };
  if (!childId) return { ok: false, error: "no childId" };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ childId }),
    });
    let data: FlowCalibrationResponse | null = null;
    try {
      data = (await response.json()) as FlowCalibrationResponse;
    } catch {
      data = null;
    }
    if (!response.ok || !data || typeof data.bands !== "object") {
      return { ok: false, error: "request failed" };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network error" };
  }
}
