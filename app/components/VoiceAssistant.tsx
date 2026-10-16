/**
 * VoiceAssistant — listen + speak + do things on any page, powered by AI.
 *
 * ONE floating voice button, always available, in demo and family
 * accounts alike (founder, 2026-10-16): a single context-aware button
 * like a smart speaker — it listens, then DOES what was asked:
 * - TAP: starts listening (speech-to-text). Speak naturally — "go to missions",
 *   "put $2 in the save jar", "quiz me on dinosaurs", "read this page to me".
 * - AI sees the page, interprets intent, and DOES it: multi-step actions,
 *   quiz mode, navigation, or reading aloud (text-to-speech).
 * - Context first: if spoken news is waiting, the tap reads it aloud
 *   instead of listening; while it speaks, a tap stops it. The panel
 *   also offers tappable Read this page / My missions / My points for
 *   anyone who would rather tap than talk.
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
  cleanTranscript,
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

/** Split long replies into <=560-char sentence chunks for the speak
 *  endpoint (600-char cap) so a long missions list is spoken in full,
 *  in order, instead of being cut off mid-thought. */
function chunkForSpeech(text: string, max = 560): string[] {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  const flush = () => { if (cur.trim()) chunks.push(cur.trim()); cur = ""; };
  for (const s of sentences) {
    if (s.length > max) {
      flush();
      for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max).trim());
      continue;
    }
    if ((cur + s).length > max && cur) flush();
    cur += s;
  }
  flush();
  return chunks.length ? chunks : [text.slice(0, max)];
}

const YES_RE = /^(yes|yeah|yep|yup|ok|okay|sure|do it|yes please)[.!]?$/i;
const NO_RE = /^(no|nope|not yet|cancel|stop|never mind|nevermind)[.!]?$/i;

/**
 * Demo FAQ — the only non-local answers the showcase voice may give.
 * Fixed strings, matched on-device: no model, no server call, and the
 * visitor's words never leave the browser's own speech service.
 */
