"use client";

import { useState } from "react";

/**
 * Kid "My Day" — NOW → NEXT → THEN picture strip.
 * No clock times for under-6s. Slide-to-done interaction.
 * (Choiceworks / occupational-therapy gold standard)
 */

export interface DayItem {
  id: string;
  title: string;
  iconSvg: string; // SVG path data
  iconBg: string; // tailwind bg class
  status: "done" | "now" | "next" | "later";
  timeLabel?: string; // only shown for 7+
}

export function MyDayStrip({
  items,
  childName,
  childAge,
  onStartItem,
  onCompleteItem,
}: {
  items: DayItem[];
  childName: string;
  childAge: number;
  onStartItem: (id: string) => void;
  onCompleteItem: (id: string) => void;
}) {
  const [slidingId, setSlidingId] = useState<string | null>(null);
  const showTimes = childAge >= 7;

  const now = items.find((i) => i.status === "now");
  const next = items.find((i) => i.status === "next");
  const rest = items.filter((i) => i.status === "later" || i.status === "done");
  const doneCount = items.filter((i) => i.status === "done").length;

  const handleSlideDone = (id: string) => {
    setSlidingId(id);
    setTimeout(() => {
      onCompleteItem(id);
      setSlidingId(null);
    }, 400);
  };

  return (
    <section className="space-y-4" aria-label={`${childName}'s day`}>
      {/* Glance header — picture-first */}
      <div className="flex items-center gap-3 rounded-3xl bg-tt-sun-soft p-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-tt-sun text-2xl" aria-hidden="true">
          ☀️
        </div>
        <div>
          <p className="text-lg font-black text-tt-ink">{now ? "Right now:" : doneCount > 0 ? "All done!" : "Today"}</p>
          {now && <p className="text-sm font-bold text-tt-ink-soft">{now.title}</p>}
          {!now && doneCount > 0 && <p className="text-sm font-bold text-tt-ink-soft">{doneCount} {doneCount === 1 ? "thing" : "things"} finished 🎉</p>}
        </div>
      </div>

      {/* NOW — big hero card */}
      {now && (
        <button
          onClick={() => onStartItem(now.id)}
          className="tt-btn-press block w-full rounded-3xl border-2 border-tt-pine bg-tt-paper p-5 text-left shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${now.iconBg}`}>
              <svg viewBox="0 0 24 24" className="size-9 text-white" fill="currentColor" aria-hidden="true">
                <path d={now.iconSvg} />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">Now</p>
              <p className="truncate text-xl font-black text-tt-ink">{now.title}</p>
              {showTimes && now.timeLabel && <p className="text-sm font-bold text-tt-ink-soft">{now.timeLabel}</p>}
            </div>
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-tt-pine text-white" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </button>
      )}

      {/* NEXT + THEN strip */}
      <div className="grid grid-cols-2 gap-3">
        {next && (
          <div className="rounded-3xl border border-tt-line bg-tt-paper p-4 opacity-90">
            <p className="text-xs font-extrabold uppercase tracking-widest text-tt-ink-faint">Next</p>
            <div className={`mx-auto mt-2 grid size-14 place-items-center rounded-2xl ${next.iconBg}`}>
              <svg viewBox="0 0 24 24" className="size-8 text-white" fill="currentColor" aria-hidden="true">
                <path d={next.iconSvg} />
              </svg>
            </div>
            <p className="mt-2 truncate text-center text-sm font-extrabold text-tt-ink">{next.title}</p>
          </div>
        )}
        <div className="rounded-3xl border border-dashed border-tt-line bg-tt-cream/50 p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-ink-faint">Then</p>
          <div className="mt-2 flex justify-center gap-1.5">
            {rest.filter((r) => r.status === "later").slice(0, 4).map((r) => (
              <div key={r.id} className={`grid size-10 place-items-center rounded-xl ${r.iconBg} opacity-70`}>
                <svg viewBox="0 0 24 24" className="size-6 text-white" fill="currentColor" aria-hidden="true">
                  <path d={r.iconSvg} />
                </svg>
              </div>
            ))}
            {rest.filter((r) => r.status === "later").length === 0 && (
              <p className="py-2 text-xs font-bold text-tt-ink-faint">Free play!</p>
            )}
          </div>
          <p className="mt-2 text-center text-xs font-bold text-tt-ink-faint">
            {rest.filter((r) => r.status === "later").length} more
          </p>
        </div>
      </div>

      {/* Slide-to-done for the NOW item */}
      {now && (
        <div
          className="relative overflow-hidden rounded-3xl bg-tt-pine-tint p-1"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const el = e.currentTarget;
            const startX = touch.clientX;
            const onMove = (ev: TouchEvent) => {
              const dx = ev.touches[0].clientX - startX;
              if (dx > 80) {
                el.removeEventListener("touchmove", onMove);
                handleSlideDone(now.id);
              }
            };
            el.addEventListener("touchmove", onMove, { once: true });
          }}
        >
          <div className={`flex items-center justify-between rounded-[1.4rem] bg-tt-pine px-5 py-4 text-white transition-transform duration-300 ${slidingId === now.id ? "translate-x-full" : ""}`}>
            <span className="text-sm font-extrabold">Slide to finish →</span>
            <span className="text-xl" aria-hidden="true">👉</span>
          </div>
          <p className="py-1 text-center text-xs font-bold text-tt-pine">Finished? Slide it done!</p>
        </div>
      )}

      {/* Done pile */}
      {doneCount > 0 && (
        <div className="rounded-3xl bg-tt-pine-tint p-4">
          <p className="text-sm font-extrabold text-tt-pine">✅ Done today ({doneCount})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.filter((i) => i.status === "done").map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full bg-tt-paper px-3 py-1.5 text-xs font-extrabold text-tt-ink shadow-sm">
                <svg viewBox="0 0 20 20" className="size-3.5 text-tt-pine" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
                </svg>
                {d.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
