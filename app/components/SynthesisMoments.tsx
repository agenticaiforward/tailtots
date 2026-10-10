/**
 * SynthesisMoments — fast understanding as play.
 *
 * The future-skills trio, part 3: SYNTHESIZE FAST.
 *  - ConnectTheDots: two missions, one question — "what's the SAME?"
 *  - TellItIn3: compress any story into 3 (emojis → sentences → 1 sentence)
 *  - TeachYourPet: Feynman technique — explain it simply to your pet
 *  - WeeklySynthesis: ONE distilling question per week
 *  - PatternSpotter: the kid as analyst of their own choices
 *
 * Playful challenge framing, never punitive. No anxiety timers — a friendly
 * countdown that encourages, never fails.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import type { Mission } from "../../lib/types";
import {
  dotQuestion,
  makeDotPair,
  petReactionFor,
  spotBehaviorPattern,
  teachYourPetPrompt,
  tellItIn3Prompt,
  validateTellItIn3,
  weeklySynthesisQuestion,
  type SynthesisAgeMode,
} from "../../lib/ai/synthesis-missions";

const SYNTHESIS_KEY = "tailtots-synthesis-v1";

function logSynthesis(childId: string, kind: "dots" | "teach") {
  try {
    const raw = localStorage.getItem(SYNTHESIS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const all = (Array.isArray(arr) ? arr : [])
      .concat({ childId, kind, at: new Date().toISOString() })
      .slice(-200);
    localStorage.setItem(SYNTHESIS_KEY, JSON.stringify(all));
  } catch {
    /* best effort */
  }
}

/** Counts for the parent growth card. */
export function synthesisCountsFor(childId: string): { dotsConnected: number; taughtPet: boolean } {
  if (typeof localStorage === "undefined") return { dotsConnected: 0, taughtPet: false };
  try {
    const raw = localStorage.getItem(SYNTHESIS_KEY);
    const arr: { childId: string; kind: string; at: string }[] = raw ? JSON.parse(raw) : [];
    const weekAgo = Date.now() - 7 * 86400000;
    const mine = (Array.isArray(arr) ? arr : []).filter(
      (e) => e.childId === childId && new Date(e.at).getTime() >= weekAgo
    );
    return {
      dotsConnected: mine.filter((e) => e.kind === "dots").length,
      taughtPet: mine.some((e) => e.kind === "teach"),
    };
  } catch {
    return { dotsConnected: 0, taughtPet: false };
  }
}

/* ------------------------------------------------------------------ */
/* ConnectTheDots — "what's the same about these two?"                 */
/* ------------------------------------------------------------------ */

