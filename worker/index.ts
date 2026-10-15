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
  VOICE_INTENT_MODEL_ID,
  buildVoiceIntentMessages,
  parseVoiceIntentResponse,
  validateVoiceIntentInput,
} from "../lib/voice/intent-planning";
import {
  VOICE_QUIZ_MODEL_ID,
  buildQuizAnswerMessages,
  buildQuizStartMessages,
  parseQuizAnswer,
  parseQuizStart,
  questionCount,
  validateQuizInput,
} from "../lib/voice/quiz";
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
  buildAuthorizationRedirect,
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  verifyAlexaAccessToken,
} from "../lib/alexa/oauth";
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
import {
  runFlowCalibration,
  updateEloRating,
  initialEloState,
  detectBraveTry,
  trackScaffoldFade,
  buildDifficultyNudge,
  DIFFICULTY_RATINGS,
  type FlowEventInput,
  type EloRatingState,
  type MissionCategory as FlowCategory,
} from "../lib/ai/flow-calibration";
import {
  BLUEPRINT_MODEL_ID,
  assembleBlueprint,
  buildBlueprintSystemPrompt,
  buildBlueprintUserPrompt,
  blueprintFallbackNarrative,
  sanitizeBlueprintNarration,
  validateBlueprintInput,
  type BlueprintAssemblyInput,
  type EngineStateInput,
} from "../lib/ai/blueprint";

const log = createLogger("worker:ai-ideas");
const conversationLog = createLogger("worker:ai-conversation-prompt");
const dailyBoostLog = createLogger("worker:ai-daily-boost");
const missionSetLog = createLogger("worker:ai-mission-set");
const copilotLog = createLogger("worker:ai-copilot-insights");
const flourishLog = createLogger("worker:ai-flourishing");
const flowLog = createLogger("worker:ai-flow-calibration");
const blueprintLog = createLogger("worker:ai-blueprint");
const blueprintRateLimiter = new InMemoryRateLimiter(10, 60 * 60 * 1000);

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
  /**
   * Stripe secret key for parent card verification (COPPA verifiable
   * parental consent). Set as a Worker secret in the Cloudflare dashboard.
   * Never expose to the client — only the publishable key is public.
   */
  STRIPE_SECRET_KEY?: string;
  /**
   * OAuth credentials for the Alexa parent skill's account linking
   * (authorization code grant). Set all three as Worker secrets in the
   * Cloudflare dashboard. ALEXA_CLIENT_ID is public-ish (embedded in
   * skill.json); ALEXA_CLIENT_SECRET and ALEXA_TOKEN_SECRET are true secrets.
   */
  ALEXA_CLIENT_ID?: string;
  ALEXA_CLIENT_SECRET?: string;
  ALEXA_TOKEN_SECRET?: string;
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
const flowRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
// Voice intent planning: interactive use, so a per-minute allowance. No parent
// auth required (kids use voice too) — input is strictly validated, PII-free
// by construction, and the model can only return a constrained action plan.
const voiceIntentRateLimiter = new InMemoryRateLimiter(30, 60 * 1000);
// Voice quiz: same kid-safe posture as voice intent — no parent auth,
// strict validation, PII-free, rate limited. Short sessions by design.
const voiceQuizRateLimiter = new InMemoryRateLimiter(20, 60 * 1000);
// Alexa account-linking OAuth endpoints: interactive use, tight allowance.
const alexaOauthRateLimiter = new InMemoryRateLimiter(30, 60 * 1000);
const alexaSummaryRateLimiter = new InMemoryRateLimiter(30, 60 * 1000);

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
 * POST /api/voice/intent — AI-native voice control planner.
 *
 * The client sends a speech transcript + a PII-free snapshot of what's on
 * screen. Workers AI returns a constrained action plan (click/type/navigate
 * steps, or a clarifying question). The client validates every planned
 * action against real page elements before executing — the model can never
 * invent buttons or run anything directly.
 *
 * No parent auth: kids use voice too. Protected by strict input validation
 * (transcript + UI labels only, no PII) and per-IP rate limiting instead.
 */
