/**
 * VoiceAssistant — listen + speak + do things on any page, powered by AI.
 *
 * Floating mic button, always available:
 * - TAP: starts listening (speech-to-text). Speak naturally — "go to missions",
 *   "put $2 in the save jar", "quiz me on dinosaurs", "read this page to me".
 * - AI sees the page, interprets intent, and DOES it: multi-step actions,
 *   quiz mode, navigation, or reading aloud (text-to-speech).
 *
 * The core kid loop is handled locally and deterministically (same behavior
 * online and offline): hear today's missions, hear your points, say "I did
 * it" to finish a mission (named back + confirmed, never a silent guess),
 * move points into jars with confirmation, and hear points news after a
 * grown-up approves. Quiz and confirm flows are hands-free: after the guide
 * speaks a question it listens again, so a child who relies on voice never
 * has to tap between turns.
 *
 * Quiz mode is designed for ADHD and autistic kids: predictable structure
 * ("Question 2 of 5"), short sessions, no time pressure, gentle feedback,
 * visual questions with tappable choices, stop anytime.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { snapshotPageContext } from "@/lib/voice/page-context";
import type { VoiceIntentPlan, VoicePlannedAction } from "@/lib/voice/intent-planning";
import type { QuizTurn } from "@/lib/voice/quiz";
import {
  parseVoiceIntent,
  LOCAL_FIRST_TYPES,
  type VoiceAction,
} from "@/lib/voice/intent-local";

export { parseVoiceIntent };
export type { VoiceAction };

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

/** A mission the voice layer needs to know by name (resolution + readback). */
export type VoiceMissionRef = { id: string; title: string; points: number };

/** A pending yes/no the guide asked about — resolved on the next utterance. */
type PendingConfirm =
  | { kind: "complete"; id: string; title: string; points: number }
  | { kind: "allocate"; jar: "save" | "spend" | "give"; amount: number }
  | { kind: "approve"; id: string; title: string; points: number }
  | { kind: "choose-mission"; options: VoiceMissionRef[] };

const YES_RE = /^(yes|yeah|yep|yup|ok|okay|sure|do it|yes please)[.!]?$/i;
const NO_RE = /^(no|nope|not yet|cancel|stop|never mind|nevermind)[.!]?$/i;

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
      const words = needle.split(/\s+/).filter((w) => w.length > 2);
      const hits = words.filter((w) => text.includes(w)).length;
      if (hits > 0) score = 20 + hits * 10;
    }
    if (score > 0) candidates.push({ el, text, score });
  });

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
    const orig = best.el.style.boxShadow;
    best.el.style.boxShadow = "0 0 0 4px #a78bfa";
    setTimeout(() => { best.el.style.boxShadow = orig; }, 1200);
    return best.text.slice(0, 40);
  }
  return null;
}

/** Pick a feminine TTS voice when available — prefer on-device (local) voices
 *  so spoken text never leaves the device for synthesis (COPPA minimization).
 *  Network voices (e.g. Google's on Chrome) send the spoken text to a server;
 *  they are a last resort and are disclosed in the voice permission sheet. */
function pickFeminineVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const local = voices.filter((x) => (x as any).localService !== false);
    const pool = local.length ? local : voices;
    const feminineHints = [
      "samantha", "victoria", "karen", "moira", "tessa", "fiona", "zira",
      "google uk english female", "google us english female",
      "microsoft zira", "microsoft jenny", "microsoft aria",
      "female",
    ];
    for (const hint of feminineHints) {
      const v = pool.find((x) => x.name.toLowerCase().includes(hint) && x.lang.startsWith("en"));
      if (v) return v;
    }
    const v = pool.find((x) => x.lang.startsWith("en") && /[aeiou]a$/.test(x.name.split(" ")[0]));
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
  kidAge,
  voiceConsented,
  onRequestVoiceConsent,
  todayMissions,
  pendingApprovals,
  pointsBalance,
  announcements,
  onAnnouncementsRead,
  onQuizComplete,
  showcase,
}: {
  /** Fired when the voice layer decides on an action. May return a short
   *  spoken feedback string the guide should say instead of its default. */
  onAction: (action: VoiceAction) => string | void;
  /** Short text describing the current page, for "read this page" TTS. */
  pageSummary?: string;
  /** Current user role — sent to the AI as page context. */
  role: "parent" | "child";
  /** Current tab id — sent to the AI as page context. */
  tab: string;
  /** Human-readable tab label — sent to the AI as page context. */
  tabLabel: string;
  /** Active child's age — quiz questions adapt to it. Only a number reaches the AI. */
  kidAge?: number;
  /**
   * COPPA: has the parent consented to voice collection? When false, tapping
   * the mic opens the parental consent sheet instead of listening.
   */
  voiceConsented: boolean;
  /** Opens the voice consent sheet (parental gate + consent). */
  onRequestVoiceConsent: () => void;
  /** Open missions for the active child — read aloud + named resolution. */
  todayMissions?: VoiceMissionRef[];
  /** Missions waiting for this parent's approval — named resolution. */
  pendingApprovals?: VoiceMissionRef[];
  /** Active child's points balance — "how many points do I have?" */
  pointsBalance?: number;
  /** Unheard news for the child (e.g. "You earned 10 points…"). */
  announcements?: string[];
  /** Called after announcements have been spoken. */
  onAnnouncementsRead?: () => void;
  /** Fired once when a quiz ends with at least one answered question. */
  onQuizComplete?: (result: { topic: string; correct: number; total: number }) => void;
  /**
   * Showcase mode (landing + demo): voice version 1 — SPEAKS only.
   * The guide reads the page / sample missions aloud via on-device TTS.
   * It never listens, never asks for microphone or consent, and nothing
   * is recorded or sent anywhere. The full listening voice (version 2)
   * exists only inside a real family's account, behind parental consent.
   */
  showcase?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** Recent turns so follow-ups like "yes, the save one" resolve. */
  const historyRef = useRef<string[]>([]);
  /** Quiz mode state — null when not quizzing. */
  const [quiz, setQuiz] = useState<{
    topic: string;
    age?: number;
    easyMode: boolean;
    history: QuizTurn[];
    current: { question: string; choices?: string[]; spoken: string; total: number } | null;
    lastFeedback: string | null;
  } | null>(null);
  const quizRef = useRef<typeof quiz>(null);
  quizRef.current = quiz;
  const pendingConfirmRef = useRef<PendingConfirm | null>(null);
  pendingConfirmRef.current = pendingConfirm;
  /** Guards onQuizComplete to once per quiz session. */
  const quizReportedRef = useRef(false);
  const propsRef = useRef({ todayMissions, pendingApprovals, pointsBalance, announcements });
  propsRef.current = { todayMissions, pendingApprovals, pointsBalance, announcements };

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

  /* ---------- listening (extracted so TTS can hand the mic back) ---------- */

  const handleResultRef = useRef<(text: string) => void>(() => {});
  const beginListeningRef = useRef<() => void>(() => {});

  const beginListening = useCallback(() => {
    if (!voiceConsented) {
      onRequestVoiceConsent();
      return;
    }
    const w = window as any;
    const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Rec) {
      setResponse("Voice isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    if (recRef.current) {
      try { recRef.current.abort(); } catch {}
    }
    const rec: SpeechRecognitionLike = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      setTranscript(text);
      if (result.isFinal) {
        setListening(false);
        handleResultRef.current(text);
      }
    };
    rec.onerror = () => {
      setResponse("I didn't catch that — tap the mic and try again.");
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
  }, [voiceConsented, onRequestVoiceConsent]);
  beginListeningRef.current = beginListening;

  /* ---------- speaking ---------- */

  const speak = useCallback((text: string, opts?: { resume?: boolean; rate?: number }) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts?.rate ?? 1.0;
      u.pitch = 1.15;
      const voice = pickFeminineVoice();
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        // Hands-free turn: the guide asked a question (quiz / confirm /
        // clarify) — hand the mic straight back so the child only talks.
        if (opts?.resume) {
          window.setTimeout(() => beginListeningRef.current(), 250);
        }
      };
      u.onerror = () => setSpeaking(false);
      if (!voice && window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const v = pickFeminineVoice();
          if (v) u.voice = v;
        };
      }
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  const say = useCallback((text: string, opts?: { resume?: boolean; rate?: number }) => {
    setResponse(text);
    speak(text, opts);
  }, [speak]);

  /* ---------- dispatch: run an action against the app, with feedback ------ */

  const dispatch = useCallback((action: VoiceAction): string | null => {
    const feedback = onAction(action);
    return typeof feedback === "string" && feedback ? feedback : null;
  }, [onAction]);

  /** Read today's missions aloud — numbered, one at a time in one breath. */
  const readMissionsAloud = useCallback(() => {
    const list = propsRef.current.todayMissions ?? [];
    if (!list.length) {
      say("You have no missions waiting. All done — nice work!");
      return;
    }
    const items = list.map((m, i) => `${i + 1}. ${m.title}`).join(". ");
    say(`You have ${list.length} mission${list.length === 1 ? "" : "s"} today: ${items}. Say "I did it" when you finish one.`);
  }, [say]);

  /**
   * Resolve a complete-mission ask against the open list BY NAME.
   * Never silently picks the first mission: one open mission (or a clear
   * name match) goes to a spoken confirmation; several open missions get
   * read out so the child can pick; no match says so.
   */
  const startCompleteMission = useCallback((query: string) => {
    const list = propsRef.current.todayMissions ?? [];
    const generic = !query || ["it", "mission", "the mission", "that"].includes(query);
    const match = generic
      ? undefined
      : list.find((m) => m.title.toLowerCase().includes(query)) ??
        list.find((m) => query.includes(m.title.toLowerCase().slice(0, 16)));
    const target = match ?? (generic && list.length === 1 ? list[0] : undefined);
    if (target) {
      setPendingConfirm({ kind: "complete", id: target.id, title: target.title, points: target.points });
      say(`Mark "${target.title}" done? Say yes or no.`, { resume: true });
      return;
    }
    if (!list.length) {
      say("You have no missions waiting right now.");
      return;
    }
    if (generic) {
      setPendingConfirm({ kind: "choose-mission", options: list });
      const items = list.map((m, i) => `${i + 1}. ${m.title}`).join(". ");
      say(`Which one did you finish? ${items}. Say the name or the number.`, { resume: true });
      return;
    }
    say(`I couldn't find a mission called "${query}". Say "my missions" to hear them.`);
  }, [say]);

  const startAllocate = useCallback((jar: "save" | "spend" | "give", amount: number) => {
    setPendingConfirm({ kind: "allocate", jar, amount });
    say(`Put $${amount} in your ${jar} jar? Say yes or no.`, { resume: true });
  }, [say]);

  const startApprove = useCallback((query: string) => {
    const list = propsRef.current.pendingApprovals ?? [];
    const match = query
      ? list.find((m) => m.title.toLowerCase().includes(query)) ??
        list.find((m) => query.includes(m.title.toLowerCase().slice(0, 16)))
      : list.length === 1
        ? list[0]
        : undefined;
    if (match) {
      setPendingConfirm({ kind: "approve", id: match.id, title: match.title, points: match.points });
      say(`Approve "${match.title}"? That gives ${match.points} points. Say yes or no.`, { resume: true });
      return;
    }
    if (!list.length) {
      say("Nothing is waiting for approval right now.");
      return;
    }
    const items = list.map((m, i) => `${i + 1}. ${m.title}`).join(". ");
    say(`Which one? Waiting for approval: ${items}. Say the name to approve it.`);
  }, [say]);

  /** Resolve a pending yes/no (or a mission pick) on the next utterance. */
  const resolveConfirm = useCallback((text: string): boolean => {
    const pending = pendingConfirmRef.current;
    if (!pending) return false;
    const t = text.toLowerCase().trim();

    if (pending.kind === "choose-mission") {
      const numWords: Record<string, number> = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5 };
      let idx = Number(t.match(/\d+/)?.[0] ?? NaN) - 1;
      if (Number.isNaN(idx)) {
        for (const [word, n] of Object.entries(numWords)) {
          if (t.includes(word)) { idx = n - 1; break; }
        }
      }
      const picked =
        pending.options[idx] ??
        pending.options.find((m) => m.title.toLowerCase().includes(t)) ??
        pending.options.find((m) => t.includes(m.title.toLowerCase().slice(0, 16)));
      setPendingConfirm(null);
      if (picked) {
        const feedback = dispatch({ type: "complete-mission-id", id: picked.id });
        say(feedback ?? `Done! "${picked.title}" is saved for your grown-up.`);
      } else if (NO_RE.test(t)) {
        say("Okay, no problem.");
      } else {
        say("I didn't catch which one. Tap the mic and say the name or the number.");
      }
      return true;
    }

    if (YES_RE.test(t)) {
      setPendingConfirm(null);
      if (pending.kind === "complete") {
        const feedback = dispatch({ type: "complete-mission-id", id: pending.id });
        say(feedback ?? `Done! "${pending.title}" is saved for your grown-up.`);
      } else if (pending.kind === "allocate") {
        const feedback = dispatch({ type: "allocate-jar", jar: pending.jar, amount: pending.amount });
        say(feedback ?? `Done — $${pending.amount} is in your ${pending.jar} jar.`);
      } else if (pending.kind === "approve") {
        const feedback = dispatch({ type: "approve-mission-id", id: pending.id });
        say(feedback ?? `Approved "${pending.title}". Points are on their way!`);
      }
      return true;
    }
    if (NO_RE.test(t)) {
      setPendingConfirm(null);
      say("Okay, no problem. Nothing changed.");
      return true;
    }
    return false;
  }, [dispatch, say]);

  /* ---------- quiz ---------- */

  const startQuiz = useCallback(async (topic: string, easy = false) => {
    setThinking(true);
    quizReportedRef.current = false;
    try {
      const res = await fetch("/api/voice/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start", topic, age: kidAge, easyMode: easy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "quiz unavailable");
      const q = data.question as { question: string; choices?: string[]; spoken: string };
      setQuiz({
        topic,
        age: kidAge,
        easyMode: easy,
        history: [],
        current: { ...q, total: typeof data.total === "number" ? data.total : 5 },
        lastFeedback: null,
      });
      setThinking(false);
      // Hands-free: after the question is spoken, the mic opens by itself.
      say(q.spoken, { resume: true, rate: 0.95 });
    } catch {
      setThinking(false);
      say("I couldn't start the quiz right now. Let's try again in a bit.");
    }
  }, [kidAge, say]);

  const answerQuiz = useCallback(async (text: string) => {
    const q = quizRef.current;
    if (!q || !q.current) return;
    setTranscript(text);
    setThinking(true);
    try {
      const res = await fetch("/api/voice/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          topic: q.topic,
          age: q.age,
          easyMode: q.easyMode,
          history: q.history,
          answer: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "quiz unavailable");
      setThinking(false);
      const turn: QuizTurn = { question: q.current.question, userAnswer: text, correct: data.correct === true };
      const history = [...q.history, turn];
      if (data.stopRequested === true || data.done === true) {
        const score = data.score ?? { correct: history.filter((h) => h.correct).length, total: history.length };
        // Quiz points path: the finished quiz becomes a pending approval so
        // a grown-up can credit points for correct answers (Oct 6 rule:
        // points land on approval). Report once per quiz.
        if (!quizReportedRef.current && history.length > 0 && onQuizComplete) {
          quizReportedRef.current = true;
          onQuizComplete({ topic: q.topic, correct: score.correct, total: score.total });
        }
        const pointsLine = score.correct > 0
          ? " Your grown-up can approve your quiz points."
          : "";
        const summary = data.stopRequested === true
          ? `Okay, quiz paused. You got ${score.correct} out of ${score.total}. Nice thinking!${pointsLine}`
          : `${data.feedback ?? ""} Quiz done! You got ${score.correct} out of ${score.total}. Awesome work!${pointsLine}`;
        setQuiz(null);
        say(summary);
      } else {
        const next = data.next as { question: string; choices?: string[]; spoken: string };
        const easyMode = data.easyRequested === true ? true : q.easyMode;
        setQuiz({
          ...q,
          easyMode,
          history,
          current: { ...next, total: q.current.total },
          lastFeedback: typeof data.feedback === "string" ? data.feedback : null,
        });
        const spoken = `${data.feedback ?? ""} ${next.spoken}`.trim();
        say(spoken, { resume: true, rate: 0.95 });
      }
    } catch {
      setThinking(false);
      say("Hmm, I missed that. Say your answer again?", { resume: true });
    }
  }, [say, onQuizComplete]);

  /* ---------- planned (AI) actions ---------- */

  const executeAction = useCallback((action: VoicePlannedAction): boolean => {
    if (action.do === "quiz") {
      void startQuiz(action.target || "animals");
      return true;
    }
    if (action.do === "navigate") {
      onAction({ type: "navigate", tab: action.target });
      return true;
    }
    if (action.do === "type") {
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
    return clickElementByLabel(action.target) !== null;
  }, [onAction, startQuiz]);

  /* ---------- local dispatch (shared by offline + local-first routing) ---- */

  const handleLocalAction = useCallback((action: VoiceAction, rawText: string) => {
    switch (action.type) {
      case "read-missions":
        readMissionsAloud();
        return;
      case "read-balance": {
        const pts = propsRef.current.pointsBalance;
        say(pts === undefined
          ? "I can't see your points right now."
          : `You have ${pts} point${pts === 1 ? "" : "s"}. Great work!`);
        return;
      }
      case "read-news": {
        const news = propsRef.current.announcements ?? [];
        if (news.length) {
          say(news.join(" "));
          onAnnouncementsRead?.();
        } else {
          say("No news right now. Finish a mission and your points news will come here.");
        }
        return;
      }
      case "complete-mission":
        startCompleteMission(action.query);
        return;
      case "allocate-jar":
        startAllocate(action.jar, action.amount);
        return;
      case "approve-mission":
        startApprove(action.query);
        return;
      case "navigate":
        dispatch(action);
        say(`Taking you to ${action.tab}.`);
        return;
      case "log-book":
        dispatch(action);
        say(`Logged "${action.title}" as a book you read. Nice!`);
        return;
      case "log-chore":
        dispatch(action);
        say(`Logged "${action.title}" as a chore. Great work!`);
        return;
      case "log-kind":
        dispatch(action);
        say("Logged your kind act. That matters!");
        return;
      case "log-skill":
        dispatch(action);
        say(`Logged "${action.title}" as practice. Keep going!`);
        return;
      case "read-page":
        say(pageSummary ?? "Here's what's on this page.");
        return;
      case "click": {
        const clicked = clickElementByLabel(action.label);
        say(clicked ? `Clicked "${clicked}".` : `I couldn't find a button for "${action.label}". Try the exact label you see.`);
        return;
      }
      default:
        say(`I heard "${rawText}". Try "my missions", "I did it", "quiz me on dinosaurs", or "read this page".`);
    }
  }, [dispatch, say, pageSummary, readMissionsAloud, startCompleteMission, startAllocate, startApprove, onAnnouncementsRead]);

  const handleLocalFallback = useCallback((text: string) => {
    if (/\b(quiz|test)\s+me\b|\bask\s+me\s+(some\s+)?questions\b/i.test(text)) {
      const topicMatch = text.match(/\b(?:on|about)\s+([a-zA-Z ]{2,40})/i);
      void startQuiz(topicMatch ? topicMatch[1].trim() : "animals");
      return;
    }
    handleLocalAction(parseVoiceIntent(text), text);
  }, [handleLocalAction, startQuiz]);

  /* ---------- main result handling ---------- */

  const handleResult = useCallback(async (text: string) => {
    // Quiz mode: every utterance is an answer.
    if (quizRef.current?.current) {
      await answerQuiz(text);
      return;
    }
    // A spoken confirmation is pending — resolve it before anything else.
    if (pendingConfirmRef.current && resolveConfirm(text)) {
      return;
    }
    setTranscript(text);

    // Deterministic kid-loop intents run locally even when online — same
    // confirmations, same wording, no model round-trip, no guessing.
    const local = parseVoiceIntent(text);
    if (LOCAL_FIRST_TYPES.has(local.type)) {
      // A fresh command supersedes a stale pending confirmation (the new
      // command sets its own, or none).
      if (pendingConfirmRef.current) setPendingConfirm(null);
      handleLocalAction(local, text);
      return;
    }
    // Offline quiz start stays local too.
    if (/\b(quiz|test)\s+me\b|\bask\s+me\s+(some\s+)?questions\b/i.test(text)) {
      handleLocalFallback(text);
      return;
    }

    setThinking(true);
    const pushHistory = (entry: string) => {
      historyRef.current = [...historyRef.current, entry].slice(-4);
    };

    try {
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

      // The AI isn't sure — ask back instead of guessing, then listen again.
      if (plan.clarify) {
        pushHistory(`Assistant asked: ${plan.clarify}`);
        say(plan.clarify, { resume: true });
        return;
      }

      let ran = 0;
      for (const action of plan.actions) {
        if (executeAction(action)) ran++;
        await new Promise((r) => setTimeout(r, 550));
      }
      pushHistory(`Assistant: ${plan.reply}`);

      const reply = ran === plan.actions.length || plan.actions.length === 0
        ? plan.reply
        : `${plan.reply} (I couldn't do ${plan.actions.length - ran} step${plan.actions.length - ran === 1 ? "" : "s"}.)`;
      say(reply);
    } catch {
      setThinking(false);
      handleLocalFallback(text);
    }
  }, [role, tab, tabLabel, pageSummary, say, executeAction, handleLocalFallback, handleLocalAction, answerQuiz, resolveConfirm]);
  handleResultRef.current = handleResult;

  /* ---------- mic button ---------- */

  const toggleListening = useCallback(() => {
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    // COPPA: no voice collection without parental consent.
    if (!voiceConsented) {
      onRequestVoiceConsent();
      return;
    }
    // Unheard points news speaks first — the child hears what they earned
    // before doing anything else. Next tap listens as usual.
    const news = announcements ?? [];
    if (role === "child" && news.length > 0) {
      setTranscript("");
      say(news.join(" "));
      onAnnouncementsRead?.();
      return;
    }
    setTranscript("");
    setResponse("");
    beginListening();
  }, [listening, voiceConsented, onRequestVoiceConsent, announcements, role, say, onAnnouncementsRead, beginListening]);

  // Showcase speech = the ONE TailTots voice: server-synthesized (Deepgram
  // Aura via /api/voice/speak) so every visitor hears the same warm voice
  // on every device, instead of whatever robotic voice their phone ships.
  // Falls back to device TTS only if the server voice is unreachable.
  const showcaseAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopShowcaseAudio = useCallback(() => {
    const audio = showcaseAudioRef.current;
    if (audio) {
      try { audio.pause(); } catch {}
      if (audio.src) URL.revokeObjectURL(audio.src);
      showcaseAudioRef.current = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    setSpeaking(false);
  }, []);
  const speakShowcase = useCallback(async (text: string) => {
    const trimmed = text.trim().slice(0, 580);
    if (!trimmed) return;
    try {
      const res = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error("speak failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      showcaseAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); if (showcaseAudioRef.current === audio) showcaseAudioRef.current = null; setSpeaking(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); if (showcaseAudioRef.current === audio) showcaseAudioRef.current = null; setSpeaking(false); };
      setSpeaking(true);
      await audio.play();
    } catch {
      speak(trimmed);
    }
  }, [speak]);

  // Showcase tap: speak only. Pending news first (e.g. demo points
  // announcements), else the page summary, else a one-line intro. A
  // second tap stops the speech. No mic, no consent sheet, ever.
  const toggleShowcase = useCallback(() => {
    if (speaking) { stopShowcaseAudio(); return; }
    const news = announcements?.length ? announcements.join(" ") : "";
    const text = news || pageSummary?.trim() ||
      "Hi! I'm the TailTots voice guide. In a real family, I read missions out loud and kids answer by voice — and a parent always approves first.";
    void speakShowcase(text);
    if (news) onAnnouncementsRead?.();
  }, [speaking, stopShowcaseAudio, speakShowcase, announcements, pageSummary, onAnnouncementsRead]);

  if (!supported) return null;

  const hasNews = role === "child" && (announcements?.length ?? 0) > 0;

  return (
    <>
      {/* Floating mic button */}
      <button
        data-voice-assistant
        onClick={showcase ? toggleShowcase : toggleListening}
        aria-label={showcase ? (speaking ? "Stop the voice guide" : "Hear the voice guide") : listening ? "Stop listening" : hasNews ? "Hear your news" : "Voice assistant"}
        className={`tt-btn-press fixed bottom-20 right-4 z-50 grid size-14 place-items-center rounded-full shadow-2xl ring-4 transition-all sm:bottom-6 sm:right-6 ${
          listening
            ? "animate-pulse bg-red-500 ring-red-300"
            : speaking
              ? "bg-violet-500 ring-violet-300"
              : "bg-gradient-to-br from-tt-pine to-emerald-600 ring-emerald-200 hover:scale-110"
        }`}
      >
        <span className="text-2xl">{showcase ? (speaking ? "⏸️" : "🔊") : listening ? "🔴" : speaking ? "🔊" : "🎤"}</span>
        {hasNews && !listening && (
          <span className="absolute -right-0.5 -top-0.5 grid size-6 animate-bounce place-items-center rounded-full bg-tt-sun text-xs ring-2 ring-white" aria-hidden="true">
            🔔
          </span>
        )}
      </button>

      {/* Voice panel — never in showcase mode (nothing to listen to) */}
      {!showcase && (listening || transcript || response || quiz?.current) && (
        <div data-voice-assistant className="tt-animate-pop-in fixed bottom-36 right-4 z-50 w-72 rounded-3xl bg-white p-4 shadow-2xl ring-2 ring-tt-line sm:bottom-24 sm:right-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-tt-ink/50">
              {listening ? "🎤 Listening…" : "✨ Voice"}
            </p>
            <button
              onClick={() => { setTranscript(""); setResponse(""); setQuiz(null); setPendingConfirm(null); try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); }}
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
          {/* Quiz card — same question spoken aloud, shown visually with big tappable choices */}
          {quiz?.current && (
            <div className="mt-2 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-3 ring-1 ring-violet-200">
              <p className="text-[11px] font-black uppercase tracking-wider text-violet-700">
                🧠 Quiz · {quiz.topic} · Question {quiz.history.length + 1} of {quiz.current.total}
              </p>
              {quiz.lastFeedback && (
                <p className="mt-1 text-sm font-semibold text-violet-900">{quiz.lastFeedback}</p>
              )}
              <p className="mt-1 text-base font-black text-tt-ink">{quiz.current.question}</p>
              {quiz.current.choices && quiz.current.choices.length > 0 && (
                <div className="mt-2 grid gap-1.5">
                  {quiz.current.choices.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => void answerQuiz(c)}
                      className="tt-btn-press rounded-xl bg-white px-3 py-2.5 text-left text-sm font-bold text-tt-ink ring-1 ring-violet-200"
                    >
                      {String.fromCharCode(65 + i)}. {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => void answerQuiz("repeat")}
                  className="flex-1 rounded-full bg-white px-2 py-1.5 text-xs font-black text-violet-900 ring-1 ring-violet-200"
                >
                  🔁 Repeat
                </button>
                <button
                  onClick={() => void answerQuiz("easier")}
                  className="flex-1 rounded-full bg-white px-2 py-1.5 text-xs font-black text-violet-900 ring-1 ring-violet-200"
                >
                  😌 Easier
                </button>
                <button
                  onClick={() => void answerQuiz("stop")}
                  className="flex-1 rounded-full bg-white px-2 py-1.5 text-xs font-black text-violet-900 ring-1 ring-violet-200"
                >
                  ⏹ Stop
                </button>
              </div>
              {(!quiz.current.choices || quiz.current.choices.length === 0) && (
                <p className="mt-2 text-xs font-semibold text-tt-ink/50">
                  Just say your answer out loud — I'm listening after each question.
                </p>
              )}
            </div>
          )}
          {!listening && !transcript && (
            <p className="mt-2 text-xs text-tt-ink/50">
              Just talk — say "my missions", "I did it", or "how many points do I have?"
            </p>
          )}
        </div>
      )}
    </>
  );
}
