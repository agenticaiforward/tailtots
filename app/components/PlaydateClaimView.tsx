"use client";

import { useEffect, useMemo, useState } from "react";
import { playdateClaimUrl, playdateStore } from "@/lib/playdate-store";
import type { PlaydateInvite } from "@/lib/playdate-store";
// Feedback R2 (schedule stream, cross-region hook ≤5 lines): record the
// accepting parent's in-app confirmation receipt. The host is notified via
// their Schedule panel; email is not sent — the repo has no email provider
// (see the EMAIL GAP notes in lib/playdate-notifications.ts).
import { recordClaimReceiptFromInvite } from "@/lib/playdate-notifications";

/**
 * The other parent's view, rendered instead of the app when the URL is
 * `#playdate/<inviteId>`. They see only first names and time windows — no
 * addresses, no kid last names, no contact details. Picking a slot books it
 * for real; the host parent sees the confirmation live via store sync.
 */
export function PlaydateClaimView({ inviteId }: { inviteId: string }) {
  const [invite, setInvite] = useState<PlaydateInvite | null | undefined>(undefined);
  const [claimerName, setClaimerName] = useState("");
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);
  const [claimError, setClaimError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const found = await playdateStore.getInvite(inviteId);
      if (!cancelled) setInvite(found);
    }
    load();
    const unsubscribe = playdateStore.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [inviteId]);

  const openSlots = useMemo(() => {
    if (!invite) return [];
    return invite.slots
      .map((slot, index) => ({ ...slot, index }))
      .filter((slot) => slot.status === "open");
  }, [invite]);

  const grouped = useMemo(() => {
    const map = new Map<string, { childName: string; slots: typeof openSlots }>();
    for (const slot of openSlots) {
      const entry = map.get(slot.childId) ?? { childName: slot.childName, slots: [] };
      entry.slots.push(slot);
      map.set(slot.childId, entry);
    }
    return [...map.values()];
  }, [openSlots]);

  async function confirmClaim() {
    if (pickedIndex === null || !claimerName.trim()) return;
    setClaimError("");
    const updated = await playdateStore.claimSlot(inviteId, pickedIndex, claimerName);
    if (updated) {
      recordClaimReceiptFromInvite(updated, claimerName);
      setInvite(updated);
      setJustClaimed(true);
    } else {
      setClaimError("That time was just taken — please pick another open time.");
      const fresh = await playdateStore.getInvite(inviteId);
      setInvite(fresh);
      setPickedIndex(null);
    }
  }

  const claimedSlot = invite?.status === "booked" ? invite.slots.find((s) => s.status === "claimed") : undefined;

  return (
    <main className="min-h-screen bg-[#faf8f0] text-[#17231f]">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-[#ded8c7] bg-white p-6 shadow-sm sm:p-8">
          {invite === undefined && (
            <p className="text-sm font-bold text-[#4f625b]">Loading your playdate invite…</p>
          )}

          {invite === null && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b3541e]">Invite not found</p>
              <h1 className="mt-2 text-3xl font-black">This invite link doesn&apos;t work</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
                The link may be mistyped, or the invite was removed. Ask the other parent to send a fresh TailTots
                playdate link.
              </p>
            </>
          )}

          {invite && justClaimed && claimedSlot && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Playdate booked</p>
              <h1 className="mt-2 text-3xl font-black">✅ You&apos;re all set!</h1>
              <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4 text-sm font-semibold leading-6">
                <p>
                  <b>{claimedSlot.slot}</b> — a playdate with {claimedSlot.childName}.
                </p>
                <p className="mt-1 text-[#4f625b]">
                  {invite.hostName} ({invite.familyName} family) will confirm the details with you parent-to-parent.
                  A parent from each family will be present.
                </p>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#4f625b]">
                No addresses or contact details are shared here — the host parent reaches out to coordinate pickup.
              </p>
            </>
          )}

          {invite && !justClaimed && invite.status === "booked" && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b3541e]">Already booked</p>
              <h1 className="mt-2 text-3xl font-black">This playdate is taken</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
                {claimedSlot ? (
                  <>
                    <b className="text-[#17231f]">{claimedSlot.slot}</b> was already claimed. Ask {invite.hostName} for
                    another time.
                  </>
                ) : (
                  <>Ask {invite.hostName} for another time.</>
                )}
              </p>
            </>
          )}

          {invite && !justClaimed && invite.status === "open" && openSlots.length === 0 && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b3541e]">No open times</p>
              <h1 className="mt-2 text-3xl font-black">No times left on this invite</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
                Ask {invite.hostName} to share a fresh invite with more times.
              </p>
            </>
          )}

          {invite && !justClaimed && invite.status === "open" && openSlots.length > 0 && (
            <>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Playdate invite</p>
              <h1 className="mt-2 text-3xl font-black">The {invite.familyName} family invited you</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">
                {invite.hostName} shared these playdate times. Pick one — a parent from each family will be present,
                and {invite.hostName} confirms every plan before the kids hear about it. No addresses or contact
                details are shared on this page.
              </p>

              <div className="mt-5 grid gap-3">
                {grouped.map((group) => (
                  <div key={group.slots[0].childId} className="rounded-lg bg-[#faf8f0] p-4">
                    <p className="text-sm font-black text-[#4f625b]">A playdate with {group.childName}</p>
                    <div className="mt-2 grid gap-2">
                      {group.slots.map((slot) => {
                        const picked = pickedIndex === slot.index;
                        return (
                          <button
                            key={slot.index}
                            onClick={() => setPickedIndex(picked ? null : slot.index)}
                            className={`min-h-11 rounded-lg px-4 py-2 text-left text-sm font-black ring-2 ${
                              picked ? "bg-[#2563eb] text-white ring-[#2563eb]" : "bg-white text-[#17231f] ring-[#ded8c7]"
                            }`}
                          >
                            {slot.slot}
                            {picked ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-5 block">
                <span className="text-sm font-black">Your first name</span>
                <input
                  value={claimerName}
                  onChange={(e) => setClaimerName(e.target.value)}
                  placeholder="e.g. Priya"
                  maxLength={40}
                  className="mt-1 min-h-11 w-full rounded-lg border-2 border-[#ded8c7] bg-white px-3 py-2 text-sm font-bold"
                />
              </label>

              {claimError && (
                <p className="mt-2 rounded-lg bg-[#fdeee4] p-3 text-sm font-bold text-[#b3541e]">{claimError}</p>
              )}

              <button
                onClick={confirmClaim}
                disabled={pickedIndex === null || !claimerName.trim()}
                className="mt-4 min-h-12 w-full rounded-lg bg-[#165a4b] px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                Confirm this playdate time
              </button>
              <p className="mt-2 text-center text-xs font-semibold text-[#4f625b]">
                Only first names and time windows are shared. The host parent approves everything.
              </p>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs font-semibold text-[#a09a8c]">
          Shared securely via TailTots · {typeof window !== "undefined" ? playdateClaimUrl(inviteId) : ""}
        </p>
      </div>
    </main>
  );
}
