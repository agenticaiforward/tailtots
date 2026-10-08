/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createLogger } from "../lib/logging/logger";
import {
  IDEAS_MODEL_ID,
  buildIdeasMessages,
  parseIdeasResponse,
  validateIdeasInput,
} from "../lib/ai/ideas";
import {
  CONVERSATION_MODEL_ID,
  buildConversationPromptMessages,
  parseConversationPromptResponse,
  validateConversationPromptInput,
} from "../lib/ai/conversation-prompt";
import {
  DAILY_BOOST_MODEL_ID,
  buildDailyBoostMessages,
  parseDailyBoostResponse,
  validateDailyBoostInput,
} from "../lib/ai/daily-boost";
import {
  MISSION_CATEGORIES,
  MISSION_SET_MODEL_ID,
  buildChildSnapshot,
  buildMissionSetMessages,
  parseMissionSetResponse,
  planMissionSlots,
  redactSnapshotForModel,
  scanMissionsForBlockedContent,
  validateMissionSetInput,
  type GeneratedMission,
  type MissionCategory,
  type MissionSkill,
  type SnapshotAwardInput,
  type SnapshotCompletionInput,
} from "../lib/ai/mission-engine";
import {
  COPILOT_MODEL_ID,
  buildCopilotNarrationMessages,
  calibrateDifficultyBands,
  detectPatterns,
  fallbackNarrative,
  narrationInputFor,
  parseCopilotNarrationResponse,
  validateCopilotInsightsInput,
  type CopilotEventInput,
  type DetectedPattern,
  type PatternInsightRow,
} from "../lib/ai/copilot";
import { InMemoryRateLimiter } from "../lib/ai/rate-limit";
import { authenticateParentRequest, extractBearerToken } from "../lib/ai/supabase-auth";
import {
  FLOURISH_MODEL_ID,
  brightestPillar,
  buildFlourishSystemPrompt,
  buildFlourishUserPrompt,
  buildFlourishingSnapshot,
  computeFlourishScores,
  computeFlourishTrends,
  flourishFallbackNarrative,
  sanitizeFlourishNarration,
  validateFlourishInput,
  weekStartIso,
  type FlourishBadgeInput,
  type FlourishBankInput,
  type FlourishEventInput,
  type FlourishScores,
} from "../lib/ai/flourishing";
import { ageBandForAge } from "../lib/ai/ideas";

const log = createLogger("worker:ai-ideas");
const conversationLog = createLogger("worker:ai-conversation-prompt");
const dailyBoostLog = createLogger("worker:ai-daily-boost");
const missionSetLog = createLogger("worker:ai-mission-set");
const copilotLog = createLogger("worker:ai-copilot-insights");
const flourishLog = createLogger("worker:ai-flourishing");

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  /**
   * Workers AI binding. Must be added in the Cloudflare dashboard
   * (Worker > Settings > Bindings > Add binding > Workers AI) — the
   * route below degrades gracefully until it exists.
   */
  AI: Ai;
  /**
   * Supabase project URL and anon (publishable) key used to validate parent
   * access tokens on the AI endpoint. Set as Worker env vars in the
   * Cloudflare dashboard. Never use the service_role key here.
   */
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true }

// Parent-side AI activity ideas: 20 requests/hour per client IP.
const ideasRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
// Parent-side AI conversation prompts: 20 requests/hour per client IP.
const conversationPromptRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
// Parent-side daily buddy boost: fetched once per day per family, so a small
// per-IP allowance is plenty.
const dailyBoostRateLimiter = new InMemoryRateLimiter(10, 60 * 60 * 1000);
// Parent-side AI mission sets: 20 requests/hour per client IP.
const missionSetRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
const copilotRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
const flourishRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * POST /api/ai/ideas — parent-facing activity-idea helper.
 * Only reachable from the parent-gated AI panel; the body is strictly
 * validated and only first name + age band + life skill ever reach the model.
 */
