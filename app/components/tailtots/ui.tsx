"use client";

import Image from "next/image";
import type { Child, Pet } from "@/lib/types";
import type { ParentProfile, PetKind } from "@/lib/domain/family-types";
import { getChildLook, getPetLook } from "./avatar-looks";
export function ChildProfileSwitcher({
  activeChild,
  childProfiles,
  requestChildSwitch,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  requestChildSwitch: (childId: string) => void;
}) {
  const activeLook = getChildLook(activeChild?.id);

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-[#fff4d8] p-4 shadow-sm" aria-label="Child profile switcher">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a4f00]">Who is using TailTots?</p>
      <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg bg-white p-3">
        <ProfilePhoto
          label={activeChild?.name ?? "Kid"}
          initial={activeLook.initial}
          colors={activeLook.colors}
          variant="kid"
          hair={activeLook.hair}
          photoUrl={activeChild?.photoUrl}
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-[#17231f]">{activeChild?.name ?? "Choose a kid"}</p>
          <p className="text-xs font-bold text-[#6f5c31]">Active profile on this screen</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {childProfiles.map((child) => {
          const look = getChildLook(child.id);
          const isActive = child.id === activeChild?.id;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => requestChildSwitch(child.id)}
              className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black ${
                isActive ? "border-[#f47b20] bg-[#17231f] text-white" : "border-[#e1d5b9] bg-white text-[#17231f]"
              }`}
            >
              <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
              <span className="min-w-0 flex-1 truncate">{child.name}</span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.1em] ${isActive ? "bg-white text-[#17231f]" : "bg-[#f8f6ed] text-[#6f5c31]"}`}>
                {isActive ? "Using now" : "Switch"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FamilyFaceParade({
  parents,
  childProfiles,
  pets,
  compact = false,
  animated = false,
}: {
  parents: ParentProfile[];
  childProfiles: Child[];
  pets: Pet[];
  compact?: boolean;
  animated?: boolean;
}) {
  const people = [
    ...parents.map((parent) => ({ id: parent.id, name: parent.name, photoUrl: parent.photoUrl, initial: parent.name.trim()[0]?.toUpperCase() ?? "P", colors: "from-[#ffd166] via-[#f47b20] to-[#7c3aed]", hair: "#4a2718" })),
    ...childProfiles.map((child) => {
      const look = getChildLook(child.id);
      return { id: child.id, name: child.name, photoUrl: child.photoUrl, initial: look.initial, colors: look.colors, hair: look.hair };
    }),
  ];
  const visiblePets = compact ? pets.slice(0, 1) : pets;

  if (animated) {
    return (
      <div className="flex max-w-full flex-wrap items-end justify-center gap-1 overflow-hidden px-3 sm:gap-2">
        {people.map((person, index) => (
          <AnimatedFamilyCharacter
            key={person.id}
            tone={["#ffd166", "#f6b38a", "#c58b6a", "#f4c7a1"][index % 4]}
            shirt={["#165a4b", "#7c3aed", "#f47b20", "#2563eb"][index % 4]}
            delay={`${index * 0.12}s`}
            photoUrl={person.photoUrl}
            label={person.name}
          />
        ))}
        {visiblePets.map((pet, index) => (
          <AnimatedPetBuddy key={pet.id} color={index % 2 === 0 ? "#f47b20" : "#0f766e"} delay={`${(people.length + index) * 0.12}s`} photoUrl={pet.photoUrl} label={pet.name} kind={getPetLook(pet.id).kind} />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex ${compact ? "-space-x-4" : "-space-x-3"}`}>
      {people.map((person) => {
        return (
          <ProfilePhoto
            key={person.id}
            label={person.name}
            initial={person.initial}
            colors={person.colors}
            size={compact ? "xs" : "md"}
            variant="kid"
            hair={person.hair}
            photoUrl={person.photoUrl}
          />
        );
      })}
      {visiblePets.map((pet) => {
        const look = getPetLook(pet.id);
        return <ProfilePhoto key={pet.id} label={pet.name} initial={look.face} colors={look.colors} size={compact ? "xs" : "md"} variant="pet" petKind={look.kind} photoUrl={pet.photoUrl} />;
      })}
    </div>
  );
}

export function ProfilePhoto({
  label,
  initial,
  colors,
  size = "md",
  variant = "kid",
  hair = "#2f1b12",
  petKind = "pet",
  photoUrl,
}: {
  label: string;
  initial: string;
  colors: string;
  size?: "xs" | "md" | "lg";
  variant?: "kid" | "pet";
  hair?: string;
  petKind?: PetKind;
  photoUrl?: string;
}) {
  const sizeClass = size === "lg" ? "h-28 w-24 text-4xl" : size === "xs" ? "h-8 w-8 text-xs" : "h-20 w-16 text-2xl";
  return (
    <div
      aria-label={`${label} animated profile`}
      className={`${sizeClass} relative grid shrink-0 place-items-center overflow-visible rounded-lg font-black text-white`}
      title={`${label} animated profile`}
    >
      <div className={`absolute inset-x-2 bottom-0 h-4 rounded-full bg-gradient-to-r ${colors} opacity-30 blur-sm`} />
      <div className="relative">
        {variant === "pet" ? (
          <PetCharacter kind={petKind} size={size} photoUrl={photoUrl} label={label} />
        ) : (
          <KidCharacter initial={initial} hair={hair} size={size} photoUrl={photoUrl} label={label} />
        )}
      </div>
    </div>
  );
}

export function KidCharacter({
  initial,
  hair,
  size,
  photoUrl,
  label,
}: {
  initial: string;
  hair: string;
  size: "xs" | "md" | "lg";
  photoUrl?: string;
  label: string;
}) {
  const compact = size === "xs";
  return (
    <div className={`relative ${compact ? "scale-[0.45]" : size === "lg" ? "scale-110" : "scale-90"} animate-[character-bob_2.8s_ease-in-out_infinite]`}>
      <div className="absolute -left-5 top-6 h-7 w-3 origin-top rounded-full bg-[#8b5cf6] ring-2 ring-white animate-[arm-wave_1.8s_ease-in-out_infinite]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#ffd6a5] ring-2 ring-white" />
      </div>
      <div className="absolute -right-5 top-7 h-7 w-3 origin-top rounded-full bg-[#0ea5e9] ring-2 ring-white animate-[arm-wave_2.1s_ease-in-out_infinite_reverse]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full bg-[#ffd6a5] ring-2 ring-white" />
      </div>
      <div className="relative size-14 overflow-hidden rounded-full bg-[#ffe7c2] shadow-inner ring-2 ring-white/80">
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label} captured face`} fill sizes="64px" className="object-cover object-center" unoptimized />
        ) : (
          <>
            <div className="absolute -top-2 left-2 right-2 h-5 rounded-t-full" style={{ backgroundColor: hair }} />
            <div className="absolute left-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute right-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute bottom-3 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
          </>
        )}
      </div>
      <div className="mx-auto -mt-1 grid h-8 w-12 place-items-center rounded-t-2xl bg-white/90 text-sm font-black text-[#17231f]">
        {initial}
      </div>
    </div>
  );
}

export function PetCharacter({
  kind,
  size,
  photoUrl,
  label,
}: {
  kind: PetKind;
  size: "xs" | "md" | "lg";
  photoUrl?: string;
  label: string;
}) {
  const compact = size === "xs";
  const isFish = kind === "fish";
  const isTortoise = kind === "tortoise";
  const isGuinea = kind === "guinea";
  if (isFish && !photoUrl) {
    return (
      <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[fish-swim_2.6s_ease-in-out_infinite]`}>
        <div className="absolute -left-3 top-7 size-4 rounded-full bg-[#bae6fd] opacity-80 animate-[bubble-rise_2.4s_ease-in-out_infinite]" />
        <div className="absolute -right-2 top-5 h-7 w-6 rounded-r-full bg-[#38bdf8] [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
        <div className="relative h-14 w-20 overflow-hidden rounded-[999px] bg-[#06b6d4] shadow-inner ring-2 ring-white/80">
          <div className="absolute left-2 top-1 h-12 w-12 rounded-full bg-[#67e8f9]" />
          <div className="absolute right-5 top-5 size-2 rounded-full bg-[#17231f]" />
          <div className="absolute bottom-2 left-8 h-3 w-8 rounded-full bg-[#0e7490] opacity-35" />
        </div>
      </div>
    );
  }

  if (isTortoise && !photoUrl) {
    return (
      <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[tortoise-step_3s_ease-in-out_infinite]`}>
        <div className="absolute left-0 top-10 size-4 rounded-full bg-[#84cc16] ring-2 ring-white" />
        <div className="absolute right-2 top-12 h-3 w-4 rounded-full bg-[#65a30d]" />
        <div className="absolute bottom-2 left-3 size-4 rounded-full bg-[#65a30d]" />
        <div className="absolute bottom-2 right-4 size-4 rounded-full bg-[#65a30d]" />
        <div className="relative h-14 w-20 rounded-[999px] bg-[#365314] shadow-inner ring-2 ring-white/80">
          <div className="absolute inset-2 rounded-[999px] bg-[#86efac]" />
          <div className="absolute left-8 top-4 h-6 w-1 rounded-full bg-[#365314] opacity-40" />
          <div className="absolute left-5 top-6 h-1 w-10 rounded-full bg-[#365314] opacity-35" />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[pet-wiggle_2.4s_ease-in-out_infinite]`}>
      {kind === "dog" ? (
        <>
          <div className="absolute -left-4 top-2 h-9 w-5 rotate-[-22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_1.9s_ease-in-out_infinite]" />
          <div className="absolute -right-4 top-2 h-9 w-5 rotate-[22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_2.1s_ease-in-out_infinite_reverse]" />
        </>
      ) : (
        <>
          <div className={`absolute -left-2 top-0 rounded-full ${isGuinea ? "size-6 bg-[#f7d7aa]" : "size-5 bg-[#f7d7aa]"}`} />
          <div className={`absolute -right-2 top-0 rounded-full ${isGuinea ? "size-6 bg-[#f7d7aa]" : "size-5 bg-[#f7d7aa]"}`} />
        </>
      )}
      <div className={`relative size-16 overflow-hidden rounded-full shadow-inner ring-2 ring-white/80 ${isGuinea ? "bg-[#d97706]" : "bg-[#f9d8a7]"}`}>
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label} pet photo`} fill sizes="72px" className="bg-white object-contain p-1" unoptimized />
        ) : (
          <>
            {isGuinea && <div className="absolute -left-2 top-2 h-14 w-9 rounded-full bg-[#fbbf24]" />}
            {isGuinea ? (
              <>
                <div className="absolute left-3.5 top-5 size-3 rounded-full bg-[#3b2417] shadow-sm">
                  <span className="absolute left-1 top-0.5 size-1 rounded-full bg-white/90" />
                </div>
                <div className="absolute right-3.5 top-5 size-3 rounded-full bg-[#3b2417] shadow-sm">
                  <span className="absolute left-1 top-0.5 size-1 rounded-full bg-white/90" />
                </div>
                <div className="absolute left-1/2 top-8 size-2.5 -translate-x-1/2 rounded-full bg-[#7c2d12]" />
                <div className="absolute bottom-4 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#7c2d12]" />
                <div className="absolute bottom-5 left-[1.15rem] h-1 w-3 rounded-full bg-[#fef3c7]/70" />
                <div className="absolute bottom-5 right-[1.15rem] h-1 w-3 rounded-full bg-[#fef3c7]/70" />
              </>
            ) : (
              <>
                <div className="absolute left-4 top-6 size-2 rounded-full bg-[#17231f]" />
                <div className="absolute right-4 top-6 size-2 rounded-full bg-[#17231f]" />
                <div className="absolute left-1/2 top-8 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
                <div className="absolute bottom-3 left-1/2 h-2 w-6 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
                <div className="absolute -bottom-1 right-2 h-3 w-6 rounded-full bg-[#ff7a7a] animate-[tongue-pop_2.5s_ease-in-out_infinite]" />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function AnimatedFamilyCharacter({
  tone,
  shirt,
  delay,
  photoUrl,
  label,
}: {
  tone: string;
  shirt: string;
  delay: string;
  photoUrl?: string;
  label?: string;
}) {
  return (
    <div className="relative h-24 w-16 animate-[character-bob_2.6s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <span className="absolute -right-2 -top-2 size-3 rounded-full bg-[#ffd166] shadow-[0_0_14px_rgba(255,209,102,0.9)] animate-[reward-pop_2.4s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-0 size-12 -translate-x-1/2 overflow-hidden rounded-full shadow-inner ring-2 ring-white/80" style={{ backgroundColor: tone }}>
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label ?? "Family member"} captured face`} fill sizes="56px" className="object-cover" unoptimized />
        ) : (
          <>
            <div className="absolute left-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute right-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
            <div className="absolute bottom-2 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
          </>
        )}
      </div>
      <div className="absolute bottom-0 left-1/2 h-12 w-14 -translate-x-1/2 rounded-t-3xl" style={{ backgroundColor: shirt }} />
      <div className="absolute bottom-7 left-0 h-8 w-3 origin-top rounded-full bg-[#8b5cf6] ring-2 ring-white animate-[arm-wave_1.7s_ease-in-out_infinite]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full ring-2 ring-white" style={{ backgroundColor: tone }} />
      </div>
      <div className="absolute bottom-7 right-0 h-8 w-3 origin-top rounded-full bg-[#0ea5e9] ring-2 ring-white animate-[arm-wave_2s_ease-in-out_infinite_reverse]">
        <span className="absolute -bottom-1 left-1/2 size-4 -translate-x-1/2 rounded-full ring-2 ring-white" style={{ backgroundColor: tone }} />
      </div>
    </div>
  );
}

export function AnimatedPetBuddy({ color, delay, photoUrl, label, kind = "pet" }: { color: string; delay: string; photoUrl?: string; label?: string; kind?: PetKind }) {
  if (!photoUrl && kind === "fish") {
    return (
      <div className="relative h-20 w-20 animate-[fish-swim_2.4s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
        <div className="absolute left-2 top-7 size-3 rounded-full bg-[#bae6fd] animate-[bubble-rise_2.4s_ease-in-out_infinite]" />
        <div className="absolute right-3 top-8 h-8 w-7 bg-[#38bdf8] [clip-path:polygon(0_50%,100%_0,100%_100%)]" />
        <div className="absolute bottom-4 left-1/2 h-12 w-16 -translate-x-1/2 rounded-[999px] bg-[#06b6d4] ring-2 ring-white/80">
          <div className="absolute right-5 top-4 size-2 rounded-full bg-[#17231f]" />
        </div>
      </div>
    );
  }
  if (!photoUrl && kind === "tortoise") {
    return (
      <div className="relative h-20 w-20 animate-[tortoise-step_3s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
        <div className="absolute left-2 top-9 size-4 rounded-full bg-[#84cc16] ring-2 ring-white" />
        <div className="absolute bottom-3 left-1/2 h-12 w-16 -translate-x-1/2 rounded-[999px] bg-[#365314] ring-2 ring-white/80">
          <div className="absolute inset-2 rounded-[999px] bg-[#86efac]" />
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-20 w-20 animate-[pet-wiggle_2.1s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <div className="absolute left-2 top-3 h-9 w-5 -rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute right-2 top-3 h-9 w-5 rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute bottom-0 left-1/2 size-16 -translate-x-1/2 overflow-hidden rounded-full ring-2 ring-white/80" style={{ backgroundColor: color }}>
        {photoUrl ? (
          <Image src={photoUrl} alt={`${label ?? "Pet"} captured face`} fill sizes="72px" className="object-cover" unoptimized />
        ) : (
          <>
            <div className="absolute left-5 top-7 size-2 rounded-full bg-[#17231f]" />
            <div className="absolute right-5 top-7 size-2 rounded-full bg-[#17231f]" />
            <div className="absolute bottom-4 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
          </>
        )}
      </div>
    </div>
  );
}

export function Meter({ label, value, color, dark = false }: { label: string; value: number; color: string; dark?: boolean }) {
  return (
    <div>
      <div className={`mb-2 flex justify-between text-xs font-black ${dark ? "text-white" : "text-[#25352f]"}`}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className={`h-3 rounded-full ${dark ? "bg-white/20" : "bg-[#ece5d2]"}`}>
        <div className="h-3 rounded-full" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
