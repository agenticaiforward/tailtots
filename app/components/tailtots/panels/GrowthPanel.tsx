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
import { DecisionGrowthCard } from "../../DecisionGrowthCard";
import { IndependenceMilestones } from "../../IndependenceMilestones";
import type { IndependenceEvent } from "@/lib/ai/independence";
import { playthroughsThisWeek, choiceEventsFor } from "../../ChoiceAdventureSpot";
import { curiosityCountsFor } from "../../CuriosityMissions";
import { synthesisCountsFor } from "../../SynthesisMoments";
import { questionCountFor } from "../../DecisionJournal";
import WeeklyInsight from "../../WeeklyInsight";
import type { RankedInsight } from "@/lib/ai/insight-ranking";

/** Demo weekly insight — shows parents what the AI insight card looks like. */
function demoWeeklyInsight(childName: string): RankedInsight {
  return {
    pattern: {
      insightType: "weak_weekday",
      severity: "info",
      detail: {
        weekdayName: "Thursday",
        rate: 0.2,
        baseline: 0.66,
        assigned: 14,
      },
    },
    score: 0.82,
    confidence: "high",
    sampleSize: 14,
    actionability: 0.9,
    novelty: 0.7,
    isWeeklyPick: true,
    rationale: "Highest actionability this week — a small schedule tweak, not a behavior concern.",
  };
}

function weeklyInsightFor(childId: string): string | undefined {
  try {
    const raw = localStorage.getItem("tailtots-weekly-synthesis-v1");
    if (!raw) return undefined;
    const arr = JSON.parse(raw);
    const mine = (Array.isArray(arr) ? arr : []).filter((e) => e.childId === childId);
    return mine.length > 0 ? mine[mine.length - 1].text : undefined;
  } catch {
    return undefined;
  }
}
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
    <div className="space-y-4">
    {/* Demo: what the weekly AI insight looks like for parents */}
    {props.childProfiles[0] && (
      <WeeklyInsight
        insight={demoWeeklyInsight(props.childProfiles[0].name)}
        childName={props.childProfiles[0].name}
      />
    )}
    <PetReadyJourneyPanel
      childProfiles={props.childProfiles}
      missions={props.missions}
      transactions={props.transactions}
      canSignOff={props.canSignOff}
      signOffs={props.signOffs}
      onSignOff={props.onSignOff}
    />
    <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌱</span>
        <div>
          <h2 className="text-xl font-black text-tt-ink sm:text-2xl">Growth</h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-3xl bg-gradient-to-br from-tt-cream to-white p-4 ring-1 ring-tt-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ProfilePhoto label={child.name} initial={getChildLook(child.id).initial} colors={getChildLook(child.id).colors} variant="kid" hair={getChildLook(child.id).hair} photoUrl={child.photoUrl} />
                <h3 className="text-lg font-black text-tt-ink">{child.name}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-tt-ink shadow-sm">{levelLabels[child.level]}</span>
            </div>
            <div className="mt-3 grid gap-2.5">
              <Meter label="Task progress" value={Math.min(100, Math.round((child.points / 220) * 100))} color="#f47b20" />
              <Meter label="Loving it" value={getChildLook(child.id).love} color="#7c3aed" />
              <Meter label="Happiness" value={getChildLook(child.id).joy} color="#0f766e" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                <div className="text-lg font-black text-tt-ink">{child.points}</div>
                <div className="text-[11px] font-bold text-tt-ink/60">points</div>
              </div>
              <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                <div className="text-lg font-black text-tt-ink">{child.streakDays}</div>
                <div className="text-[11px] font-bold text-tt-ink/60">day streak</div>
              </div>
              <div className="rounded-2xl bg-white p-2.5 shadow-sm">
                <div className="text-lg font-black text-tt-ink">{child.coins}</div>
                <div className="text-[11px] font-bold text-tt-ink/60">coins</div>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {(["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => {
                const count = props.badges.filter((badge) => badge.childId === child.id && badge.skill === skill).length;
                const emoji = { responsibility: "🎯", empathy: "💛", teamwork: "🤝", leadership: "🌟", time: "⏰" }[skill];
                return (
                  <div key={skill} className="rounded-2xl bg-white p-2.5 shadow-sm">
                    <div className="mb-1.5 flex justify-between text-xs font-black">
                      <span>{emoji} {skill === "time" ? "Time management" : skill}</span>
                      <span className="text-tt-ink/60">{count} badge{count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-tt-cream">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all" style={{ width: `${Math.min(100, count * 25)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2">
              {props.badges.filter((badge) => badge.childId === child.id).slice(0, 3).map((badge) => (
                <div key={badge.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="text-sm font-black text-tt-ink">🏅 {badge.title}</p>
                  <p className="mt-0.5 text-xs font-semibold text-tt-ink/60">{badge.note}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Thinking growth — decision intelligence (Choice Adventures) */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.childProfiles.map((child) => {
          const week = playthroughsThisWeek(child.id);
          const summaries = week.map((p) => ({
            scenarioId: p.scenarioId,
            scenarioTitle: p.scenarioTitle,
            exploredCount: p.exploredChoiceIds.length,
            rewindCount: p.rewindCount,
            completedAt: p.completedAt,
          }));
          const curiosity = curiosityCountsFor(child.id);
          const synth = synthesisCountsFor(child.id);
          return (
            <DecisionGrowthCard
              key={`thinking-${child.id}`}
              childName={child.name}
              summaries={summaries}
              events={choiceEventsFor(child.id)}
              curiosity={{
                questions: curiosity.questions + questionCountFor(child.id),
                listens: curiosity.listens,
              }}
              synthesis={{
                dotsConnected: synth.dotsConnected,
                taughtPet: synth.taughtPet,
                weeklyInsight: weeklyInsightFor(child.id),
              }}
            />
          );
        })}
      </div>
      {/* Independence milestones — celebrated, never scored */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.childProfiles.map((child) => {
          // Demo adapter: local missions carry no timestamps, so order them
          // by list position (oldest first) one day apart. The backend
          // mission_events table carries real timestamps.
          const childMissions = props.missions.filter((m) => m.assignedChildId === child.id);
          const events: IndependenceEvent[] = childMissions.map((m, i) => ({
            completedAt: new Date(
              Date.now() - (childMissions.length - 1 - i) * 86_400_000,
            ).toISOString(),
            status: m.status,
            difficulty: m.difficulty,
            category: m.category,
          }));
          return (
            <IndependenceMilestones
              key={`independence-${child.id}`}
              events={events}
              childName={child.name}
            />
          );
        })}
      </div>
      <div className="mt-5 rounded-lg bg-[#f0edff] p-4">
        <h3 className="font-black">Memories</h3>        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
