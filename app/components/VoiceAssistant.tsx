/**
 * VoiceAssistant — listen + speak + do things on any page, powered by AI.
 *
 * Floating mic button, always available:
 * - TAP: starts listening (speech-to-text). Speak naturally — "go to missions",
 *   "I read Charlotte's Web", "mark my mission done", "read this page to me".
 * - AI interprets the intent and DOES it: navigates, logs real-life entries,
 *   completes missions, or reads content aloud (text-to-speech).
 * - Kids get a friendly voice; parents get quick hands-free control.
 *
 * Uses the browser Web Speech API (no server round-trip for STT/TTS).
 * Intent parsing is local-first (fast, private); complex asks fall back to
 * a clarifying prompt.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { snapshotPageContext } from "@/lib/voice/page-context";
import type { VoiceIntentPlan, VoicePlannedAction } from "@/lib/voice/intent-planning";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type VoiceAction =
  | { type: "navigate"; tab: string }
  | { type: "log-book"; title: string }
  | { type: "log-chore"; title: string }
  | { type: "log-kind"; title: string }
  | { type: "log-skill"; title: string }
  | { type: "read-page" }
  | { type: "complete-mission"; query: string }
  | { type: "click"; label: string }
  | { type: "unknown"; text: string };

/** Local intent parser — fast, private, no model call for common asks. */
export function parseVoiceIntent(text: string): VoiceAction {
  const t = text.toLowerCase().trim();

  // Click / tap / press / select a button or element by its visible label
  const clickMatch = t.match(/^(?:click|tap|press|hit|select|choose|pick)\s+(?:the\s+)?(.+)$/);
  if (clickMatch) {
    const label = clickMatch[1]
      .replace(/^(button|link|tab|option)\s+/, "")
      .replace(/\s+(button|link|tab|option)$/, "")
      .trim();
    // Don't steal navigation/logging intents that also use these verbs loosely
    if (label && !/^(to|on)\s/.test(label)) {
      // Check it's not a nav target handled below (e.g. "go to missions")
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

  // Real-life logging
  const bookMatch = t.match(/(?:i read|read|finished reading|book)\s+(.+)/);
  if (bookMatch && /(read|book|finished)/.test(t)) {
    const title = bookMatch[1].replace(/^(called|titled)\s+/i, "").trim();
    if (title) return { type: "log-book", title: capitalize(title) };
  }
  const choreMatch = t.match(/(?:i did|did|finished|completed?)\s+(?:a\s+)?(?:chore\s+)?(.+?)(?:\s+chore)?$/);
  if (/(chore|did|cleaned|folded|washed|helped)/.test(t) && choreMatch) {
    const title = choreMatch[1].trim();
    if (title && title.length > 2) return { type: "log-chore", title: capitalize(title) };
  }
  if (/(kind|helped|shared|nice)/.test(t) && /(i was|i helped|i shared)/.test(t)) {
    return { type: "log-kind", title: capitalize(t.replace(/^i\s+/, "")) };
  }
  if (/(practic)/.test(t)) {
    const m = t.match(/practic(?:e|ed|ing)\s+(.+)/);
    if (m) return { type: "log-skill", title: capitalize(m[1].trim()) };
  }

  // Read aloud
  if (/(read|tell me|say).*(page|this|aloud)/.test(t)) {
    return { type: "read-page" };
  }

  // Complete mission
  if (/(done|complete|finished|mark).*(mission|it)/.test(t)) {
    const m = t.match(/(?:mission\s+)?(?:called\s+)?["']?(.+?)["']?\s*$/);
    return { type: "complete-mission", query: m?.[1]?.trim() ?? "" };
  }

  return { type: "unknown", text };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Find a clickable element by its visible label and click it.
 * Searches buttons, links, tabs, and elements with click handlers —
 * best text match wins. Returns what it clicked, or null.
 */
export function clickElementByLabel(label: string): string | null {
  const needle = label.toLowerCase().trim();
  if (!needle) return null;

  const candidates: { el: HTMLElement; text: string; score: number }[] = [];
  const selector = 'button, a, [role="button"], [role="tab"], input[type="submit"], summary';
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    // Skip hidden or disabled
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    if ((el as HTMLButtonElement).disabled) return;
    const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "")
      .toLowerCase().replace(/\s+/g, " ").trim();
    if (!text) return;
    let score = 0;
    if (text === needle) score = 100;
    else if (text.startsWith(needle)) score = 80;
    else if (text.includes(needle)) score = 60;
    else {
      // Word-overlap fallback ("approve" matches "Approve 🎉")
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      const hits = words.filter((w) => text.includes(w)).length;
      if (hits > 0) score = 20 + hits * 10;
    }
    if (score > 0) candidates.push({ el, text, score });
  });

  // Ordinal support: "click the first/second/third button"
  const ordinals: Record<string, number> = {
    first: 0, second: 1, third: 2, fourth: 3, fifth: 4,
    "1st": 0, "2nd": 1, "3rd": 2, "4th": 3, "5th": 4,
  };
  for (const [word, idx] of Object.entries(ordinals)) {
    if (needle.includes(word)) {
      const visible = Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (r.width > 0 || r.height > 0) && !(el as HTMLButtonElement).disabled;
        });
      const target = visible[idx];
      if (target) {
        target.click();
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        return target.innerText?.slice(0, 40) || "button";
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best) {
    best.el.scrollIntoView({ behavior: "smooth", block: "center" });
    best.el.click();
    // Brief highlight so the user sees what was clicked
    const orig = best.el.style.boxShadow;
    best.el.style.boxShadow = "0 0 0 4px #a78bfa";
    setTimeout(() => { best.el.style.boxShadow = orig; }, 1200);
    return best.text.slice(0, 40);
  }
  return null;
}

/** Pick a feminine TTS voice when available. */
function pickFeminineVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const feminineHints = [
      "samantha", "victoria", "karen", "moira", "tessa", "fiona", "zira",
      "google uk english female", "google us english female",
      "microsoft zira", "microsoft jenny", "microsoft aria",
      "female",
    ];
    for (const hint of feminineHints) {
      const v = voices.find((x) => x.name.toLowerCase().includes(hint) && x.lang.startsWith("en"));
      if (v) return v;
    }
    // Fallback: any English voice with a traditionally feminine name pattern
    const v = voices.find((x) => x.lang.startsWith("en") && /[aeiou]a$/.test(x.name.split(" ")[0]));
    return v ?? null;
  } catch {
    return null;
  }
}

