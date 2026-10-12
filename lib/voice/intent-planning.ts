/**
 * Shared voice-intent planning helpers.
 *
 * Used by the Cloudflare Worker route (`POST /api/voice/intent`) and
 * unit-tested with vitest. Deliberately avoids `@/` imports so the Worker
 * bundle (which has no path alias) can import this module via relative path.
 *
 * Design: the client sends a speech transcript + a snapshot of what's on
 * screen. The model returns a constrained action plan — never free-form
 * text the client would blindly execute. Every action is validated
 * client-side against real page elements before it runs.
 */

/** One interactive element visible on the page. PII-free by construction. */
export interface VoicePageElement {
  /** Visible label, e.g. "$2", "SAVE jar", "Try a mission free". Max 100 chars. */
  label: string;
  /** What kind of control it is. */
  kind: "button" | "tab" | "input" | "option" | "link";
  /** Current state, e.g. "selected", "disabled", "$6/$20". */
  state?: string;
  /** Nearest section heading, e.g. "Which jar?". Helps disambiguate. */
  group?: string;
}

/** What the AI "sees" when the user speaks. */
export interface VoicePageContext {
  role: "parent" | "child";
  /** Tab id, e.g. "bank". */
  tab: string;
  /** Human tab label, e.g. "Kid Bank". */
  tabLabel: string;
  /** One-line state summary, e.g. "Kid Bank: $3 available, goal Fish tank plant $6/$20". */
  summary: string;
  /** Visible interactive elements, capped at 40. */
  elements: VoicePageElement[];
}

/** One step the client should perform. */
export interface VoicePlannedAction {
  do: "click" | "type" | "navigate" | "quiz";
  /** Exact element label from the context (click/type), tab id (navigate), or quiz topic (quiz). */
  target: string;
  /** For "type": the text to enter. */
  value?: string;
}

/** What the model returns. */
export interface VoiceIntentPlan {
  /** Short spoken confirmation, e.g. "Putting $2 in your SAVE jar." */
  reply: string;
  /** When set, the client speaks this question and listens for a follow-up instead of acting. */
  clarify: string | null;
  /** Steps to execute in order. Empty when clarifying. */
  actions: VoicePlannedAction[];
}

/** Model used for voice intent. Same verified Workers AI model as ideas. */
export const VOICE_INTENT_MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

/** Max transcript / element sizes — keeps prompts small and fast. */
export const VOICE_MAX_TRANSCRIPT_CHARS = 500;
export const VOICE_MAX_ELEMENTS = 40;
export const VOICE_MAX_LABEL_CHARS = 100;

export type VoiceIntentInput =
  | { ok: true; value: { transcript: string; context: VoicePageContext; history: string[] } }
  | { ok: false; error: string };

/** Strictly validate an incoming `/api/voice/intent` JSON body. */
export function validateVoiceIntentInput(body: unknown): VoiceIntentInput {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.transcript !== "string" || !b.transcript.trim()) {
    return { ok: false, error: "transcript must be a non-empty string." };
  }
  const transcript = b.transcript.trim().slice(0, VOICE_MAX_TRANSCRIPT_CHARS);

  if (b.context === null || typeof b.context !== "object" || Array.isArray(b.context)) {
    return { ok: false, error: "context must be an object." };
  }
  const c = b.context as Record<string, unknown>;
  if (c.role !== "parent" && c.role !== "child") {
    return { ok: false, error: "context.role must be parent or child." };
  }
  if (typeof c.tab !== "string" || typeof c.tabLabel !== "string" || typeof c.summary !== "string") {
    return { ok: false, error: "context.tab, tabLabel and summary must be strings." };
  }
  if (!Array.isArray(c.elements)) {
    return { ok: false, error: "context.elements must be an array." };
  }
  const elements: VoicePageElement[] = [];
  for (const raw of c.elements.slice(0, VOICE_MAX_ELEMENTS)) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.label !== "string" || !r.label.trim()) continue;
    const kind = r.kind;
    if (kind !== "button" && kind !== "tab" && kind !== "input" && kind !== "option" && kind !== "link") continue;
    const el: VoicePageElement = {
      label: r.label.trim().slice(0, VOICE_MAX_LABEL_CHARS),
      kind,
    };
    if (typeof r.state === "string" && r.state.trim()) el.state = r.state.trim().slice(0, 60);
    if (typeof r.group === "string" && r.group.trim()) el.group = r.group.trim().slice(0, 60);
    elements.push(el);
  }

  const history: string[] = Array.isArray(b.history)
    ? b.history.filter((h): h is string => typeof h === "string").map((h) => h.slice(0, 200)).slice(-4)
    : [];

  return {
    ok: true,
    value: {
      transcript,
      context: {
        role: c.role,
        tab: c.tab.slice(0, 40),
        tabLabel: c.tabLabel.slice(0, 60),
        summary: c.summary.slice(0, 300),
        elements,
      },
      history,
    },
  };
}

