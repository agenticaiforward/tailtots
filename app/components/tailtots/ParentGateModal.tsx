type ParentGateModalProps = {
  open: boolean;
  draft: string;
  setDraft: (value: string) => void;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Parental gate shown before entering parent mode (parent demo, role toggle,
 * parent home). Verifies the family's parent passcode; the passcode is never
 * displayed on screen. This is a UI-level gate, not a security boundary —
 * real enforcement must live server-side (Supabase Auth + RLS).
 */
export function ParentGateModal({ open, draft, setDraft, error, onConfirm, onClose }: ParentGateModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17231f]/60 p-4" role="dialog" aria-modal="true" aria-label="Parent verification">
      <form
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">For parents</p>
        <h2 className="mt-2 text-2xl font-black text-[#17231f]">Parent check</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-[#5f6a65]">
          Enter your family&apos;s parent passcode to continue. You can change it anytime in Family Setup.
        </p>
        <label className="mt-4 block text-sm font-black text-[#25352f]">
          Parent passcode
          <input
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="••••"
            aria-label="Parent passcode"
          />
        </label>
        {error && (
          <p className="mt-2 text-sm font-bold text-[#b3261e]" role="alert">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            className="min-h-12 flex-1 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white"
          >
            Unlock
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 rounded-lg border border-[#ded8c7] bg-white px-5 py-3 text-sm font-black text-[#25352f]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
