"use client";

import type { BadgeAward, LifeSkillKey, ReadinessSignOff } from "@/lib/domain/family-types";
import type {
  BankTransaction,
  Child,
  MemoryMoment,
  Mission,
} from "@/lib/types";
import { levelLabels } from "@/lib/domain/starter-data";
import { getChildLook } from "../avatar-looks";
import { Meter, ProfilePhoto } from "../ui";
import { PetReadyJourneyPanel } from "./PetReadyJourneyPanel";
export function GrowthPanel(props: {
  childProfiles: Child[];
  badges: BadgeAward[];
  moments: MemoryMoment[];
  momentDraft: string;
  setMomentDraft: (value: string) => void;
  addMoment: () => void;
  missions: Mission[];
  transactions: BankTransaction[];
  canSignOff: boolean;
  signOffs: ReadinessSignOff[];
  onSignOff: (milestoneId: string, childId: string) => void;
}) {
  return (
    <div className="space-y-5">
    <PetReadyJourneyPanel
      childProfiles={props.childProfiles}
      missions={props.missions}
      transactions={props.transactions}
      canSignOff={props.canSignOff}
      signOffs={props.signOffs}
      onSignOff={props.onSignOff}
    />
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Character growth</p>
      <h2 className="mt-2 text-3xl font-black">Responsibility, empathy, kindness, leadership</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-lg bg-[#f8f6ed] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ProfilePhoto label={child.name} initial={getChildLook(child.id).initial} colors={getChildLook(child.id).colors} variant="kid" hair={getChildLook(child.id).hair} photoUrl={child.photoUrl} />
                <h3 className="text-xl font-black">{child.name}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[child.level]}</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Meter label="Task progress" value={Math.min(100, Math.round((child.points / 220) * 100))} color="#f47b20" />
              <Meter label="Loving it" value={getChildLook(child.id).love} color="#7c3aed" />
              <Meter label="Happiness" value={getChildLook(child.id).joy} color="#0f766e" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-white p-3">{child.points}<br />points</span>
              <span className="rounded-lg bg-white p-3">{child.streakDays}<br />streak</span>
              <span className="rounded-lg bg-white p-3">{child.coins}<br />coins</span>
            </div>
            <div className="mt-4 grid gap-2">
              {(["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => {
                const count = props.badges.filter((badge) => badge.childId === child.id && badge.skill === skill).length;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-xs font-black capitalize">
                      <span>{skill === "time" ? "Time management" : skill}</span>
                      <span>{count} badge{count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-[#7c3aed]" style={{ width: `${Math.min(100, count * 25)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {props.badges.filter((badge) => badge.childId === child.id).slice(0, 3).map((badge) => (
                <p key={badge.id} className="rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">
                  <b className="block text-sm text-[#17231f]">{badge.title}</b>
                  {badge.note}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-[#f0edff] p-4">
        <h3 className="font-black">Memory moments</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" value={props.momentDraft} onChange={(event) => props.setMomentDraft(event.target.value)} />
          <button onClick={props.addMoment} className="rounded-lg bg-[#7c3aed] px-5 py-3 text-sm font-black text-white">Save moment</button>
        </div>
        {props.moments.map((moment) => (
          <p key={moment.id} className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold">{moment.note}</p>
        ))}
      </div>
    </section>
    </div>
  );
}
