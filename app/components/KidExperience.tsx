/**
 * KidExperience — the kid-side retention engine, composed.
 *
 * This is the top of the kid view: age-ladder header, pet evolution,
 * Brave Try streaks. The mission list (existing MissionsPanel content)
 * sits in the middle; MemoryStones closes the page at the bottom.
 *
 * Wires into MissionsPanel with two insertion points — see the
 * <KidExperienceTop> and <KidExperienceBottom> exports.
 */
"use client";

import { useMemo } from "react";
import type { Child, Mission, Pet } from "../../lib/types";
import { getAgeMode, KidModeHeader } from "./AgeMode";
import { Graduation, useGraduation } from "./Graduation";
import { PetEvolution } from "./PetEvolution";
import { BraveTryStreak, braveTriesFromMissions } from "./BraveTryStreak";
import { MemoryStones } from "./MemoryStones";
import type { PetKind } from "./pet-buddy";

function petKindFor(species: string): PetKind {
  const s = species.toLowerCase();
  if (s.includes("dog")) return "dog";
  if (s.includes("cat")) return "cat";
  if (s.includes("guinea")) return "guinea";
  if (s.includes("tortoise") || s.includes("turtle")) return "tortoise";
  if (s.includes("fish")) return "fish";
  if (s.includes("rabbit") || s.includes("bunny")) return "rabbit";
  if (s.includes("hamster")) return "hamster";
  if (s.includes("bird")) return "bird";
  return "pet";
}

export function KidExperienceTop({ child, pets, missions }: { child: Child; pets: Pet[]; missions: Mission[] }) {
  const mode = getAgeMode(child.age);
  const pet = pets[0];
  const { pendingGraduation, dismissGraduation } = useGraduation(child.id, child.age);

  const myMissions = useMemo(() => missions.filter((m) => !m.assignedChildId || m.assignedChildId === child.id), [missions, child.id]);
  const openCount = useMemo(() => myMissions.filter((m) => !m.completedBy && m.status !== "approved").length, [myMissions]);
  const approvedCount = useMemo(
    () => myMissions.filter((m) => Boolean(m.completedBy) || m.status === "approved").length,
    [myMissions]
  );
  const braveTries = useMemo(() => braveTriesFromMissions(missions, child.id), [missions, child.id]);

  return (
    <div className="grid gap-4">
      {pendingGraduation && (
        <Graduation
          childName={child.name}
          fromMode={pendingGraduation.from}
          toMode={pendingGraduation.to}
          petName={pet?.name}
          petKind={pet ? petKindFor(pet.species) : undefined}
          petPhotoUrl={pet?.photoUrl}
          onDone={dismissGraduation}
        />
      )}
      <KidModeHeader
        mode={mode}
        childName={child.name}
        petName={pet?.name}
        openMissionCount={openCount}
        completedCount={approvedCount}
      />
      {pet && (
        <PetEvolution
          approvedCount={approvedCount}
          petKind={petKindFor(pet.species)}
          photoUrl={pet.photoUrl}
          petName={pet.name}
        />
      )}
      <BraveTryStreak tries={braveTries} childName={child.name} />
    </div>
  );
}

export function KidExperienceBottom({ child, missions }: { child: Child; missions: Mission[] }) {
  return (
    <div className="mt-6">
      <MemoryStones missions={missions} childId={child.id} childName={child.name} />
    </div>
  );
}
