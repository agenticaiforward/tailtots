"use client";

import type { ReadinessSignOff } from "@/lib/domain/family-types";
import type { BankTransaction, Child, Mission } from "@/lib/types";
import { summarizeJourney } from "@/lib/domain/readiness";
import { getChildLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";

export function PetReadyJourneyPanel({
  childProfiles,
  missions,
  transactions,
  canSignOff,
  signOffs,
  onSignOff,
}: {
  childProfiles: Child[];
  missions: Mission[];
  transactions: BankTransaction[];
  canSignOff: boolean;
  signOffs: ReadinessSignOff[];
  onSignOff: (milestoneId: string, childId: string) => void;
}) {
  return (
    <section aria-label="Pet Ready Family journey" className="rounded-lg border border-[#165a4b] bg-[#f7fffb] p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Pet Ready Family journey</p>
      <h2 className="mt-2 text-3xl font-black">Proving readiness, one week at a time</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#3d4a45]">
        Over 8–12 weeks, kids show they can care consistently — and parents sign off each step.
        This journey proves responsibility; it never promises a pet. The final decision always belongs to the parent.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {childProfiles.map((child) => {
          const look = getChildLook(child.id);
          const { states, completeCount, journeyPct, readyForTalk, talkSignOff } = summarizeJourney(
            child,
            missions,
            transactions,
            signOffs,
          );

          return (
            <article key={child.id} className="rounded-lg border border-[#ded8c7] bg-white p-4">
              <div className="flex items-center gap-3">
                <ProfilePhoto
                  label={child.name}
                  initial={look.initial}
                  colors={look.colors}
                  variant="kid"
                  hair={look.hair}
                  photoUrl={child.photoUrl}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-black">{child.name}&rsquo;s journey</h3>
                  <p className="text-xs font-bold text-[#5f6a65]">
                    {completeCount} of {states.length} milestones reached
                  </p>
                </div>
                <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">{journeyPct}%</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eef2ec]" role="progressbar" aria-valuenow={journeyPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${child.name}'s Pet Ready progress`}>
                <div className="h-3 rounded-full bg-[#165a4b] transition-[width]" style={{ width: `${journeyPct}%` }} />
              </div>

              <ol className="mt-4 space-y-3">
                {states.map(({ milestone, progress, isComplete, signOff }) => (
                  <li key={milestone.id} className="rounded-lg bg-[#f8f6ed] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#17231f]">
                          {isComplete ? "✓ " : ""}{milestone.title}
                        </p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-[#5f6a65]">{milestone.description}</p>
                        <p className="mt-1 text-xs font-black text-[#165a4b]">
                          {Math.min(progress, milestone.target)} / {milestone.target} {milestone.unit}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      {signOff ? (
                        <p className="text-xs font-black text-[#165a4b]">
                          Parent signed off{signOff.signedAt ? ` · ${signOff.signedAt}` : ""}
                        </p>
                      ) : isComplete && canSignOff ? (
                        <button
                          onClick={() => onSignOff(milestone.id, child.id)}
                          className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-xs font-black text-white"
                          aria-label={`Sign off ${milestone.title} for ${child.name}`}
                        >
                          Sign off as parent
                        </button>
                      ) : isComplete ? (
                        <p className="text-xs font-bold text-[#5f6a65]">Reached — waiting for a parent to sign off.</p>
                      ) : (
                        <p className="text-xs font-bold text-[#5f6a65]">Keep going — progress is saved automatically.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-4 rounded-lg border border-[#ded8c7] bg-[#fffdf7] p-3">
                <h4 className="text-sm font-black text-[#17231f]">Family decision talk</h4>
                {talkSignOff ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#3d4a45]">
                    Your family has walked the journey together and is ready to talk about a pet.
                    The decision is still the parent&rsquo;s — readiness is proven, never promised.
                  </p>
                ) : readyForTalk && canSignOff ? (
                  <>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[#3d4a45]">
                      All milestones are reached. When you sign off, you&rsquo;re saying your family is ready
                      to have the pet conversation — not that a pet is guaranteed.
                    </p>
                    <button
                      onClick={() => onSignOff("family-talk", child.id)}
                      className="mt-2 min-h-11 rounded-lg bg-[#f47b20] px-4 py-2 text-xs font-black text-white"
                      aria-label={`Sign off the family decision talk for ${child.name}`}
                    >
                      Sign off: ready to talk together
                    </button>
                  </>
                ) : readyForTalk ? (
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#3d4a45]">
                    All milestones are reached. Ask a parent to sign off when your family is ready to talk about a pet together.
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#5f6a65]">
                    Unlocks when all five milestones are reached. This is a conversation, not a prize.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-xs font-bold leading-5 text-[#5f6a65]">
        A note for parents: the Pet Ready Family journey documents consistency over time. It supports — but never
        replaces — a shelter&rsquo;s own screening, and it never guarantees an adoption.
      </p>
    </section>
  );
}
