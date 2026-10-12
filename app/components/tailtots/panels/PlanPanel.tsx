/**
 * PlanPanel — parent's week/month event planner.
 *
 * - Week / Month toggle
 * - Type OR talk (voice) to ask: "what's free next weekend?"
 * - Events from the kids-events digest (DFW zip-code area + online)
 * - Free first, then worthy paid — never over budget
 * - "Looking for": parent saves interests (swimming, chess, dinosaurs…);
 *   matching events pop up highlighted with a 🔔 reminder
 */
"use client";

import { useMemo, useState } from "react";
import { eventsForRange, matchesInterests, type KidsEvent } from "@/lib/data/kids-events";
import { VisualSectionHeader } from "../VisualSectionHeader";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function prettyDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const TAG_ICONS: Record<string, string> = {
  stem: "🔬",
  art: "🎨",
  animals: "🐾",
  music: "🎵",
  sports: "⚽",
  reading: "📚",
  holiday: "🎃",
  food: "🍔",
  space: "🚀",
};

export function PlanPanel() {
  const [range, setRange] = useState<"week" | "month">("week");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "free" | "online">("all");
  const [interests, setInterests] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tt-plan-interests") ?? "[]");
    } catch { return []; }
  });
  const [interestDraft, setInterestDraft] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("tt-plan-saved") ?? "[]");
    } catch { return []; }
  });

  const today = todayStr();
  const end = range === "week" ? addDays(today, 7) : addDays(today, 30);

  const events = useMemo(() => {
    let list = eventsForRange(today, end);
    // Text/voice query filter
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.tags.some((t) => t.includes(q) || q.includes(t)) ||
        e.venue.toLowerCase().includes(q)
      );
    }
    if (scope === "free") list = list.filter((e) => e.isFree);
    if (scope === "online") list = list.filter((e) => e.scope === "online");
    return list;
  }, [today, end, query, scope]);

  const matchedInterests = useMemo(() => {
    if (!interests.length) return new Set<string>();
    return new Set(events.filter((e) => matchesInterests(e, interests)).map((e) => e.id));
  }, [events, interests]);

  function addInterest() {
    const v = interestDraft.trim().toLowerCase();
    if (!v || interests.includes(v)) return;
    const next = [...interests, v];
    setInterests(next);
    setInterestDraft("");
    try { localStorage.setItem("tt-plan-interests", JSON.stringify(next)); } catch {}
  }

  function removeInterest(i: string) {
    const next = interests.filter((x) => x !== i);
    setInterests(next);
    try { localStorage.setItem("tt-plan-interests", JSON.stringify(next)); } catch {}
  }

  function toggleSaved(id: string) {
    const next = savedIds.includes(id) ? savedIds.filter((x) => x !== id) : [...savedIds, id];
    setSavedIds(next);
    try { localStorage.setItem("tt-plan-saved", JSON.stringify(next)); } catch {}
  }

  return (
    <div className="space-y-4">
      <VisualSectionHeader
        icon="🗓️"
        title="Plan ahead"
        subtitle={range === "week" ? "Next 7 days" : "Next 30 days"}
        gradient="from-blue-50 to-indigo-50"
      />

      {/* Ask: type or talk */}
      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Ask: "free this weekend?" "dinosaurs?" "online stem?"'
            className="min-w-0 flex-1 rounded-2xl border border-tt-line bg-tt-cream/30 px-4 py-3 text-sm font-semibold focus:border-tt-pine focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="tt-btn-press shrink-0 rounded-2xl bg-tt-cream px-4 text-sm font-black text-tt-ink/60">
              ✕
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-tt-ink/50">
          💡 Tip: tap the 🎤 mic button anywhere and say "what's free next weekend?"
        </p>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="flex rounded-2xl bg-tt-cream/60 p-1">
            {(["week", "month"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`tt-btn-press rounded-xl px-4 py-2 text-xs font-black capitalize ${range === r ? "bg-white shadow text-tt-ink" : "text-tt-ink/50"}`}
              >
                {r === "week" ? "📅 Week" : "🗓️ Month"}
              </button>
            ))}
          </div>
          <div className="flex rounded-2xl bg-tt-cream/60 p-1">
            {([["all", "🌍 All"], ["free", "🆓 Free"], ["online", "💻 Online"]] as const).map(([s, label]) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`tt-btn-press rounded-xl px-3 py-2 text-xs font-black ${scope === s ? "bg-white shadow text-tt-ink" : "text-tt-ink/50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Looking for — interest reminders */}
      <div className="rounded-3xl border border-tt-line bg-gradient-to-br from-violet-50 to-purple-50 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <div>
            <h3 className="text-sm font-black text-tt-ink">Looking for</h3>
            <p className="text-xs text-tt-ink/60">Matching events pop up highlighted below</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {interests.map((i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-black text-tt-ink shadow-sm ring-1 ring-violet-200">
              {i}
              <button onClick={() => removeInterest(i)} className="text-tt-ink/40 hover:text-tt-ink">✕</button>
            </span>
          ))}
          {interests.length === 0 && (
            <span className="text-xs text-tt-ink/50">e.g. dinosaurs, swimming, chess, music…</span>
          )}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            value={interestDraft}
            onChange={(e) => setInterestDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInterest()}
            placeholder="Add something you're looking for…"
            className="min-w-0 flex-1 rounded-2xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold focus:border-violet-400 focus:outline-none"
          />
          <button onClick={addInterest} className="tt-btn-press shrink-0 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow">
            ➕
          </button>
        </div>
      </div>

      {/* Events */}
      <div className="grid gap-2.5">
        {events.length === 0 && (
          <div className="rounded-3xl bg-tt-cream/60 p-6 text-center">
            <div className="text-4xl">🔍</div>
            <p className="mt-2 text-sm font-black text-tt-ink">Nothing found</p>
            <p className="text-xs text-tt-ink/60">Try a different search or widen the range.</p>
          </div>
        )}
        {events.map((e) => {
          const isMatch = matchedInterests.has(e.id);
          const isSaved = savedIds.includes(e.id);
          return (
            <article
              key={e.id}
              className={`tt-animate-pop-in overflow-hidden rounded-3xl bg-white p-3.5 shadow-sm ring-2 transition-transform hover:scale-[1.01] ${
                isMatch ? "ring-violet-400" : "ring-tt-line"
              }`}
            >
              {isMatch && (
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-800">
                  🔔 Matches what you're looking for!
                </div>
              )}
              <div className="flex items-start gap-3">
                {/* Date block */}
                <div className="shrink-0 rounded-2xl bg-gradient-to-br from-tt-pine to-emerald-700 px-3 py-2 text-center text-white shadow">
                  <div className="text-[10px] font-bold uppercase opacity-80">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div className="text-lg font-black leading-none">
                    {new Date(e.date + "T12:00:00").getDate()}
                  </div>
                  <div className="text-[10px] font-bold opacity-80">
                    {new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black leading-tight text-tt-ink">{e.title}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-tt-ink/60">
                    {e.time} · {e.venue}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {e.isFree ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                        🆓 Free
                      </span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${e.worthy ? "bg-amber-100 text-amber-800" : "bg-tt-cream text-tt-ink/70"}`}>
                        💰 {e.cost}{e.worthy ? " · worth it" : ""}
                      </span>
                    )}
                    {e.scope === "online" && (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-black text-blue-800">💻 Online</span>
                    )}
                    {e.tags.slice(0, 3).map((t) => (
                      <span key={t} className="text-[11px]">{TAG_ICONS[t] ?? "·"}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => toggleSaved(e.id)}
                  aria-label={isSaved ? "Unsave" : "Save"}
                  className={`tt-btn-press shrink-0 grid size-10 place-items-center rounded-2xl text-lg shadow-sm ring-1 ${
                    isSaved ? "bg-amber-100 ring-amber-300" : "bg-tt-cream/60 ring-tt-line"
                  }`}
                >
                  {isSaved ? "⭐" : "☆"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {savedIds.length > 0 && (
        <p className="text-center text-xs font-bold text-tt-ink/50">
          ⭐ {savedIds.length} saved for later
        </p>
      )}
    </div>
  );
}
