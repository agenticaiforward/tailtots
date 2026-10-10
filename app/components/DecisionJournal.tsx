/**
 * DecisionJournal — post-adventure reflection, age-adaptive.
 *
 * "I chose ___ → ___ happened → Next time I might ___"
 *
 * - Sprout (4-6): emoji-based. No reading required. "How did the endings feel?"
 * - Grow (7-9): simple sentence starters with big tap targets.
 * - Thrive (10-12): deeper prompts. "What surprised you about the other ending?"
 *
 * The journal is the child's private thinking space. Parents see growth
 * language ("explored 4 endings"), never the journal's contents — unless
 * the child chooses to share. Lantern, not leash.
 */
"use client";

import { useState } from "react";
import type { AdventureOutcome, ChoiceAgeMode, ChoiceScenario } from "../../lib/ai/choice-adventures";

export interface JournalEntry {
  /** feeling per explored ending: choiceId → emoji */
  feelings: Record<string, string>;
  /** "I chose ___ because ___" (grow+) */
  because?: string;
  /** "Next time I might ___" (grow+) */
  nextTime?: string;
  /** "What surprised you?" (thrive) */
  surprise?: string;
  savedAt: string;
}

export interface WonderQuestion {
  id: string;
  text: string;
  childId: string;
  askedAt: string;
}

const QUESTIONS_KEY = "tailtots-wonder-questions-v1";

export function loadQuestions(childId: string): WonderQuestion[] {
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return (Array.isArray(arr) ? arr : []).filter((q) => q.childId === childId);
  } catch {
    return [];
  }
}

export function saveQuestion(childId: string, text: string): WonderQuestion {
  const q: WonderQuestion = {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim().slice(0, 140),
    childId,
    askedAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(QUESTIONS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const all = (Array.isArray(arr) ? arr : []).concat(q).slice(-200);
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(all));
  } catch {
    /* best effort */
  }
  return q;
}

/** Count of questions for the parent growth card. */
export function questionCountFor(childId: string): number {
  if (typeof localStorage === "undefined") return 0;
  return loadQuestions(childId).length;
}

const FEELING_OPTIONS = [
  { emoji: "😊", label: "Felt good" },
  { emoji: "😐", label: "Felt okay" },
  { emoji: "😟", label: "Felt tricky" },
];

const BECAUSE_STARTERS = [
  "it felt right",
  "my friend would like it",
  "it seemed fun",
  "I wanted to be kind",
  "I was curious",
];

const NEXT_TIME_STARTERS = [
  "try a different path",
  "ask a grown-up first",
  "think a little longer",
  "do the same again!",
];