async function handleAiIdeas(request: Request, env: Env): Promise<Response> {
  if (ideasRateLimiter.isLimited(`ai-ideas:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    log.warn("Supabase env vars missing for /api/ai/ideas");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  log.info("AI ideas request from parent", { userId: parent.userId });
  if (!env.AI) {
    log.warn("AI binding missing for /api/ai/ideas");
    return jsonResponse({ error: "The AI helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateIdeasInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  try {
    const output = await env.AI.run(IDEAS_MODEL_ID, {
      messages: buildIdeasMessages(validated.value),
      max_tokens: 400,
      temperature: 0.7,
    });
    const ideas = parseIdeasResponse(output?.response ?? "");
    if (!ideas.length) {
      throw new Error("AI returned no usable ideas");
    }
    return jsonResponse({ ideas }, 200);
  } catch (error) {
    log.error("Workers AI ideas request failed", { error });
    return jsonResponse({ error: "The AI helper is unavailable right now." }, 502);
  }
}

/**
 * POST /api/ai/conversation-prompt — parent-facing "Ask your kid with AI".
 * Only reachable from the parent-gated AI panel; the body is strictly
 * validated and only the character topic + age band ever reach the model.
 * Returns `{ prompt }`: ONE predefined conversation prompt the parent asks
 * the kid — never open chat.
 */
async function handleAiConversationPrompt(request: Request, env: Env): Promise<Response> {
  if (conversationPromptRateLimiter.isLimited(`ai-conversation-prompt:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    conversationLog.warn("Supabase env vars missing for /api/ai/conversation-prompt");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  conversationLog.info("AI conversation-prompt request from parent", { userId: parent.userId });
  if (!env.AI) {
    conversationLog.warn("AI binding missing for /api/ai/conversation-prompt");
    return jsonResponse({ error: "The AI helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateConversationPromptInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  try {
    const output = await env.AI.run(CONVERSATION_MODEL_ID, {
      messages: buildConversationPromptMessages(validated.value),
      max_tokens: 200,
      temperature: 0.7,
    });
    const prompt = parseConversationPromptResponse(output?.response ?? "");
    if (!prompt) {
      throw new Error("AI returned no usable conversation prompt");
    }
    return jsonResponse({ prompt }, 200);
  } catch (error) {
    conversationLog.error("Workers AI conversation-prompt request failed", { error });
    return jsonResponse({ error: "The AI helper is unavailable right now." }, 502);
  }
}

/**
 * POST /api/ai/daily-boost — parent-side fetch for the kid's daily buddy
 * boost. The client caches the result per day in localStorage; the kid UI
 * only ever renders the cached predefined content (no open chat). The body
 * is strictly validated: date + age band + parent-set categories, never kid
 * PII. Returns the boost content plus its date.
 */
async function handleAiDailyBoost(request: Request, env: Env): Promise<Response> {
  if (dailyBoostRateLimiter.isLimited(`ai-daily-boost:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    dailyBoostLog.warn("Supabase env vars missing for /api/ai/daily-boost");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  dailyBoostLog.info("AI daily-boost request from parent", { userId: parent.userId });
  if (!env.AI) {
    dailyBoostLog.warn("AI binding missing for /api/ai/daily-boost");
    return jsonResponse({ error: "The AI helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateDailyBoostInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  try {
    const output = await env.AI.run(DAILY_BOOST_MODEL_ID, {
      messages: buildDailyBoostMessages(validated.value),
      max_tokens: 400,
      temperature: 0.7,
    });
    const boost = parseDailyBoostResponse(output?.response ?? "");
    if (!boost) {
      throw new Error("AI returned no usable daily boost");
    }
    return jsonResponse({ ...boost, date: validated.value.date }, 200);
  } catch (error) {
    dailyBoostLog.error("Workers AI daily-boost request failed", { error });
    return jsonResponse({ error: "The AI helper is unavailable right now." }, 502);
  }
}

/**
 * POST /api/ai/mission-set — Developmental Mission Engine (Phase 1).
 *
 * Parent-side only. Builds a deterministic child-state snapshot from Supabase
 * (via the parent's own JWT, so RLS applies), redacts it to coarse aggregates,
 * plans mission slots with a deterministic settle → connect → stretch rule,
 * then makes ONE Workers AI call to write the personalized set. The set is
 * recorded in mission_generations for audit; the parent approves every
 * mission in Parent Review before any child sees it (existing gate).
 *
 * The model NEVER sees: child names, photos, free-text notes, voice notes,
 * or any mental-health labels. On any AI failure the route returns 502 and
 * the client falls back through cached → smart templates → static templates
 * with honest labeling.
 */
interface SupabaseRestClient {
  supabaseUrl: string;
  anonKey: string;
  token: string;
}

function restHeaders(client: SupabaseRestClient): Record<string, string> {
  return {
    apikey: client.anonKey,
    Authorization: `Bearer ${client.token}`,
    "content-type": "application/json",
  };
}

async function restGet<T>(client: SupabaseRestClient, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${client.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`, {
      headers: restHeaders(client),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function restPost<T>(client: SupabaseRestClient, path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${client.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method: "POST",
      headers: { ...restHeaders(client), Prefer: "return=representation" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function restPatch<T>(client: SupabaseRestClient, path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${client.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method: "PATCH",
      headers: { ...restHeaders(client), Prefer: "return=representation" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Upsert with merge-duplicates (requires on_conflict query param naming the constraint columns). */
async function restUpsert<T>(client: SupabaseRestClient, path: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(`${client.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method: "POST",
      headers: { ...restHeaders(client), Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface ChildRow {
  id: string;
  family_id: string;
  age: number | null;
  streak_days: number;
  last_streak_date: string | null;
}

interface CompletionRow {
  completed_at: string;
  status: "pending" | "approved" | "rejected";
  tasks: { category: string; difficulty: string } | null;
}

interface AwardRow {
  skill: string;
  awarded_at: string;
}

const MISSION_CATEGORY_SET = new Set<string>(MISSION_CATEGORIES);

function toSnapshotCompletions(rows: CompletionRow[]): SnapshotCompletionInput[] {
  const out: SnapshotCompletionInput[] = [];
  for (const row of rows) {
    const category = MISSION_CATEGORY_SET.has(row.tasks?.category ?? "")
      ? (row.tasks!.category as MissionCategory)
      : "chore";
    const status = row.status === "approved" || row.status === "rejected" ? row.status : "pending";
    out.push({
      completedAt: row.completed_at,
      status,
      category,
      difficulty: typeof row.tasks?.difficulty === "string" ? row.tasks.difficulty : "easy",
    });
  }
  return out;
}

function toSnapshotAwards(rows: AwardRow[]): SnapshotAwardInput[] {
  const skills = ["responsibility", "empathy", "teamwork", "leadership", "time"] as const;
  const out: SnapshotAwardInput[] = [];
  for (const row of rows) {
    if ((skills as readonly string[]).includes(row.skill)) {
      out.push({ skill: row.skill as MissionSkill, awardedAt: row.awarded_at });
    }
  }
  return out;
}

async function handleAiMissionSet(request: Request, env: Env): Promise<Response> {
  if (missionSetRateLimiter.isLimited(`ai-mission-set:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    missionSetLog.warn("Supabase env vars missing for /api/ai/mission-set");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  const token = extractBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  missionSetLog.info("AI mission-set request from parent", { userId: parent.userId });
  if (!env.AI) {
    missionSetLog.warn("AI binding missing for /api/ai/mission-set");
    return jsonResponse({ error: "The AI helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateMissionSetInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  const { childId, count, focusSkill } = validated.value;
  const rest: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token,
  };

  // Stage A — snapshot. All reads use the parent's JWT so RLS scopes to
  // their own family. The model only ever sees the redacted aggregates.
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [childRows, petRows, completionRows, awardRows] = await Promise.all([
    restGet<ChildRow[]>(rest, `children?id=eq.${childId}&select=id,family_id,age,streak_days,last_streak_date&limit=1`),
    restGet<{ species: string }[]>(rest, `pets?select=species&limit=8`),
    restGet<CompletionRow[]>(
      rest,
      `task_completions?child_id=eq.${childId}&completed_at=gt.${sixtyDaysAgo}` +
        `&select=completed_at,status,tasks(category,difficulty)&order=completed_at.desc&limit=500`,
    ),
    restGet<AwardRow[]>(
      rest,
      `badge_awards?child_id=eq.${childId}&awarded_at=gt.${thirtyDaysAgo}&select=skill,awarded_at&limit=200`,
    ),
  ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  const snapshot = buildChildSnapshot({
    child: { age: child.age, streakDays: child.streak_days ?? 0, lastStreakDate: child.last_streak_date },
    completions: toSnapshotCompletions(completionRows ?? []),
    awards: toSnapshotAwards(awardRows ?? []),
    pets: (petRows ?? []).map((p) => ({ species: p.species })),
  });
  const redacted = redactSnapshotForModel(snapshot);

  // Stage B — deterministic plan.
  const plan = planMissionSlots(snapshot, { count, focusSkill });

  // Stage C — one LLM call.
  let missions: GeneratedMission[];
  try {
    const output = await env.AI.run(MISSION_SET_MODEL_ID, {
      messages: buildMissionSetMessages(redacted, plan),
      max_tokens: 900,
      temperature: 0.7,
    });
    const parsed = parseMissionSetResponse(output?.response ?? "");
    if (!parsed) throw new Error("AI returned no usable missions");
    const blocked = scanMissionsForBlockedContent(parsed);
    if (blocked) throw new Error(`AI output failed content scan: ${blocked}`);
    // Attach the planner's trait focus to each mission by slot order.
    missions = parsed.map((mission, i) => ({
      ...mission,
      traitFocus: plan.slots[i]?.traitFocus ?? null,
    }));
  } catch (error) {
    missionSetLog.error("Workers AI mission-set request failed", { error });
    return jsonResponse({ error: "The AI helper is unavailable right now." }, 502);
  }

  // Audit: record the generation (best-effort; never fail the request over it).
  let generationId = "";
  try {
    const insertResponse = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/mission_generations`,
      {
        method: "POST",
        headers: { ...restHeaders(rest), Prefer: "return=representation" },
        body: JSON.stringify({
          family_id: child.family_id,
          child_id: childId,
          parent_id: null,
          model_id: MISSION_SET_MODEL_ID,
          plan_json: plan,
          snapshot_json: redacted,
          output_json: missions,
          mode: "ai",
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (insertResponse.ok) {
      const rows = (await insertResponse.json()) as { id?: string }[];
      if (rows?.[0]?.id) generationId = rows[0].id;
    }
  } catch {
    // Audit write is best-effort.
  }

  return jsonResponse({ mode: "ai", missions, generationId }, 200);
}

interface CopilotEventRow {
  event_type: string;
  task_id: string | null;
  category: string | null;
  difficulty: string | null;
  skill: string | null;
  weekday: number | null;
  hour_of_day: number | null;
  minutes_to_complete: number | null;
  created_at: string;
}

function toCopilotEventInput(row: CopilotEventRow): CopilotEventInput {
  return {
    eventType: row.event_type,
    taskId: row.task_id,
    category: row.category,
    difficulty: row.difficulty,
    skill: row.skill,
    weekday: row.weekday,
    createdAt: row.created_at,
    minutesToComplete: row.minutes_to_complete,
  };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/**
 * POST /api/ai/copilot-insights — Parent Copilot (Phase 2).
 *
 * Parent-side only. Runs DETERMINISTIC pattern detection over the child's
 * mission_events (no LLM), reconciles pattern_insights, upserts
 * difficulty_calibration, then narrates up to 3 insights missing a narrative
 * with ONE small LLM call each (best-effort). Every narration is scanned
 * for clinical terms; on any failure the deterministic fallback narrative is
 * stored instead — the copilot works fully without the model.
 *
 * The model never sees raw events, names, notes, or photos: narration input
 * is insight_type + behavioral fact JSON + age band only.
 */
async function handleAiCopilotInsights(request: Request, env: Env): Promise<Response> {
  if (copilotRateLimiter.isLimited(`ai-copilot:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    copilotLog.warn("Supabase env vars missing for /api/ai/copilot-insights");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  const token = extractBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateCopilotInsightsInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  const { childId } = validated;
  const rest: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token,
  };

  // Child lookup through the parent's JWT: RLS scopes to their own family.
  const eightWeeksAgo = new Date(Date.now() - 56 * 86_400_000).toISOString();
  const [childRows, eventRows] = await Promise.all([
    restGet<ChildRow[]>(rest, `children?id=eq.${childId}&select=id,family_id,age,streak_days,last_streak_date&limit=1`),
    restGet<CopilotEventRow[]>(
      rest,
      `mission_events?child_id=eq.${childId}&created_at=gt.${eightWeeksAgo}` +
        `&select=event_type,task_id,category,difficulty,skill,weekday,hour_of_day,minutes_to_complete,created_at` +
        `&order=created_at.desc&limit=3000`,
    ),
  ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  const events = (eventRows ?? []).map(toCopilotEventInput);
  const nowMs = Date.now();

  // Stage 1 — deterministic detection (no LLM).
  const detected: DetectedPattern[] = detectPatterns(
    events,
    { streakDays: child.streak_days ?? 0, age: child.age },
    nowMs,
  );
  const calibrations = calibrateDifficultyBands(events, nowMs);

  // Stage 2 — reconcile pattern_insights.
  const existing =
    (await restGet<PatternInsightRow[]>(
      rest,
      `pattern_insights?child_id=eq.${childId}&select=*&order=created_at.desc&limit=50`,
    )) ?? [];
  const today = todayIso();
  const active = existing.filter(
    (r) => !r.dismissed_by_parent_id && (!r.valid_until || r.valid_until >= today),
  );
  const activeByType = new Map(active.map((r) => [r.insight_type, r]));
  const detectedTypes = new Set(detected.map((d) => d.insightType));
  const finalInsights: PatternInsightRow[] = [];

  for (const pattern of detected) {
    const prior = activeByType.get(pattern.insightType);
    const detailJson = pattern.detail as Record<string, string | number | boolean | null>;
    if (prior) {
      // Refresh if the facts changed (clears a stale narrative); else keep.
      if (JSON.stringify(prior.detail_json) !== JSON.stringify(detailJson)) {
        const updated = await restPatch<PatternInsightRow[]>(
          rest,
          `pattern_insights?id=eq.${prior.id}`,
          { detail_json: detailJson, severity: pattern.severity, narrative: null, valid_until: null },
        );
        if (updated?.[0]) finalInsights.push(updated[0]);
        else finalInsights.push(prior);
      } else {
        finalInsights.push(prior);
      }
    } else {
      const created = await restPost<PatternInsightRow[]>(
        rest,
        `pattern_insights`,
        {
          family_id: child.family_id,
          child_id: childId,
          insight_type: pattern.insightType,
          severity: pattern.severity,
          detail_json: detailJson,
        },
      );
      if (created?.[0]) finalInsights.push(created[0]);
    }
  }
  // Expire insights that no longer detect (keep history; stop showing).
  for (const prior of active) {
    if (!detectedTypes.has(prior.insight_type)) {
      await restPatch(rest, `pattern_insights?id=eq.${prior.id}`, { valid_until: yesterdayIso() });
    }
  }

  // Stage 3 — upsert difficulty calibration (feeds the Mission Engine planner).
  for (const cal of calibrations) {
    await restUpsert(
      rest,
      `difficulty_calibration?on_conflict=child_id,category`,
      {
        child_id: childId,
        category: cal.category,
        band: cal.band,
        completion_rate_30d: cal.rate,
        sample_size: cal.sampleSize,
      },
    );
  }

  // Stage 4 — narrate up to 3 insights missing a narrative (best-effort).
  const needsNarrative = finalInsights.filter((i) => !i.narrative).slice(0, 3);
  if (needsNarrative.length > 0 && env.AI) {
    for (const insight of needsNarrative) {
      const narrationInput = narrationInputFor(
        {
          insightType: insight.insight_type,
          severity: insight.severity,
          detail: insight.detail_json,
        },
        child.age,
      );
      let narrative: string | null = null;
      try {
        const output = await env.AI.run(COPILOT_MODEL_ID, {
          messages: buildCopilotNarrationMessages(narrationInput),
          max_tokens: 120,
          temperature: 0.5,
        });
        narrative = parseCopilotNarrationResponse(output?.response ?? "");
      } catch (error) {
        copilotLog.warn("Copilot narration failed; using fallback", { error });
      }
      // Deterministic, pre-written safe narrative on any LLM failure or
      // clinical-term scan hit. The copilot works fully without the model.
      const final = narrative ?? fallbackNarrative(narrationInput);
      const updated = await restPatch<PatternInsightRow[]>(rest, `pattern_insights?id=eq.${insight.id}`, {
        narrative: final,
      });
      if (updated?.[0]) {
        const idx = finalInsights.findIndex((i) => i.id === insight.id);
        if (idx >= 0) finalInsights[idx] = updated[0];
      } else {
        insight.narrative = final;
      }
    }
  } else if (needsNarrative.length > 0) {
    // No AI binding: store deterministic narratives directly.
    for (const insight of needsNarrative) {
      const final = fallbackNarrative(
        narrationInputFor(
          { insightType: insight.insight_type, severity: insight.severity, detail: insight.detail_json },
          child.age,
        ),
      );
      const updated = await restPatch<PatternInsightRow[]>(rest, `pattern_insights?id=eq.${insight.id}`, {
        narrative: final,
      });
      if (updated?.[0]) {
        const idx = finalInsights.findIndex((i) => i.id === insight.id);
        if (idx >= 0) finalInsights[idx] = updated[0];
      } else {
        insight.narrative = final;
      }
    }
  }

  // Order: act > watch > info, then newest first.
  const severityRank: Record<string, number> = { act: 0, watch: 1, info: 2 };
  finalInsights.sort(
    (a, b) =>
      (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
  return jsonResponse({ insights: finalInsights }, 200);
}

/**
 * POST /api/ai/flourishing — PERMA Growth Log (Phase 3).
 *
 * Parent-side only. Computes the five flourishing pillars DETERMINISTICALLY
 * from the child's mission_events, badge_awards, and Kid Bank ledger (no
 * LLM for scores), compares against the prior week's snapshot for trend
 * arrows, then narrates ONE warm parent-facing celebration with a small
 * LLM call (best-effort). Every narration is clinical-scanned; on any
 * failure the deterministic fallback narrative is stored instead.
 *
 * The model never sees raw events, names, notes, or photos: narration input
 * is pillar trends + brightest pillar + age band only. Scores are internal
 * only — never shown to children, never percentiles vs other kids.
 */
interface FlourishSnapshotRow {
  id: string;
  scores_json: FlourishScores;
  trends_json: Record<string, string>;
  narrative: string | null;
  created_at: string;
}

interface FlourishEventRow {
  event_type: string;
  task_id: string | null;
  category: string | null;
  difficulty: string | null;
  skill: string | null;
  created_at: string;
}

interface FlourishBadgeRow {
  skill: string | null;
  awarded_at: string;
}

interface FlourishBankRow {
  category: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

async function handleAiFlourishing(request: Request, env: Env): Promise<Response> {
  if (flourishRateLimiter.isLimited(`ai-flourishing:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    flourishLog.warn("Supabase env vars missing for /api/ai/flourishing");
    return jsonResponse(
      { error: "Parent sign-in is not configured yet. Please try again later." },
      503,
    );
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  const token = extractBearerToken(request.headers.get("Authorization"));
  if (!token) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateFlourishInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  const { childId } = validated;
  const rest: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token,
  };

  const nowMs = Date.now();
  const eightWeeksAgo = new Date(nowMs - 56 * 86_400_000).toISOString();
  const [childRows, eventRows, badgeRows, bankRows, priorRows] = await Promise.all([
    restGet<{ id: string; family_id: string; age: number | null }[]>(
      rest,
      `children?id=eq.${childId}&select=id,family_id,age&limit=1`,
    ),
    restGet<FlourishEventRow[]>(
      rest,
      `mission_events?child_id=eq.${childId}&created_at=gt.${eightWeeksAgo}` +
        `&select=event_type,task_id,category,difficulty,skill,created_at` +
        `&order=created_at.desc&limit=3000`,
    ),
    restGet<FlourishBadgeRow[]>(
      rest,
      `badge_awards?child_id=eq.${childId}&awarded_at=gt.${eightWeeksAgo}` +
        `&select=skill,awarded_at&order=awarded_at.desc&limit=500`,
    ),
    restGet<FlourishBankRow[]>(
      rest,
      `kid_bank_transactions?child_id=eq.${childId}&select=category,amount_cents,status,created_at&order=created_at.desc&limit=500`,
    ),
    restGet<FlourishSnapshotRow[]>(
      rest,
      `flourishing_snapshots?child_id=eq.${childId}&select=id,scores_json,trends_json,narrative,created_at&order=week_start.desc&limit=2`,
    ),
  ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  const events: FlourishEventInput[] = (eventRows ?? []).map((r) => ({
    eventType: r.event_type,
    taskId: r.task_id,
    category: r.category,
    difficulty: r.difficulty,
    skill: r.skill,
    createdAt: r.created_at,
  }));
  const badges: FlourishBadgeInput[] = (badgeRows ?? []).map((r) => ({
    skill: r.skill,
    earnedAt: r.awarded_at,
  }));
  const bank: FlourishBankInput[] = (bankRows ?? [])
    .filter((r) => ["earn", "spend", "give", "save"].includes(r.category))
    .map((r) => ({
      category: r.category as FlourishBankInput["category"],
      amount: r.amount_cents / 100,
      approved: r.status === "approved",
    }));

  // Idempotency: if this week's snapshot already exists, return it.
  const thisWeek = weekStartIso(nowMs);
  const existingThisWeek = (priorRows ?? []).find(
    (r) => r.created_at.slice(0, 10) >= thisWeek,
  );
  if (existingThisWeek) {
    return jsonResponse({ snapshot: existingThisWeek, cached: true }, 200);
  }

  // Stage 1 — deterministic pillar computation (no LLM). Prior week's
  // scores smooth the output so pillars move gradually.
  const prior = (priorRows ?? [])[0]?.scores_json as FlourishScores | undefined;
  const scores = computeFlourishScores(events, badges, bank, prior, nowMs);
  const lastWeekScores = prior;

  // Stage 2 — narration (best-effort LLM, deterministic fallback).
  const narrationInput = {
    scores,
    trends: computeFlourishTrends(scores, lastWeekScores),
    brightest: brightestPillar(scores),
    ageBand: ageBandForAge(child.age ?? 8),
  };

  let narrative: string | null = null;
  let mode: "ai" | "deterministic" = "deterministic";
  if (env.AI) {
    try {
      const output = await env.AI.run(FLOURISH_MODEL_ID, {
        messages: [
          { role: "system", content: buildFlourishSystemPrompt() },
          { role: "user", content: buildFlourishUserPrompt(narrationInput) },
        ],
        max_tokens: 150,
        temperature: 0.6,
      });
      narrative = sanitizeFlourishNarration(
        String((output as { response?: unknown })?.response ?? ""),
      );
      if (narrative) mode = "ai";
    } catch (error) {
      flourishLog.warn("Flourish narration failed; using fallback", { error });
    }
  }
  if (!narrative) {
    narrative = flourishFallbackNarrative(narrationInput.brightest);
  }

  const snapshot = buildFlourishingSnapshot(childId, scores, lastWeekScores, narrative, mode, nowMs);

  // Stage 3 — persist (unique on child_id + week_start; ignore conflicts).
  const created = await restPost<FlourishSnapshotRow[]>(
    rest,
    `flourishing_snapshots`,
    {
      family_id: child.family_id,
      child_id: childId,
      week_start: snapshot.weekStart,
      scores_json: snapshot.scores,
      trends_json: snapshot.trends,
      brightest: snapshot.brightest,
      narrative: snapshot.narrative,
      mode: snapshot.mode,
    },
  );

  return jsonResponse({ snapshot: created?.[0] ?? snapshot, cached: false }, 200);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai/ideas") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiIdeas(request, env);
    }

    if (url.pathname === "/api/ai/conversation-prompt") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiConversationPrompt(request, env);
    }

    if (url.pathname === "/api/ai/daily-boost") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiDailyBoost(request, env);
    }

    if (url.pathname === "/api/ai/mission-set") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiMissionSet(request, env);
    }

    if (url.pathname === "/api/ai/copilot-insights") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiCopilotInsights(request, env);
    }

    if (url.pathname === "/api/ai/flourishing") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiFlourishing(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
