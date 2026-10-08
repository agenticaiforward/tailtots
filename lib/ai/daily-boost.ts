/**
 * Daily buddy boost: genuinely AI-generated "question + tiny mission +
 * encouragement" for the kid's AI Buddy panel.
 *
 * Architecture (safety-first):
 * - The AI call is PARENT-side only: the top-level app fetches today's boost
 *   once per day when a parent Supabase session exists, then caches it in
 *   localStorage keyed by date. The kid UI only ever reads the cached value —
 *   predefined content, no open chat, exactly as the site promises.
 * - The request carries no kid PII: only the date, a coarse age band, and the
 *   parent-set buddy categories (parent config, not kid data).
 * - The kid panel gates every boost item against the parent's
 *   `aiBuddyCategories` setting; any item outside the allowed categories
 *   falls back to the local date-rotation content.
 *
 * These helpers are worker-safe (no `@/` imports) so the Cloudflare Worker
 * route (`POST /api/ai/daily-boost`) and the client share validation,
 * prompts, parsing, and cache logic. Unit-tested with vitest.
 */
import { IDEA_AGE_BANDS, type IdeaAgeBand } from "./ideas";

/**
 * Parent-set AI Buddy question categories. Must stay in sync with the
 * `aiBuddyCategories` defaults in `TailTotsApp` (Family Setup lets the
 * parent change which of these the kid may see).
 */
export const BUDDY_BOOST_CATEGORIES = [
  "Pet care",
  "Chores & routine",
  "Kindness & feelings",
  "Money & saving",
] as const;
export type BuddyBoostCategory = (typeof BUDDY_BOOST_CATEGORIES)[number];

/**
 * Workers AI model used for the daily buddy boost.
 * Verified on the Cloudflare Workers AI free tier (no paid plan needed).
 */
export const DAILY_BOOST_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

/** localStorage prefix for the per-day cached boost. */
export const DAILY_BOOST_CACHE_PREFIX = "tailtots-daily-boost-v1";

export interface DailyBoostContent {
  question: string;
  questionCategory: string;
  mission: string;
  missionCategory: string;
  encouragement: string;
  encouragementCategory: string;
}

/** The cached shape: content plus the local date it was generated for. */
export interface CachedDailyBoost extends DailyBoostContent {
  date: string; // local YYYY-MM-DD
}

export interface DailyBoostRequest {
  date: string; // local YYYY-MM-DD
  ageBand: IdeaAgeBand;
  categories: string[];
}

export type DailyBoostValidation =
  | { ok: true; value: DailyBoostRequest }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strictly validate an incoming `/api/ai/daily-boost` JSON body. */
export function validateDailyBoostInput(body: unknown): DailyBoostValidation {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  // Kids-data rule: the AI endpoint is parent-side only. It accepts the
  // date, a coarse age band, and the parent-set categories — never a child's
  // name or any other kid PII. Extra fields are ignored.
  const { date, ageBand, categories } = record;

  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return { ok: false, error: "date must be a local date in YYYY-MM-DD format." };
  }
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "date is not a real calendar date." };
  }
  if (typeof ageBand !== "string" || !(IDEA_AGE_BANDS as readonly string[]).includes(ageBand)) {
    return { ok: false, error: `ageBand must be one of: ${IDEA_AGE_BANDS.join(", ")}.` };
  }
  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    !categories.every(
      (item): item is string =>
        typeof item === "string" && (BUDDY_BOOST_CATEGORIES as readonly string[]).includes(item),
    )
  ) {
    return {
      ok: false,
      error: `categories must be a non-empty array of: ${BUDDY_BOOST_CATEGORIES.join(", ")}.`,
    };
  }
  return {
    ok: true,
    value: {
      date,
      ageBand: ageBand as IdeaAgeBand,
      // De-dupe so the prompt lists each category once.
      categories: [...new Set(categories)],
    },
  };
}

