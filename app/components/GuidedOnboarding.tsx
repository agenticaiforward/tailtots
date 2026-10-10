"use client";

/**
 * GuidedOnboarding — the Duolingo lesson-one loop.
 *
 * Value before signup, not signup before value:
 *   1. Pick your pet (10 sec) — emotional hook
 *   2. Do ONE mini-mission (30 sec) — the aha moment
 *   3. Celebration (10 sec) — dopamine
 *   4. "That was TailTots!" → "Want to save your progress?" → signup
 *
 * 60 seconds to first delight. Zero forms until the end.
 */

import { useState } from "react";

const PETS = [
  { id: "dog", emoji: "🐶", name: "Puppy", trait: "Loyal & playful" },
  { id: "cat", emoji: "🐱", name: "Kitten", trait: "Curious & clever" },
  { id: "bunny", emoji: "🐰", name: "Bunny", trait: "Gentle & quick" },
  { id: "dragon", emoji: "🐲", name: "Dragon", trait: "Brave & magical" },
];

const MINI_MISSION = {
  title: "The Kindness Drop",
  prompt: "Find one small kind thing you can do in the next 2 minutes.",
  examples: ["Compliment someone", "Tidy one thing", "Share a smile"],
};

type Step = "pet" | "mission" | "celebrate" | "signup";

export default function GuidedOnboarding({
  onComplete,
  onSignup,
}: {
  onComplete: () => void;
  onSignup: () => void;
}) {
  const [step, setStep] = useState<Step>("pet");
  const [pet, setPet] = useState(PETS[0]);
  const [missionDone, setMissionDone] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tt-night/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Try TailTots"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-between bg-tt-cream px-6 py-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {(["pet", "mission", "celebrate", "signup"] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition-colors ${
                  (["pet", "mission", "celebrate", "signup"] as Step[]).indexOf(s) <=
                  (["pet", "mission", "celebrate", "signup"] as Step[]).indexOf(step)
                    ? "bg-tt-pine"
                    : "bg-tt-line"
                }`}
              />
            ))}
          </div>
          <button
            onClick={onComplete}
            className="text-sm font-bold text-tt-ink-faint hover:text-tt-ink"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* STEP 1: Pick your pet */}
          {step === "pet" && (
            <div className="text-center">
              <p className="text-5xl" aria-hidden="true">🐾</p>
              <h2 className="mt-3 text-2xl font-black text-tt-navy">Meet your buddy!</h2>
              <p className="mt-2 text-sm font-semibold text-tt-ink-soft">
                Every TailTots kid gets a companion who grows with them. Pick yours:
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {PETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPet(p)}
                    aria-pressed={pet.id === p.id}
                    className={`tt-btn-press rounded-2xl border-2 p-4 text-center transition-all ${
                      pet.id === p.id
                        ? "border-tt-pine bg-tt-pine-tint shadow-md"
                        : "border-tt-line bg-white hover:border-tt-pine/50"
                    }`}
                  >
                    <p className="text-4xl" aria-hidden="true">{p.emoji}</p>
                    <p className="mt-2 text-sm font-black text-tt-navy">{p.name}</p>
                    <p className="text-xs font-semibold text-tt-ink-soft">{p.trait}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("mission")}
                className="tt-btn-press mt-6 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm font-black text-white"
              >
                Meet {pet.name} →
              </button>
            </div>
          )}

          {/* STEP 2: One mini-mission */}
          {step === "mission" && (
            <div className="text-center">
              <p className="text-5xl" aria-hidden="true">{pet.emoji}</p>
              <h2 className="mt-3 text-2xl font-black text-tt-navy">{MINI_MISSION.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
                {pet.name} has a tiny challenge for you. {MINI_MISSION.prompt}
              </p>
              <div className="mt-4 space-y-2">
                {MINI_MISSION.examples.map((ex) => (
                  <div key={ex} className="rounded-xl bg-tt-cream px-4 py-2.5 text-sm font-bold text-tt-navy">
                    ✨ {ex}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold text-tt-ink-faint">
                Go do it now — {pet.name} will wait right here. 💛
              </p>
              <button
                onClick={() => {
                  setMissionDone(true);
                  setStep("celebrate");
                }}
                className="tt-btn-press mt-4 min-h-12 w-full rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink"
              >
                I did it! 🎉
              </button>
              <button
                onClick={() => setStep("pet")}
                className="mt-2 text-sm font-bold text-tt-ink-faint"
              >
                ← Back
              </button>
            </div>
          )}

          {/* STEP 3: Celebration */}
          {step === "celebrate" && missionDone && (
            <div className="text-center">
              <p className="animate-bounce text-6xl" aria-hidden="true">🎊</p>
              <h2 className="mt-3 text-2xl font-black text-tt-navy">Amazing!</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
                {pet.emoji} {pet.name} is doing a happy dance! You just earned your first{" "}
                <strong className="text-tt-pine">Kindness Stone</strong>. 🪨✨
              </p>
              <div className="mx-auto mt-5 flex max-w-xs items-center justify-center gap-3 rounded-2xl bg-tt-cream p-4">
                <p className="text-4xl" aria-hidden="true">🪨</p>
                <div className="text-left">
                  <p className="text-sm font-black text-tt-navy">Kindness Stone</p>
                  <p className="text-xs font-semibold text-tt-ink-soft">1 of many to collect</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-bold text-tt-pine">
                That was TailTots — tiny missions, real growth. 💛
              </p>
              <button
                onClick={() => setStep("signup")}
                className="tt-btn-press mt-4 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm font-black text-white"
              >
                Keep going →
              </button>
            </div>
          )}

          {/* STEP 4: Save progress → signup */}
          {step === "signup" && (
            <div className="text-center">
              <p className="text-5xl" aria-hidden="true">{pet.emoji}</p>
              <h2 className="mt-3 text-2xl font-black text-tt-navy">Save your progress?</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
                {pet.name} will remember you, and every mission gets personalized by AI
                to fit your child's age and needs.
              </p>
              <button
                onClick={onSignup}
                className="tt-btn-press mt-5 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm font-black text-white"
              >
                Create free account
              </button>
              <button
                onClick={onComplete}
                className="mt-3 text-sm font-bold text-tt-ink-faint hover:text-tt-ink"
              >
                Maybe later — let me explore
              </button>
              <p className="mt-4 text-xs font-semibold text-tt-ink-faint">
                Free forever plan · No credit card · Cancel anytime
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
