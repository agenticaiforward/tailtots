/**
 * ChoiceAdventure — branching narrative missions for decision intelligence.
 *
 * Flow: invite → story (pick a path) → outcome → rewind (try other paths)
 *       → journal (reflect) → done.
 *
 * "Lantern, not leash":
 * - Adventures are INVITATIONS. Skipping is invisible — no tracking, no guilt.
 * - There are no right answers. Outcomes are consequences, not judgments.
 * - We never grade decisions. We celebrate that the child is thinking.
 *
 * Visual-first: big emoji, minimal text, path-road branching.
 * Age-adaptive: Sprout = giant buttons + 2 choices, Thrive = dilemmas.
 */
"use client";

import { useRef, useState } from "react";
import type { ChoiceAgeMode, ChoiceArchetype, ChoicePrediction, ChoiceScenario, OutcomeFeeling } from "../../lib/ai/choice-adventures";
import { predictionReflection, socraticPromptFor } from "../../lib/ai/choice-adventures";
import { Rewind, type RewindState } from "./Rewind";
import { DecisionJournal, type JournalEntry } from "./DecisionJournal";
import { TellItIn3 } from "./SynthesisMoments";

export interface AdventurePlaythrough {
  scenarioId: string;
  firstChoiceId: string;
  /** Archetype of the first pick — for pattern detection (internal only). */
  firstChoiceArchetype?: ChoiceArchetype;
  exploredChoiceIds: string[];
  rewindCount: number;
  /** ms from story shown to first choice — for pattern detection */
  firstDecisionTimeMs: number;
  /** Socratic prediction, made before the outcome revealed. */
  prediction?: ChoicePrediction;
  journal?: JournalEntry;
  completedAt: string;
}

type Phase = "invite" | "story" | "predict" | "outcome" | "rewind" | "journal" | "sumup" | "done";

