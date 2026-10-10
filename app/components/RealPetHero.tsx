/**
 * RealPetHero — the real pet as the star of the kid dashboard (HAVE track).
 *
 * The pet's REAL photo, alive: Ken Burns drift, bobbing frame, celebration
 * bounce on mission completion, sleepy dim when idle. Name displayed proudly.
 * Evolution stage shown as a subtle badge — the photo is the hero, not the
 * evolution mechanic.
 *
 * For families WITHOUT real pets, this component renders nothing — the
 * virtual buddy experience (PetEvolution) takes its place.
 */
"use client";

import AlivePet from "./AlivePet";
import { petKindFor } from "./KidExperience";
import { evolutionStageFor } from "./PetEvolution";
import type { Pet } from "../../lib/types";

export default function RealPetHero({
  pet,
  approvedCount,
  celebrating = false,
  mood = "idle",
  onTap,
}: {
  pet: Pet;
  approvedCount: number;
  celebrating?: boolean;
  mood?: "idle" | "celebrate" | "excited" | "sleepy" | "encourage" | "curious";
  onTap?: () => void;
}) {
  const stage = evolutionStageFor(approvedCount);

  return (
    <section
      aria-label={`${pet.name}, your pet`}
      className="relative overflow-hidden rounded-3xl border-2 border-tt-pine/20 bg-gradient-to-br from-tt-cream via-white to-tt-pine-tint p-5 text-center shadow-sm"
    >
      {/* Soft radial glow behind the pet */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{ background: "radial-gradient(circle at 50% 35%, rgba(22,90,75,0.12), transparent 65%)" }}
      />
      <div className="relative">
        <AlivePet
          photoUrl={pet.photoUrl}
          petName={pet.name}
          petKind={petKindFor(pet.species)}
          mood={mood}
          celebrating={celebrating}
          size="lg"
          onTap={onTap}
        />
        <h2 className="tt-heading mt-2 text-2xl text-tt-navy">{pet.name}</h2>
        <p className="tt-body text-sm font-bold text-tt-ink-faint">
          {pet.species}
          {stage.stage !== "egg" && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs shadow-sm"
              aria-label={`Evolution stage: ${stage.name}`}
            >
              <span aria-hidden="true">{stage.emoji}</span> {stage.name}
            </span>
          )}
        </p>
        {pet.careNotes && (
          <p className="tt-body mx-auto mt-2 max-w-xs text-xs text-tt-ink-faint">
            💛 {pet.careNotes.split(",").slice(0, 3).join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}
