"use client";

import type { Child, Pet } from "@/lib/types";
import { familyStats } from "@/lib/domain/starter-data";
import { getChildLook, getPetLook } from "../avatar-looks";
import { Meter, ProfilePhoto } from "../ui";
export function Hero({
  child,
  childProfiles,
  setActiveChildId,
  pendingCount,
  taskProgress,
  approvedMissionCount,
  pets,
  setActiveTab,
}: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  pendingCount: number;
  taskProgress: number;
  approvedMissionCount: number;
  pets: Pet[];
  setActiveTab: (tab: string) => void;
}) {
  const childLook = getChildLook(child?.id);
  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="overflow-hidden rounded-lg bg-[#165a4b] text-white shadow-sm">
        <div className="p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7e7d5]">Family pet-care system</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight md:text-3xl">
              Kids care for real pets. Parents stay confident.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#d8f5e8]">
              Pick the child, complete today&apos;s care and helper missions, then parent approval handles rewards.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setActiveTab("missions")} className="min-h-11 rounded-lg bg-[#f47b20] px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                Start today&apos;s missions
              </button>
              <button onClick={() => setActiveTab("setup")} className="min-h-11 rounded-lg border border-white/35 bg-white/10 px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                Manage family setup
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/15 bg-white/8 p-4 sm:grid-cols-3">
          {familyStats.map(([label, value, color]) => (
            <Meter key={label} label={String(label)} value={Number(value)} color={String(color)} dark />
          ))}
        </div>
      </div>
      <div className="flex flex-col rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3">
              <ProfilePhoto label={child?.name ?? "Kid"} initial={childLook.initial} colors={childLook.colors} variant="kid" hair={childLook.hair} photoUrl={child?.photoUrl} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Selected child</p>
                <h3 className="text-2xl font-black">{child?.name ?? "Add a child"}</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {childProfiles.map((item) => {
                const look = getChildLook(item.id);
                const isSelected = item.id === child?.id;
                return (
                  <div key={item.id} className={`rounded-lg border ${isSelected ? "border-[#f47b20] bg-[#fff4d8]" : "border-[#ded8c7] bg-[#f8f6ed]"}`}>
                    <button
                      onClick={() => setActiveChildId(item.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm font-black text-[#17231f]"
                    >
                      <ProfilePhoto label={item.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={item.photoUrl} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div>
              <div className="mb-2 flex justify-between text-sm font-black">
                <span>Task progress</span>
                <span>{taskProgress}%</span>
              </div>
              <div className="h-4 rounded-full bg-[#f0ead8]">
                <div className="h-4 rounded-full bg-[#f47b20]" style={{ width: `${taskProgress}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-[#ecf7f0] p-3 text-[#123d33]"><b className="block text-lg">{child?.points ?? 0}</b>points</span>
              <span className="rounded-lg bg-[#fff4d8] p-3 text-[#7a4b12]"><b className="block text-lg">{approvedMissionCount}</b>approved</span>
              <span className="rounded-lg bg-[#eef4ff] p-3 text-[#1d4f91]"><b className="block text-lg">{pendingCount}</b>pending</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Meter label="Loving the app" value={childLook.love} color="#7c3aed" />
              <Meter label="Happiness today" value={childLook.joy} color="#0f766e" />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#f8f6ed] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Active pets</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pets.map((item) => {
              const look = getPetLook(item.id);
              return (
                <div key={item.id} className="grid place-items-center gap-1 rounded-lg bg-white p-2 text-center text-[11px] font-black">
                  <ProfilePhoto label={item.name} initial={look.face} colors={look.colors} size="xs" variant="pet" petKind={look.kind} photoUrl={item.photoUrl} />
                  <span className="max-w-full truncate">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={() => setActiveTab("pets")} className="mt-auto min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          View pet passports
        </button>
      </div>
    </section>
  );
}
