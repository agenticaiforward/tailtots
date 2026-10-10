"use client";

/**
 * GuidedOnboarding — the Duolingo lesson-one loop, rebuilt around REAL pets.
 *
 * New flow:
 *   1. Track selector (10 sec) — "Do you have a pet?" have/want/cant
 *   2. Pet setup (30 sec):
 *      - HAVE  → RealPetProfile (photo, name, species, care needs)
 *      - WANT  → virtual buddy picker (readiness track framing, NO dragon)
 *      - CANT  → virtual buddy picker (shelter buddy comes later in-app)
 *   3. One mini-mission (30 sec) — the aha moment
 *   4. Celebration (10 sec) — dopamine, real pet photo if available
 *   5. "That was TailTots!" → signup
 *
 * 60-90 seconds to first delight. Zero forms until the end.
 */

import { useState } from "react";
import PetTrackSelector from "./PetTrackSelector";
import RealPetProfile from "./RealPetProfile";
import AlivePet from "./AlivePet";
import { petKindFor } from "./KidExperience";
import type { PetTrack } from "../../lib/pet-tracks";
import type { Pet } from "../../lib/types";

/** Virtual buddy options — grounded animals only. No dragons. */
const VIRTUAL_BUDDIES = [
  { id: "dog", emoji: "🐶", name: "Puppy", trait: "Loyal & playful" },
  { id: "cat", emoji: "🐱", name: "Kitten", trait: "Curious & clever" },
  { id: "bunny", emoji: "🐰", name: "Bunny", trait: "Gentle & quick" },
];

const MINI_MISSION = {
  title: "The Kindness Drop",
  prompt: "Find one small kind thing you can do in the next 2 minutes.",
  examples: ["Compliment someone", "Tidy one thing", "Share a smile"],
};

const MINI_MISSION_PET = {
  title: "The Care Drop",
  prompt: "Do one small caring thing for an animal in the next 2 minutes.",
  examples: ["Fill a water bowl", "Gentle petting for 1 minute", "Tidy their space"],
};

type Step = "track" | "pet" | "mission" | "celebrate" | "signup";

const STEP_ORDER: Step[] = ["track", "pet", "mission", "celebrate", "signup"];

