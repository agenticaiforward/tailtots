/**
 * SoundToggle — tiny mute/unmute button for the Web Audio delight layer.
 * Persists to localStorage. Shown in kid view header.
 */
"use client";

import { useState } from "react";
import { getSoundMuted, setSoundMuted, playClick } from "../../lib/sound";

export function SoundToggle() {
  const [muted, setMuted] = useState(() => getSoundMuted());
  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setSoundMuted(next);
        if (!next) playClick();
      }}
      className="tt-btn-press grid size-11 place-items-center rounded-full bg-white text-xl shadow-sm ring-1 ring-[#ded8c7]"
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      title={muted ? "Unmute sounds" : "Mute sounds"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
