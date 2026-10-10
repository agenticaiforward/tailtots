/**
 * PetReactions — the pet as a visual state machine (Duolingo Rive pattern,
 * implemented in CSS/SVG/emoji since we ship zero external assets).
 *
 * Engineers never script motion — they set a mood and the pet decides what
 * that looks like:
 *   idle      — gentle bob, blinking (the default "alive" state)
 *   celebrate — joyful bounce + spin (mission complete)
 *   excited   — fast happy wiggle (kid returns after absence)
 *   sleepy    — slow heavy bob + floating Zzz (idle a long while)
 *   encourage — gentle nod (skipped days — warm, NEVER guilt-tripping)
 *
 * The pet NEVER shows disappointment, anger, or sadness-at-the-child.
 * The worst it does is a warm "we'll try together" nod.
 */
"use client";

import { useMemo, useState } from "react";
import { PetBuddyFace, type PetKind } from "./pet-buddy";

export type PetMood = "idle" | "celebrate" | "excited" | "sleepy" | "encourage";

const MOOD_CLASS: Record<PetMood, string> = {
  idle: "tt-animate-bounce-soft",
  celebrate: "pet-celebrate",
  excited: "pet-excited",
  sleepy: "pet-sleepy",
  encourage: "pet-encourage",
};

const MOOD_CAPTION: Record<PetMood, string | null> = {
  idle: null,
  celebrate: "Happy dance!",
  excited: "You're back!!",
  sleepy: null,
  encourage: "We'll try together 💛",
};

export function PetReaction({
  mood,
  kind,
  photoUrl,
  petName,
  size = "md",
  showCaption = true,
  className = "",
}: {
  mood: PetMood;
  kind: PetKind;
  photoUrl?: string;
  petName: string;
  size?: "sm" | "md" | "lg";
  showCaption?: boolean;
  className?: string;
}) {
  const sizeClass = size === "sm" ? "size-16" : size === "lg" ? "size-32" : "size-24";
  const caption = MOOD_CAPTION[mood];
  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      <div className={`${sizeClass} ${MOOD_CLASS[mood]}`} aria-hidden="true">
        <PetBuddyFace kind={kind} photoUrl={photoUrl} label={petName} size={size === "lg" ? "lg" : "md"} className="!size-full" />
      </div>
      {mood === "sleepy" && (
        <span className="zzz-float absolute -right-1 top-0 text-xl" aria-hidden="true">💤</span>
      )}
      {mood === "celebrate" && (
        <>
          <span className="absolute -left-2 top-1 animate-[reward-pop_1.8s_ease-in-out_infinite] text-lg" aria-hidden="true">✨</span>
          <span className="absolute -right-2 top-6 animate-[reward-pop_1.8s_ease-in-out_infinite] text-lg" style={{ animationDelay: "0.6s" }} aria-hidden="true">🎉</span>
        </>
      )}
      {showCaption && caption && (
        <p className="mt-1.5 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#17231f] shadow-sm ring-1 ring-[#ded8c7]">
          {caption}
        </p>
      )}
    </div>
  );
}

const LAST_VISIT_KEY = "tailtots:last-visit";
const DAY_MS = 86_400_000;

/**
 * Determines the pet's mood from interaction context.
 * - celebrate: just completed a mission (caller passes explicitly)
 * - excited: returning after 24h+ absence
 * - sleepy: app open but no interaction for a while (caller passes idleMs)
 * - encourage: missions skipped recently — warm, never guilt
 * - idle: default
 */
export function usePetMood(opts?: {
  justCelebrated?: boolean;
  skippedRecently?: boolean;
  idleMs?: number;
}): { mood: PetMood; daysAway: number; recordVisit: () => void } {
  const [daysAway, setDaysAway] = useState(() => {
    try {
      const raw = window.localStorage.getItem(LAST_VISIT_KEY);
      if (raw) {
        const away = Math.floor((Date.now() - Number(raw)) / DAY_MS);
        return away > 0 ? away : 0;
      }
    } catch {
      /* ignore */
    }
    return 0;
  });

  const recordVisit = () => {
    try {
      window.localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDaysAway(0);
  };

  const mood: PetMood = useMemo(() => {
    if (opts?.justCelebrated) return "celebrate";
    if (daysAway >= 1) return "excited";
    if (opts?.skippedRecently) return "encourage";
    if ((opts?.idleMs ?? 0) > 3 * 60_000) return "sleepy";
    return "idle";
  }, [opts?.justCelebrated, opts?.skippedRecently, opts?.idleMs, daysAway]);

  return { mood, daysAway, recordVisit };
}
