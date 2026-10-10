/**
 * WelcomeBack — the "look what happened while you were gone!" moment.
 *
 * When a kid returns after 1+ days away:
 * - The pet is EXCITED (fast happy wiggle), never disappointed
 * - Shows a warm "adventure story" — what the pet was up to (Finch pattern)
 * - Streak gets a FREEZE visual: paused, never broken punitively
 * - Zero guilt language. The message is "we missed you," not "where were you."
 *
 * This is the daily return hook — engineered warmth, not obligation.
 */
"use client";

import { useEffect, useState } from "react";
import { PetReaction, usePetMood } from "./PetReactions";
import type { PetKind } from "./pet-buddy";
import { playWelcomeBack } from "../../lib/sound";

const ADVENTURE_STORIES = [
  "I napped in the sunniest spot and dreamed about you! ☀️",
  "I practiced my happy dance. Want to see? 💃",
  "I counted all the stars last night. There are SO many. ✨",
  "I saved you the best spot by the window. 🪟",
  "I learned a new trick! …Okay, it's just sitting. But FAST sitting. 🐾",
  "I watered our courage garden while you were gone. It's growing! 🌱",
];

const SEEN_KEY = "tailtots:welcome-back-seen";

export function WelcomeBack({
  petName,
  petKind,
  petPhotoUrl,
  childName,
  streakFrozen,
  onDone,
}: {
  petName: string;
  petKind: PetKind;
  petPhotoUrl?: string;
  childName: string;
  /** True when the streak was paused (not broken) during absence. */
  streakFrozen?: boolean;
  onDone: () => void;
}) {
  const { daysAway, recordVisit } = usePetMood();
  const [visible, setVisible] = useState(() => {
    try {
      if (window.sessionStorage.getItem(SEEN_KEY)) return false;
      const raw = window.localStorage.getItem("tailtots:last-visit");
      if (!raw) return false;
      return Math.floor((Date.now() - Number(raw)) / DAY_MS) >= 1;
    } catch {
      return false;
    }
  });

  const [story] = useState(
    () => ADVENTURE_STORIES[Math.floor(Math.random() * ADVENTURE_STORIES.length)]
  );

  useEffect(() => {
    // Mark seen + play the greeting sound once the card is showing.
    if (!visible) return;
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    playWelcomeBack();
  }, [visible]);

  const dismiss = () => {
    recordVisit();
    setVisible(false);
    onDone();
  };

  if (!visible || daysAway < 1) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[#17231f]/70 p-4 backdrop-blur-sm"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`Welcome back, ${childName}`}
    >
      <div
        className="tt-animate-pop-in w-full max-w-sm rounded-[2rem] bg-[#fffdf4] p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PetReaction mood="excited" kind={petKind} photoUrl={petPhotoUrl} petName={petName} size="lg" />
        <h2 className="mt-3 text-2xl font-black text-[#17231f]">
          {childName} is back! 🎉
        </h2>
        <p className="mt-1 text-sm font-bold text-[#4f625b]">
          {petName} missed you {daysAway === 1 ? "yesterday" : `for ${daysAway} days`}!
        </p>

        <div className="mt-4 rounded-2xl bg-[#f0edff] p-4 text-left ring-1 ring-[#6d3ed1]/20">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">
            While you were away…
          </p>
          <p className="mt-1.5 text-sm font-semibold text-[#17231f]">{story}</p>
        </div>

        {streakFrozen && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-[#e0f2fe] p-3 ring-1 ring-[#0284c7]/20">
            <span className="text-2xl" aria-hidden="true">🧊</span>
            <p className="text-left text-xs font-bold text-[#0c4a6e]">
              Your streak took a cozy nap — it&apos;s right where you left it. No rush, no pressure.
            </p>
          </div>
        )}

        <button
          onClick={dismiss}
          className="tt-btn-press mt-4 min-h-14 w-full rounded-2xl bg-[#f47b20] text-lg font-black text-white"
        >
          Let&apos;s play! →
        </button>
      </div>
    </div>
  );
}
