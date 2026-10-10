"use client";

/**
 * WeeklyInsight — the parent's ONE card per week.
 *
 * Billion-dollar redesign, Change 1: the anxiety cockpit (7 traits + 5 pillars
 * + 7 detectors on one screen) becomes a single weekly card. The parent sees:
 *   🔍 what we noticed (strength first, always)
 *   📊 confidence (honest sample size — "based on 12 missions")
 *   💡 one thing to try (one doable suggestion)
 *   [Got it] [Tell me more]
 *
 * "Tell me more" expands to the full detail — trait bars, detector data —
 * for parents who want depth. The depth exists; it's behind a deliberate tap.
 *
 * Consumes RankedInsight from lib/ai/insight-ranking.ts (deterministic).
 * Narration copy should come pre-validated through parent-state.ts calm rules;
 * this component also strips alarmist phrasing defensively.
 */

import { useState } from "react";
import type { RankedInsight } from "../../lib/ai/insight-ranking";
import type { DetectedPattern } from "../../lib/ai/copilot";
import { scanForAlarmistLanguage } from "../../lib/ai/parent-state";

// ---------------------------------------------------------------------------
// Strength-first copy per insight type.
// Every card leads with what's working, then the observation, then one
// doable suggestion. No alarmist language — validated at render.
// ---------------------------------------------------------------------------

interface InsightCopy {
  strength: string;
  observation: string;
  suggestion: string;
  detailTitle: string;
  detailBody: string;
}

