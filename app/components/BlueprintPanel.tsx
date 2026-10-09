/**
 * BlueprintPanel — Child Resilience Blueprint view (Phase 5).
 *
 * Renders the three-part personalized parenting guide: what we're noticing,
 * the body-first toolkit, and the growth plan. Parent view only.
 *
 * Guardrails (visual):
 *  - Behavioral observations only. No diagnosis, no clinical language,
 *    no mental-health labels — anywhere.
 *  - The engine-state metaphor ("cruising" / "running hot" / "stalled")
 *    is rendered as gentle pattern language, never as a label on the child.
 *  - Every recommendation is a concrete do-together action.
 *  - Honest labeling: shows whether the narrative came from live AI
 *    or the built-in writer.
 *  - Sadhguru voice: celebration first, forward-looking, never shaming.
 */
"use client";

import {
  type ResilienceBlueprint,
} from "@/lib/ai/blueprint";
import {
  FLOURISH_PILLAR_EMOJI,
  FLOURISH_PILLAR_LABELS,
} from "@/lib/ai/flourishing";

const STATE_META: Record<
  string,
  { emoji: string; headline: string; color: string }
> = {
  cruising: {
    emoji: "🛤️",
    headline: "A steady rhythm",
    color: "#2e7d32",
  },
  running_hot: {
    emoji: "🔥",
    headline: "Lots of wonderful energy",
    color: "#c46a1b",
  },
  stalled: {
    emoji: "🌱",
    headline: "A quieter stretch",
    color: "#6d3ed1",
  },
};

export function BlueprintPanel({
  blueprint,
  childName,
  loading,
}: {
  blueprint: ResilienceBlueprint | null;
  childName: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-tt-line bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-tt-ink-soft">
          Reading {childName}&apos;s patterns and putting the guide together…
        </p>
      </div>
    );
  }

  if (!blueprint) {
    return (
      <div className="rounded-3xl border border-tt-line bg-white p-6 text-center shadow-sm">
        <p className="text-2xl" aria-hidden="true">
          🗺️
        </p>
        <p className="mt-2 text-sm font-black text-tt-ink">
          No blueprint yet for {childName}
        </p>
        <p className="mt-1 text-xs font-semibold text-tt-ink-soft">
          Complete a few missions together first — the guide builds itself from
          real patterns, not guesses.
        </p>
      </div>
    );
  }

  const meta = STATE_META[blueprint.engineState] ?? STATE_META.cruising;

  return (
    <div className="overflow-hidden rounded-3xl border border-tt-line bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-tt-line bg-tt-cream px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">
          {childName}&apos;s Resilience Blueprint 🗺️
        </p>
        <p className="mt-1 text-lg font-black tracking-tight text-tt-ink">
          {meta.emoji} {meta.headline}
        </p>
        {blueprint.narrative && (
          <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
            {blueprint.narrative}
          </p>
        )}
        <p className="mt-2 text-[11px] font-semibold text-tt-ink-soft/70">
          {blueprint.mode === "ai" ? "✨ Personal guide" : "🌿 Built-in guide"} ·
          observations from mission patterns, never a medical assessment
        </p>
      </div>

      {/* Part 1 — What we're noticing */}
      <section className="border-b border-tt-line px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-tt-pine">
          👀 Part 1 · What we&apos;re noticing
        </p>
        <ul className="mt-3 space-y-2">
          {blueprint.observations.map((o) => (
            <li
              key={o.key}
              className="rounded-2xl bg-tt-cream px-4 py-3 text-sm font-semibold leading-6 text-tt-ink"
            >
              {o.text}
            </li>
          ))}
        </ul>
      </section>

      {/* Part 2 — Body-first toolkit */}
      <section className="border-b border-tt-line px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-tt-pine">
          🤸 Part 2 · The body-first toolkit
        </p>
        <p className="mt-1 text-xs font-semibold text-tt-ink-soft">
          Bodies settle before words do — do these <em>together</em>, side by
          side. No winners, no scores.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {blueprint.bodyToolkit.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-tt-line bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-tt-ink">{item.title}</p>
                <span className="shrink-0 rounded-full bg-tt-cream px-2 py-0.5 text-[11px] font-black text-tt-ink-soft">
                  {item.minutes} min
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">
                {item.detail}
              </p>
              {item.kind === "routine" && (
                <p className="mt-2 inline-block rounded-full bg-[#e7f4ef] px-2 py-0.5 text-[11px] font-black text-[#165a4b]">
                  Daily rhythm
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Part 3 — Growth plan */}
      <section className="px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-tt-pine">
          🌸 Part 3 · Growing what shines
        </p>
        <div className="mt-3 space-y-2">
          {blueprint.growthPlan.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-tt-line bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">
                  {FLOURISH_PILLAR_EMOJI[item.pillar]}
                </span>
                <p className="text-sm font-black text-tt-ink">{item.title}</p>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">
                {item.detail}
              </p>
              <p className="mt-1 text-[11px] font-bold text-tt-ink-soft/70">
                Grows {FLOURISH_PILLAR_LABELS[item.pillar]}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-2xl bg-tt-cream px-4 py-3 text-[11px] font-semibold leading-5 text-tt-ink-soft">
          This guide is built from {childName}&apos;s mission patterns — what
          they do, not a label on who they are. It refreshes as new patterns
          emerge. For worries about your child&apos;s wellbeing, your
          pediatrician is always the right first call.
        </p>
      </section>
    </div>
  );
}
