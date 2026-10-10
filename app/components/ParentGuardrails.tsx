"use client";

/**
 * ParentGuardrails — anxiety-guardrail UI for the parent experience.
 *
 * Billion-dollar redesign, Change 2. The product promise is calm, confident
 * parenting; a pattern-detecting dashboard can manufacture the opposite.
 * These components are the guardrails:
 *
 *  - PauseInsightsToggle: parent mutes ALL AI insights for 2 weeks.
 *    Missions keep personalizing silently — the AI works, the parent rests.
 *  - CalmNudgeBanner: when compulsive checking is detected (>5 dashboard
 *    opens/day), a gentle intervention + soft dashboard lock until tomorrow.
 *  - useDashboardLock: soft-lock state with friction-added bypass.
 *
 * State is localStorage-backed (per-device, per-parent). Logic comes from
 * lib/ai/parent-state.ts (deterministic — zero LLM).
 */

import { useCallback, useEffect, useState } from "react";
import {
  trackParentEngagement,
  shouldThrottleInsights,
  calmNudgeMessage,
  type ParentEngagementEvent,
} from "../../lib/ai/parent-state";

const PAUSE_KEY = "tailtots:insightsPausedUntil";
const OPENS_KEY = "tailtots:dashboardOpens";
const LOCK_KEY = "tailtots:dashboardLockedUntil";
const PAUSE_MS = 14 * 86_400_000; // 2 weeks

// ---------------------------------------------------------------------------
// Pause helpers (shared)
// ---------------------------------------------------------------------------

export function getPausedUntil(): number | null {
  try {
    const raw = localStorage.getItem(PAUSE_KEY);
    if (!raw) return null;
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms <= Date.now()) {
      localStorage.removeItem(PAUSE_KEY);
      return null;
    }
    return ms;
  } catch {
    return null;
  }
}

export function setInsightsPaused(paused: boolean): void {
  try {
    if (paused) localStorage.setItem(PAUSE_KEY, String(Date.now() + PAUSE_MS));
    else localStorage.removeItem(PAUSE_KEY);
  } catch {
    /* storage unavailable — pause simply won't persist */
  }
}

