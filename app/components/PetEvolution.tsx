/**
 * PetEvolution — the pet grows with the child.
 *
 * Five visual stages driven by approved mission count:
 *   🥚 egg    (0–4)    — an egg that cracks as you get closer to hatching
 *   🐣 baby   (5–14)   — tiny buddy, big eyes
 *   🐾 junior (15–29)  — growing buddy, playful
 *   🦁 adult  (30–59)  — full-size buddy, confident
 *   🦉 wise   (60+)    — glowing buddy with sparkles
 *
 * Evolution is the emotional anchor of the kid experience: the pet is not
 * just "fed", it GROWS. No two pets evolve identically — the pet-personality
 * engine (lib/ai/pet-personality.ts, when available) adds unique quirks.
 */
"use client";

import { useMemo } from "react";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";

export type EvolutionStage = "egg" | "baby" | "junior" | "adult" | "wise";

export const EVOLUTION_STAGES: { stage: EvolutionStage; emoji: string; name: string; minMissions: number; blurb: string }[] = [
  { stage: "egg", emoji: "🥚", name: "Egg", minMissions: 0, blurb: "Something wonderful is about to hatch…" },
  { stage: "baby", emoji: "🐣", name: "Baby", minMissions: 5, blurb: "Hello, little one! So tiny, so curious." },
  { stage: "junior", emoji: "🐾", name: "Junior", minMissions: 15, blurb: "Growing fast and full of zoomies!" },
  { stage: "adult", emoji: "🦁", name: "Adult", minMissions: 30, blurb: "Strong, brave, and totally your best friend." },
  { stage: "wise", emoji: "🦉", name: "Wise", minMissions: 60, blurb: "A legend. Knows everything about being kind." },
];

export function evolutionStageFor(approvedCount: number): (typeof EVOLUTION_STAGES)[number] {
  let current = EVOLUTION_STAGES[0];
  for (const s of EVOLUTION_STAGES) {
    if (approvedCount >= s.minMissions) current = s;
  }
  return current;
}

export function nextEvolutionStage(approvedCount: number): (typeof EVOLUTION_STAGES)[number] | null {
  for (const s of EVOLUTION_STAGES) {
    if (approvedCount < s.minMissions) return s;
  }
  return null;
}

