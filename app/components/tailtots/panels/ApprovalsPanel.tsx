"use client";

import type { BadgeAward } from "@/lib/domain/family-types";
import type { BankTransaction, Child, Mission } from "@/lib/types";
import { getAgeFitCopy } from "@/lib/domain/missions";
import { difficultyAgeGuidance, levelLabels } from "@/lib/domain/starter-data";
import {
  getFamilySkillSummary,
  getLifeSkillLabel,
  getMissionLifeSkill,
} from "@/lib/domain";
export function ApprovalsPanel(props: {
  missions: Mission[];
  transactions: BankTransaction[];
  childProfiles: Child[];
  approveMission: (missionId: string) => void;
  approveTransaction: (transactionId: string) => void;
  rejectMission: (missionId: string) => void;
  rejectTransaction: (transactionId: string) => void;
}) {
  const pendingMissions = props.missions.filter((mission) => mission.completedBy && mission.status === "pending");
  const pendingTransactions = props.transactions.filter((tx) => tx.status === "pending");
  return (
    <section className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">✅</span>
        <div>
          <h2 className="text-xl font-black text-tt-ink sm:text-2xl">Approvals</h2>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-tt-ink/60">
        Kids did the work — your approval makes the rewards count.
      </p>
      <div className="mt-4 grid gap-3">
        {!pendingMissions.length && !pendingTransactions.length && (
          <div className="rounded-3xl bg-tt-cream/60 p-6 text-center">
            <div className="text-4xl">🎉</div>
            <p className="mt-2 text-sm font-black text-tt-ink">All caught up!</p>
            <p className="text-xs text-tt-ink/60">Done missions appear here.</p>
          </div>
        )}
        {pendingMissions.map((mission) => (
          <article key={mission.id} className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 ring-1 ring-orange-200">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm">🎯</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-tt-ink">
                  <span className="font-black">{props.childProfiles.find((child) => child.id === mission.completedBy)?.name}</span>
                  {" "}finished <span className="font-black">"{mission.title}"</span>
                </p>
                {mission.note && (
                  <p className="mt-1 rounded-2xl bg-white/70 p-2 text-xs italic text-tt-ink/70">"{mission.note}"</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-tt-ink shadow-sm">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-black text-tt-ink shadow-sm">+{mission.coins} coins{mission.allowanceDollars ? ` + $${mission.allowanceDollars}` : ""}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => props.approveMission(mission.id)} className="tt-btn-press min-h-11 rounded-2xl bg-tt-pine px-5 py-2.5 text-sm font-black text-white shadow">Approve 🎉</button>
              <button onClick={() => props.rejectMission(mission.id)} className="tt-btn-press min-h-11 rounded-2xl bg-white px-5 py-2.5 text-sm font-black text-tt-ink ring-1 ring-tt-line">Send back</button>
            </div>
          </article>
        ))}
        {pendingTransactions.map((tx) => (
          <article key={tx.id} className="rounded-3xl bg-gradient-to-br from-yellow-50 to-amber-50 p-4 ring-1 ring-yellow-200">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-sm">🪙</span>
              <p className="flex-1 text-sm font-bold text-tt-ink">
                <span className="font-black">{props.childProfiles.find((child) => child.id === tx.childId)?.name}</span>
                {" "}wants <span className="font-black">${tx.amount}</span> for {tx.category}
                {tx.description && <span className="block mt-1 text-xs font-semibold text-tt-ink/60">{tx.description}</span>}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => props.approveTransaction(tx.id)} className="tt-btn-press min-h-11 rounded-2xl bg-tt-pine px-5 py-2.5 text-sm font-black text-white shadow">Approve</button>
              <button onClick={() => props.rejectTransaction(tx.id)} className="tt-btn-press min-h-11 rounded-2xl bg-white px-5 py-2.5 text-sm font-black text-tt-ink ring-1 ring-tt-line">Decline</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MissionAssignmentPanel(props: {
  missions: Mission[];
  childProfiles: Child[];
  badges: BadgeAward[];
  assignMission: (missionId: string, childId: string) => void;
  autoBalanceMissions: () => void;
}) {
  const plannedPoints = props.childProfiles.map((child) => ({
    child,
    points: props.missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sortedPoints = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sortedPoints[0];
  const highest = sortedPoints[sortedPoints.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  const familySkillSummary = getFamilySkillSummary(props.badges, props.childProfiles);

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Task Balance</h2>
            <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={props.autoBalanceMissions} className="min-h-11 rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white">
          Auto balance tasks
        </button>
              </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Fairness</p>
          <p className="mt-2 text-lg font-black">Fairness, not first-click competition</p>
                  </div>
        <div className="rounded-lg bg-[#f0edff] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5b21b6]">Values</p>
          <p className="mt-2 text-lg font-black">{familySkillSummary.topLabel}</p>
                  </div>
        <div className="rounded-lg bg-[#fff4d8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Balance</p>
          <p className="mt-2 text-lg font-black">{spread} planned points</p>
                  </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {plannedPoints.map(({ child, points }) => (
          <div key={child.id} className="rounded-lg bg-[#f8f6ed] p-4">
            <p className="text-lg font-black">{child.name}</p>
            <p className="mt-1 text-sm font-bold text-[#5f6a65]">Age {child.age} • {points} planned points today</p>
          </div>
        ))}
      </div>
      <p className={`mt-3 rounded-lg p-3 text-sm font-black ${spread <= 8 ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
        {spread <= 8
          ? "Balanced ✓"
          : `${highest?.child.name ?? "One kid"} is up ${spread} pts — move one mission.`}
      </p>
      <div className="mt-4 grid gap-3">
        {props.missions.map((mission) => (
          <article key={mission.id} className="grid gap-3 rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4 md:grid-cols-[1fr_190px] md:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#1d4ed8]">{difficultyAgeGuidance[mission.difficulty].label}</span>
                <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                {mission.status === "approved" && <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">Approved</span>}
              </div>
              <h3 className="mt-2 text-lg font-black">{mission.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{mission.question}</p>
              <p className="mt-2 text-xs font-black text-[#6f5c31]">{getAgeFitCopy(mission, props.childProfiles.find((child) => child.id === mission.assignedChildId))}</p>
            </div>
            <label className="text-sm font-black text-[#25352f]">
              Assigned kid
              <select
                value={mission.assignedChildId ?? props.childProfiles[0]?.id ?? ""}
                onChange={(event) => props.assignMission(mission.id, event.target.value)}
                disabled={mission.status === "approved"}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold disabled:bg-[#ede8db]"
              >
                {props.childProfiles.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
