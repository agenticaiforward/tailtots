"use client";

/**
 * Partner dashboard — the org leader's view over the same AI backend.
 *
 * Shelter / school / PTO leaders see:
 * - Their skill ladder progress (rungs completed across enrolled families)
 * - Upcoming visits / events
 * - Skill sign-offs pending their approval
 *
 * They NEVER see: individual child trait data, home-context behavior, or
 * anything outside their own context without parent consent. Aggregate only.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PROVIDER_KIND_EMOJI,
  PROVIDER_KIND_LABELS,
  seedProviders,
  type MissionProvider,
  type ProviderKind,
} from "../../../lib/ecosystem/providers";
import ProviderOnboarding from "../../components/ecosystem/ProviderOnboarding";

type View = "overview" | "onboard";

export default function PartnerDashboard() {
  const [view, setView] = useState<View>("overview");
  const [kindFilter, setKindFilter] = useState<ProviderKind | "all">("all");
  const [onboarded, setOnboarded] = useState<string | null>(null);

  const providers = useMemo(() => seedProviders(), []);
  const filtered = kindFilter === "all" ? providers : providers.filter((p) => p.kind === kindFilter);

  return (
    <main className="min-h-screen bg-tt-cream">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <Link href="/" className="text-sm font-bold text-tt-pine hover:underline">← Back to TailTots</Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-tt-navy">Partner dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
              Your ladders, your families, your impact — over the shared TailTots backend.
            </p>
          </div>
          <button
            onClick={() => setView(view === "overview" ? "onboard" : "overview")}
            className="tt-btn-press rounded-2xl bg-tt-pine px-5 py-2.5 text-sm font-black text-white"
          >
            {view === "overview" ? "+ Onboard an org" : "← Back to overview"}
          </button>
        </div>

        {view === "onboard" ? (
          <div className="mt-8">
            {onboarded ? (
              <div className="rounded-3xl border border-tt-line bg-tt-paper p-8 text-center">
                <p className="text-4xl" aria-hidden="true">🎉</p>
                <h2 className="mt-2 text-xl font-black text-tt-ink">Draft received!</h2>
                <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-tt-ink-soft">
                  <strong>{onboarded}</strong> — a partner specialist will review your draft ladder
                  with you before anything goes live. Nothing auto-publishes.
                </p>
                <button
                  onClick={() => { setOnboarded(null); setView("overview"); }}
                  className="mt-4 rounded-2xl border border-tt-line px-5 py-2.5 text-sm font-black text-tt-ink-soft"
                >
                  Back to dashboard
                </button>
              </div>
            ) : (
              <ProviderOnboarding
                onComplete={(s) => setOnboarded(s.name)}
              />
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2">
              {(["all", "shelter", "school", "pto"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  aria-pressed={kindFilter === k}
                  className={`rounded-full px-4 py-2 text-xs font-black ${
                    kindFilter === k ? "bg-tt-navy text-white" : "bg-tt-paper text-tt-ink-soft border border-tt-line"
                  }`}
                >
                  {k === "all" ? "All" : `${PROVIDER_KIND_EMOJI[k]} ${PROVIDER_KIND_LABELS[k]}`}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {filtered.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>

            <div className="mt-8 rounded-3xl bg-tt-night p-6 text-white">
              <h2 className="text-lg font-black">What you can (and can&apos;t) see</h2>
              <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-white/90">
                <li>✅ Your ladder&apos;s rung completions — how many families finished each level</li>
                <li>✅ Upcoming visits and events you&apos;ve scheduled</li>
                <li>✅ Artifacts families chose to share with you (approved by the parent)</li>
                <li>🚫 Never individual trait scores or home behavior — that&apos;s the family&apos;s private world</li>
                <li>🚫 Never a child&apos;s data without the parent&apos;s explicit consent — default-deny, always</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ProviderCard({ provider }: { provider: MissionProvider }) {
  const [expanded, setExpanded] = useState(false);
  const totalTasks = provider.ladders.reduce(
    (a, l) => a + l.levels.reduce((b, lv) => b + lv.tasks.length, 0),
    0,
  );
  return (
    <div className="rounded-3xl border border-tt-line bg-tt-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-tt-pine">
            {PROVIDER_KIND_EMOJI[provider.kind]} {PROVIDER_KIND_LABELS[provider.kind]}
          </p>
          <h3 className="mt-1 text-lg font-black text-tt-ink">{provider.name}</h3>
          <p className="mt-0.5 text-xs font-semibold text-tt-ink-faint">
            📍 {provider.location} · {provider.ladders.length} {provider.ladders.length === 1 ? "ladder" : "ladders"} · {totalTasks} missions
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-xl border border-tt-line px-3 py-1.5 text-xs font-black text-tt-pine"
        >
          {expanded ? "Hide ladders" : "View ladders"}
        </button>
      </div>
      {expanded && (
        <div className="mt-4 space-y-3">
          {provider.ladders.map((ladder) => (
            <div key={ladder.id} className="rounded-2xl bg-tt-cream p-4">
              <p className="text-sm font-black text-tt-ink">{ladder.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-tt-ink-soft">{ladder.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ladder.levels.map((level) => (
                  <span
                    key={level.id}
                    className="rounded-full bg-tt-paper border border-tt-line px-3 py-1 text-[11px] font-bold text-tt-ink"
                  >
                    Rung {level.rung}: {level.name} · {level.tasks.length} missions
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button className="flex-1 rounded-2xl bg-tt-pine px-4 py-2.5 text-xs font-black text-white">
              📅 Schedule a visit
            </button>
            <button className="flex-1 rounded-2xl border border-tt-line px-4 py-2.5 text-xs font-black text-tt-ink">
              ✍️ Pending sign-offs (0)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
