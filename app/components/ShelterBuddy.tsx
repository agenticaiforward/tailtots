/**
 * ShelterBuddy — the CANT track's shelter connection.
 *
 * Families who can't have pets get a virtual buddy PLUS a real shelter
 * animal to sponsor: volunteer missions, toy-making, donation goals.
 * The shelter animal is real; the child's care helps real animals.
 */
"use client";

import { useState } from "react";

export interface ShelterAnimal {
  id: string;
  name: string;
  species: string;
  emoji: string;
  shelterName: string;
  blurb: string;
  photoUrl?: string;
}

/** Starter shelter buddies — replaced by real shelter API data when available. */
export const STARTER_SHELTER_BUDDIES: ShelterAnimal[] = [
  {
    id: "shelter-luna",
    name: "Luna",
    species: "Dog",
    emoji: "🐶",
    shelterName: "Happy Tails Shelter",
    blurb: "Luna loves belly rubs and is waiting for her forever home.",
  },
  {
    id: "shelter-milo",
    name: "Milo",
    species: "Cat",
    emoji: "🐱",
    shelterName: "Happy Tails Shelter",
    blurb: "Milo is a champion napper looking for a sunny windowsill.",
  },
  {
    id: "shelter-peanut",
    name: "Peanut",
    species: "Rabbit",
    emoji: "🐰",
    shelterName: "Happy Tails Shelter",
    blurb: "Peanut does happy binkies when she gets fresh hay.",
  },
];

export default function ShelterBuddy({
  buddy,
  onChoose,
  sponsoredId,
}: {
  buddy?: ShelterAnimal;
  onChoose?: (buddy: ShelterAnimal) => void;
  sponsoredId?: string;
}) {
  const [picked, setPicked] = useState<ShelterAnimal | null>(buddy ?? null);

  if (!picked) {
    return (
      <section aria-label="Choose a shelter buddy" className="text-center">
        <p className="text-5xl" aria-hidden="true">
          🏠
        </p>
        <h2 className="tt-heading mt-3 text-tt-navy">Meet your shelter buddy!</h2>
        <p className="tt-body mt-1 text-tt-ink-faint">
          These real animals need friends like you. Pick one to sponsor with your kindness.
        </p>
        <div className="mt-5 grid gap-3 text-left">
          {STARTER_SHELTER_BUDDIES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setPicked(b);
                onChoose?.(b);
              }}
              className="flex items-center gap-4 rounded-2xl border-2 border-tt-line bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-tt-pine hover:shadow-lg active:translate-y-0"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-tt-cream text-3xl" aria-hidden="true">
                {b.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.photoUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
                ) : (
                  b.emoji
                )}
              </span>
              <span>
                <span className="tt-heading block text-tt-navy">
                  {b.name} <span className="tt-body text-sm font-normal text-tt-ink-faint">· {b.species}</span>
                </span>
                <span className="tt-body block text-sm text-tt-ink-faint">{b.blurb}</span>
                <span className="tt-body block text-xs font-bold text-tt-pine">{b.shelterName}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  const isSponsored = sponsoredId === picked.id;
  return (
    <section aria-label="Your shelter buddy" className="rounded-3xl border-2 border-tt-pine/30 bg-white p-5">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-tt-cream text-4xl" aria-hidden="true">
          {picked.emoji}
        </span>
        <div>
          <h3 className="tt-heading text-lg text-tt-navy">
            {picked.name} <span className="tt-body text-sm font-normal text-tt-ink-faint">· your shelter buddy</span>
          </h3>
          <p className="tt-body text-sm text-tt-ink-faint">{picked.blurb}</p>
          <p className="tt-body text-xs font-bold text-tt-pine">{picked.shelterName}</p>
        </div>
      </div>
      {isSponsored && (
        <p className="tt-body mt-3 rounded-xl bg-tt-pine-tint p-3 text-center text-sm font-bold text-tt-pine">
          💛 You&rsquo;re sponsoring {picked.name}! Every kindness mission helps shelter animals like them.
        </p>
      )}
      <div className="tt-body mt-3 grid gap-2 text-sm">
        <p className="font-bold text-tt-navy">Ways to help {picked.name}:</p>
        <ul className="grid gap-1.5 text-tt-ink-faint">
          <li>🎨 Make a toy for shelter pets</li>
          <li>🏠 Visit the shelter with a grown-up</li>
          <li>💰 Save coins toward a shelter donation</li>
          <li>📣 Share {picked.name}&rsquo;s story (grown-ups help)</li>
        </ul>
      </div>
      <a
        href="/for-shelters"
        className="tt-body mt-4 block rounded-2xl bg-tt-cream py-3 text-center font-bold text-tt-pine hover:bg-tt-pine-tint"
      >
        Learn about shelter partnerships →
      </a>
    </section>
  );
}