export default function GuidedOnboarding({
  onComplete,
  onSignup,
}: {
  onComplete: (result: { track: PetTrack; pets: Pet[]; virtualBuddyId?: string }) => void;
  onSignup: (result: { track: PetTrack; pets: Pet[]; virtualBuddyId?: string }) => void;
}) {
  const [step, setStep] = useState<Step>("track");
  const [track, setTrack] = useState<PetTrack | null>(null);
  const [realPets, setRealPets] = useState<Pet[]>([]);
  const [buddy, setBuddy] = useState(VIRTUAL_BUDDIES[0]);
  const [missionDone, setMissionDone] = useState(false);

  const result = {
    track: track ?? "want",
    pets: realPets,
    virtualBuddyId: track === "have" ? undefined : buddy.id,
  };

  /** The display pet: real pet photo first, else the virtual buddy. */
  const heroPet: Pet | null =
    realPets[0] ??
    (track !== "have"
      ? { id: `virtual-${buddy.id}`, name: buddy.name, species: buddy.id, favoriteFood: "", careNotes: "", vet: "", medicine: "" }
      : null);

  const mission = track === "have" && realPets[0] ? { ...MINI_MISSION_PET, petName: realPets[0].name } : MINI_MISSION;

  const goTrack = (t: PetTrack) => {
    setTrack(t);
    setStep("pet");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-tt-night/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Try TailTots"
    >
      <div className="my-8 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-between bg-tt-cream px-6 py-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {STEP_ORDER.map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full transition-colors ${
                  STEP_ORDER.indexOf(s) <= STEP_ORDER.indexOf(step) ? "bg-tt-pine" : "bg-tt-line"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => onComplete(result)}
            className="text-sm font-bold text-tt-ink-faint hover:text-tt-ink"
            aria-label="Skip onboarding"
          >
            Skip
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 sm:p-8">
          {/* STEP 1: Track selector */}
          {step === "track" && <PetTrackSelector onSelect={goTrack} />}

          {/* STEP 2a: Real pet profile (HAVE track) */}
          {step === "pet" && track === "have" && (
            <RealPetProfile
              onComplete={(pets) => {
                setRealPets(pets);
                setStep("mission");
              }}
            />
          )}

          {/* STEP 2b: Virtual buddy picker (WANT / CANT tracks) */}
          {step === "pet" && track !== "have" && track !== null && (
            <div className="text-center">
              <p className="text-5xl" aria-hidden="true">💛</p>
              <h2 className="tt-heading mt-3 text-tt-navy">Meet your buddy!</h2>
              <p className="tt-body mt-2 text-tt-ink-faint">
                {track === "want"
                  ? "Care for your buddy every day to show you're ready for a real pet."
                  : "Your buddy grows with every kindness mission you complete."}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {VIRTUAL_BUDDIES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBuddy(b)}
                    aria-pressed={buddy.id === b.id}
                    className={`rounded-2xl border-2 p-4 text-center transition-all ${
                      buddy.id === b.id
                        ? "border-tt-pine bg-tt-pine-tint shadow-md"
                        : "border-tt-line bg-white hover:border-tt-pine/50"
                    }`}
                  >
                    <p className="text-4xl" aria-hidden="true">{b.emoji}</p>
                    <p className="tt-body mt-2 text-sm font-black text-tt-navy">{b.name}</p>
                    <p className="tt-body text-xs text-tt-ink-faint">{b.trait}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("mission")}
                className="tt-heading mt-6 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm text-white"
              >
                Meet {buddy.name} →
              </button>
              <button onClick={() => setStep("track")} className="tt-body mt-2 text-sm font-bold text-tt-ink-faint">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 3: One mini-mission */}
          {step === "mission" && (
            <div className="text-center">
              {heroPet && (
                <AlivePet
                  photoUrl={heroPet.photoUrl}
                  petName={heroPet.name}
                  petKind={petKindFor(heroPet.species)}
                                    mood="excited"
                  size="md"
                  noFollow
                />
              )}
              <h2 className="tt-heading mt-3 text-tt-navy">{mission.title}</h2>
              <p className="tt-body mt-2 leading-6 text-tt-ink-faint">
                {heroPet ? `${heroPet.name} has` : "You have"} a tiny challenge. {mission.prompt}
              </p>
              <div className="mt-4 space-y-2">
                {mission.examples.map((ex) => (
                  <div key={ex} className="tt-body rounded-xl bg-tt-cream px-4 py-2.5 text-sm font-bold text-tt-navy">
                    ✨ {ex}
                  </div>
                ))}
              </div>
              <p className="tt-body mt-4 text-xs font-semibold text-tt-ink-faint">
                Go do it now — {heroPet?.name ?? "your buddy"} will wait right here. 💛
              </p>
              <button
                onClick={() => {
                  setMissionDone(true);
                  setStep("celebrate");
                }}
                className="tt-heading mt-4 min-h-12 w-full rounded-xl bg-tt-sun px-6 py-3 text-sm text-tt-ink"
              >
                I did it! 🎉
              </button>
              <button onClick={() => setStep("pet")} className="tt-body mt-2 text-sm font-bold text-tt-ink-faint">
                ← Back
              </button>
            </div>
          )}

          {/* STEP 4: Celebration */}
          {step === "celebrate" && missionDone && heroPet && (
            <div className="text-center">
              <AlivePet
                photoUrl={heroPet.photoUrl}
                petName={heroPet.name}
                petKind={petKindFor(heroPet.species)}
                                mood="celebrate"
                celebrating
                size="lg"
                noFollow
              />
              <h2 className="tt-heading mt-3 text-tt-navy">Amazing!</h2>
              <p className="tt-body mt-2 leading-6 text-tt-ink-faint">
                {heroPet.name} is doing a happy dance! You just earned your first{" "}
                <strong className="text-tt-pine">Kindness Stone</strong>. 🪨✨
              </p>
              <div className="mx-auto mt-5 flex max-w-xs items-center justify-center gap-3 rounded-2xl bg-tt-cream p-4">
                <p className="text-4xl" aria-hidden="true">🪨</p>
                <div className="text-left">
                  <p className="tt-body text-sm font-black text-tt-navy">Kindness Stone</p>
                  <p className="tt-body text-xs text-tt-ink-faint">1 of many to collect</p>
                </div>
              </div>
              <p className="tt-body mt-4 text-sm font-bold text-tt-pine">
                That was TailTots — tiny missions, real growth. 💛
              </p>
              <button
                onClick={() => setStep("signup")}
                className="tt-heading mt-4 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm text-white"
              >
                Keep going →
              </button>
            </div>
          )}

          {/* STEP 5: Save progress → signup */}
          {step === "signup" && (
            <div className="text-center">
              {heroPet && (
                <AlivePet
                  photoUrl={heroPet.photoUrl}
                  petName={heroPet.name}
                  petKind={petKindFor(heroPet.species)}
                                    mood="idle"
                  size="md"
                  noFollow
                />
              )}
              <h2 className="tt-heading mt-3 text-tt-navy">Save your progress?</h2>
              <p className="tt-body mt-2 leading-6 text-tt-ink-faint">
                {heroPet?.name ?? "Your buddy"} will remember you, and every mission gets
                personalized by AI to fit your child&rsquo;s age and needs.
              </p>
              <button
                onClick={() => onSignup(result)}
                className="tt-heading mt-5 min-h-12 w-full rounded-xl bg-tt-pine px-6 py-3 text-sm text-white"
              >
                Create free account
              </button>
              <button
                onClick={() => onComplete(result)}
                className="tt-body mt-3 text-sm font-bold text-tt-ink-faint hover:text-tt-ink"
              >
                Maybe later — let me explore
              </button>
              <p className="tt-body mt-4 text-xs text-tt-ink-faint">
                Free forever plan · No credit card · Cancel anytime
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
