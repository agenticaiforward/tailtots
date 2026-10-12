"use client";

import { useState } from "react";
import { MyDayStrip, type DayItem } from "./MyDayStrip";
import { KidWeekView } from "./KidWeekView";
import { ParentTodayTimeline, type TimelineBlock, type TimelineChild } from "./ParentTodayTimeline";
import type { Mission } from "../../../lib/types";

/**
 * Adapters: convert existing Mission data to the new visual schedule components.
 * Kid view: MyDayStrip (NOW→NEXT→THEN picture strip)
 * Parent view: ParentTodayTimeline (vertical timeline with digest)
 */

const CATEGORY_ICONS: Record<string, string> = {
  pet_care: "M12 13c-2.8 0-5 2-5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.2-4.2-5-4.2ZM6.5 8.5a1.8 1.8 0 1 0 0-.01M17.5 8.5a1.8 1.8 0 1 0 0-.01",
  chore: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  kindness: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  money: "M3 9l9-6 9 6M4 9v10M20 9v10M8 13v4M12 13v4M16 13v4M2 21h20",
  community: "M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 0a4 4 0 1 0-.6-7.96A5.99 5.99 0 0 1 8 11Zm8 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4Z",
};

const CATEGORY_BG: Record<string, string> = {
  pet_care: "bg-tt-tang",
  chore: "bg-tt-pine",
  kindness: "bg-tt-grape",
  money: "bg-tt-gold",
  community: "bg-tt-blue",
};

const KID_COLORS = [
  { color: "bg-tt-pine", textColor: "text-tt-pine" },
  { color: "bg-tt-grape", textColor: "text-tt-grape" },
  { color: "bg-tt-tang", textColor: "text-tt-tang" },
  { color: "bg-tt-blue", textColor: "text-tt-blue" },
];

function missionToDayItem(m: Mission, index: number, totalPending: number): DayItem {
  const isDone = m.status === "approved" || !!m.completedBy;
  let status: DayItem["status"] = "later";
  if (isDone) status = "done";
  else if (index === 0) status = "now";
  else if (index === 1) status = "next";

  return {
    id: m.id,
    title: m.title,
    iconSvg: CATEGORY_ICONS[m.category] ?? CATEGORY_ICONS.chore,
    iconBg: CATEGORY_BG[m.category] ?? "bg-tt-pine",
    status,
  };
}

export function KidMyDay({
  missions,
  childName,
  childAge,
  onStartMission,
  onCompleteMission,
}: {
  missions: Mission[];
  childName: string;
  childAge: number;
  onStartMission: (id: string) => void;
  onCompleteMission: (id: string) => void;
}) {
  const [view, setView] = useState<"today" | "week">("today");
  // Sort: pending first (by creation), then done
  const pending = missions.filter((m) => m.status !== "approved" && !m.completedBy);
  const done = missions.filter((m) => m.status === "approved" || m.completedBy);
  const ordered = [...pending, ...done];
  const items = ordered.slice(0, 8).map((m, i) => missionToDayItem(m, pending.indexOf(m), pending.length));

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-tt-line bg-tt-cream/50 p-8 text-center">
        <p className="text-4xl" aria-hidden="true">🌤️</p>
        <p className="mt-2 text-lg font-black text-tt-ink">Open day!</p>
        <p className="mt-1 text-sm font-semibold text-tt-ink-soft">No missions yet. Time to explore! 🌿</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today / Week toggle */}
      <div className="flex justify-center" role="tablist" aria-label="Schedule view">
        <div className="inline-flex rounded-full border border-tt-line bg-white p-1 shadow-sm">
          {(["today", "week"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-5 py-2 text-sm font-black transition-all ${
                view === v ? "bg-tt-ink text-white shadow" : "text-tt-ink-soft"
              }`}
            >
              {v === "today" ? "☀️ Today" : "🗓️ Week"}
            </button>
          ))}
        </div>
      </div>
      {view === "today" ? (
        <MyDayStrip
          items={items}
          childName={childName}
          childAge={childAge}
          onStartItem={onStartMission}
          onCompleteItem={onCompleteMission}
        />
      ) : (
        <KidWeekView
          items={items}
          childName={childName}
          onStartItem={onStartMission}
          onCompleteItem={onCompleteMission}
        />
      )}
    </div>
  );
}

export function ParentToday({
  missions,
  children,
  onOpenPlaydates,
}: {
  missions: Mission[];
  children: { id: string; name: string }[];
  onOpenPlaydates: () => void;
}) {
  const timelineChildren: TimelineChild[] = children.map((c, i) => ({
    id: c.id,
    name: c.name,
    color: KID_COLORS[i % KID_COLORS.length].color,
    textColor: KID_COLORS[i % KID_COLORS.length].textColor,
  }));

  // Distribute missions across day periods (simple heuristic: thirds)
  const blocks: TimelineBlock[] = missions.slice(0, 12).map((m, i) => {
    const period = i < 4 ? "morning" : i < 8 ? "afternoon" : "evening";
    const isDone = m.status === "approved" || !!m.completedBy;
    return {
      id: m.id,
      childId: m.assignedChildId ?? null,
      title: m.title,
      period,
      status: isDone ? "done" : "upcoming",
      detail: m.category === "pet_care" ? "Pet care" : undefined,
    };
  });

  return (
    <ParentTodayTimeline
      children={timelineChildren}
      blocks={blocks}
      onOpenPlaydates={onOpenPlaydates}
    />
  );
}