/** Record one dashboard open (coarse timestamp only — no content tracked). */
export function recordDashboardOpen(): void {
  try {
    const raw = localStorage.getItem(OPENS_KEY);
    const events: ParentEngagementEvent[] = raw ? JSON.parse(raw) : [];
    events.push({ openedAt: new Date().toISOString() });
    // Keep the trailing 8 days only.
    const cutoff = Date.now() - 8 * 86_400_000;
    const trimmed = events.filter((e) => Date.parse(e.openedAt) >= cutoff).slice(-200);
    localStorage.setItem(OPENS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

function getEngagementEvents(): ParentEngagementEvent[] {
  try {
    const raw = localStorage.getItem(OPENS_KEY);
    return raw ? (JSON.parse(raw) as ParentEngagementEvent[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// PauseInsightsToggle — parent settings control
// ---------------------------------------------------------------------------

export function PauseInsightsToggle() {
  const [pausedUntil, setPausedUntil] = useState<number | null>(() =>
    typeof window === "undefined" ? null : getPausedUntil(),
  );

  const toggle = useCallback(() => {
    const currentlyPaused = getPausedUntil() !== null;
    setInsightsPaused(!currentlyPaused);
    setPausedUntil(getPausedUntil());
  }, []);

  const paused = pausedUntil !== null;
  const resumeDate = paused ? new Date(pausedUntil).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e3ede8",
        borderRadius: 16,
        padding: "16px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#17231f", margin: "0 0 4px" }}>Pause insights</p>
        <p style={{ fontSize: 13, color: "#4f625b", margin: 0, lineHeight: 1.5 }}>
          {paused
            ? `Insights are paused until ${resumeDate}. Missions keep personalizing quietly.`
            : "Mute all AI insights for 2 weeks. For the overwhelmed weeks — the AI keeps working, you get silence."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={paused}
        aria-label="Pause AI insights for two weeks"
        onClick={toggle}
        style={{
          flexShrink: 0,
          width: 52,
          height: 30,
          borderRadius: 15,
          border: "none",
          background: paused ? "#165a4b" : "#d7e2dd",
          cursor: "pointer",
          position: "relative",
          transition: "background 0.2s",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: paused ? 25 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CalmNudgeBanner + dashboard soft-lock
// ---------------------------------------------------------------------------

export interface DashboardGuardProps {
  childName: string;
  /** Rendered only when the dashboard is NOT soft-locked. */
  children: React.ReactNode;
}

/**
 * Wraps the parent dashboard. Records opens, detects compulsive checking,
 * shows the calm nudge, and soft-locks until tomorrow with a friction-added
 * bypass ("I understand — show me anyway" behind a confirm step).
 */
/** Read the current lock state from storage (pure read — safe for lazy init). */
function readLockActive(): boolean {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw && Number(raw) > Date.now()) return true;
    if (raw) localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
  return false;
}

export function DashboardGuard({ childName, children }: DashboardGuardProps) {
  const [locked, setLocked] = useState(() => typeof window !== "undefined" && readLockActive());
  const [bypassArmed, setBypassArmed] = useState(false);
  // Nudge shows whenever the guard is active (existing lock or fresh detection).
  const [showNudge, setShowNudge] = useState(() => typeof window !== "undefined" && readLockActive());

  // Mount-once engagement check: reads client-only storage, records the open,
  // and soft-locks on compulsive patterns. Intentionally stateful — this is
  // a response to stored state, not a render cascade.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (locked) return; // existing lock respected — nothing more to do
    recordDashboardOpen();
    const state = trackParentEngagement(getEngagementEvents());
    if (shouldThrottleInsights(state)) {
      setShowNudge(true);
      setLocked(true);
      try {
        // Soft-lock until tomorrow morning (local).
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(6, 0, 0, 0);
        localStorage.setItem(LOCK_KEY, String(tomorrow.getTime()));
      } catch {
        /* ignore */
      }
    }
  }, [locked]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const bypass = useCallback(() => {
    if (!bypassArmed) {
      setBypassArmed(true);
      return;
    }
    setLocked(false);
    setBypassArmed(false);
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }, [bypassArmed]);

  if (!locked) return <>{children}</>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <section
        aria-label="A gentle pause"
        style={{
          background: "#e7f4ef",
          border: "1px solid #cfe6db",
          borderRadius: 20,
          padding: 26,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: "#165a4b", margin: "0 0 10px" }}>
          A gentle pause
        </p>
        <p style={{ fontSize: 16, color: "#17231f", margin: "0 0 6px", lineHeight: 1.6 }}>
          {calmNudgeMessage().replace("the kid in front of you", `${childName} in front of you`)}
        </p>
        <p style={{ fontSize: 13, color: "#4f625b", margin: "12px 0 0", lineHeight: 1.55 }}>
          The dashboard will be here tomorrow morning. Nothing is lost — missions keep personalizing.
        </p>
        <button
          type="button"
          onClick={bypass}
          style={{
            marginTop: 18,
            background: "transparent",
            border: "1px solid #9db8ad",
            borderRadius: 12,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 700,
            color: "#165a4b",
            cursor: "pointer",
          }}
        >
          {bypassArmed ? "I understand — show me anyway" : "I need to see it now"}
        </button>
        {bypassArmed && (
          <p style={{ fontSize: 12, color: "#69736f", margin: "10px 0 0" }}>
            Take a breath first. The numbers will look the same in a minute.
          </p>
        )}
      </section>
      {showNudge && null}
    </div>
  );
}

/**
 * Non-blocking hook: returns whether insights are currently paused and the
 * engagement state, for parent views that want to adapt (e.g. hide the
 * Weekly Insight card while paused).
 */
export function useInsightVisibility() {
  const [paused, setPaused] = useState(
    () => typeof window !== "undefined" && getPausedUntil() !== null,
  );
  return { insightsPaused: paused, refresh: () => setPaused(getPausedUntil() !== null) };
}
