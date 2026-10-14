/**
 * Page-context snapshot — the voice AI's "eyes".
 *
 * Walks the visible DOM and collects interactive elements (buttons, tabs,
 * inputs, options) with their labels and current state, so the AI planner
 * knows what the user can see and do right now.
 *
 * PII-free by construction: only UI labels and control state are captured.
 * Kid names, photo URLs, personal data, and input contents are never included
 * (filled inputs are reported as a presence flag, never their value).
 */
import type { VoicePageContext, VoicePageElement } from "./intent-planning";
import { VOICE_MAX_ELEMENTS, VOICE_MAX_LABEL_CHARS } from "./intent-planning";

/** Clean visible text for an element. */
function elementLabel(el: HTMLElement): string {
  const text = (
    el.getAttribute("aria-label") ||
    el.innerText ||
    el.getAttribute("title") ||
    el.getAttribute("placeholder") ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, VOICE_MAX_LABEL_CHARS);
}

/** Find the nearest section heading to group the element, e.g. "Which jar?". */
function elementGroup(el: HTMLElement): string | undefined {
  const section = el.closest("section, article, [role='region'], [role='tabpanel']");
  if (!section) return undefined;
  const heading = section.querySelector("h1, h2, h3, h4");
  if (!heading || heading === el) return undefined;
  const text = (heading.textContent || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 60) : undefined;
}

/** Find the nearest card/article heading that names what an element belongs
 *  to — e.g. three mission cards each have a "Mark done" button; the card's
 *  own title ("Feed the dog") is what tells the AI (and the kid) which one
 *  a click would hit. */
function elementCardHeading(el: HTMLElement): string | undefined {
  let node: HTMLElement | null = el.parentElement;
  for (let depth = 0; depth < 6 && node; depth++) {
    const heading = node.querySelector("h1, h2, h3, h4");
    if (heading && heading !== el && !el.contains(heading)) {
      const text = (heading.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length > 2) return text.slice(0, 40);
    }
    node = node.parentElement;
  }
  return undefined;
}

/** Describe the element's current state for the AI. */
function elementState(el: HTMLElement): string | undefined {
  const states: string[] = [];
  if ((el as HTMLButtonElement).disabled) states.push("disabled");
  if (el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true") {
    states.push("selected");
  }
  // Visually-selected options (Tailwind ring / bg highlight heuristics)
  const cls = el.className || "";
  if (typeof cls === "string" && /ring-2|bg-tt-pine|bg-blue-600/.test(cls) && el.tagName === "BUTTON") {
    // Only flag as selected when it also looks like a choice chip
    if (el.closest("[role='radiogroup'], [role='listbox']") || /jar|\\$/.test(elementLabel(el))) {
      states.push("selected");
    }
  }
  if (el instanceof HTMLInputElement && el.value) {
    // COPPA minimization: input contents can hold a child's typed words
    // (e.g. a name). The planner only needs to know a field exists and is
    // filled — never what it contains. Send a presence flag, not the value.
    states.push(el.type === "password" ? "filled" : "has text");
  }
  return states.length ? states.join(", ") : undefined;
}

function elementKind(el: HTMLElement): VoicePageElement["kind"] {
  const role = el.getAttribute("role");
  if (role === "tab") return "tab";
  if (el.tagName === "A") return "link";
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return "input";
  if (role === "option" || role === "radio" || el.getAttribute("aria-pressed") !== null) return "option";
  return "button";
}

/**
 * Snapshot the current page for the voice AI.
 * Call right after the user finishes speaking.
 */
export function snapshotPageContext(opts: {
  role: "parent" | "child";
  tab: string;
  tabLabel: string;
  summary: string;
}): VoicePageContext {
  const elements: VoicePageElement[] = [];
  const seen = new Set<string>();

  const candidates = document.querySelectorAll<HTMLElement>(
    'button, a[href], input, textarea, select, [role="button"], [role="tab"], [role="option"], summary'
  );

  candidates.forEach((el) => {
    if (elements.length >= VOICE_MAX_ELEMENTS) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // hidden
    // Skip the voice assistant's own floating button/panel
    if (el.closest("[data-voice-assistant]")) return;

    const label = elementLabel(el);
    if (!label || label.length < 1) return;
    // Skip icon-only mystery buttons the AI can't describe
    if (label.length <= 2 && !/[$€£\d]/.test(label)) return;

    const kind = elementKind(el);
    const key = `${kind}:${label}`;
    let finalLabel = label;
    if (seen.has(key)) {
      // Duplicate labels are the #1 cause of wrong clicks ("Mark done" on
      // every mission card). Qualify with the owning card's title so each
      // button stays individually targetable; drop only true duplicates.
      const card = elementCardHeading(el);
      if (!card) return;
      finalLabel = `${label} — ${card}`;
      const qualifiedKey = `${kind}:${finalLabel}`;
      if (seen.has(qualifiedKey)) return;
      seen.add(qualifiedKey);
    } else {
      seen.add(key);
    }

    const entry: VoicePageElement = { label: finalLabel, kind };
    const state = elementState(el);
    if (state) entry.state = state;
    const group = elementGroup(el);
    if (group) entry.group = group;
    elements.push(entry);
  });

  return {
    role: opts.role,
    tab: opts.tab,
    tabLabel: opts.tabLabel,
    summary: opts.summary.slice(0, 300),
    elements,
  };
}
