/**
 * BraveTryStreak — streaks that reward COURAGE, not compliance.
 *
 * A "brave try" is attempting a hard or super-hard mission — whether or not
 * it gets completed. Trying something scary and not finishing it still
 * counts. That's the whole point: bravery is the trying.
 *
 * Breaking a streak is IMPOSSIBLE. Pausing just pauses — the count waits
 * patiently. No streak anxiety, ever. (Looking at you, Duolingo.)
 */
"use client";

import { useMemo } from "react";
import type { Mission } from "../../lib/types";

export type BraveTry = {
  missionId: string;
  title: string;
  difficulty: string;
  /** completed, attempted (has note/progress), or approved */
  outcome: "completed" | "attempted";
};

/** A mission counts as a brave try if it was hard+ and the kid engaged with it. */
export function braveTriesFromMissions(missions: Mission[], childId?: string): BraveTry[] {
  return missions
    .filter((m) => {
      if (childId && m.assignedChildId && m.assignedChildId !== childId) return false;
      if (m.difficulty !== "hard" && m.difficulty !== "super_hard") return false;
      const engaged = Boolean(m.completedBy) || m.status === "approved" || Boolean(m.note?.trim());
      return engaged;
    })
    .map((m) => ({
      missionId: m.id,
      title: m.title,
      difficulty: m.difficulty,
      outcome: m.status === "approved" || Boolean(m.completedBy) ? "completed" : "attempted",
    }));
}

const ENCOURAGEMENT = [
  "You're getting braver!",
  "Courage looks good on you!",
  "Hard things are your thing now!",
  "Bravery is a muscle — yours is growing!",
  "Wow. Just… wow. Keep going!",
];

export function BraveTryStreak({
  tries,
  childName,
  compact = false,
}: {
  tries: BraveTry[];
  childName: string;
  compact?: boolean;
}) {
  const count = tries.length;
  const encouragement = useMemo(() => {
    if (count === 0) return null;
    return ENCOURAGEMENT[Math.min(ENCOURAGEMENT.length - 1, Math.floor(count / 3))];
  }, [count]);

  if (count === 0) {
    return (
      <div className={`rounded-3xl border-2 border-dashed border-[#f4b400]/60 bg-[#fffdf4] ${compact ? "p-4" : "p-5"} text-center`}>
        <p className="text-4xl" aria-hidden="true">🦁</p>
        <p className="mt-2 text-lg font-black text-[#17231f]">Be brave, {childName}!</p>
        <p className="mx-auto mt-1 max-w-xs text-sm font-semibold text-[#4f625b]">
          Try a <span className="font-black text-[#b45309]">hard</span> mission — even if you don&apos;t finish it, it counts as a <span className="font-black">Brave Try</span>! 💪
        </p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-[#f4b400]/50 bg-gradient-to-br from-[#fff4d8] to-[#ffe9b8] ${compact ? "p-4" : "p-5"} shadow-sm`}>
      <div className="pointer-events-none absolute -right-6 -top-6 text-8xl opacity-20" aria-hidden="true">🔥</div>
      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#f47b20] to-[#dc2626] text-4xl shadow-lg animate-[reward-pop_2.6s_ease-in-out_infinite]" aria-hidden="true">
            🔥
          </div>
          <span className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full bg-[#17231f] text-sm font-black text-white ring-2 ring-white">
            {count}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b45309]">Brave Try streak</p>
          <p className="mt-0.5 text-xl font-black text-[#17231f]">
            {count} Brave {count === 1 ? "Try" : "Tries"}! 🎉
          </p>
          {encouragement && <p className="mt-0.5 text-sm font-bold text-[#7a4b12]">{encouragement}</p>}
          <p className="mt-1 text-xs font-semibold text-[#8a6a3a]">
            Streaks never break here — pausing just pauses. 🐢💛
          </p>
        </div>
      </div>
      {tries.length > 0 && !compact && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {tries.slice(-6).map((t) => (
            <span
              key={t.missionId}
              className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-black text-[#7a4b12] ring-1 ring-[#f4b400]/40"
              title={t.outcome === "completed" ? "Completed a hard mission!" : "Tried a hard mission — that counts!"}
            >
              {t.outcome === "completed" ? "✅" : "💪"} {t.title.length > 22 ? `${t.title.slice(0, 22)}…` : t.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
