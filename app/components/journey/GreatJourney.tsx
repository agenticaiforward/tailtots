/**
 * GreatJourney — The Great Journey for kids without pets.
 *
 * A kid without a pet doesn't need a fake pet — they need a real
 * relationship with a real animal. The Great Journey pairs each kid with
 * a real migratory animal on a real journey (WANT track) or a real
 * shelter animal on its road home (CANT track).
 *
 * "Where animals raise good humans."
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  JOURNEY_ANIMALS,
  SHELTER_ANIMALS,
  getJourneyAnimal,
  getShelterAnimal,
  type JourneyAnimal,
} from "../../lib/great-journey/animals";
import {
  currentLegIndex,
  currentShelterStageIndex,
  formatMiles,
  getJourneyState,
  journeyProgress,
  markLegCelebrated,
  startJourney,
  type JourneyState,
} from "../../lib/great-journey/journey";
import { ShelterStageStory, WildLegStory } from "./JourneyStory";
import type { PetTrack } from "../../lib/pet-tracks";

// ---------------------------------------------------------------------------
// Compact animal picker (used inside onboarding for WANT / CANT tracks)
// ---------------------------------------------------------------------------

export function JourneyAnimalPicker({
  track,
  selectedId,
  onSelect,
}: {
  track: Extract<PetTrack, "want" | "cant">;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (track === "cant") {
    return (
      <div>
        <div className="grid grid-cols-3 gap-3">
          {SHELTER_ANIMALS.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(`shelter:${a.id}`)}
              aria-pressed={selectedId === `shelter:${a.id}`}
              className={`rounded-2xl border-2 p-4 text-center transition-all ${
                selectedId === `shelter:${a.id}`
                  ? "border-tt-pine bg-tt-pine-tint shadow-md"
                  : "border-tt-line bg-white hover:border-tt-pine/50"
              }`}
            >
              <p className="text-4xl" aria-hidden="true">
                {a.emoji}
              </p>
              <p className="tt-body mt-2 text-sm font-black text-tt-navy">{a.name}</p>
              <p className="tt-body text-xs text-tt-ink-faint">
                {a.species} · {a.age}
              </p>
            </button>
          ))}
        </div>
        <p className="tt-body mt-3 text-center text-xs font-semibold text-tt-ink-faint">
          This is a real kind of animal waiting in a real shelter. Your missions help them on their
          journey home.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {JOURNEY_ANIMALS.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(`wild:${a.id}`)}
            aria-pressed={selectedId === `wild:${a.id}`}
            className={`rounded-2xl border-2 p-4 text-center transition-all ${
              selectedId === `wild:${a.id}`
                ? "border-tt-pine bg-tt-pine-tint shadow-md"
                : "border-tt-line bg-white hover:border-tt-pine/50"
            }`}
          >
            <p className="text-4xl" aria-hidden="true">
              {a.emoji}
            </p>
            <p className="tt-body mt-2 text-sm font-black text-tt-navy">{a.name}</p>
            <p className="tt-body mt-1 text-xs font-semibold text-tt-ink-faint">{a.hook}</p>
          </button>
        ))}
      </div>
      <p className="tt-body mt-3 text-center text-xs font-semibold text-tt-ink-faint">
        Real animals. Real journeys. Your missions move them forward.
      </p>
    </div>
  );
}

/** Parse a picker id ("wild:monarch" / "shelter:luna") into kind + animal id. */
export function parseJourneySelection(
  selection: string,
): { kind: "wild" | "shelter"; animalId: string } | null {
  const [kind, id] = selection.split(":");
  if ((kind === "wild" || kind === "shelter") && id) return { kind, animalId: id };
  return null;
}

// ---------------------------------------------------------------------------
// Journey map — SVG path with waypoints, animal marker animates by progress
// ---------------------------------------------------------------------------

function waypointPositions(count: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    pts.push({
      x: 36 + t * 328,
      y: 110 + Math.sin(t * Math.PI * 1.6) * 62,
    });
  }
  return pts;
}

