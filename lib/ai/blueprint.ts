/**
 * Child Resilience Blueprint — Phase 5 of the AI-native transformation.
 *
 * The Blueprint is the product's crown jewel: a personalized parenting guide
 * assembled DETERMINISTICALLY from the child's behavioral patterns, then
 * narrated warmly by a small LLM call (best-effort). The model never analyzes
 * raw data and never sees child PII — it only receives precomputed,
 * behavioral facts plus an age band.
 *
 * Three parts (mirroring the resilience research, in product language):
 *   1. "What we're noticing" — behavioral observations, never conclusions.
 *      Engine-state metaphor: cruising / running hot / stalled. NEVER
 *      clinical terms (no hyper-arousal, no dysregulation, no diagnosis).
 *   2. "The body-first toolkit" — somatic missions from the somatic library
 *      plus parent co-do routines. Body before words, together not supervised.
 *   3. "Growing what shines" — strengths from the PERMA pillars plus
 *      flow-calibrated stretch activities. Celebrate the brightest first.
 *
 * Conscious-parenting voice (shared PARENT_VOICE_GUIDELINES): every line
 * speaks to what the PARENT can try, side by side with their child.
 * Empowering and forward-looking — never shaming, never pathologizing.
 *
 * Guardrails:
 *  - Parent-side only. Model inputs: behavioral facts + age band. No names,
 *    notes, photos, or voice transcripts.
 *  - Every narration is clinical-scanned; on any hit or LLM failure we use
 *    the deterministic fallback narrative.
 *  - Blueprints are snapshots, not profiles: they expire and recompute.
 *    No persistent psychological records.
 */

import { PARENT_VOICE_GUIDELINES } from "./mission-engine";
import {
  scanNarrationForClinicalTerms,
} from "./copilot";
import {
  FLOURISH_PILLARS,
  FLOURISH_PILLAR_LABELS,
  type FlourishPillar,
  type FlourishScores,
} from "./flourishing";
import {
  SOMATIC_MISSIONS,
  pickSomaticMission,
  type SomaticMission,
  type SomaticType,
} from "./somatic-missions";
import { ageBandForAge, type IdeaAgeBand } from "./ideas";

export const BLUEPRINT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

/**
 * Kid-friendly engine-state metaphor. Internal classification only —
 * the UI shows "what we're noticing" language, never these labels
 * as a diagnosis. Ambiguous signals fail open to "cruising".
 */
export const ENGINE_STATES = ["cruising", "running_hot", "stalled"] as const;
export type EngineState = (typeof ENGINE_STATES)[number];

export const ENGINE_STATE_LABELS: Record<EngineState, string> = {
  cruising: "Cruising",
  running_hot: "Running hot",
  stalled: "Stalled",
};

/** Behavioral inputs for engine-state classification. Facts only. */
export interface EngineStateInput {
  /** Completion rate over the last 14 days (0..1), null when unknown. */
  completionRate14d: number | null;
  /** Average minutes per completed mission recently, null when unknown. */
  avgMinutesPerMission: number | null;
  /** Share of assigned missions skipped or rejected (0..1), null when unknown. */
  skipRate14d: number | null;
  /** Completions in the last 3 days. */
  recentCompletions: number;
  /** Hard-difficulty missions attempted in the last 14 days. */
  hardAttempts14d: number;
  /** Hard-difficulty missions completed in the last 14 days. */
  hardCompletions14d: number;
}

/**
 * Classify the child's recent engagement pattern into a kid-friendly
 * engine-state metaphor. Deterministic, behavioral, fail-open.
 *
 * - running_hot: lots of starts but few finishes, or hard missions
 *   repeatedly attempted without completing → the engine is revving
 *   without traction. Response: slow down, body-first, easier wins.
 * - stalled: very few completions and high skip rate → the engine
 *   needs a gentle push. Response: tiny joyful restarts, together.
 * - cruising: steady pattern → keep the rhythm, stretch gently.
 */
