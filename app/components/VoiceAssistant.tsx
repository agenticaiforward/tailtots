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
  | { type: "unknown"; text: string };

/** Local intent parser — fast, private, no model call for common asks. */
export function parseVoiceIntent(text: string): VoiceAction {
  const t = text.toLowerCase().trim();

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

export default function VoiceAssistant({
  onAction,
  pageSummary,
}: {
  /** Fired when the AI decides on an action. */
  onAction: (action: VoiceAction) => void;
  /** Short text describing the current page, for "read this page" TTS. */
  pageSummary?: string;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

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
      u.pitch = 1.1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const handleResult = useCallback((text: string) => {
    setTranscript(text);
    const action = parseVoiceIntent(text);
    onAction(action);

    // Friendly spoken + visual confirmation
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
      default:
        reply = `I heard "${text}". Try "go to missions", "I read a book", or "read this page".`;
    }
    setResponse(reply);
    speak(reply);
  }, [onAction, pageSummary, speak]);

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
        <div className="tt-animate-pop-in fixed bottom-36 right-4 z-50 w-72 rounded-3xl bg-white p-4 shadow-2xl ring-2 ring-tt-line sm:bottom-24 sm:right-6">
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
