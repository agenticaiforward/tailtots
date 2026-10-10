"use client";

/**
 * ProviderOnboarding — the charter-model signup for shelters, schools, PTOs.
 *
 * The org supplies: name, kind, contact, needs checklist.
 * The platform supplies: a draft skill ladder (template-based, deterministic),
 * which the org reviews and edits. NOTHING auto-publishes — the org approves
 * every task before it becomes a mission.
 *
 * COPPA note: orgs never get child accounts. They see ladder progress and
 * gatekeeper-approved artifacts only, never raw behavioral data.
 */
import { useMemo, useState } from "react";
import {
  PROVIDER_KINDS,
  PROVIDER_KIND_EMOJI,
  PROVIDER_KIND_LABELS,
  PROVIDER_NEEDS,
  draftLadderFromNeeds,
  type ProviderKind,
  type SkillLadder,
} from "../../../lib/ecosystem/providers";

type Step = "kind" | "details" | "needs" | "review";

const KIND_BLURBS: Record<ProviderKind, string> = {
  shelter: "Turn visits into volunteer missions. Kids earn kindness badges through real work with your animals.",
  school: "Classroom kindness missions, assigned by teachers. Aligned with the character traits families practice at home.",
  pto: "Family volunteer missions at your events. Give parents something meaningful to show up for.",
};

