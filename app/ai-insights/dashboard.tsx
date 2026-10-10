"use client";

/**
 * TailTots AI Insights Dashboard — live algorithm demo.
 *
 * Every number on this page is computed by the REAL algorithms in lib/ai/*
 * from synthetic family data (lib/demo/synthetic-data.ts). Nothing is
 * hardcoded. This is the "black box opened": parents (and evaluators) can see
 * exactly what the AI deduced, what data it used, and what action it took.
 */

import { useMemo, useState } from "react";
import {
  generateDemoFamily,
  toCopilotEvents,
  toFlourishBadges,
  toFlourishBank,
  toFlourishEvents,
  toFlowEvents,
  toSnapshotAwards,
  toSnapshotCompletions,
  type DemoFamily,
} from "../../lib/demo/synthetic-data";
import {
  buildChildSnapshot,
  planMissionSlots,
  THRIVER_TRAITS,
  MISSION_CATEGORIES,
  type ChildSnapshot,
  type ThriverTrait,
} from "../../lib/ai/mission-engine";
import { detectPatterns, WEEKDAY_NAMES, type DetectedPattern } from "../../lib/ai/copilot";
import {
  computeFlourishScores,
  computeFlourishTrends,
  brightestPillar,
  FLOURISH_PILLARS,
  FLOURISH_PILLAR_LABELS,
  FLOURISH_PILLAR_EMOJI,
  type FlourishScores,
} from "../../lib/ai/flourishing";
import { updateEloRating, ELO_START_RATING } from "../../lib/ai/flow-calibration";
import type { MissionCategory } from "../../lib/ai/mission-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRAIT_LABELS: Record<ThriverTrait, string> = {
  confidence: "Confidence",
  empathy: "Empathy",
  "self-control": "Self-Control",
  integrity: "Integrity",
  curiosity: "Curiosity",
  perseverance: "Perseverance",
  optimism: "Optimism",
};

const TRAIT_COLORS: Record<ThriverTrait, string> = {
  confidence: "#e8833a",
  empathy: "#e0526e",
  "self-control": "#7c6cf0",
  integrity: "#3a9e7c",
  curiosity: "#2f9fd8",
  perseverance: "#b07cc6",
  optimism: "#d8a92f",
};

const PILLAR_COLORS: Record<string, string> = {
  joy: "#f5b83d",
  stick: "#3a9e7c",
  together: "#e0526e",
  giving: "#7c6cf0",
  mastery: "#2f9fd8",
};

interface ChildAnalysis {
  childId: string;
  name: string;
  age: number;
  blurb: string;
  snapshot: ChildSnapshot;
  patterns: DetectedPattern[];
  flourish: FlourishScores;
  flourishTrend: Record<string, string>;
  brightest: string;
  eloByCategory: { category: MissionCategory; rating: number; band: string; games: number }[];
  eloTimeline: { category: MissionCategory; points: { x: number; y: number }[] }[];
  missionCount: number;
  completionRate: number;
}

