/**
 * Local voice intent parser — fast, private, no model call.
 *
 * Handles the deterministic kid-loop intents (hear missions, hear points,
 * finish a mission, move jar money, approve, news) plus navigation and
 * real-life logging. Anything else returns `unknown` and the AI planner
 * (lib/voice/intent-planning.ts) takes a turn.
 *
 * Design rules for ADHD/autistic kids:
 * - The most natural phrasings must work: "I did it", "mission done",
 *   "I'm done" all mean complete-mission.
 * - Money and completion intents are resolved + confirmed by the caller —
 *   this parser never guesses which mission when several are open.
 */

export type VoiceJar = "save" | "spend" | "give";

export type VoiceAction =
  | { type: "navigate"; tab: string }
  | { type: "log-book"; title: string }
  | { type: "log-chore"; title: string }
  | { type: "log-kind"; title: string }
  | { type: "log-skill"; title: string }
  | { type: "read-page" }
  | { type: "read-missions" }
  | { type: "read-balance" }
  | { type: "read-news" }
  | { type: "complete-mission"; query: string }
  | { type: "complete-mission-id"; id: string }
  | { type: "allocate-jar"; jar: VoiceJar; amount: number }
  | { type: "approve-mission"; query: string }
  | { type: "approve-mission-id"; id: string }
  | { type: "quiz-complete"; topic: string; correct: number; total: number }
  | { type: "log-reflection"; title: string; detail: string }
  | { type: "log-parent-checkin"; win: string; worry: string; practice: string }
  | { type: "prefill-setup"; familyName: string; kidName: string; kidAge: number; petName: string; petKind: string }
  | { type: "click"; label: string }
  | { type: "unknown"; text: string };

/** Intents the VoiceAssistant resolves locally even when the AI planner is
 *  reachable — the kid loop must behave identically online and offline. */
export const LOCAL_FIRST_TYPES: ReadonlySet<VoiceAction["type"]> = new Set([
  "read-missions",
  "read-balance",
  "read-news",
  "complete-mission",
  "allocate-jar",
  "approve-mission",
]);

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Strip the filler sounds kids (and grown-ups) pepper speech with —
 * um, uh, erm, hmm — plus stuttered repeats of little words ("the the",
 * "I I"), so intent matching and the on-screen "I heard" echo show what
 * was MEANT, not every sound along the way (founder, 2026-10-16).
 * "like" is left alone — it's a real verb too often to strip safely.
 */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\b(?:um+|uh+|erm+|er|hmm+|uhm+)\b/gi, " ")
    .replace(/\b(the|a|an|i|you|it|is|to|and|my|me|do|can|what|is)\s+(?=\1\b)/gi, "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.!?]+/, "")
    .trim();
}

const JAR_WORDS: Record<string, VoiceJar> = {
  save: "save",
  saving: "save",
  savings: "save",
  spend: "spend",
  spending: "spend",
  give: "give",
  giving: "give",
  donate: "give",
  donation: "give",
};

