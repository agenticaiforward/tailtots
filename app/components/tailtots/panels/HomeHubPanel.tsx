"use client";

import type { Child, MemoryMoment, Mission, Pet, Role, SavingsGoal } from "@/lib/types";
import type { BadgeAward, KidScheduleItem } from "@/lib/domain/family-types";
import { getFairnessSummary, getFamilySkillSummary } from "@/lib/domain";
import { getPetLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";
export function HomeHubPanel({
  activeChild,
  childProfiles,
  pets,
  missions,
  goals,
  moments,
  badges,
  fairnessSummary,
  familySkillSummary,
  role,
  isParentUnlocked,
  pendingCount,
  setActiveTab,
  scheduleItems,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  pets: Pet[];
  missions: Mission[];
  goals: SavingsGoal[];
  moments: MemoryMoment[];
  badges: BadgeAward[];
  fairnessSummary: ReturnType<typeof getFairnessSummary>;
  familySkillSummary: ReturnType<typeof getFamilySkillSummary>;
  role: Role;
  isParentUnlocked: boolean;
  pendingCount: number;
  setActiveTab: (tab: string) => void;
  scheduleItems: KidScheduleItem[];
}) {
  const isParentView = role === "parent" && isParentUnlocked;
  const nextMissions = missions.filter((mission) => mission.status === "pending" && !mission.completedBy).slice(0, 4);
  const approvedCount = missions.filter((mission) => mission.status === "approved").length;
  const streakLeader = [...childProfiles].sort((a, b) => b.streakDays - a.streakDays)[0];
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies).slice(0, 2);
  const reminders = isParentView
    ? [
        `Review ${pendingCount} item${pendingCount === 1 ? "" : "s"} before rewards count.`,
        "Check assignment balance so kids are not competing for the same work.",
        "Choose which neighborhood jobs are visible before kids can accept them.",
      ]
    : [
        `Next care idea: check what ${pets[0]?.name ?? "your pet"} needs first.`,
        `${nextMissions[0]?.title ?? "Water check"} can be marked done after a parent looks.`,
        "Rewards count after a grown-up review.",
      ];
  const visibleBadges = (isParentView ? badges : badges.filter((badge) => badge.childId === activeChild?.id)).slice(0, 4);
  const nextSchedule = scheduleItems.filter((item) => (isParentView ? true : item.childId === activeChild?.id)).slice(0, 3);
  const lifeSkillBadges = [
    { title: "Responsibility", detail: "Daily care rhythm", color: "bg-[#e7f4ef] text-[#0f513f]" },
    { title: "Kindness", detail: "Gentle pet moments", color: "bg-[#ffe5f0] text-[#8f1d4f]" },
    { title: "Teamwork", detail: "Family and friends", color: "bg-[#fff4d8] text-[#7a4b12]" },
    { title: "On Time", detail: "Healthy routines", color: "bg-[#eaf1ff] text-[#1d4ed8]" },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-lg border border-[#ded8c7] bg-[#17231f] text-white shadow-sm">
          <div className="grid min-h-[320px] gap-5 p-4 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_220px] 2xl:items-center">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd166]">Home Hub</p>
              <p className="mt-3 inline-flex max-w-full rounded-full bg-white/10 px-3 py-2 text-sm font-black text-[#ffd166]">
                <span className="truncate">{isParentView ? "Parent command center" : `${activeChild?.name ?? "Kid helper"} is operating this screen`}</span>
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                {isParentView ? "Family care overview is ready." : `${activeChild?.name ?? "Kid helper"}, your pets are ready.`}
              </h2>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/82 sm:text-lg">
                {isParentView
                  ? "Track approvals, assignment fairness, kid progress, pet care, and parent-gated neighborhood jobs from one place."
                  : "A family display view for tablets, Echo Show-style screens, Google Nest-style screens, and the kitchen counter."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Missions", nextMissions.length, "#ffd166"],
                  ["Approved", approvedCount, "#5eead4"],
                  [isParentView ? "Needs review" : "Parent review", pendingCount, "#ff8ab3"],
                ].map(([label, value, color]) => (
                  <div key={label} className="min-w-0 rounded-lg bg-white/10 p-3 sm:p-4">
                    <p className="text-xs font-black uppercase text-white/70 sm:text-sm">{label}</p>
                    <p className="mt-2 text-3xl font-black sm:text-4xl" style={{ color: String(color) }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs font-black uppercase text-white/70">Fairness engine</p>
                  <p className="mt-2 text-lg font-black text-[#ffd166]">{fairnessSummary.label}</p>
                  <p className="mt-1 text-sm font-bold text-white/70">{fairnessSummary.detail}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs font-black uppercase text-white/70">Top value</p>
                  <p className="mt-2 text-lg font-black text-[#5eead4]">{familySkillSummary.topLabel}</p>
                  <p className="mt-1 text-sm font-bold text-white/70">{familySkillSummary.totalBadges} value badges tracked</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white/10 p-5">
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[#ffd166]">Pet buddies</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {pets.slice(0, 4).map((pet) => {
                  const look = getPetLook(pet.id);
                  return (
                    <div key={pet.id} className="grid place-items-center rounded-lg bg-white/10 p-3">
                      <ProfilePhoto
                        label={pet.name}
                        initial={look.face}
                        colors={look.colors}
                        size="md"
                        variant="pet"
                        petKind={look.kind}
                        photoUrl={pet.photoUrl}
                      />
                      <p className="mt-2 max-w-full truncate text-center text-base font-black">{pet.name}</p>
                      <p className="max-w-full truncate text-center text-xs font-bold text-white/70">{pet.species}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Tablet home display</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Parent next steps" : "Kitchen counter view"}</h3>
          <div className="mt-4 grid gap-3">
            {reminders.map((reminder) => (
              <p key={reminder} className="rounded-lg bg-[#f8f6ed] p-4 text-base font-black leading-6 sm:text-lg sm:leading-7">{reminder}</p>
            ))}
          </div>
          <button
            onClick={() => (role === "parent" && isParentUnlocked ? setActiveTab("approvals") : setActiveTab("missions"))}
            className="mt-4 min-h-14 w-full rounded-lg bg-[#165a4b] px-5 py-4 text-lg font-black text-white"
          >
            {role === "parent" && isParentUnlocked ? "Open parent review" : "Ask a grown-up to review"}
          </button>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">{isParentView ? "Open assignments" : "Care list"}</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Family mission board" : "Big-screen mission board"}</h3>
          <div className="mt-4 grid gap-3">
            {nextMissions.map((mission) => (
              <article key={mission.id} className="grid gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-lg font-black sm:text-xl">{mission.title}</p>
                  <p className="mt-1 text-sm font-bold text-[#5f6a65]">{mission.question}</p>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#165a4b]">
                  +{mission.points} pts
                </span>
              </article>
            ))}
          </div>
          <button onClick={() => setActiveTab(isParentView ? "approvals" : "missions")} className="mt-4 min-h-14 w-full rounded-lg bg-[#17231f] px-5 py-4 text-lg font-black text-white">
            {isParentView ? "Open parent review" : "Go to Today"}
          </button>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Badges and life skills</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">What kids are learning</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {lifeSkillBadges.map((badge) => (
              <article key={badge.title} className={`min-h-28 rounded-lg p-3 sm:min-h-32 sm:p-4 ${badge.color}`}>
                <p className="text-lg font-black sm:text-xl">{badge.title}</p>
                <p className="mt-2 text-sm font-bold">{badge.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {(visibleBadges.length ? visibleBadges : [{ id: "empty", title: "First badge ready", note: "Complete a mission and a parent can award it.", awardedAt: "Soon" }]).map((badge) => (
              <p key={badge.id} className="rounded-lg bg-white p-3 text-sm font-black shadow-sm">
                {badge.title}
                <span className="block text-xs font-bold text-[#5f6a65]">{badge.note}</span>
              </p>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
            <p className="text-lg font-black">{streakLeader?.name ?? "A helper"} leads the streak board</p>
            <p className="mt-1 text-sm font-bold text-[#4f625b]">{streakLeader?.streakDays ?? 0} days of care momentum.</p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Kid calendar</p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Family schedule snapshot" : "What is next for you"}</h3>
          </div>
          <button onClick={() => setActiveTab("schedule")} className="min-h-11 rounded-lg border border-[#b7d9cc] px-4 py-2 text-sm font-black text-[#165a4b]">
            Open schedule
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(nextSchedule.length ? nextSchedule : [{ id: "empty-schedule", day: "Today", time: "Any time", title: "No scheduled items", note: "Enjoy a calm day.", childId: activeChild?.id ?? "", kind: "family" as const }]).map((item) => {
            const child = childProfiles.find((profile) => profile.id === item.childId);
            return (
              <article key={item.id} className="rounded-lg bg-[#f8f6ed] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5f6a65]">{item.day} - {item.time}</p>
                <p className="mt-2 text-lg font-black">{item.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{item.note}</p>
                {isParentView && <p className="mt-2 text-xs font-black text-[#165a4b]">{child?.name ?? "Kid"}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood favorite</p>
        <h3 className="mt-2 text-3xl font-black">Parent-approved community moments</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            "Parents post pet care jobs. Kids can apply only after grown-up approval.",
            "Trusted families can plan safe pet playdates without child-to-child messaging.",
            "Kind goals can be shared as causes, including donations to animal shelters.",
          ].map((item) => (
            <p key={item} className="rounded-lg bg-[#f8f6ed] p-4 text-base font-black leading-6">{item}</p>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sharedGoals.map((goal) => (
            <article key={goal.id} className="rounded-lg bg-[#fff4d8] p-4">
              <p className="text-xl font-black">{goal.title}</p>
              <p className="mt-1 text-sm font-bold text-[#6f5c31]">{goal.causeNote}</p>
            </article>
          ))}
          <article className="rounded-lg bg-[#eef2ff] p-4">
            <p className="text-xl font-black">Latest memory</p>
            <p className="mt-1 text-sm font-bold text-[#4c5578]">{moments[0]?.note ?? "A kind pet care moment will show here."}</p>
          </article>
        </div>
      </section>
    </section>
  );
}
