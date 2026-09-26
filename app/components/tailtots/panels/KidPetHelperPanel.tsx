"use client";

import { useState } from "react";
import type { Child, MemoryMoment, Pet } from "@/lib/types";
import { buildKidAiSuggestion } from "../ai-content";
export function KidPetHelperPanel({ activeChild, pets, moments }: { activeChild?: Child; pets: Pet[]; moments: MemoryMoment[] }) {
  const pet = pets[0];
  const petName = pet?.name ?? "your pet";
  const [selectedQuestion, setSelectedQuestion] = useState("care");
  const kidQuestions = [
    ["care", `How can I take care of ${petName} today?`],
    ["fact", `Tell me something cool about ${petName}.`],
    ["hobby", "Give me a pet or hobby idea."],
    ["quote", "Give me today's kind quote."],
  ];
  const aiSuggestion = buildKidAiSuggestion(selectedQuestion, petName, activeChild?.name ?? "Kid");
  const helperCards = [
    ["Daily quote", "Small care done every day becomes a big kind habit."],
    ["Pet fact", `${petName} feels safer when food, water, sound, and handling stay calm and predictable.`],
    ["Try today", `Look closely at ${petName} for ten quiet seconds, then tell a parent one thing you noticed.`],
    ["Hobby spark", "Draw your pet's dream home, build a paper maze, or write a tiny care story."],
  ];
  const recentMoment = moments.find((moment) => moment.childId === activeChild?.id);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Kid-safe AI helper</p>
        <h2 className="mt-2 text-3xl font-black">{activeChild?.name ?? "Kid"}, ask about pets without grown-up screens</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          These are guided prompts, not open chat. They help kids learn pet care, curiosity, and kindness without judging them.
        </p>
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Ask with a button</p>
        <h3 className="mt-2 text-2xl font-black">Pick a safe question</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {kidQuestions.map(([id, question]) => (
            <button
              key={id}
              onClick={() => setSelectedQuestion(id)}
              className={`min-h-14 rounded-lg px-4 py-3 text-left text-sm font-black leading-5 ${
                selectedQuestion === id ? "bg-[#165a4b] text-white" : "border border-[#ded8c7] bg-[#f8f6ed] text-[#17231f]"
              }`}
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">TailTots suggestion</p>
          <p className="mt-2 text-lg font-black leading-7">{aiSuggestion.title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">{aiSuggestion.body}</p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {helperCards.map(([title, body]) => (
          <article key={title} className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5f6a65]">{body}</p>
          </article>
        ))}
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Your care memory</p>
        <p className="mt-3 text-lg font-black">{recentMoment?.note ?? "Complete a care mission and your kind pet moment can show here."}</p>
      </section>
    </section>
  );
}
