/**
 * Stella Interviews — guided voice conversations (founder, 2026-10-17:
 * "button clicks are fine for the chores, but for AI-driven questions
 * make it entirely voice — like an interview").
 *
 * A small deterministic state machine: an interview is a list of steps;
 * each step asks ONE question, the answer is cleaned (fillers stripped)
 * and stored in a slot; skip/stop are always available; the interview
 * ends with a spoken summary composed from the answers. Open steps in
 * kid interviews stay inside scripted domains (missions, pets, today's
 * activities) — no open-ended probing of a child's life.
 *
 * The engine is pure logic: the VoiceAssistant owns the mic, Stella's
 * voice, and all side effects (saving entries, prefilling setup). The
 * quiz keeps its own server-driven loop (it is the reference interview);
 * starting any conversation ends the other — one conversation at a time.
 */

import { cleanTranscript } from "./intent-local";

export type InterviewRole = "kid" | "parent" | "any";

export interface InterviewStep {
  id: string;
  /** Answer slot name; omit for pure-information steps. */
  slot?: string;
  prompt: string | ((ctx: InterviewContext) => string);
  kind: "open" | "yesno" | "number" | "info";
  /** Skippable with "skip"/"pass". Default true for open, false otherwise. */
  optional?: boolean;
  /** Extract the stored value from the raw answer; null = ask again. */
  extract?: (answer: string) => string | null;
  /** Skip this step entirely when the answers so far say so (e.g. the
   *  pet-kind question when the pet step was skipped — no pet). */
  skipIf?: (answers: Record<string, string>) => boolean;
}

export interface InterviewContext {
  kidName?: string;
  parentName?: string;
  petName?: string;
  petKind?: string;
  missions?: { id: string; title: string; points: number }[];
  missionTitle?: string;
}

export interface InterviewDef {
  id: string;
  title: string;
  role: InterviewRole;
  /** When stopped early, still save what was answered (kid reflection);
   *  false = a stopped interview saves nothing (parent check-in, setup). */
  savePartial: boolean;
  intro: string | ((ctx: InterviewContext) => string);
  steps: InterviewStep[] | ((ctx: InterviewContext) => InterviewStep[]);
  summarize: (answers: Record<string, string>, ctx: InterviewContext) => string;
  stoppedLine: string;
}

export interface InterviewSession {
  defId: string;
  stepIndex: number;
  answers: Record<string, string>;
  done: boolean;
  stopped: boolean;
}

export interface InterviewTurn {
  session: InterviewSession;
  /** What Stella says now (next question, or the closing summary). */
  speak: string;
  done: boolean;
  stopped: boolean;
  /** Answers worth saving (present on done; on stopped only when the
   *  definition allows partial saves and at least one answer exists). */
  saveAnswers?: Record<string, string>;
}

