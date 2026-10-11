"use client";

import { useEffect, useRef, useState } from "react";
import { playdateStore, playdateClaimUrl } from "@/lib/playdate-store";
import { parseFreeDates, presetLabel } from "@/lib/playdate-voice";
import type { Child } from "@/lib/types";

/**
 * PlaydateQuickCreate — set up a playdate in under 60 seconds.
 *
 * Voice-first, photo-first:
 *   1. Pick your kid (photo)
 *   2. Say when you're free ("Saturday morning") — or tap up to 3 presets
 *   3. Send the link (device share sheet) or copy it
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

/** Minimal shape of the Web Speech API recognition object we use. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult:
    | ((e: {
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

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
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const recogRef = useRef<{ stop: () => void } | null>(null);

  const kid = children.find((c) => c.id === kidId);
  const kidFirst = kid?.name.split(" ")[0] ?? "your kid";

  const SpeechCtor =
    typeof window !== "undefined"
    ? (window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      })
    : undefined;
  const voiceSupported = Boolean(SpeechCtor?.SpeechRecognition || SpeechCtor?.webkitSpeechRecognition);

  useEffect(() => {
    return () => {
      try {
        recogRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  function toggleTime(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 3)));
  }

  async function create(ids: string[] = picked) {
    if (!kidId || ids.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const slots = ids.map((pid) => {
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
    setHeard("");
    setVoiceNote("");
  }

  /** Voice input: parent says when they're free, we parse it and make the invite. */
  function startVoice() {
    const Ctor = SpeechCtor?.SpeechRecognition ?? SpeechCtor?.webkitSpeechRecognition;
    if (!Ctor || !kidId || busy) return;
    setVoiceNote("");
    setHeard("");
    setError("");
    const recog: SpeechRecognitionLike = new Ctor();
    recog.lang = "en-US";
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    let finalTranscript = "";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalTranscript += `${t} `;
        else interim += t;
      }
      setHeard((finalTranscript + interim).trim());
    };
    recog.onerror = (e) => {
      setListening(false);
      setVoiceNote(
        e?.error === "not-allowed"
          ? "Microphone is blocked — tap the times below instead, or allow mic access and try again."
          : "Didn't catch that — try again, or tap the times below.",
      );
    };
    recog.onend = () => {
      setListening(false);
      const said = finalTranscript.trim();
      if (!said) {
        setVoiceNote("Didn't hear anything — try again, or tap the times below.");
        return;
      }
      const ids = parseFreeDates(said);
      if (ids.length === 0) {
        setVoiceNote(`Heard "${said}" — try something like "Saturday morning" or "Sunday afternoon".`);
        return;
      }
      setPicked(ids);
      setVoiceNote(`Got it: ${ids.map((id) => presetLabel(id as Parameters<typeof presetLabel>[0])).join(", ")} — making your invite…`);
      void create(ids);
    };
    try {
      recog.start();
    } catch {
      setListening(false);
      return;
    }
    setListening(true);
    recogRef.current = recog;
  }

  /** Send the invite link via the device share sheet (SMS, WhatsApp, …); falls back to copy. */
  async function shareLink() {
    if (!inviteUrl) return;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    const data: ShareData = {
      title: "Playdate invite",
      text: `Playdate with ${kidFirst} — pick a time that works for you:`,
      url: inviteUrl,
    };
    if (nav.share && (!nav.canShare || nav.canShare(data))) {
      try {
        await nav.share(data);
        return;
      } catch {
        /* user dismissed the sheet or share failed — fall through to copy */
      }
    }
    copy();
  }

  const canNativeShare =
    typeof navigator !== "undefined" &&
    "share" in navigator;

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

          {/* Step 2: when — voice first, tap as fallback */}
          <p className="mt-4 text-sm font-black text-tt-ink">2. When are you free?</p>
          {voiceSupported ? (
            <div className="mt-2">
              <button
                onClick={startVoice}
                disabled={listening || busy || !kidId}
                className="tt-btn-press flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-tt-navy px-6 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                <span aria-hidden="true" className={listening ? "animate-pulse" : ""}>
                  🎤
                </span>
                {listening ? "Listening… speak now" : "Say when you're free"}
              </button>
              <p className="mt-1 text-center text-xs font-semibold text-tt-ink-faint">
                Try: &ldquo;Saturday morning&rdquo; or &ldquo;Sunday afternoon&rdquo;
              </p>
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-tt-cream p-3 text-xs font-semibold text-tt-ink-soft">
              Voice input isn&rsquo;t supported in this browser — tap the times below instead.
            </p>
          )}
          {(heard || voiceNote) && (
            <div aria-live="polite" className="mt-2 rounded-xl bg-tt-cream p-3">
              {heard && <p className="text-sm font-bold text-tt-ink">&ldquo;{heard}&rdquo;</p>}
              {voiceNote && <p className="mt-1 text-xs font-semibold text-tt-ink-soft">{voiceNote}</p>}
            </div>
          )}

          <p className="mt-3 text-xs font-black uppercase tracking-wider text-tt-ink-faint">
            or tap up to 3
          </p>
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
            onClick={() => create()}
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
          {canNativeShare && (
            <button
              onClick={shareLink}
              className="tt-btn-press mt-2 min-h-12 w-full rounded-2xl bg-tt-navy px-6 py-3 text-sm font-black text-white"
            >
              📤 Send link to the other parent
            </button>
          )}
          <button onClick={reset} className="mt-3 text-sm font-bold text-tt-ink-faint underline">
            Make another invite
          </button>
        </>
      )}
    </section>
  );
}