export function ChoiceAdventure({
  scenario,
  ageMode,
  childName,
  childId,
  onComplete,
  onSkip,
}: {
  scenario: ChoiceScenario;
  ageMode: ChoiceAgeMode;
  childName: string;
  /** Optional — enables question persistence in the journal. */
  childId?: string;
  onComplete: (playthrough: AdventurePlaythrough) => void;
  onSkip: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("invite");
  const [firstChoiceId, setFirstChoiceId] = useState<string | null>(null);
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [pendingArchetype, setPendingArchetype] = useState<ChoiceArchetype | null>(null);
  const [prediction, setPrediction] = useState<ChoicePrediction | null>(null);
  const [predictedFeeling, setPredictedFeeling] = useState<OutcomeFeeling | null>(null);
  const [predictNote, setPredictNote] = useState("");
  const [rewindState, setRewindState] = useState<RewindState | null>(null);
  const [pendingJournal, setPendingJournal] = useState<JournalEntry | undefined>(undefined);
  const [tellItIn3, setTellItIn3] = useState<string[] | null>(null);
  const storyShownAt = useRef<number>(0);

  const pickFirst = (choiceId: string) => {
    const choice = scenario.choices.find((c) => c.id === choiceId);
    setPendingChoiceId(choiceId);
    setPendingArchetype(choice?.archetype ?? null);
    setPhase("predict");
  };
  const submitPrediction = () => {
    if (!pendingChoiceId || !predictedFeeling) return;
    setPrediction({
      choiceId: pendingChoiceId,
      predictedFeeling,
      note: predictNote.trim() || undefined,
      predictedAtMs: Date.now(),
    });
    setFirstChoiceId(pendingChoiceId);
    setPendingChoiceId(null);
    setPhase("outcome");
  };

  const finishRewind = (state: RewindState) => {
    setRewindState(state);
    setPhase("journal");
  };

  const finishJournal = (journal?: JournalEntry) => {
    // Journal saved locally; completion fires after the sum-up beat.
    setPendingJournal(journal);
    setPhase("sumup");
  };

  const finishSumUp = (parts: string[] | null) => {
    if (!firstChoiceId || !rewindState) return;
    setTellItIn3(parts);
    onComplete({
      scenarioId: scenario.id,
      firstChoiceId,
      firstChoiceArchetype: pendingArchetype ?? undefined,
      exploredChoiceIds: rewindState.exploredChoiceIds,
      rewindCount: rewindState.rewindCount,
      firstDecisionTimeMs: Math.max(0, Date.now() - storyShownAt.current),
      prediction: prediction ?? undefined,
      journal: pendingJournal,
      completedAt: new Date().toISOString(),
    });
    setPhase("done");
  };

  /* ---------------- INVITE (lantern framing) ---------------- */
  if (phase === "invite") {
    return (
      <div className="rounded-3xl border-2 border-dashed border-[#a855f7]/50 bg-gradient-to-br from-[#faf5ff] to-white p-6 text-center sm:p-8">
        <p className="text-6xl" aria-hidden="true">
          <span className="inline-block animate-[pet-wiggle_2.4s_ease-in-out_infinite]">🌿</span>
        </p>
        <h3 className="mt-3 text-2xl font-black text-[#17231f]">A Choice Adventure awaits!</h3>
        <p className="mx-auto mt-2 max-w-sm text-base font-bold text-[#4f625b]">
          <span className="text-[#7c3aed]">{scenario.emoji} {scenario.title}</span> — a little story where{" "}
          <span className="font-black">you</span> decide what happens.
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              storyShownAt.current = Date.now();
              setPhase("story");
            }}
            className="rounded-full bg-[#7c3aed] px-10 py-4 text-lg font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Let&apos;s go! 🚀
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-bold text-[#8b7bb5] underline decoration-dotted underline-offset-4 hover:text-[#6b5b8e]"
          >
            Maybe later
          </button>
        </div>
        <p className="mx-auto mt-4 max-w-xs text-xs font-semibold text-[#a89bc4]">
          No pressure — adventures wait patiently. Skipping is always okay. 💜
        </p>
      </div>
    );
  }

  /* ---------------- STORY (pick a path) ---------------- */
  if (phase === "story") {
    const isSprout = ageMode === "sprout";
    return (
      <div className="rounded-3xl border border-[#a855f7]/30 bg-white p-5 shadow-sm sm:p-7">
        <div className="text-center">
          <p className="text-5xl sm:text-6xl" aria-hidden="true">{scenario.emoji}</p>
          <h3 className={`${isSprout ? "text-3xl" : "text-2xl"} mt-3 font-black text-[#17231f]`}>
            {scenario.title}
          </h3>
          <p className={`mx-auto mt-3 max-w-lg font-bold leading-7 text-[#4f625b] ${isSprout ? "text-xl" : "text-base"}`}>
            {scenario.setup}
          </p>
          <p className="mt-4 text-sm font-black uppercase tracking-[0.15em] text-[#7c3aed]">
            What will you do?
          </p>
        </div>
        <div className={`mt-5 grid gap-3 ${isSprout ? "" : "sm:grid-cols-2"}`}>
          {scenario.choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => pickFirst(choice.id)}
              className={`group flex items-center gap-4 rounded-2xl border-2 border-[#e9d5ff] bg-[#faf5ff] text-left shadow-sm transition-all hover:scale-[1.02] hover:border-[#a855f7] hover:shadow-md active:scale-[0.99] ${
                isSprout ? "p-6" : "p-4"
              }`}
            >
              <span
                className={`grid shrink-0 place-items-center rounded-2xl bg-white shadow-sm transition-transform group-hover:rotate-12 ${
                  isSprout ? "size-16 text-4xl" : "size-14 text-3xl"
                }`}
                aria-hidden="true"
              >
                {choice.emoji}
              </span>
              <span className={`font-black text-[#17231f] ${isSprout ? "text-2xl" : "text-lg"}`}>
                {choice.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---------------- PREDICT (Socratic mode — think AHEAD) ---------------- */
  if (phase === "predict" && pendingChoiceId) {
    const choice = scenario.choices.find((c) => c.id === pendingChoiceId);
    if (!choice) return null;
    const FEELINGS: { feeling: OutcomeFeeling; emoji: string; label: string }[] = [
      { feeling: "happy", emoji: "😊", label: "Something good" },
      { feeling: "okay", emoji: "😐", label: "Something okay" },
      { feeling: "tricky", emoji: "😟", label: "Something tricky" },
    ];
    return (
      <div className="rounded-3xl border-2 border-[#6366f1]/40 bg-gradient-to-br from-[#eef2ff] to-white p-5 text-center shadow-sm sm:p-7">
        <p className="inline-block animate-[reward-pop_2.6s_ease-in-out_infinite] text-5xl" aria-hidden="true">
          🔮
        </p>
        <h3 className="mt-3 text-2xl font-black text-[#17231f]">Wait — predict first!</h3>
        <p className="mx-auto mt-2 max-w-md text-base font-bold leading-7 text-[#4f625b]">
          {socraticPromptFor(ageMode, choice.label)}
        </p>
        <div className="mt-5 flex justify-center gap-3" role="radiogroup" aria-label="What do you think will happen?">
          {FEELINGS.map((f) => (
            <button
              key={f.feeling}
              type="button"
              role="radio"
              aria-checked={predictedFeeling === f.feeling}
              title={f.label}
              onClick={() => setPredictedFeeling(f.feeling)}
              className={`flex flex-col items-center gap-1 rounded-2xl px-5 py-4 transition-all ${
                predictedFeeling === f.feeling
                  ? "scale-110 bg-[#6366f1] shadow-lg ring-4 ring-[#c7d2fe]"
                  : "bg-white ring-1 ring-[#c7d2fe] hover:scale-105 hover:bg-[#eef2ff]"
              }`}
            >
              <span className="text-4xl" aria-hidden="true">{f.emoji}</span>
              <span className={`text-xs font-black ${predictedFeeling === f.feeling ? "text-white" : "text-[#4f625b]"}`}>
                {f.label}
              </span>
            </button>
          ))}
        </div>
        {ageMode !== "sprout" && (
          <input
            type="text"
            value={predictNote}
            onChange={(e) => setPredictNote(e.target.value)}
            placeholder={ageMode === "thrive" ? "I think ___ will happen because…" : "I think…"}
            maxLength={120}
            className="mx-auto mt-4 block w-full max-w-md rounded-xl border-2 border-[#c7d2fe] bg-white px-3 py-2.5 text-sm font-bold text-[#17231f] outline-none focus:border-[#6366f1]"
          />
        )}
        <button
          type="button"
          onClick={submitPrediction}
          disabled={!predictedFeeling}
          className={`mt-6 rounded-full px-10 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${
            predictedFeeling ? "bg-[#4f46e5]" : "cursor-not-allowed bg-[#9ca3af]"
          }`}
        >
          Reveal what happens ✨
        </button>
        <p className="mx-auto mt-3 max-w-xs text-xs font-semibold text-[#a89bc4]">
          Predicting is thinking ahead — the skill behind every great decision. 🔮
        </p>
      </div>
    );
  }

  /* ---------------- OUTCOME (consequence, not judgment) ---------------- */
  if (phase === "outcome" && firstChoiceId) {
    const outcome = scenario.outcomes.find((o) => o.choiceId === firstChoiceId);
    const choice = scenario.choices.find((c) => c.id === firstChoiceId);
    if (!outcome || !choice) return null;
    return (
      <div className="rounded-3xl border border-[#a855f7]/30 bg-white p-5 text-center shadow-sm sm:p-7">
        <p className="inline-block animate-[reward-pop_0.8s_ease-out] text-6xl" aria-hidden="true">
          {outcome.emoji}
        </p>
        <h3 className="mt-3 text-2xl font-black text-[#17231f]">{outcome.headline}</h3>
        <p className="mx-auto mt-3 max-w-lg text-base font-bold leading-7 text-[#4f625b]">
          {outcome.story}
        </p>
        {prediction && (
          <p className="mx-auto mt-3 max-w-md rounded-2xl bg-[#eef2ff] p-3 text-sm font-bold text-[#4f46e5]">
            {predictionReflection(prediction.predictedFeeling, outcome.feeling, childName)}
          </p>
        )}
        <p className="mx-auto mt-3 max-w-md text-xs font-semibold text-[#a89bc4]">
          You chose {choice.emoji} {choice.label} — nice deciding, {childName}!
        </p>
        <button
          type="button"
          onClick={() => setPhase("rewind")}
          className="mt-6 rounded-full bg-[#7c3aed] px-8 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          ⏪ What if I&apos;d chosen differently?
        </button>
      </div>
    );
  }

  /* ---------------- REWIND ---------------- */
  if (phase === "rewind" && firstChoiceId) {
    return (
      <Rewind
        scenario={scenario}
        firstChoiceId={firstChoiceId}
        ageMode={ageMode}
        childName={childName}
        onDone={finishRewind}
      />
    );
  }

  /* ---------------- JOURNAL ---------------- */
  if (phase === "journal") {
    return (
      <DecisionJournal
        scenario={scenario}
        exploredChoiceIds={rewindState?.exploredChoiceIds ?? []}
        ageMode={ageMode}
        childName={childName}
        childId={childId}
        onSave={(journal) => {
          finishJournal(journal);
          setPhase("sumup");
        }}
        onSkip={() => {
          finishJournal(undefined);
          setPhase("sumup");
        }}
      />
    );
  }

  /* ---------------- SUM UP (Tell it in 3 — compression as synthesis) ---------------- */
  if (phase === "sumup") {
    return (
      <TellItIn3
        storyTitle={scenario.title}
        ageMode={ageMode}
        childName={childName}
        onDone={finishSumUp}
      />
    );
  }

  /* ---------------- DONE ---------------- */
  return (
    <div className="rounded-3xl border border-[#22c55e]/40 bg-gradient-to-br from-[#f0fdf4] to-white p-6 text-center sm:p-8">
      <p className="text-6xl" aria-hidden="true">🌟</p>
      <h3 className="mt-3 text-2xl font-black text-[#17231f]">Adventure complete!</h3>
      <p className="mx-auto mt-2 max-w-sm text-base font-bold text-[#4f625b]">
        You thought, you chose, you explored. That&apos;s what great thinkers do, {childName}. 🧠💛
      </p>
      <p className="mx-auto mt-3 max-w-xs text-xs font-semibold text-[#a89bc4]">
        We don&apos;t track whether choices were good or bad. We celebrate that you&apos;re thinking.
      </p>
    </div>
  );
}