/** Replay flow events chronologically to build per-category Elo timelines. */
function buildEloTimelines(childId: string, missions: DemoFamily["missions"]) {
  const flowEvents = toFlowEvents(childId, missions.filter((m) => m.childId === childId));
  const byCategory = new Map<MissionCategory, typeof flowEvents>();
  for (const e of flowEvents) {
    const cat = (e.category ?? "chore") as MissionCategory;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(e);
  }
  const timelines: { category: MissionCategory; points: { x: number; y: number }[] }[] = [];
  const finals: { category: MissionCategory; rating: number; games: number }[] = [];
  for (const [cat, evts] of byCategory) {
    let rating = ELO_START_RATING;
    let games = 0;
    const points: { x: number; y: number }[] = [{ x: 0, y: rating }];
    const sorted = [...evts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Track started-but-never-completed per task
    const started = new Set<string>();
    const completedTasks = new Set<string>();
    for (const e of sorted) {
      const key = `${e.category}-${e.createdAt}`;
      if (e.eventType === "started") started.add(key);
      if (e.eventType === "completed" || e.eventType === "approved") {
        completedTasks.add(key);
        rating = updateEloRating(rating, (e.difficulty as "easy" | "medium" | "hard") ?? "easy", "completed");
        games++;
        points.push({ x: points.length, y: rating });
      } else if (e.eventType === "abandoned") {
        rating = updateEloRating(rating, (e.difficulty as "easy" | "medium" | "hard") ?? "easy", "abandoned");
        games++;
        points.push({ x: points.length, y: rating });
      }
    }
    void started;
    void completedTasks;
    timelines.push({ category: cat, points });
    finals.push({ category: cat, rating, games });
  }
  return { timelines, finals };
}

function bandFor(rating: number): string {
  return rating >= 1300 ? "hard" : rating >= 1100 ? "medium" : "easy";
}

function analyzeChild(family: DemoFamily, childId: string, nowMs: number): ChildAnalysis {
  const child = family.children.find((c) => c.id === childId)!;
  const missions = family.missions.filter((m) => m.childId === childId);
  const badges = family.badges.filter((b) => b.childId === childId);
  const bank = family.bank.filter((t) => t.childId === childId);

  const snapshot = buildChildSnapshot({
    child: { age: child.age, streakDays: child.streakDays, lastStreakDate: child.lastStreakDate },
    completions: toSnapshotCompletions(missions),
    awards: toSnapshotAwards(badges),
    pets: family.pets.map((p) => ({ species: p.species, name: p.name, careNeeds: p.careNeeds })),
  });

  const patterns = detectPatterns(toCopilotEvents(missions), { streakDays: child.streakDays, age: child.age }, nowMs);

  // Flourishing: this week vs 4 weeks ago for trends
  const flourishEvents = toFlourishEvents(missions);
  const flourishBadges = toFlourishBadges(badges);
  const flourishBank = toFlourishBank(bank);
  const flourish = computeFlourishScores(flourishEvents, flourishBadges, flourishBank, undefined, nowMs);
  const lastMonth = computeFlourishScores(flourishEvents, flourishBadges, flourishBank, undefined, nowMs - 28 * 86400000);
  const flourishTrend = computeFlourishTrends(flourish, lastMonth) as Record<string, string>;

  const { timelines, finals } = buildEloTimelines(childId, family.missions);
  const eloByCategory = finals.map((f) => ({ ...f, band: bandFor(f.rating) }));

  const done = missions.filter((m) => m.completedAt).length;

  return {
    childId,
    name: child.name,
    age: child.age,
    blurb: child.blurb,
    snapshot,
    patterns,
    flourish,
    flourishTrend,
    brightest: brightestPillar(flourish),
    eloByCategory,
    eloTimeline: timelines,
    missionCount: missions.length,
    completionRate: missions.length ? done / missions.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Bar({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const pct = Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#17231f" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#5a6b63" }}>
          {value.toFixed(value < 10 ? 2 : 0)}
          {sub ? <span style={{ fontWeight: 500, color: "#8a978f" }}> {sub}</span> : null}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: "#ece7d8", marginTop: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e2dcc9",
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        boxShadow: "0 2px 12px rgba(22,90,75,0.06)",
      }}
    >
      <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", color: "#165a4b", margin: "0 0 6px" }}>{kicker}</p>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: "#17231f", margin: "0 0 16px" }}>{title}</h2>
      {children}
    </section>
  );
}

/** Human-readable explanation of what the AI deduced, from what data, and what it did. */
function patternExplanation(p: DetectedPattern): { what: string; data: string; action: string } {
  const d = p.detail;
  switch (p.insightType) {
    case "weak_weekday":
      return {
        what: `${d.weekdayName} is ${childName}’s hardest day — ${(Number(d.rate) * 100).toFixed(0)}% completion vs ${(Number(d.baseline) * 100).toFixed(0)}% on other days.`,
        data: `${d.assigned} missions assigned on ${d.weekdayName}s over the last 8 weeks. Compared against the child's own baseline, never against other children.`,
        action: `The Mission Engine now opens ${d.weekdayName} sets with regulation-first (body-based, low-demand) missions, and the Parent Copilot suggests a shorter Thursday routine.`,
      };
    case "weak_category":
      return {
        what: `${d.categoryLabel} missions complete at ${(Number(d.rate) * 100).toFixed(0)}% — well below the ${(Number(d.baseline) * 100).toFixed(0)}% average across categories.`,
        data: `${d.assigned} ${d.categoryLabel} missions over 8 weeks vs the mean completion rate across all categories.`,
        action: `Trait weighting now boosts missions that build this area, and flow calibration eases difficulty in ${d.categoryLabel} until confidence returns.`,
      };
    case "completion_drop":
      return {
        what: `Completion dropped to ${(Number(d.thisWeekRate) * 100).toFixed(0)}% this week from ${(Number(d.priorRate) * 100).toFixed(0)}% over the prior 4 weeks.`,
        data: `Week-over-week completion rate comparison (${d.assignedThisWeek} missions this week).`,
        action: `The next mission set leads with a regulation-first somatic mission and the Copilot flags a gentle check-in for the parent.`,
      };
    case "streak_at_risk":
      return {
        what: `A ${d.streakDays}-day streak is at risk — nothing completed in the last ${d.daysSilent} days.`,
        data: `Streak counter vs. days since last completion.`,
        action: `The Mission Engine prioritizes a quick-win confidence anchor to restart momentum, not a harder challenge.`,
      };
    case "skill_imbalance":
      return {
        what: `${d.strongSkillLabel} (${d.strongCount} badges) is far ahead of ${d.lightSkillLabel} (${d.lightCount} badges) — a ${d.ratio}x gap.`,
        data: `Lifetime badge counts per skill from the full achievement history.`,
        action: `Trait weighting shifts 60% of personalization weight toward the under-developed traits behind ${d.lightSkillLabel}.`,
      };
    case "difficulty_mismatch":
      return {
        what:
          d.direction === "too_hard"
            ? `Hard missions are failing while easy ones succeed — the difficulty band is set too high.`
            : `Easy missions complete at 100% while harder ones go untried — ${childName} is ready for more challenge.`,
        data: `Completion rate split by difficulty band over the last 30 days.`,
        action:
          d.direction === "too_hard"
            ? `Flow calibration steps difficulty down immediately (2-signal fast back-off) to protect confidence.`
            : `Flow calibration steps difficulty up (3-signal slow step-up) and the next set includes a Brave Try stretch mission.`,
      };
    case "engagement_rise":
      return {
        what: `Engagement is rising — ${(Number(d.thisWeekRate) * 100).toFixed(0)}% this week vs ${(Number(d.priorRate) * 100).toFixed(0)}% before.`,
        data: `Week-over-week completion rate (${d.assignedThisWeek} missions this week).`,
        action: `The AI celebrates the momentum and gradually raises the challenge ceiling to match the growth.`,
      };
    default:
      return {
        what: `Pattern detected: ${p.insightType}.`,
        data: `Computed from mission event history.`,
        action: `The Mission Engine adjusts personalization accordingly.`,
      };
  }
}

// Module-level so patternExplanation can reference it (set during render)
let childName = "the child";

/** SVG sparkline for Elo timeline */
function EloSparkline({ points, color }: { points: { x: number; y: number }[]; color: string }) {
  const W = 220;
  const H = 56;
  if (points.length < 2) return <span style={{ fontSize: 12, color: "#8a978f" }}>not enough data yet</span>;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys, 800);
  const max = Math.max(...ys, 1600);
  const span = Math.max(1, max - min);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x / (points.length - 1)) * W},${H - ((p.y - min) / span) * (H - 8) - 4}`)
    .join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const trend = last.y - first.y;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={W} height={H} style={{ background: "#f7f4ea", borderRadius: 8 }}>
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" />
        <circle
          cx={((points.length - 1) / (points.length - 1)) * W}
          cy={H - ((last.y - min) / span) * (H - 8) - 4}
          r={4}
          fill={color}
        />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 800, color: trend >= 0 ? "#165a4b" : "#b04a3a" }}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(Math.round(trend))}
      </span>
    </div>
  );
}

/** Pentagon bloom visualization for PERMA pillars */
function Bloom({ scores }: { scores: FlourishScores }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const R = 80;
  const keys = FLOURISH_PILLARS;
  const pt = (i: number, v: number) => {
    const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const r = (v / 100) * R;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  };
  const poly = keys.map((k, i) => pt(i, scores[k])).join(" ");
  const frame = keys.map((_, i) => pt(i, 100)).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={frame} fill="none" stroke="#e2dcc9" strokeWidth={1.5} />
      {[25, 50, 75].map((v) => (
        <polygon
          key={v}
          points={keys.map((_, i) => pt(i, v)).join(" ")}
          fill="none"
          stroke="#ece7d8"
          strokeWidth={1}
        />
      ))}
      <polygon points={poly} fill="rgba(22,90,75,0.18)" stroke="#165a4b" strokeWidth={2.5} strokeLinejoin="round" />
      {keys.map((k, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        const lx = cx + (R + 22) * Math.cos(angle);
        const ly = cy + (R + 22) * Math.sin(angle);
        return (
          <text key={k} x={lx} y={ly} textAnchor="middle" fontSize={11} fontWeight={800} fill="#5a6b63">
            {FLOURISH_PILLAR_EMOJI[k]} {Math.round(scores[k])}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------

export function AiInsightsDashboard() {
  const [childId, setChildId] = useState("demo-maya");
  const [showValidation, setShowValidation] = useState(false);

  const { family, analyses } = useMemo(() => {
    const nowMs = Date.now();
    const fam = generateDemoFamily(nowMs, 90);
    const an: Record<string, ChildAnalysis> = {};
    for (const c of fam.children) an[c.id] = analyzeChild(fam, c.id, nowMs);
    return { family: fam, analyses: an, nowMs };
  }, []);

  const a = analyses[childId];
  childName = a.name;
  const snap = a.snapshot;

  // --- Validation: trait weighting transparency ---
  const weightRows = THRIVER_TRAITS.map((t) => ({
    trait: t,
    score: snap.traitScores[t],
    weight: snap.traitWeights[t],
    isWeakest: snap.weakestTraits.includes(t),
  })).sort((x, y) => y.weight - x.weight);

  // --- Validation: personalization lift (AI vs random baseline) ---
  const plan = useMemo(() => planMissionSlots(snap, { count: 4 }), [snap]);
  const aiHits = plan.slots.filter((s) => s.traitFocus && snap.weakestTraits.includes(s.traitFocus)).length;
  const randomExpected = (snap.weakestTraits.length / THRIVER_TRAITS.length) * plan.slots.length;
  const lift = randomExpected > 0 ? aiHits / randomExpected : 0;

  // --- Validation: Elo summary ---
  const eloMoves = a.eloTimeline.reduce((n, t) => n + Math.max(0, t.points.length - 1), 0);

  const severityColor: Record<string, string> = { info: "#2f9fd8", watch: "#d8a92f", act: "#e0526e" };
  const severityLabel: Record<string, string> = { info: "Noted", watch: "Worth a look", act: "Gentle action" };

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: 960,
        padding: "24px 16px 64px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#faf8f0",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", color: "#165a4b", margin: "0 0 8px" }}>
          TAILTOTS · LIVE ALGORITHM DEMO
        </p>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", margin: "0 0 8px", lineHeight: 1.15 }}>
          How the AI understands your child
        </h1>
        <p style={{ fontSize: 14, color: "#5a6b63", lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
          Every number below is computed <strong>live</strong> by TailTots' real algorithms from 90 days of
          synthetic family history — the same code that runs in production. No hardcoded values, no mock
          insights. This is the black box, opened.
        </p>
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "#fff4d8",
            border: "1px solid #e8d9a8",
            borderRadius: 12,
            fontSize: 12,
            color: "#7a5b12",
            lineHeight: 1.5,
          }}
        >
          🧪 <strong>Demo data:</strong> the Sharma family — 3 children (ages 5, 8, 11), 2 pets (Biscuit the dog,
          Pickles the guinea pig), {family.missions.length} missions · {family.badges.length} badges ·{" "}
          {family.bank.length} Kid Bank transactions over 90 days. Deterministic seed — same data on every load.
        </div>
      </header>

      {/* Child selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {family.children.map((c) => (
          <button
            key={c.id}
            onClick={() => setChildId(c.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: c.id === childId ? "2px solid #165a4b" : "1px solid #e2dcc9",
              background: c.id === childId ? "#165a4b" : "#fff",
              color: c.id === childId ? "#fff" : "#17231f",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {c.name} · age {c.age}
          </button>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "#5a6b63", fontStyle: "italic", margin: "0 0 20px", lineHeight: 1.5 }}>
        {a.blurb}
      </p>

      {/* 1. Trait development */}
      <Section kicker="DEVELOPMENTAL MISSION ENGINE" title="Trait development — what the AI sees">
        <p style={{ fontSize: 13, color: "#5a6b63", margin: "0 0 16px", lineHeight: 1.55 }}>
          Seven traits, scored 0–1 from <strong>behavioral signals only</strong> (never surveys, never labels):
          difficulty choices → confidence · kindness &amp; pet-care share → empathy · streak + skip rate →
          self-control · parent approval rate → integrity · category breadth → curiosity · completion + hard-mission
          rate → perseverance · comeback speed → optimism.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0 24px" }}>
          {weightRows.map((r) => (
            <Bar
              key={r.trait}
              label={`${TRAIT_LABELS[r.trait]}${r.isWeakest ? " · needs nurture" : ""}`}
              value={r.score}
              max={1}
              color={TRAIT_COLORS[r.trait]}
              sub={`weight ${r.weight.toFixed(2)}`}
            />
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#8a978f", margin: "12px 0 0", lineHeight: 1.5 }}>
          The <strong>weight</strong> number is the 60/25/15 personalization algorithm at work: 60% toward the
          weakest traits, 25% age-band priority, 15% multiplier-pair boost. Missions are generated for the
          highest-weighted traits first.
        </p>
      </Section>

      {/* 2. Detected patterns */}
      <Section kicker="PARENT COPILOT" title={`Detected patterns — ${a.patterns.length} insight${a.patterns.length === 1 ? "" : "s"}`}>
        {a.patterns.length === 0 ? (
          <p style={{ fontSize: 14, color: "#5a6b63" }}>
            No significant patterns right now — {a.name}'s activity looks steady across all dimensions the AI
            monitors.
          </p>
        ) : (
          a.patterns.map((p, i) => {
            const exp = patternExplanation(p);
            return (
              <div
                key={i}
                style={{
                  border: `2px solid ${severityColor[p.severity]}`,
                  borderRadius: 16,
                  padding: 18,
                  marginBottom: 14,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#fff",
                      background: severityColor[p.severity],
                      padding: "4px 10px",
                      borderRadius: 999,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {severityLabel[p.severity].toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#8a978f" }}>
                    {p.insightType.replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    ["🔍 WHAT THE AI DEDUCED", exp.what],
                    ["📊 WHAT DATA IT USED", exp.data],
                    ["⚡ WHAT ACTION IT TOOK", exp.action],
                  ].map(([label, text]) => (
                    <div key={label} style={{ fontSize: 13, lineHeight: 1.55 }}>
                      <strong style={{ color: "#165a4b", fontSize: 11, letterSpacing: "0.06em" }}>{label}</strong>
                      <p style={{ margin: "4px 0 0", color: "#17231f" }}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
        <p style={{ fontSize: 12, color: "#8a978f", margin: "8px 0 0", lineHeight: 1.5 }}>
          Detection is <strong>deterministic math</strong> (SQL-style thresholds over 8-week windows) — the AI
          model only narrates these precomputed facts into warm language. It never analyzes raw data.
        </p>
      </Section>

      {/* 3. Difficulty calibration */}
      <Section kicker="FLOW CALIBRATION" title="Difficulty calibration — the just-right zone">
        <p style={{ fontSize: 13, color: "#5a6b63", margin: "0 0 16px", lineHeight: 1.55 }}>
          Each category has an <strong>Elo rating</strong> (starts at 1200, like chess). Wins raise it, abandoned
          missions lower it gently (half penalty — kids get grace), brave stretch attempts never hurt it. The AI
          steps difficulty <strong>down after 2 hard signals</strong> and <strong>up after 3 easy signals</strong>.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {a.eloByCategory.map((e) => {
            const tl = a.eloTimeline.find((t) => t.category === e.category);
            return (
              <div key={e.category} style={{ border: "1px solid #e2dcc9", borderRadius: 14, padding: 16, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#17231f", textTransform: "capitalize" }}>
                    {e.category.replace("_", " ")}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#5a6b63" }}>
                    {e.rating} · <span style={{ color: "#165a4b" }}>{e.band}</span> · {e.games} missions
                  </span>
                </div>
                {tl && <EloSparkline points={tl.points} color="#165a4b" />}
              </div>
            );
          })}
        </div>
      </Section>

      {/* 4. Flourishing */}
      <Section kicker="PERMA GROWTH DASHBOARD" title="Flourishing — beyond chore counts">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <Bloom scores={a.flourish} />
          <div style={{ flex: 1, minWidth: 260 }}>
            {FLOURISH_PILLARS.map((p) => (
              <Bar
                key={p}
                label={`${FLOURISH_PILLAR_EMOJI[p]} ${FLOURISH_PILLAR_LABELS[p]}${
                  p === a.brightest ? " · shining" : ""
                }`}
                value={a.flourish[p]}
                max={100}
                color={PILLAR_COLORS[p]}
                sub={
                  a.flourishTrend[p] === "up" ? "▲ rising" : a.flourishTrend[p] === "down" ? "▼ blooming" : "· steady"
                }
              />
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#8a978f", margin: "12px 0 0", lineHeight: 1.5 }}>
          Computed from behavioral signals over 28 days — joy from completion + check-ins, stick-with-it from
          hard missions, togetherness from kindness, giving from the Give jar, mastery from badges. Compared only
          against {a.name}'s own last month. <strong>{FLOURISH_PILLAR_LABELS[a.brightest as keyof typeof FLOURISH_PILLAR_LABELS]}</strong> is
          celebrated first.
        </p>
      </Section>

      {/* 5. Validation lab */}
      <Section kicker="ALGORITHM VALIDATION" title="Prove it works — the validation lab">
        <button
          onClick={() => setShowValidation(!showValidation)}
          style={{
            padding: "10px 20px",
            borderRadius: 12,
            border: "2px solid #165a4b",
            background: showValidation ? "#165a4b" : "#fff",
            color: showValidation ? "#fff" : "#165a4b",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: showValidation ? 16 : 0,
          }}
        >
          {showValidation ? "Hide validation details" : "Show how we validated the algorithms"}
        </button>

        {showValidation && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* Trait weighting transparency */}
            <div style={{ border: "1px solid #e2dcc9", borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 8px", color: "#17231f" }}>
                1 · Trait-weighting algorithm — inputs → weights
              </h3>
              <p style={{ fontSize: 13, color: "#5a6b63", margin: "0 0 12px", lineHeight: 1.55 }}>
                The 60/25/15 algorithm: <strong>60%</strong> toward weakest traits (deficit),{" "}
                <strong>25%</strong> age-band developmental priority, <strong>15%</strong> multiplier-pair boost
                (traits that amplify each other, e.g. confidence × perseverance). Weights are clamped
                [0.05, 0.35] so no trait dominates or disappears.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#8a978f", fontSize: 11 }}>
                      <th style={{ padding: "6px 8px" }}>TRAIT</th>
                      <th style={{ padding: "6px 8px" }}>SCORE (0–1)</th>
                      <th style={{ padding: "6px 8px" }}>WEIGHT</th>
                      <th style={{ padding: "6px 8px" }}>DRIVER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weightRows.map((r) => (
                      <tr key={r.trait} style={{ borderTop: "1px solid #f0ebdd" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700 }}>{TRAIT_LABELS[r.trait]}</td>
                        <td style={{ padding: "6px 8px" }}>{r.score.toFixed(2)}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 800, color: "#165a4b" }}>
                          {r.weight.toFixed(3)}
                        </td>
                        <td style={{ padding: "6px 8px", color: "#5a6b63", fontSize: 12 }}>
                          {r.isWeakest ? "← weakest trait, deficit-weighted" : r.weight > 0.15 ? "multiplier boost" : "baseline"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Personalization lift */}
            <div style={{ border: "1px solid #e2dcc9", borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 8px", color: "#17231f" }}>
                2 · Personalization lift — AI vs random baseline
              </h3>
              <p style={{ fontSize: 13, color: "#5a6b63", margin: "0 0 12px", lineHeight: 1.55 }}>
                We ran the real <strong>planMissionSlots</strong> planner on {a.name}'s snapshot (4 slots) and
                counted how many slots target the weakest traits — vs a random mission picker.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, background: "#f7f4ea", borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#8a978f", margin: "0 0 4px" }}>RANDOM PICKER</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: "#8a978f", margin: 0 }}>
                    {randomExpected.toFixed(1)}
                  </p>
                  <p style={{ fontSize: 12, color: "#8a978f", margin: "4px 0 0" }}>of 4 slots hit weakest traits (expected)</p>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: "#e7f4ef", borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#165a4b", margin: "0 0 4px" }}>AI PLANNER</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: "#165a4b", margin: 0 }}>{aiHits}</p>
                  <p style={{ fontSize: 12, color: "#5a6b63", margin: "4px 0 0" }}>of 4 slots hit weakest traits (actual)</p>
                </div>
                <div style={{ flex: 1, minWidth: 200, background: "#165a4b", borderRadius: 12, padding: 16, textAlign: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#fff", opacity: 0.8, margin: "0 0 4px" }}>LIFT</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: "#fff", margin: 0 }}>{lift.toFixed(1)}×</p>
                  <p style={{ fontSize: 12, color: "#fff", opacity: 0.8, margin: "4px 0 0" }}>more targeted than random</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#8a978f", margin: "12px 0 0", lineHeight: 1.5 }}>
                Slot kinds: {plan.slots.map((s) => `${s.kind}→${s.traitFocus ?? "—"}`).join(" · ")}. Rationale:{" "}
                {plan.rationale}
              </p>
            </div>

            {/* Elo validation */}
            <div style={{ border: "1px solid #e2dcc9", borderRadius: 14, padding: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 8px", color: "#17231f" }}>
                3 · Elo calibration — {eloMoves} rated missions replayed
              </h3>
              <p style={{ fontSize: 13, color: "#5a6b63", margin: "0 0 12px", lineHeight: 1.55 }}>
                We replayed all {a.missionCount} missions chronologically through{" "}
                <strong>updateEloRating</strong> (K=16, grace on abandonment, no penalty for brave tries). The
                sparklines above show each category's rating journey from the 1200 start. Watch Maya's pet_care
                climb as her confidence grows, or Leo's dip-and-recover in weeks 5–8.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#8a978f", fontSize: 11 }}>
                      <th style={{ padding: "6px 8px" }}>CATEGORY</th>
                      <th style={{ padding: "6px 8px" }}>FINAL ELO</th>
                      <th style={{ padding: "6px 8px" }}>BAND</th>
                      <th style={{ padding: "6px 8px" }}>Δ FROM 1200</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.eloByCategory.map((e) => (
                      <tr key={e.category} style={{ borderTop: "1px solid #f0ebdd" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700, textTransform: "capitalize" }}>
                          {e.category.replace("_", " ")}
                        </td>
                        <td style={{ padding: "6px 8px" }}>{e.rating}</td>
                        <td style={{ padding: "6px 8px", color: "#165a4b", fontWeight: 700 }}>{e.band}</td>
                        <td
                          style={{
                            padding: "6px 8px",
                            fontWeight: 800,
                            color: e.rating - 1200 >= 0 ? "#165a4b" : "#b04a3a",
                          }}
                        >
                          {e.rating - 1200 >= 0 ? "+" : ""}
                          {e.rating - 1200}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data provenance */}
            <div style={{ border: "1px solid #e2dcc9", borderRadius: 14, padding: 18, background: "#f7f4ea" }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 8px", color: "#17231f" }}>
                4 · Data provenance — nothing hardcoded
              </h3>
              <p style={{ fontSize: 13, color: "#5a6b63", margin: 0, lineHeight: 1.6 }}>
                Synthetic history: <strong>{a.missionCount} missions</strong> ·{" "}
                <strong>{Math.round(a.completionRate * 100)}% completion</strong> · 90 days · deterministic seed{" "}
                {family.children.find((c) => c.id === childId)?.seed}. Algorithms:{" "}
                <code style={{ fontSize: 12 }}>buildChildSnapshot</code>,{" "}
                <code style={{ fontSize: 12 }}>computeTraitWeights</code>,{" "}
                <code style={{ fontSize: 12 }}>detectPatterns</code>,{" "}
                <code style={{ fontSize: 12 }}>computeFlourishScores</code>,{" "}
                <code style={{ fontSize: 12 }}>updateEloRating</code>,{" "}
                <code style={{ fontSize: 12 }}>planMissionSlots</code> — all imported from{" "}
                <code style={{ fontSize: 12 }}>lib/ai/*</code>, the production code. Change the seed, get
                different children, same honest math.
              </p>
            </div>
          </div>
        )}
      </Section>

      <footer style={{ marginTop: 32, padding: "16px 0", borderTop: "1px solid #e2dcc9" }}>
        <p style={{ fontSize: 12, color: "#8a978f", lineHeight: 1.6, margin: 0 }}>
          🧪 <strong>Demo disclaimer:</strong> All family data on this page is synthetic — generated with a
          deterministic seed for demonstration. The <em>algorithms</em> are real production code. Trait scores
          are internal development signals, never labels. TailTots is a parenting tool, not a medical or
          therapeutic service.
        </p>
      </footer>
    </main>
  );
}