export function ConnectTheDots({
  missions,
  childId,
  childName,
  onConnected,
}: {
  missions: Mission[];
  childId: string;
  childName: string;
  onConnected?: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const pair = useMemo(() => {
    const done = missions.filter(
      (m) =>
        (!m.assignedChildId || m.assignedChildId === childId) &&
        (Boolean(m.completedBy) || m.status === "approved")
    );
    return makeDotPair(
      done.map((m) => ({ title: m.title, category: m.category, emoji: "✨" }))
    );
  }, [missions, childId, answered]);

  if (!pair) return null;

  const options = useMemo(() => {
    const all = [pair.connection, ...pair.distractors];
    // deterministic shuffle by title hash — stable, no useMemo randomness
    let h = 0;
    for (const c of pair.missionA.title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return [...all].sort((a, b) => (a.length * 7 + h) % 5 - (b.length * 7 + h) % 5);
  }, [pair]);

  const correct = picked === pair.connection;

  return (
    <div className="rounded-3xl border-2 border-[#0ea5e9]/30 bg-gradient-to-br from-[#f0f9ff] to-white p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0284c7]">
        🔗 Connect the dots
      </p>
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="flex-1 rounded-2xl bg-white p-3 text-center ring-1 ring-[#bae6fd]">
          <p className="text-2xl" aria-hidden="true">{pair.missionA.emoji}</p>
          <p className="mt-1 text-xs font-black text-[#17231f]">{pair.missionA.title}</p>
        </div>
        <span className="text-3xl" aria-hidden="true">🔗</span>
        <div className="flex-1 rounded-2xl bg-white p-3 text-center ring-1 ring-[#bae6fd]">
          <p className="text-2xl" aria-hidden="true">{pair.missionB.emoji}</p>
          <p className="mt-1 text-xs font-black text-[#17231f]">{pair.missionB.title}</p>
        </div>
      </div>
      <p className="mt-4 text-center text-base font-black text-[#17231f]">{dotQuestion()}</p>
      {!answered ? (
        <div className="mt-3 grid gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setPicked(opt);
                setAnswered(true);
                if (opt === pair.connection) {
                  logSynthesis(childId, "dots");
                  onConnected?.();
                }
              }}
              className="rounded-2xl border-2 border-[#bae6fd] bg-white p-3 text-left text-sm font-bold text-[#17231f] transition-all hover:scale-[1.01] hover:border-[#0ea5e9] hover:shadow-md active:scale-[0.99]"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div
          className={`mt-3 rounded-2xl p-4 text-center ${
            correct ? "bg-gradient-to-r from-[#0ea5e9] to-[#0284c7]" : "bg-[#fffbeb] ring-1 ring-[#fde68a]"
          }`}
        >
          <p className={`text-4xl`} aria-hidden="true">{correct ? pair.connectionEmoji : "💡"}</p>
          <p className={`mt-2 text-base font-black ${correct ? "text-white" : "text-[#17231f]"}`}>
            {correct
              ? `YES! ${pair.connection} ${childName}, you spotted the pattern! 🧠✨`
              : `Good thinking! The connection was: ${pair.connection}`}
          </p>
          {!correct && (
            <p className="mt-1 text-xs font-bold text-[#8b7bb5]">
              Spotting connections is a muscle — it grows every time you try. 💪
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TellItIn3 — compression as synthesis.                               */
/* ------------------------------------------------------------------ */

export function TellItIn3({
  storyTitle,
  ageMode,
  childName,
  onDone,
}: {
  storyTitle: string;
  ageMode: SynthesisAgeMode;
  childName: string;
  onDone: (parts: string[] | null) => void;
}) {
  const [parts, setParts] = useState<string[]>(["", "", ""]);
  const [oneLiner, setOneLiner] = useState("");
  const [bossMode, setBossMode] = useState(false);

  const valid = validateTellItIn3(parts, ageMode);

  const setPart = (i: number, v: string) => {
    setParts((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  };

  return (
    <div className="rounded-3xl border-2 border-[#8b5cf6]/30 bg-gradient-to-br from-[#f5f3ff] to-white p-5 text-center sm:p-7">
      <p className="text-5xl" aria-hidden="true">🗜️</p>
      <h3 className="mt-3 text-2xl font-black text-[#17231f]">Sum it up in 3!</h3>
      <p className="mx-auto mt-2 max-w-md text-base font-bold text-[#4f625b]">
        {tellItIn3Prompt(ageMode, storyTitle)}
      </p>
      <div className="mx-auto mt-5 grid max-w-lg gap-3">
        {parts.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#8b5cf6] text-base font-black text-white">
              {i + 1}
            </span>
            <input
              type="text"
              value={p}
              onChange={(e) => setPart(i, e.target.value)}
              placeholder={
                ageMode === "sprout" ? "😊" : ageMode === "grow" ? "One short sentence…" : "Sentence…"
              }
              maxLength={ageMode === "sprout" ? 12 : 100}
              className="min-w-0 flex-1 rounded-xl border-2 border-[#ddd6fe] bg-white px-3 py-2.5 text-sm font-bold text-[#17231f] outline-none focus:border-[#8b5cf6]"
            />
          </div>
        ))}
      </div>
      {ageMode === "thrive" && valid && !bossMode && (
        <button
          type="button"
          onClick={() => setBossMode(true)}
          className="mt-4 rounded-full bg-[#8b5cf6]/15 px-5 py-2 text-sm font-black text-[#6d28d9] ring-1 ring-[#8b5cf6]/40 transition-transform hover:scale-105"
        >
          🔥 Boss level: now do it in ONE sentence
        </button>
      )}
      {bossMode && (
        <input
          type="text"
          value={oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="The whole story in one sentence…"
          maxLength={140}
          className="mx-auto mt-3 block w-full max-w-lg rounded-xl border-2 border-[#8b5cf6] bg-white px-3 py-2.5 text-sm font-black text-[#17231f] outline-none"
        />
      )}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => onDone(valid ? (bossMode && oneLiner.trim() ? [oneLiner.trim()] : parts.filter((p) => p.trim())) : null)}
          disabled={!valid}
          className={`rounded-full px-10 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${
            valid ? "bg-[#17231f]" : "cursor-not-allowed bg-[#9ca3af]"
          }`}
        >
          {valid ? "Nailed it! ✨" : ageMode === "sprout" ? "Add an emoji!" : "Add a little more!"}
        </button>
        <div>
          <button
            type="button"
            onClick={() => onDone(null)}
            className="mt-3 text-sm font-bold text-[#8b7bb5] underline decoration-dotted underline-offset-4 hover:text-[#6b5b8e]"
          >
            Skip
          </button>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-xs text-xs font-semibold text-[#a89bc4]">
        Finding what matters — and dropping the rest — is a superpower, {childName}. 🦸
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TeachYourPet — Feynman technique for kids.                          */
/* ------------------------------------------------------------------ */

export function TeachYourPet({
  petName,
  petEmoji,
  topic,
  ageMode,
  childId,
  onDone,
}: {
  petName: string;
  petEmoji?: string;
  topic: string;
  ageMode: SynthesisAgeMode;
  childId: string;
  onDone?: () => void;
}) {
  const [teaching, setTeaching] = useState(false);
  const [taught, setTaught] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const finishTeaching = () => {
    logSynthesis(childId, "teach");
    setTeaching(false);
    setTaught(true);
    onDone?.();
  };

  const startTeaching = () => {
    setTeaching(true);
    setElapsed(0);
    const t0 = Date.now();
    const tick = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setElapsed(s);
      if (s >= 30) {
        window.clearInterval(tick);
        finishTeaching();
      }
    }, 500);
  };

  const reaction = petReactionFor(topic);

  return (
    <div className="rounded-3xl border-2 border-[#f59e0b]/40 bg-gradient-to-br from-[#fffbeb] to-white p-5 text-center sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b45309]">
        🎓 Teach your pet
      </p>
      {!taught ? (
        <>
          <p className="mx-auto mt-2 max-w-md text-base font-bold leading-7 text-[#4f625b]">
            {teachYourPetPrompt(petName, topic, ageMode)}
          </p>
          <div className="mt-4 flex justify-center">
            <span className="inline-block text-6xl" aria-hidden="true">
              <span className={teaching ? "inline-block animate-[pet-wiggle_1.2s_ease-in-out_infinite]" : ""}>
                {petEmoji ?? "🐾"}
              </span>
            </span>
          </div>
          {!teaching ? (
            <button
              type="button"
              onClick={startTeaching}
              className="mt-4 rounded-full bg-[#f59e0b] px-8 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              Start teaching! 🎤
            </button>
          ) : (
            <div className="mt-4">
              <div className="mx-auto h-3 w-48 overflow-hidden rounded-full bg-[#fde68a]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] transition-all duration-500"
                  style={{ width: `${Math.min(100, (elapsed / 30) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-black text-[#b45309]">
                Teaching… {elapsed}s — take your time, no rush! 💛
              </p>
              <button
                type="button"
                onClick={finishTeaching}
                className="mt-2 text-sm font-bold text-[#8b7bb5] underline decoration-dotted underline-offset-4"
              >
                Done early — {petName} got it!
              </button>
            </div>
          )}
          <p className="mx-auto mt-3 max-w-xs text-xs font-semibold text-[#a89bc4]">
            The timer is just for fun — it never fails you. Teaching is the win. 🎓
          </p>
        </>
      ) : (
        <div className="animate-[reward-pop_0.6s_ease-out]">
          <p className="text-5xl" aria-hidden="true">{petEmoji ?? "🐾"}</p>
          <p className="mt-2 text-lg font-black text-[#17231f]">
            {petName} {reaction}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-bold text-[#4f625b]">
            If you can teach it simply, you really understand it. That&apos;s the Feynman test — and you passed! 🎓✨
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WeeklySynthesis — ONE distilling question per week.                  */
/* ------------------------------------------------------------------ */

export function WeeklySynthesis({
  childName,
  childId,
  onDone,
}: {
  childName: string;
  childId: string;
  onDone?: (insight: string | null) => void;
}) {
  const [insight, setInsight] = useState("");
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!insight.trim()) {
      onDone?.(null);
      return;
    }
    try {
      const key = "tailtots-weekly-synthesis-v1";
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({ childId, text: insight.trim().slice(0, 200), at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr.slice(-52)));
    } catch {
      /* best effort */
    }
    setSaved(true);
    onDone?.(insight.trim());
  };

  if (saved) {
    return (
      <div className="rounded-3xl border border-[#22c55e]/40 bg-gradient-to-br from-[#f0fdf4] to-white p-5 text-center">
        <p className="text-4xl" aria-hidden="true">🌟</p>
        <p className="mt-2 text-base font-black text-[#17231f]">
          One big takeaway — that&apos;s distilling a whole week into wisdom, {childName}!
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-[#22c55e]/50 bg-gradient-to-br from-[#f0fdf4] to-white p-5 text-center sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#15803d]">
        🌟 Week review — one question
      </p>
      <p className="mx-auto mt-2 max-w-md text-lg font-black leading-7 text-[#17231f]">
        {weeklySynthesisQuestion(childName)}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-xs font-bold text-[#8b7bb5]">
        Not a list of what you did — the ONE thing you figured out.
      </p>
      <input
        type="text"
        value={insight}
        onChange={(e) => setInsight(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="The biggest thing I figured out…"
        maxLength={200}
        className="mx-auto mt-4 block w-full max-w-md rounded-xl border-2 border-[#bbf7d0] bg-white px-3 py-2.5 text-sm font-bold text-[#17231f] outline-none focus:border-[#22c55e]"
      />
      <button
        type="button"
        onClick={save}
        className="mt-3 rounded-full bg-[#15803d] px-8 py-3 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        That&apos;s my one! 🌟
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PatternSpotter — the kid as analyst of their own choices.            */
/* ------------------------------------------------------------------ */

export function PatternSpotter({
  archetypeCounts,
  childName,
  ageMode,
}: {
  archetypeCounts: Record<string, number>;
  childName: string;
  ageMode: SynthesisAgeMode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const spot = spotBehaviorPattern(archetypeCounts, childName);
  if (!spot) return null;

  const options =
    ageMode === "sprout"
      ? ["😊 I like being kind", "🦁 I like being brave", "🤔 I think first"]
      : ["I think I'm a kind decider", "I think I'm a careful thinker", "I'm still figuring me out — and that's cool"];

  return (
    <div className="rounded-3xl border border-[#a855f7]/30 bg-gradient-to-br from-[#faf5ff] to-white p-5 text-center sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">
        🔍 You, the scientist
      </p>
      <p className="mt-2 text-4xl" aria-hidden="true">{spot.observationEmoji}</p>
      <p className="mt-2 text-base font-black text-[#17231f]">{spot.observation}</p>
      <p className="mt-1 text-sm font-bold text-[#4f625b]">{spot.question}</p>
      {!picked ? (
        <div className="mt-4 grid gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setPicked(opt)}
              className="rounded-2xl border-2 border-[#e9d5ff] bg-white p-3 text-sm font-bold text-[#17231f] transition-all hover:scale-[1.01] hover:border-[#a855f7] hover:shadow-md"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-[#f5f3ff] p-4 text-sm font-black text-[#5b4a8a] animate-[reward-pop_0.6s_ease-out]">
          &ldquo;{picked}&rdquo; — noticing yourself is the deepest thinking there is, {childName}. 🪞✨
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SynthesisZone — composes all synthesis moments for the kid view.    */
/* ------------------------------------------------------------------ */

export function SynthesisZone({
  child,
  missions,
  petName,
  petEmoji,
}: {
  child: { id: string; name: string; age: number };
  missions: Mission[];
  petName?: string;
  petEmoji?: string;
}) {
  const [archetypes, setArchetypes] = useState<Record<string, number> | null>(null);

  // Archetype counts come from localStorage playthroughs — client only.
  useEffect(() => {
    import("./ChoiceAdventureSpot").then((mod) => {
      setArchetypes(mod.archetypeCountsFor(child.id));
    });
  }, [child.id]);

  const ageMode: SynthesisAgeMode =
    child.age <= 6 ? "sprout" : child.age <= 9 ? "grow" : "thrive";

  return (
    <div className="mt-4 grid gap-4">
      <ConnectTheDots missions={missions} childId={child.id} childName={child.name} />
      {petName && (
        <TeachYourPet
          petName={petName}
          petEmoji={petEmoji}
          topic="sharing"
          ageMode={ageMode}
          childId={child.id}
        />
      )}
      {archetypes && (
        <PatternSpotter archetypeCounts={archetypes} childName={child.name} ageMode={ageMode} />
      )}
      <WeeklySynthesis childName={child.name} childId={child.id} />
    </div>
  );
}
