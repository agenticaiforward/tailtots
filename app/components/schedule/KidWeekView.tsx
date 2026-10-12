"use client";

import { useState } from "react";
import type { DayItem } from "./MyDayStrip";

/**
 * Kid "My Week" — a beautiful 7-day strip.
 *
 * Each day is a card: weekday, date, mission icons. Today is highlighted.
 * Tap a day to see its missions. Designed for ADHD/autistic kids:
 * predictable Mon–Sun order, today always obvious, max 3 missions shown
 * per day, visual icons over text.
 */

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeekDay {
  date: Date;
  isToday: boolean;
  missions: DayItem[];
}

function buildWeek(items: DayItem[]): WeekDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start week on Monday for predictability
  const monday = new Date(today);
  const day = today.getDay();
  monday.setDate(today.getDate() - ((day + 6) % 7));

  const pending = items.filter((i) => i.status !== "done");
  const done = items.filter((i) => i.status === "done");

  const week: WeekDay[] = [];
  for (let d = 0; d < 7; d++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + d);
    const isToday = date.getTime() === today.getTime();
    week.push({ date, isToday, missions: [] });
  }

  // Distribute pending missions across today + upcoming days (round-robin).
  // Today gets first pick so the week view matches the Today strip.
  const upcoming = week.filter((w) => w.date >= today);
  pending.forEach((m, i) => {
    const slot = upcoming[i % upcoming.length];
    if (slot) slot.missions.push(m);
  });
  // Done missions live on today (celebration).
  const todaySlot = week.find((w) => w.isToday);
  if (todaySlot) todaySlot.missions.push(...done);

  return week;
}

export function KidWeekView({
  items,
  childName,
  onStartItem,
  onCompleteItem,
}: {
  items: DayItem[];
  childName: string;
  onStartItem: (id: string) => void;
  onCompleteItem: (id: string) => void;
}) {
  const week = buildWeek(items);
  const todayIdx = week.findIndex((w) => w.isToday);
  const [openDay, setOpenDay] = useState<number>(todayIdx >= 0 ? todayIdx : 0);

  const open = week[openDay];

  return (
    <section className="space-y-3" aria-label={`${childName}'s week`}>
      {/* 7-day strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Days of the week">
        {week.map((d, i) => {
          const doneCount = d.missions.filter((m) => m.status === "done").length;
          const total = d.missions.length;
          const isOpen = i === openDay;
          return (
            <button
              key={d.date.toISOString()}
              role="tab"
              aria-selected={isOpen}
              onClick={() => setOpenDay(i)}
              className={`flex w-[68px] shrink-0 flex-col items-center rounded-2xl border-2 p-2 transition-all ${
                d.isToday
                  ? "border-tt-pine bg-tt-pine/10 shadow-md"
                  : isOpen
                    ? "border-tt-blue bg-tt-blue/5"
                    : "border-tt-line bg-white"
              }`}
            >
              <span className={`text-[11px] font-black uppercase ${d.isToday ? "text-tt-pine" : "text-tt-ink-soft"}`}>
                {d.isToday ? "Today" : WEEKDAY_NAMES[d.date.getDay()]}
              </span>
              <span className={`mt-0.5 text-xl font-black ${d.isToday ? "text-tt-pine" : "text-tt-ink"}`}>
                {d.date.getDate()}
              </span>
              {/* Mission dots */}
              <span className="mt-1.5 flex h-4 items-center gap-1" aria-hidden="true">
                {total === 0 ? (
                  <span className="text-xs">🌤️</span>
                ) : (
                  d.missions.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className={`size-2.5 rounded-full ${m.status === "done" ? "bg-tt-pine" : "bg-tt-tang"}`}
                    />
                  ))
                )}
                {total > 3 && <span className="text-[10px] font-black text-tt-ink-soft">+{total - 3}</span>}
              </span>
              {total > 0 && (
                <span className="mt-0.5 text-[10px] font-bold text-tt-ink-soft">
                  {doneCount === total ? "✅" : `${doneCount}/${total}`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Open day's missions */}
      {open && (
        <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <p className="text-sm font-black text-tt-ink">
            {open.isToday ? "Today" : WEEKDAY_NAMES[open.date.getDay()]} · {open.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          {open.missions.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-tt-ink-soft">Free day — time to explore! 🌿</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {open.missions.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-2xl bg-tt-cream/60 p-2.5"
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${m.iconBg}`}>
                    <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d={m.iconSvg} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className={`flex-1 text-sm font-bold ${m.status === "done" ? "text-tt-ink-soft line-through" : "text-tt-ink"}`}>
                    {m.title}
                  </span>
                  {m.status === "done" ? (
                    <span className="text-lg" aria-label="done">✅</span>
                  ) : (
                    <button
                      onClick={() => onStartItem(m.id)}
                      className="rounded-full bg-tt-pine px-3 py-1.5 text-xs font-black text-white"
                    >
                      Go →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
