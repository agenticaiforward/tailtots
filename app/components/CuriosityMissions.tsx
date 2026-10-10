/**
 * CuriosityMissions — Wonder + Listening missions for kids.
 *
 * Future-skills trio, part 1: ASK GOOD QUESTIONS.
 *  - WonderMission: "Ask a grown-up 3 WHY questions about [topic]"
 *  - ListeningMission: "Listen for 2 minutes. Tell back what you heard."
 *
 * Lantern framing: invitations, never assignments. Kid self-reports with
 * pride; no parent gate needed for wondering (listening gets a parent
 * high-five because it involves another person).
 */
"use client";

import { useMemo, useState } from "react";
import type { Child } from "../../lib/types";
import { getAgeMode } from "./AgeMode";
import {
  listeningFor,
  wonderFor,
  type CuriosityAgeMode,
  type ListeningMission,
  type WonderMission,
} from "../../lib/ai/curiosity-missions";

const CURIOSITY_KEY = "tailtots-curiosity-v1";

interface CuriosityLog {
  childId: string;
  kind: "wonder" | "listen";
  missionId: string;
  at: string;
  note?: string;
}

function logCuriosity(entry: Omit<CuriosityLog, "at">) {
  try {
    const raw = localStorage.getItem(CURIOSITY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const all = (Array.isArray(arr) ? arr : [])
      .concat({ ...entry, at: new Date().toISOString() })
      .slice(-200);
    localStorage.setItem(CURIOSITY_KEY, JSON.stringify(all));
  } catch {
    /* best effort */
  }
}

/** Counts for the parent growth card. */
export function curiosityCountsFor(childId: string): { questions: number; listens: number } {
  if (typeof localStorage === "undefined") return { questions: 0, listens: 0 };
  try {
    const raw = localStorage.getItem(CURIOSITY_KEY);
    const arr: CuriosityLog[] = raw ? JSON.parse(raw) : [];
    const weekAgo = Date.now() - 7 * 86400000;
    const mine = (Array.isArray(arr) ? arr : []).filter(
      (e) => e.childId === childId && new Date(e.at).getTime() >= weekAgo
    );
    return {
      questions: mine.filter((e) => e.kind === "wonder").length,
      listens: mine.filter((e) => e.kind === "listen").length,
    };
  } catch {
    return { questions: 0, listens: 0 };
  }
}

function WonderCard({
  mission,
  child,
  onDone,
}: {
  mission: WonderMission;
  child: Child;
  onDone: () => void;
}) {
  const [asked, setAsked] = useState(false);
  const [askedCount, setAskedCount] = useState(0);

  const askOne = () => {
    const n = askedCount + 1;
    setAskedCount(n);
    if (n >= 3) {
      setAsked(true);
      logCuriosity({ childId: child.id, kind: "wonder", missionId: mission.id });
      onDone();
    }
  };

  if (asked) {
    return (
      <div className="rounded-3xl border border-[#22c55e]/40 bg-gradient-to-br from-[#f0fdf4] to-white p-5 text-center animate-[reward-pop_0.6s_ease-out]">
        <p className="text-5xl" aria-hidden="true">❓✨</p>
        <p className="mt-2 text-lg font-black text-[#17231f]">3 whys asked!</p>
        <p className="mx-auto mt-1 max-w-xs text-sm font-bold text-[#4f625b]">
          Questions are thinking out loud, {child.name}. Curiosity: leveled up! 🌱
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-[#f59e0b]/40 bg-gradient-to-br from-[#fffbeb] to-white p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b45309]">
        🔍 Wonder mission
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span className="text-4xl" aria-hidden="true">{mission.topicEmoji}</span>
        <p className="text-base font-bold leading-7 text-[#17231f]">{mission.prompt}</p>
      </div>
      <div className="mt-4">
        <p className="text-center text-sm font-black text-[#7a4b12]">
          Tap a star for each WHY you ask! ({askedCount}/3)
        </p>
        <div className="mt-2 flex justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              onClick={askOne}
              disabled={i < askedCount}
              aria-label={`I asked why number ${i + 1}`}
              className={`grid size-14 place-items-center rounded-full text-3xl transition-all ${
                i < askedCount
                  ? "scale-110 bg-[#f59e0b] shadow-lg"
                  : "bg-white ring-2 ring-dashed ring-[#fcd34d] hover:scale-110 hover:bg-[#fffbeb]"
              }`}
            >
              <span aria-hidden="true">{i < askedCount ? "⭐" : "☆"}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-xs text-center text-xs font-semibold text-[#a89bc4]">
        Silly questions count double. There&apos;s no wrong thing to wonder about. 💭
      </p>
    </div>
  );
}

function ListeningCard({
  mission,
  child,
  onDone,
}: {
  mission: ListeningMission;
  child: Child;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<"invite" | "listening" | "tellback" | "done">("invite");
  const [heard, setHeard] = useState("");
  const [seconds, setSeconds] = useState(0);

  const startListening = () => {
    setPhase("listening");
    const total = mission.durationMinutes * 60;
    const t0 = Date.now();
    const tick = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      setSeconds(Math.min(s, total));
      if (s >= total) {
        window.clearInterval(tick);
        setPhase("tellback");
      }
    }, 500);
  };

  const finish = () => {
    logCuriosity({ childId: child.id, kind: "listen", missionId: mission.id, note: heard.slice(0, 120) });
    setPhase("done");
    onDone();
  };

  if (phase === "done") {
    return (
      <div className="rounded-3xl border border-[#0ea5e9]/40 bg-gradient-to-br from-[#f0f9ff] to-white p-5 text-center animate-[reward-pop_0.6s_ease-out]">
        <p className="text-5xl" aria-hidden="true">👂💛</p>
        <p className="mt-2 text-lg font-black text-[#17231f]">Great listening, {child.name}!</p>
        <p className="mx-auto mt-1 max-w-xs text-sm font-bold text-[#4f625b]">
          Really hearing someone is one of the kindest things you can do.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-[#0ea5e9]/40 bg-gradient-to-br from-[#f0f9ff] to-white p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0284c7]">
        👂 Listening mission
      </p>
      {phase === "invite" && (
        <>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-4xl" aria-hidden="true">{mission.listenTargetEmoji}</span>
            <p className="text-base font-bold leading-7 text-[#17231f]">
              Listen to <span className="font-black">{mission.listenTarget}</span> for {mission.durationMinutes}{" "}
              minute{mission.durationMinutes === 1 ? "" : "s"}. Just listen — that&apos;s the whole mission.
            </p>
          </div>
          <button
            type="button"
            onClick={startListening}
            className="mt-4 w-full rounded-full bg-[#0284c7] px-6 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Start listening 👂
          </button>
        </>
      )}
      {phase === "listening" && (
        <div className="py-6 text-center">
          <span className="inline-block animate-[pet-wiggle_2s_ease-in-out_infinite] text-6xl" aria-hidden="true">
            👂
          </span>
          <p className="mt-3 text-lg font-black text-[#17231f]">Listening…</p>
          <div className="mx-auto mt-3 h-3 w-48 overflow-hidden rounded-full bg-[#bae6fd]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#38bdf8] transition-all duration-500"
              style={{ width: `${Math.min(100, (seconds / (mission.durationMinutes * 60)) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-bold text-[#8b7bb5]">No rush. Just ears open. 💛</p>
          <button
            type="button"
            onClick={() => setPhase("tellback")}
            className="mt-3 text-sm font-bold text-[#0284c7] underline decoration-dotted underline-offset-4"
          >
            Done listening early
          </button>
        </div>
      )}
      {phase === "tellback" && (
        <>
          <p className="mt-2 text-base font-black text-[#17231f]">🗣️ {mission.reflectPrompt}</p>
          <textarea
            value={heard}
            onChange={(e) => setHeard(e.target.value)}
            placeholder="I heard…"
            maxLength={200}
            rows={2}
            className="mt-3 w-full rounded-xl border-2 border-[#bae6fd] bg-white px-3 py-2.5 text-sm font-bold text-[#17231f] outline-none focus:border-[#0ea5e9]"
          />
          <button
            type="button"
            onClick={finish}
            className="mt-3 w-full rounded-full bg-[#17231f] px-6 py-3 text-base font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Tell it back! 🗣️✨
          </button>
          <p className="mx-auto mt-2 max-w-xs text-center text-xs font-semibold text-[#a89bc4]">
            Telling back what you heard proves you really listened. That&apos;s empathy in action. 💛
          </p>
        </>
      )}
    </div>
  );
}

export function CuriosityMissions({ child }: { child: Child }) {
  const mode = getAgeMode(child.age) as CuriosityAgeMode;
  const [refresh, setRefresh] = useState(0);

  const wonders = useMemo(() => wonderFor(mode), [mode]);
  const listens = useMemo(() => listeningFor(mode), [mode]);
  const wonder = wonders[refresh % Math.max(1, wonders.length)];
  const listen = listens[refresh % Math.max(1, listens.length)];

  const bump = () => setRefresh((r) => r + 1);

  if (!wonder && !listen) return null;

  return (
    <div className="mt-4 grid gap-4">
      {wonder && <WonderCard mission={wonder} child={child} onDone={bump} />}
      {listen && <ListeningCard mission={listen} child={child} onDone={bump} />}
    </div>
  );
}
