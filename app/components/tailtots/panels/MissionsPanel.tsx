"use client";

import { useState } from "react";
import type { Child, Mission, Pet } from "@/lib/types";
import { levelLabels } from "@/lib/domain/starter-data";
import {
  getKidMissionReason,
  getLifeSkillLabel,
  getMissionLifeSkill,
} from "@/lib/domain";
import { getPetLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";

/** Category → big visual. Kids pick by picture, not by reading labels. */
const CATEGORY_VISUAL: Record<string, { emoji: string; gradient: string; ring: string }> = {
  pet_care: { emoji: "🐾", gradient: "from-amber-100 to-orange-200", ring: "ring-orange-300" },
  chore: { emoji: "🧹", gradient: "from-sky-100 to-blue-200", ring: "ring-sky-300" },
  kindness: { emoji: "💛", gradient: "from-rose-100 to-pink-200", ring: "ring-rose-300" },
  money: { emoji: "🪙", gradient: "from-yellow-100 to-amber-200", ring: "ring-yellow-300" },
  community: { emoji: "🌍", gradient: "from-emerald-100 to-green-200", ring: "ring-emerald-300" },
};

function visualFor(category: string) {
  return (
    CATEGORY_VISUAL[category] ?? {
      emoji: "⭐",
      gradient: "from-violet-100 to-purple-200",
      ring: "ring-violet-300",
    }
  );
}

export function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  allChildren: Child[];
  missionNote: string;
  setMissionNote: (value: string) => void;
  completeMission: (missionId: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🎯</span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">Today</p>
          <h2 className="text-xl font-black text-tt-ink sm:text-2xl">Pick a mission!</h2>
        </div>
      </div>

      {/* Visual mission cards — picture first, tap to pick */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {props.missions.map((mission) => {
          const pet = props.pets.find((item) => item.id === mission.petId);
          const visual = visualFor(mission.category);
          const isDone = mission.status === "approved" || !!mission.completedBy;
          const isExpanded = expandedId === mission.id;
          const skill = getMissionLifeSkill(mission);
          const assignedChild = props.allChildren.find(
            (child) => child.id === mission.assignedChildId
          );

          return (
            <article
              key={mission.id}
              className={`tt-btn-press overflow-hidden rounded-3xl bg-gradient-to-br ${visual.gradient} ring-2 ${visual.ring} transition-transform ${
                isDone ? "opacity-70" : "hover:scale-[1.02]"
              }`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Big picture */}
                  <div className="relative shrink-0">
                    {pet?.photoUrl ? (
                      <img
                        src={pet.photoUrl}
                        alt=""
                        className="size-16 rounded-2xl object-cover shadow-lg ring-2 ring-white"
                      />
                    ) : (
                      <div className="grid size-16 place-items-center rounded-2xl bg-white/80 text-4xl shadow-lg">
                        {visual.emoji}
                      </div>
                    )}
                    {pet && (
                      <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-white text-sm shadow">
                        {visual.emoji}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black leading-tight text-tt-ink">
                      {mission.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-tt-ink">
                        {levelLabels[mission.difficulty]}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-tt-ink">
                        +{mission.points} pts
                      </span>
                      {pet && (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-black text-tt-ink">
                          {pet.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* One-line action */}
                <p className="mt-2 text-sm font-semibold leading-5 text-tt-ink/80">
                  {mission.question}
                </p>

                {/* Big action button */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => props.completeMission(mission.id)}
                    disabled={!props.activeChild || mission.status === "approved"}
                    className={`tt-btn-press flex-1 rounded-2xl py-3 text-base font-black shadow-lg ${
                      mission.status === "approved"
                        ? "bg-emerald-500 text-white"
                        : mission.completedBy
                          ? "bg-amber-400 text-tt-ink"
                          : "bg-tt-ink text-white hover:scale-[1.02]"
                    } disabled:opacity-60`}
                  >
                    {mission.status === "approved"
                      ? "✓ Done!"
                      : mission.completedBy
                        ? "⏳ Parent check"
                        : "I did it! 🎉"}
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : mission.id)}
                    aria-label="Mission details"
                    className="tt-btn-press grid size-12 place-items-center rounded-2xl bg-white/80 text-lg shadow"
                  >
                    {isExpanded ? "▲" : "▼"}
                  </button>
                </div>

                {/* Collapsible details — for curious kids, not required reading */}
                {isExpanded && (
                  <div className="tt-animate-pop-in mt-3 space-y-2 rounded-2xl bg-white/70 p-3">
                    <p className="text-xs font-bold text-tt-ink/70">
                      <span className="font-black">Why you: </span>
                      {getKidMissionReason(mission, props.activeChild)}
                    </p>
                    <p className="text-xs font-bold text-tt-ink/70">
                      <span className="font-black">Grows: </span>
                      {getLifeSkillLabel(skill)}
                    </p>
                    {assignedChild && (
                      <p className="text-xs font-bold text-tt-ink/70">
                        <span className="font-black">Owner: </span>
                        {assignedChild.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {props.missions.length === 0 && (
        <div className="mt-4 rounded-3xl bg-tt-cream/60 p-6 text-center">
          <div className="text-4xl">🌈</div>
          <p className="mt-2 text-sm font-black text-tt-ink">No missions right now!</p>
          <p className="text-xs text-tt-ink/60">Check back later or ask a parent.</p>
        </div>
      )}

      {/* Kid's notebook — collapsible, not front-and-center */}
      <details className="mt-4 rounded-2xl bg-tt-cream/60 p-3">
        <summary className="cursor-pointer text-sm font-black text-tt-ink">
          📝 My notes <span className="font-semibold text-tt-ink/50">(optional)</span>
        </summary>
        <textarea
          value={props.missionNote}
          onChange={(event) => props.setMissionNote(event.target.value)}
          className="mt-2 min-h-20 w-full rounded-xl border border-tt-line bg-white px-4 py-3 text-sm font-semibold"
          placeholder="What did you notice?"
        />
      </details>
    </section>
  );
}
