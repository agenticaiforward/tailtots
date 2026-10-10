"use client";

/**
 * Independence Milestones — the celebrated journey of needing less help.
 *
 * NOT a scored trait. A timeline of autonomy moments: unlocked milestones
 * shine, the next one glows gently in progress, locked ones wait without
 * pressure. "The light gets dimmer as the kid shines brighter."
 */

import { useMemo } from "react";
import {
  detectIndependenceMilestones,
  type IndependenceEvent,
  type IndependenceMilestone,
} from "../../lib/ai/independence";

export interface IndependenceMilestonesProps {
  events: IndependenceEvent[];
  childName: string;
  nowMs?: number;
}

function MilestoneCard({ m, isNext }: { m: IndependenceMilestone; isNext: boolean }) {
  const achieved = m.progress >= 1;
  return (
    <div
      className={`relative rounded-2xl border p-4 transition-all ${
        achieved
          ? "border-tt-pine/30 bg-gradient-to-b from-tt-pine-tint/40 to-tt-paper shadow-sm"
          : isNext
            ? "border-tt-tang/40 bg-tt-cream/60"
            : "border-tt-line bg-tt-paper opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-2xl ${
            achieved ? "bg-tt-pine-tint" : "bg-tt-sand"
          }`}
          aria-hidden="true"
        >
          {achieved ? m.emoji : "🔒"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-tt-ink">{m.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-tt-ink-soft">{m.description}</p>
          {!achieved && m.progressLabel && (
            <div className="mt-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-tt-sand">
                <div
                  className="h-full rounded-full bg-tt-tang transition-all"
                  style={{ width: `${Math.round(m.progress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-bold text-tt-ink-faint">{m.progressLabel}</p>
            </div>
          )}
          {achieved && (
            <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-tt-pine">
              Unlocked 🎉
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function IndependenceMilestones({ events, childName, nowMs }: IndependenceMilestonesProps) {
  const milestones: IndependenceMilestone[] = useMemo(
    () => detectIndependenceMilestones(events, nowMs ?? Date.now()),
    [events, nowMs],
  );

  const achievedCount = milestones.filter((m) => m.progress >= 1).length;
  const nextIndex = milestones.findIndex((m) => m.progress < 1);

  return (
    <section aria-label={`${childName}'s independence journey`} className="rounded-3xl border border-tt-line bg-tt-paper p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">
            Growing independence
          </p>
          <h3 className="mt-1 text-xl font-black text-tt-ink">
            {achievedCount > 0
              ? `${achievedCount} ${achievedCount === 1 ? "milestone" : "milestones"} unlocked`
              : "The journey begins"}
          </h3>
        </div>
        <span className="text-3xl" aria-hidden="true">🕯️</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
        Not a score — a story. Every milestone is something {childName} did with a little less help.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {milestones.map((m, i) => (
          <MilestoneCard key={m.id} m={m} isNext={i === nextIndex} />
        ))}
      </div>

      <p className="mt-4 rounded-2xl bg-tt-cream p-3 text-center text-xs font-bold text-tt-ink-soft">
        💛 The lantern dims as the kid shines brighter. Needing you less is the goal working.
      </p>
    </section>
  );
}
