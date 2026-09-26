"use client";

import type { NeighborhoodJob } from "@/lib/domain/family-types";
import type { Child, Role, SavingsGoal } from "@/lib/types";
import { getLifeSkillLabel, getTrustSignalLabel } from "@/lib/domain";
export function NeighborhoodPanel({
  goals,
  childProfiles,
  activeChild,
  role,
  jobs,
  jobDraft,
  setJobDraft,
  postJob,
  acceptJob,
  approveJob,
  toggleJobVisibility,
}: {
  goals: SavingsGoal[];
  childProfiles: Child[];
  activeChild?: Child;
  role: Role;
  jobs: NeighborhoodJob[];
  jobDraft: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string };
  setJobDraft: (value: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string }) => void;
  postJob: () => void;
  acceptJob: (jobId: string) => void;
  approveJob: (jobId: string) => void;
  toggleJobVisibility: (jobId: string) => void;
}) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies);
  const visibleJobs =
    role === "parent"
      ? jobs
      : jobs.filter((job) => job.visibleToKids && activeChild && job.assignedChildIds.includes(activeChild.id) && activeChild.age >= (job.minAge ?? 0));
  const skillJobTemplates = [
    ["Responsibility", "Morning pet check for a trusted neighbor", "Easy checklist, parent photo proof, 10-14 points"],
    ["Empathy", "Make a comfort card for a newly adopted pet", "Kindness badge, no money needed"],
    ["Teamwork", "Two-kid supply sorting task with parent", "Split points fairly, one shared family badge"],
    ["Leadership", "Older kid teaches a younger kid safe pet observation", "Higher points, parent nearby"],
  ];
  const privacyRules = [
    "Parents approve every job before it appears to kids.",
    "Kids do not see addresses, phone numbers, or adult contact details.",
    "Applications show parent names and family intent first, not public child profiles.",
    "Completion proof goes to parents only before money, points, or badges are awarded.",
  ];
  const shelterPrograms = [
    ["Shelter reading buddy", "Kids read calmly near adoptable pets while staff and parents supervise.", "Empathy badge"],
    ["Donation helper", "Families collect towels, food, or toys and log the kindness mission.", "Community Kindness badge"],
    ["Adoption learning day", "Parent-approved shelter visit teaches pet needs before adoption.", "Responsible Pet Friend badge"],
    ["Junior volunteer quest", "Age-fit volunteer tasks from a partner shelter, always parent-confirmed.", "Helping Hands badge"],
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet jobs and safe playdates</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Parents post and approve every detail before kids can see anything. Kids only see parent-approved helper jobs, simple checklists, and rewards that teach responsibility, empathy, teamwork, leadership, and time management.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parent posts job",
          "Parent approves visibility for kids",
          "Kid confirms with their profile",
          "Parent makes it final and rewards after completion",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#25352f]">{step}</p>
          </div>
        ))}
      </div>

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Post a job</p>
          <h3 className="mt-2 text-2xl font-black">Create a parent-screened helper mission</h3>
          <p className="mt-2 text-sm font-semibold text-[#5f6a65]">New jobs stay hidden from kids until a parent explicitly approves them for kid view below.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} placeholder="Job title" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.family} onChange={(event) => setJobDraft({ ...jobDraft, family: event.target.value })} placeholder="Family" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.pet} onChange={(event) => setJobDraft({ ...jobDraft, pet: event.target.value })} placeholder="Pet" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.time} onChange={(event) => setJobDraft({ ...jobDraft, time: event.target.value })} placeholder="Time" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.rewardDollars} onChange={(event) => setJobDraft({ ...jobDraft, rewardDollars: event.target.value })} inputMode="numeric" placeholder="$ reward" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.badgeTitle} onChange={(event) => setJobDraft({ ...jobDraft, badgeTitle: event.target.value })} placeholder="Badge" />
          </div>
          <textarea className="mt-3 min-h-20 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.safety} onChange={(event) => setJobDraft({ ...jobDraft, safety: event.target.value })} placeholder="Safety note" />
          <button onClick={postJob} className="mt-3 min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">Save for parent review</button>
        </section>
      )}

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Skill job builder</p>
          <h3 className="mt-2 text-2xl font-black">Post a job around the life skill you want to teach</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
            Parents can start from a value, not just a task. TailTots can suggest checklist, points, money, and badge language before anything is visible to kids or neighbors.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {skillJobTemplates.map(([skill, title, detail]) => (
              <article key={skill} className="rounded-lg bg-[#f0edff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5b21b6]">{skill}</p>
                <p className="mt-2 text-base font-black leading-5">{title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#5f6a65]">{detail}</p>
                <button className="mt-3 min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#33245f]">Use template</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">{role === "parent" ? "Job pipeline" : "Jobs for you"}</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Kid confirmations waiting for final approval" : "Confirm a job, then wait for grown-up approval"}</h3>
        <div className="mt-4 grid gap-3">
          {visibleJobs.map((job) => {
            const acceptedChild = childProfiles.find((child) => child.id === job.acceptedBy);
            const skill = job.skillFocus ?? "teamwork";
            return (
              <article key={job.id} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{job.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{job.family} - {job.pet} - {job.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{job.rewardDollars ? `$${job.rewardDollars} allowance` : job.badgeTitle}</p>
                    {acceptedChild && <p className="mt-1 text-xs font-black text-[#165a4b]">Accepted by {acceptedChild.name}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(skill)}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1d4ed8]">Age {job.minAge ?? 4}+</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{job.status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${job.visibleToKids ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-white text-[#7a2c2c]"}`}>
                      {job.visibleToKids ? "Parent approved for kids" : "Hidden until parent approves"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#25352f]">
                      {job.checklist.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#25352f]">{job.safety}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(job.trustSignals ?? ["parent_gate", "private_child"]).map((signal) => (
                    <span key={signal} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">
                      {getTrustSignalLabel(signal)}
                    </span>
                  ))}
                </div>
                {role === "child" && job.status === "posted" && (
                  <button onClick={() => acceptJob(job.id)} className="mt-3 min-h-12 w-full rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white">Confirm I want this job</button>
                )}
                {role === "child" && job.status !== "posted" && (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm font-black text-[#5f6a65]">{job.status === "accepted" ? "Waiting for a parent to make it final." : job.status === "approved" ? "Added to Today. Money goes to Kid Bank after parent approves completion." : "Completed and paid if this job had allowance."}</p>
                )}
                {role === "parent" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr]">
                    <button
                      onClick={() => toggleJobVisibility(job.id)}
                      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${job.visibleToKids ? "bg-white text-[#7a2c2c]" : "bg-[#2563eb] text-white"}`}
                    >
                      {job.visibleToKids ? "Remove kid visibility" : "Approve for kids to see"}
                    </button>
                    <button onClick={() => approveJob(job.id)} disabled={job.status !== "accepted"} className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:bg-[#b9b2a2]">Make final and add to Today</button>
                    <p className="rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">Allowed kids: {job.assignedChildIds.map((id) => childProfiles.find((child) => child.id === id)?.name).filter(Boolean).join(", ")}</p>
                  </div>
                )}
              </article>
            );
          })}
          {!visibleJobs.length && <p className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">No parent-approved jobs are available yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Privacy and trust</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Why families can safely apply for jobs" : "What kids do not see"}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {privacyRules.map((rule) => (
            <p key={rule} className="rounded-lg bg-[#e7f4ef] p-4 text-sm font-black leading-5 text-[#165a4b]">{rule}</p>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Shelters and adoption</p>
        <h3 className="mt-2 text-2xl font-black">Partner with shelters for adoption learning and volunteer badges</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          TailTots can let animal shelters post parent-approved learning missions, adoption-readiness visits, donation drives, and supervised volunteer opportunities for families in the network.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {shelterPrograms.map(([title, detail, badge]) => (
            <article key={title} className="rounded-lg bg-[#fff4d8] p-4">
              <p className="text-base font-black leading-5">{title}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5f6a65]">{detail}</p>
              <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{badge}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Family-supported goals</p>
        <h3 className="mt-2 text-2xl font-black">Trusted families can help a cause</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Parent-shared by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

export function LegacyNeighborhoodPanel({ goals, childProfiles }: { goals: SavingsGoal[]; childProfiles: Child[] }) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies);
  const trustedFamilies = [
    { name: "Patel family", pets: "Milo the rabbit", match: "Small pet care, after school", status: "Parent-approved" },
    { name: "Garcia family", pets: "Sunny the parakeet", match: "Bird care, weekend mornings", status: "Meet-and-greet" },
  ];
  const sittingRequests = [
    {
      title: "Care visit for Milo",
      family: "Patel family",
      pet: "Milo the rabbit",
      time: "Tuesday, 4:30 PM",
      reward: "$4 allowance",
      status: "Parent checklist needed",
      steps: ["Refill hay", "Check water bottle", "Send parent photo"],
      safety: "Parent stays nearby; no cage cleaning yet.",
    },
    {
      title: "Morning check for Sunny",
      family: "Garcia family",
      pet: "Sunny the parakeet",
      time: "Saturday morning",
      reward: "Kindness badge",
      status: "Needs meet-and-greet",
      steps: ["Look at water cup", "Check food level", "Tell parent if cage looks messy"],
      safety: "No handling the bird; adult opens cage only.",
    },
  ];
  const helperJobs = [
    { title: "Lawn mowing helper", family: "Patel family", time: "Friday, 5:00 PM", reward: "$12 allowance", safety: "Parent checks mower safety and stays reachable." },
    { title: "Bring bins to curb", family: "Garcia family", time: "Monday evening", reward: "$3 allowance", safety: "Stay on driveway; parent confirms address first." },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet friends and helper requests</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Kids do not browse or message other kids. Parents discover nearby pet families, compare pets and schedules, then decide whether a playdate, shared care task, or pet-sitting request is safe to show.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parents match by pet type, distance, and availability",
          "Parents chat and schedule first",
          "Kids only see approved date or helper task",
          "Parent closes the loop with pickup, reward, and notes",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#25352f]">{step}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Family matching</p>
          <h3 className="mt-2 text-2xl font-black">Pet families parents can review</h3>
          <div className="mt-4 grid gap-3">
            {trustedFamilies.map((family) => (
              <article key={family.name} className="rounded-lg bg-[#f8f6ed] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{family.name}</p>
                    <p className="text-sm font-semibold text-[#5f6a65]">{family.pets}</p>
                    <p className="mt-1 text-xs font-bold text-[#69736f]">{family.match}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">{family.status}</span>
                </div>
              </article>
            ))}
          </div>
          <button className="mt-4 min-h-12 rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
            Review pet family match
          </button>
        </div>

        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent calendar</p>
          <h3 className="mt-2 text-2xl font-black">Pet care requests before kids see them</h3>
          <div className="mt-4 grid gap-3">
            {sittingRequests.map((request) => (
              <article key={request.title} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{request.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{request.family} - {request.pet} - {request.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{request.reward}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{request.status}</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#25352f]">
                      {request.steps.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#25352f]">{request.safety}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Create kid care mission</button>
                  <button className="min-h-11 rounded-lg border border-[#d7caa9] bg-white px-4 py-2 text-sm font-black">Confirm adult details</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Family-supported goals</p>
        <h3 className="mt-2 text-2xl font-black">Trusted families can help a cause</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Parents can expose selected goals to trusted families so a neighbor can support the purpose, like pet enrichment or care supplies. The child is not publicly searchable, and parents control who sees it.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Parent-shared by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Offer support</button>
                  <button className="min-h-11 rounded-lg border border-[#b7d9cc] bg-white px-4 py-2 text-sm font-black">Message parent</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Pet-sitting and helper workflow</p>
        <h3 className="mt-2 text-2xl font-black">What a parent must approve</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pet needs", "Food, water, medicine, handling limits, and what not to do."],
            ["Job details", "Address, parent contact, time window, tools, pickup/dropoff, and emergency backup."],
            ["Kid mission", "A simple checklist with proof photo or parent note."],
            ["Reward", "Allowance dollars for jobs, reward coins for app progress, or kindness badges for favors."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#f8f6ed] p-4">
              <h4 className="font-black">{title}</h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Neighborhood helper jobs</p>
        <h3 className="mt-2 text-2xl font-black">Parent-approved ways kids can earn allowance</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {helperJobs.map((job) => (
            <article key={job.title} className="rounded-lg bg-[#eef2ff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{job.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{job.family} - {job.time}</p>
                  <p className="mt-1 text-sm font-black text-[#1d4f91]">{job.reward}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2563eb]">Parent-led</span>
              </div>
              <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-[#25352f]">{job.safety}</p>
              <button className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white">Create helper mission</button>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

void LegacyNeighborhoodPanel;