export function DecisionJournal({
  scenario,
  exploredChoiceIds,
  ageMode,
  childName,
  childId,
  onSave,
  onSkip,
}: {
  scenario: ChoiceScenario;
  exploredChoiceIds: string[];
  ageMode: ChoiceAgeMode;
  childName: string;
  /** Enables the "My Questions" curiosity log. */
  childId?: string;
  onSave: (entry: JournalEntry) => void;
  onSkip: () => void;
}) {
  const [tab, setTab] = useState<"choices" | "questions">("choices");
  const [feelings, setFeelings] = useState<Record<string, string>>({});
  const [because, setBecause] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [surprise, setSurprise] = useState("");
  const [customBecause, setCustomBecause] = useState(false);
  const [customNext, setCustomNext] = useState(false);
  const [questions, setQuestions] = useState<WonderQuestion[]>(() =>
    childId ? loadQuestions(childId) : []
  );
  const [newQuestion, setNewQuestion] = useState("");

  const exploredOutcomes: { choiceId: string; outcome: AdventureOutcome; label: string; emoji: string }[] =
    exploredChoiceIds
      .map((cid) => {
        const outcome = scenario.outcomes.find((o) => o.choiceId === cid);
        const choice = scenario.choices.find((c) => c.id === cid);
        if (!outcome || !choice) return null;
        return { choiceId: cid, outcome, label: choice.label, emoji: choice.emoji };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

  const allFeelingsSet = exploredOutcomes.every((e) => feelings[e.choiceId]);
  const canSave = ageMode === "sprout" ? allFeelingsSet : allFeelingsSet;

  const save = () => {
    onSave({
      feelings,
      because: because || undefined,
      nextTime: nextTime || undefined,
      surprise: surprise || undefined,
      savedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="rounded-3xl border border-[#f59e0b]/40 bg-gradient-to-br from-[#fffbeb] to-white p-5 sm:p-7">
      <div className="text-center">
        <p className="text-5xl" aria-hidden="true">📓</p>
        <h3 className="mt-3 text-2xl font-black text-[#17231f]">Your thinking journal</h3>
        <p className="mx-auto mt-2 max-w-md text-base font-bold text-[#4f625b]">
          {ageMode === "sprout"
            ? `How did each ending feel, ${childName}? Tap a face!`
            : `A quick think-back, ${childName}. This is just for you — no grades, no scores.`}
        </p>
      </div>

      {/* Tabs: My Choices | My Questions */}
      <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Journal sections">
        {(["choices", "questions"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-black transition-all ${
              tab === t
                ? "bg-[#17231f] text-white shadow"
                : "bg-white text-[#4f625b] ring-1 ring-[#fde68a] hover:bg-[#fffbeb]"
            }`}
          >
            {t === "choices" ? "📓 My Choices" : `❓ My Questions${questions.length > 0 ? ` (${questions.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "questions" ? (
        <div className="mt-6">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#fde68a]">
            <p className="text-sm font-black text-[#17231f]">
              ❓ What&apos;s something you&apos;re wondering about?
            </p>
            <p className="mt-1 text-xs font-bold text-[#8b7bb5]">
              Great thinkers collect questions. What&apos;s yours?
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newQuestion.trim() && childId) {
                    const q = saveQuestion(childId, newQuestion);
                    setQuestions((prev) => [...prev, q]);
                    setNewQuestion("");
                  }
                }}
                placeholder={ageMode === "sprout" ? "I wonder why…" : "I wonder why…"}
                maxLength={140}
                className="min-w-0 flex-1 rounded-xl border-2 border-[#fde68a] bg-white px-3 py-2.5 text-sm font-bold text-[#17231f] outline-none focus:border-[#f59e0b]"
              />
              <button
                type="button"
                disabled={!newQuestion.trim()}
                onClick={() => {
                  if (!childId || !newQuestion.trim()) return;
                  const q = saveQuestion(childId, newQuestion);
                  setQuestions((prev) => [...prev, q]);
                  setNewQuestion("");
                }}
                className="shrink-0 rounded-xl bg-[#f59e0b] px-4 py-2.5 text-sm font-black text-white shadow transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save ❓
              </button>
            </div>
            {!childId && (
              <p className="mt-2 text-xs font-bold text-[#a89bc4]">
                Questions save when you&apos;re signed in as {childName}.
              </p>
            )}
          </div>
          {questions.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {questions.slice().reverse().slice(0, 8).map((q) => (
                <div key={q.id} className="flex items-start gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#fde68a]">
                  <span className="text-xl" aria-hidden="true">❓</span>
                  <p className="text-sm font-bold text-[#17231f]">{q.text}</p>
                </div>
              ))}
              <p className="text-center text-xs font-bold text-[#a89bc4]">
                {questions.length} question{questions.length === 1 ? "" : "s"} collected — curiosity is growing! 🌱
              </p>
            </div>
          ) : (
            <p className="mt-4 text-center text-sm font-bold text-[#a89bc4]">
              No questions yet. The best one starts with &quot;why&quot;… 💭
            </p>
          )}
          {ageMode !== "sprout" && (
            <p className="mx-auto mt-3 max-w-xs text-center text-xs font-semibold text-[#a89bc4]">
              Tip: ask your question to a grown-up, a friend — or even your pet. Pets give the best answers. 🐾
            </p>
          )}
        </div>
      ) : (
      <>
      {/* Feelings per ending — all ages */}
      <div className="mt-6 grid gap-4">
        {exploredOutcomes.map(({ choiceId, outcome, label, emoji }) => (
          <div key={choiceId} className="rounded-2xl bg-white p-4 ring-1 ring-[#fde68a]">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">{outcome.emoji}</span>
              <p className="text-sm font-black text-[#17231f]">
                {emoji} {label} → {outcome.headline}
              </p>
            </div>
            <div className="mt-3 flex justify-center gap-3" role="radiogroup" aria-label={`How did this ending feel: ${outcome.headline}`}>
              {FEELING_OPTIONS.map((f) => (
                <button
                  key={f.emoji}
                  type="button"
                  role="radio"
                  aria-checked={feelings[choiceId] === f.emoji}
                  title={f.label}
                  onClick={() => setFeelings((prev) => ({ ...prev, [choiceId]: f.emoji }))}
                  className={`grid size-14 place-items-center rounded-2xl text-3xl transition-all ${
                    feelings[choiceId] === f.emoji
                      ? "scale-110 bg-[#f59e0b] shadow-lg ring-4 ring-[#fde68a]"
                      : "bg-[#fffbeb] ring-1 ring-[#fde68a] hover:scale-105 hover:bg-[#fef3c7]"
                  }`}
                >
                  <span aria-hidden="true">{f.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Grow+: sentence starters */}
      {ageMode !== "sprout" && (
        <div className="mt-6 grid gap-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#fde68a]">
            <p className="text-sm font-black text-[#17231f]">
              I chose my first path because…
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BECAUSE_STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setBecause(s);
                    setCustomBecause(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
                    because === s && !customBecause
                      ? "bg-[#f59e0b] text-white shadow"
                      : "bg-[#fffbeb] text-[#7a4b12] ring-1 ring-[#fde68a] hover:bg-[#fef3c7]"
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomBecause(true)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  customBecause ? "bg-[#f59e0b] text-white shadow" : "bg-[#fffbeb] text-[#7a4b12] ring-1 ring-dashed ring-[#fde68a]"
                }`}
              >
                ✏️ my own words
              </button>
            </div>
            {customBecause && (
              <input
                type="text"
                value={because}
                onChange={(e) => setBecause(e.target.value)}
                placeholder="Type your reason…"
                maxLength={120}
                className="mt-2 w-full rounded-xl border-2 border-[#fde68a] bg-white px-3 py-2 text-sm font-bold text-[#17231f] outline-none focus:border-[#f59e0b]"
              />
            )}
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-[#fde68a]">
            <p className="text-sm font-black text-[#17231f]">Next time, I might…</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NEXT_TIME_STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setNextTime(s);
                    setCustomNext(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
                    nextTime === s && !customNext
                      ? "bg-[#7c3aed] text-white shadow"
                      : "bg-[#faf5ff] text-[#5b4a8a] ring-1 ring-[#e9d5ff] hover:bg-[#f3e8ff]"
                  }`}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomNext(true)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  customNext ? "bg-[#7c3aed] text-white shadow" : "bg-[#faf5ff] text-[#5b4a8a] ring-1 ring-dashed ring-[#e9d5ff]"
                }`}
              >
                ✏️ my own words
              </button>
            </div>
            {customNext && (
              <input
                type="text"
                value={nextTime}
                onChange={(e) => setNextTime(e.target.value)}
                placeholder="Type your idea…"
                maxLength={120}
                className="mt-2 w-full rounded-xl border-2 border-[#e9d5ff] bg-white px-3 py-2 text-sm font-bold text-[#17231f] outline-none focus:border-[#7c3aed]"
              />
            )}
          </div>

          {/* Thrive: deeper prompt */}
          {ageMode === "thrive" && (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#c4b5fd]">
              <p className="text-sm font-black text-[#17231f]">
                What surprised you about the other ending{exploredOutcomes.length > 2 ? "s" : ""}?
              </p>
              <textarea
                value={surprise}
                onChange={(e) => setSurprise(e.target.value)}
                placeholder="Something unexpected…"
                maxLength={280}
                rows={2}
                className="mt-2 w-full rounded-xl border-2 border-[#e9d5ff] bg-white px-3 py-2 text-sm font-bold text-[#17231f] outline-none focus:border-[#7c3aed]"
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className={`rounded-full px-10 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${
            canSave ? "bg-[#17231f]" : "cursor-not-allowed bg-[#9ca3af]"
          }`}
        >
          Save to my journal 📓
        </button>
        <div>
          <button
            type="button"
            onClick={onSkip}
            className="mt-3 text-sm font-bold text-[#8b7bb5] underline decoration-dotted underline-offset-4 hover:text-[#6b5b8e]"
          >
            Skip journaling
          </button>
        </div>
        <p className="mx-auto mt-3 max-w-xs text-xs font-semibold text-[#a89bc4]">
          🔒 Your journal is yours. Grown-ups see that you&apos;re thinking — never what you wrote, unless you share it.
        </p>
      </div>
      </>
      )}
    </div>
  );
}