/** Illustrated egg that cracks progressively toward hatching. */
function EggVisual({ progress }: { progress: number }) {
  // progress 0..1 toward baby stage
  const cracks = Math.min(3, Math.floor(progress * 4));
  return (
    <div className="relative grid size-28 place-items-center sm:size-32" aria-hidden="true">
      <svg viewBox="0 0 100 120" className="h-full w-full drop-shadow-lg">
        <path
          d="M50 6 C74 6 90 44 90 74 C90 100 72 114 50 114 C28 114 10 100 10 74 C10 44 26 6 50 6 Z"
          fill="#fff7e6"
          stroke="#e8c76a"
          strokeWidth="3"
        />
        <path d="M30 40 C36 28 44 20 50 18" stroke="#ffe9b8" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.9" />
        {cracks >= 1 && <path d="M50 60 L42 72 L52 80 L44 92" stroke="#b98a2f" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {cracks >= 2 && <path d="M58 66 L66 76 L60 88" stroke="#b98a2f" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {cracks >= 3 && <path d="M38 84 L50 90 L62 84" stroke="#b98a2f" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      </svg>
      <span className="absolute bottom-1 text-2xl">{progress > 0.6 ? "🐣" : "💤"}</span>
    </div>
  );
}

export type PetReactionMood = "idle" | "celebrate" | "excited" | "sleepy" | "encourage";

const MOOD_ANIMATION: Record<PetReactionMood, string> = {
  idle: "",
  celebrate: "pet-celebrate",
  excited: "pet-excited",
  sleepy: "pet-sleepy",
  encourage: "pet-encourage",
};

export function PetEvolution({
  approvedCount,
  petKind,
  photoUrl,
  petName,
  personalityQuirk,
  compact = false,
  mood = "idle",
}: {
  approvedCount: number;
  petKind: PetKind;
  photoUrl?: string;
  petName: string;
  /** Optional quirk line from the pet-personality engine. */
  personalityQuirk?: string;
  compact?: boolean;
  /** Reaction state from the delight layer — animates the pet visual. */
  mood?: PetReactionMood;
}) {
  const stage = evolutionStageFor(approvedCount);
  const next = nextEvolutionStage(approvedCount);
  const toGo = next ? next.minMissions - approvedCount : 0;
  const progress = useMemo(() => {
    if (!next) return 1;
    const span = next.minMissions - stage.minMissions;
    return Math.min(1, Math.max(0, (approvedCount - stage.minMissions) / span));
  }, [approvedCount, next, stage]);

  const stageIndex = EVOLUTION_STAGES.findIndex((s) => s.stage === stage.stage);
  const sizeClass = stage.stage === "baby" ? "size-24 sm:size-28" : stage.stage === "junior" ? "size-28 sm:size-32" : "size-32 sm:size-36";

  return (
    <div className={`overflow-hidden rounded-3xl border border-[#ded8c7] bg-white shadow-sm ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {stage.stage === "egg" ? (
            <div className={mood === "idle" ? "animate-[pet-wiggle_3s_ease-in-out_infinite]" : MOOD_ANIMATION[mood]}>
              <EggVisual progress={progress} />
            </div>
          ) : (
            <div className={`relative ${sizeClass} ${MOOD_ANIMATION[mood]}`}>
              {stage.stage === "wise" && (
                <>
                  <span className="absolute -left-1 top-2 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-lg" aria-hidden="true">✨</span>
                  <span className="absolute -right-1 top-8 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-lg" style={{ animationDelay: "0.7s" }} aria-hidden="true">✨</span>
                  <span className="absolute -bottom-1 left-6 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-base" style={{ animationDelay: "1.3s" }} aria-hidden="true">✨</span>
                  <div className="absolute -inset-2 rounded-full bg-[#ffd166]/30 blur-md" aria-hidden="true" />
                </>
              )}
              <PetBuddyFace kind={petKind} photoUrl={photoUrl} label={petName} size="lg" className="!size-full" />
            </div>
          )}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#17231f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd166] ring-2 ring-white">
            {stage.emoji} {stage.name}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black text-[#17231f]">
            {petName} {stage.stage === "egg" ? "is still an egg!" : `is growing up!`}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#4f625b]">{stage.blurb}</p>
          {personalityQuirk && (
            <p className="mt-2 rounded-xl bg-[#fff4d8] px-3 py-2 text-xs font-bold text-[#7a4b12] ring-1 ring-[#f4b400]/40">
              💭 {personalityQuirk}
            </p>
          )}
          {next ? (
            <div className="mt-3">
              <div className="h-3 overflow-hidden rounded-full bg-[#f0ece0]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f4b400] to-[#f47b20] transition-all duration-700"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs font-black text-[#69736f]">
                {toGo} more {toGo === 1 ? "mission" : "missions"} to {next.emoji} {next.name}!
              </p>
            </div>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#ffd166]/30 px-3 py-1.5 text-xs font-black text-[#7a4b12]">
              🌟 Fully grown — a true legend!
            </p>
          )}
        </div>
      </div>
      {/* Stage track */}
      <div className="mt-4 flex items-center justify-between" aria-hidden="true">
        {EVOLUTION_STAGES.map((s, i) => (
          <div key={s.stage} className="flex flex-1 items-center last:flex-none">
            <div
              className={`grid size-9 place-items-center rounded-full text-lg ring-2 transition-all ${
                i <= stageIndex ? "bg-[#ffd166]/40 ring-[#f4b400]" : "bg-[#f5f1e5] ring-[#ded8c7] opacity-60"
              }`}
              title={s.name}
            >
              {s.emoji}
            </div>
            {i < EVOLUTION_STAGES.length - 1 && (
              <div className={`mx-1 h-1 flex-1 rounded-full ${i < stageIndex ? "bg-[#f4b400]" : "bg-[#f0ece0]"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