const DEMO_FAQ: { re: RegExp; answer: string }[] = [
  {
    re: /\b(jars?|spend|spending|buy|buying|purchase|rewards?)\b/,
    answer: "Yes — spending is the fun part! When a kid finishes a mission and a grown-up approves it, the points land in their bank. Kids split points into three jars: Save, Spend, and Give. Spend points buy rewards their grown-ups set up — like picking Friday's movie. Grown-ups see every point that moves.",
  },
  {
    re: /\b(save|saving|give|giving|donate|donation|charity)\b/,
    answer: "The three jars teach three habits. Save is for a big goal. Give turns points into real kindness — like a donation to the shelter the family picks. And Spend is for rewards at home. Kids choose where points go; grown-ups watch it all.",
  },
  {
    re: /\b(earn|get (the )?points|how do (kids|you|they) get)\b/,
    answer: "Kids earn points by finishing missions — feeding their pet, brushing them, tidying up. A grown-up approves each finished mission, and the points land in the kid's bank right away.",
  },
  {
    re: /\b(how (do|does) (missions?|it|this) work|what (are|is) (the )?missions?|missions? (do|work))\b/,
    answer: "Every day, kids get short missions built around their real pet — feeding, brushing, playing, tidying. Each takes a few minutes. Finishing them grows character traits like responsibility and kindness — and earns points.",
  },
  {
    re: /\b(how (does|do) (approval|approving)|who approves|grown-?ups? approve|parents? approve)\b/,
    answer: "When a kid finishes a mission, it waits for a grown-up. A parent taps approve — and only then do the points count. Grown-ups stay in charge of every point.",
  },
  {
    re: /\b(no pet|don'?t have a pet|without a pet|can'?t have a pet|want a pet|no dog|no cat)\b/,
    answer: "No pet at home? No problem. Kids can sponsor a shelter buddy and do kindness missions, or follow a real wild animal's journey on a real map. Every kid gets the full TailTots.",
  },
  {
    re: /\b(how old|what age|ages|too young|too old)\b/,
    answer: "TailTots is made for kids about 4 to 12. Missions grow with them — Sprouts, Growers, and Thrivers.",
  },
  {
    re: /\b(character|traits?|values|learn|teach|skills?)\b/,
    answer: "TailTots practices eight traits: confidence, empathy, self-control, integrity, curiosity, perseverance, optimism, and respect — through real pet care. Character isn't taught. It's practiced.",
  },
  {
    re: /\b(what (kind|type) of (pet|animal)|which pets|dogs? (or|and) cats?|rabbits?|animals?)\b/,
    answer: "Any pet works — dogs, cats, rabbits, birds, fish. Missions adapt to the animal your family actually has.",
  },
  {
    re: /\b(how much|price|cost|is it free|free)\b/,
    answer: "TailTots is free for founding families. A grown-up joins with just an email — no card, no password.",
  },
  {
    re: /\b(privacy|private|safe|safety|secure|data|information|record)/,
    answer: "Family information stays with the family, and grown-ups approve everything. This demo saves nothing — voice answers here are heard live and never stored.",
  },
  {
    re: /\b(what is tailtots|who are you|your name|about tailtots)\b/,
    answer: "I'm Stella, the TailTots guide. TailTots turns pet care into short daily missions that build character and life skills — about ten minutes a day.",
  },
  {
    re: /\b(sign ?up|join|get started|create (an )?account|start my family)\b/,
    answer: "Tap 'Start my family for free' — a grown-up signs up with an email link. It takes about a minute.",
  },
  {
    re: /\b(school|pto|teacher|shelter)\b/,
    answer: "Schools, shelters, and PTOs use TailTots free — they're how more kids get to practice. Grown-ups can reach us at hello@tailtots.com.",
  },
];

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
   * Showcase mode (landing + demo): the public voice. The guide SPEAKS
   * with the one TailTots voice (Stella, via /api/voice/speak) and —
   * since Oct 16 — also takes TAP-TO-TALK questions, answered locally
   * and transiently: the browser's own speech service transcribes,
   * answers come only from on-device intent parsing + a small demo FAQ,
   * the transcript NEVER reaches TailTots servers, and nothing is
   * stored. No consent sheet (nothing is collected); a one-time notice
   * says exactly that before the first listen. The full voice loop
   * (points news, approvals history, AI planner) exists only inside a
   * real family's account, behind parental consent.
   */
  showcase?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [supported, setSupported] = useState(true);
  /** Showcase tap-to-talk: panel open / one-time notice showing. */
  const [demoTalk, setDemoTalk] = useState(false);
  const [demoNoticeOpen, setDemoNoticeOpen] = useState(false);
  /** Which result handler the active listening session routes to. */
  const listeningModeRef = useRef<"family" | "demo">("family");
  /** Late-bound refs so shared handlers can use the showcase speaker and
   *  the demo listener before their definitions below. */
  const speakShowcaseRef = useRef<(text: string, onDone?: () => void, allowDeviceFallback?: boolean) => void>(() => {});
  const beginDemoListeningRef = useRef<() => void>(() => {});
  const handleDemoResultRef = useRef<(text: string) => void>(() => {});
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

  const beginListening = useCallback((demo = false) => {
    // Family mode is consent-gated (COPPA). Demo mode collects nothing —
    // the transcript never reaches our servers and nothing is stored —
    // so it runs without the consent sheet, behind its own one-time
    // transparency notice instead.
    if (!demo && !voiceConsented) {
      onRequestVoiceConsent();
      return;
    }
    listeningModeRef.current = demo ? "demo" : "family";
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
  beginDemoListeningRef.current = () => beginListening(true);

  /* ---------- speaking ---------- */

  const speak = useCallback((text: string, opts?: { resume?: boolean; rate?: number; onDone?: () => void }) => {
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
        opts?.onDone?.();
      };
      u.onerror = () => { setSpeaking(false); opts?.onDone?.(); };
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
   * Say it through the right voice for the mode. In a family account:
   * the device voice, and "resume" re-opens the family mic after the
   * line finishes. In showcase: Stella via speakShowcase, and "resume"
   * re-opens the DEMO mic instead — so the shared handlers (missions,
   * confirms, jars) sound like the guide in the demo and never touch
   * the family consent path.
   */
  const say = useCallback((text: string, opts?: { resume?: boolean; rate?: number }) => {
    setResponse(text);
    if (showcase) {
      speakShowcaseRef.current(text, opts?.resume ? () => beginDemoListeningRef.current() : undefined);
    } else {
      // Real accounts speak as Stella too (founder, 2026-10-16) — the
      // device voice remains only as the family-mode fallback inside
      // the Stella speaker, in case she can't be reached.
      speakShowcaseRef.current(text, opts?.resume ? () => beginListeningRef.current() : undefined, true);
    }
  }, [showcase]);

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
  handleResultRef.current = (text: string) => {
    // Fillers ("um", "uh") are stripped ONCE here, before display,
    // matching, confirms ("um yes" must still mean yes), and any
    // planner call — kids hear their meaning echoed back, not the ums.
    const cleaned = cleanTranscript(text) || text;
    // Demo listening routes to the local-only handler — the transcript
    // is never posted to /api/voice/intent from the public pages.
    if (listeningModeRef.current === "demo") handleDemoResultRef.current(cleaned);
    else void handleResult(cleaned);
  };

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
  const speakGenRef = useRef(0);
  /**
   * Stella speaks — in the demo AND in real family accounts (founder,
   * 2026-10-16: "the voice is not enabled Stella in the real accounts").
   * ONE voice, one line at a time: every new line stops the current
   * audio and supersedes any in-flight fetch (the "two people talking"
   * bug). Long replies are chunked under the endpoint's 600-char cap
   * and played in order. Fallback rule differs by mode: the DEMO never
   * uses the device voice (Stella or the on-screen text); a FAMILY
   * account falls back to the device voice so a kid is never left in
   * silence if Stella can't be reached.
   */
  const speakShowcase = useCallback(async (text: string, onDone?: () => void, allowDeviceFallback = false) => {
    const full = text.trim();
    if (!full) { onDone?.(); return; }
    const gen = ++speakGenRef.current;
    stopShowcaseAudio();
    const playBlob = (blob: Blob) => new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      showcaseAudioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); if (showcaseAudioRef.current === audio) showcaseAudioRef.current = null; resolve(); };
      audio.onpause = () => { if (gen !== speakGenRef.current) resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); if (showcaseAudioRef.current === audio) showcaseAudioRef.current = null; reject(new Error("audio failed")); };
      setSpeaking(true);
      audio.play().catch(reject);
    });
    try {
      for (const chunk of chunkForSpeech(full)) {
        if (gen !== speakGenRef.current) return; // superseded
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: chunk }),
        });
        if (!res.ok) throw new Error("speak failed");
        const blob = await res.blob();
        if (gen !== speakGenRef.current) return; // superseded while fetching
        await playBlob(blob);
      }
      if (gen === speakGenRef.current) { setSpeaking(false); onDone?.(); }
    } catch {
      if (gen !== speakGenRef.current) return;
      if (allowDeviceFallback) {
        speak(full, { onDone });
      } else {
        setSpeaking(false);
        onDone?.();
      }
    }
  }, [stopShowcaseAudio, speak]);
  speakShowcaseRef.current = speakShowcase;

  // (The old speak-only showcase tap was merged into the ONE context-
  // aware button below on 2026-10-16 — founder: a single button that
  // listens, acts, and reads aloud when the context calls for reading.)

  /* ---------- showcase tap-to-talk (transient, local-only) ---------- */

  /**
   * Demo result handling: the SAME deterministic local intents as the
   * family loop (missions, points, jars, navigation, read-page),
   * resolved against the sample family — plus the fixed demo FAQ.
   * Approvals stay a grown-up's job, quizzes stay in real accounts,
   * and NOTHING here calls the AI endpoints: the transcript never
   * reaches TailTots servers and is never stored.
   */
  const handleDemoResult = useCallback((text: string) => {
    if (pendingConfirmRef.current && resolveConfirm(text)) return;
    setTranscript(text);
    if (/\b(quiz|test)\s+me\b|\bask\s+me\s+(some\s+)?questions\b/i.test(text)) {
      say("Quizzes live inside a real family account, set up by a grown-up. Here in the demo, try asking for your missions or your points!");
      return;
    }
    const local = parseVoiceIntent(text);
    if (local.type === "approve-mission") {
      say("Approving is a grown-up's job. In the demo, finished missions wait for a parent — just like the real thing.");
      return;
    }
    if (local.type !== "unknown") {
      if (pendingConfirmRef.current) setPendingConfirm(null);
      handleLocalAction(local, text);
      return;
    }
    const faq = DEMO_FAQ.find((f) => f.re.test(text.toLowerCase()));
    if (faq) {
      say(faq.answer);
      return;
    }
    say(`I heard "${text}". I don't know that one yet — but ask me about missions, points, or the money jars, and I'll show you.`);
  }, [resolveConfirm, say, handleLocalAction]);
  handleDemoResultRef.current = handleDemoResult;

  /**
   * THE one demo button (founder, 2026-10-16): context-aware, like a
   * smart speaker. If it's talking, a tap stops it. If a kid has unheard
   * news, a tap SPEAKS the news first (reading is what the moment asks
   * for). Otherwise a tap LISTENS — first time per session via the
   * transparency notice — and what the visitor says drives everything:
   * asking drives actions, "read this page" drives reading.
   */
  const toggleDemoVoice = useCallback(() => {
    if (listening) {
      try { recRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    if (speaking) { stopShowcaseAudio(); return; }
    const news = announcements ?? [];
    if (role === "child" && news.length > 0) {
      setTranscript("");
      void speakShowcase(news.join(" "));
      onAnnouncementsRead?.();
      return;
    }
    setDemoTalk(true);
    setTranscript("");
    setResponse("");
    let seen = false;
    try { seen = window.sessionStorage.getItem("tt-demo-voice-notice") === "1"; } catch {}
    if (!seen) {
      setDemoNoticeOpen(true);
      return;
    }
    beginListening(true);
  }, [listening, speaking, stopShowcaseAudio, announcements, role, speakShowcase, onAnnouncementsRead, beginListening]);

  const acceptDemoNotice = useCallback(() => {
    try { window.sessionStorage.setItem("tt-demo-voice-notice", "1"); } catch {}
    setDemoNoticeOpen(false);
    setResponse("");
    beginListening(true);
  }, [beginListening]);

  if (!supported) return null;

  const hasNews = role === "child" && (announcements?.length ?? 0) > 0;
  const panelVisible = showcase
    ? demoTalk || demoNoticeOpen || listening || !!transcript || !!response
    : listening || !!transcript || !!response || !!quiz?.current;

  return (
    <>
      {/* THE one voice button — same in demo and family accounts
          (founder, 2026-10-16). Context-aware: 🎤 idle (tap to talk),
          🔴 listening, 🔊 speaking; the 🔔 badge means news is waiting
          and the next tap reads it aloud instead of listening. */}
      <button
        data-voice-assistant
        onClick={showcase ? toggleDemoVoice : toggleListening}
        aria-label={listening ? "Stop listening" : speaking ? "Stop the voice guide" : hasNews ? "Hear your news" : "Voice assistant — tap and talk"}
        className={`tt-btn-press fixed bottom-20 right-4 z-50 grid size-14 place-items-center rounded-full shadow-2xl ring-4 transition-all sm:bottom-6 sm:right-6 ${
          listening
            ? "animate-pulse bg-red-500 ring-red-300"
            : speaking
              ? "bg-violet-500 ring-violet-300"
              : "bg-gradient-to-br from-tt-pine to-emerald-600 ring-emerald-200 hover:scale-110"
        }`}
      >
        <span className="text-2xl">{listening ? "🔴" : speaking ? "🔊" : "🎤"}</span>
        {hasNews && !listening && (
          <span className="absolute -right-0.5 -top-0.5 grid size-6 animate-bounce place-items-center rounded-full bg-tt-sun text-xs ring-2 ring-white" aria-hidden="true">
            🔔
          </span>
        )}
      </button>

      {/* Voice panel — in showcase it appears for the notice / a talk */}
      {panelVisible && (
        <div data-voice-assistant className="tt-animate-pop-in fixed bottom-36 right-4 z-50 w-72 rounded-3xl bg-white p-4 shadow-2xl ring-2 ring-tt-line sm:bottom-24 sm:right-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-tt-ink/50">
              {demoNoticeOpen ? "🎤 Talk to the guide" : listening ? "🎤 Listening…" : "✨ Voice"}
            </p>
            <button
              onClick={() => { setTranscript(""); setResponse(""); setQuiz(null); setPendingConfirm(null); setDemoTalk(false); setDemoNoticeOpen(false); try { recRef.current?.stop(); } catch {} setListening(false); stopShowcaseAudio(); try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); }}
              className="rounded-full bg-tt-cream px-2 py-0.5 text-xs font-bold text-tt-ink/60"
            >
              ✕
            </button>
          </div>
          {showcase && demoNoticeOpen && (
            <div className="mt-2">
              <p className="text-sm font-semibold leading-6 text-tt-ink">
                Your voice is heard <span className="font-black">live and never saved</span>. Your browser turns your words into text on the spot, and the guide answers from this page only.
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-tt-ink/60">
                Grown-ups: this demo collects nothing — no account, no recording, no stored transcript.
              </p>
              <div className="mt-3 grid gap-1.5">
                <button
                  onClick={acceptDemoNotice}
                  className="tt-btn-press rounded-xl bg-tt-pine px-3 py-2.5 text-sm font-black text-white"
                >
                  🎤 Start talking
                </button>
                <button
                  onClick={() => { setDemoNoticeOpen(false); setDemoTalk(false); }}
                  className="tt-btn-press rounded-xl bg-tt-cream px-3 py-2 text-xs font-black text-tt-ink/70"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
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
          {!demoNoticeOpen && !quiz?.current && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => handleLocalAction({ type: "read-page" }, "")}
                className="tt-btn-press rounded-full bg-tt-cream px-2.5 py-1.5 text-xs font-black text-tt-ink ring-1 ring-tt-line"
              >
                📖 Read this page
              </button>
              <button
                onClick={() => handleLocalAction({ type: "read-missions" }, "")}
                className="tt-btn-press rounded-full bg-tt-cream px-2.5 py-1.5 text-xs font-black text-tt-ink ring-1 ring-tt-line"
              >
                🎯 My missions
              </button>
              <button
                onClick={() => handleLocalAction({ type: "read-balance" }, "")}
                className="tt-btn-press rounded-full bg-tt-cream px-2.5 py-1.5 text-xs font-black text-tt-ink ring-1 ring-tt-line"
              >
                ⭐ My points
              </button>
            </div>
          )}
          {!listening && !transcript && !demoNoticeOpen && (
            <p className="mt-2 text-xs text-tt-ink/50">
              Just talk — say "my missions", "I did it", or "how many points do I have?"
            </p>
          )}
          {showcase && !demoNoticeOpen && (
            <p className="mt-2 border-t border-tt-line pt-2 text-[11px] font-bold leading-4 text-tt-ink/50">
              🎤 Heard live, never saved — demo answers come from this page only.
            </p>
          )}
        </div>
      )}
    </>
  );
}
