"use client";

import { useState } from "react";
import { playdateStore, playdateClaimUrl } from "@/lib/playdate-store";
import type { Child } from "@/lib/types";

/**
 * PlaydateQuickCreate — set up a playdate in under 60 seconds.
 *
 * 3 steps, photo-first:
 *   1. Pick your kid (photo)
 *   2. Pick 1-3 time windows (big tappable presets, not 15-min grids)
 *   3. Share the link
 *
 * The detailed weekly-grid flow still exists below for power users.
 */

const TIME_PRESETS = [
  { id: "sat-am", label: "Sat 10am–12pm" },
  { id: "sat-pm", label: "Sat 2–4pm" },
  { id: "sun-am", label: "Sun 10am–12pm" },
  { id: "sun-pm", label: "Sun 2–4pm" },
  { id: "weekday-pm", label: "Weekday 4–6pm" },
];

export function PlaydateQuickCreate({
  children,
  familyName,
  hostName,
  onCreated,
}: {
  children: Child[];
  familyName: string;
  hostName: string;
  onCreated?: () => void;
}) {
  const [kidId, setKidId] = useState<string>(children[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const kid = children.find((c) => c.id === kidId);
  const kidFirst = kid?.name.split(" ")[0] ?? "your kid";

  function toggleTime(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 3)));
  }

  async function create() {
    if (!kidId || picked.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const slots = picked.map((pid) => {
        const preset = TIME_PRESETS.find((t) => t.id === pid)!;
        return { childId: kidId, childName: kidFirst, slot: preset.label };
      });
      const invite = await playdateStore.createInvite(familyName, hostName || "A TailTots parent", slots);
      setInviteUrl(playdateClaimUrl(invite.id));
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the invite. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!inviteUrl) return;
    navigator.clipboard?.writeText(inviteUrl).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      },
      () => setCopied(false),
    );
  }

  function reset() {
    setInviteUrl(null);
    setPicked([]);
    setCopied(false);
  }

  return (
    <section className="rounded-3xl border-2 border-tt-pine bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">⚡ Quick invite — under 60 seconds</p>
      <h3 className="mt-2 text-2xl font-black text-tt-ink">Set up a playdate</h3>

      {!inviteUrl ? (
        <>
          {/* Step 1: pick kid */}
          <p className="mt-4 text-sm font-black text-tt-ink">1. Which kid?</p>
          <div className="mt-2 flex gap-3">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setKidId(c.id)}
                className={`flex flex-col items-center rounded-2xl border-2 p-3 transition-all ${
                  kidId === c.id ? "border-tt-pine bg-tt-pine-tint" : "border-tt-line bg-white"
                }`}
              >
                <span className="text-4xl" aria-hidden="true">🧒</span>
                <span className="mt-1 text-sm font-extrabold text-tt-ink">{c.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Step 2: pick times */}
          <p className="mt-4 text-sm font-black text-tt-ink">2. When works? <span className="font-semibold text-tt-ink-faint">(pick up to 3)</span></p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIME_PRESETS.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTime(t.id)}
                  className={`min-h-12 rounded-xl px-3 py-2 text-sm font-extrabold transition-all ${
                    on ? "bg-tt-pine text-white shadow-md" : "bg-tt-cream text-tt-ink hover:bg-tt-sand"
                  }`}
                >
                  {t.label}{on ? " ✓" : ""}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

          <button
            onClick={create}
            disabled={!kidId || picked.length === 0 || busy}
            className="tt-btn-press mt-5 min-h-12 w-full rounded-2xl bg-tt-pine px-6 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            {busy ? "Creating…" : `3. Create invite for ${kidFirst} →`}
          </button>
        </>
      ) : (
        <>
          <div className="mt-4 rounded-2xl bg-tt-pine-tint p-4 text-center">
            <p className="text-3xl" aria-hidden="true">🎉</p>
            <p className="mt-1 text-base font-black text-tt-ink">Invite ready!</p>
            <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
              Send this link to the other parent. First to pick a time books it.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="min-h-12 flex-1 rounded-xl border border-tt-line bg-tt-cream px-3 text-xs font-bold text-tt-ink"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copy}
              className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-5 text-sm font-black text-tt-ink"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button onClick={reset} className="mt-3 text-sm font-bold text-tt-ink-faint underline">
            Make another invite
          </button>
        </>
      )}
    </section>
  );
}