export default function ProviderOnboarding({
  onComplete,
}: {
  onComplete?: (summary: { kind: ProviderKind; name: string; email: string; ladder: SkillLadder }) => void;
}) {
  const [step, setStep] = useState<Step>("kind");
  const [kind, setKind] = useState<ProviderKind | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [needs, setNeeds] = useState<string[]>([]);

  const draft = useMemo(
    () => (kind && name ? draftLadderFromNeeds(kind, name, needs) : null),
    [kind, name, needs],
  );

  const canNextDetails = name.trim().length >= 2 && /.+@.+\..+/.test(email);
  const emailValid = email === "" || /.+@.+\..+/.test(email);

  function toggleNeed(need: string) {
    setNeeds((prev) => (prev.includes(need) ? prev.filter((n) => n !== need) : [...prev, need]));
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-tt-line bg-tt-paper p-6 shadow-sm">
      {/* progress */}
      <div className="mb-6 flex gap-2" aria-hidden="true">
        {(["kind", "details", "needs", "review"] as Step[]).map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${
              (["kind", "details", "needs", "review"] as Step[]).indexOf(s) <=
              (["kind", "details", "needs", "review"] as Step[]).indexOf(step)
                ? "bg-tt-pine"
                : "bg-tt-line"
            }`}
          />
        ))}
      </div>

      {step === "kind" && (
        <div>
          <h2 className="text-2xl font-black text-tt-ink">What kind of organization are you?</h2>
          <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
            You bring the place, the people, and the real work. We bring the kits, the records, and the families.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {PROVIDER_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-2xl border-2 p-4 text-left transition-transform hover:scale-[1.02] ${
                  kind === k ? "border-tt-pine bg-tt-pine-tint/30" : "border-tt-line bg-tt-cream"
                }`}
              >
                <p className="text-3xl" aria-hidden="true">{PROVIDER_KIND_EMOJI[k]}</p>
                <p className="mt-2 text-sm font-black text-tt-ink">{PROVIDER_KIND_LABELS[k]}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">{KIND_BLURBS[k]}</p>
              </button>
            ))}
          </div>
          <button
            disabled={!kind}
            onClick={() => setStep("details")}
            className="tt-btn-press mt-5 w-full rounded-2xl bg-tt-pine px-6 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      )}

      {step === "details" && kind && (
        <div>
          <h2 className="text-2xl font-black text-tt-ink">Tell us about {PROVIDER_KIND_LABELS[kind].toLowerCase()}</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-sm font-extrabold text-tt-ink">Organization name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunny Acres Animal Shelter"
                className="mt-1 w-full rounded-xl border border-tt-line bg-tt-cream px-4 py-3 text-sm font-semibold text-tt-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm font-extrabold text-tt-ink">Contact email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="volunteer@example.org"
                type="email"
                className="mt-1 w-full rounded-xl border border-tt-line bg-tt-cream px-4 py-3 text-sm font-semibold text-tt-ink"
              />
              {!emailValid && <p className="mt-1 text-xs font-bold text-red-600">That email doesn&apos;t look right yet.</p>}
            </label>
            <label className="block">
              <span className="text-sm font-extrabold text-tt-ink">Where does the work happen?</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 123 Main St, or “on campus”"
                className="mt-1 w-full rounded-xl border border-tt-line bg-tt-cream px-4 py-3 text-sm font-semibold text-tt-ink"
              />
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep("kind")} className="rounded-2xl border border-tt-line px-5 py-3 text-sm font-black text-tt-ink-soft">
              ← Back
            </button>
            <button
              disabled={!canNextDetails}
              onClick={() => setStep("needs")}
              className="tt-btn-press flex-1 rounded-2xl bg-tt-pine px-6 py-3 text-sm font-black text-white disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === "needs" && kind && (
        <div>
          <h2 className="text-2xl font-black text-tt-ink">What do you need help with?</h2>
          <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
            Pick everything that applies. We&apos;ll draft a starter skill ladder from your picks — you review every task before anything goes live.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PROVIDER_NEEDS[kind].map((need) => (
              <button
                key={need}
                onClick={() => toggleNeed(need)}
                aria-pressed={needs.includes(need)}
                className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                  needs.includes(need)
                    ? "border-tt-pine bg-tt-pine text-white"
                    : "border-tt-line bg-tt-cream text-tt-ink"
                }`}
              >
                {needs.includes(need) ? "✓ " : ""}{need}
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep("details")} className="rounded-2xl border border-tt-line px-5 py-3 text-sm font-black text-tt-ink-soft">
              ← Back
            </button>
            <button
              onClick={() => setStep("review")}
              className="tt-btn-press flex-1 rounded-2xl bg-tt-pine px-6 py-3 text-sm font-black text-white"
            >
              {needs.length > 0 ? "Draft my ladder →" : "Skip — show me the full template →"}
            </button>
          </div>
        </div>
      )}

      {step === "review" && kind && draft && (
        <div>
          <h2 className="text-2xl font-black text-tt-ink">Your draft ladder</h2>
          <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
            {draft.description}
          </p>
          <div className="mt-4 space-y-4">
            {draft.levels.map((level) => (
              <div key={level.id} className="rounded-2xl border border-tt-line bg-tt-cream p-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-black text-tt-ink">
                    Rung {level.rung}: {level.name}
                  </p>
                  <p className="text-xs font-bold text-tt-ink-faint">
                    Ages {level.minAge}–{level.maxAge}
                  </p>
                </div>
                <p className="mt-1 text-xs font-semibold text-tt-ink-soft">🔓 {level.unlockRule}</p>
                <ul className="mt-2 space-y-2">
                  {level.tasks.map((t) => (
                    <li key={t.id} className="rounded-xl bg-tt-paper p-3">
                      <p className="text-sm font-extrabold text-tt-ink">{t.title}</p>
                      <p className="mt-0.5 text-xs font-semibold leading-5 text-tt-ink-soft">{t.prompt}</p>
                      <p className="mt-1 text-[11px] font-bold text-tt-ink-faint">
                        ⏱ {t.minutes} min · {t.skillTags.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-tt-sun/20 p-4">
            <p className="text-xs font-bold leading-5 text-tt-ink">
              🛡 Nothing publishes automatically. A TailTots partner specialist reviews your draft with you,
              and every task needs your sign-off. Families see only what you approve.
            </p>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep("needs")} className="rounded-2xl border border-tt-line px-5 py-3 text-sm font-black text-tt-ink-soft">
              ← Back
            </button>
            <button
              onClick={() => onComplete?.({ kind, name: name.trim(), email: email.trim(), ladder: draft })}
              className="tt-btn-press flex-1 rounded-2xl bg-tt-pine px-6 py-3 text-sm font-black text-white"
            >
              Submit for review →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
