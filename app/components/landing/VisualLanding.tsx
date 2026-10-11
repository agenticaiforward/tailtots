"use client";

import { useState } from "react";

/**
 * Visual-first landing — 70% less text than the previous version.
 * Rule: if it takes >12 words to explain, it needs a picture.
 */

/** Visual metaphors for Thrivers traits — pictures, not definitions. */
const TRAIT_METAPHORS = [
  { trait: "Perseverance", visual: "sprout", caption: "Keep going", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <rect x="8" y="44" width="48" height="12" rx="3" fill="#8a8f8b" />
      <rect x="14" y="38" width="36" height="8" rx="2" fill="#6b7280" />
      <path d="M32 40 C32 30 30 24 26 18" stroke="#165a4b" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="16" rx="7" ry="4" fill="#22c55e" transform="rotate(-25 24 16)" />
      <ellipse cx="32" cy="12" rx="6" ry="3.5" fill="#4ade80" transform="rotate(15 32 12)" />
    </svg>
  )},
  { trait: "Empathy", visual: "umbrella", caption: "Feel with others", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <path d="M14 30a18 18 0 0 1 36 0Z" fill="#2563eb" />
      <path d="M32 12v34" stroke="#17231f" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 46a6 6 0 0 0 6 6" stroke="#17231f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="22" cy="40" r="4" fill="#ffd166" />
      <circle cx="42" cy="40" r="4" fill="#ffd166" />
      <path d="M12 8l2 4M52 8l-2 4M32 4v5" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )},
  { trait: "Confidence", visual: "sun", caption: "Shine bright", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill="#ffd166" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line key={a} x1="32" y1="12" x2="32" y2="6" stroke="#f4b400" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />
      ))}
      <circle cx="27" cy="30" r="2" fill="#17231f" />
      <circle cx="37" cy="30" r="2" fill="#17231f" />
      <path d="M27 36 Q32 40 37 36" stroke="#17231f" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )},
  { trait: "Self-control", visual: "anchor", caption: "Steady inside", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <circle cx="32" cy="14" r="5" fill="none" stroke="#1e3a8a" strokeWidth="3" />
      <path d="M32 19v30M20 28h24" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 40a18 18 0 0 0 36 0" fill="none" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="14" cy="38" r="3" fill="#1e3a8a" />
      <circle cx="50" cy="38" r="3" fill="#1e3a8a" />
    </svg>
  )},
  { trait: "Curiosity", visual: "magnifier", caption: "Wonder more", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <circle cx="26" cy="26" r="14" fill="none" stroke="#6d3ed1" strokeWidth="4" />
      <line x1="36" y1="36" x2="50" y2="50" stroke="#6d3ed1" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 22l3 3M28 20l1 4" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="26" r="4" fill="#f0edff" />
    </svg>
  )},
  { trait: "Integrity", visual: "compass", caption: "True north", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <circle cx="32" cy="32" r="18" fill="none" stroke="#7a4b12" strokeWidth="3" />
      <path d="M32 18l5 14 14 5-14 5-5 14-5-14-14-5 14-5Z" fill="#f4b400" />
      <circle cx="32" cy="32" r="3" fill="#7a4b12" />
    </svg>
  )},
  { trait: "Optimism", visual: "rainbow", caption: "Brighter days", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <path d="M10 44a22 22 0 0 1 44 0" fill="none" stroke="#f43f5e" strokeWidth="4" />
      <path d="M16 44a16 16 0 0 1 32 0" fill="none" stroke="#f4b400" strokeWidth="4" />
      <path d="M22 44a10 10 0 0 1 20 0" fill="none" stroke="#22c55e" strokeWidth="4" />
      <ellipse cx="14" cy="46" rx="8" ry="5" fill="#eef2ff" />
      <ellipse cx="50" cy="46" rx="8" ry="5" fill="#eef2ff" />
    </svg>
  )},
  { trait: "Respect", visual: "bridge", caption: "Meet halfway", svg: (
    <svg viewBox="0 0 64 64" className="size-16" aria-hidden="true">
      <path d="M8 38 Q32 10 56 38" fill="none" stroke="#165a4b" strokeWidth="4" strokeLinecap="round" />
      <line x1="8" y1="38" x2="56" y2="38" stroke="#165a4b" strokeWidth="4" strokeLinecap="round" />
      <line x1="20" y1="30" x2="20" y2="38" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="25" x2="32" y2="38" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="30" x2="44" y2="38" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 50 q4 -3 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )},
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Kid does a mission",
    caption: "Real-world. 10 minutes.",
    svg: (
      <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
        <rect x="14" y="10" width="36" height="44" rx="8" fill="#fff4d8" stroke="#f4b400" strokeWidth="2.5" />
        <circle cx="32" cy="26" r="8" fill="#ffd166" />
        <path d="M22 44h20M26 50h12" stroke="#f4b400" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "2",
    title: "AI learns & adapts",
    caption: "Personal. Automatic.",
    svg: (
      <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
        <circle cx="32" cy="32" r="20" fill="#f0edff" stroke="#6d3ed1" strokeWidth="2.5" />
        <path d="M32 20v12l8 6" stroke="#6d3ed1" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="32" r="3" fill="#6d3ed1" />
        {[0, 90, 180, 270].map((a) => (
          <circle key={a} cx="32" cy="8" r="3" fill="#a855f7" transform={`rotate(${a} 32 32)`} />
        ))}
      </svg>
    ),
  },
  {
    step: "3",
    title: "Parent sees growth",
    caption: "One insight weekly.",
    svg: (
      <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
        <path d="M10 50 Q20 30 32 34 T54 20" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
        <circle cx="54" cy="20" r="5" fill="#22c55e" />
        <path d="M10 50h44" stroke="#ded8c7" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="42" r="3" fill="#4ade80" />
        <circle cx="32" cy="36" r="3" fill="#4ade80" />
        <circle cx="43" cy="28" r="3" fill="#4ade80" />
      </svg>
    ),
  },
];