export interface BoostChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Constrained system prompt: the model writes predefined daily content for
 * a kid-safe buddy (never chats with the child), tags every item with one of
 * the parent-allowed categories, and outputs ONLY the JSON object.
 */
export function buildDailyBoostSystemPrompt(allowedCategories: readonly string[]): string {
  return [
    "You are writing predefined daily content for a kid-safe AI buddy in a family app.",
    "A PARENT reviews and approves these categories; you never chat with the child.",
    "Output ONLY a JSON object with exactly these keys: \"question\", \"questionCategory\",",
    "\"mission\", \"missionCategory\", \"encouragement\", \"encouragementCategory\".",
    "Strict rules:",
    "1. \"question\": one short question of the day for the child, tied to its category.",
    "2. \"mission\": one tiny real-world mission (under 2 minutes) the child does with or",
    "   for the family, requiring parent involvement or approval.",
    "3. \"encouragement\": one warm, one-sentence encouragement.",
    "4. Every category value must be one of: " +
      allowedCategories.map((category) => `"${category}"`).join(", ") +
      ". Never invent a category.",
    "5. Age-appropriate, kind, concrete. Never suggest screen-only activities.",
    "6. Never give medical, mental-health, financial, legal, or other professional",
    "   advice, and never diagnose any condition.",
    "7. Never engage in open-ended chat; only output the JSON object.",
  ].join("\n");
}

/** User message carrying only the minimum fields the privacy policy allows. */
export function buildDailyBoostUserMessage(input: DailyBoostRequest): string {
  return [
    `Date: ${input.date}.`,
    `Age band: ${input.ageBand}.`,
    `Allowed categories: ${input.categories.map((category) => `"${category}"`).join(", ")}.`,
    "Write today's buddy boost. Respond with ONLY the JSON object.",
  ].join(" ");
}

export function buildDailyBoostMessages(input: DailyBoostRequest): BoostChatMessage[] {
  return [
    { role: "system", content: buildDailyBoostSystemPrompt(input.categories) },
    { role: "user", content: buildDailyBoostUserMessage(input) },
  ];
}

const MAX_QUESTION_LENGTH = 220;
const MAX_MISSION_LENGTH = 220;
const MAX_ENCOURAGEMENT_LENGTH = 160;

function cleanSlot(raw: unknown, maxLength: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength) return null;
  return text;
}

function cleanCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return (BUDDY_BOOST_CATEGORIES as readonly string[]).includes(text) ? text : null;
}

function boostFromObject(value: unknown): DailyBoostContent | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const question = cleanSlot(record.question, MAX_QUESTION_LENGTH);
  const mission = cleanSlot(record.mission, MAX_MISSION_LENGTH);
  const encouragement = cleanSlot(record.encouragement, MAX_ENCOURAGEMENT_LENGTH);
  const questionCategory = cleanCategory(record.questionCategory);
  const missionCategory = cleanCategory(record.missionCategory);
  const encouragementCategory = cleanCategory(record.encouragementCategory);
  if (
    !question ||
    !mission ||
    !encouragement ||
    !questionCategory ||
    !missionCategory ||
    !encouragementCategory
  ) {
    return null;
  }
  return { question, questionCategory, mission, missionCategory, encouragement, encouragementCategory };
}

/**
 * Parse the model's raw text into daily-boost content. Accepts a JSON object
 * (or one salvaged from surrounding prose); returns null when the payload
 * is missing fields, uses an unlisted category, or exceeds length caps.
 */
export function parseDailyBoostResponse(raw: string): DailyBoostContent | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const text = raw.trim();
  const candidates: string[] = [text];
  const salvage = /\{[\s\S]*?\}/.exec(text);
  if (salvage) candidates.push(salvage[0]);
  for (const candidate of candidates) {
    try {
      const boost = boostFromObject(JSON.parse(candidate) as unknown);
      if (boost) return boost;
    } catch {
      // Not JSON — try the next candidate.
    }
  }
  return null;
}

