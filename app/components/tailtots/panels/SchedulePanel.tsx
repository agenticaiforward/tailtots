"use client";

import type { Child, Mission, Role } from "@/lib/types";
import type { KidScheduleItem } from "@/lib/domain/family-types";
import { VisualSectionHeader, Explainer } from "./VisualSectionHeader";
export function SchedulePanel({
  activeChild,
  childProfiles,
  missions,
  scheduleItems,
  role,
  setActiveChildId,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  missions: Mission[];
  scheduleItems: KidScheduleItem[];
  role: Role;
  setActiveChildId: (childId: string) => void;
}) {
  const isParent = role === "parent";
  const visibleItems = scheduleItems.filter((item) => (isParent ? true : item.childId === activeChild?.id));
  const visibleMissions = missions.filter((mission) => (isParent ? true : !mission.assignedChildId || mission.assignedChildId === activeChild?.id)).slice(0, 4);
  const familyAvailabilityLink = `tailtots.com/availability/${childProfiles.map((child) => child.name.toLowerCase()).join("-") || "family"}`;
  const playdateWindows = [
    ["Weekday calm visit", "Tuesday or Thursday, 4:30-6:00 PM", "Parent confirms address, pet temperament, and adult presence."],
    ["Weekend pet hello", "Saturday, 10:00 AM-12:00 PM", "Good for supervised pet introductions or shared care learning."],
    ["Shelter kindness block", "Sunday afternoon", "Parent-reviewed volunteer or donation activity with badge credit."],
  ];
  const calendarDays = ["Today", "Wednesday", "Thursday", "Saturday", "Sunday"];
  const dayIcons: Record<string, string> = {
    Today: "📅",
    Wednesday: "🐪",
    Thursday: "🌟",
    Saturday: "🎉",
    Sunday: "☀️",
  };

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <VisualSectionHeader
            icon="📅"
            title={isParent ? "Family calendar" : "My week"}
            subtitle={isParent ? "Everyone's rhythm in one place" : "What's next, at a glance"}
          />
          {isParent && (
            <div className="flex flex-wrap gap-1.5">
              {childProfiles.map((child) => (
                <button key={child.id} onClick={() => setActiveChildId(child.id)} className="tt-btn-press min-h-10 rounded-2xl bg-tt-cream/60 px-3 py-2 text-xs font-black text-tt-ink ring-1 ring-tt-line">
                  {child.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <div className="mt-1 grid gap-2.5 lg:grid-cols-5">
          {calendarDays.map((day) => {
            const dayItems = visibleItems.filter((item) => item.day === day);
            return (
              <article key={day} className="min-h-36 rounded-2xl bg-gradient-to-b from-tt-cream/60 to-white p-3 ring-1 ring-tt-line">
                <p className="flex items-center gap-1.5 text-sm font-black text-tt-ink">
                  <span>{dayIcons[day] ?? "📆"}</span> {day}
                </p>
                <div className="mt-2 grid gap-1.5">
                  {(dayItems.length ? dayItems : [{ id: `${day}-empty`, time: "Open", title: "Free time", note: "", childId: activeChild?.id ?? "", day, kind: "family" as const }]).map((item) => {
                    const child = childProfiles.find((profile) => profile.id === item.childId);
                    return (
                      <div key={item.id} className="rounded-xl bg-white p-2.5 shadow-sm ring-1 ring-tt-line/50">
                        <p className="text-[11px] font-black text-tt-pine">{item.time}</p>
                        <p className="mt-0.5 text-xs font-black leading-4 text-tt-ink">{item.title}</p>
                        {isParent && child && <p className="text-[11px] font-bold text-tt-ink/50">{child.name}</p>}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isParent && (
        <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <VisualSectionHeader icon="🤝" title="Playdates" />
          <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-2xl bg-blue-50 p-3 ring-1 ring-blue-200">
              <p className="break-all rounded-xl bg-white p-2.5 text-xs font-black text-tt-ink shadow-sm">🔗 {familyAvailabilityLink}</p>
              <button className="tt-btn-press mt-2.5 min-h-11 w-full rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow">Generate link</button>
            </div>
            <div className="grid gap-2">
              {playdateWindows.map(([title, time, note], i) => (
                <article key={title} className="rounded-2xl bg-emerald-50 p-2.5 ring-1 ring-emerald-200">
                  <p className="text-xs font-black text-tt-ink">{["🌿", "🐾", "💛"][i]} {title}</p>
                  <p className="text-[11px] font-bold text-emerald-700">{time}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <VisualSectionHeader icon="🗓️" title="Schedule" subtitle={`${visibleItems.length} items`} />
          <div className="mt-3 grid gap-2">
            {visibleItems.map((item) => {
              const child = childProfiles.find((profile) => profile.id === item.childId);
              return (
                <article key={item.id} className="flex gap-3 rounded-2xl bg-tt-cream/40 p-3 ring-1 ring-tt-line">
                  <div className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-center shadow-sm">
                    <span className="block text-[11px] font-black text-tt-pine">{item.day.slice(0, 3)}</span>
                    <span className="block text-[11px] font-bold text-tt-ink/60">{item.time}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-tt-ink">{item.title}</p>
                    {isParent && child && <p className="text-[11px] font-bold text-tt-pine">{child.name}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <VisualSectionHeader icon="🎯" title="Today's missions" subtitle={`${visibleMissions.length} to try`} />
          <div className="mt-3 grid gap-2">
            {visibleMissions.map((mission) => (
              <article key={mission.id} className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 p-3 ring-1 ring-amber-200">
                <p className="text-sm font-black text-tt-ink">⭐ {mission.title}</p>
                <p className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-amber-800 shadow-sm">+{mission.points} pts</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
