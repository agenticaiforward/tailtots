/**
 * FlourishingPanel — PERMA Growth Log dashboard (Phase 3).
 *
 * Renders the weekly flourishing snapshot as a pentagon "bloom" visualization
 * plus five kid-language pillar cards with trend arrows. Parent view only.
 *
 * Guardrails (visual):
 *  - Scores are INTERNAL and never rendered as numbers — the bloom shows
 *    relative shape, never a score, percentile, or rank.
 *  - No cross-child comparison anywhere. One child at a time.
 *  - Celebrate the brightest pillar first; frame dips as blooming.
 *  - Honest labeling: shows whether the snapshot came from live AI
 *    narration or the built-in celebration writer.
 */
"use client";

import {
  FLOURISH_PILLAR_EMOJI,
  FLOURISH_PILLAR_LABELS,
  FLOURISH_PILLAR_TAGLINES,
  FLOURISH_PILLARS,
  type FlourishScores,
  type FlourishTrend,
  type FlourishingSnapshot,
} from "@/lib/ai/flourishing";

const TREND_META: Record<FlourishTrend, { arrow: string; label: string; color: string }> = {
  up: { arrow: "↗", label: "climbing", color: "#2e7d32" },
  steady: { arrow: "→", label: "holding strong", color: "#8a7b4f" },
  down: { arrow: "↘", label: "blooming", color: "#6d3ed1" },
};

const PILLAR_COLORS: Record<string, string> = {
  joy: "#f4a259",
  stick: "#5e9c4f",
  together: "#e26d8d",
  giving: "#6d3ed1",
  mastery: "#2d9cdb",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Pentagon bloom: relative shape only — no numbers, no scores shown. */
function BloomChart({ scores }: { scores: FlourishScores }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 82;
  const points = FLOURISH_PILLARS.map((pillar, i) => {
    const angle = (360 / FLOURISH_PILLARS.length) * i;
    // Normalize to the child's own max so the shape shows BALANCE, not score.
    const values = FLOURISH_PILLARS.map((p) => scores[p]);
    const max = Math.max(...values, 1);
    const r = (scores[pillar] / max) * maxR;
    return polarToCartesian(cx, cy, r, angle);
  });
  const ring = (frac: number) =>
    FLOURISH_PILLARS.map((_, i) =>
      polarToCartesian(cx, cy, maxR * frac, (360 / FLOURISH_PILLARS.length) * i),
    )
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");
  const shape = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-52 w-52"
      role="img"
      aria-label="Your child's flourishing bloom — shape shows balance across five growth areas"
    >
      {[0.33, 0.66, 1].map((frac) => (
        <polygon
          key={frac}
          points={ring(frac)}
          fill="none"
          stroke="#ded8c7"
          strokeWidth="1.5"
        />
      ))}
      <polygon points={shape} fill="#6d3ed1" fillOpacity="0.22" stroke="#6d3ed1" strokeWidth="2.5" />
      {FLOURISH_PILLARS.map((pillar, i) => {
        const label = polarToCartesian(cx, cy, maxR + 24, (360 / FLOURISH_PILLARS.length) * i);
        return (
          <text
            key={pillar}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[#4f625b] text-[11px] font-black"
          >
            {FLOURISH_PILLAR_EMOJI[pillar]} {FLOURISH_PILLAR_LABELS[pillar]}
          </text>
        );
      })}
    </svg>
  );
}

export function FlourishingPanel({
  snapshot,
  childName,
}: {
  snapshot: FlourishingSnapshot | null;
  childName: string;
}) {
  if (!snapshot) {
    return (
      <section className="rounded-2xl border-2 border-[#6d3ed1]/25 bg-gradient-to-br from-[#f0edff] via-white to-[#faf8f0] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">
          🌸 Flourishing this week
        </p>
        <h3 className="mt-2 text-2xl font-black">Not enough blooms yet</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          Once {childName} completes a few missions, this becomes their weekly flourishing
          bloom — five growing areas, celebrated together.
        </p>
      </section>
    );
  }

  const brightestLabel = FLOURISH_PILLAR_LABELS[snapshot.brightest];

  return (
    <section className="rounded-2xl border-2 border-[#6d3ed1]/25 bg-gradient-to-br from-[#f0edff] via-white to-[#faf8f0] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">
            🌸 Flourishing this week
          </p>
          <h3 className="mt-2 text-2xl font-black">
            {brightestLabel} is shining brightest
          </h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#4f625b] ring-1 ring-[#ded8c7]">
          {snapshot.mode === "ai" ? "✨ Personal celebration" : "🌿 Built-in celebration"}
        </span>
      </div>

      {snapshot.narrative && (
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#17231f]">
          {snapshot.narrative}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
        <BloomChart scores={snapshot.scores} />
        <div className="grid gap-2 sm:grid-cols-2">
          {FLOURISH_PILLARS.map((pillar) => {
            const trend = TREND_META[snapshot.trends[pillar]];
            const isBrightest = pillar === snapshot.brightest;
            return (
              <div
                key={pillar}
                className={`rounded-xl bg-white p-3 shadow-sm ring-1 ${
                  isBrightest ? "ring-2 ring-[#6d3ed1]" : "ring-[#ded8c7]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-[#17231f]">
                    <span aria-hidden="true">{FLOURISH_PILLAR_EMOJI[pillar]} </span>
                    {FLOURISH_PILLAR_LABELS[pillar]}
                    {isBrightest && (
                      <span className="ml-2 rounded-full bg-[#6d3ed1] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                        Shining
                      </span>
                    )}
                  </p>
                  <span
                    className="text-sm font-black"
                    style={{ color: trend.color }}
                    title={trend.label}
                    aria-label={`${FLOURISH_PILLAR_LABELS[pillar]} is ${trend.label}`}
                  >
                    {trend.arrow}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#4f625b]">
                  {FLOURISH_PILLAR_TAGLINES[pillar]}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece5d2]">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      // Relative bar: scaled to the child's own max — never an absolute score.
                      width: `${Math.round(
                        (snapshot.scores[pillar] /
                          Math.max(...FLOURISH_PILLARS.map((p) => snapshot.scores[p]), 1)) *
                          100,
                      )}%`,
                      backgroundColor: PILLAR_COLORS[pillar],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold leading-5 text-[#4f625b]">
        Compared only to {childName}&rsquo;s own last week — never to other children.
        These blooms come from completed missions, badges, and Kid Bank giving, not from tests or surveys.
      </p>
    </section>
  );
}
