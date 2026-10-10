/**
 * Graduation — the anti-churn engine.
 *
 * When a child ages into a new ladder mode (or the transition predictor
 * fires), they don't just "get older" — they GRADUATE. Confetti, pet
 * evolution fanfare, mode reveal: "Maya's growing up — welcome to Grow!"
 *
 * Aging up should feel like leveling up. That's how a 14-month tenure
 * becomes a multi-year relationship.
 */
"use client";

import { useEffect, useState } from "react";
import { AGE_MODE_META, nextAgeMode, type AgeMode } from "./AgeMode";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";

const CONFETTI_EMOJI = ["🎉", "⭐", "🎊", "🌟", "💛", "🎈", "✨", "🌱", "🌿", "🌳"];

export function Graduation({
  childName,
  fromMode,
  toMode,
  petName,
  petKind,
  petPhotoUrl,
  onDone,
}: {
  childName: string;
  fromMode: AgeMode;
  toMode: AgeMode;
  petName?: string;
  petKind?: PetKind;
  petPhotoUrl?: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"announce" | "pet" | "reveal">("announce");
  const from = AGE_MODE_META[fromMode];
  const to = AGE_MODE_META[toMode];
  const next = nextAgeMode(toMode);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("pet"), 2600);
    const t2 = window.setTimeout(() => setPhase("reveal"), 5200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#17231f]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Graduation celebration">
      {/* Confetti rain */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI_EMOJI.map((emoji, i) => (
          <span
            key={i}
            className="tt-confetti-piece absolute text-3xl"
            style={{ left: `${(i * 97) % 100}%`, top: "-4%", animationDelay: `${(i % 8) * 0.22}s` }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl">
        {phase === "announce" && (
          <div className="animate-[answer-pop_0.5s_ease-out]">
            <p className="text-7xl" aria-hidden="true">🎓</p>
            <h2 className="mt-4 text-3xl font-black text-[#17231f] sm:text-4xl">
              {childName}&apos;s growing up!
            </h2>
            <p className="mt-2 text-lg font-bold text-[#4f625b]">
              {from.emoji} {from.name} → {to.emoji} {to.name}
            </p>
          </div>
        )}

        {phase === "pet" && petName && petKind && (
          <div className="animate-[answer-pop_0.5s_ease-out]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#b45309]">Your pet is evolving too!</p>
            <div className="mx-auto mt-4 w-fit animate-[pet-wiggle_1.6s_ease-in-out_infinite]">
              <PetBuddyFace kind={petKind} photoUrl={petPhotoUrl} label={petName} size="lg" />
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#17231f]">{petName} leveled up! ⚡</h2>
            <p className="mt-1 text-sm font-semibold text-[#4f625b]">
              {petName} learned new tricks for this next adventure together.
            </p>
          </div>
        )}

        {phase === "reveal" && (
          <div className="animate-[answer-pop_0.5s_ease-out]">
            <p className="text-7xl" aria-hidden="true">
              <span className="inline-block animate-[reward-pop_2s_ease-in-out_infinite]">{to.emoji}</span>
            </p>
            <h2 className="mt-4 text-3xl font-black text-[#17231f] sm:text-4xl">{to.welcomeHeadline(childName)}</h2>
            <p className="mx-auto mt-3 max-w-sm text-base font-semibold leading-7 text-[#4f625b]">{to.welcomeSub}</p>
            {next && (
              <p className="mt-3 text-xs font-bold text-[#69736f]">
                One day you&apos;ll graduate to {AGE_MODE_META[next].emoji} {AGE_MODE_META[next].name}… but no rush. Enjoy this! 💛
              </p>
            )}
            <button
              type="button"
              onClick={onDone}
              className="tt-btn-press mt-6 min-h-12 w-full rounded-2xl bg-[#165a4b] px-6 py-3 text-lg font-black text-white"
            >
              Let&apos;s go! 🚀
            </button>
          </div>
        )}

        {phase !== "reveal" && (
          <button type="button" onClick={onDone} className="mt-6 text-sm font-bold text-[#69736f] underline">
            Skip celebration
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * GraduationTrigger — checks whether a graduation is due and shows the
 * ceremony. Graduation state persists in localStorage per child so it
 * only fires once per mode transition.
 */
export function useGraduation(childId: string, age: number): {
  pendingGraduation: { from: AgeMode; to: AgeMode } | null;
  dismissGraduation: () => void;
} {
  const [pending, setPending] = useState<{ from: AgeMode; to: AgeMode } | null>(null);

  useEffect(() => {
    try {
      const key = `tailtots-graduation-${childId}`;
      const seenMode = window.localStorage.getItem(key) as AgeMode | null;
      // Derive current mode from age bands
      const current: AgeMode = age <= 6 ? "sprout" : age <= 9 ? "grow" : "thrive";
      if (seenMode && seenMode !== current) {
        // Order ladder: sprout < grow < thrive. Only celebrate forward moves.
        const order: AgeMode[] = ["sprout", "grow", "thrive"];
        if (order.indexOf(current) > order.indexOf(seenMode)) {
          setPending({ from: seenMode, to: current });
        } else {
          window.localStorage.setItem(key, current);
        }
      } else if (!seenMode) {
        window.localStorage.setItem(key, current);
      }
    } catch {
      /* storage unavailable — skip graduation */
    }
  }, [childId, age]);

  const dismiss = () => {
    try {
      const key = `tailtots-graduation-${childId}`;
      const current: AgeMode = age <= 6 ? "sprout" : age <= 9 ? "grow" : "thrive";
      window.localStorage.setItem(key, current);
    } catch {
      /* ignore */
    }
    setPending(null);
  };

  return { pendingGraduation: pending, dismissGraduation: dismiss };
}
