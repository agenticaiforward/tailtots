/**
 * ChoiceAdventureSpot — the kid-view home for Choice Adventures.
 *
 * Picks an unplayed seed scenario for the child's age mode, renders the
 * full adventure flow (invite → story → outcome → rewind → journal → done),
 * and persists playthroughs to localStorage for the parent's growth card.
 *
 * Lantern, not leash: skipping an adventure is invisible. Dismissed
 * invitations simply don't come back this session — no tracking, no guilt.
 */
"use client";

import { useCallback, useMemo, useState } from "react";
import type { Child } from "../../lib/types";
import { getAgeMode } from "./AgeMode";
import {
  seedScenariosFor,
  type ChoiceAgeMode,
  type ChoiceEvent,
  type ChoiceScenario,
} from "../../lib/ai/choice-adventures";
import { ChoiceAdventure, type AdventurePlaythrough } from "./ChoiceAdventure";
import type { JournalEntry } from "./DecisionJournal";

const STORAGE_KEY = "tailtots-choice-adventures-v1";

export interface StoredPlaythrough extends AdventurePlaythrough {
  childId: string;
  scenarioTitle: string;
  journal?: JournalEntry;
}

function loadPlaythroughs(): StoredPlaythrough[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function savePlaythrough(p: StoredPlaythrough) {
  try {
    const all = loadPlaythroughs();
    all.push(p);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(-100)));
  } catch {
    /* storage unavailable — adventure still completes in-memory */
  }
}

/** Playthroughs for the parent growth card (this week). */
export function playthroughsThisWeek(childId: string): StoredPlaythrough[] {
  if (typeof localStorage === "undefined") return [];
  const weekAgo = Date.now() - 7 * 86400000;
  return loadPlaythroughs().filter(
    (p) => p.childId === childId && new Date(p.completedAt).getTime() >= weekAgo
  );
}

/** Choice events for pattern detection (internal only). */
export function choiceEventsFor(childId: string): ChoiceEvent[] {
  return loadPlaythroughs()
    .filter((p) => p.childId === childId)
    .map((p) => ({
      scenarioId: p.scenarioId,
      choiceId: p.firstChoiceId,
      choiceArchetype: p.firstChoiceArchetype ?? "playful",
      decisionTimeMs: p.firstDecisionTimeMs,
      rewound: p.rewindCount > 0,
      pathsExplored: p.exploredChoiceIds.length,
      atMs: new Date(p.completedAt).getTime(),
    }));
}

/** Archetype counts for the kid-facing PatternSpotter. */
export function archetypeCountsFor(childId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of loadPlaythroughs().filter((x) => x.childId === childId)) {
    const a = p.firstChoiceArchetype ?? "playful";
    counts[a] = (counts[a] ?? 0) + 1;
  }
  return counts;
}

export function ChoiceAdventureSpot({ child }: { child: Child }) {
  const mode = getAgeMode(child.age) as ChoiceAgeMode;
  const [activeScenario, setActiveScenario] = useState<ChoiceScenario | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const available = useMemo(() => {
    const playedIds = new Set(loadPlaythroughs().filter((p) => p.childId === child.id).map((p) => p.scenarioId));
    const seeds = seedScenariosFor(mode).filter((s) => !playedIds.has(s.id));
    return seeds.length > 0 ? seeds : seedScenariosFor(mode); // replay when all played
  }, [mode, child.id, justCompleted]);

  const startAdventure = useCallback(() => {
    if (available.length === 0) return;
    // Rotate: pick the first unplayed (stable order = deterministic rotation)
    setActiveScenario(available[0]);
    setJustCompleted(false);
  }, [available]);

  const handleComplete = useCallback(
    (playthrough: AdventurePlaythrough) => {
      savePlaythrough({
        ...playthrough,
        childId: child.id,
        scenarioTitle: activeScenario?.title ?? "Choice Adventure",
      });
      setActiveScenario(null);
      setJustCompleted(true);
    },
    [child.id, activeScenario]
  );

  const handleSkip = useCallback(() => {
    // Invisible skip — lantern, not leash. Just hide for this session.
    setActiveScenario(null);
    setDismissed(true);
  }, []);

  if (dismissed && !activeScenario) return null;

  // Active adventure in progress
  if (activeScenario) {
    return (
      <div className="mt-4">
        <ChoiceAdventure
          scenario={activeScenario}
          ageMode={mode}
          childName={child.name}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    );
  }

  // Invitation card
  return (
    <div className="mt-4 overflow-hidden rounded-3xl border-2 border-[#a855f7]/30 bg-gradient-to-br from-[#faf5ff] via-white to-[#f5f3ff] p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-4xl shadow-lg" aria-hidden="true">
          <span className="inline-block animate-[pet-wiggle_2.4s_ease-in-out_infinite]">🌿</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">
            Choice Adventure
          </p>
          <h3 className="mt-0.5 text-xl font-black text-[#17231f]">
            A story where <span className="text-[#7c3aed]">you</span> decide!
          </h3>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">
            {available.length > 0 ? (
              <>Try <span className="font-black">{available[0].emoji} {available[0].title}</span> — see what happens, then rewind time! ⏪</>
            ) : (
              <>More adventures growing… check back soon! 🌱</>
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={startAdventure}
          disabled={available.length === 0}
          className="flex-1 rounded-full bg-[#7c3aed] px-6 py-3.5 text-base font-black text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start adventure 🚀
        </button>
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Not now"
          className="grid size-12 shrink-0 place-items-center rounded-full text-xl font-black text-[#a89bc4] ring-1 ring-[#e9d5ff] transition-all hover:bg-[#f5f3ff] hover:text-[#6b5b8e]"
        >
          ✕
        </button>
      </div>
      {justCompleted && (
        <p className="mt-3 text-center text-sm font-black text-[#7c3aed]">
          ✨ Adventure saved to your journal! More growing below. 🌱
        </p>
      )}
    </div>
  );
}
