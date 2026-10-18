/**
 * RealLifeLog — picture-first logging of real life for character teaching.
 *
 * Kids tap a big picture card (book, chore, kind act, skill), type or dictate
 * the title, and it's logged. The AI mission engine then REFERENCES these real
 * experiences when teaching traits ("you finished 'Charlotte's Web' — that's
 * perseverance like Wilbur") and ASKS reflective wonder questions about them.
 *
 * First session: no entries yet, AI generates purely on its own.
 * After logging: AI weaves real life into every mission and insight.
 */
"use client";

import { useState } from "react";
import type { RealLifeEntry } from "../../lib/types";

const KINDS = [
  {
    kind: "book" as const,
    emoji: "📚",
    label: "I read a book",
    placeholder: "Book title…",
    hint: "What was it called?",
    color: "from-sky-100 to-blue-200",
    ring: "ring-sky-300",
  },
  {
    kind: "chore" as const,
    emoji: "🧹",
    label: "I did a chore",
    placeholder: "What did you do?…",
    hint: "e.g. folded laundry, fed the dog",
    color: "from-amber-100 to-orange-200",
    ring: "ring-amber-300",
  },
  {
    kind: "kind-act" as const,
    emoji: "💛",
    label: "I was kind",
    placeholder: "What kind thing?…",
    hint: "e.g. shared toys, helped a friend",
    color: "from-rose-100 to-pink-200",
    ring: "ring-rose-300",
  },
  {
    kind: "skill" as const,
    emoji: "⭐",
    label: "I practiced",
    placeholder: "What did you practice?…",
    hint: "e.g. piano, soccer, drawing",
    color: "from-violet-100 to-purple-200",
    ring: "ring-violet-300",
  },
];

const KIND_META: Record<RealLifeEntry["kind"], { emoji: string; label: string }> = {
  book: { emoji: "📚", label: "Read" },
  chore: { emoji: "🧹", label: "Chore" },
  "kind-act": { emoji: "💛", label: "Kind act" },
  skill: { emoji: "⭐", label: "Practiced" },
  reflection: { emoji: "💬", label: "Reflection" },
};

export default function RealLifeLog({
  childName,
  entries,
  onAdd,
}: {
  childName: string;
  entries: RealLifeEntry[];
  onAdd: (kind: RealLifeEntry["kind"], title: string, detail?: string) => void;
}) {
  const [activeKind, setActiveKind] = useState<RealLifeEntry["kind"] | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [justLogged, setJustLogged] = useState<string | null>(null);

  const active = KINDS.find((k) => k.kind === activeKind);

  function submit() {
    if (!activeKind || !title.trim()) return;
    onAdd(activeKind, title.trim(), detail.trim() || undefined);
    setJustLogged(title.trim());
    setTitle("");
    setDetail("");
    setActiveKind(null);
    setTimeout(() => setJustLogged(null), 2500);
  }

  return (
    <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌟</span>
        <div>
          <h3 className="text-base font-black text-tt-ink">My Real Life</h3>
          <p className="text-xs text-tt-ink/60">
            {childName}'s real adventures power their character missions
          </p>
        </div>
      </div>

      {/* Celebration */}
      {justLogged && (
        <div className="tt-animate-pop-in mt-3 rounded-2xl bg-gradient-to-r from-amber-100 to-yellow-200 p-3 text-center ring-2 ring-amber-300">
          <div className="text-2xl">🎉</div>
          <p className="text-sm font-black text-tt-ink">Logged! "{justLogged}"</p>
          <p className="text-xs text-tt-ink/70">The AI will use this to teach character</p>
        </div>
      )}

      {/* Picture-first kind picker */}
      {!activeKind ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => setActiveKind(k.kind)}
              className={`tt-btn-press group rounded-2xl bg-gradient-to-br ${k.color} p-3 text-center ring-2 ${k.ring} transition-transform hover:scale-105`}
            >
              <div className="text-4xl transition-transform group-hover:scale-125 group-hover:-rotate-6">
                {k.emoji}
              </div>
              <div className="mt-1 text-xs font-black text-tt-ink">{k.label}</div>
            </button>
          ))}
        </div>
      ) : (
        active && (
          <div className={`tt-animate-pop-in mt-3 rounded-2xl bg-gradient-to-br ${active.color} p-4 ring-2 ${active.ring}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{active.emoji}</span>
                <span className="text-sm font-black text-tt-ink">{active.label}</span>
              </div>
              <button
                onClick={() => { setActiveKind(null); setTitle(""); setDetail(""); }}
                className="tt-btn-press rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-tt-ink"
              >
                ✕
              </button>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={active.placeholder}
              className="mt-3 w-full rounded-xl border-2 border-white/60 bg-white/90 px-4 py-3 text-base font-bold text-tt-ink placeholder:text-tt-ink/40 focus:border-tt-pine focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <p className="mt-1 px-1 text-xs text-tt-ink/60">{active.hint}</p>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Extra detail (optional)…"
              className="mt-2 w-full rounded-xl border-2 border-white/60 bg-white/70 px-4 py-2.5 text-sm text-tt-ink placeholder:text-tt-ink/40 focus:border-tt-pine focus:outline-none"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button
              onClick={submit}
              disabled={!title.trim()}
              className="tt-btn-press mt-3 w-full rounded-xl bg-tt-ink py-3 text-sm font-black text-white shadow-lg disabled:opacity-40"
            >
              Log it! ✨
            </button>
          </div>
        )
      )}

      {/* Recent entries — visual timeline */}
      {entries.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-wider text-tt-ink/50">
            Recent adventures
          </p>
          <div className="mt-2 space-y-2">
            {entries.slice(0, 5).map((entry) => {
              const meta = KIND_META[entry.kind];
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-2xl bg-tt-cream/60 p-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-xl shadow-sm">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-tt-ink">
                      {entry.title}
                    </p>
                    <p className="text-xs text-tt-ink/60">
                      {meta.label}
                      {entry.detail ? ` · ${entry.detail}` : ""} · {entry.date}
                    </p>
                    {entry.wonderQuestion && (
                      <p className="mt-1 rounded-xl bg-violet-50 p-2 text-xs italic text-violet-900 ring-1 ring-violet-200">
                        💭 {entry.wonderQuestion}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {entries.length === 0 && !activeKind && (
        <p className="mt-3 rounded-2xl bg-tt-cream/60 p-3 text-center text-xs text-tt-ink/60">
          Nothing logged yet — tap a picture above to add {childName}'s first real adventure.
          The AI teaches character from these real moments.
        </p>
      )}
    </div>
  );
}