export function VisualLanding({
  onTryDemo,
  onSignup,
  onTrackSelect,
}: {
  onTryDemo: () => void;
  onSignup: () => void;
  onTrackSelect?: (track: "have" | "want" | "cant") => void;
}) {

  const TRACKS = [
    {
      id: "have" as const,
      emoji: "🐶",
      question: "Have a pet?",
      line: "Missions with your pet",
      img: "/landing/kid-guinea-pig.jpg",
      alt: "Happy kid holding their guinea pig",
    },
    {
      id: "want" as const,
      emoji: "💭",
      question: "Want a pet?",
      line: "Prove you're ready",
      img: "/landing/kid-dog.jpg",
      alt: "Kid dreaming of hugging a dog",
    },
    {
      id: "cant" as const,
      emoji: "🐾",
      question: "Can't have pets?",
      line: "Sponsor a shelter buddy",
      img: "/landing/audience-shelter-hero.jpg",
      alt: "Kid with a shelter animal",
    },
  ];

  return (
    <div className="space-y-6">
      {/* HERO — one image, 10 words, ONE CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-tt-navy text-white">
        <img
          src="/landing/hero-sheep.jpg"
          alt="Kid petting a fluffy sheep at golden hour"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tt-navy via-tt-navy/60 to-transparent" aria-hidden="true" />
        <div className="relative p-6 pb-8 pt-16 sm:p-10 sm:pt-24">
          <h1 className="max-w-lg text-4xl font-black leading-[1.05] sm:text-5xl">
            Character isn&apos;t taught. It&apos;s practiced.
          </h1>
          <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-tt-sun">
            Have a pet? Want one? Can't have one? There's a track for you.
          </p>
          <p className="mt-4 max-w-md text-base font-semibold leading-relaxed text-white/85">
            Kids complete daily missions with your real pet — practicing kindness, responsibility, courage, and real-world life skills. You get a simple weekly report on the traits they're building.
          </p>
          <button
            onClick={onTryDemo}
            className="tt-btn tt-btn-sun tt-btn-lg tt-motion-pop mt-6"
          >
            Try a mission free
          </button>
          <p className="mt-3 text-sm font-semibold text-white/70">
            Try the demo — no account needed · Free for founding families
          </p>
        </div>
      </section>

      {/* 3-TRACK SELECTOR — every family sees their door */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">Which sounds like your family?</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTrackSelect ? onTrackSelect(t.id) : onTryDemo()}
              className="tt-btn-press group overflow-hidden rounded-2xl border border-tt-line bg-white text-left shadow-sm transition-transform hover:scale-[1.02]"
            >
              <div className="relative h-32 overflow-hidden sm:h-36">
                <img src={t.img} alt={t.alt} className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
                <p className="absolute bottom-2 left-3 text-2xl" aria-hidden="true">{t.emoji}</p>
              </div>
              <div className="p-4">
                <p className="text-base font-black text-tt-ink">{t.question}</p>
                <p className="mt-0.5 text-sm font-bold text-tt-pine">{t.line} →</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* PARENT PROMISE — why parents trust this */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-black text-tt-ink">You see the growth. They just see play.</h2>
          <ul className="mx-auto mt-4 max-w-md space-y-2.5">
            {[
              "AI missions built for your child's age and pet",
              "One weekly insight — never a dashboard to obsess over",
              "You approve everything. Your child only sees what you allow.",
            ].map((b) => (
              <li key={b} className="flex items-center justify-center gap-2 text-sm font-bold text-tt-ink-soft">
                <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-tt-pine" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <button
            onClick={onTryDemo}
            className="tt-btn tt-btn-primary mt-5"
          >
            Try a mission free
          </button>
          <p className="mt-4 text-xs font-semibold text-tt-ink-faint">
            Working with schools or shelters? <a href="/for-schools" className="underline">Schools</a> · <a href="/for-shelters" className="underline">Shelters</a> · <a href="/for-ptos" className="underline">PTOs</a>
          </p>
        </div>
      </section>

      {/* HOW IT WORKS — 3 icons, not paragraphs */}
      <section className="rounded-3xl border border-tt-line bg-tt-cream p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">How it works</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="flex flex-col items-center rounded-2xl bg-tt-paper p-4 text-center shadow-sm">
              <div className="grid size-10 place-items-center rounded-full bg-tt-navy text-sm font-black text-white">{s.step}</div>
              <div className="mt-2">{s.svg}</div>
              <p className="mt-2 text-sm font-extrabold text-tt-ink">{s.title}</p>
              <p className="text-xs font-semibold text-tt-ink-soft">{s.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW THE AI WORKS — 3 icons, links to /ai-insights deep dive */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">How the AI works</h2>
        <p className="mt-1 text-center text-sm font-semibold text-tt-ink-soft">Personalized missions. No black box.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { icon: "🎯", title: "Personalizes", line: "Missions matched to age, pet & traits" },
            { icon: "🌱", title: "Notices", line: "Spots growing strengths from behavior" },
            { icon: "💛", title: "Guides", line: "One weekly insight for parents" },
          ].map((s) => (
            <div key={s.title} className="flex flex-col items-center rounded-2xl bg-tt-cream p-4 text-center">
              <p className="text-3xl" aria-hidden="true">{s.icon}</p>
              <p className="mt-2 text-sm font-extrabold text-tt-ink">{s.title}</p>
              <p className="text-xs font-semibold text-tt-ink-soft">{s.line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TRAIT METAPHORS — pictures, not definitions */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">What kids grow here</h2>
        <p className="mt-1 text-center text-sm font-semibold text-tt-ink-soft">Eight strengths. Zero lectures.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRAIT_METAPHORS.map((t) => (
            <div key={t.trait} className="flex flex-col items-center rounded-2xl bg-tt-cream p-4 text-center transition-transform hover:scale-105">
              {t.svg}
              <p className="mt-2 text-sm font-extrabold text-tt-ink">{t.trait}</p>
              <p className="text-xs font-semibold text-tt-ink-soft">{t.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAMILIES — illustrative lifestyle photography */}
      <section className="overflow-hidden rounded-3xl bg-tt-night p-5 text-white sm:p-6">
        <h2 className="text-center text-xl font-black">Made for families like yours</h2>
        <p className="mt-1 text-center text-xs font-semibold text-white/50">Illustrative photos</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {[
            ["African American family with their dog", "/landing/household-african-american-dog.jpg"],
            ["South Asian girl with her cat", "/landing/household-south-asian-girl-cat-bedroom.jpg"],
            ["East Asian siblings with their rabbit", "/landing/household-east-asian-siblings-rabbit-garden.jpg"],
            ["Latina girl with her guinea pig", "/landing/household-latina-girl-guineapig-livingroom.jpg"],
            ["Caucasian siblings with their cat", "/landing/household-caucasian-siblings-cat-livingroom.jpg"],
          ].map(([alt, src]) => (
            <div key={src} className="w-[calc(50%-6px)] overflow-hidden rounded-2xl sm:w-[calc(20%-10px)]">
              <img src={src} alt={`Family with pet — illustrative photo: ${alt}`} className="aspect-square w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
        <button
          onClick={onTryDemo}
          className="tt-btn tt-btn-sun mx-auto mt-5"
        >
          Join them — try free
        </button>
        <p className="mt-6 text-center text-sm font-bold text-white/60">
          Where animals raise good humans.
        </p>
      </section>
    </div>
  );
}
