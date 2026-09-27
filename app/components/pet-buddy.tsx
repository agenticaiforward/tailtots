/**
 * pet-buddy — species accessory library for pet faces.
 *
 * The rule: the animal's REAL face (uploaded photo) is always the hero.
 * Illustrated species graphics (ears, tails, whiskers, fins, shells) are
 * composited AROUND the photo — peeking from behind the face circle or as
 * subtle overlays — never covering the face itself.
 *
 * Usage:
 *   <PetBuddyFace kind="guinea" photoUrl={pet.photoUrl} label={pet.name} size="md" />
 *
 * Adding a species: add a `PetKind` value and a kit entry in PET_KITS.
 */
import Image from "next/image";
import type { ReactNode } from "react";

export type PetKind =
  | "dog"
  | "cat"
  | "guinea"
  | "tortoise"
  | "fish"
  | "rabbit"
  | "hamster"
  | "bird"
  | "pet";

export type BuddySize = "xs" | "md" | "lg";

type SpeciesKit = {
  /** Rendered behind the face circle: ears on top, tail on the side, feet below. */
  behind: (animated: boolean) => ReactNode;
  /** Rendered over the face circle: whiskers, cheek blush — always subtle. */
  over?: (animated: boolean) => ReactNode;
  /** Shown inside the face circle when there is no photo yet. */
  fallback: ReactNode;
};

const svgWrap = "h-full w-full";
const flop = (animated: boolean, slow = false) =>
  animated ? `animate-[ear-flop_${slow ? "2.6" : "1.9"}s_ease-in-out_infinite]` : "";
const wag = (animated: boolean, dur = "1.6s") =>
  animated ? `animate-[tail-wag_${dur}_ease-in-out_infinite]` : "";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Eyes({ y = "42%" }: { y?: string }) {
  const eye =
    "absolute size-[10%] rounded-full bg-[#17231f]";
  return (
    <>
      <div className={eye} style={{ left: "30%", top: y }}>
        <span className="absolute left-[20%] top-[15%] size-[35%] rounded-full bg-white/90" />
      </div>
      <div className={eye} style={{ right: "30%", top: y }}>
        <span className="absolute left-[20%] top-[15%] size-[35%] rounded-full bg-white/90" />
      </div>
    </>
  );
}