export function classifyEngineState(input: EngineStateInput): EngineState {
  const rate = input.completionRate14d;
  const skip = input.skipRate14d;

  // running_hot: trying hard but not landing — many attempts, low completion.
  if (rate !== null && rate < 0.45 && input.hardAttempts14d >= 3) {
    const hardSuccess =
      input.hardAttempts14d > 0
        ? input.hardCompletions14d / input.hardAttempts14d
        : 1;
    if (hardSuccess < 0.4) return "running_hot";
  }
  // running_hot: rushing through (very fast completions suggest skimming, not engaging).
  if (
    input.avgMinutesPerMission !== null &&
    input.avgMinutesPerMission < 2 &&
    input.recentCompletions >= 4
  ) {
    return "running_hot";
  }
  // stalled: quiet pattern — few completions, high skips.
  if (rate !== null && rate < 0.3 && input.recentCompletions <= 1) return "stalled";
  if (skip !== null && skip > 0.6 && input.recentCompletions <= 2) return "stalled";

  return "cruising";
}

/** One behavioral observation — a fact, phrased for a parent. */
export interface BlueprintObservation {
  /** Stable key for tests and UI. */
  key: string;
  /** One warm sentence, behavioral only. */
  text: string;
  /** Which signal produced it (for audit, never shown). */
  signal: string;
}

/** One body-first toolkit item: a somatic mission or a co-do routine. */
export interface BlueprintBodyItem {
  /** Stable key. */
  key: string;
  /** Kid-friendly title. */
  title: string;
  /** Parent-facing "do it together" instructions. */
  detail: string;
  /** Minutes, for planning. */
  minutes: number;
  /** "somatic" (from the library) or "routine" (daily rhythm). */
  kind: "somatic" | "routine";
}

/** One strengths-and-stretch item from the flourishing side. */
export interface BlueprintGrowthItem {
  /** Stable key. */
  key: string;
  /** Kid-friendly title. */
  title: string;
  /** Parent-facing detail. */
  detail: string;
  /** Which PERMA pillar it grows. */
  pillar: FlourishPillar;
}

/** The full deterministic blueprint — structured data, no LLM yet. */
export interface ResilienceBlueprint {
  childId: string;
  engineState: EngineState;
  ageBand: IdeaAgeBand;
  observations: BlueprintObservation[];
  bodyToolkit: BlueprintBodyItem[];
  growthPlan: BlueprintGrowthItem[];
  /** Brightest pillar — celebrated first (Sadhguru voice). */
  brightestPillar: FlourishPillar;
  /** Weakest pillar — framed as "blooming", never a problem. */
  growingPillar: FlourishPillar;
  computedAt: string; // ISO
  /** "ai" when narration used the model, "deterministic" for fallback. */
  mode: "ai" | "deterministic";
  /** Warm parent-facing narrative (LLM or fallback). */
  narrative: string | null;
}

/** Inputs the assembler needs. All behavioral, no PII. */
export interface BlueprintAssemblyInput {
  childId: string;
  age: number | null;
  engine: EngineStateInput;
  /** Trait scores 0..1 from the Mission Engine (relative signals). */
  traitScores: Partial<Record<string, number>>;
  /** Weakest traits, strongest first-wins order from the engine. */
  weakestTraits: string[];
  /** PERMA pillar scores 0..100 (internal). */
  flourishScores: FlourishScores;
  /** Has at least one pet in the family. */
  hasPet: boolean;
  /** Parent's chosen focus skill, if any. */
  parentFocusSkill?: string | null;
}

const TRAIT_TO_PILLAR: Record<string, FlourishPillar> = {
  confidence: "mastery",
  empathy: "together",
  "self-control": "stick",
  integrity: "giving",
  curiosity: "joy",
  perseverance: "stick",
  optimism: "joy",
};

