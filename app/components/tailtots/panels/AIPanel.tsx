"use client";

import { useState } from "react";
import type { Child, Mission } from "@/lib/types";
import { ageBandForAge } from "@/lib/ai/ideas";
import {
  buildCareChecklist,
  buildFairnessPlan,
  buildLifeSkillChores,
  buildMemoryMoment,
  buildPassportSummary,
  buildPhotoJournal,
  buildSmartMissions,
} from "../ai-content";
export function AIPanel({ childProfiles, missions }: { childProfiles: Child[]; missions: Mission[] }) {
  const currentUses = [
    ["Local parent tools", "TailTots now has template-powered helpers for missions, care checklists, memories, summaries, journals, and insights."],
    ["AI ideas are live for parents", "The Life Skill Chore Planner can generate activity ideas with Cloudflare Workers AI. Parents review every suggestion before it becomes a mission."],
  ];
  const [aiDraft, setAiDraft] = useState({
    petType: "Guinea pig",
    petAge: "2 years",
    routine: "Morning hay, fresh water, veggie treat, quick cage check",
    vetNotes: "Handle gently. Watch water bottle level. No loud noises near cage.",
    memoryNote: "Aarush remembered RB's food before school and checked the water.",
    photoMoment: "Captain basking after fresh greens",
    lifeSkill: "responsibility",
    choreGoal: "Teach responsibility through morning pet care and one family helper task",
  });
  const smartMissions = buildSmartMissions(aiDraft.petType, aiDraft.routine);
  const lifeSkillMissions = buildLifeSkillChores(aiDraft.lifeSkill, aiDraft.choreGoal, childProfiles);
  const fairnessPlan = buildFairnessPlan(missions, childProfiles);
  const coachChecklist = buildCareChecklist(aiDraft.vetNotes);
  const memoryMoment = buildMemoryMoment(aiDraft.memoryNote);
  const passportSummary = buildPassportSummary(aiDraft.petType, aiDraft.petAge, aiDraft.routine, aiDraft.vetNotes);
  const photoJournal = buildPhotoJournal(aiDraft.photoMoment);
  const [aiIdeas, setAiIdeas] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function generateAiIdeas() {
    const child = childProfiles[0];
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lifeSkill: aiDraft.lifeSkill,
          childFirstName: child?.name.trim().split(/\s+/)[0] ?? "your child",
          ageBand: child ? ageBandForAge(child.age) : "7-9",
        }),
      });
      const data = (await response.json()) as { ideas?: unknown };
      const ideas = Array.isArray(data.ideas)
        ? data.ideas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      if (response.ok && ideas.length > 0) {
        setAiIdeas(ideas);
      } else {
        setAiIdeas(null);
        setAiError("The AI helper is unavailable right now — showing template ideas instead.");
      }
    } catch {
      setAiIdeas(null);
      setAiError("The AI helper is unavailable right now — showing template ideas instead.");
    } finally {
      setAiLoading(false);
    }
  }
  const familyInsights = [
    "Aarush has a strong helper streak when tasks are short and before school.",
    "Pet care missions are clearer when each one has one animal and one proof step.",
    "Weekend helper work should be parent-scheduled because neighborhood jobs need adult details.",
  ];
  const socialIdeas = [
    "Parent-controlled pet profiles and feeds",
    "AI caption suggestions for Jack, Jamie, Captain, and RB",
    "Weekly pet recaps and milestone cards",
    "Badges for kindness, consistency, savings, and teamwork",
    "Parent approval before anything is shared publicly",
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">AI roadmap</p>
        <h2 className="mt-2 text-3xl font-black">AI should help quietly, safely, and parent-first.</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#dce7e2]">
          TailTots should not become an open-ended chatbot for kids. AI works best here as a behind-the-scenes helper for missions, memories, care summaries, insights, and parent-approved pet social features.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">AI now</p>
          <h3 className="mt-2 text-2xl font-black">What exists today</h3>
          <div className="mt-4 grid gap-3">
            {currentUses.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#f8f6ed] p-4">
                <h4 className="font-black">{title}</h4>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Guardrails</p>
          <h3 className="mt-2 text-2xl font-black">Rules for kid-safe AI</h3>
          <ul className="mt-4 grid gap-3 text-sm font-semibold leading-5 text-[#5f6a65]">
            <li className="rounded-lg bg-[#fff4d8] p-3">Parents control AI setup, publishing, and social sharing.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Kids get simple prompts and choices, not an unrestricted AI chat.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Pet health guidance stays parent-facing and avoids diagnosis.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Anything public needs parent approval before it leaves the family.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">AI tools</p>
        <h3 className="mt-2 text-2xl font-black">Parent-side helpers you can use now</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          The planner below can generate ideas with AI, or keep using the built-in templates. Nothing is
          saved until a parent chooses it.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-[#eef2ff] p-4">
            <h4 className="text-lg font-black">Life Skill Chore Planner</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select className="rounded-lg border border-[#c8d2f0] px-3 py-3 text-sm font-semibold" value={aiDraft.lifeSkill} onChange={(event) => setAiDraft({ ...aiDraft, lifeSkill: event.target.value })}>
                <option value="responsibility">Responsibility</option>
                <option value="empathy">Empathy</option>
                <option value="teamwork">Teamwork</option>
                <option value="leadership">Leadership</option>
                <option value="time">Time habits</option>
              </select>
              <input className="rounded-lg border border-[#c8d2f0] px-3 py-3 text-sm font-semibold" value={aiDraft.choreGoal} onChange={(event) => setAiDraft({ ...aiDraft, choreGoal: event.target.value })} placeholder="What value should chores teach?" />
            </div>
            <button
              type="button"
              onClick={generateAiIdeas}
              disabled={aiLoading}
              className="mt-3 min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50"
            >
              {aiLoading ? "Generating ideas…" : "Generate with AI"}
            </button>
            {aiError && (
              <p className="mt-2 text-xs font-semibold text-[#8a5a00]">{aiError}</p>
            )}
            {aiIdeas && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563eb]">
                  AI-generated ideas — review before saving as a mission
                </p>
                <div className="mt-2 grid gap-2">
                  {aiIdeas.map((idea) => (
                    <p key={idea} className="rounded-lg bg-[#eef2ff] p-3 text-sm font-semibold leading-5">{idea}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {lifeSkillMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Fair Chore Distributor</h4>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">Harder work earns more points, but the weekly plan aims for similar totals if everyone completes their assigned chores.</p>
            <div className="mt-3 grid gap-2">
              {fairnessPlan.map((line) => <p key={line} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{line}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#f8f6ed] p-4">
            <h4 className="text-lg font-black">Smart Mission Generator</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petType} onChange={(event) => setAiDraft({ ...aiDraft, petType: event.target.value })} placeholder="Pet type" />
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petAge} onChange={(event) => setAiDraft({ ...aiDraft, petAge: event.target.value })} placeholder="Pet age" />
            </div>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.routine} onChange={(event) => setAiDraft({ ...aiDraft, routine: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {smartMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#f8f6ed] p-4">
            <h4 className="text-lg font-black">Pet Care Coach</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.vetNotes} onChange={(event) => setAiDraft({ ...aiDraft, vetNotes: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {coachChecklist.map((item) => <p key={item} className="rounded-lg bg-white p-3 text-sm font-semibold">{item}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Memory Moment Writer</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#d7caa9] px-3 py-3 text-sm font-semibold" value={aiDraft.memoryNote} onChange={(event) => setAiDraft({ ...aiDraft, memoryNote: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{memoryMoment}</p>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Pet Passport Summary</h4>
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{passportSummary}</p>
            <h4 className="mt-4 text-lg font-black">Photo Pet Journal</h4>
            <input className="mt-3 w-full rounded-lg border border-[#b7d9cc] px-3 py-3 text-sm font-semibold" value={aiDraft.photoMoment} onChange={(event) => setAiDraft({ ...aiDraft, photoMoment: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{photoJournal}</p>
          </section>
        </div>

        <section className="mt-4 rounded-lg bg-[#eef2ff] p-4">
          <h4 className="text-lg font-black">Family Insights</h4>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {familyInsights.map((insight) => <p key={insight} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{insight}</p>)}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Pet social extension</p>
        <h3 className="mt-2 text-2xl font-black">Future social media for pets</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          A future TailTots social layer could let each pet have a parent-controlled profile, with kids contributing moments and AI helping turn care wins into safe posts, captions, badges, and weekly stories.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {socialIdeas.map((idea) => (
            <div key={idea} className="rounded-lg bg-[#f0edff] p-4 text-sm font-black text-[#33245f]">
              {idea}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
