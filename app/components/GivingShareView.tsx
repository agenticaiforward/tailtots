"use client";

import { useEffect, useState } from "react";
import { givingShareStore } from "@/lib/giving-share-store";
import type { GivingShareRecord } from "@/lib/giving-share-store";

/**
 * The family member's view, rendered instead of the app when the URL is
 * `#giving/<shareId>`. They see ONLY the parent-curated snapshot: the goal
 * name, the cause, a progress bar (saved of target), and a warm message
 * from the parent. No kid names, no kid details, no family details, and no
 * navigation into the app. Chipping in always goes through the parent.
 */
export function GivingShareView({ shareId }: { shareId: string }) {
  const [share, setShare] = useState<GivingShareRecord | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const found = await givingShareStore.getShare(shareId);
      if (!cancelled) setShare(found);
    }
    load();
    const unsubscribe = givingShareStore.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [shareId]);

  return <GivingShareContent share={share} />;
}

/**
 * Pure presentational render of the family view. Split out so the
 * privacy guarantee (this renders ONLY share-record fields — never kid
 * data) is directly unit-testable without a browser.
 */
export function GivingShareContent({ share }: { share: GivingShareRecord | null | undefined }) {
  return (
    <main className="min-h-screen bg-[#faf8f0] text-[#17231f]">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-[#ded8c7] bg-white p-6 shadow-sm sm:p-8">
          {share === undefined && (
            <p className="text-sm font-bold text-[#4f625b]">Loading the family giving goal…</p>
          )}

          {(share === null || share?.status === "revoked") && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b3541e]">Link no longer active</p>
              <h1 className="mt-2 text-3xl font-black">This family link isn&apos;t active anymore</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
                The parent may have stopped sharing this goal, or the link was mistyped. Ask the parent to send a
                fresh TailTots family link.
              </p>
              <p className="mt-4 rounded-lg bg-[#faf8f0] p-4 text-center text-sm font-bold text-[#4f625b]">
                🐾 Shared securely via TailTots
              </p>
            </>
          )}

          {share && share.status === "active" && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Family giving goal</p>
              <h1 className="mt-2 text-3xl font-black">{share.goalTitle}</h1>
              <p className="mt-1 text-sm font-black text-[#165a4b]">{share.cause}</p>

              <div className="mt-5 rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-black">
                    <span className="text-2xl text-[#165a4b]">${share.saved}</span>
                    <span className="text-[#4f625b]"> saved of ${share.target}</span>
                  </p>
                  <p className="text-xs font-black text-[#165a4b]">
                    {share.target > 0 ? Math.min(100, Math.round((share.saved / share.target) * 100)) : 0}%
                  </p>
                </div>
                <div className="mt-2 h-3 rounded-full bg-white">
                  <div
                    className="h-3 rounded-full bg-[#165a4b]"
                    style={{ width: `${share.target > 0 ? Math.min(100, (share.saved / share.target) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <blockquote className="mt-5 rounded-lg bg-[#faf8f0] p-4 text-sm font-semibold leading-6 text-[#17231f]">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#a09a8c]">
                  A note from {share.parentName}
                </p>
                <p className="mt-1">&ldquo;{share.parentMessage}&rdquo;</p>
              </blockquote>

              <div className="mt-5 rounded-lg border-2 border-dashed border-[#ded8c7] p-4 text-center">
                <p className="text-sm font-black">💛 Want to chip in?</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#4f625b]">
                  Chipping in goes through the parent — just let {share.parentName} know, and they&apos;ll add it to
                  the goal in TailTots. No accounts to create, no payments here.
                </p>
              </div>

              <p className="mt-4 text-center text-xs font-semibold text-[#a09a8c]">
                Shared by a parent · no child information is shown on this page · 🐾 TailTots
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
