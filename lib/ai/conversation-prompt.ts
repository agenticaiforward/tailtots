/**
 * "Ask your kid with AI": parent-facing conversation-prompt helpers.
 *
 * These are pure functions shared by the Cloudflare Worker route
 * (`POST /api/ai/conversation-prompt`) and the parent-side client fetch,
 * unit-tested with vitest. They deliberately avoid `@/` imports so the
 * Worker bundle (which has no path alias) can import this module via a
 * relative path.
 *
 * Safety framing (non-negotiable): the AI writes ONE predefined conversation
 * prompt for the PARENT to ask the kid — there is no open chat, and the kid
 * UI never changes. The model only ever sees a character topic and a coarse
 * age band — never a child's name or any other kid PII.
 */
import { IDEA_AGE_BANDS, type IdeaAgeBand } from "./ideas";

/** Character topics the parent UI offers for AI-written conversation prompts. */
export const CONVERSATION_TOPICS = [
  "kindness",
  "patience",
  "honesty",
  "responsibility",
] as const;
export type ConversationTopic = (typeof CONVERSATION_TOPICS)[number];

export interface ConversationPromptRequest {
  topic: ConversationTopic;
  ageBand: IdeaAgeBand;
}

/**
 * Workers AI model used for parent-facing conversation prompts.
 * Verified on the Cloudflare Workers AI free tier (no paid plan needed).
 */
export const CONVERSATION_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export type ConversationPromptValidation =
  | { ok: true; value: ConversationPromptRequest }
  | { ok: false; error: string };

/** Strictly validate an incoming `/api/ai/conversation-prompt` JSON body. */
export function validateConversationPromptInput(body: unknown): ConversationPromptValidation {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  // Kids-data rule: the AI endpoint is parent-side only. It accepts the
  // character topic and a coarse age band — never a child's name or any
  // other kid PII. Extra fields are ignored.
  const { topic, ageBand } = record;

  if (typeof topic !== "string" || !(CONVERSATION_TOPICS as readonly string[]).includes(topic)) {
    return { ok: false, error: `topic must be one of: ${CONVERSATION_TOPICS.join(", ")}.` };
  }
  if (typeof ageBand !== "string" || !(IDEA_AGE_BANDS as readonly string[]).includes(ageBand)) {
    return { ok: false, error: `ageBand must be one of: ${IDEA_AGE_BANDS.join(", ")}.` };
  }
  return {
    ok: true,
    value: {
      topic: topic as ConversationTopic,
      ageBand: ageBand as IdeaAgeBand,
    },
  };
}

export interface PromptChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Constrained system prompt: the model helps PARENTS only, writes ONE
 * predefined conversation prompt (no open chat), and outputs only the
 * prompt text itself.
 */
export function buildConversationPromptSystemPrompt(): string {
  return [
    "You are a helper for PARENTS (never children). Write ONE short conversation",
    "prompt a parent can ask their child tonight to spark a warm, real conversation",
    "about one character topic.",
    "Strict rules:",
    "1. Output ONLY the prompt text itself — one or two sentences, phrased as a",
    "   question the parent asks the child. No other text, no quotes, no labels.",
    "2. The prompt must be kind, concrete, and age-appropriate — about real life,",
    "   never screen-only. It invites the child to reflect and share",
    '   (e.g. "Tell me about a time..."), never lectures or tests.',
    "3. Never give medical, mental-health, financial, legal, or other professional",
    "   advice, and never diagnose any condition.",
    "4. Never engage in open-ended chat; only output the single prompt.",
  ].join("\n");
}

/** User message carrying only the minimum fields the privacy policy allows. */
export function buildConversationPromptUserMessage(input: ConversationPromptRequest): string {
  return [
    `Topic: "${input.topic}".`,
    `Age band: ${input.ageBand}.`,
    "Write ONE conversation prompt. Respond with ONLY the prompt text.",
  ].join(" ");
}

export function buildConversationPromptMessages(input: ConversationPromptRequest): PromptChatMessage[] {
  return [
    { role: "system", content: buildConversationPromptSystemPrompt() },
    { role: "user", content: buildConversationPromptUserMessage(input) },
  ];
}

const MAX_PROMPT_LENGTH = 280;
const LEADING_JUNK_RE = /^[\s>#"*\-–—\d.)\]]+/;
const WRAPPING_QUOTES_RE = /^["“”']+|["“”']+$/g;

/**
 * Parse the model's raw text into a single conversation prompt string.
 * Accepts plain prompt text or a JSON-wrapped string, keeps only the first
 * paragraph, strips quotes/markers, and returns null when nothing usable
 * (empty or over the length cap) is found.
 */
export function parseConversationPromptResponse(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let text = raw.trim();
  if (!text) return null;
  // Salvage: if the model wrapped the prompt in JSON, pull the string out.
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      const candidate = Array.isArray(parsed)
        ? parsed[0]
        : (parsed as { prompt?: unknown } | null)?.prompt;
      if (typeof candidate === "string" && candidate.trim()) {
        text = candidate.trim();
      }
    } catch {
      // Not JSON — fall through to raw-text handling.
    }
  }
  const firstParagraph = text.split(/\r?\n/)[0]?.trim() ?? "";
  const cleaned = firstParagraph
    .replace(LEADING_JUNK_RE, "")
    .replace(WRAPPING_QUOTES_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > MAX_PROMPT_LENGTH) return null;
  return cleaned;
}

export interface FetchConversationPromptOptions {
  /** Injected in tests; defaults to the global fetch at runtime. */
  fetchFn?: typeof fetch;
  /** Parent Supabase access token (Bearer). Missing token => no attempt. */
  token: string | null;
  topic: string;
  ageBand: IdeaAgeBand;
  /** Override in tests; defaults to the Worker route. */
  endpoint?: string;
}

export type FetchConversationPromptResult =
  | { ok: true; prompt: string }
  | { ok: false };

/**
 * Parent-side fetch for a genuinely AI-written conversation prompt.
 * Resolves `{ ok: true, prompt }` only when the backend returns a usable
 * prompt; any failure (signed out, non-OK status, bad payload, network
 * error) resolves `{ ok: false }` so the caller can use the honest
 * locally-generated fallback instead. Pure apart from the injected fetch,
 * so the fallback paths are unit-testable.
 */
export async function fetchConversationPrompt(
  options: FetchConversationPromptOptions,
): Promise<FetchConversationPromptResult> {
  const {
    fetchFn = fetch,
    token,
    topic,
    ageBand,
    endpoint = "/api/ai/conversation-prompt",
  } = options;
  if (!token) return { ok: false };
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      // Kids-data rule: the AI is parent-side only. Send the topic and a
      // coarse age band — never a child's name or any other kid PII.
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ topic, ageBand }),
    });
    let data: { prompt?: unknown } | null = null;
    try {
      data = (await response.json()) as { prompt?: unknown } | null;
    } catch {
      data = null;
    }
    const prompt =
      typeof data?.prompt === "string" ? parseConversationPromptResponse(data.prompt) : null;
    if (!response.ok || !prompt) return { ok: false };
    return { ok: true, prompt };
  } catch {
    return { ok: false };
  }
}
