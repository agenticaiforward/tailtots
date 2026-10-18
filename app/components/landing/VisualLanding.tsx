"use client";

import { useEffect, useRef, useState } from "react";

import { submitLaunchInterest } from "@/lib/supabase";

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

/**
 * The bond is ancient — REAL artifacts, REAL findings (founder, Oct 18,
 * 2026: replace the generated family photos with the actual evidence).
 * Every image is a photograph of the real artifact, openly licensed
 * (credits under the slideshow). Captions stick to what archaeologists
 * and researchers actually found — no invented history.
 */
const HISTORY_SLIDES = [
  {
    era: "≈ 36,000 years ago",
    place: "Chauvet Cave · France",
    img: "/landing/history-chauvet.jpg",
    alt: "Lions painted on the wall of Chauvet Cave, France, about 36,000 years ago",
    headline: "Worth painting forever",
    text: "By torchlight, someone painted lions, horses and rhinos deep inside a cave. The oldest art humans ever made is full of animals — we have lived beside them, and looked up to them, from the very beginning.",
  },
  {
    era: "≈ 14,000 years ago",
    place: "Bonn-Oberkassel · Germany",
    img: "/landing/history-oberkassel.jpg",
    alt: "Skeleton of the Bonn-Oberkassel dog, buried with two humans about 14,000 years ago",
    headline: "A sick puppy, nursed back to health",
    text: "Archaeologists found this dog buried beside a man and a woman — the oldest dog burial known. Its teeth show the puppy survived weeks of a deadly illness it could not have beaten alone. Someone nursed it. Then the family buried it with them.",
  },
  {
    era: "≈ 3,400 years ago",
    place: "Tomb of Nakht · Egypt",
    img: "/landing/history-egypt.jpg",
    alt: "Wall painting from the Tomb of Nakht showing oxen plowing beside farmers, about 3,400 years ago",
    headline: "Partners in the everyday",
    text: "A scribe painted his whole world to take into eternity — family, harvests, and oxen plowing alongside the farmers. Animals were never separate from family life. They were woven through it, every single day.",
  },
  {
    era: "≈ 1,950 years ago",
    place: "Pompeii · Italy",
    img: "/landing/history-pompeii.jpg",
    alt: "Cave Canem mosaic of a guard dog at the entrance of a Pompeii home, about 1,950 years old",
    headline: "The dog at the door",
    text: "At a family's front entrance in Pompeii, a mosaic guard dog and the words CAVE CANEM — beware of the dog. The dog protected the home, and the home honored the dog at its very threshold.",
  },
  {
    era: "Today",
    place: "The science",
    img: "/landing/kid-dog.jpg",
    alt: "A child with their dog today",
    headline: "Your brain still answers theirs",
    text: "When you and your dog look at each other, oxytocin — the bonding hormone — rises in both of you (Science, 2015). Petting an animal lowers cortisol, the stress hormone. And studies link growing up with a pet to lower anxiety in children.",
  },
  {
    era: "Today",
    place: "Your family",
    img: "/landing/household-african-american-dog.jpg",
    alt: "A family with their dog at home today (illustrative photo)",
    headline: "The newest chapter is yours",
    text: "Tens of thousands of years of kids growing up beside animals — learning patience, gentleness, responsibility, and how to care for a life smaller than their own. TailTots just gives that ancient practice a daily shape.",
  },
];