function brightestAndGrowing(
  scores: FlourishScores,
): { brightest: FlourishPillar; growing: FlourishPillar } {
  let brightest: FlourishPillar = "joy";
  let growing: FlourishPillar = "joy";
  let hi = -1;
  let lo = 101;
  for (const p of FLOURISH_PILLARS) {
    const s = scores[p] ?? 50;
    if (s > hi) {
      hi = s;
      brightest = p;
    }
    if (s < lo) {
      lo = s;
      growing = p;
    }
  }
  return { brightest, growing };
}

/** Build the "what we're noticing" observations from behavioral facts. */
export function buildObservations(input: BlueprintAssemblyInput): BlueprintObservation[] {
  const obs: BlueprintObservation[] = [];
  const e = input.engine;

  if (e.completionRate14d !== null) {
    const pct = Math.round(e.completionRate14d * 100);
    obs.push({
      key: "completion-rhythm",
      text:
        e.completionRate14d >= 0.6
          ? `A steady rhythm lately — about ${pct}% of missions getting done. That's a groove worth keeping.`
          : e.completionRate14d >= 0.35
            ? `A mixed rhythm lately — about ${pct}% of missions getting done. Some weeks just move slower, and that's normal.`
            : `A quiet stretch lately — about ${pct}% of missions getting done. Quiet stretches are invitations, not verdicts.`,
      signal: "completionRate14d",
    });
  }

  if (e.hardAttempts14d >= 3) {
    const success =
      e.hardAttempts14d > 0
        ? Math.round((e.hardCompletions14d / e.hardAttempts14d) * 100)
        : 0;
    obs.push({
      key: "stretch-appetite",
      text:
        success >= 50
          ? `A real appetite for stretch missions — ${e.hardAttempts14d} brave tries lately, landing about ${success}% of them.`
          : `Reaching for the hard stuff — ${e.hardAttempts14d} brave tries lately. The reaching matters more than the landing.`,
      signal: "hardAttempts14d",
    });
  }

  if (e.skipRate14d !== null && e.skipRate14d > 0.4) {
    obs.push({
      key: "skip-pattern",
      text:
        "Quite a few missions getting skipped. Skips are information — usually the mission's size or timing, not the child's heart.",
      signal: "skipRate14d",
    });
  }

  if (e.recentCompletions >= 4) {
    obs.push({
      key: "recent-wins",
      text: `${e.recentCompletions} missions done in the last few days. Momentum is a wonderful thing to protect.`,
      signal: "recentCompletions",
    });
  }

  if (obs.length === 0) {
    obs.push({
      key: "fresh-start",
      text:
        "Not much pattern data yet — every blueprint starts as a blank page. The next few weeks will paint the picture together.",
      signal: "cold_start",
    });
  }

  return obs;
}

/**
 * Build the body-first toolkit: somatic missions matched to the engine
 * state, plus one daily co-do routine. All "do it together" framing.
 */