export default function VoiceAssistant({
  onAction,
  pageSummary,
  role,
  tab,
  tabLabel,
}: {
  /** Fired when the AI decides on an action. */
  onAction: (action: VoiceAction) => void;
  /** Short text describing the current page, for "read this page" TTS. */
  pageSummary?: string;
  /** Current user role — sent to the AI as page context. */
  role: "parent" | "child";
  /** Current tab id — sent to the AI as page context. */
  tab: string;
  /** Human-readable tab label — sent to the AI as page context. */
  tabLabel: string;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** Recent turns so follow-ups like "yes, the save one" resolve. */
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    const w = window as any;
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) {
      setSupported(false);
    }
    return () => {
      try { recRef.current?.abort(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    };
  }, []);

  const speak = useCallback((text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.15;
      const voice = pickFeminineVoice();
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      // Voices load async on some browsers — retry once if none yet
      if (!voice && window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const v = pickFeminineVoice();
          if (v) u.voice = v;
        };
      }
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  /**
   * Execute one planned action against the real page.
   * Every target is validated against visible elements — the AI can never
   * invent buttons. Returns true when the step ran.
   */
  const executeAction = useCallback((action: VoicePlannedAction): boolean => {
    if (action.do === "navigate") {
      onAction({ type: "navigate", tab: action.target });
      return true;
    }
    if (action.do === "type") {
      // Find the input and set its value the way React expects
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea"));
      const match = inputs.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && !el.closest("[data-voice-assistant]");
      });
      if (match && action.value !== undefined) {
        match.focus();
        const setter = Object.getOwnPropertyDescriptor(
          action.target === match.type ? HTMLInputElement.prototype : Object.getPrototypeOf(match),
          "value"
        )?.set ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(match, action.value);
        match.dispatchEvent(new Event("input", { bubbles: true }));
        match.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }
    // click — fuzzy match against the visible label
    return clickElementByLabel(action.target) !== null;
  }, [onAction]);

  /** Local keyword fallback when the AI endpoint is unreachable. */
  const handleLocalFallback = useCallback((text: string) => {
    const action = parseVoiceIntent(text);
    onAction(action);
    let reply = "";
    switch (action.type) {
      case "navigate":
        reply = `Taking you to ${action.tab}.`;
        break;
      case "log-book":
        reply = `Logged "${action.title}" as a book you read. Nice!`;
        break;
      case "log-chore":
        reply = `Logged "${action.title}" as a chore. Great work!`;
        break;
      case "log-kind":
        reply = `Logged your kind act. That matters!`;
        break;
      case "log-skill":
        reply = `Logged "${action.title}" as practice. Keep going!`;
        break;
      case "read-page":
        reply = pageSummary ?? "Here's what's on this page.";
        break;
      case "complete-mission":
        reply = `Looking for that mission to mark done.`;
        break;
      case "click": {
        const clicked = clickElementByLabel(action.label);
        reply = clicked ? `Clicked "${clicked}".` : `I couldn't find a button for "${action.label}". Try the exact label you see.`;
        break;
      }
      default:
        reply = `I heard "${text}". Try "go to missions", "click approve", "I read a book", or "read this page".`;
    }
    setResponse(reply);
    speak(reply);
  }, [onAction, pageSummary, speak]);

  /**
   * AI-native intent handling: snapshot the page, ask Workers AI for a plan,
   * then execute it step by step. Falls back to local parsing when offline.
   */
  const handleResult = useCallback(async (text: string) => {
    setTranscript(text);
    setThinking(true);

    const pushHistory = (entry: string) => {
      historyRef.current = [...historyRef.current, entry].slice(-4);
    };

    try {
      // Eyes: what's on screen right now?
      const context = snapshotPageContext({
        role: role === "parent" ? "parent" : "child",
        tab,
        tabLabel,
        summary: pageSummary ?? `${tabLabel} view`,
      });

      const res = await fetch("/api/voice/intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          context,
          history: historyRef.current,
        }),
      });
      if (!res.ok) throw new Error(`voice intent ${res.status}`);
      const plan = (await res.json()) as VoiceIntentPlan;
      setThinking(false);

      pushHistory(`User: ${text}`);

      // The AI isn't sure — ask back instead of guessing.
      if (plan.clarify) {
        pushHistory(`Assistant asked: ${plan.clarify}`);
        setResponse(plan.clarify);
        speak(plan.clarify);
        return;
      }

      // Hands: run each step with a beat between them so the user can follow.
      let ran = 0;
      for (const action of plan.actions) {
        if (executeAction(action)) ran++;
        await new Promise((r) => setTimeout(r, 550));
      }
      pushHistory(`Assistant: ${plan.reply}`);

      const reply = ran === plan.actions.length || plan.actions.length === 0
        ? plan.reply
        : `${plan.reply} (I couldn't do ${plan.actions.length - ran} step${plan.actions.length - ran === 1 ? "" : "s"}.)`;
      setResponse(reply);
      speak(reply);
    } catch {
      // Offline or AI unavailable — local keyword brain takes over.
      setThinking(false);
      handleLocalFallback(text);
    }
  }, [role, tab, tabLabel, pageSummary, speak, executeAction, handleLocalFallback]);

  const toggleListening = useCallback(() => {
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    const w = window as any;
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setResponse("Voice isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    setTranscript("");
    setResponse("");
    const rec: SpeechRecognitionLike = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript;
      setTranscript(text);
      if (e.results[e.results.length - 1].isFinal) {
        handleResult(text);
        setListening(false);
      }
    };
    rec.onerror = () => {
      setResponse("I didn't catch that — try again.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening, handleResult]);

  if (!supported) return null;

  return (
    <>
      {/* Floating mic button */}
      <button
        data-voice-assistant
        onClick={toggleListening}
        aria-label={listening ? "Stop listening" : "Voice assistant"}
        className={`tt-btn-press fixed bottom-20 right-4 z-50 grid size-14 place-items-center rounded-full shadow-2xl ring-4 transition-all sm:bottom-6 sm:right-6 ${
          listening
            ? "animate-pulse bg-red-500 ring-red-300"
            : speaking
              ? "bg-violet-500 ring-violet-300"
              : "bg-gradient-to-br from-tt-pine to-emerald-600 ring-emerald-200 hover:scale-110"
        }`}
      >
        <span className="text-2xl">{listening ? "🔴" : speaking ? "🔊" : "🎤"}</span>
      </button>

      {/* Voice panel */}
      {(listening || transcript || response) && (
        <div data-voice-assistant className="tt-animate-pop-in fixed bottom-36 right-4 z-50 w-72 rounded-3xl bg-white p-4 shadow-2xl ring-2 ring-tt-line sm:bottom-24 sm:right-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-tt-ink/50">
              {listening ? "🎤 Listening…" : "✨ Voice"}
            </p>
            <button
              onClick={() => { setTranscript(""); setResponse(""); try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); }}
              className="rounded-full bg-tt-cream px-2 py-0.5 text-xs font-bold text-tt-ink/60"
            >
              ✕
            </button>
          </div>
          {listening && (
            <div className="mt-2 flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="w-1.5 animate-pulse rounded-full bg-red-400"
                  style={{ height: `${12 + (i % 3) * 8}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
              <span className="ml-1 text-xs font-bold text-tt-ink/60">Speak now…</span>
            </div>
          )}
          {transcript && (
            <p className="mt-2 rounded-2xl bg-tt-cream/60 p-2.5 text-sm font-bold text-tt-ink">
              "{transcript}"
            </p>
          )}
          {thinking && (
            <p className="mt-2 flex items-center gap-2 rounded-2xl bg-violet-50 p-2.5 text-sm font-semibold text-violet-900 ring-1 ring-violet-200">
              <span className="inline-block size-3 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
              Thinking…
            </p>
          )}
          {response && (
            <p className="mt-2 rounded-2xl bg-violet-50 p-2.5 text-sm font-semibold text-violet-900 ring-1 ring-violet-200">
              {response}
            </p>
          )}
          {!listening && !transcript && (
            <p className="mt-2 text-xs text-tt-ink/50">
              Try: "go to missions" · "I read [book]" · "read this page"
            </p>
          )}
        </div>
      )}
    </>
  );
}