function HistorySlideshow() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = HISTORY_SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6500);
    return () => clearInterval(t);
  }, [paused, count]);

  const go = (dir: number) => {
    setPaused(true);
    setIndex((i) => (i + dir + count) % count);
  };
  const slide = HISTORY_SLIDES[index];

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-2xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <img
          key={slide.img}
          src={slide.img}
          alt={slide.alt}
          className="aspect-[16/10] w-full object-cover"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-tt-sun backdrop-blur-sm">
          {slide.era} · {slide.place}
        </span>
        <button
          onClick={() => go(-1)}
          aria-label="Previous story"
          className="tt-btn-press absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl font-black text-white backdrop-blur-sm"
        >
          ‹
        </button>
        <button
          onClick={() => go(1)}
          aria-label="Next story"
          className="tt-btn-press absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-xl font-black text-white backdrop-blur-sm"
        >
          ›
        </button>
      </div>
      <div className="px-1 pt-4 text-left sm:px-2">
        <h3 className="text-lg font-black leading-snug">{slide.headline}</h3>
        <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-white/70">{slide.text}</p>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {HISTORY_SLIDES.map((s, i) => (
          <button
            key={s.img}
            onClick={() => { setPaused(true); setIndex(i); }}
            aria-label={`Story ${i + 1}: ${s.headline}`}
            className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-tt-sun" : "w-2 bg-white/30"}`}
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] font-semibold leading-4 text-white/35">
        Real artifacts, photographed as found. Chauvet lions (public domain) · Oberkassel dog — Don Hitchcock, CC BY-SA 4.0 ·
        Tomb of Nakht — The Met, CC0 · Cave Canem, Pompeii — Yair Haklai, CC BY-SA 4.0 · via Wikimedia Commons
      </p>
    </div>
  );
}

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
      img: "/landing/kid-cat.jpg",
      alt: "Kid dreaming of a cat",
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

  // Email-first funnel (founder, 2026-10-15): joining the email list
  // unlocks the demo. Visitors who already joined on this device go
  // straight in; everyone else meets the list form first.
  const [heroJoined, setHeroJoined] = useState(false);
  const [heroAlreadyJoined, setHeroAlreadyJoined] = useState(false);
  const [gateNudge, setGateNudge] = useState(false);
  const handleListJoined = (alreadyJoined = false) => {
    setHeroJoined(true);
    if (alreadyJoined) setHeroAlreadyJoined(true);
  };
  useEffect(() => {
    try {
      if (window.localStorage.getItem("tt-launch-joined") === "1") setHeroJoined(true);
    } catch { /* private mode */ }
  }, []);
  const listJoinedNow = () => {
    try { return window.localStorage.getItem("tt-launch-joined") === "1"; } catch { return false; }
  };
  const gateDemo = (action: () => void) => {
    if (heroJoined || listJoinedNow()) { action(); return; }
    setGateNudge(true);
    document.getElementById("hero-list-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-6">
      {/* HERO — one image, short copy, email gate → demo */}
      <section className="relative overflow-hidden rounded-3xl bg-tt-navy text-white">
        <img
          src="/landing/hero-candid.jpg"
          alt="Laughing kid with their golden retriever in the backyard"
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tt-navy via-tt-navy/60 to-transparent" aria-hidden="true" />
        <div className="relative p-6 pb-8 pt-16 sm:p-10 sm:pt-24">
          <h1 className="max-w-lg text-4xl font-black leading-[1.05] sm:text-5xl">
            Character isn&apos;t taught. It&apos;s practiced.
          </h1>
          <p className="mt-4 text-sm font-extrabold text-tt-sun">
            Ages 4–12 · ~10 minutes a day for parents · kids practice mostly off-screen
          </p>
          {heroJoined ? (
            <>
              <p className="mt-6 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-xs font-black text-tt-sun">
                {heroAlreadyJoined
                  ? "🎉 You’re already on the launch list — the demo is yours"
                  : "🎉 You’re on the launch list — the demo is yours"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={onTryDemo}
                  className="tt-btn tt-btn-sun tt-btn-lg tt-motion-pop"
                >
                  Try a mission free
                </button>
                <button
                  onClick={onSignup}
                  className="tt-btn tt-btn-lg border-2 border-white/70 bg-white/10 font-black text-white backdrop-blur transition hover:bg-white/20"
                >
                  🏠 Start my family for free
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold text-white/70">
                For founding families only · No spam, ever
              </p>
            </>
          ) : (
            <div id="hero-list-form" className="mt-6">
              <p className="text-sm font-black uppercase tracking-widest text-tt-sun">
                Get on the email list for updates — then watch the demo
              </p>
              <ClaimSpotForm onJoined={handleListJoined} onShowDemo={onTryDemo} />
              {gateNudge && (
                <p className="mt-2 text-sm font-bold text-tt-sun">
                  👆 Pop your email in above — the demo unlocks right after.
                </p>
              )}
              <button
                onClick={onSignup}
                className="tt-btn tt-btn-lg mt-4 border-2 border-white/70 bg-white/10 font-black text-white backdrop-blur transition hover:bg-white/20"
              >
                🏠 Start my family for free
              </button>
              <p className="mt-3 text-sm font-semibold text-white/70">
                For founding families only · No spam, ever
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 3-TRACK SELECTOR — every family sees their door */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">Which sounds like your family?</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => gateDemo(() => (onTrackSelect ? onTrackSelect(t.id) : onTryDemo()))}
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

      {/* SAFETY — scrolling banner (Oct 15): the whole trust story in one moving band, details live on /promise */}
      <section aria-label="Safety by design" className="overflow-hidden rounded-3xl bg-tt-pine py-3 text-white">
        <div className="tt-marquee-track flex w-max items-center gap-8 pr-8">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8" aria-hidden={dup === 1}>
              {[
                "🛡️ Safety, by design",
                "🚫 No strangers. Ever.",
                "💬 No open chat",
                "✅ You approve everything",
                "🔒 Closed family circle",
                "🎤 AI guide only — off until you turn it on",
                "⏱️ ~10 minutes a day, mostly off-screen",
              ].map((item) => (
                <span key={item} className="flex items-center gap-8 whitespace-nowrap text-sm font-black">
                  {item}
                  <span className="text-white/40" aria-hidden="true">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] font-bold text-white/70">
          Your child will never talk to a stranger on TailTots. <a href="/promise" className="underline decoration-tt-sun decoration-2 underline-offset-2">Our Promise</a>
        </p>
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
        <p className="mt-4 border-t border-tt-line pt-3 text-center text-sm font-semibold text-tt-ink-soft">
          🤖 The AI personalizes missions, notices growing strengths, and writes one weekly insight.
          <span className="text-tt-ink-faint"> · Patent pending</span>
        </p>
      </section>

      {/* TRAIT METAPHORS — pictures, not definitions */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5 sm:p-6">
        <h2 className="text-center text-xl font-black text-tt-ink">What kids grow here</h2>
        <p className="mt-1 text-center text-sm font-semibold text-tt-ink-soft">Eight strengths. Zero lectures. You see the growth — they just see play.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRAIT_METAPHORS.map((t) => (
            <div key={t.trait} className="flex flex-col items-center rounded-2xl bg-tt-cream p-3 text-center transition-transform hover:scale-105 [&_svg]:size-11">
              {t.svg}
              <p className="mt-1.5 text-sm font-extrabold text-tt-ink">{t.trait}</p>
              <p className="text-xs font-semibold text-tt-ink-soft">{t.caption}</p>
            </div>
          ))}
        </div>
        {/* LIFE SKILLS — the practice layer under the traits: character grows through real responsibility and real skills, practiced daily */}
        <div className="mt-4 border-t border-tt-line pt-4">
          <p className="text-center text-sm font-extrabold text-tt-ink">
            Grown through real responsibility
          </p>
          <p className="mt-0.5 text-center text-xs font-semibold text-tt-ink-soft">
            Real skills, practiced daily — not taught in lessons.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[
              { icon: "🐾", label: "Pet care" },
              { icon: "🪙", label: "Money" },
              { icon: "🏠", label: "Home" },
              { icon: "🛟", label: "Safety" },
              { icon: "🤝", label: "People" },
            ].map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-tt-cream px-3 py-1.5 text-xs font-extrabold text-tt-ink"
              >
                <span aria-hidden="true">{s.icon}</span>
                {s.label}
              </span>
            ))}
          </div>
        </div>

      </section>

      {/* THE ANCIENT BOND — real artifacts, real findings (replaces the
          generated family-photo gallery, founder Oct 18, 2026) */}
      <section className="overflow-hidden rounded-3xl bg-tt-night p-5 text-white sm:p-6">
        <h2 className="text-center text-xl font-black">Not a trend. A 36,000-year-old story.</h2>
        <p className="mt-1 text-center text-xs font-semibold text-white/50">
          Real artifacts. Real science. The human–animal bond is the oldest classroom there is.
        </p>
        <div className="mt-4">
          <HistorySlideshow />
        </div>
        <button
          onClick={() => gateDemo(onTryDemo)}
          className="tt-btn tt-btn-sun mx-auto mt-5"
        >
          Start your family's chapter — free
        </button>
        <p className="mt-6 text-center text-sm font-bold text-white/60">
          Where animals raise good humans.
        </p>
      </section>
      {/* CLAIM YOUR SPOT — founding families launch list (same capture as production) */}
      <section className="rounded-3xl border border-tt-line bg-tt-sand p-5 text-center sm:p-6">
        <h2 className="text-xl font-black">Claim your spot 🚀</h2>
        <ClaimSpotForm onJoined={handleListJoined} onShowDemo={onTryDemo} />
      </section>
      <p className="pb-2 text-center text-xs font-semibold text-tt-ink-faint">
        Working with schools or shelters? <a href="/for-schools" className="underline">Schools</a> · <a href="/for-shelters" className="underline">Shelters</a> · <a href="/for-ptos" className="underline">PTOs</a>
      </p>
    </div>
  );
}

function ClaimSpotForm({
  onJoined,
  onShowDemo,
}: {
  onJoined?: (alreadyJoined: boolean) => void;
  onShowDemo?: () => void;
} = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("tt-launch-joined") === "1") setJoined(true);
    } catch { /* private mode */ }
  }, []);

  async function claim() {
    setStatus("saving");
    setMessage("");
    try {
      const result = await submitLaunchInterest({ email, source: "visual-landing" });
      if (result.mode === "cloud") {
        const alreadyJoined = result.alreadyJoined === true;
        setJoined(true);
        onJoined?.(alreadyJoined);
        try { window.localStorage.setItem("tt-launch-joined", "1"); } catch { /* private mode */ }
        setStatus("saved");
        setMessage(
          alreadyJoined
            ? "🎉 You’re already on the launch list — the demo is open for you."
            : "🎉 You're on the launch list! Watch your inbox for tail wags.",
        );
        setEmail("");
      } else {
        // Not connected to the signup service — say so honestly instead of
        // pretending the email reached the list (the Oct 8 silent-loss lesson).
        setStatus("error");
        setMessage("We couldn't reach the signup service just now — please try again in a moment.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not save this signup yet.");
    }
  }

  if (joined && status !== "error") {
    return (
      <div className="mx-auto mt-4 max-w-md rounded-2xl bg-white px-4 py-3 ring-1 ring-tt-line">
        <p className="text-sm font-bold text-tt-pine">
          {message || "🎉 You're on the launch list! Watch your inbox for tail wags."}
        </p>
        {onShowDemo ? (
          <button type="button" onClick={onShowDemo} className="tt-btn tt-btn-sun mt-3 min-h-11 px-4 py-2 text-sm">
            Try the demo →
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-4 max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="tt-claim-email">Parent email</label>
        <input
          id="tt-claim-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Parent email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && status !== "saving") void claim(); }}
          className="min-h-12 flex-1 rounded-xl border border-tt-line bg-white px-4 text-sm font-semibold text-tt-ink placeholder:text-tt-ink-faint"
        />
        <button
          type="button"
          onClick={() => void claim()}
          disabled={status === "saving"}
          className="tt-btn tt-btn-sun min-h-12 shrink-0 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Claim your spot"}
        </button>
      </div>
      {message ? (
        <p className={`mt-3 text-sm font-bold ${status === "error" ? "text-red-700" : "text-tt-pine"}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
