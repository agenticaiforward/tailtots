"use client";

/**
 * ExploreMode — "Lantern, not leash."
 *
 * A first-class kid mode for unstructured time: zero tracking, zero missions,
 * zero measurement. The app celebrates the exploring instead of quantifying it.
 *
 * "Off exploring? Love it. We'll be here."
 */

import { useState } from "react";

export default function ExploreMode({ childName }: { childName: string }) {
  const [exploring, setExploring] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const startExploring = () => {
    setExploring(true);
    setStartedAt(new Date());
  };

  const stopExploring = () => {
    setExploring(false);
    setStartedAt(null);
  };

  if (exploring) {
    return (
      <section
        aria-label="Explore mode"
        className="rounded-3xl border-2 border-dashed border-tt-pine/40 bg-gradient-to-br from-tt-pine-tint to-tt-cream p-6 text-center sm:p-8"
      >
        <p className="animate-pulse text-5xl" aria-hidden="true">🧭</p>
        <h3 className="mt-3 text-2xl font-black text-tt-navy">Off exploring!</h3>
        <p className="mx-auto mt-2 max-w-md text-[15px] font-semibold leading-6 text-tt-ink-soft">
          Love it, {childName}. Go build, imagine, wander, wonder.
          Nothing is being tracked right now — this time is just yours. 💛
        </p>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-tt-pine">
          We&rsquo;ll be right here when you&rsquo;re back
        </p>
        <button
          onClick={stopExploring}
          className="tt-btn-press mt-5 min-h-11 rounded-xl border-2 border-tt-pine bg-white px-6 py-2.5 text-sm font-black text-tt-pine"
        >
          I&rsquo;m back!
        </button>
      </section>
    );
  }

  return (
    <button
      onClick={startExploring}
      className="tt-btn-press flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-tt-line bg-white/60 px-4 py-3.5 text-sm font-black text-tt-ink-soft transition-all hover:border-tt-pine hover:text-tt-pine"
      aria-label="Start explore mode — untracked free time"
    >
      <span className="text-2xl" aria-hidden="true">🧭</span>
      <span className="text-left">
        <span className="block">Explore mode</span>
        <span className="block text-xs font-semibold text-tt-ink-faint">
          Free time, zero tracking — just go play
        </span>
      </span>
    </button>
  );
}
