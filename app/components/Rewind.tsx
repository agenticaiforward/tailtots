/**
 * Rewind — the killer mechanic. Counterfactual reasoning as a game.
 *
 * After a kid picks a path in a Choice Adventure, Rewind asks the magic
 * question: "What would have happened if you'd chosen differently?"
 *
 * The kid picks another path, sees that outcome, and can compare endings
 * side by side. There is NO judgment about which was "right" — the learning
 * is in the comparing. Exploring 3 endings gets a celebration.
 *
 * Visual: paths shown as a winding road with branch nodes, not a decision
 * tree diagram. Magical, not mechanical.
 */
"use client";

import { useMemo, useState } from "react";
import type {
  AdventureChoice,
  AdventureOutcome,
  ChoiceAgeMode,
  ChoiceScenario,
  WhyPick,
} from "../../lib/ai/choice-adventures";
import { WHY_BECAUSE_CHIPS } from "../../lib/ai/choice-adventures";

export interface RewindState {
  exploredChoiceIds: string[];
  rewindCount: number;
  /** The "why" round — which ending they liked best and why. */
  whyPick?: WhyPick | null;
}

const REWIND_CELEBRATIONS = [
  "Two endings explored! 🌀",
  "Three endings! You're a what-if explorer! 🌀✨",
  "Every ending! Nothing left unseen! 🌀🌟",
];

