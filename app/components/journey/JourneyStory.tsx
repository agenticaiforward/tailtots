/**
 * JourneyStory — the current leg's story card with a gentle parallel.
 *
 * Each card pairs the animal's real challenge with the kid's growth.
 * Never a lecture — the parallel is an invitation to feel, not a lesson
 * to memorize. Wonder-first language a 6-year-old can feel.
 */
"use client";

import type { JourneyAnimal, JourneyLeg, ShelterAnimal, ShelterStage } from "../../lib/great-journey/animals";

export function WildLegStory({
  animal,
  leg,
  legIndex,
  childName,
}: {
  animal: JourneyAnimal;
  leg: JourneyLeg;
  legIndex: number;
  childName: string;
}) {
  return (
    <article className="rounded-3xl border border-tt-line bg-tt-paper p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-tt-cream text-3xl" aria-hidden="true">
          {animal.emoji}
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">
            Leg {legIndex + 1} of {animal.legs.length}
          </p>
          <h3 className="text-lg font-black text-tt-ink">{leg.name}</h3>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-relaxed text-tt-ink-soft">{leg.story}</p>

      <div className="mt-3 rounded-2xl bg-tt-cream p-3">
        <p className="text-xs font-bold text-tt-ink">
          <span aria-hidden="true">✨ </span>True story: {leg.fact}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-tt-pine/20 bg-tt-pine-tint/40 p-3">
        <p className="text-xs font-bold leading-relaxed text-tt-pine">
          <span aria-hidden="true">💛 </span>
          {childName}, {leg.parallel.charAt(0).toLowerCase() + leg.parallel.slice(1)}
        </p>
      </div>
    </article>
  );
}

export function ShelterStageStory({
  animal,
  stage,
  stageIndex,
  childName,
}: {
  animal: ShelterAnimal;
  stage: ShelterStage;
  stageIndex: number;
  childName: string;
}) {
  const isHome = stage.name === "Home";
  return (
    <article className="rounded-3xl border border-tt-line bg-tt-paper p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-tt-cream text-3xl" aria-hidden="true">
          {animal.emoji}
        </span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">
            Step {stageIndex + 1} of 5 · {animal.name}'s journey home
          </p>
          <h3 className="text-lg font-black text-tt-ink">{stage.name}</h3>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-relaxed text-tt-ink-soft">{stage.story}</p>

      <div className="mt-3 rounded-2xl border border-tt-pine/20 bg-tt-pine-tint/40 p-3">
        <p className="text-xs font-bold leading-relaxed text-tt-pine">
          <span aria-hidden="true">{isHome ? "🎉 " : "💛 "}</span>
          {isHome
            ? `${childName}, you helped ${animal.name} find home. That's real.`
            : stage.kidRole}
        </p>
      </div>
    </article>
  );
}