export function parseVoiceIntent(text: string): VoiceAction {
  const t = cleanTranscript(text).toLowerCase().trim().replace(/[.!?]+$/, "");

  // --- Kid-loop reads (before navigation: "show my missions" is a read) ---
  if (/\b(any|some)\s+news\b/.test(t) || /what'?s new/.test(t) || t === "news") {
    return { type: "read-news" };
  }
  if (
    /(what|read|list|tell me|say)\b[^.]*\b(missions?|to do|tasks?)\b/.test(t) ||
    /\bmy missions\b/.test(t) ||
    /what (do i|should i) (do|have) today/.test(t) ||
    /what'?s on my list/.test(t)
  ) {
    return { type: "read-missions" };
  }
  if (
    /how many points/.test(t) ||
    /\bmy (points|balance|coins)\b/.test(t) ||
    /points do i have/.test(t) ||
    /how much (money|points|coins)/.test(t)
  ) {
    return { type: "read-balance" };
  }

  // --- Jar allocation: "put $2 in the save jar", "move 3 dollars to give" ---
  const jarMatch = t.match(
    /(?:put|move|add|place)\s+\$?\s*(\d+)\s*(?:dollars?|points?|coins?)?\s*(?:in|into|to)\s+(?:the\s+)?(save|saving|savings|spend|spending|give|giving|donate|donation)(?:\s+jar)?/,
  );
  if (jarMatch) {
    const amount = Number(jarMatch[1]);
    const jar = JAR_WORDS[jarMatch[2]];
    if (jar && amount > 0) return { type: "allocate-jar", jar, amount };
  }

  // --- Parent approval: "approve feed the dog", "approve it", "approve" ---
  if (/^approve\b/.test(t) || /^yes approve\b/.test(t)) {
    const q = t.replace(/^yes\s+/, "").replace(/^approve\s*(the\s+)?(mission\s+)?/, "").trim();
    return { type: "approve-mission", query: q === "it" ? "" : q };
  }

  // --- Mission completion, natural phrasings first ---
  if (/^(i did it|did it|i'?m done|all done|done|mission done|i finished it|finished it|i did the mission|that'?s done)$/.test(t)) {
    return { type: "complete-mission", query: "" };
  }
  const markDone = t.match(/^(?:mark|i finished|i completed|finish|complete)\s+(.+?)(?:\s+done)?$/);
  if (markDone && !/(reading|read)\b/.test(t)) {
    const q = markDone[1].replace(/^the\s+/, "").replace(/\s+mission$/, "").trim();
    if (q && q !== "it") return { type: "complete-mission", query: q };
    if (q === "it") return { type: "complete-mission", query: "" };
  }

  // Click / tap / press / select a button or element by its visible label
  const clickMatch = t.match(/^(?:click|tap|press|hit|select|choose|pick)\s+(?:the\s+)?(.+)$/);
  if (clickMatch) {
    const label = clickMatch[1]
      .replace(/^(button|link|tab|option)\s+/, "")
      .replace(/\s+(button|link|tab|option)$/, "")
      .trim();
    if (label && !/^(to|on)\s/.test(label)) {
      const isNav = /^(missions|growth|approvals|setup|schedule|pets|bank|neighborhood|village|home|plan)\b/.test(label)
        && /(go|open|show)/.test(t);
      if (!isNav) return { type: "click", label };
    }
  }

  // Navigation
  const tabs: Record<string, string[]> = {
    missions: ["mission", "today", "tasks"],
    growth: ["growth", "progress", "character"],
    approvals: ["approval", "review", "high-five", "high five"],
    setup: ["setup", "settings", "family setup"],
    schedule: ["schedule", "calendar", "my day"],
    pets: ["pet", "pets"],
    bank: ["bank", "money", "coins"],
    neighborhood: ["neighborhood", "hood", "community"],
    village: ["village"],
    vision: ["home", "household", "dashboard"],
    plan: ["plan", "planner", "events", "week", "month"],
  };
  for (const [tab, keywords] of Object.entries(tabs)) {
    if (keywords.some((k) => t.includes(k)) && /(go|open|show|take|switch)/.test(t)) {
      return { type: "navigate", tab };
    }
  }

  // Real-life logging — titles are extracted from the CLEANED text so a
  // book keeps its real capitalization ("Harry Potter", not "Harry potter").
  const raw = cleanTranscript(text).replace(/[.!?]+$/, "");
  const bookMatch = raw.match(/(?:i read|read|finished reading|book)\s+(.+)/i);
  if (bookMatch && /(read|book|finished)/.test(t)) {
    const title = bookMatch[1].replace(/^(called|titled)\s+/i, "").trim();
    // "read this page" is the read-aloud command, not a book called "This page".
    if (title && !/^(this|the)\s+page$/i.test(title) && !/^page$/i.test(title)) {
      return { type: "log-book", title: capitalize(title) };
    }
  }
  const choreMatch = raw.match(/(?:i did|did|finished|completed?)\s+(?:a\s+)?(?:chore\s+)?(.+?)(?:\s+chore)?$/i);
  if (/(chore|did|cleaned|folded|washed|helped)/.test(t) && choreMatch) {
    const title = choreMatch[1].trim();
    if (title && title.length > 2) return { type: "log-chore", title: capitalize(title) };
  }
  if (/(kind|helped|shared|nice)/.test(t) && /(i was|i helped|i shared)/.test(t)) {
    return { type: "log-kind", title: capitalize(raw.replace(/^i\s+/i, "")) };
  }
  if (/(practic)/.test(t)) {
    const m = raw.match(/practic(?:e|ed|ing)\s+(.+)/i);
    if (m) return { type: "log-skill", title: capitalize(m[1].trim()) };
  }

  // Read aloud
  if (/(read|tell me|say).*(page|this|aloud)/.test(t)) {
    return { type: "read-page" };
  }

  // Complete mission (generic fallback phrasing)
  if (/(done|complete|finished|mark).*(mission|it)/.test(t)) {
    const m = t.match(/(?:mission\s+)?(?:called\s+)?["']?(.+?)["']?\s*$/);
    return { type: "complete-mission", query: m?.[1]?.trim() ?? "" };
  }

  return { type: "unknown", text };
}
