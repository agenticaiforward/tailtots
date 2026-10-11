/**
 * playdate-voice — turn a spoken "when are you free?" answer into
 * PlaydateQuickCreate time-preset ids.
 *
 * Example: "Saturday morning and Sunday afternoon" -> ["sat-am", "sun-pm"]
 *
 * Kept deliberately small and deterministic: no network, no model,
 * pure keyword matching so it works offline and is easy to test.
 */

const PRESET_IDS = ["sat-am", "sat-pm", "sun-am", "sun-pm", "weekday-pm"] as const;
export type PlaydatePresetId = (typeof PRESET_IDS)[number];

const DAY_PATTERNS: { day: "sat" | "sun" | "weekday"; re: RegExp }[] = [
  { day: "sat", re: /\b(saturday|saturdays|sat\b)/ },
  { day: "sun", re: /\b(sunday|sundays|sun\b)/ },
  {
    day: "weekday",
    re: /\b(weekday|weekdays|monday|tuesday|wednesday|thursday|friday|after school|afterschool)\b/,
  },
];

const MORNING_RE = /\b(morning|mornings|am\b|a\.m\.|breakfast|brunch)\b/;
const AFTERNOON_RE = /\b(afternoon|afternoons|evening|evenings|pm\b|p\.m\.|after lunch|after work)\b/;

/**
 * Parse a speech-recognition transcript into up to 3 playdate preset ids,
 * in the order they were mentioned. Returns [] when nothing matched.
 *
 * Rules:
 * - "Saturday morning" -> sat-am; "Saturday afternoon/evening" -> sat-pm
 * - "Saturday" alone -> both sat-am and sat-pm (the parent can un-tap one)
 * - Same for Sunday.
 * - "Weekday(s)", any Mon–Fri name, or "after school" -> weekday-pm
 * - "Weekend" alone -> sat-am, sat-pm, sun-am (capped at 3 by the caller)
 */
export function parseFreeDates(transcript: string): PlaydatePresetId[] {
  const text = transcript.toLowerCase();
  const out: PlaydatePresetId[] = [];

  const push = (id: PlaydatePresetId) => {
    if (!out.includes(id) && out.length < 3) out.push(id);
  };

  // Collect every day mention in spoken order, then attribute time-of-day
  // words from the text between one mention and the next. This keeps
  // "Saturday morning and Sunday afternoon" mapped to sat-am + sun-pm
  // instead of mixing the time words across days.
  const mentions: { day: "sat" | "sun" | "weekday"; index: number }[] = [];
  for (const { day, re } of DAY_PATTERNS) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      mentions.push({ day, index: m.index });
    }
  }

  if (mentions.length === 0) {
    // "weekend" with no specific day -> offer the weekend windows.
    if (/\bweekends?\b/.test(text)) {
      push("sat-am");
      push("sat-pm");
      push("sun-am");
    }
    return out;
  }

  mentions.sort((a, b) => a.index - b.index);
  mentions.forEach((mention, i) => {
    const next = mentions[i + 1];
    const end = next ? next.index : Math.min(text.length, mention.index + 40);
    const window = text.slice(mention.index, end);
    const saysMorning = MORNING_RE.test(window);
    const saysAfternoon = AFTERNOON_RE.test(window);

    if (mention.day === "weekday") {
      push("weekday-pm");
      return;
    }
    if (saysMorning && !saysAfternoon) {
      push(`${mention.day}-am`);
    } else if (saysAfternoon && !saysMorning) {
      push(`${mention.day}-pm`);
    } else {
      // Day mentioned without a time part -> offer both windows.
      push(`${mention.day}-am`);
      push(`${mention.day}-pm`);
    }
  });

  return out;
}

/** Human-friendly label for a preset id, shared with the quick-create UI. */
export function presetLabel(id: PlaydatePresetId): string {
  switch (id) {
    case "sat-am":
      return "Sat 10am–12pm";
    case "sat-pm":
      return "Sat 2–4pm";
    case "sun-am":
      return "Sun 10am–12pm";
    case "sun-pm":
      return "Sun 2–4pm";
    case "weekday-pm":
      return "Weekday 4–6pm";
  }
}