/**
 * Client-side shape check for a cached (or just-fetched) boost: all six
 * content fields present, non-empty, within length caps, categories on the
 * allowlist, and a real YYYY-MM-DD date.
 */
export function isValidDailyBoost(value: unknown): value is CachedDailyBoost {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.date !== "string" || !DATE_RE.test(record.date)) return false;
  return boostFromObject(record) !== null;
}

/** Local YYYY-MM-DD for "today" (matches the app's existing todayKey style). */
export function todayLocalDateKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

/** localStorage key for one day's cached boost. */
export function dailyBoostCacheKey(dateKey: string): string {
  return `${DAILY_BOOST_CACHE_PREFIX}:${dateKey}`;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Read a cached boost. Returns null when nothing is cached, the payload is
 * malformed, or it was cached for a different date (stale boosts never show).
 */
export function readDailyBoostCache(key: string, expectedDate: string): CachedDailyBoost | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDailyBoost(parsed)) return null;
    if (parsed.date !== expectedDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist one day's boost; no-ops when storage is unavailable. */
export function writeDailyBoostCache(key: string, boost: CachedDailyBoost): void {
  const store = storage();
  if (!store || !isValidDailyBoost(boost)) return;
  try {
    store.setItem(key, JSON.stringify(boost));
  } catch {
    // Storage full or blocked: the in-memory value still renders this session.
  }
}

export type DailyBoostSlot = "question" | "mission" | "encouragement";

const SLOT_CATEGORY: Record<DailyBoostSlot, "questionCategory" | "missionCategory" | "encouragementCategory"> = {
  question: "questionCategory",
  mission: "missionCategory",
  encouragement: "encouragementCategory",
};

/**
 * Parent-category gate for one boost item: returns the AI-written text when
 * a valid boost exists AND its category is in the parent's allowed list;
 * returns null otherwise so the caller can fall back to local content.
 * The kid UI never renders an item the parent didn't allow.
 */
export function gatedBoostSlot(
  boost: CachedDailyBoost | null,
  allowedCategories: string[],
  slot: DailyBoostSlot,
): string | null {
  if (!boost || !isValidDailyBoost(boost)) return null;
  const category = boost[SLOT_CATEGORY[slot]];
  if (!allowedCategories.includes(category)) return null;
  return boost[slot];
}

export interface FetchDailyBoostOptions {
  /** Injected in tests; defaults to the global fetch at runtime. */
  fetchFn?: typeof fetch;
  /** Parent Supabase access token (Bearer). Missing token => no attempt. */
  token: string | null;
  date: string; // local YYYY-MM-DD
  ageBand: IdeaAgeBand;
  /** Parent-set buddy categories (parent config, not kid PII). */
  categories: string[];
  /** Override in tests; defaults to the Worker route. */
  endpoint?: string;
}

/**
 * Parent-side fetch for today's genuinely AI-generated buddy boost.
 * Resolves the boost only when the backend returns a valid, category-safe
 * payload; any failure (signed out, non-OK status, bad payload, network
 * error) resolves null so the caller keeps the local date-rotation fallback.
 * Pure apart from the injected fetch, so the fallback paths are unit-testable.
 */
export async function fetchDailyBoost(
  options: FetchDailyBoostOptions,
): Promise<CachedDailyBoost | null> {
  const {
    fetchFn = fetch,
    token,
    date,
    ageBand,
    categories,
    endpoint = "/api/ai/daily-boost",
  } = options;
  if (!token) return null;
  try {
    const response = await fetchFn(endpoint, {
      method: "POST",
      // Kids-data rule: the AI is parent-side only. Send the date, a coarse
      // age band, and parent-set categories — never a child's name or any
      // other kid PII.
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, ageBand, categories }),
    });
    let data: unknown = null;
    try {
      data = (await response.json()) as unknown;
    } catch {
      data = null;
    }
    if (!response.ok || !isValidDailyBoost(data)) return null;
    return data;
  } catch {
    return null;
  }
}