export function Rewind({
  scenario,
  firstChoiceId,
  ageMode,
  onDone,
  childName,
}: {
  scenario: ChoiceScenario;
  firstChoiceId: string;
  ageMode: ChoiceAgeMode;
  onDone: (state: RewindState) => void;
  childName: string;
}) {
  const [explored, setExplored] = useState<string[]>([firstChoiceId]);
  const [justExplored, setJustExplored] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [whyBecause, setWhyBecause] = useState("");
  const [customWhy, setCustomWhy] = useState(false);

  const outcomeFor = (choiceId: string): AdventureOutcome | undefined =>
    scenario.outcomes.find((o) => o.choiceId === choiceId);
  const choiceFor = (choiceId: string): AdventureChoice | undefined =>
    scenario.choices.find((c) => c.id === choiceId);

  const unexplored = useMemo(
    () => scenario.choices.filter((c) => !explored.includes(c.id)),
    [scenario.choices, explored]
  );

  const explore = (choiceId: string) => {
    setExplored((prev) => [...prev, choiceId]);
    setJustExplored(choiceId);
    window.setTimeout(() => setJustExplored(null), 1200);
  };

  const rewindCount = explored.length - 1;
  const celebration =
    rewindCount >= 1 ? REWIND_CELEBRATIONS[Math.min(rewindCount - 1, REWIND_CELEBRATIONS.length - 1)] : null;

  return (
    <div className="rounded-3xl border-2 border-[#a855f7]/40 bg-gradient-to-br from-[#faf5ff] to-[#f3e8ff] p-5 sm:p-7">
      {/* The magic question */}
      <div className="text-center">
        <p className="inline-block animate-[reward-pop_2.6s_ease-in-out_infinite] text-5xl" aria-hidden="true">
          ⏪
        </p>
        <h3 className="mt-3 text-2xl font-black text-[#17231f] sm:text-3xl">
          What if you&apos;d chosen differently?
        </h3>
        <p className="mx-auto mt-2 max-w-md text-base font-bold text-[#6b5b8e]">
          Rewind time and try another path. There&apos;s no wrong answer — just different adventures.
        </p>
      </div>

      {/* Path road — winding visual of explored + unexplored paths */}
      <div className="mt-6" aria-label="Adventure paths">
        <div className="flex items-center justify-center gap-1 sm:gap-2">
          {scenario.choices.map((choice, i) => {
            const isExplored = explored.includes(choice.id);
            const isFirst = choice.id === firstChoiceId;
            const isNew = choice.id === justExplored;
            return (
              <div key={choice.id} className="flex items-center">
                {i > 0 && (
                  <div
                    className={`mx-1 h-1 w-6 rounded-full sm:w-10 ${
                      isExplored ? "bg-[#a855f7]" : "bg-[#e9d5ff] [background-image:linear-gradient(90deg,#c4b5fd_50%,transparent_50%)] [background-size:8px_1px]"
                    }`}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  disabled={isExplored}
                  onClick={() => explore(choice.id)}
                  title={isExplored ? `Explored: ${outcomeFor(choice.id)?.headline}` : `Try: ${choice.label}`}
                  className={`group relative grid size-14 place-items-center rounded-full text-2xl transition-all sm:size-16 sm:text-3xl ${
                    isExplored
                      ? "bg-[#a855f7] text-white shadow-lg ring-4 ring-[#e9d5ff]"
                      : "cursor-pointer bg-white text-[#6b5b8e] ring-2 ring-dashed ring-[#c4b5fd] hover:scale-110 hover:bg-[#f5f3ff] hover:ring-[#a855f7]"
                  } ${isNew ? "animate-[reward-pop_0.6s_ease-out]" : ""}`}
                >
                  {isExplored ? outcomeFor(choice.id)?.emoji ?? choice.emoji : "❓"}
                  {isFirst && (
                    <span className="absolute -bottom-6 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-[#6b5b8e]">
                      your first pick
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unexplored path buttons */}
      {unexplored.length > 0 && (
        <div className="mt-8 grid gap-3">
          <p className="text-center text-sm font-black uppercase tracking-[0.15em] text-[#7c3aed]">
            Tap a glowing path to rewind
          </p>
          {unexplored.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => explore(choice.id)}
              className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#c4b5fd] bg-white/80 p-4 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-[#a855f7] hover:bg-[#faf5ff] hover:shadow-md active:scale-[0.99]"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#f3e8ff] text-2xl transition-transform group-hover:rotate-12" aria-hidden="true">
                {choice.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-[#17231f] sm:text-lg">{choice.label}</span>
                <span className="block text-xs font-bold text-[#8b7bb5]">⏪ Rewind and see what happens…</span>
              </span>
              <span className="shrink-0 text-2xl transition-transform group-hover:-translate-x-1" aria-hidden="true">
                ⏪
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Side-by-side comparison of explored endings */}
      {explored.length >= 2 && (
        <div className="mt-8">
          <p className="text-center text-sm font-black uppercase tracking-[0.15em] text-[#7c3aed]">
            Your endings so far
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {explored.map((choiceId) => {
              const outcome = outcomeFor(choiceId);
              const choice = choiceFor(choiceId);
              if (!outcome || !choice) return null;
              return (
                <div
                  key={choiceId}
                  className={`rounded-2xl border bg-white/90 p-4 shadow-sm ${
                    choiceId === justExplored ? "animate-[reward-pop_0.6s_ease-out] ring-2 ring-[#a855f7]" : "ring-1 ring-[#e9d5ff]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">{outcome.emoji}</span>
                    <p className="text-sm font-black text-[#17231f]">{outcome.headline}</p>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#6b5b8e]">
                    <span className="text-[#a855f7]">{choice.emoji} {choice.label}</span> →
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">{outcome.story}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WHY round — articulation practice. "Which ending did you like best? WHY?" */}
      {explored.length >= 2 && (
        <div className="mt-8 rounded-2xl border-2 border-[#f59e0b]/40 bg-white/90 p-4 sm:p-5">
          <p className="text-center text-lg font-black text-[#17231f]">
            🗣️ Which ending did you like best? <span className="text-[#b45309]">Why?</span>
          </p>
          <p className="mx-auto mt-1 max-w-md text-center text-xs font-bold text-[#8b7bb5]">
            {ageMode === "thrive"
              ? "Explain it like you're telling a friend — great thinkers can say why."
              : "Tap your favorite ending!"}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {explored.map((choiceId) => {
              const outcome = outcomeFor(choiceId);
              const choice = choiceFor(choiceId);
              if (!outcome || !choice) return null;
              const selected = favoriteId === choiceId;
              return (
                <button
                  key={choiceId}
                  type="button"
                  onClick={() => setFavoriteId(choiceId)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-2xl p-3 text-left transition-all ${
                    selected
                      ? "bg-[#f59e0b] shadow-lg ring-4 ring-[#fde68a] scale-[1.02]"
                      : "bg-[#fffbeb] ring-1 ring-[#fde68a] hover:scale-[1.01] hover:bg-[#fef3c7]"
                  }`}
                >
                  <span className="text-3xl" aria-hidden="true">{outcome.emoji}</span>
                  <span className={`text-sm font-black ${selected ? "text-white" : "text-[#17231f]"}`}>
                    {outcome.headline}
                  </span>
                  {selected && <span className="ml-auto text-xl" aria-hidden="true">❤️</span>}
                </button>
              );
            })}
          </div>
          {favoriteId && ageMode !== "sprout" && (
            <div className="mt-4">
              <p className="text-sm font-black text-[#17231f]">
                {ageMode === "thrive" ? "Tell it like you'd tell a friend:" : "Because…"}
              </p>
              {ageMode === "grow" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {WHY_BECAUSE_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setWhyBecause(chip);
                        setCustomWhy(false);
                      }}
                      className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all ${
                        whyBecause === chip && !customWhy
                          ? "bg-[#f59e0b] text-white shadow"
                          : "bg-[#fffbeb] text-[#7a4b12] ring-1 ring-[#fde68a] hover:bg-[#fef3c7]"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  value={whyBecause}
                  onChange={(e) => setWhyBecause(e.target.value)}
                  placeholder="Explain it like you're telling a friend…"
                  maxLength={200}
                  rows={2}
                  className="mt-2 w-full rounded-xl border-2 border-[#fde68a] bg-white px-3 py-2 text-sm font-bold text-[#17231f] outline-none focus:border-[#f59e0b]"
                />
              )}
            </div>
          )}
          {favoriteId && (
            <p className="mt-3 text-center text-xs font-black text-[#b45309]">
              ✨ Saying WHY is how thoughts become words — and words become confidence.
            </p>
          )}
        </div>
      )}

      {/* Celebration */}
      {celebration && (
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#a855f7] to-[#7c3aed] p-4 text-center shadow-lg">
          <p className="text-lg font-black text-white">{celebration}</p>
          <p className="mt-1 text-sm font-bold text-[#e9d5ff]">
            {childName}, comparing endings is how great thinkers are made. 🧠✨
          </p>
        </div>
      )}

      {/* Done */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() =>
            onDone({
              exploredChoiceIds: explored,
              rewindCount,
              whyPick: favoriteId ? { favoriteChoiceId: favoriteId, because: whyBecause.trim() || undefined } : null,
            })
          }
          className="rounded-full bg-[#17231f] px-8 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          {unexplored.length > 0 ? "I'm done exploring ✓" : "All endings explored! ✓"}
        </button>
        {unexplored.length > 0 && (
          <p className="mt-2 text-xs font-bold text-[#8b7bb5]">
            {unexplored.length} path{unexplored.length === 1 ? "" : "s"} still unseen — no pressure, they&apos;ll be here later.
          </p>
        )}
      </div>
    </div>
  );
}
