"use client";

/**
 * LanternPhilosophy — the 80/20 visual explainer + "what we don't track."
 *
 * "Lantern, not leash": we light the path on the hard parts.
 * Everything else belongs to the kid.
 *
 * Visual-first: a donut showing 20/80, icons for each side, explicit
 * untracked list. No paragraphs of philosophy.
 */

export default function LanternPhilosophy() {
  const weHelp = [
    { icon: "🌱", label: "Character moments" },
    { icon: "🧘", label: "Calming tools" },
    { icon: "🔑", label: "Keystone habits" },
    { icon: "💛", label: "Kindness practice" },
  ];
  const theirs = [
    { icon: "🤝", label: "Friendships" },
    { icon: "🎨", label: "Creativity" },
    { icon: "😴", label: "Boredom" },
    { icon: "🙃", label: "Mischief" },
    { icon: "🌈", label: "Imagination" },
    { icon: "⚽", label: "Free play" },
  ];

  return (
    <section aria-label="Our philosophy" className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-tt-pine">
        Lantern, not leash
      </p>
      <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-tt-navy">
        We hold the lantern. They choose the path.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-[15px] font-semibold leading-6 text-tt-ink-soft">
        TailTots helps with the important 20%. The other 80% — that&rsquo;s childhood,
        and it belongs to them.
      </p>

      {/* 80/20 visual */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border-2 border-tt-pine bg-tt-pine-tint p-6">
          <p className="text-center text-4xl font-black text-tt-pine">20%</p>
          <p className="mt-1 text-center text-sm font-black uppercase tracking-[0.12em] text-tt-pine">
            We light the way
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {weHelp.map((w) => (
              <div key={w.label} className="rounded-xl bg-white px-3 py-2.5 text-center">
                <p className="text-2xl" aria-hidden="true">{w.icon}</p>
                <p className="mt-1 text-xs font-black text-tt-navy">{w.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border-2 border-dashed border-tt-line bg-white p-6">
          <p className="text-center text-4xl font-black text-tt-ink-faint">80%</p>
          <p className="mt-1 text-center text-sm font-black uppercase tracking-[0.12em] text-tt-ink-soft">
            Just theirs
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {theirs.map((t) => (
              <div key={t.label} className="rounded-xl bg-tt-cream px-2 py-2.5 text-center">
                <p className="text-2xl" aria-hidden="true">{t.icon}</p>
                <p className="mt-1 text-[11px] font-black text-tt-ink-soft">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What we don't track */}
      <div className="mt-6 rounded-2xl bg-tt-night p-6 text-center">
        <p className="text-sm font-black uppercase tracking-[0.14em] text-tt-sun">
          What we don&rsquo;t track
        </p>
        <p className="mx-auto mt-2 max-w-lg text-[15px] font-semibold leading-6 text-white/85">
          We don&rsquo;t track free play, friendships, or imagination.
          We don&rsquo;t score who your child <em>is</em> — only celebrate what they <em>try</em>.
        </p>
        <p className="mt-3 text-lg font-black text-white">
          Some things are just theirs. 💛
        </p>
      </div>
    </section>
  );
}