/** Build the Workers AI chat messages for intent planning. */
export function buildVoiceIntentMessages(
  transcript: string,
  context: VoicePageContext,
  history: string[],
): Array<{ role: string; content: string }> {
  const elementLines = context.elements.map((el) => {
    const state = el.state ? ` (${el.state})` : "";
    const group = el.group ? ` [${el.group}]` : "";
    return `- [${el.kind}] "${el.label}"${state}${group}`;
  });

  const historyBlock = history.length
    ? `Recent conversation:\n${history.map((h) => `  ${h}`).join("\n")}\n\n`
    : "";

  return [
    {
      role: "system",
      content:
        "You are the voice-control brain for TailTots, a family app where kids do real-world missions " +
        "and parents guide them. A user spoke a command. The speech transcript may contain recognition " +
        "errors — use the page context to infer what they meant.\n\n" +
        "RULES:\n" +
        "- Tolerate misheard words: \"too dollars\" means \"$2\", \"safe jar\" means \"SAVE jar\", " +
        "\"mission\" vs \"missions\" are the same intent.\n" +
        "- ONLY use element labels from the list below. Never invent labels.\n" +
        "- Break the request into ordered steps using those exact labels.\n" +
        "- \"click\" presses a button/option/tab. \"type\" fills an input (provide \"value\"). " +
        "\"navigate\" switches tabs (target is the tab id).\n" +
        "- \"quiz\" starts a spoken quiz (target is the topic, e.g. \"dinosaurs\"). Use it when the user " +
        "says \"quiz me\", \"test me\", \"ask me questions\" — with or without a topic. " +
        "If no topic is given, target \"animals\".\n" +
        "- If the intent is ambiguous between 2+ visible options, set \"clarify\" to a short spoken " +
        "question and leave \"actions\" empty. Never guess between money jars, children, or pets.\n" +
        "- If the user confirms a previous clarification (\"yes\", \"the save one\"), use the conversation " +
        "history to resolve it.\n" +
        "- For destructive actions (delete, reset, remove), ask for confirmation first via \"clarify\".\n" +
        "- Keep \"reply\" to one short spoken sentence a kid or parent would hear.\n" +
        "- Respond with ONLY the JSON object, no other text.",
    },
    {
      role: "user",
      content:
        `Page: ${context.tabLabel} (${context.role} view)\n` +
        `Summary: ${context.summary}\n` +
        `Interactive elements:\n${elementLines.join("\n") || "(none)"}\n\n` +
        historyBlock +
        `User said: "${transcript}"\n\n` +
        `JSON format:\n` +
        `{"reply": "short spoken confirmation", "clarify": null, "actions": [{"do": "click", "target": "exact label"}]}`,
    },
  ];
}

/** Parse and sanitize the model's JSON response. Returns null when unusable. */
export function parseVoiceIntentResponse(raw: string): VoiceIntentPlan | null {
  if (!raw) return null;
  // Extract the first {...} block in case the model adds prose.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const p = parsed as Record<string, unknown>;

  const reply = typeof p.reply === "string" ? p.reply.slice(0, 200) : "";
  const clarify = typeof p.clarify === "string" && p.clarify.trim() ? p.clarify.trim().slice(0, 200) : null;
  const actions: VoicePlannedAction[] = [];
  if (Array.isArray(p.actions)) {
    for (const rawAction of p.actions.slice(0, 8)) {
      if (rawAction === null || typeof rawAction !== "object" || Array.isArray(rawAction)) continue;
      const a = rawAction as Record<string, unknown>;
      if (a.do !== "click" && a.do !== "type" && a.do !== "navigate" && a.do !== "quiz") continue;
      if (typeof a.target !== "string" || !a.target.trim()) continue;
      const action: VoicePlannedAction = { do: a.do, target: a.target.trim().slice(0, VOICE_MAX_LABEL_CHARS) };
      if (a.do === "type" && typeof a.value === "string") {
        action.value = a.value.slice(0, 200);
      }
      actions.push(action);
    }
  }
  if (!reply && !clarify) return null;
  return { reply, clarify, actions: clarify ? [] : actions };
}
