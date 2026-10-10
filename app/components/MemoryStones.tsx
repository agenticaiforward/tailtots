/**
 * MemoryStones — every completed mission becomes a keepsake.
 *
 * Each stone is a unique visual generated deterministically from the
 * mission: gradient from the mission id hash, category emoji, trait ring
 * for curriculum-tagged missions. No two stones look alike — just like
 * no two memories are alike.
 *
 * No leaderboards. No comparison. Just YOUR growing collection.
 */
"use client";

import { useMemo, useState } from "react";
import type { Mission } from "../../lib/types";

const CATEGORY_EMOJI: Record<Mission["category"], string> = {
  pet_care: "🐾",
  chore: "🧹",
  kindness: "💛",
  money: "🪙",
  community: "🏘️",
};

const CATEGORY_LABEL: Record<Mission["category"], string> = {
  pet_care: "Pet care",
  chore: "Chores",
  kindness: "Kindness",
  money: "Money",
  community: "Community",
};

const TRAIT_COLORS: Record<string, string> = {
  responsibility: "#165a4b",
  empathy: "#e11d48",
  kindness: "#f4b400",
  leadership: "#6d3ed1",
};

/** Deterministic pseudo-random from a string id. */
function hashStr(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const STONE_GRADIENTS = [
  "from-[#ffd166] to-[#f4b400]",
  "from-[#a7f3d0] to-[#34d399]",
  "from-[#bfdbfe] to-[#60a5fa]",
  "from-[#fbcfe8] to-[#f472b6]",
  "from-[#ddd6fe] to-[#a78bfa]",
  "from-[#fed7aa] to-[#fb923c]",
  "from-[#bae6fd] to-[#38bdf8]",
  "from-[#bbf7d0] to-[#4ade80]",
];

export type MemoryStone = {
  missionId: string;
  title: string;
  category: Mission["category"];
  emoji: string;
  gradient: string;
  traitColor?: string;
  traitLabel?: string;
  rotation: number;
};

export function stonesFromMissions(missions: Mission[], childId?: string): MemoryStone[] {
  return missions
    .filter((m) => {
      if (childId && m.assignedChildId && m.assignedChildId !== childId) return false;
      return Boolean(m.completedBy) || m.status === "approved";
    })
    .map((m) => {
      const h = hashStr(m.id);
      const trait = m.curriculum?.trait;
      return {
        missionId: m.id,
        title: m.title,
        category: m.category,
        emoji: CATEGORY_EMOJI[m.category] ?? "⭐",
        gradient: STONE_GRADIENTS[h % STONE_GRADIENTS.length],
        traitColor: trait ? TRAIT_COLORS[trait] : undefined,
        traitLabel: trait,
        rotation: (h % 24) - 12,
      };
    });
}

function Stone({ stone, size = "md" }: { stone: MemoryStone; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "size-14 text-2xl" : "size-20 text-3xl";
  return (
    <div
      className="group relative flex flex-col items-center"
      title={`${stone.title}${stone.traitLabel ? ` · ${stone.traitLabel}` : ""}`}
    >
      <div
        className={`${dim} grid place-items-center rounded-[42%_58%_55%_45%/48%_42%_58%_52%] bg-gradient-to-br ${stone.gradient} shadow-md ring-2 transition-transform group-hover:scale-110 ${
          stone.traitColor ? "" : "ring-white/60"
        }`}
        style={{
          transform: `rotate(${stone.rotation}deg)`,
          ...(stone.traitColor ? { ["--tw-ring-color" as string]: stone.traitColor } : {}),
        }}
      >
        <span style={{ transform: `rotate(${-stone.rotation}deg)` }} aria-hidden="true">
          {stone.emoji}
        </span>
      </div>
      {stone.traitColor && (
        <span className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-black capitalize text-white" style={{ backgroundColor: stone.traitColor }}>
          {stone.traitLabel}
        </span>
      )}
    </div>
  );
}

export function MemoryStones({ missions, childId, childName }: { missions: Mission[]; childId?: string; childName: string }) {
  const [filter, setFilter] = useState<Mission["category"] | "all">("all");
  const stones = useMemo(() => stonesFromMissions(missions, childId), [missions, childId]);
  const shown = filter === "all" ? stones : stones.filter((s) => s.category === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: stones.length };
    for (const s of stones) c[s.category] = (c[s.category] ?? 0) + 1;
    return c;
  }, [stones]);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#ded8c7] bg-white p-5 shadow-sm sm:p-6" aria-label="Memory stones collection">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6d3ed1]">🪨 Memory stones</p>
          <h3 className="mt-1 text-xl font-black text-[#17231f]">
            {childName}&apos;s collection
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#4f625b]">
            Every mission you finish becomes a keepsake stone. Yours alone — no comparing, just collecting. 💛
          </p>
        </div>
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#6d3ed1]/10 text-3xl font-black text-[#6d3ed1]">
          {stones.length}
        </div>
      </div>

      {stones.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[#ded8c7] bg-[#faf8f0] p-6 text-center">
          <p className="text-4xl" aria-hidden="true">🪨</p>
          <p className="mt-2 text-base font-black text-[#17231f]">Your first stone is waiting!</p>
          <p className="mt-1 text-sm font-semibold text-[#4f625b]">Finish a mission and it&apos;ll appear right here, shiny and new. ✨</p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["all", "pet_care", "chore", "kindness", "money", "community"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 transition-all ${
                  filter === cat ? "bg-[#17231f] text-white ring-[#17231f]" : "bg-white text-[#4f625b] ring-[#ded8c7] hover:ring-[#17231f]/40"
                }`}
              >
                {cat === "all" ? "All" : `${CATEGORY_EMOJI[cat]} ${CATEGORY_LABEL[cat]}`} · {counts[cat] ?? 0}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
            {shown.map((stone) => (
              <Stone key={stone.missionId} stone={stone} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
