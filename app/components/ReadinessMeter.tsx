/**
 * ReadinessMeter — the WANT track's earn-your-pet journey.
 *
 * "Care for your buddy to show you're ready for a real pet!"
 * Tracks consistency → readiness score → certificate at 80+.
 * Parent gets a readiness report to support the real-pet decision.
 */
"use client";

import {
  READINESS_THRESHOLD,
  readinessBlurb,
  readinessScore,
  type ReadinessInput,
} from "../../lib/pet-tracks";

export default function ReadinessMeter({
  input,
  buddyName = "Buddy",
}: {
  input: ReadinessInput;
  buddyName?: string;
}) {
  const score = readinessScore(input);
  const unlocked = score >= READINESS_THRESHOLD;
  const pct = Math.min(100, score);

  return (
    <section
      aria-label="Pet readiness"
      className="rounded-3xl border-2 border-tt-line bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {unlocked ? "🏆" : "🌱"}
        </span>
        <div>
          <h3 className="tt-heading text-lg text-tt-navy">
            {unlocked ? "Ready for a real pet!" : "Growing toward a real pet"}
          </h3>
          <p className="tt-body text-sm text-tt-ink-faint">{readinessBlurb(score)}</p>
        </div>
      </div>

      {/* Meter */}
      <div
        className="mt-4 h-4 overflow-hidden rounded-full bg-tt-cream"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Readiness ${score} out of 100`}
      >
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            unlocked ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-tt-pine"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="tt-body mt-1 flex justify-between text-xs font-bold text-tt-ink-faint">
        <span>{score}/100</span>
        <span>Certificate at {READINESS_THRESHOLD}</span>
      </div>

      {/* Breakdown */}
      <div className="tt-body mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-tt-cream p-2">
          <p className="text-lg font-black text-tt-navy">{input.activeDays30d}</p>
          <p className="text-tt-ink-faint">care days</p>
        </div>
        <div className="rounded-xl bg-tt-cream p-2">
          <p className="text-lg font-black text-tt-navy">{input.careMissions}</p>
          <p className="text-tt-ink-faint">missions</p>
        </div>
        <div className="rounded-xl bg-tt-cream p-2">
          <p className="text-lg font-black text-tt-navy">{input.streakDays}</p>
          <p className="text-tt-ink-faint">day streak</p>
        </div>
      </div>

      {unlocked ? (
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 p-4 text-center">
          <p className="text-4xl" aria-hidden="true">
            🎓
          </p>
          <p className="tt-heading mt-1 text-tt-navy">Pet Readiness Certificate</p>
          <p className="tt-body mt-1 text-sm text-tt-ink-faint">
            {buddyName} helped prove it — this family shows real-pet consistency. Show this to a
            grown-up when you&rsquo;re ready to talk about a real pet!
          </p>
        </div>
      ) : (
        <p className="tt-body mt-3 text-center text-sm text-tt-ink-faint">
          Keep caring for {buddyName} every day — consistency is what real pets need most. 💛
        </p>
      )}
    </section>
  );
}

/** Parent-facing readiness report — data to support the real-pet decision. */
export function ReadinessReport({
  input,
  childName,
  buddyName = "Buddy",
}: {
  input: ReadinessInput;
  childName: string;
  buddyName?: string;
}) {
  const score = readinessScore(input);
  return (
    <section aria-label="Readiness report" className="rounded-3xl border border-tt-line bg-white p-5">
      <h3 className="tt-heading text-lg text-tt-navy">Pet readiness report</h3>
      <p className="tt-body mt-1 text-sm text-tt-ink-faint">
        {childName} has cared for {buddyName} for {input.activeDays30d} days this month, completing{" "}
        {input.careMissions} care missions with a {input.streakDays}-day streak. Readiness score:{" "}
        <strong className="text-tt-navy">{score}/100</strong>.
      </p>
      <p className="tt-body mt-2 text-sm text-tt-ink-faint">
        {score >= READINESS_THRESHOLD
          ? "This level of consistency matches what real pet care requires. A conversation about a real pet could be timely."
          : "Real pet care needs daily consistency over months. This report will keep updating as the rhythm builds."}
      </p>
    </section>
  );
}
