"use client";

import { useState } from "react";

/**
 * Parent "Today" — vertical timeline, color-per-kid, glanceable digest.
 * (Cozi's most-loved pattern, adapted for TailTots calm.)
 */

export interface TimelineChild {
  id: string;
  name: string;
  color: string; // tailwind bg class for the kid's dot
  textColor: string;
}

export interface TimelineBlock {
  id: string;
  childId: string | null; // null = family event
  title: string;
  period: "morning" | "afternoon" | "evening";
  status: "done" | "upcoming" | "event";
  detail?: string;
}

const PERIODS = [
  { key: "morning", label: "Morning", icon: "☀️" },
  { key: "afternoon", label: "Afternoon", icon: "🌤️" },
  { key: "evening", label: "Evening", icon: "🌙" },
] as const;

export function ParentTodayTimeline({
  children,
  blocks,
  onOpenPlaydates,
}: {
  children: TimelineChild[];
  blocks: TimelineBlock[];
  onOpenPlaydates: () => void;
}) {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>("morning");

  const done = blocks.filter((b) => b.status === "done").length;
  const toGo = blocks.filter((b) => b.status === "upcoming").length;
  const childColor = (id: string | null) => children.find((c) => c.id === id);

  return (
    <section className="space-y-4" aria-label="Today's plan">
      {/* Glance digest header — answers "what's the day about?" in 2 seconds */}
      <div className="rounded-3xl bg-tt-navy p-5 text-white">
        <p className="text-xs font-extrabold uppercase tracking-widest text-white/60">Today</p>
        <p className="mt-1 text-xl font-black">
          {done > 0 ? `${done} done` : "Fresh day"}
          {toGo > 0 && <span className="text-white/70"> · {toGo} to go</span>}
        </p>
        <div className="mt-3 flex gap-2">
          {children.map((c) => {
            const cDone = blocks.filter((b) => b.childId === c.id && b.status === "done").length;
            const cTotal = blocks.filter((b) => b.childId === c.id && b.status !== "event").length;
            return (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold">
                <span className={`size-2.5 rounded-full ${c.color}`} aria-hidden="true" />
                {c.name} {cDone}/{cTotal}
              </span>
            );
          })}
        </div>
      </div>

      {/* Vertical timeline */}
      <div className="space-y-3">
        {PERIODS.map((period) => {
          const periodBlocks = blocks.filter((b) => b.period === period.key);
          const isOpen = expandedPeriod === period.key;
          return (
            <div key={period.key} className="overflow-hidden rounded-3xl border border-tt-line bg-tt-paper">
              <button
                onClick={() => setExpandedPeriod(isOpen ? null : period.key)}
                className="flex w-full items-center gap-3 p-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-xl" aria-hidden="true">{period.icon}</span>
                <span className="flex-1 text-base font-extrabold text-tt-ink">{period.label}</span>
                <span className="rounded-full bg-tt-cream px-2.5 py-1 text-xs font-extrabold text-tt-ink-soft">
                  {periodBlocks.filter((b) => b.status === "done").length}/{periodBlocks.length}
                </span>
                <svg viewBox="0 0 20 20" className={`size-4 text-tt-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                </svg>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-tt-line p-4 pt-3">
                  {periodBlocks.length === 0 && (
                    <p className="py-2 text-center text-sm font-semibold text-tt-ink-faint">Nothing scheduled — open day.</p>
                  )}
                  {periodBlocks.map((b) => {
                    const kid = childColor(b.childId);
                    return (
                      <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-tt-cream p-3">
                        <span className={`size-3 shrink-0 rounded-full ${kid ? kid.color : "bg-tt-ink-faint"}`} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm font-extrabold ${b.status === "done" ? "text-tt-ink-faint line-through" : "text-tt-ink"}`}>
                            {b.title}
                          </p>
                          {b.detail && <p className="truncate text-xs font-semibold text-tt-ink-soft">{b.detail}</p>}
                        </div>
                        {b.status === "done" ? (
                          <svg viewBox="0 0 20 20" className="size-5 shrink-0 text-tt-pine" fill="currentColor" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                          </svg>
                        ) : b.status === "event" ? (
                          <span className="shrink-0 rounded-full bg-tt-sky px-2.5 py-1 text-xs font-extrabold text-tt-blue">Event</span>
                        ) : (
                          <span className="size-5 shrink-0 rounded-full border-2 border-tt-line" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Playdates = a mode, not the headline */}
      <button
        onClick={onOpenPlaydates}
        className="tt-btn-press flex w-full items-center justify-between rounded-3xl border-2 border-dashed border-tt-line bg-tt-paper p-4"
      >
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-tt-grape-soft text-lg" aria-hidden="true">🤝</span>
          <span className="text-left">
            <span className="block text-sm font-extrabold text-tt-ink">Playdate planning</span>
            <span className="block text-xs font-semibold text-tt-ink-soft">Availability, invites & bookings</span>
          </span>
        </span>
        <svg viewBox="0 0 20 20" className="size-5 text-tt-ink-faint" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
    </section>
  );
}
