"use client";

import type { Child, Mission, Role } from "@/lib/types";
import type { KidScheduleItem } from "@/lib/domain/family-types";
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

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">{isParent ? "Family calendar" : `${activeChild?.name ?? "Kid"} calendar`}</p>
            <h2 className="mt-2 text-3xl font-black">{isParent ? "Schedules without kid pressure" : "Your day, nice and simple"}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
              {isParent ? "Parents can review the rhythm for each child without showing private parent controls in kid mode." : "See what is next, what pet needs care, and what can wait for a grown-up."}
            </p>
          </div>
          {isParent && (
            <div className="flex flex-wrap gap-2">
              {childProfiles.map((child) => (
                <button key={child.id} onClick={() => setActiveChildId(child.id)} className="min-h-10 rounded-lg border border-[#ded8c7] px-3 py-2 text-sm font-black">
                  {child.name}, {child.age}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">{isParent ? "Combined view" : "My week"}</p>
            <h3 className="mt-2 text-2xl font-black">{isParent ? "All kids in one family calendar" : "Your own schedule"}</h3>
          </div>
          {isParent && <span className="rounded-lg bg-[#f0edff] px-4 py-2 text-sm font-black text-[#33245f]">Parent-only combined calendar</span>}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {calendarDays.map((day) => {
            const dayItems = visibleItems.filter((item) => item.day === day);
            return (
              <article key={day} className="min-h-44 rounded-lg bg-[#f8f6ed] p-3">
                <p className="text-sm font-black text-[#17231f]">{day}</p>
                <div className="mt-3 grid gap-2">
                  {(dayItems.length ? dayItems : [{ id: `${day}-empty`, time: "Open", title: "No scheduled item", note: "Free family time.", childId: activeChild?.id ?? "", day, kind: "family" as const }]).map((item) => {
                    const child = childProfiles.find((profile) => profile.id === item.childId);
                    return (
                      <div key={item.id} className="rounded-lg bg-white p-3">
                        <p className="text-xs font-black text-[#0f766e]">{item.time}</p>
                        <p className="mt-1 text-sm font-black leading-5">{item.title}</p>
                        {isParent && <p className="mt-1 text-xs font-bold text-[#5f6a65]">{child?.name ?? "Family"}</p>}
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
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Playdate availability</p>
          <h3 className="mt-2 text-2xl font-black">Share safe times with a dynamic family link</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
            Parents can share availability without exposing child profiles, home address, or direct kid messaging. The other family requests a time, and the parent approves before kids see anything.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg bg-[#eef2ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1d4ed8]">Share link preview</p>
              <p className="mt-2 break-all rounded-lg bg-white p-3 text-sm font-black text-[#17231f]">{familyAvailabilityLink}</p>
              <button className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white">Generate availability link</button>
            </div>
            <div className="grid gap-2">
              {playdateWindows.map(([title, time, note]) => (
                <article key={title} className="rounded-lg bg-[#e7f4ef] p-3">
                  <p className="text-sm font-black">{title}</p>
                  <p className="mt-1 text-xs font-bold text-[#165a4b]">{time}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#4f625b]">{note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Schedule</p>
          <div className="mt-4 grid gap-3">
            {visibleItems.map((item) => {
              const child = childProfiles.find((profile) => profile.id === item.childId);
              return (
                <article key={item.id} className="grid gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:grid-cols-[110px_1fr]">
                  <div className="rounded-lg bg-white p-3 text-sm font-black text-[#165a4b]">
                    <span className="block">{item.day}</span>
                    <span className="block text-[#5f6a65]">{item.time}</span>
                  </div>
                  <div>
                    <p className="text-lg font-black">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{item.note}</p>
                    {isParent && <p className="mt-2 text-xs font-black text-[#0f766e]">{child?.name ?? "Kid"}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Today missions</p>
          <div className="mt-4 grid gap-3">
            {visibleMissions.map((mission) => (
              <article key={mission.id} className="rounded-lg bg-[#fff4d8] p-4">
                <p className="text-lg font-black">{mission.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{mission.question}</p>
                <p className="mt-2 text-xs font-black text-[#7a4b12]">+{mission.points} points after parent approval</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