async function handleVoiceIntent(request: Request, env: Env): Promise<Response> {
  if (voiceIntentRateLimiter.isLimited(`voice-intent:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.AI) {
    log.warn("AI binding missing for /api/voice/intent");
    return jsonResponse({ error: "The voice helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateVoiceIntentInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  try {
    const output = await env.AI.run(VOICE_INTENT_MODEL_ID, {
      messages: buildVoiceIntentMessages(
        validated.value.transcript,
        validated.value.context,
        validated.value.history,
      ),
      max_tokens: 500,
      temperature: 0.3,
    });
    const plan = parseVoiceIntentResponse(output?.response ?? "");
    if (!plan) {
      throw new Error("AI returned no usable plan");
    }
    return jsonResponse(plan, 200);
  } catch (error) {
    log.error("Workers AI voice-intent request failed", { error });
    return jsonResponse({ error: "The voice helper is unavailable right now." }, 502);
  }
}

/**
 * POST /api/voice/speak — the ONE TailTots voice (showcase/demo speech).
 *
 * Device text-to-speech sounds robotic and differs on every phone, so the
 * demo's speak-only guide uses a single server voice instead: Deepgram
 * Aura "asteria" (warm, natural) through the Workers AI binding, streamed
 * back as MP3. Speak-only by design — the client sends text it already
 * displays (page summaries, sample missions); no audio, no PII ever
 * arrives here. Tight caps (600 chars, per-IP rate limit) keep cost ~0.
 */
const voiceSpeakRateLimiter = new InMemoryRateLimiter(30, 60 * 60 * 1000);

async function handleVoiceSpeak(request: Request, env: Env): Promise<Response> {
  if (voiceSpeakRateLimiter.isLimited(`voice-speak:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.AI) {
    log.warn("AI binding missing for /api/voice/speak");
    return jsonResponse({ error: "The voice guide is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 600) {
    return jsonResponse({ error: "Text must be 1-600 characters." }, 400);
  }
  // The family picks the guide's voice (samples offered 2026-10-15);
  // anything off the allowlist falls back to the default.
  const AURA_SPEAKERS = ["asteria", "luna", "stella", "athena", "hera", "arcas", "orion", "orpheus", "perseus", "helios", "zeus", "angus"];
  const requestedSpeaker = (body as { speaker?: unknown })?.speaker;
  const speaker = typeof requestedSpeaker === "string" && AURA_SPEAKERS.includes(requestedSpeaker) ? requestedSpeaker : "asteria";
  try {
    const resp = await env.AI.run(
      "@cf/deepgram/aura-1",
      { text: text.trim(), speaker, encoding: "mp3" } as never,
      { returnRawResponse: true },
    );
    const audio = resp as unknown as Response;
    return new Response(audio.body, {
      status: 200,
      headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
    });
  } catch (error) {
    log.error("Workers AI voice-speak request failed", { error });
    return jsonResponse({ error: "The voice guide is unavailable right now." }, 502);
  }
}

/**
 * POST /api/voice/quiz — AI quiz host for kids (ADHD/autism-friendly).
 *
 * Two actions: "start" (new quiz on a topic) and "answer" (evaluate the
 * kid's spoken answer, return feedback + next question or completion).
 * Questions are short, literal, multiple-choice by default; feedback is
 * never shaming. No parent auth (kids use it); strict validation +
 * rate limiting instead. The model never sees PII — only topic, age,
 * and the quiz history.
 */
async function handleVoiceQuiz(request: Request, env: Env): Promise<Response> {
  if (voiceQuizRateLimiter.isLimited(`voice-quiz:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.AI) {
    log.warn("AI binding missing for /api/voice/quiz");
    return jsonResponse({ error: "The quiz helper is not configured yet." }, 503);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateQuizInput(body);
  if (!validated.ok) {
    return jsonResponse({ error: validated.error }, 400);
  }
  const input = validated.value;
  try {
    if (input.action === "start") {
      const output = await env.AI.run(VOICE_QUIZ_MODEL_ID, {
        messages: buildQuizStartMessages(input.topic ?? "animals", input.age, input.easyMode === true),
        max_tokens: 400,
        temperature: 0.7,
      });
      const q = parseQuizStart(output?.response ?? "");
      if (!q) throw new Error("AI returned no usable question");
      return jsonResponse({ total: questionCount(input.age), question: q }, 200);
    }
    const output = await env.AI.run(VOICE_QUIZ_MODEL_ID, {
      messages: buildQuizAnswerMessages(
        input.topic ?? "animals",
        input.age,
        input.easyMode === true,
        input.history ?? [],
        input.answer ?? "",
      ),
      max_tokens: 500,
      temperature: 0.4,
    });
    const parsed = parseQuizAnswer(output?.response ?? "");
    if (!parsed) throw new Error("AI returned no usable evaluation");
    const history = input.history ?? [];
    const correctCount = history.filter((h) => h.correct).length + (parsed.correct ? 1 : 0);
    return jsonResponse({ ...parsed, score: { correct: correctCount, total: history.length + 1 } }, 200);
  } catch (error) {
    log.error("Workers AI voice-quiz request failed", { error });
    return jsonResponse({ error: "The quiz helper is unavailable right now." }, 502);
  }
}

/**
 * POST /api/ai/ideas — parent-facing activity-idea helper.
 * Only reachable from the parent-gated AI panel; the body is strictly
 * validated and only life skill + age band ever reach the model
 * (childFirstName, if sent by older clients, is stripped during validation).
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
  const [childRows, petRows, completionRows, awardRows, lifetimeAwards, lifetimeCompletions] = await Promise.all([
    restGet<ChildRow[]>(rest, `children?id=eq.${childId}&select=id,family_id,age,streak_days,last_streak_date&limit=1`),
    restGet<{ species: string; name?: string; careNotes?: string; favoriteFood?: string }[]>(rest, `pets?select=species,name,careNotes,favoriteFood&limit=8`),
    restGet<CompletionRow[]>(
      rest,
      `task_completions?child_id=eq.${childId}&completed_at=gt.${sixtyDaysAgo}` +
        `&select=completed_at,status,tasks(category,difficulty)&order=completed_at.desc&limit=500`,
    ),
    restGet<AwardRow[]>(
      rest,
      `badge_awards?child_id=eq.${childId}&awarded_at=gt.${thirtyDaysAgo}&select=skill,awarded_at&limit=200`,
    ),
    // Lifetime achievement history — full badge and completion counts for long-term insight.
    restGet<{ skill: string }[]>(rest, `badge_awards?child_id=eq.${childId}&select=skill&limit=1000`),
    restGet<{ status: string }[]>(rest, `task_completions?child_id=eq.${childId}&select=status&limit=1000`),
  ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  const snapshot = buildChildSnapshot({
    child: { age: child.age, streakDays: child.streak_days ?? 0, lastStreakDate: child.last_streak_date },
    completions: toSnapshotCompletions(completionRows ?? []),
    awards: toSnapshotAwards(awardRows ?? []),
    pets: (petRows ?? []).map((p) => ({
      species: p.species,
      name: p.name,
      careNeeds: [p.careNotes, p.favoriteFood ? `Favorite food: ${p.favoriteFood}` : null].filter(Boolean).join("; ") || undefined,
    })),
    lifetime: {
      totalBadges: (lifetimeAwards ?? []).length,
      badgesBySkill: (lifetimeAwards ?? []).reduce<Record<string, number>>((acc, a) => {
        acc[a.skill] = (acc[a.skill] ?? 0) + 1;
        return acc;
      }, {}),
      totalCompletions: (lifetimeCompletions ?? []).filter((c) => c.status === "completed").length,
    },
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

/**
 * POST /api/ai/flow-calibration — Flow Calibration (Phase 4a).
 *
 * Parent-side only. Runs the deterministic flow engine over the child's
 * mission_events: Elo rating updates, asymmetric signal-based band
 * calibration, Brave Try detection, scaffold-fade tracking. Writes
 * readiness_ratings and upserts difficulty_calibration; returns bands,
 * nudges (with {name} placeholder for the UI to fill), and any Brave Try
 * awards. No LLM calls — fully deterministic, works offline-capable.
 */
async function handleAiFlowCalibration(request: Request, env: Env): Promise<Response> {
  if (flowRateLimiter.isLimited(`ai-flow:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    flowLog.warn("Supabase env vars missing for /api/ai/flow-calibration");
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
  const childId = typeof (body as Record<string, unknown>)?.childId === "string"
    ? (body as Record<string, string>).childId
    : null;
  if (!childId) {
    return jsonResponse({ error: "childId is required." }, 400);
  }
  const rest: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token,
  };

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [childRows, eventRows, ratingRows] = await Promise.all([
    restGet<ChildRow[]>(rest, `children?id=eq.${childId}&select=id,family_id,age&limit=1`),
    restGet<Array<Record<string, unknown>>>(
      rest,
      `mission_events?child_id=eq.${childId}&created_at=gt.${thirtyDaysAgo}` +
        `&select=child_id,event_type,category,difficulty,minutes_to_complete,created_at` +
        `&order=created_at.desc&limit=3000`,
    ),
    restGet<Array<Record<string, unknown>>>(
      rest,
      `readiness_ratings?child_id=eq.${childId}&select=child_id,category,rating,games_played,scaffold_level,consecutive_wins`,
    ),
  ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  const ageBand = ageBandForAge(typeof child.age === "number" ? child.age : 8);
  const events: FlowEventInput[] = (eventRows ?? []).map((r) => ({
    childId: String(r.child_id ?? childId),
    eventType: String(r.event_type ?? ""),
    category: typeof r.category === "string" ? r.category : undefined,
    difficulty: typeof r.difficulty === "string" ? r.difficulty : undefined,
    minutesToComplete: typeof r.minutes_to_complete === "number" ? r.minutes_to_complete : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }));

  // Rebuild Elo states from stored ratings, then fold in recent outcomes.
  const eloStates: Partial<Record<FlowCategory, EloRatingState>> = {};
  for (const r of ratingRows ?? []) {
    const cat = String(r.category ?? "");
    if (!cat) continue;
    eloStates[cat as FlowCategory] = {
      childId,
      category: cat as FlowCategory,
      rating: typeof r.rating === "number" ? r.rating : 1200,
      gamesPlayed: typeof r.games_played === "number" ? r.games_played : 0,
    };
  }

  // Current bands from difficulty_calibration (Phase 2 table).
  const bandRows =
    (await restGet<Array<Record<string, unknown>>>(
      rest,
      `difficulty_calibration?child_id=eq.${childId}&select=category,band`,
    )) ?? [];
  const currentBands: Partial<Record<FlowCategory, "easy" | "medium" | "hard">> = {};
  for (const r of bandRows) {
    const cat = String(r.category ?? "");
    const band = String(r.band ?? "");
    if (cat && (band === "easy" || band === "medium" || band === "hard")) {
      currentBands[cat as FlowCategory] = band;
    }
  }

  const result = runFlowCalibration({
    childId,
    ageBand,
    events,
    currentBands,
    eloStates,
    now: Date.now(),
  });

  // Persist: upsert readiness_ratings and difficulty_calibration.
  const nowIso = new Date().toISOString();
  await Promise.all([
    ...Object.values(result.eloStates).map((s) =>
      restUpsert(rest, "readiness_ratings", {
        child_id: childId,
        category: s.category,
        rating: s.rating,
        games_played: s.gamesPlayed,
        updated_at: nowIso,
      }),
    ),
    ...Object.entries(result.bands).map(([category, band]) =>
      restUpsert(rest, "difficulty_calibration", {
        child_id: childId,
        category,
        band,
        updated_at: nowIso,
      }),
    ),
  ]);

  return jsonResponse(
    {
      bands: result.bands,
      calibrations: result.calibrations.map((c) => ({
        category: c.category,
        band: c.band,
        previousBand: c.previousBand,
        moved: c.moved,
        moveDirection: c.moveDirection,
        reason: c.reason,
      })),
      nudges: result.nudges,
    },
    200,
  );
}

/**
 * POST /api/ai/blueprint — Child Resilience Blueprint (Phase 5).
 *
 * Parent-side only. Assembles the three-part blueprint DETERMINISTICALLY
 * from the child's mission_events, badge_awards, Kid Bank ledger, and
 * flourishing history (no LLM for structure), then narrates ONE warm
 * parent-facing opening with a small LLM call (best-effort). Every
 * narration is clinical-scanned; on any failure the deterministic
 * fallback narrative is stored instead.
 *
 * The model never sees raw events, names, notes, or photos: narration
 * input is behavioral facts + age band only. Blueprints are snapshots
 * (30-day expiry), not persistent psychological profiles.
 */
interface BlueprintEventRow {
  event_type: string;
  category: string | null;
  difficulty: string | null;
  skill: string | null;
  minutes_to_complete: number | null;
  created_at: string;
}

interface BlueprintBadgeRow {
  skill: string | null;
  awarded_at: string;
}

interface BlueprintBankRow {
  category: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

interface BlueprintSnapshotRow {
  id: string;
  engine_state: string;
  observations_json: unknown;
  body_toolkit_json: unknown;
  growth_plan_json: unknown;
  brightest_pillar: string;
  growing_pillar: string;
  narrative: string | null;
  mode: string;
  created_at: string;
}

async function handleAiBlueprint(request: Request, env: Env): Promise<Response> {
  if (blueprintRateLimiter.isLimited(`ai-blueprint:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    blueprintLog.warn("Supabase env vars missing for /api/ai/blueprint");
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
  const validated = validateBlueprintInput(body);
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
  const sixtyDaysAgo = new Date(nowMs - 60 * 86_400_000).toISOString();
  const fourteenDaysAgo = new Date(nowMs - 14 * 86_400_000).toISOString();
  const threeDaysAgo = new Date(nowMs - 3 * 86_400_000).toISOString();

  const [childRows, petRows, eventRows, badgeRows, bankRows, flourishRows, existingRows] =
    await Promise.all([
      restGet<{ id: string; family_id: string; age: number | null }[]>(
        rest,
        `children?id=eq.${childId}&select=id,family_id,age&limit=1`,
      ),
      restGet<{ species: string }[]>(rest, `pets?select=species&limit=8`),
      restGet<BlueprintEventRow[]>(
        rest,
        `mission_events?child_id=eq.${childId}&created_at=gt.${sixtyDaysAgo}` +
          `&select=event_type,category,difficulty,skill,minutes_to_complete,created_at` +
          `&order=created_at.desc&limit=3000`,
      ),
      restGet<BlueprintBadgeRow[]>(
        rest,
        `badge_awards?child_id=eq.${childId}&awarded_at=gt.${sixtyDaysAgo}` +
          `&select=skill,awarded_at&order=awarded_at.desc&limit=500`,
      ),
      restGet<BlueprintBankRow[]>(
        rest,
        `kid_bank_transactions?child_id=eq.${childId}&created_at=gt.${sixtyDaysAgo}` +
          `&select=category,amount_cents,status,created_at&order=created_at.desc&limit=500`,
      ),
      restGet<FlourishSnapshotRow[]>(
        rest,
        `flourishing_snapshots?child_id=eq.${childId}` +
          `&select=id,scores_json,trends_json,narrative,created_at` +
          `&order=created_at.desc&limit=2`,
      ),
      restGet<BlueprintSnapshotRow[]>(
        rest,
        `blueprint_snapshots?child_id=eq.${childId}` +
          `&select=id,engine_state,observations_json,body_toolkit_json,growth_plan_json,brightest_pillar,growing_pillar,narrative,mode,created_at` +
          `&order=created_at.desc&limit=1`,
      ),
    ]);
  const child = childRows?.[0] ?? null;
  if (!child) {
    return jsonResponse({ error: "Child not found." }, 404);
  }

  // Idempotency: a fresh (≤7 day old) blueprint is returned as-is.
  const existing = (existingRows ?? [])[0];
  if (existing && Date.parse(existing.created_at) > nowMs - 7 * 86_400_000) {
    return jsonResponse({ blueprint: existing, cached: true }, 200);
  }

  // ---- Stage 1: deterministic assembly (no LLM) ----
  const events = eventRows ?? [];
  const recent = events.filter((e) => e.created_at >= fourteenDaysAgo);
  const completions14d = recent.filter((e) => e.event_type === "completed").length;
  const assigned14d = recent.filter((e) =>
    ["assigned", "completed", "skipped", "rejected"].includes(e.event_type),
  ).length;
  const skipped14d = recent.filter((e) => e.event_type === "skipped" || e.event_type === "rejected").length;
  const completedRows = recent.filter(
    (e) => e.event_type === "completed" && e.minutes_to_complete != null,
  );
  const avgMinutes =
    completedRows.length > 0
      ? completedRows.reduce((s, e) => s + (e.minutes_to_complete ?? 0), 0) / completedRows.length
      : null;
  const hardAttempts = recent.filter((e) => e.difficulty === "hard").length;
  const hardCompletions = recent.filter(
    (e) => e.difficulty === "hard" && e.event_type === "completed",
  ).length;
  const recentCompletions = events.filter(
    (e) => e.event_type === "completed" && e.created_at >= threeDaysAgo,
  ).length;

  const engineInput: EngineStateInput = {
    completionRate14d: assigned14d > 0 ? completions14d / assigned14d : null,
    avgMinutesPerMission: avgMinutes,
    skipRate14d: assigned14d > 0 ? skipped14d / assigned14d : null,
    recentCompletions,
    hardAttempts14d: hardAttempts,
    hardCompletions14d: hardCompletions,
  };

  // Trait scores: reuse the badge-derived signal (60/40 blend lives in the
  // Mission Engine; here we do a light version from recent badges).
  const skillCounts: Record<string, number> = {};
  for (const b of badgeRows ?? []) {
    if (b.skill) skillCounts[b.skill] = (skillCounts[b.skill] ?? 0) + 1;
  }
  const totalBadges = Object.values(skillCounts).reduce((a, b) => a + b, 0);
  const traitScores: Record<string, number> = {};
  const { SKILL_TO_TRAITS, THRIVER_TRAITS } = await import("../lib/ai/mission-engine").then(
    (m) => ({ SKILL_TO_TRAITS: m.SKILL_TO_TRAITS, THRIVER_TRAITS: m.THRIVER_TRAITS }),
  );
  for (const trait of THRIVER_TRAITS) {
    let acc = 0;
    let n = 0;
    for (const [skill, traits] of Object.entries(SKILL_TO_TRAITS)) {
      if ((traits as string[]).includes(trait)) {
        acc += totalBadges > 0 ? (skillCounts[skill] ?? 0) / totalBadges : 0;
        n += 1;
      }
    }
    traitScores[trait] = n > 0 ? acc / n : 0.5;
  }
  const weakestTraits = [...THRIVER_TRAITS].sort(
    (a, b) => (traitScores[a] ?? 0.5) - (traitScores[b] ?? 0.5),
  );

  // PERMA pillar scores: prefer the latest flourishing snapshot; otherwise
  // compute a light version from events/badges/bank.
  let flourishScores: FlourishScores;
  const latestFlourish = (flourishRows ?? [])[0];
  if (latestFlourish?.scores_json) {
    flourishScores = latestFlourish.scores_json as FlourishScores;
  } else {
    const fEvents = events.map((r) => ({
      eventType: r.event_type,
      taskId: null,
      approved: true,
    }));
    const fBadges = (badgeRows ?? []).map((r) => ({ skill: r.skill, earnedAt: r.awarded_at }));
    const fBank = (bankRows ?? [])
      .filter((r) => ["earn", "spend", "give", "save"].includes(r.category))
      .map((r) => ({
        category: r.category as "earn" | "spend" | "give" | "save",
        amount: r.amount_cents / 100,
        approved: r.status === "approved",
      }));
    flourishScores = computeFlourishScores(fEvents, fBadges, fBank, undefined, nowMs);
  }

  const assemblyInput: BlueprintAssemblyInput = {
    childId,
    age: child.age ?? null,
    engine: engineInput,
    traitScores,
    weakestTraits,
    flourishScores,
    hasPet: (petRows ?? []).length > 0,
    parentFocusSkill: null,
  };
  const blueprint = assembleBlueprint(assemblyInput);

  // ---- Stage 2: narration (best-effort LLM, deterministic fallback) ----
  const narrationInput = {
    engineState: blueprint.engineState,
    ageBand: blueprint.ageBand,
    observationTexts: blueprint.observations.map((o) => o.text),
    brightestPillar: blueprint.brightestPillar,
    growingPillar: blueprint.growingPillar,
    bodyTitles: blueprint.bodyToolkit.map((b) => b.title),
    growthTitles: blueprint.growthPlan.map((g) => g.title),
  };
  let narrative: string | null = null;
  let mode: "ai" | "deterministic" = "deterministic";
  if (env.AI) {
    try {
      const output = await env.AI.run(BLUEPRINT_MODEL_ID, {
        messages: [
          { role: "system", content: buildBlueprintSystemPrompt() },
          { role: "user", content: buildBlueprintUserPrompt(narrationInput) },
        ],
        max_tokens: 200,
        temperature: 0.6,
      });
      narrative = sanitizeBlueprintNarration(
        String((output as { response?: unknown })?.response ?? ""),
      );
      if (narrative) mode = "ai";
    } catch (error) {
      blueprintLog.warn("Blueprint narration failed; using fallback", { error });
    }
  }
  if (!narrative) {
    narrative = blueprintFallbackNarrative(narrationInput);
  }
  blueprint.narrative = narrative;
  blueprint.mode = mode;

  // ---- Stage 3: persist the snapshot ----
  const created = await restPost<BlueprintSnapshotRow[]>(
    rest,
    `blueprint_snapshots`,
    {
      family_id: child.family_id,
      child_id: childId,
      engine_state: blueprint.engineState,
      age_band: blueprint.ageBand,
      observations_json: blueprint.observations,
      body_toolkit_json: blueprint.bodyToolkit,
      growth_plan_json: blueprint.growthPlan,
      brightest_pillar: blueprint.brightestPillar,
      growing_pillar: blueprint.growingPillar,
      narrative: blueprint.narrative,
      mode: blueprint.mode,
    },
  );

  return jsonResponse({ blueprint: created?.[0] ?? blueprint, cached: false }, 200);
}

// ---------------------------------------------------------------------------
// Parent identity verification — COPPA verifiable parental consent (§312.5).
//
// FTC-approved card check without a third-party vendor: the parent's card is
// tokenized by Stripe.js in the browser (raw PAN never touches TailTots), the
// worker creates a $1 PaymentIntent and immediately refunds it. Only a
// successful authorization counts as verification. We store the PROOF
// (payment-intent id, brand, last4, timestamp) — never card numbers.
// ---------------------------------------------------------------------------

const VERIFY_CARD_AMOUNT_CENTS = 100; // $1 temporary authorization
const verifyCardRateLimiter = new InMemoryRateLimiter(5, 60 * 60 * 1000);

interface StripePaymentIntent {
  id: string;
  status: string;
  client_secret?: string;
  payment_method_details?: { card?: { brand?: string; last4?: string } };
}

async function stripeApi(
  secretKey: string,
  method: "POST" | "GET",
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; json: any }> {
  const body = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    // leave null
  }
  return { ok: response.ok, status: response.status, json };
}

/**
 * POST /api/parent/verify-card — verify the parent via a $1 card
 * authorization that is immediately refunded.
 *
 * Parent JWT required. Body: { paymentMethodId: "pm_..." }.
 * Raw card numbers never reach this endpoint — Stripe.js tokenizes in the
 * browser and only the PaymentMethod id is sent.
 */
async function handleParentVerifyCard(request: Request, env: Env): Promise<Response> {
  if (verifyCardRateLimiter.isLimited(`verify-card:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (!env.STRIPE_SECRET_KEY) {
    log.warn("STRIPE_SECRET_KEY missing for /api/parent/verify-card");
    return jsonResponse({ error: "Card verification is not configured yet." }, 503);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Parent sign-in is not configured yet." }, 503);
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse({ error: "Parent sign-in required." }, 401);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }
  const { paymentMethodId } = body as Record<string, unknown>;
  if (typeof paymentMethodId !== "string" || !/^pm_[a-zA-Z0-9]{10,}$/.test(paymentMethodId)) {
    return jsonResponse({ error: "A valid card is required." }, 400);
  }

  // $1 authorization. Confirm immediately; refund immediately after success.
  const pi = await stripeApi(env.STRIPE_SECRET_KEY, "POST", "/payment_intents", {
    amount: String(VERIFY_CARD_AMOUNT_CENTS),
    currency: "usd",
    payment_method: paymentMethodId,
    confirmation_method: "automatic",
    confirm: "true",
    "description": "TailTots parent identity verification (refunded immediately)",
    "metadata[purpose]": "coppa-parent-verification",
  });
  if (!pi.ok) {
    const message =
      typeof pi.json?.error?.message === "string" ? pi.json.error.message : "Card verification failed.";
    return jsonResponse({ error: message }, 402);
  }
  const intent = pi.json as StripePaymentIntent;

  // 3-D Secure or other action required — hand the client secret back so the
  // browser can complete it, then the client retries confirmation.
  if (intent.status === "requires_action" && intent.client_secret) {
    return jsonResponse(
      { needsAction: true, clientSecret: intent.client_secret, paymentIntentId: intent.id },
      200,
    );
  }
  if (intent.status !== "succeeded") {
    return jsonResponse({ error: "Card verification could not be completed." }, 402);
  }

  // Immediately refund the $1 — the card is for identity proof, never a charge.
  const refund = await stripeApi(env.STRIPE_SECRET_KEY, "POST", "/refunds", {
    payment_intent: intent.id,
    reason: "requested_by_customer",
  });
  if (!refund.ok) {
    log.error("Stripe refund failed after verification", { error: refund.json });
    // The verification itself succeeded; surface the refund problem honestly
    // rather than failing silently.
    return jsonResponse(
      { error: "Verification succeeded but the $1 refund needs attention — contact hello@tailtots.com." },
      502,
    );
  }

  const card = intent.payment_method_details?.card;
  log.info("Parent card verification succeeded", { userId: parent.userId });
  return jsonResponse(
    {
      verified: true,
      verificationId: intent.id,
      brand: card?.brand ?? "card",
      last4: card?.last4 ?? "••••",
      at: new Date().toISOString(),
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// Cloud deletion — COPPA parental right to delete (§312.10).
//
// DELETE /api/family/data — parent JWT required. Deletes the family's child
// data from Supabase: child profiles (cascades to child-linked rows),
// family-scoped snapshots, and the account snapshot blob. Returns a
// per-table report. Tables without a DELETE RLS policy report honestly as
// "denied" — apply supabase/migrations/20261013_delete_policies.sql.
// ---------------------------------------------------------------------------

const deleteDataRateLimiter = new InMemoryRateLimiter(5, 60 * 60 * 1000);

async function restDeleteOk(client: SupabaseRestClient, path: string): Promise<boolean> {
  try {
    const response = await fetch(`${client.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${path}`, {
      method: "DELETE",
      headers: restHeaders(client),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function handleDeleteFamilyData(request: Request, env: Env): Promise<Response> {
  if (deleteDataRateLimiter.isLimited(`delete-data:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return jsonResponse({ error: "Parent sign-in is not configured yet." }, 503);
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
  const rest: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token: token ?? "",
  };

  // Resolve the parent's family.
  const parents = await restGet<{ family_id: string }[]>(
    rest,
    `parents?auth_user_id=eq.${parent.userId}&select=family_id&limit=1`,
  );
  const familyId = parents?.[0]?.family_id;
  if (!familyId) {
    return jsonResponse({ error: "No family found for this parent." }, 404);
  }

  const report: Record<string, string> = {};
  // Delete child profiles first — child-linked rows cascade (on delete
  // cascade) where the schema defines it.
  const childTables: [string, string][] = [
    ["children", `children?family_id=eq.${familyId}`],
    ["family_account_snapshots", `family_account_snapshots?family_id=eq.${familyId}`],
    ["pets", `pets?family_id=eq.${familyId}`],
    ["pet_passports", `pet_passports?family_id=eq.${familyId}`],
    ["flourishing_snapshots", `flourishing_snapshots?family_id=eq.${familyId}`],
    ["blueprint_snapshots", `blueprint_snapshots?family_id=eq.${familyId}`],
    ["mission_generations", `mission_generations?family_id=eq.${familyId}`],
    ["mission_events", `mission_events?family_id=eq.${familyId}`],
    ["pattern_insights", `pattern_insights?family_id=eq.${familyId}`],
    ["difficulty_calibration", `difficulty_calibration?family_id=eq.${familyId}`],
    ["readiness_ratings", `readiness_ratings?family_id=eq.${familyId}`],
  ];
  for (const [name, path] of childTables) {
    const ok = await restDeleteOk(rest, path);
    report[name] = ok ? "deleted" : "denied-or-missing";
  }

  log.info("Parent invoked cloud deletion", { userId: parent.userId, report });
  const failed = Object.entries(report).filter(([, v]) => v !== "deleted");
  return jsonResponse(
    {
      ok: failed.length === 0,
      report,
      note:
        failed.length === 0
          ? "All family child data deleted from the cloud database."
          : "Some tables could not be deleted (likely missing DELETE RLS policy — apply supabase/migrations/20261013_delete_policies.sql).",
    },
    200,
  );
}

/**
 * GET /oauth/alexa/authorize — Alexa account linking, step 1.
 *
 * The parent opens this URL from the Alexa app (in a webview) while signed
 * in to TailTots. Their Supabase access token is validated exactly like on
 * every other parent endpoint; on success we mint a single-use,
 * short-lived authorization code and 302-redirect to Amazon's redirect_uri
 * with ?code=...&state=.... Without a valid session we return 401 — the
 * parent signs in on tailtots.com first, then retries linking.
 */
async function handleAlexaAuthorize(request: Request, env: Env): Promise<Response> {
  if (alexaOauthRateLimiter.isLimited(`oauth-authorize:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (!env.ALEXA_CLIENT_ID) {
    log.warn("ALEXA_CLIENT_ID missing for /oauth/alexa/authorize");
    return jsonResponse({ error: "Alexa account linking is not configured yet." }, 503);
  }
  const parent = await authenticateParentRequest({
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    authorizationHeader: request.headers.get("Authorization"),
  });
  if (!parent) {
    return jsonResponse(
      { error: "Sign in to your TailTots parent account first, then link from the Alexa app." },
      401,
    );
  }
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const issued = issueAuthorizationCode({
    userId: parent.userId,
    responseType: url.searchParams.get("response_type"),
    clientId: url.searchParams.get("client_id"),
    redirectUri,
    expectedClientId: env.ALEXA_CLIENT_ID,
    nowMs: Date.now(),
  });
  if (!issued.ok) {
    // Per RFC 6749 §4.1.2.1 we do NOT redirect error responses to an
    // untrusted redirect_uri — the Alexa app shows the error instead.
    return jsonResponse({ error: "invalid_request", error_description: issued.error }, 400);
  }
  return Response.redirect(buildAuthorizationRedirect(redirectUri as string, issued.code, state), 302);
}

/**
 * POST /oauth/alexa/token — Alexa account linking, step 2.
 *
 * Called server-to-server by Amazon with the authorization code plus the
 * skill's client credentials (form body and/or Basic auth — Amazon uses both
 * styles). On success returns a standard access_token response; the token is
 * an HMAC-signed envelope bound to the parent's Supabase user id.
 */
async function handleAlexaToken(request: Request, env: Env): Promise<Response> {
  if (alexaOauthRateLimiter.isLimited(`oauth-token:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (!env.ALEXA_CLIENT_ID || !env.ALEXA_CLIENT_SECRET || !env.ALEXA_TOKEN_SECRET) {
    log.warn("Alexa OAuth secrets missing for /oauth/alexa/token");
    return jsonResponse({ error: "Alexa account linking is not configured yet." }, 503);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: "invalid_request", error_description: "Expected a form-encoded body." }, 400);
  }
  let clientId = form.get("client_id");
  let clientSecret = form.get("client_secret");
  const basicAuth = request.headers.get("Authorization");
  if (basicAuth && /^Basic\s+/i.test(basicAuth)) {
    try {
      const decoded = atob(basicAuth.replace(/^Basic\s+/i, "").trim());
      const colon = decoded.indexOf(":");
      if (colon > 0) {
        clientId = decoded.slice(0, colon);
        clientSecret = decoded.slice(colon + 1);
      }
    } catch {
      // fall through to client_secret_post validation
    }
  }
  const exchanged = await exchangeAuthorizationCode({
    grantType: typeof form.get("grant_type") === "string" ? (form.get("grant_type") as string) : null,
    code: typeof form.get("code") === "string" ? (form.get("code") as string) : null,
    clientId: typeof clientId === "string" ? clientId : null,
    clientSecret: typeof clientSecret === "string" ? clientSecret : null,
    redirectUri: typeof form.get("redirect_uri") === "string" ? (form.get("redirect_uri") as string) : null,
    expectedClientId: env.ALEXA_CLIENT_ID,
    expectedClientSecret: env.ALEXA_CLIENT_SECRET,
    tokenSecret: env.ALEXA_TOKEN_SECRET,
    nowMs: Date.now(),
  });
  if (!exchanged.ok) {
    const status = exchanged.error === "invalid_client" ? 401 : 400;
    return jsonResponse(
      { error: exchanged.error, error_description: exchanged.errorDescription },
      status,
    );
  }
  return jsonResponse(
    {
      access_token: exchanged.accessToken,
      token_type: exchanged.tokenType,
      expires_in: exchanged.expiresIn,
    },
    200,
  );
}

export interface AlexaFamilySummary {
  kids: Array<{ name: string; streakDays: number; bankCents: number; savedCents: number; givenCents: number }>;
  pendingApprovals: Array<{ title: string; child: string }>;
  todayMissions: Array<{ title: string; child: string; state: string }>;
}

/**
 * GET /api/alexa/family-summary — live family data for the Alexa Lambda.
 *
 * Auth: Bearer <Alexa access token> (the HMAC-signed token from the OAuth
 * exchange). The token is verified here; the family rows are then read
 * through the SECURITY DEFINER RPC get_alexa_family_summary (migration
 * supabase/migrations/20261015_alexa_family_summary.sql), which is the only
 * worker code path allowed to read a family's data without the parent's own
 * Supabase session token.
 */
async function handleAlexaFamilySummary(request: Request, env: Env): Promise<Response> {
  if (alexaSummaryRateLimiter.isLimited(`alexa-summary:${clientIp(request)}`)) {
    return jsonResponse({ error: "Too many attempts. Please try again later." }, 429);
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.ALEXA_TOKEN_SECRET) {
    return jsonResponse({ error: "Alexa account linking is not configured yet." }, 503);
  }
  const token = extractBearerToken(request.headers.get("Authorization"));
  const verified = await verifyAlexaAccessToken(token, env.ALEXA_TOKEN_SECRET, Date.now());
  if (!verified) {
    return jsonResponse({ error: "Link your TailTots account in the Alexa app first." }, 401);
  }
  const client: SupabaseRestClient = {
    supabaseUrl: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    token: env.SUPABASE_ANON_KEY,
  };
  const summary = await restPost<AlexaFamilySummary>(client, "rpc/get_alexa_family_summary", {
    p_user_id: verified.userId,
  });
  if (!summary) {
    log.warn("get_alexa_family_summary RPC failed", { userId: verified.userId });
    return jsonResponse({ error: "Could not load your family's TailTots data right now." }, 502);
  }
  return jsonResponse({ ok: true, ...summary }, 200);
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/voice/intent") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleVoiceIntent(request, env);
    }

    if (url.pathname === "/api/voice/quiz") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleVoiceQuiz(request, env);
    }

    if (url.pathname === "/api/voice/speak") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleVoiceSpeak(request, env);
    }

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

    if (url.pathname === "/api/ai/flow-calibration") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiFlowCalibration(request, env);
    }

    if (url.pathname === "/api/ai/blueprint") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiBlueprint(request, env);
    }

    if (url.pathname === "/api/parent/verify-card") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleParentVerifyCard(request, env);
    }

    if (url.pathname === "/oauth/alexa/authorize") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAlexaAuthorize(request, env);
    }

    if (url.pathname === "/oauth/alexa/token") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAlexaToken(request, env);
    }

    if (url.pathname === "/api/alexa/family-summary") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAlexaFamilySummary(request, env);
    }

    if (url.pathname === "/api/family/data") {
      if (request.method !== "DELETE") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleDeleteFamilyData(request, env);
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

    const response = await handler.fetch(request, env, ctx);
    if (url.pathname.startsWith("/api/")) return response;
    // Baseline security headers on every app/document response (added Oct 15 —
    // the standard-parameter audit found HSTS/CSP/X-Frame-Options all absent).
    const secured = new Response(response.body, response);
    secured.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    secured.headers.set("X-Content-Type-Options", "nosniff");
    secured.headers.set("X-Frame-Options", "SAMEORIGIN");
    secured.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    secured.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://js.stripe.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
    );
    return secured;
  },
};

export default worker;
