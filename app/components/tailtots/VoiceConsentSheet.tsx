"use client";

import { useState } from "react";
import { detectTranscriptionPath, transcriptionPathLabel } from "@/lib/privacy/consent";

/**
 * Voice consent sheet — shown BEFORE the mic is ever enabled.
 *
 * This is a parental gate + consent record, not just a gate:
 * - Explains exactly what happens to the child's voice (real,
 *   browser-detected transcription path — including the Chrome→Google
 *   disclosure when applicable).
 * - Requires an explicit checkbox for voice collection.
 * - Carries a SEPARATE, unchecked-by-default marketing opt-in (COPPA 2024:
 *   marketing consent may never be bundled with collection consent).
 * - Confirmed with the family parent passcode so a child can't self-approve.
 *
 * PRODUCTION: replace the passcode check with a verifiable-parental-consent
 * vendor (PRIVO / credit-card / KBA) before launch with real families.
 */
export function VoiceConsentSheet({
  open,
  childName,
  expectedPasscode,
  onGrant,
  onClose,
}: {
  open: boolean;
  childName: string;
  /** Family parent passcode — compared locally; never displayed. */
  expectedPasscode: string;
  /** (voiceGranted, marketingGranted) */
  onGrant: (voiceGranted: boolean, marketingGranted: boolean) => void;
  onClose: () => void;
}) {
  const [voiceChecked, setVoiceChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const path = detectTranscriptionPath();

  if (!open) return null;

  const submit = () => {
    if (!voiceChecked) {
      setError("Please check the voice permission box to enable the mic — or tap Not now.");
      return;
    }
    if (expectedPasscode && passcode !== expectedPasscode) {
      setError("That passcode doesn't match. Ask a parent to enter it.");
      return;
    }
    onGrant(true, marketingChecked);
    setPasscode("");
    setError("");
    setVoiceChecked(false);
    setMarketingChecked(false);
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17231f]/60 p-4" role="dialog" aria-modal="true" aria-label="Voice permission">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">For parents · permission needed</p>
        <h2 className="mt-2 text-2xl font-black text-tt-ink">🎤 Voice for {childName}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
          Voice lets {childName} talk to TailTots — give commands (“put $2 in the save jar”) and play
          quiz games. A parent must approve before the mic turns on.
        </p>

        <div className="mt-4 rounded-2xl bg-tt-cream/70 p-4 text-sm font-semibold leading-6 text-tt-ink-soft">
          <p className="font-black text-tt-ink">What happens to your child&apos;s voice</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>{transcriptionPathLabel(path)}</li>
            <li>Spoken replies are read aloud by your device&apos;s speech system. On some browsers (like Chrome) the text being spoken may be sent to Google for voice synthesis.</li>
            <li>Transcripts are used only to understand the request or score a quiz answer, then discarded. We never store transcripts or audio recordings — there is nothing of TailTots&apos; to delete later.</li>
            <li>Voice is never used for advertising, and never shared with sponsors.</li>
            <li>You can turn voice off anytime in Family Setup — this removes the voice permission immediately.</li>
          </ul>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-tt-pine/40 bg-tt-pine-tint/40 p-4">
          <input
            type="checkbox"
            checked={voiceChecked}
            onChange={(e) => setVoiceChecked(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-[#165a4b]"
          />
          <span className="text-sm font-bold leading-6 text-tt-ink">
            I&apos;m the parent/guardian and I allow TailTots to collect {childName}&apos;s voice as
            described above. <span className="font-semibold text-tt-ink-soft">(Required for voice)</span>
          </span>
        </label>

        <div className="mt-3 rounded-2xl border border-dashed border-tt-line p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-tt-ink-soft">Separate · optional · parent only</p>
          <label className="mt-2 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketingChecked}
              onChange={(e) => setMarketingChecked(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-[#7a4b12]"
            />
            <span className="text-sm font-semibold leading-6 text-tt-ink-soft">
              Also send <strong className="text-tt-ink">me (the parent, never {childName})</strong> occasional
              recommendations — animal shelters, schools, kid products — matched to our family&apos;s interests.
              I can turn this off anytime; it never affects {childName}&apos;s app.
            </span>
          </label>
        </div>

        {expectedPasscode ? (
          <label className="mt-4 block text-sm font-black text-tt-ink">
            Parent passcode
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••"
              aria-label="Parent passcode"
              className="mt-2 w-full rounded-xl border border-tt-line px-4 py-3 text-base font-semibold tracking-[0.3em]"
            />
          </label>
        ) : null}

        {error && <p className="mt-2 text-sm font-bold text-[#b3261e]" role="alert">{error}</p>}

        <div className="mt-5 flex gap-3">
          <button
            onClick={submit}
            className="min-h-12 flex-1 rounded-xl bg-tt-pine px-5 py-3 text-sm font-black text-white"
          >
            Enable voice
          </button>
          <button
            onClick={() => { setError(""); setPasscode(""); onClose(); }}
            className="min-h-12 rounded-xl border border-tt-line px-5 py-3 text-sm font-black text-tt-ink"
          >
            Not now
          </button>
        </div>
        <p className="mt-3 text-center text-xs font-semibold text-tt-ink-soft">
          COPPA: a child&apos;s voice counts as personal information. This permission is recorded with its date.
        </p>
      </div>
    </div>
  );
}
