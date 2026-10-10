"use client";

import { useState } from "react";

/**
 * Visual-first landing — 70% less text than the previous version.
 * Rule: if it takes >12 words to explain, it needs a picture.
 */

export type AudienceLane = "parents" | "shelters" | "schools" | "ptos";

const LANES: Record<AudienceLane, { icon: string; label: string; headline: string; bullets: [string, string, string]; cta: string }> = {
  parents: {
    icon: "M24 12a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-9 20c0-4 4-7 9-7s9 3 9 7v2H15v-2Z",
    label: "Parents",
    headline: "10 minutes a day to raise kind, capable kids.",
    bullets: ["AI missions built for your child", "See growth you couldn't see before", "You approve everything"],
    cta: "Start free",
  },
  shelters: {
    icon: "M24 8c-4 0-7 3-7 7 0 2 1 4 2 5l-3 8 4-2 2 3 2-3 4 2-3-8c1-1 2-3 2-5 0-4-3-7-7-7Zm-7 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm14 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z",
    label: "Shelters",
    headline: "Turn kid missions into donation dollars.",
    bullets: ["Kids raise money for real animals", "List your shelter in 5 minutes", "Zero cost, live progress tracking"],
    cta: "List our shelter",
  },
  schools: {
    icon: "M8 10 24 4l16 6v24l-16-6-16 6V10Zm16 6v18",
    label: "Schools",
    headline: "Character growth without the testing.",
    bullets: ["48-mission curriculum, zero teacher prep", "No student scores, ever", "Aggregate kindness reports only"],
    cta: "Start a pilot",
  },
  ptos: {
    icon: "M12 8v24M8 12l4-4 4 4M16 32l4 4 4-4M6 20h36M6 28h36",
    label: "PTOs",
    headline: "Fundraise while building character.",
    bullets: ["Family challenges that raise money", "Parents see where every dollar goes", "Values + funding in one program"],
    cta: "Run a drive",
  },
};

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
}: {
  onTryDemo: () => void;
  onSignup: () => void;
}) {
  const [lane, setLane] = useState<AudienceLane>("parents");
  const active = LANES[lane];

  return (
    <div className="space-y-6">
      {/* HERO — one image, 10 words, ONE CTA */}
      <section className="relative overflow-hidden rounded-3xl bg-tt-navy text-white">
        <img
          src="/landing/kid-dog.jpg"
          alt="Kid hugging their dog"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tt-navy via-tt-navy/60 to-transparent" aria-hidden="true" />
        <div className="relative p-6 pb-8 pt-16 sm:p-10 sm:pt-24">
          <h1 className="max-w-lg text-4xl font-black leading-[1.05] sm:text-5xl">
            Kind kids. Capable kids. Ten minutes a day.
          </h1>
          <button
            onClick={onTryDemo}
            className="tt-btn-press mt-6 min-h-14 rounded-2xl bg-tt-sun px-8 py-4 text-base font-black text-tt-ink shadow-xl"
          >
            Try it now — free
          </button>
          <p className="mt-3 text-sm font-semibold text-white/70">
            No signup. Your kid does a mission in 60 seconds.
          </p>
        </div>
      </section>

      {/* AUDIENCE LANES — 10-second test */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <div className="grid grid-cols-4 gap-2" role="tablist" aria-label="Who is this for?">
          {(Object.keys(LANES) as AudienceLane[]).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={lane === key}
              onClick={() => setLane(key)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all ${
                lane === key ? "bg-tt-navy text-white shadow-md" : "bg-tt-cream text-tt-ink-soft"
              }`}
            >
              <svg viewBox="0 0 48 48" className="size-7" fill="currentColor" aria-hidden="true">
                <path d={LANES[key].icon} />
              </svg>
              <span className="text-xs font-extrabold">{LANES[key].label}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 text-center" key={lane}>
          <h2 className="tt-animate-pop-in text-2xl font-black text-tt-ink">{active.headline}</h2>
          <ul className="mx-auto mt-3 max-w-md space-y-2">
            {active.bullets.map((b) => (
              <li key={b} className="flex items-center justify-center gap-2 text-sm font-bold text-tt-ink-soft">
                <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-tt-pine" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <button
            onClick={lane === "parents" ? onTryDemo : onSignup}
            className="tt-btn-press mt-4 min-h-12 rounded-2xl bg-tt-pine px-6 py-3 text-sm font-extrabold text-white"
          >
            {active.cta}
          </button>
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

      {/* TRAIT METAPHORS — pictures, not definitions */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">What kids grow here</h2>
        <p className="mt-1 text-center text-sm font-semibold text-tt-ink-soft">Seven strengths. Zero lectures.</p>
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

      {/* SOCIAL PROOF — photos, not text blocks */}
      <section className="overflow-hidden rounded-3xl bg-tt-night p-5 text-white sm:p-6">
        <h2 className="text-center text-xl font-black">Families are growing</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { src: "/landing/household-african-american-dog.jpg", name: "The Johnsons", missions: "127 missions" },
            { src: "/landing/household-south-asian-girl-cat-bedroom.jpg", name: "The Patels", missions: "89 missions" },
            { src: "/landing/household-east-asian-siblings-rabbit-garden.jpg", name: "The Chens", missions: "203 missions" },
            { src: "/landing/household-latina-girl-guineapig-livingroom.jpg", name: "The Garcias", missions: "64 missions" },
            { src: "/landing/household-african-american-siblings-dog-park.jpg", name: "The Williams", missions: "156 missions" },
            { src: "/landing/household-south-asian-cat.jpg", name: "The Sharmas", missions: "98 missions" },
            { src: "/landing/household-east-asian-rabbit.jpg", name: "The Lius", missions: "174 missions" },
            { src: "/landing/household-latino-guinea-pig.jpg", name: "The Fernandezes", missions: "71 missions" },
          ].map((f, i) => (
            <div key={f.src} className="relative overflow-hidden rounded-2xl">
              <img src={f.src} alt={`Family ${i + 1} with their pet`} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                <p className="text-xs font-extrabold text-white">{f.name}</p>
                <p className="text-[11px] font-semibold text-white/80">{f.missions}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onTryDemo}
          className="tt-btn-press mx-auto mt-5 block min-h-12 rounded-2xl bg-tt-sun px-8 py-3 text-sm font-black text-tt-ink"
        >
          Join them — try free
        </button>
      </section>
    </div>
  );
}