export function buildBodyToolkit(input: BlueprintAssemblyInput): BlueprintBodyItem[] {
  const items: BlueprintBodyItem[] = [];
  const ageBand = ageBandForAge(input.age ?? 8);

  // Pick somatic missions by engine state:
  // - running_hot → discharge first (wiggle it out), then rhythmic.
  // - stalled → rhythmic first (gentle re-entry), then heavy work.
  // - cruising → rhythmic maintenance + one discharge for fun.
  const typeOrder: SomaticType[] =
    input.engine
      ? classifyEngineState(input.engine) === "running_hot"
        ? ["discharge", "rhythmic", "heavy_work"]
        : classifyEngineState(input.engine) === "stalled"
          ? ["rhythmic", "heavy_work", "discharge"]
          : ["rhythmic", "discharge", "heavy_work"]
      : ["rhythmic", "discharge", "heavy_work"];

  const seen = new Set<string>();
  for (const t of typeOrder) {
    if (items.length >= 3) break;
    try {
      const m: SomaticMission = pickSomaticMission({
        preferType: t,
        ageBand,
        hasPets: input.hasPet,
        seed: items.length,
      });
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      items.push({
        key: `somatic-${m.id}`,
        title: m.title,
        detail: m.detail,
        minutes: m.minutes,
        kind: "somatic",
      });
    } catch {
      // Library gaps fail silently — routines below still carry the section.
    }
  }

  // Fallback: if the library yielded nothing, use catalog entries directly.
  if (items.length === 0) {
    const fallback = SOMATIC_MISSIONS.filter(
      (m) => m.ageBands.includes(ageBand) && (!m.requiresPet || input.hasPet),
    ).slice(0, 3);
    for (const m of fallback) {
      items.push({
        key: `somatic-${m.id}`,
        title: m.title,
        detail: m.detail,
        minutes: m.minutes,
        kind: "somatic",
      });
    }
  }

  // One daily co-do routine — the relational anchor.
  const state = classifyEngineState(input.engine);
  items.push({
    key: "routine-daily-anchor",
    title:
      state === "running_hot"
        ? "The Slow-Down Ritual"
        : state === "stalled"
          ? "The Tiny Restart"
          : "The Daily Anchor",
    detail:
      state === "running_hot"
        ? "Same time each day, 5 unhurried minutes side by side — brush the pet slowly, breathe together, no agenda. Rhythm calms revving engines better than words."
        : state === "stalled"
          ? "One tiny joyful mission together at the same time each day — 3 minutes, no pressure, you start it and they join. Small restarts beat big pep talks."
          : "One shared mission moment at the same time each day — side by side, unhurried. Predictable togetherness is the quiet engine of growth.",
    minutes: 5,
    kind: "routine",
  });

  return items;
}

/** Build the growth plan: strengths first, then one gentle stretch. */
export function buildGrowthPlan(input: BlueprintAssemblyInput): BlueprintGrowthItem[] {
  const items: BlueprintGrowthItem[] = [];
  const { brightest, growing } = brightestAndGrowing(input.flourishScores);

  const brightestLabel = FLOURISH_PILLAR_LABELS[brightest];
  const growingLabel = FLOURISH_PILLAR_LABELS[growing];

  // Lead with the strength — Sadhguru voice: celebrate what's shining.
  items.push({
    key: "strength-spotlight",
    title: `${brightestLabel} is shining`,
    detail:
      `This is the superpower right now. Keep feeding it: name it out loud when you see it ` +
      `("that was real ${brightestLabel.toLowerCase()}"), and let your child feel you noticing. ` +
      `Strengths grow fastest in sunlight.`,
    pillar: brightest,
  });

  // One gentle stretch toward the growing pillar — framed as blooming.
  const stretchTrait =
    input.weakestTraits.find((t) => TRAIT_TO_PILLAR[t] === growing) ??
    input.weakestTraits[0];
  items.push({
    key: "gentle-stretch",
    title: `${growingLabel} is blooming`,
    detail:
      `One small weekly mission aimed at ${growingLabel.toLowerCase()} — tiny, joyful, done together. ` +
      `Nothing to repair here; blooming can't be rushed, only watered.` +
      (stretchTrait ? ` A good doorway: missions that practice ${stretchTrait.replace("-", " ")}.` : ""),
    pillar: growing,
  });

  // Flow-state activity: one absorbing, just-right challenge.
  items.push({
    key: "flow-activity",
    title: "One delicious challenge",
    detail:
      `Pick one mission slightly stretchier than comfortable — hard enough to need focus, easy enough to finish. ` +
      `Attempts count as wins here ("brave tries"). The sweet spot where time disappears is where confidence is built.`,
    pillar: "mastery",
  });

  return items;
}

