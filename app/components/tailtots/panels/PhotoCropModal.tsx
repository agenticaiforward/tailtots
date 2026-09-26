"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Cropper from "react-easy-crop";
import type { PhotoCropDraft } from "@/lib/domain/family-types";
import { cropProfileImage } from "../image-utils";
export function PhotoCropModal({
  draft,
  setDraft,
  saveCrop,
  close,
}: {
  draft: PhotoCropDraft;
  setDraft: (draft: PhotoCropDraft) => void;
  saveCrop: () => void;
  close: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(draft.imageUrl);
  const minZoom = draft.fit === "contain" ? 0.55 : 1;
  const maxZoom = draft.fit === "contain" ? 3.2 : 3.6;
  const zoomStep = draft.fit === "contain" ? 0.1 : 0.12;
  const updateZoom = (zoom: number) => setDraft({ ...draft, zoom: Math.min(maxZoom, Math.max(minZoom, zoom)) });
  const resetCrop = () => {
    const isPerson = draft.targetType === "parent" || draft.targetType === "child";
    setDraft({ ...draft, crop: { x: 0, y: isPerson ? -12 : 0 }, zoom: draft.fit === "contain" ? 0.85 : isPerson ? 1.45 : 1.05, croppedAreaPixels: undefined });
  };

  useEffect(() => {
    let isActive = true;
    cropProfileImage(draft)
      .then((url) => {
        if (isActive) setPreviewUrl(url);
      })
      .catch(() => {
        if (isActive) setPreviewUrl(draft.imageUrl);
      });
    return () => {
      isActive = false;
    };
  }, [draft]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#17231f]/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-4xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#ded8c7] pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Head-focused profile crop</p>
            <h2 className="mt-2 text-3xl font-black">Fit {draft.label}&apos;s face into the character</h2>
            <p className="mt-2 text-sm font-semibold text-[#5f6a65]">People photos start zoomed toward the head, ears, and hair so background stays out of the animated profile.</p>
          </div>
          <button onClick={close} className="rounded-lg border border-[#ded8c7] px-4 py-2 text-sm font-black">Close</button>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="overflow-hidden rounded-lg border border-[#ded8c7] bg-[#10251f]">
            <div className="relative h-[360px] touch-none sm:h-[430px]">
              <Cropper
                image={draft.imageUrl}
                crop={draft.crop}
                zoom={draft.zoom}
                minZoom={minZoom}
                maxZoom={maxZoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit={draft.fit === "contain" ? "contain" : "cover"}
                restrictPosition={draft.fit === "contain" ? false : true}
                onCropChange={(crop) => setDraft({ ...draft, crop })}
                onZoomChange={(zoom) => updateZoom(zoom)}
                onCropComplete={(_, croppedAreaPixels) => setDraft({ ...draft, croppedAreaPixels })}
              />
            </div>
            <div className="flex items-center justify-between gap-3 bg-[#f8f6ed] px-4 py-3 text-sm font-black text-[#17231f]">
              <span>{draft.fit === "contain" ? "Pet mode keeps more of the body visible" : "Face mode fills the profile circle"}</span>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-[#5f6a65]">Drag photo</span>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-lg bg-[#f8f6ed] p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8a5a00]">Final shape</p>
              <div className="mt-4 grid place-items-center">
                <div className="relative size-36 overflow-hidden rounded-full border-4 border-white bg-[#ded8c7] shadow-sm">
                  <Image src={previewUrl} alt={`${draft.label} selected photo`} fill sizes="144px" className="object-cover" unoptimized />
                </div>
              </div>
              <p className="mt-4 text-center text-sm font-black">{draft.label}</p>
            </div>

            <label className="block text-sm font-black">
              Zoom
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step="0.01"
                value={draft.zoom}
                onChange={(event) => updateZoom(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => updateZoom(draft.zoom - zoomStep)} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Zoom out
              </button>
              <button onClick={() => updateZoom(draft.zoom + zoomStep)} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Zoom in
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={resetCrop} className="min-h-12 rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                Reset
              </button>
              <button onClick={saveCrop} className="min-h-12 rounded-lg bg-[#165a4b] px-4 py-3 text-sm font-black text-white">
                Save photo
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
