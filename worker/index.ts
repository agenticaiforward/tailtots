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
import { InMemoryRateLimiter } from "../lib/ai/rate-limit";
import { authenticateParentRequest } from "../lib/ai/supabase-auth";

const log = createLogger("worker:ai-ideas");
const conversationLog = createLogger("worker:ai-conversation-prompt");
const dailyBoostLog = createLogger("worker:ai-daily-boost");

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
