"use client";

import type { Child, Mission, Pet } from "@/lib/types";
import { levelLabels } from "@/lib/domain/starter-data";
import {
  getKidMissionReason,
  getLifeSkillLabel,
  getMissionLifeSkill,
} from "@/lib/domain";
import { getPetLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";
export function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  allChildren: Child[];
  missionNote: string;
  setMissionNote: (value: string) => void;
  completeMission: (missionId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Today</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Today&apos;s care and helper missions</h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#5f6a65]">
            This is the main kid screen. Pick a pet care or helper task, answer the check-in, then wait for parent review.
          </p>
        </div>
        <textarea
          value={props.missionNote}
          onChange={(event) => props.setMissionNote(event.target.value)}
          className="min-h-24 rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold sm:w-80"
          placeholder="What did you notice?"
        />
      </div>
      <div className="mt-5 grid gap-3">
        {props.missions.map((mission) => {
          const pet = props.pets.find((item) => item.id === mission.petId);
          const skill = getMissionLifeSkill(mission);
          const assignedChild = props.allChildren.find((child) => child.id === mission.assignedChildId);
          return (
            <article key={mission.id} className="grid gap-4 rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                  {pet ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ef] py-1 pl-1 pr-3 text-xs font-black">
                      <ProfilePhoto label={pet.name} initial={getPetLook(pet.id).face} colors={getPetLook(pet.id).colors} size="xs" variant="pet" petKind={getPetLook(pet.id).kind} photoUrl={pet.photoUrl} />
                      {pet.name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black capitalize">{mission.category.replace("_", " ")}</span>
                  )}
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                    {mission.allowanceDollars ? `+$${mission.allowanceDollars}` : "No dollars"}
                  </span>
                  <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#5b21b6]">
                    {getLifeSkillLabel(skill)}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-black">{mission.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{mission.question}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#165a4b]">
                    Why this is for you: {getKidMissionReason(mission, props.activeChild)}
                  </p>
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#7a4b12]">
                    Fairness note: {assignedChild ? `${assignedChild.name} owns this one task.` : "Parent can assign one owner so kids do not fight over it."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => props.completeMission(mission.id)}
                disabled={!props.activeChild || mission.status === "approved"}
                className="min-h-14 w-full rounded-lg bg-[#f47b20] px-6 py-3 text-base font-black text-white disabled:bg-[#b9b2a2] lg:w-auto"
              >
                {mission.status === "approved" ? "Approved" : mission.completedBy ? "Needs approval" : "Mark done"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
