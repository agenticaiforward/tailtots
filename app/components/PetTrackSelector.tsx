/**
 * PetTrackSelector — the very first onboarding question.
 *
 * "Do you have a pet?" with three big visual cards:
 *   🏠 HAVE  → real pet is the hero
 *   💛 WANT  → virtual buddy as readiness track
 *   🐾 CANT  → virtual buddy + shelter connection
 *
 * This single choice determines the entire pet experience downstream.
 * Kid-friendly, visual-first, zero reading required to understand.
 */
"use client";

import { PET_TRACKS, type PetTrack } from "../../lib/pet-tracks";
import { TtIllustration, type IllustrationKind } from "./TtIllustration";

const TRACK_ILLUSTRATIONS: Record<PetTrack, IllustrationKind> = {
  have: "pet",
  want: "wonder",
  cant: "paw-house",
};

export default function PetTrackSelector({
  onSelect,
}: {
  onSelect: (track: PetTrack) => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto w-fit tt-motion-pop">
        <TtIllustration kind="pet" className="size-20" />
      </div>
      <h2 className="tt-heading mt-3 text-tt-navy">Do you have a pet?</h2>
      <p className="tt-body mt-1 text-tt-ink-faint">
        Pick the one that sounds like your family.
      </p>
      <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Pet situation">
        {PET_TRACKS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onSelect(t.id)}
            className="group flex items-center gap-4 rounded-2xl border-2 border-tt-line bg-tt-cream p-4 text-left transition-all hover:-translate-y-0.5 hover:border-tt-pine hover:shadow-lg active:translate-y-0"
          >
            <span
              className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white shadow-sm transition-transform group-hover:scale-110"
              aria-hidden="true"
            >
              <TtIllustration kind={TRACK_ILLUSTRATIONS[t.id]} className="size-9" />
            </span>
            <span>
              <span className="tt-heading block text-lg text-tt-navy">{t.title}</span>
              <span className="tt-body block text-sm text-tt-ink-faint">{t.blurb}</span>
            </span>
            <span
              className="ml-auto text-2xl text-tt-ink-faint transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            >
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
