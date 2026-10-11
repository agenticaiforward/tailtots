/**
 * PetBond — the friendship grows with the child.
 *
 * Five bond stages driven by approved mission count. The pet is ALWAYS shown
 * as the real animal (photo) — never an egg, never a virtual creature. What
 * grows is the BOND: new friends → legends. Real pets stay the center.
 *
 *   🌱 new      (0–4)    — getting to know each other
 *   🌿 growing  (5–14)   — learning each other's ways
 *   💛 friends  (15–29)  — inseparable companions
 *   ⭐ partners (30–59)  — an unbreakable team
 *   🏆 legends  (60+)    — a bond for the storybooks
 */
"use client";

import { useMemo } from "react";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";

export type EvolutionStage = "new" | "growing" | "friends" | "partners" | "legends";

export const EVOLUTION_STAGES: { stage: EvolutionStage; emoji: string; name: string; minMissions: number; blurb: string }[] = [
  { stage: "new", emoji: "🌱", name: "New Friends", minMissions: 0, blurb: "Getting to know each other — every legend starts here." },
  { stage: "growing", emoji: "🌿", name: "Growing Bond", minMissions: 5, blurb: "Learning each other's ways, one mission at a time." },
  { stage: "friends", emoji: "💛", name: "Best Friends", minMissions: 15, blurb: "Inseparable companions — this is really clicking!" },
  { stage: "partners", emoji: "⭐", name: "True Partners", minMissions: 30, blurb: "An unbreakable team. Look how far you've come together." },
  { stage: "legends", emoji: "🏆", name: "Legends", minMissions: 60, blurb: "A bond for the storybooks. This is what it's all about." },
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
  const sizeClass = "size-32 sm:size-36";

  return (
    <div className={`overflow-hidden rounded-3xl border border-[#ded8c7] bg-white shadow-sm ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className={`relative ${sizeClass} ${MOOD_ANIMATION[mood]}`}>
            {stage.stage === "legends" && (
              <>
                <span className="absolute -left-1 top-2 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-lg" aria-hidden="true">✨</span>
                <span className="absolute -right-1 top-8 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-lg" style={{ animationDelay: "0.7s" }} aria-hidden="true">✨</span>
                <span className="absolute -bottom-1 left-6 z-20 animate-[reward-pop_2.2s_ease-in-out_infinite] text-base" style={{ animationDelay: "1.3s" }} aria-hidden="true">✨</span>
                <div className="absolute -inset-2 rounded-full bg-[#ffd166]/30 blur-md" aria-hidden="true" />
              </>
            )}
            <PetBuddyFace kind={petKind} photoUrl={photoUrl} label={petName} size="lg" className="!size-full" />
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#17231f] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd166] ring-2 ring-white">
            {stage.emoji} {stage.name}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black text-[#17231f]">
            {petName} — {stage.name}!
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