function copyFor(pattern: DetectedPattern, childName: string): InsightCopy {
  const d = pattern.detail;
  const pct = (v: unknown) => `${Math.round(Number(v) * 100)}%`;
  switch (pattern.insightType) {
    case "weak_weekday":
      return {
        strength: `${childName} is building a steady rhythm — most days are going well.`,
        observation: `${d.weekdayName}s are the trickiest day (${pct(d.rate)} completion vs ${pct(d.baseline)} usually).`,
        suggestion: `Try a 3-minute pet-connected mission on ${d.weekdayName}s instead of a planning one.`,
        detailTitle: `Why ${d.weekdayName}s are hard`,
        detailBody:
          `${d.assigned} missions assigned on ${d.weekdayName}s over the last 8 weeks, compared against ${childName}'s own baseline — never against other children. ` +
          `The Mission Engine now opens ${d.weekdayName} sets with regulation-first (body-based, low-demand) missions.`,
      };
    case "weak_category":
      return {
        strength: `${childName} is making real progress across most mission types.`,
        observation: `${d.categoryLabel} missions complete at ${pct(d.rate)} vs ${pct(d.baseline)} overall.`,
        suggestion: `Start the next one together, side by side, with one tiny first step.`,
        detailTitle: `Growing in ${d.categoryLabel}`,
        detailBody:
          `${d.assigned} ${d.categoryLabel} missions over 8 weeks vs the mean across all categories. ` +
          `Trait weighting now gently boosts missions that build this area, and difficulty eases until confidence returns.`,
      };
    case "completion_drop":
      return {
        strength: `${childName} has shown they can do this — the foundation is there.`,
        observation: `Completion this week is ${pct(d.thisWeekRate)} vs ${pct(d.priorRate)} lately.`,
        suggestion: `Reset the rhythm together with one joyful, easy win — no pressure, just a fresh start.`,
        detailTitle: `A quieter week`,
        detailBody:
          `Week-over-week completion comparison across ${d.assignedThisWeek} missions this week. ` +
          `The next mission set leads with a calming, body-based mission to ease back in.`,
      };
    case "streak_at_risk":
      return {
        strength: `A ${d.streakDays}-day rhythm is something to be proud of.`,
        observation: `Nothing completed in the last couple of days — the rhythm is cooling.`,
        suggestion: `One tiny mission together today keeps it warm.`,
        detailTitle: `Keeping the rhythm warm`,
        detailBody:
          `Streak counter vs days since last completion. The Mission Engine prioritizes a quick-win confidence anchor to restart momentum — never a harder challenge.`,
      };
    case "skill_imbalance":
      return {
        strength: `${d.strongCount} recent wins in ${d.strongSkillLabel} — a real strength to celebrate.`,
        observation: `${d.lightSkillLabel} has had less practice lately (${d.lightCount} vs ${d.strongCount}).`,
        suggestion: `Bridge them: one mission that practices ${d.lightSkillLabel} through ${d.strongSkillLabel}.`,
        detailTitle: `Building on a strength`,
        detailBody:
          `Lifetime badge counts per skill from the full achievement history. ` +
          `Personalization now leans toward the under-practiced area, using the strong one as the bridge.`,
      };
    case "difficulty_mismatch":
      return {
        strength:
          d.direction === "downshift"
            ? `${childName} is stretching — that willingness matters more than the outcome.`
            : `${childName} is mastering the current level — ready for what's next.`,
        observation:
          d.direction === "downshift"
            ? `Hard ${d.categoryLabel} missions are landing at ${pct(d.hardRate)} vs ${pct(d.easyRate)} for easy ones.`
            : `Easy ${d.categoryLabel} missions are at ${pct(d.easyRate)} — the current level fits comfortably.`,
        suggestion:
          d.direction === "downshift"
            ? `Ease that category down a notch — confidence first, challenge second.`
            : `Offer one slightly stretchier "brave try" — attempts count, always.`,
        detailTitle: `Right-sizing the challenge`,
        detailBody:
          d.direction === "downshift"
            ? `Completion split by difficulty band over 30 days. Flow calibration steps difficulty down promptly to protect confidence.`
            : `Completion split by difficulty band over 30 days. Flow calibration steps difficulty up gradually, with stretch missions framed as brave tries.`,
      };
    case "engagement_rise":
      return {
        strength: `Something is clicking — completion is ${pct(d.thisWeekRate)} this week vs ${pct(d.priorRate)} before.`,
        observation: `The rhythm ${childName} has found is working.`,
        suggestion: `Keep that same rhythm going — consistency beats intensity.`,
        detailTitle: `Momentum worth keeping`,
        detailBody:
          `Week-over-week completion across ${d.assignedThisWeek} missions this week. ` +
          `The AI celebrates the momentum and gradually raises the challenge ceiling to match the growth.`,
      };
    default:
      return {
        strength: `${childName} is growing — here's what the week showed.`,
        observation: `A new pattern is emerging in ${childName}'s missions.`,
        suggestion: `Keep the rhythm steady and check back next Sunday.`,
        detailTitle: `This week's pattern`,
        detailBody: `Computed from mission event history. The Mission Engine adjusts personalization accordingly.`,
      };
  }
}

/** Defensive scrub: replace any alarmist phrasing that slipped through. */
function scrubCopy(text: string): string {
  const hit = scanForAlarmistLanguage(text);
  if (!hit) return text;
  // Replace the flagged phrase with the calm equivalent.
  return text.replace(new RegExp(hit, "gi"), "worth paying attention to");
}

export interface WeeklyInsightProps {
  /** The ranked weekly pick, or null when nothing qualifies this week. */
  insight: RankedInsight | null;
  childName: string;
  /** Called when the parent dismisses the card. */
  onAcknowledge?: () => void;
  /** Rendered inside the "Tell me more" expander, after the detail body. */
  detailExtra?: React.ReactNode;
}

