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
import { InMemoryRateLimiter } from "../lib/ai/rate-limit";
import { authenticateParentRequest } from "../lib/ai/supabase-auth";

const log = createLogger("worker:ai-ideas");

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

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai/ideas") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleAiIdeas(request, env);
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
