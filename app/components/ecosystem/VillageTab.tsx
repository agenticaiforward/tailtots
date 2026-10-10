"use client";

/**
 * VillageTab — the parent's window into school and community contexts.
 *
 * Shows ONLY gatekeeper-approved artifacts that the parent has consented to
 * share across contexts. Default-deny: no grant, no artifacts. The tab also
 * surfaces the consent controls themselves — the parent sees exactly what
 * flows where, and can revoke with one tap.
 *
 * "It takes a village" — made visible, and governed.
 */
import { useState } from "react";
import {
  ARTIFACT_TYPE_EMOJI,
  ECO_CONTEXT_LABELS,
  activeGrantsForChild,
  missingConsentDirections,
  revokeConsent,
  visibleArtifacts,
  type ConsentGrant,
  type EcoArtifact,
  type EcoContext,
} from "../../../lib/ecosystem";

export interface VillageTabProps {
  childId: string;
  childName: string;
  artifacts: EcoArtifact[];
  grants: ConsentGrant[];
  onGrantChange: (grants: ConsentGrant[]) => void;
}

const CONTEXT_EMOJI: Record<EcoContext, string> = {
  home: "🏠",
  school: "🏫",
  community: "🌳",
};

export default function VillageTab({ childId, childName, artifacts, grants, onGrantChange }: VillageTabProps) {
  const [revoking, setRevoking] = useState<string | null>(null);

  const active = activeGrantsForChild(grants, childId);
  const schoolArtifacts = visibleArtifacts(artifacts, childId, "school", grants).filter((a) => a.context !== "home");
  const communityArtifacts = visibleArtifacts(artifacts, childId, "community", grants).filter((a) => a.context !== "home");
  // What the parent sees here: artifacts from other contexts shared INTO home.
  const villageFeed = visibleArtifacts(artifacts, childId, "home", grants).filter((a) => a.context !== "home");

  const missing = missingConsentDirections(grants, childId, "artifacts");

  function revoke(grantId: string) {
    setRevoking(grantId);
    // Revocation is immediate and total.
    setTimeout(() => {
      onGrantChange(revokeConsent(grants, grantId));
      setRevoking(null);
    }, 150);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="text-center">
        <p className="text-4xl" aria-hidden="true">🏘️</p>
        <h2 className="mt-2 text-2xl font-black text-tt-ink">{childName}&apos;s village</h2>
        <p className="mx-auto mt-1 max-w-md text-sm font-semibold leading-6 text-tt-ink-soft">
          Moments from school and the community — shared here only with your permission,
          approved by a grown-up on the other side.
        </p>
      </div>

      {/* Village feed */}
      {villageFeed.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-tt-line bg-tt-cream p-8 text-center">
          <p className="text-3xl" aria-hidden="true">🌱</p>
          <p className="mt-2 text-sm font-black text-tt-ink">Nothing shared yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold leading-5 text-tt-ink-soft">
            When {childName}&apos;s teacher or a community partner shares an approved moment and
            you&apos;ve allowed it below, it&apos;ll bloom here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {villageFeed.map((a) => (
            <article key={a.id} className="overflow-hidden rounded-2xl border border-tt-line bg-tt-paper shadow-sm">
              {a.mediaUrl && (
                <img src={a.mediaUrl} alt={a.caption} className="aspect-video w-full object-cover" loading="lazy" />
              )}
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-widest text-tt-pine">
                  {ARTIFACT_TYPE_EMOJI[a.type]} {CONTEXT_EMOJI[a.context]} {ECO_CONTEXT_LABELS[a.context]}
                </p>
                <p className="mt-1 text-sm font-extrabold text-tt-ink">{a.caption}</p>
                {a.body && <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">{a.body}</p>}
                {a.traitTags && a.traitTags.length > 0 && (
                  <p className="mt-2 text-[11px] font-bold text-tt-ink-faint">
                    💪 Strengths: {a.traitTags.join(", ")}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Consent controls — governance is the product */}
      <section className="rounded-3xl border border-tt-line bg-tt-paper p-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-tt-pine">What flows where</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">
          You&apos;re the gatekeeper. Nothing crosses between home, school, and community without your explicit yes —
          and you can take it back anytime. Revoking is immediate.
        </p>

        {active.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-tt-cream p-3 text-xs font-bold text-tt-ink-soft">
            🔒 Default-deny is on: nothing is shared between contexts right now.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-2xl bg-tt-cream p-3">
                <p className="text-xs font-bold text-tt-ink">
                  {CONTEXT_EMOJI[g.fromContext]} {ECO_CONTEXT_LABELS[g.fromContext]}
                  {" → "}
                  {CONTEXT_EMOJI[g.toContext]} {ECO_CONTEXT_LABELS[g.toContext]}
                  <span className="ml-1 font-semibold text-tt-ink-faint">
                    ({g.scope.join(", ")})
                  </span>
                </p>
                <button
                  onClick={() => revoke(g.id)}
                  disabled={revoking === g.id}
                  className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-600 disabled:opacity-50"
                >
                  {revoking === g.id ? "Revoking…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {missing.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-black text-tt-pine">
              {missing.length} directions not shared — see which
            </summary>
            <ul className="mt-2 space-y-1">
              {missing.map((m, i) => (
                <li key={i} className="text-xs font-semibold text-tt-ink-faint">
                  🔒 {ECO_CONTEXT_LABELS[m.from]} → {ECO_CONTEXT_LABELS[m.to]}: not shared
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Counts for transparency */}
        <p className="mt-3 text-[11px] font-semibold text-tt-ink-faint">
          📸 {schoolArtifacts.length} school {schoolArtifacts.length === 1 ? "moment" : "moments"} visible to you ·{" "}
          🌳 {communityArtifacts.length} community {communityArtifacts.length === 1 ? "moment" : "moments"} visible to you
        </p>
      </section>
    </div>
  );
}