export default function WeeklyInsight({ insight, childName, onAcknowledge, detailExtra }: WeeklyInsightProps) {
  const [expanded, setExpanded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (acknowledged) return null;

  // Calm empty state — no insight is good news, not a missing feature.
  if (!insight) {
    return (
      <section
        aria-label="This week's insight"
        style={{
          background: "#fff",
          border: "1px solid #e3ede8",
          borderRadius: 20,
          padding: 22,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: "#165a4b", margin: 0 }}>
          THIS WEEK
        </p>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#17231f", margin: "10px 0 6px" }}>
          Steady week for {childName} — nothing needs your attention.
        </p>
        <p style={{ fontSize: 14, color: "#4f625b", margin: 0, lineHeight: 1.55 }}>
          The AI is still personalizing every mission quietly in the background. We only surface a card when there&rsquo;s
          something genuinely useful to share.
        </p>
      </section>
    );
  }

  const copy = copyFor(insight.pattern, childName);
  const strength = scrubCopy(copy.strength);
  const observation = scrubCopy(copy.observation);
  const suggestion = scrubCopy(copy.suggestion);

  const confidenceLabel =
    insight.confidence === "high"
      ? `High confidence — based on ${insight.sampleSize} missions`
      : `Medium confidence — based on ${insight.sampleSize} missions (we're still learning ${childName}'s patterns)`;

  return (
    <section
      aria-label="This week's insight"
      style={{
        background: "#fff",
        border: "1px solid #e3ede8",
        borderRadius: 20,
        padding: 22,
        maxWidth: 640,
        margin: "0 auto",
        boxShadow: "0 2px 12px rgba(22,90,75,0.06)",
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", color: "#165a4b", margin: 0 }}>
        THIS WEEK
      </p>

      {/* 🔍 What we noticed — strength first, always */}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#4f625b", margin: "0 0 6px" }}>🔍 What we noticed</p>
        <p style={{ fontSize: 16, color: "#17231f", margin: 0, lineHeight: 1.6 }}>
          <strong>{strength}</strong> {observation}
        </p>
      </div>

      {/* 📊 Confidence — honest about sample size */}
      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#4f625b", margin: "0 0 6px" }}>📊 How sure we are</p>
        <p style={{ fontSize: 14, color: "#4f625b", margin: 0, lineHeight: 1.55 }}>{confidenceLabel}.</p>
      </div>

      {/* 💡 One thing to try */}
      <div
        style={{
          marginTop: 14,
          background: "#fff4d8",
          borderRadius: 14,
          padding: "14px 16px",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 800, color: "#8a6d1b", margin: "0 0 6px" }}>💡 One thing to try</p>
        <p style={{ fontSize: 15, color: "#17231f", margin: 0, lineHeight: 1.6 }}>{suggestion}</p>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button
          type="button"
          onClick={() => {
            setAcknowledged(true);
            onAcknowledge?.();
          }}
          style={{
            flex: 1,
            background: "#165a4b",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Got it
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            flex: 1,
            background: "#e7f4ef",
            color: "#165a4b",
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {expanded ? "Show less" : "Tell me more"}
        </button>
      </div>

      {/* Expanded detail — the old dashboard depth, behind a deliberate tap */}
      {expanded && (
        <div
          style={{
            marginTop: 16,
            borderTop: "1px solid #e3ede8",
            paddingTop: 16,
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 800, color: "#17231f", margin: "0 0 8px" }}>
            {scrubCopy(copy.detailTitle)}
          </p>
          <p style={{ fontSize: 14, color: "#4f625b", margin: 0, lineHeight: 1.65 }}>{scrubCopy(copy.detailBody)}</p>
          <p style={{ fontSize: 12, color: "#69736f", margin: "12px 0 0", lineHeight: 1.5 }}>
            How we ranked this: {insight.rationale} Compared only to {childName}&rsquo;s own history — never to other children.
          </p>
          {detailExtra}
        </div>
      )}
      {/* AI humility footer — the lantern, not the leash */}
      <p
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid #e3ede8",
          fontSize: 12,
          color: "#69736f",
          lineHeight: 1.55,
          fontStyle: "italic",
        }}
      >
        We see patterns in missions — not the whole child. You know {childName} better
        than any algorithm ever will. 💛
      </p>
    </section>
  );
}
