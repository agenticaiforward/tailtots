/**
 * DecisionGrowthCard — parent-facing view of decision growth.
 *
 * What parents see: patterns as GROWTH, never as diagnosis.
 *   ✅ "Maya explored 4 different endings this week. She's building the
 *       thinking-ahead muscle."
 *   ❌ NEVER "Maya made 3 poor choices" / "Maya is impulsive"
 *
 * Parents see THAT the child is thinking — never the journal contents,
 * never a label. Strength-first, calm-language safe.
 */
"use client";

import { useMemo } from "react";
import {
  articulationCopy,
  decisionGrowthCopy,
  detectDecisionPattern,
  type ChoiceEvent,
  type DecisionPattern,
} from "../../lib/ai/choice-adventures";
import { curiosityGrowthCopy } from "../../lib/ai/curiosity-missions";
import { synthesisGrowthCopy } from "../../lib/ai/synthesis-missions";

export interface AdventureSummary {
  scenarioId: string;
  scenarioTitle: string;
  exploredCount: number;
  rewindCount: number;
  completedAt: string;
}

const PATTERN_NUDGE: Record<DecisionPattern, string> = {
  exploration: "Try asking 'what else could happen?' at dinner — they'll love it.",
  deliberation: "They're learning to pause. Protect that pause; don't rush their deciding.",
  impulsivity: "Playful 'freeze game' moments help: 'pause… now choose!' — keep it light.",
  people_pleasing: "Try: 'what do YOU want?' — and mean it. Their voice counts.",
  avoidance: "Celebrate every bold try out loud. Safety first, then bravery.",
};

export function DecisionGrowthCard({
  childName,
  summaries,
  events,
  curiosity,
  synthesis,
}: {
  childName: string;
  /** This week's adventure summaries. */
  summaries: AdventureSummary[];
  /** Raw choice events for pattern detection (internal only). */
  events: ChoiceEvent[];
  /** Optional curiosity stats: { questions, listens }. */
  curiosity?: { questions: number; listens: number };
  /** Optional synthesis stats: { dotsConnected, taughtPet, weeklyInsight }. */
  synthesis?: { dotsConnected: number; taughtPet: boolean; weeklyInsight?: string };
}) {
  const pattern = useMemo(() => detectDecisionPattern(events), [events]);

  const adventuresThisWeek = summaries.length;
  const endingsExplored = useMemo(
    () => summaries.reduce((s, a) => s + a.exploredCount, 0),
    [summaries]
  );

  const copy = decisionGrowthCopy(childName, adventuresThisWeek, endingsExplored, pattern);

  const curiosityCopy = curiosity
    ? curiosityGrowthCopy(childName, curiosity.questions, curiosity.listens)
    : null;
  const synthesisCopy = synthesis
    ? synthesisGrowthCopy(childName, synthesis.dotsConnected, synthesis.taughtPet, synthesis.weeklyInsight)
    : null;

  // Articulation: did they explain WHY after comparing endings?
  const whyCount = useMemo(
    () => summaries.filter((s) => s.exploredCount >= 2).length,
    [summaries]
  );
  const articulation = articulationCopy(endingsExplored, whyCount > 0 && endingsExplored >= 2);

  const hasAnything =
    adventuresThisWeek > 0 || curiosityCopy || synthesisCopy;

  if (!hasAnything) {
    return (
      <div className="rounded-3xl border border-[#e9d5ff]/60 bg-gradient-to-br from-[#faf5ff] to-white p-5">
        <div className="flex items-start gap-3">
          <span className="text-3xl" aria-hidden="true">🌿</span>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-[#7c3aed]">
              Thinking growth
            </p>
            <p className="mt-1 text-sm font-bold leading-6 text-[#4f625b]">{copy}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[#e9d5ff]/60 bg-gradient-to-br from-[#faf5ff] to-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">🧠</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-[0.15em] text-[#7c3aed]">
            Thinking growth
          </p>
          <p className="mt-1 text-sm font-bold leading-6 text-[#4f625b]">{copy}</p>

          {/* Adventure chips — what they explored, not how they "scored" */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {summaries.slice(0, 6).map((s) => (
              <span
                key={s.scenarioId + s.completedAt}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#6b5b8e] ring-1 ring-[#e9d5ff]"
                title={`${s.exploredCount} endings explored`}
              >
                🌀 {s.scenarioTitle} · {s.exploredCount} ending{s.exploredCount === 1 ? "" : "s"}
              </span>
            ))}
          </div>

          {pattern && (
            <p className="mt-3 rounded-2xl bg-[#f5f3ff] p-3 text-xs font-bold leading-5 text-[#5b4a8a]">
              💡 {PATTERN_NUDGE[pattern]}
            </p>
          )}

          {articulation && (
            <p className="mt-2 text-xs font-bold leading-5 text-[#4f625b]">
              🗣️ {articulation}
            </p>
          )}

          {curiosityCopy && (
            <p className="mt-2 text-xs font-bold leading-5 text-[#4f625b]">
              ❓ {curiosityCopy}
            </p>
          )}

          {synthesisCopy && (
            <p className="mt-2 text-xs font-bold leading-5 text-[#4f625b]">
              🌟 {synthesisCopy}
            </p>
          )}

          <p className="mt-3 text-[11px] font-semibold text-[#a89bc4]">
            🔒 Journals stay private to {childName}. We never grade choices — only celebrate thinking.
          </p>
        </div>
      </div>
    </div>
  );
}