/** Small rounded ears — guinea pigs, hamsters, generic pets. */
function RoundEars({ animated, color = "#f7d7aa", inner = "#e8a56b" }: { animated: boolean; color?: string; inner?: string }) {
  const ear = (
    <svg viewBox="0 0 100 100" className={svgWrap}>
      <path d="M50 96 C22 96 10 64 24 38 C36 16 64 16 76 38 C90 64 78 96 50 96 Z" fill={color} />
      <path d="M50 82 C34 82 26 62 34 46 C42 32 58 32 66 46 C74 62 66 82 50 82 Z" fill={inner} />
    </svg>
  );
  return (
    <>
      <div className={`absolute left-[16%] top-[2%] z-0 h-[22%] w-[20%] origin-bottom ${flop(animated, true)}`}>{ear}</div>
      <div className={`absolute right-[16%] top-[2%] z-0 h-[22%] w-[20%] origin-bottom ${flop(animated, true)}`}>{ear}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* DOG — floppy ears + wagging tail                                    */
/* ------------------------------------------------------------------ */

const dogKit: SpeciesKit = {
  behind: (animated) => {
    const ear = (
      <svg viewBox="0 0 100 100" className={svgWrap}>
        <path d="M55 4 C28 4 12 34 16 66 C18 88 38 92 48 70 C56 52 62 22 55 4 Z" fill="#8a5a33" />
        <path d="M48 18 C34 20 26 40 28 60 C30 72 40 70 44 56 C48 44 50 28 48 18 Z" fill="#6e4423" opacity="0.7" />
      </svg>
    );
    return (
      <>
        <div className={`absolute -left-[4%] top-[1%] z-0 h-[36%] w-[30%] origin-top ${flop(animated)}`}>{ear}</div>
        <div className={`absolute -right-[4%] top-[1%] z-0 h-[36%] w-[30%] origin-top -scale-x-100 ${flop(animated)}`}>{ear}</div>
        <div className={`absolute -right-[9%] top-[46%] z-0 h-[34%] w-[24%] origin-bottom-left ${wag(animated, "1.5s")}`}>
          <svg viewBox="0 0 100 100" className={svgWrap}>
            <path d="M30 96 C58 78 72 44 88 12 C93 4 100 10 94 20 C76 50 58 80 40 98 Z" fill="#8a5a33" />
            <path d="M82 12 C86 8 92 10 90 16 L78 34 C74 30 76 20 82 12 Z" fill="#f3ddba" />
          </svg>
        </div>
      </>
    );
  },
  fallback: (
    <div className="absolute inset-0 bg-[#c99a63]">
      <Eyes />
      <div className="absolute bottom-[26%] left-1/2 h-[26%] w-[44%] -translate-x-1/2 rounded-full bg-[#f3ddba]" />
      <div className="absolute bottom-[38%] left-1/2 size-[12%] -translate-x-1/2 rounded-full bg-[#3b2417]" />
      <div className="absolute bottom-[16%] left-1/2 h-[10%] w-[30%] -translate-x-1/2 rounded-b-full border-b-[3px] border-[#3b2417]" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* CAT — pointy ears + curly tail + whiskers                           */
/* ------------------------------------------------------------------ */

const catKit: SpeciesKit = {
  behind: (animated) => {
    const ear = (
      <svg viewBox="0 0 100 100" className={svgWrap}>
        <path d="M12 92 L34 12 L72 66 Z" fill="#f5a54a" />
        <path d="M28 72 L38 32 L58 60 Z" fill="#ffb3a0" />
      </svg>
    );
    return (
      <>
        <div className={`absolute left-[2%] top-[0%] z-0 h-[30%] w-[28%] origin-bottom ${flop(animated, true)}`}>{ear}</div>
        <div className={`absolute right-[2%] top-[0%] z-0 h-[30%] w-[28%] origin-bottom -scale-x-100 ${flop(animated, true)}`}>{ear}</div>
        <div className={`absolute -right-[10%] top-[40%] z-0 h-[44%] w-[26%] origin-bottom ${wag(animated, "1.8s")}`}>
          <svg viewBox="0 0 100 140" className={svgWrap}>
            <path d="M40 132 C30 96 34 60 62 34 C76 21 92 20 94 32 C95 42 82 46 72 52 C52 64 48 96 56 130 Z" fill="#f5a54a" />
            <path d="M62 34 C76 21 92 20 94 32 C95 40 86 44 78 48 L64 44 Z" fill="#e08a2e" />
          </svg>
        </div>
      </>
    );
  },
  over: () => {
    const line = "stroke-white stroke-[3] opacity-70";
    return (
      <div className="pointer-events-none absolute inset-0 z-20">
        <svg viewBox="0 0 100 100" className={svgWrap} fill="none" strokeLinecap="round">
          <line x1="4" y1="62" x2="30" y2="58" className={line} />
          <line x1="4" y1="72" x2="30" y2="70" className={line} />
          <line x1="4" y1="82" x2="30" y2="80" className={line} />
          <line x1="96" y1="62" x2="70" y2="58" className={line} />
          <line x1="96" y1="72" x2="70" y2="70" className={line} />
          <line x1="96" y1="82" x2="70" y2="80" className={line} />
        </svg>
      </div>
    );
  },
  fallback: (
    <div className="absolute inset-0 bg-[#f5c06a]">
      <div className="absolute left-[30%] top-[6%] h-[16%] w-[8%] rotate-[-14deg] rounded-full bg-[#e08a2e]" />
      <div className="absolute left-[46%] top-[4%] h-[18%] w-[8%] rounded-full bg-[#e08a2e]" />
      <div className="absolute left-[62%] top-[6%] h-[16%] w-[8%] rotate-[14deg] rounded-full bg-[#e08a2e]" />
      <Eyes />
      <div className="absolute bottom-[30%] left-1/2 size-[10%] -translate-x-1/2 rounded-full bg-[#e26d6d]" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* GUINEA PIG — small round ears on top + tiny feet                    */
/* ------------------------------------------------------------------ */

const guineaKit: SpeciesKit = {
  behind: (animated) => (
    <>
      <RoundEars animated={animated} />
      <div className="absolute bottom-[0%] left-[18%] z-0 h-[14%] w-[16%] rounded-full bg-[#b45309]" />
      <div className="absolute bottom-[0%] right-[18%] z-0 h-[14%] w-[16%] rounded-full bg-[#b45309]" />
    </>
  ),
  fallback: (
    <div className="absolute inset-0 bg-[#d97706]">
      <div className="absolute left-1/2 top-0 h-[46%] w-[34%] -translate-x-1/2 rounded-b-full bg-[#f7d7aa] opacity-90" />
      <Eyes />
      <div className="absolute bottom-[30%] left-1/2 size-[9%] -translate-x-1/2 rounded-full bg-[#7c2d12]" />
      <div className="absolute bottom-[18%] left-[30%] h-[6%] w-[12%] rounded-full bg-[#fef3c7]/70" />
      <div className="absolute bottom-[18%] right-[30%] h-[6%] w-[12%] rounded-full bg-[#fef3c7]/70" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* RABBIT — long upright ears + fluffy tail                            */
/* ------------------------------------------------------------------ */

const rabbitKit: SpeciesKit = {
  behind: (animated) => {
    const ear = (
      <svg viewBox="0 0 100 160" className={svgWrap}>
        <path d="M50 156 C30 110 26 60 34 14 C37 2 63 2 66 14 C74 60 70 110 50 156 Z" fill="#b3a4c7" />
        <path d="M50 140 C40 108 38 66 42 30 C44 22 56 22 58 30 C62 66 60 108 50 140 Z" fill="#ffc7d6" />
      </svg>
    );
    return (
      <>
        <div className={`absolute left-[24%] top-[-14%] z-0 h-[46%] w-[20%] origin-bottom rotate-[-8deg] ${flop(animated, true)}`}>{ear}</div>
        <div className={`absolute right-[24%] top-[-14%] z-0 h-[46%] w-[20%] origin-bottom rotate-[8deg] ${flop(animated, true)}`}>{ear}</div>
        <div className="absolute -right-[4%] bottom-[16%] z-0 size-[22%] rounded-full bg-white shadow-sm ring-2 ring-white/60" />
      </>
    );
  },
  fallback: (
    <div className="absolute inset-0 bg-[#c9bcd9]">
      <Eyes />
      <div className="absolute bottom-[32%] left-1/2 size-[9%] -translate-x-1/2 rounded-full bg-[#e26d6d]" />
      <div className="absolute bottom-[20%] left-1/2 h-[10%] w-[14%] -translate-x-1/2 rounded-b-md bg-white ring-1 ring-[#b3a4c7]" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* HAMSTER — round ears + cheek blush                                   */
/* ------------------------------------------------------------------ */

const hamsterKit: SpeciesKit = {
  behind: (animated) => <RoundEars animated={animated} color="#e8b04b" inner="#c77f2e" />,
  over: () => (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute bottom-[22%] left-[16%] size-[16%] rounded-full bg-[#ff9d9d] opacity-60" />
      <div className="absolute bottom-[22%] right-[16%] size-[16%] rounded-full bg-[#ff9d9d] opacity-60" />
    </div>
  ),
  fallback: (
    <div className="absolute inset-0 bg-[#e8b04b]">
      <Eyes />
      <div className="absolute bottom-[26%] left-[22%] size-[20%] rounded-full bg-[#f5cf87]" />
      <div className="absolute bottom-[26%] right-[22%] size-[20%] rounded-full bg-[#f5cf87]" />
      <div className="absolute bottom-[40%] left-1/2 size-[9%] -translate-x-1/2 rounded-full bg-[#a35a1b]" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* TORTOISE — shell rim + little feet                                  */
/* ------------------------------------------------------------------ */

const tortoiseKit: SpeciesKit = {
  behind: () => (
    <>
      <div className="absolute bottom-[2%] left-1/2 z-0 h-[34%] w-[112%] -translate-x-1/2">
        <svg viewBox="0 0 120 44" className={svgWrap}>
          <path d="M6 40 C10 16 30 4 60 4 C90 4 110 16 114 40 C80 32 40 32 6 40 Z" fill="#365314" />
          <path d="M22 32 C28 20 42 12 60 12 C78 12 92 20 98 32 C78 27 42 27 22 32 Z" fill="#86efac" opacity="0.85" />
          <line x1="60" y1="12" x2="60" y2="30" stroke="#365314" strokeWidth="2" opacity="0.5" />
          <line x1="42" y1="16" x2="46" y2="30" stroke="#365314" strokeWidth="2" opacity="0.4" />
          <line x1="78" y1="16" x2="74" y2="30" stroke="#365314" strokeWidth="2" opacity="0.4" />
        </svg>
      </div>
      <div className="absolute bottom-[4%] left-[6%] z-0 size-[13%] rounded-full bg-[#65a30d] ring-2 ring-white/60" />
      <div className="absolute bottom-[4%] right-[6%] z-0 size-[13%] rounded-full bg-[#65a30d] ring-2 ring-white/60" />
    </>
  ),
  fallback: (
    <div className="absolute inset-0 bg-[#86efac]">
      <div className="absolute inset-x-[18%] top-[10%] h-[40%] rounded-t-full bg-[#65a30d] opacity-60" />
      <Eyes y="52%" />
      <div className="absolute bottom-[26%] left-1/2 h-[8%] w-[24%] -translate-x-1/2 rounded-full bg-[#365314] opacity-70" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* FISH — tail fin + side fin + bubbles                                */
/* ------------------------------------------------------------------ */

const fishKit: SpeciesKit = {
  behind: (animated) => (
    <>
      <div className={`absolute -right-[12%] top-[30%] z-0 h-[40%] w-[30%] origin-left ${wag(animated, "1.1s")}`}>
        <svg viewBox="0 0 100 100" className={svgWrap}>
          <path d="M8 50 L92 6 L70 50 L92 94 Z" fill="#38bdf8" />
          <path d="M8 50 L60 28 L52 50 L60 72 Z" fill="#0ea5e9" opacity="0.8" />
        </svg>
      </div>
      <div className="absolute bottom-[6%] left-[10%] z-0 h-[20%] w-[24%]">
        <svg viewBox="0 0 100 60" className={svgWrap}>
          <path d="M6 8 C40 4 70 14 92 40 C60 44 26 34 6 8 Z" fill="#38bdf8" opacity="0.9" />
        </svg>
      </div>
    </>
  ),
  over: (animated) =>
    animated ? (
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute left-[2%] top-[30%] size-[10%] rounded-full bg-[#bae6fd] opacity-80 animate-[bubble-rise_2.4s_ease-in-out_infinite]" />
        <div
          className="absolute left-[10%] top-[44%] size-[7%] rounded-full bg-[#bae6fd] opacity-70 animate-[bubble-rise_2.4s_ease-in-out_infinite]"
          style={{ animationDelay: "0.8s" }}
        />
      </div>
    ) : null,
  fallback: (
    <div className="absolute inset-0 bg-[#06b6d4]">
      <div className="absolute left-[12%] top-[16%] size-[30%] rounded-full bg-[#67e8f9] opacity-80" />
      <Eyes y="46%" />
      <div className="absolute bottom-[24%] left-[38%] h-[10%] w-[24%] rounded-full bg-[#0e7490] opacity-50" />
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* BIRD — crest feathers + wings                                       */
/* ------------------------------------------------------------------ */

const birdKit: SpeciesKit = {
  behind: () => (
    <>
      <div className="absolute left-1/2 top-[-6%] z-0 h-[26%] w-[36%] -translate-x-1/2">
        <svg viewBox="0 0 100 60" className={svgWrap}>
          <path d="M50 56 L34 8 L48 30 L58 4 L62 32 L80 12 L66 56 Z" fill="#38bdf8" />
          <path d="M50 56 L44 24 L56 24 Z" fill="#0ea5e9" />
        </svg>
      </div>
      <div className="absolute left-[-8%] top-[44%] z-0 h-[30%] w-[22%] rotate-[24deg] rounded-full bg-[#0ea5e9]" />
      <div className="absolute right-[-8%] top-[44%] z-0 h-[30%] w-[22%] rotate-[-24deg] rounded-full bg-[#0ea5e9]" />
    </>
  ),
  fallback: (
    <div className="absolute inset-0 bg-[#7dd3fc]">
      <Eyes />
      <div className="absolute bottom-[30%] left-1/2 h-[16%] w-[22%] -translate-x-1/2">
        <svg viewBox="0 0 60 40" className={svgWrap}>
          <path d="M6 6 L54 6 L30 36 Z" fill="#f59e0b" />
          <path d="M14 12 L46 12 L30 30 Z" fill="#fbbf24" />
        </svg>
      </div>
    </div>
  ),
};

/* ------------------------------------------------------------------ */
/* GENERIC PET — friendly round ears                                   */
/* ------------------------------------------------------------------ */

const petKit: SpeciesKit = {
  behind: (animated) => <RoundEars animated={animated} color="#f7d7aa" inner="#e8b98a" />,
  fallback: (
    <div className="absolute inset-0 bg-[#f9d8a7]">
      <Eyes />
      <div className="absolute bottom-[32%] left-1/2 size-[10%] -translate-x-1/2 rounded-full bg-[#17231f]" />
      <div className="absolute bottom-[20%] left-1/2 h-[8%] w-[26%] -translate-x-1/2 rounded-b-full border-b-[3px] border-[#17231f]" />
    </div>
  ),
};

export const PET_KITS: Record<PetKind, SpeciesKit> = {
  dog: dogKit,
  cat: catKit,
  guinea: guineaKit,
  tortoise: tortoiseKit,
  fish: fishKit,
  rabbit: rabbitKit,
  hamster: hamsterKit,
  bird: birdKit,
  pet: petKit,
};

/* ------------------------------------------------------------------ */
/* PetBuddyFace — the composited buddy                                  */
/* ------------------------------------------------------------------ */

const FRAME: Record<BuddySize, string> = {
  xs: "size-8",
  md: "size-16",
  lg: "size-28",
};

const PHOTO_SIZES: Record<BuddySize, string> = {
  xs: "36px",
  md: "72px",
  lg: "128px",
};

export function PetBuddyFace({
  kind,
  photoUrl,
  label,
  size = "md",
  animated = true,
  className = "",
}: {
  kind: PetKind;
  photoUrl?: string;
  label: string;
  size?: BuddySize;
  animated?: boolean;
  className?: string;
}) {
  const kit = PET_KITS[kind] ?? PET_KITS.pet;
  return (
    <div
      aria-label={`${label} pet buddy`}
      title={`${label} pet buddy`}
      className={`relative ${FRAME[size]} shrink-0 ${animated ? "animate-[pet-wiggle_2.4s_ease-in-out_infinite]" : ""} ${className}`}
    >
      {kit.behind(animated)}
      <div className="absolute inset-[9%] z-10 overflow-hidden rounded-full bg-white shadow-inner ring-2 ring-white/80">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={`${label} pet photo`}
            fill
            sizes={PHOTO_SIZES[size]}
            className="object-cover object-center"
            unoptimized
          />
        ) : (
          kit.fallback
        )}
      </div>
      {kit.over?.(animated)}
    </div>
  );
}
