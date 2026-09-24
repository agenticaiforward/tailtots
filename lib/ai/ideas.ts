/**
 * Parent-facing AI activity-idea helpers.
 *
 * These are pure functions shared by the Cloudflare Worker route
 * (`POST /api/ai/ideas`) and unit-tested with vitest. They deliberately
 * avoid `@/` imports so the Worker bundle (which has no path alias)
 * can import this module via a relative path.
 *
 * NOTE: `IdeaLifeSkill` intentionally mirrors `LifeSkillKey` from
 * `@/lib/domain/family-types`. A type-level assertion in the test file
 * keeps the two in sync.
 */
export type IdeaLifeSkill =
  | "responsibility"
  | "empathy"
  | "teamwork"
  | "leadership"
  | "time";

/** Life skills the parent UI offers for AI-generated activity ideas. */
export const IDEA_LIFE_SKILLS: readonly IdeaLifeSkill[] = [
  "responsibility",
  "empathy",
  "teamwork",
  "leadership",
  "time",
];

/** Age bands the parent UI sends with an idea request. */
export const IDEA_AGE_BANDS = ["4-6", "7-9", "10-12"] as const;
export type IdeaAgeBand = (typeof IDEA_AGE_BANDS)[number];

export interface ActivityIdeaRequest {
  lifeSkill: IdeaLifeSkill;
  childFirstName: string;
  ageBand: IdeaAgeBand;
}

export const MAX_IDEA_NAME_LENGTH = 40;

/**
 * Workers AI model used for parent-facing activity ideas.
 * Verified on the Cloudflare Workers AI free tier (no paid plan needed).
 */
export const IDEAS_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

export type IdeasValidation =
  | { ok: true; value: ActivityIdeaRequest }
  | { ok: false; error: string };

/** Strictly validate an incoming `/api/ai/ideas` JSON body. */
export function validateIdeasInput(body: unknown): IdeasValidation {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  const { lifeSkill, childFirstName, ageBand } = record;

  if (typeof lifeSkill !== "string" || !(IDEA_LIFE_SKILLS as readonly string[]).includes(lifeSkill)) {
    return { ok: false, error: `lifeSkill must be one of: ${IDEA_LIFE_SKILLS.join(", ")}.` };
  }
  if (typeof ageBand !== "string" || !(IDEA_AGE_BANDS as readonly string[]).includes(ageBand)) {
    return { ok: false, error: `ageBand must be one of: ${IDEA_AGE_BANDS.join(", ")}.` };
  }
  if (typeof childFirstName !== "string" || childFirstName.trim().length === 0) {
    return { ok: false, error: "childFirstName must be a non-empty string." };
  }
  const name = childFirstName.trim();
  if (name.length > MAX_IDEA_NAME_LENGTH) {
    return { ok: false, error: `childFirstName must be at most ${MAX_IDEA_NAME_LENGTH} characters.` };
  }
  return {
    ok: true,
    value: {
      lifeSkill: lifeSkill as IdeaLifeSkill,
      childFirstName: name,
      ageBand: ageBand as IdeaAgeBand,
    },
  };
}

/** Derive the request age band from a child's age in years. */
export function ageBandForAge(age: number): IdeaAgeBand {
  if (!Number.isFinite(age) || age <= 6) return "4-6";
  if (age <= 9) return "7-9";
  return "10-12";
}

export interface IdeaChatMessage {
  role: "system" | "user";
  content: string;
}

/**
 * Constrained system prompt: the model helps PARENTS only, suggests brief
 * safe real-world activities, and must output a JSON array of strings.
 */
export function buildIdeasSystemPrompt(): string {
  return [
    "You are a helper for PARENTS (never children) suggesting brief, safe, real-world",
    "activity ideas that help a child build one life skill.",
    "Strict rules:",
    "1. Output ONLY a JSON array of 3-5 short idea strings, each one sentence. No other text.",
    "2. Ideas must be age-appropriate, real-world activities a parent does with their child or",
    "   assigns to them. Never suggest screen-only activities.",
    "3. Never give medical, mental-health, financial, legal, or other professional advice, and",
    "   never diagnose any condition.",
    "4. Never engage in open-ended chat; only output the ideas.",
    "5. Keep every idea kind, concrete, and requiring parent involvement or approval.",
  ].join("\n");
}

