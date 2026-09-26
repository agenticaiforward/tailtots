/**
 * Avatar visuals for kids and pets (presentation layer).
 *
 * These are look-and-feel constants for profile illustrations. Business
 * logic must not depend on them; import from `@/lib/domain` instead.
 */
import type { PetKind } from "@/lib/domain/family-types";

export type ChildLook = { initial: string; colors: string; joy: number; love: number; hair: string };
export type PetLook = { face: string; colors: string; happiness: number; loved: number; kind: PetKind };

export const childLooks: Record<string, ChildLook> = {
  sahasra: { initial: "S", colors: "from-[#ffcf70] via-[#ff8a65] to-[#7c3aed]", joy: 92, love: 88, hair: "#4a2718" },
  aarush: { initial: "A", colors: "from-[#79d6ff] via-[#4ade80] to-[#2563eb]", joy: 78, love: 84, hair: "#1f2937" },
};

export const petLooks: Record<string, PetLook> = {
  jack: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 94, loved: 91, kind: "guinea" },
  jamie: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 83, loved: 89, kind: "guinea" },
  captain: { face: "C", colors: "from-[#86efac] via-[#65a30d] to-[#365314]", happiness: 88, loved: 90, kind: "tortoise" },
  rb: { face: "R", colors: "from-[#93c5fd] via-[#06b6d4] to-[#1d4ed8]", happiness: 86, loved: 87, kind: "fish" },
};

const fallbackChildLook: ChildLook = { initial: "K", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", joy: 80, love: 80, hair: "#2f1b12" };
const fallbackPetLook: PetLook = { face: "P", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", happiness: 80, loved: 80, kind: "pet" };

export function getChildLook(childId?: string): ChildLook {
  return childLooks[childId ?? ""] ?? fallbackChildLook;
}

export function getPetLook(petId?: string): PetLook {
  return petLooks[petId ?? ""] ?? fallbackPetLook;
}