/** Assemble the full deterministic blueprint (no LLM yet). */
export function assembleBlueprint(input: BlueprintAssemblyInput): ResilienceBlueprint {
  const ageBand = ageBandForAge(input.age ?? 8);
  const engineState = classifyEngineState(input.engine);
  const { brightest, growing } = brightestAndGrowing(input.flourishScores);
  return {
    childId: input.childId,
    engineState,
    ageBand,
    observations: buildObservations(input),
    bodyToolkit: buildBodyToolkit(input),
    growthPlan: buildGrowthPlan(input),
    brightestPillar: brightest,
    growingPillar: growing,
    computedAt: new Date().toISOString(),
    mode: "deterministic",
    narrative: null,
  };
}

// ---------------------------------------------------------------------------
// LLM narration — warm parent-facing summary. Best-effort; the deterministic
// fallback always works. Model sees facts + age band only, never PII.
// ---------------------------------------------------------------------------

export interface BlueprintNarrationInput {
  engineState: EngineState;
  ageBand: IdeaAgeBand;
  observationTexts: string[];
  brightestPillar: FlourishPillar;
  growingPillar: FlourishPillar;
  bodyTitles: string[];
  growthTitles: string[];
}

export function buildBlueprintSystemPrompt(): string {
  return [
    "You write a short, warm opening message for a PARENT's personalized parenting guide. Output ONLY the message: 2-3 sentences, at most 280 characters.",
    "Rules:",
    "1. Behavioral observations only. Never diagnose, never label the child, never mention mental health, anxiety, ADHD, trauma, disorders, or therapy.",
    "2. Speak to the parent as the capable guide: frame everything as something THEY can try together with their child — never as something wrong with the child.",
    "3. Companion framing: side by side, not supervising. Celebrate joy and brave tries. Never shame, guilt-trip, or dwell on failure.",
    "4. Reference the actual observations. Name the brightest strength first — celebration before suggestion.",
    "5. No exclamation marks. No emojis. Plain warm language.",
    "Parent voice guidelines:",
    PARENT_VOICE_GUIDELINES,
  ].join("\n");
}

export function buildBlueprintUserPrompt(input: BlueprintNarrationInput): string {
  const stateLine =
    input.engineState === "running_hot"
      ? "Recent pattern: lots of energy, missions starting fast — a good moment for slowing down together."
      : input.engineState === "stalled"
        ? "Recent pattern: a quiet stretch with fewer completions — a good moment for tiny joyful restarts."
        : "Recent pattern: a steady rhythm — a good moment to protect the groove and stretch gently.";
  return [
    `Child age band: ${input.ageBand}.`,
    stateLine,
    `What we're noticing: ${input.observationTexts.join(" ")}`,
    `Brightest strength: ${FLOURISH_PILLAR_LABELS[input.brightestPillar]}. Growing edge: ${FLOURISH_PILLAR_LABELS[input.growingPillar]}.`,
    `Body toolkit includes: ${input.bodyTitles.join(", ")}.`,
    `Growth plan includes: ${input.growthTitles.join(", ")}.`,
    "Write the warm opening message for this parent's guide.",
  ].join("\n");
}

/** Deterministic fallback narrative — always safe, always warm. */
export function blueprintFallbackNarrative(input: BlueprintNarrationInput): string {
  const bright = FLOURISH_PILLAR_LABELS[input.brightestPillar].toLowerCase();
  const growing = FLOURISH_PILLAR_LABELS[input.growingPillar].toLowerCase();
  const stateBit =
    input.engineState === "running_hot"
      ? "There's a lot of wonderful energy here right now"
      : input.engineState === "stalled"
        ? "It's been a quieter stretch lately, and that's okay"
        : "There's a steady rhythm building here";
  return (
    `${stateBit}. ${bright} is shining brightest — keep naming it when you see it, ` +
    `side by side. ${growing} is blooming too; one small joyful mission a week, done together, ` +
    `is all the watering it needs.`
  );
}

/**
 * Sanitize an LLM narration: clinical-term scan + length cap.
 * Returns the clean text, or null when it must be replaced by fallback.
 */