/** User message carrying only the minimum fields the privacy policy allows. */
export function buildIdeasUserMessage(input: ActivityIdeaRequest): string {
  return [
    `Life skill: "${input.lifeSkill}".`,
    `Child's first name: ${input.childFirstName}.`,
    `Age band: ${input.ageBand}.`,
    "Suggest 3-5 brief real-world activity ideas. Respond with ONLY a JSON array of strings.",
  ].join(" ");
}

export function buildIdeasMessages(input: ActivityIdeaRequest): IdeaChatMessage[] {
  return [
    { role: "system", content: buildIdeasSystemPrompt() },
    { role: "user", content: buildIdeasUserMessage(input) },
  ];
}

export const MAX_IDEAS_RETURNED = 8;
const MAX_IDEA_LENGTH = 200;

const LIST_MARKER_RE = /^[\s>#"*\-–—\d.)\]]+/;
const TRAILING_QUOTES_RE = /["“”]+$/;

/** Strip list markers/quotes; reports whether a marker was stripped. */
function stripMarker(line: string): { text: string; hadMarker: boolean } {
  const withoutMarker = line.replace(LIST_MARKER_RE, "");
  return {
    text: withoutMarker.replace(TRAILING_QUOTES_RE, "").trim(),
    hadMarker: withoutMarker.length !== line.length,
  };
}

/** Clean one raw idea string; returns null when it is unusable. */
function cleanIdea(raw: string): string | null {
  const { text } = stripMarker(raw);
  if (!text || text.length > MAX_IDEA_LENGTH) return null;
  return text;
}

function ideasFromJson(value: unknown): string[] {
  let list: unknown = null;
  if (Array.isArray(value)) {
    list = value;
  } else if (value !== null && typeof value === "object") {
    const nested = (value as { ideas?: unknown }).ideas;
    if (Array.isArray(nested)) list = nested;
  }
  if (!Array.isArray(list)) return [];
  const ideas: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const cleaned = cleanIdea(item);
    if (cleaned) ideas.push(cleaned);
    if (ideas.length >= MAX_IDEAS_RETURNED) break;
  }
  return ideas;
}

/** Try parsing `text` as JSON, then try to salvage a JSON array/object inside it. */
function tryJsonIdeas(text: string): string[] {
  const candidates = [text];
  for (const pattern of [/\[[\s\S]*?\]/, /\{[\s\S]*?\}/]) {
    const match = pattern.exec(text);
    if (match) candidates.push(match[0]);
  }
  for (const candidate of candidates) {
    try {
      const ideas = ideasFromJson(JSON.parse(candidate) as unknown);
      if (ideas.length) return ideas;
    } catch {
      // Not JSON — try the next candidate.
    }
  }
  return [];
}

/**
 * Parse the model's raw text into a list of idea strings.
 * Accepts a JSON array of strings (or `{ "ideas": [...] }`), salvages JSON
 * embedded in prose, and falls back to list-marked lines. Returns [] when
 * nothing usable is found.
 */
export function parseIdeasResponse(raw: string): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const text = raw.trim();

  const jsonIdeas = tryJsonIdeas(text);
  if (jsonIdeas.length) return jsonIdeas;

  // Line fallback: only lines that look like list items count, so prose
  // or garbage never becomes an "idea".
  const ideas: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const { text: cleaned, hadMarker } = stripMarker(line);
    if (!hadMarker || !cleaned || cleaned.length > MAX_IDEA_LENGTH) continue;
    ideas.push(cleaned);
    if (ideas.length >= MAX_IDEAS_RETURNED) break;
  }
  return ideas;
}
