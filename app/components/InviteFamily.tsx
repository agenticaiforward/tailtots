/**
 * InviteFamily — distribution built into the product, not bolted on.
 *
 * When a parent invites another family, both kids' pets become "pen pals":
 * safe, AI-moderated pet-to-pet interactions. No kid-to-kid contact, no
 * chat — just pets "visiting" each other with AI-generated stories.
 *
 * The product gets BETTER with friends. That's the loop.
 */
"use client";

import { useMemo, useState } from "react";
import { PetBuddyFace } from "./pet-buddy";
import type { PetKind } from "./pet-buddy";

function makeInviteCode(familyName: string): string {
  const clean = familyName.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6) || "FAMILY";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${clean}-${suffix}`;
}

export function InviteFamily({
  familyName,
  petName,
  petKind,
  petPhotoUrl,
}: {
  familyName: string;
  petName?: string;
  petKind?: PetKind;
  petPhotoUrl?: string;
}) {
  const [invitedName, setInvitedName] = useState("");
  const [code, setCode] = useState<string | null>(null);

  const shareText = useMemo(() => {
    if (!code) return "";
    return `Join our family on TailTots! Use invite code ${code} — our pets ${petName ?? "Buddy"} can't wait to meet yours! 🐾`;
  }, [code, petName]);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#ded8c7] bg-gradient-to-br from-[#fff9e8] to-white p-5 shadow-sm sm:p-6" aria-label="Invite a family">
      <div className="flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#f4b400]/20 text-3xl" aria-hidden="true">
          💌
        </div>
        <div>
          <h3 className="text-xl font-black text-[#17231f]">Invite a family</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">
            When friends join, your pets become <span className="font-black text-[#7a4b12]">pen pals</span> — they visit each other with little AI-generated adventure stories. No chatting, no kid-to-kid contact. Just pets being adorable together. 🐾💛
          </p>
        </div>
      </div>

      {/* Pen-pal preview */}
      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#ded8c7]">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#69736f]">How pen pals work</p>
        <div className="mt-3 flex items-center justify-center gap-2 sm:gap-4">
          <div className="flex flex-col items-center gap-1">
            {petKind ? (
              <PetBuddyFace kind={petKind} photoUrl={petPhotoUrl} label={petName ?? "Your pet"} size="md" />
            ) : (
              <span className="text-4xl" aria-hidden="true">🐶</span>
            )}
            <span className="text-xs font-black">{petName ?? "Your pet"}</span>
          </div>
          <div className="flex flex-col items-center px-1" aria-hidden="true">
            <span className="text-2xl animate-[pet-wiggle_2s_ease-in-out_infinite]">✈️</span>
            <span className="mt-1 max-w-[120px] rounded-xl bg-[#e7f4ef] px-2 py-1 text-center text-[10px] font-bold text-[#0d3b30]">
              &ldquo;{petName ?? "Buddy"} visited Biscuit and they chased butterflies! 🦋&rdquo;
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 opacity-70">
            <span className="grid size-16 place-items-center rounded-full bg-[#f5f1e5] text-3xl ring-2 ring-dashed ring-[#ded8c7]" aria-hidden="true">🐱</span>
            <span className="text-xs font-black text-[#69736f]">Friend&apos;s pet</span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-[#69736f]">
          Stories are AI-generated from safe templates and parent-approved. Kids never message each other.
        </p>
      </div>

      {!code ? (
        <div className="mt-4">
          <label htmlFor="invite-family-name" className="text-xs font-black uppercase tracking-wide text-[#4f625b]">
            Friend&apos;s family nickname
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="invite-family-name"
              type="text"
              value={invitedName}
              onChange={(e) => setInvitedName(e.target.value)}
              placeholder="e.g. The Garcias"
              maxLength={40}
              className="min-h-11 flex-1 rounded-xl border border-[#ded8c7] bg-white px-3 text-sm font-semibold text-[#17231f] placeholder:text-[#a8a294] focus:border-[#165a4b] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setCode(makeInviteCode(invitedName || familyName))}
              className="tt-btn-press min-h-11 shrink-0 rounded-xl bg-[#165a4b] px-4 text-sm font-black text-white"
            >
              Create invite
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl bg-[#e7f4ef] p-4 text-center ring-1 ring-[#165a4b]/30">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0d3b30]">Your invite code</p>
          <p className="mt-1 text-3xl font-black tracking-widest text-[#0d3b30]">{code}</p>
          <p className="mx-auto mt-2 max-w-sm text-xs font-semibold text-[#4f625b]">{shareText}</p>
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(shareText);
              } catch {
                /* clipboard unavailable */
              }
            }}
            className="tt-btn-press mt-3 min-h-10 rounded-xl bg-[#0d3b30] px-4 text-sm font-black text-white"
          >
            Copy invite 📋
          </button>
          <button type="button" onClick={() => setCode(null)} className="mt-2 block w-full text-xs font-bold text-[#69736f] underline">
            Make a new code
          </button>
        </div>
      )}
    </section>
  );
}
