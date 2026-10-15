"use client";

import { useEffect, useState } from "react";

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
  const [gateNudge, setGateNudge] = useState(false);
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
          <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-tt-sun">
            Have a pet? Want one? Can't have one? There's a track for you.
          </p>
          <p className="mt-4 max-w-md text-base font-semibold leading-relaxed text-white/85">
            Daily pet missions build real-world skills. One weekly report for you.
          </p>
          <p className="mt-2 text-sm font-extrabold text-tt-sun">
            Ages 4–12 · ~10 minutes a day · mostly off-screen
          </p>
          {heroJoined ? (
            <>
              <p className="mt-6 inline-flex rounded-full bg-white/15 px-3 py-1.5 text-xs font-black text-tt-sun">
                🎉 You&apos;re on the launch list — the demo is yours
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
                  🏠 Start my family — free
                </button>
              </div>
              <p className="mt-3 text-sm font-semibold text-white/70">
                Demo: sample family, no account needed · Start my family: free for founding families
              </p>
            </>
          ) : (
            <div id="hero-list-form" className="mt-6">
              <p className="text-sm font-black uppercase tracking-widest text-tt-sun">
                Get on the email list for updates — then watch the demo
              </p>
              <ClaimSpotForm onJoined={() => setHeroJoined(true)} />
              {gateNudge && (
                <p className="mt-2 text-sm font-bold text-tt-sun">
                  👆 Pop your email in above — the demo unlocks right after.
                </p>
              )}
              <button
                onClick={onSignup}
                className="tt-btn tt-btn-lg mt-4 border-2 border-white/70 bg-white/10 font-black text-white backdrop-blur transition hover:bg-white/20"
              >
                🏠 Start my family — free
              </button>
              <p className="mt-3 text-sm font-semibold text-white/70">
                Free for founding families · One email for launch updates, no spam
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
          🤖 The AI personalizes missions, notices growing strengths, and writes one weekly insight.{" "}
          <a href="/ai-insights" className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2">See how</a>
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
        <p className="mt-4 text-center text-xs font-semibold text-tt-ink-faint">
          Traits drawn from published resilience research ·{" "}
          <a href="/science" className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2">Our Science</a>
        </p>
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
          onClick={() => gateDemo(onTryDemo)}
          className="tt-btn tt-btn-sun mx-auto mt-5"
        >
          Join them — try free
        </button>
        <p className="mt-6 text-center text-sm font-bold text-white/60">
          Where animals raise good humans.
        </p>
      </section>
      {/* CLAIM YOUR SPOT — Founding 500 launch list (same capture as production) */}
      <section className="rounded-3xl border border-tt-line bg-tt-sand p-5 text-center sm:p-6">
        <h2 className="text-xl font-black">Claim your spot 🚀</h2>
        <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-tt-ink-soft">
          Founding 500 — free for founding families. One email when your spot opens. No spam, ever.
        </p>
        <ClaimSpotForm />
      </section>
      <p className="pb-2 text-center text-xs font-semibold text-tt-ink-faint">
        Working with schools or shelters? <a href="/for-schools" className="underline">Schools</a> · <a href="/for-shelters" className="underline">Shelters</a> · <a href="/for-ptos" className="underline">PTOs</a>
      </p>
    </div>
  );
}

function ClaimSpotForm({ onJoined }: { onJoined?: () => void } = {}) {
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
        setJoined(true);
        onJoined?.();
        try { window.localStorage.setItem("tt-launch-joined", "1"); } catch { /* private mode */ }
        setStatus("saved");
        setMessage("🎉 You're on the launch list! Watch your inbox for tail wags.");
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
      <p className="mx-auto mt-4 max-w-md rounded-2xl bg-white px-4 py-3 text-sm font-bold text-tt-pine ring-1 ring-tt-line">
        🎉 You're on the launch list! Watch your inbox for tail wags.
      </p>
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