const YES_RE = /^(yes|yeah|yep|yup|ok|okay|sure|of course|please do)[.!]?$/i;
const NO_RE = /^(no|nope|not yet|not really|no thanks)[.!]?$/i;
const STOP_RE = /^(stop|cancel|quit|never ?mind|forget it|i'?m done|done talking|that'?s all)[.!]?$/i;
const SKIP_RE = /^(skip|pass|next|next question|dunno|don'?t know|no idea)[.!]?$/i;

function resolveText(t: string | ((ctx: InterviewContext) => string), ctx: InterviewContext): string {
  return typeof t === "function" ? t(ctx) : t;
}

function stepsOf(def: InterviewDef, ctx: InterviewContext): InterviewStep[] {
  return typeof def.steps === "function" ? def.steps(ctx) : def.steps;
}

function questionLine(def: InterviewDef, session: InterviewSession, ctx: InterviewContext): string {
  const steps = stepsOf(def, ctx);
  const step = steps[session.stepIndex];
  if (!step) return def.summarize(session.answers, ctx);
  return resolveText(step.prompt, ctx);
}

/** Advance past any steps whose skipIf matches the answers so far. */
function skipAhead(def: InterviewDef, session: InterviewSession, ctx: InterviewContext): InterviewSession {
  const steps = stepsOf(def, ctx);
  let s = session;
  while (s.stepIndex < steps.length && steps[s.stepIndex].skipIf?.(s.answers)) {
    s = { ...s, stepIndex: s.stepIndex + 1 };
  }
  return s;
}

export function startInterview(def: InterviewDef, ctx: InterviewContext): InterviewTurn {
  const base: InterviewSession = { defId: def.id, stepIndex: 0, answers: {}, done: false, stopped: false };
  const session = skipAhead(def, base, ctx);
  const intro = resolveText(def.intro, ctx);
  const first = questionLine(def, session, ctx);
  return { session, speak: `${intro} ${first}`.trim(), done: false, stopped: false };
}

export function advanceInterview(
  def: InterviewDef,
  session: InterviewSession,
  rawText: string,
  ctx: InterviewContext,
): InterviewTurn {
  const text = cleanTranscript(rawText) || rawText.trim();
  const steps = stepsOf(def, ctx);
  const step = steps[session.stepIndex];
  const next: InterviewSession = { ...session, answers: { ...session.answers } };

  const finish = (speak: string): InterviewTurn => ({
    session: { ...next, done: true },
    speak,
    done: true,
    stopped: false,
    saveAnswers: next.answers,
  });
  const stopNow = (): InterviewTurn => {
    const hasAnswers = Object.keys(next.answers).length > 0;
    return {
      session: { ...next, stopped: true, done: true },
      speak: def.stoppedLine,
      done: true,
      stopped: true,
      saveAnswers: def.savePartial && hasAnswers ? next.answers : undefined,
    };
  };

  if (!step) return finish(def.summarize(next.answers, ctx));
  if (STOP_RE.test(text)) return stopNow();

  const moveOn = (): InterviewTurn => {
    const s = skipAhead(def, next, ctx);
    if (s.stepIndex >= steps.length) return finish(def.summarize(s.answers, ctx));
    return { session: s, speak: questionLine(def, s, ctx), done: false, stopped: false };
  };

  const optional = step.optional ?? step.kind === "open";
  if (SKIP_RE.test(text)) {
    if (optional) {
      if (step.slot) next.answers[step.slot] = "";
      next.stepIndex += 1;
      return moveOn();
    }
    return { session: next, speak: `Let's try that one — ${resolveText(step.prompt, ctx)}`, done: false, stopped: false };
  }

  // Information steps take no answer: any utterance advances.
  if (step.kind === "info") {
    next.stepIndex += 1;
    return moveOn();
  }

  let value: string | null = null;
  if (step.extract) {
    value = step.extract(text);
  } else if (step.kind === "yesno") {
    if (YES_RE.test(text)) value = "yes";
    else if (NO_RE.test(text)) value = "no";
  } else if (step.kind === "number") {
    const m = text.match(/\b(\d{1,2})\b/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 99) value = String(n);
    }
  } else {
    value = text;
  }

  if (value === null || value === "") {
    if (step.kind === "yesno") {
      return { session: next, speak: `Just say yes or no — ${resolveText(step.prompt, ctx)}`, done: false, stopped: false };
    }
    if (step.kind === "number") {
      return { session: next, speak: `Tell me a number — ${resolveText(step.prompt, ctx)}`, done: false, stopped: false };
    }
    return { session: next, speak: `I didn't catch that — ${resolveText(step.prompt, ctx)}`, done: false, stopped: false };
  }

  if (step.slot) next.answers[step.slot] = value;
  next.stepIndex += 1;
  return moveOn();
}

/* ---------------- interview definitions ---------------- */

const firstName = (ctx: InterviewContext) => ctx.kidName?.split(" ")[0] || "friend";

export const reflectionInterview: InterviewDef = {
  id: "reflection",
  title: "Talk about my day",
  role: "kid",
  savePartial: true,
  intro: (ctx) => `Hi ${firstName(ctx)}! Three quick questions about today. Say skip for any of them, or stop anytime.`,
  steps: (ctx) => [
    {
      id: "proud",
      slot: "proud",
      kind: "open",
      prompt: ctx.missions?.length
        ? "Which mission are you proudest of today?"
        : "What is something good you did today?",
    },
    { id: "hard", slot: "hard", kind: "open", prompt: "What was a little bit hard today?" },
    { id: "tomorrow", slot: "tomorrow", kind: "open", prompt: "What do you want to try tomorrow?" },
  ],
  summarize: () =>
    "Thanks for telling me! I saved that in your growth log for your grown-up to see. Great work today.",
  stoppedLine: "Okay, stopping there — what you told me is saved for your grown-up.",
};

export function briefingInterview(missionTitle: string): InterviewDef {
  return {
    id: "briefing",
    title: "Mission briefing",
    role: "kid",
    savePartial: false,
    intro: `Let's get ready for "${missionTitle}". I'll ask, you think — like a real briefing.`,
    steps: [
      { id: "need", slot: "need", kind: "open", prompt: `For "${missionTitle}" — what do you need first?` },
      { id: "next", slot: "next", kind: "open", prompt: "And what do you do next?" },
      { id: "ready", slot: "ready", kind: "yesno", optional: false, prompt: "Ready to start?" },
    ],
    summarize: (answers) =>
      answers.ready === "no"
        ? "No rush at all. The mission will be right there when you're ready."
        : `You've got this! Say "I did it" when you finish "${missionTitle}".`,
    stoppedLine: "Okay — the briefing stops here. The mission is waiting whenever you are.",
  };
}

export const parentWeeklyInterview: InterviewDef = {
  id: "parent-weekly",
  title: "Weekly check-in",
  role: "parent",
  savePartial: false,
  intro: "Your weekly check-in — three questions, about two minutes. Say skip for any, or stop anytime.",
  steps: [
    { id: "win", slot: "win", kind: "open", prompt: "First — what went well with the kids this week? A win, big or small." },
    { id: "worry", slot: "worry", kind: "open", prompt: "What's one thing you're watching or a little worried about?" },
    { id: "practice", slot: "practice", kind: "open", prompt: "Last one — what's one thing you'd like the kids to practice next week?" },
  ],
  summarize: (a) => {
    const parts = [
      a.win ? `Win: ${a.win}.` : "",
      a.worry ? `Watching: ${a.worry}.` : "",
      a.practice ? `Next week: ${a.practice}.` : "",
    ].filter(Boolean);
    return `Here's your check-in. ${parts.join(" ")} I saved it with your weekly check-ins.`.trim();
  },
  stoppedLine: "Okay — check-in cancelled, nothing saved. We can do it any time.",
};

