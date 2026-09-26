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
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent dashboard</p>
      <h2 className="mt-2 text-3xl font-black">Review before rewards count</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
        Parents stay in control. Completed missions and Kid Bank requests wait here until a grown-up approves them.
      </p>
      <div className="mt-5 grid gap-3">
        {!pendingMissions.length && !pendingTransactions.length && (
          <div className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">
            Nothing needs review right now. When kids mark missions done or request Kid Bank moves, they will appear here.
          </div>
        )}
        {pendingMissions.map((mission) => (
          <article key={mission.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">
                <b>{props.childProfiles.find((child) => child.id === mission.completedBy)?.name}</b> completed {mission.title}. Note: {mission.note}. Approval adds {mission.coins} reward coins
                {mission.allowanceDollars ? ` and $${mission.allowanceDollars} allowance.` : " and no allowance dollars."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">Parent approval creates value evidence</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => props.approveMission(mission.id)} className="min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white">Approve</button>
              <button onClick={() => props.rejectMission(mission.id)} className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-black text-[#7a2c2c]">Send back</button>
            </div>
          </article>
        ))}
        {pendingTransactions.map((tx) => (
          <article key={tx.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#fff4d8] p-4 sm:flex-row sm:items-center">
            <p className="font-semibold"><b>{props.childProfiles.find((child) => child.id === tx.childId)?.name}</b> requested {tx.category} ${tx.amount}: {tx.description}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => props.approveTransaction(tx.id)} className="min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white">Approve</button>
              <button onClick={() => props.rejectTransaction(tx.id)} className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-black text-[#7a2c2c]">Decline</button>
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Fair mission assignment</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">One owner per task, balanced points</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
        Kids only see missions assigned to their profile. Harder work is worth more, and auto-balance prefers age-fit tasks before evening out points.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={props.autoBalanceMissions} className="min-h-11 rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white">
          Auto balance tasks
        </button>
        <span className="inline-flex min-h-11 items-center rounded-lg bg-[#eef2ff] px-4 py-2 text-sm font-black text-[#1d4ed8]">
          Harder tasks automatically carry more points
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Fairness engine</p>
          <p className="mt-2 text-lg font-black">Fairness, not first-click competition</p>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">Every task has one owner, age guidance, and point balancing across kids.</p>
        </div>
        <div className="rounded-lg bg-[#f0edff] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5b21b6]">Values tracked</p>
          <p className="mt-2 text-lg font-black">{familySkillSummary.topLabel}</p>
          <p className="mt-1 text-sm font-bold text-[#5f4b8b]">Badges become parent-visible proof of growth, not just stickers.</p>
        </div>
        <div className="rounded-lg bg-[#fff4d8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Current spread</p>
          <p className="mt-2 text-lg font-black">{spread} planned points</p>
          <p className="mt-1 text-sm font-bold text-[#6f5c31]">Keep kids near the same total while harder work still earns more.</p>
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
          ? "Looks balanced. Kids should finish with similar points if they complete their assignments."
          : `${highest?.child.name ?? "One kid"} has ${spread} more planned points than ${lowest?.child.name ?? "another kid"}. Move one mission to rebalance.`}
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