/** Interpolate the marker position between waypoints by 0..1 progress. */
function markerPosition(
  pts: { x: number; y: number }[],
  progress: number,
): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1 || progress <= 0) return pts[0];
  if (progress >= 1) return pts[pts.length - 1];
  const seg = progress * (pts.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

function JourneyMap({
  animal,
  progress,
  currentLeg,
  emoji,
}: {
  animal: JourneyAnimal | null;
  progress: number;
  currentLeg: number;
  emoji: string;
}) {
  const legCount = animal ? animal.legs.length : 5;
  const pts = useMemo(() => waypointPositions(legCount), [legCount]);
  const marker = markerPosition(pts, progress);
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div className="overflow-hidden rounded-3xl border border-tt-line bg-gradient-to-b from-tt-navy to-tt-navy-soft">
      <svg viewBox="0 0 400 220" className="w-full" role="img" aria-label="Journey map">
        {/* stars */}
        {[
          [60, 30],
          [140, 22],
          [230, 36],
          [320, 26],
          [100, 60],
          [280, 66],
          [360, 90],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 1.6 : 2.4} fill="#ffffff" opacity="0.7" />
        ))}
        {/* route path */}
        <path d={pathD} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="3" strokeDasharray="8 6" />
        {/* traveled path */}
        <path
          d={pathD}
          fill="none"
          stroke="#ffd166"
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 1.2s ease",
          }}
          pathLength={1000}
          strokeDasharray="1000"
          strokeDashoffset={1000 * (1 - progress)}
        />
        {/* waypoints */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={i <= currentLeg ? 9 : 6}
              fill={i < currentLeg ? "#4ade80" : i === currentLeg ? "#ffd166" : "#ffffff"}
              opacity={i <= currentLeg ? 1 : 0.45}
            />
            {i === currentLeg && (
              <circle cx={p.x} cy={p.y} r={13} fill="none" stroke="#ffd166" strokeWidth="2" opacity="0.6">
                <animate attributeName="r" values="11;16;11" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0.2;0.7" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}
        {/* animal marker */}
        <g style={{ transition: "transform 1.2s ease" }} transform={`translate(${marker.x},${marker.y})`}>
          <text textAnchor="middle" dy="8" fontSize="26">
            {emoji}
          </text>
        </g>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full Great Journey view
// ---------------------------------------------------------------------------

export default function GreatJourney({
  childId,
  childName,
  track,
}: {
  childId: string;
  childName: string;
  track: Extract<PetTrack, "want" | "cant">;
}) {
  const [state, setState] = useState<JourneyState | null>(() => getJourneyState(childId));
  const [picking, setPicking] = useState(!getJourneyState(childId));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setState(getJourneyState(childId));
    setPicking(!getJourneyState(childId));
  }, [childId]);

  const beginJourney = () => {
    const sel = selectedId ?? (track === "want" ? "wild:monarch" : "shelter:luna");
    const parsed = parseJourneySelection(sel);
    if (!parsed) return;
    const s = startJourney(childId, parsed.kind, parsed.animalId);
    setState(s);
    setPicking(false);
  };

  if (picking || !state) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-black text-tt-ink">
            {track === "want" ? "Choose your traveling companion" : "Meet your shelter friend"}
          </h2>
          <p className="mt-1 text-sm font-semibold text-tt-ink-soft">
            {track === "want"
              ? "A real animal on a real journey. Your missions move them forward."
              : "A real animal on the road home. Your kindness missions light the way."}
          </p>
        </div>
        <JourneyAnimalPicker
          track={track}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <button
          onClick={beginJourney}
          className="tt-btn-press min-h-12 w-full rounded-2xl bg-tt-pine px-6 py-3 text-sm font-extrabold text-white"
        >
          Start the journey →
        </button>
      </div>
    );
  }

  const isWild = state.kind === "wild";
  const animal = isWild ? getJourneyAnimal(state.animalId) : null;
  const shelterAnimal = !isWild ? getShelterAnimal(state.animalId) : null;
  const progress = journeyProgress(state);
  const legIndex = isWild ? currentLegIndex(state) : currentShelterStageIndex(state);
  const emoji = animal?.emoji ?? shelterAnimal?.emoji ?? "🐾";

  // Celebrate a newly reached leg once.
  useEffect(() => {
    if (!state.celebratedLegs.includes(legIndex)) {
      markLegCelebrated(childId, legIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legIndex, childId]);

  const milesLabel = animal ? `${formatMiles(state.milesEarned)} of ${formatMiles(animal.totalDistanceMi)} miles` : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-tt-pine">
            The Great Journey
          </p>
          <h2 className="text-xl font-black text-tt-ink">
            {animal ? animal.name : shelterAnimal?.name}
            {state.journeyCompletedAt ? " 🎉" : ""}
          </h2>
        </div>
        <button
          onClick={() => setPicking(true)}
          className="text-xs font-bold text-tt-ink-faint underline"
        >
          Switch animal
        </button>
      </div>

      {/* Map */}
      {animal ? (
        <JourneyMap animal={animal} progress={progress} currentLeg={legIndex} emoji={emoji} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-tt-line bg-gradient-to-b from-tt-pine to-tt-navy p-5 text-center text-white">
          <p className="text-5xl" aria-hidden="true">
            {emoji}
          </p>
          <p className="mt-2 text-lg font-black">{shelterAnimal?.name}'s road home</p>
          <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
            {shelterAnimal?.stages.map((s, i) => (
              <span
                key={s.name}
                className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                  i < legIndex
                    ? "bg-tt-sun text-tt-ink"
                    : i === legIndex
                      ? "bg-white text-tt-navy"
                      : "bg-white/20 text-white/70"
                }`}
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="rounded-2xl bg-tt-cream p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-extrabold text-tt-ink">
            {state.journeyCompletedAt
              ? "Journey complete!"
              : `${Math.round(progress * 100)}% of the way there`}
          </p>
          <p className="text-xs font-bold text-tt-ink-faint">
            {milesLabel ?? `${state.missionsCompleted} kindness missions`}
          </p>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-tt-line"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-tt-pine transition-all duration-700"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold text-tt-ink-soft">
          {state.journeyCompletedAt
            ? isWild
              ? `${animal?.name} made it — and so did you. What a journey.`
              : `${shelterAnimal?.name} found home — your kindness helped. Choose a new friend to begin again.`
            : "Every mission you complete moves the journey forward."}
        </p>
      </div>

      {/* Current leg story */}
      {animal && animal.legs[legIndex] && (
        <WildLegStory animal={animal} leg={animal.legs[legIndex]} legIndex={legIndex} childName={childName} />
      )}
      {shelterAnimal && shelterAnimal.stages[legIndex] && (
        <ShelterStageStory
          animal={shelterAnimal}
          stage={shelterAnimal.stages[legIndex]}
          stageIndex={legIndex}
          childName={childName}
        />
      )}
    </div>
  );
}