const kidKindExtract = (answer: string): string | null => {
  const t = answer.toLowerCase();
  if (/\bdog|puppy\b/.test(t)) return "dog";
  if (/\bcat|kitten\b/.test(t)) return "cat";
  if (/\brabbit|bunny\b/.test(t)) return "rabbit";
  if (/\bbird\b/.test(t)) return "bird";
  if (/\bfish\b/.test(t)) return "fish";
  return answer.trim() ? answer.trim() : null;
};

export const setupInterview: InterviewDef = {
  id: "setup",
  title: "Set up by voice",
  role: "parent",
  savePartial: false,
  intro: "Let's set up your family by voice. I'll ask a few questions — then you review everything on screen before it saves.",
  steps: [
    { id: "family", slot: "familyName", kind: "open", optional: false, prompt: "What should we call your family? Like 'The Carter Family' — or just say your last name." },
    { id: "kidname", slot: "kidName", kind: "open", optional: false, prompt: "What's your first child's first name?" },
    { id: "kidage", slot: "kidAge", kind: "number", optional: false, prompt: "How old are they?" },
    { id: "petname", slot: "petName", kind: "open", prompt: "Do you have a pet? Tell me their name — or say skip if your family doesn't have one yet." },
    {
      id: "petkind",
      slot: "petKind",
      kind: "open",
      prompt: "And what kind of animal are they — a dog, a cat, a rabbit, or something else?",
      extract: kidKindExtract,
      skipIf: (answers) => !answers.petName,
    },
  ],
  summarize: (a) => {
    const pet = a.petName ? ` Your pet is ${a.petName} the ${a.petKind || "pet"}.` : " No pet yet — that's fine, kids can sponsor a shelter buddy.";
    return `Here's what I heard. Family: ${a.familyName}. ${a.kidName}, age ${a.kidAge}.${pet} It's on the Setup screen now — check it, fix anything I misheard, then tap Apply. Nothing is saved until you do.`;
  },
  stoppedLine: "Okay — setup by voice cancelled. Nothing was changed.",
};

export const demoInterview: InterviewDef = {
  id: "demo",
  title: "Try an interview",
  role: "any",
  savePartial: false,
  intro: "Let's try a tiny interview — this is how Stella talks with families. First question!",
  steps: [
    { id: "puppy", slot: "puppyName", kind: "open", prompt: "If you could name a puppy anything at all, what name would you pick?" },
    { id: "game", slot: "game", kind: "open", prompt: "And what's the first game you'd teach it?" },
    { id: "missions", slot: "seeMissions", kind: "yesno", optional: false, prompt: "Want to hear the sample family's missions?" },
  ],
  summarize: (a) =>
    `${a.puppyName || "That"} is a great puppy name! In a real family account, Stella interviews kids about their day and grown-ups about their week — and saves it all for the family. This demo saves nothing.`,
  stoppedLine: "Okay, interview over — thanks for trying it! In a real account these talks are saved for the family.",
};

export const INTERVIEWS: Record<string, InterviewDef> = {
  reflection: reflectionInterview,
  "parent-weekly": parentWeeklyInterview,
  setup: setupInterview,
  demo: demoInterview,
};

/**
 * Detect a spoken/typed request to START an interview. Returns the
 * interview id, plus a mission query for briefings. Demo sessions only
 * ever start the demo interview.
 */
export function matchInterviewTrigger(
  rawText: string,
  opts: { role: "kid" | "parent"; showcase: boolean },
): { id: string; missionQuery?: string } | null {
  const t = (cleanTranscript(rawText) || rawText).toLowerCase();
  if (opts.showcase) {
    if (/\b(interview|talk to me|ask me questions|chat with me)\b/.test(t)) return { id: "demo" };
    return null;
  }
  if (/\b(brief|tell me about (this|my|the) mission|walk me through)\b/.test(t)) {
    const q = t
      .replace(/.*brief( me)?( on| about)?/, "")
      .replace(/tell me about (this|my|the) mission/, "")
      .replace(/walk me through( the)?( mission)?/, "")
      .trim();
    return { id: "briefing", missionQuery: q };
  }
  if (opts.role === "kid" && /\b(reflection|talk about (my|today)|ask me about (my )?day|my day interview|how was (my|your) day)\b/.test(t)) {
    return { id: "reflection" };
  }
  if (opts.role === "parent" && /\b(weekly (check|interview)|check-?in interview|parent interview|my weekly)\b/.test(t)) {
    return { id: "parent-weekly" };
  }
  if (opts.role === "parent" && /\b(set up|setup) (by|with) voice\b|\bvoice setup\b/.test(t)) {
    return { id: "setup" };
  }
  return null;
}