export function sanitizeBlueprintNarration(text: string): string | null {
  const hit = scanNarrationForClinicalTerms(text);
  if (hit) return null;
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length < 20 || trimmed.length > 600) return null;
  return trimmed;
}

export function validateBlueprintInput(body: unknown): { ok: true; childId: string } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Request body must be JSON." };
  const childId = (body as { childId?: unknown }).childId;
  if (typeof childId !== "string" || childId.length === 0 || childId.length > 64) {
    return { ok: false, error: "childId is required." };
  }
  return { ok: true, childId };
}

// ---------------------------------------------------------------------------
// Client helper — mirrors fetchCopilotInsights.
// ---------------------------------------------------------------------------

/** One persisted blueprint row, as the Worker returns it. */
export interface BlueprintRow {
  id: string;
  child_id: string;
  engine_state: EngineState;
  observations_json: BlueprintObservation[];
  body_toolkit_json: BlueprintBodyItem[];
  growth_plan_json: BlueprintGrowthItem[];
  brightest_pillar: FlourishPillar;
  growing_pillar: FlourishPillar;
  narrative: string | null;
  mode: "ai" | "deterministic";
  created_at: string;
}

export interface FetchBlueprintOptions {
  fetchFn?: typeof fetch;
  token: string;
  childId: string;
  endpoint?: string;
}

export interface FetchBlueprintResult {
  ok: boolean;
  blueprint?: ResilienceBlueprint;
  cached?: boolean;
  error?: string;
}

/** Client helper: ask the Worker to assemble + narrate one child's blueprint. */
export async function fetchBlueprint(
  options: FetchBlueprintOptions,
): Promise<FetchBlueprintResult> {
  const { fetchFn = fetch, token, childId, endpoint = "/api/ai/blueprint" } = options;
  if (!token) return { ok: false, error: "no token" };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ childId }),
    });
    let data: { blueprint?: unknown; cached?: unknown } | null = null;
    try {
      data = (await response.json()) as { blueprint?: unknown; cached?: unknown } | null;
    } catch {
      data = null;
    }
    if (!response.ok || !data) return { ok: false, error: "request failed" };
    const raw = data.blueprint as Record<string, unknown> | undefined;
    if (!raw || typeof raw !== "object") return { ok: false, error: "unusable response" };
    // The Worker returns either the DB row or the assembled object; normalize.
    const obs = raw.observations_json ?? raw.observations;
    const body = raw.body_toolkit_json ?? raw.bodyToolkit;
    const growth = raw.growth_plan_json ?? raw.growthPlan;
    if (!Array.isArray(obs) || !Array.isArray(body) || !Array.isArray(growth)) {
      return { ok: false, error: "unusable response" };
    }
    const state = raw.engine_state ?? raw.engineState;
    if (!(ENGINE_STATES as readonly string[]).includes(state as string)) {
      return { ok: false, error: "unusable response" };
    }
    const blueprint: ResilienceBlueprint = {
      childId: String(raw.child_id ?? raw.childId ?? childId),
      engineState: state as EngineState,
      ageBand: (raw.age_band ?? raw.ageBand ?? "7-9") as IdeaAgeBand,
      observations: obs as BlueprintObservation[],
      bodyToolkit: body as BlueprintBodyItem[],
      growthPlan: growth as BlueprintGrowthItem[],
      brightestPillar: (raw.brightest_pillar ?? raw.brightestPillar ?? "joy") as FlourishPillar,
      growingPillar: (raw.growing_pillar ?? raw.growingPillar ?? "joy") as FlourishPillar,
      computedAt: String(raw.created_at ?? raw.computedAt ?? new Date().toISOString()),
      mode: raw.mode === "ai" ? "ai" : "deterministic",
      narrative: typeof raw.narrative === "string" ? raw.narrative : null,
    };
    return { ok: true, blueprint, cached: data.cached === true };
  } catch {
    return { ok: false, error: "request failed" };
  }
}
