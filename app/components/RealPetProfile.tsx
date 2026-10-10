/**
 * RealPetProfile — capture a real pet during onboarding.
 *
 * Photo upload (camera/file, works on iPhone Safari) → name → species →
 * age → care-needs checklist. "Add another pet" for multi-pet families.
 *
 * Photos stay on-device (data URL in localStorage) — never uploaded without
 * explicit parent consent (COPPA data minimization).
 */
"use client";

import { useRef, useState } from "react";
import {
  CARE_NEED_OPTIONS,
  realPetFromInput,
  speciesEmoji,
  type CareNeedId,
  type RealPetInput,
} from "../../lib/pet-tracks";
import type { Pet } from "../../lib/types";

const SPECIES_OPTIONS = [
  { value: "Dog", emoji: "🐶" },
  { value: "Cat", emoji: "🐱" },
  { value: "Bird", emoji: "🐦" },
  { value: "Fish", emoji: "🐠" },
  { value: "Rabbit", emoji: "🐰" },
  { value: "Hamster", emoji: "🐹" },
  { value: "Guinea pig", emoji: "🐹" },
  { value: "Turtle", emoji: "🐢" },
  { value: "Other", emoji: "🐾" },
];

/** Downscale + compress an image file to a data URL suitable for localStorage. */
function fileToDataUrl(file: File, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("no 2d context"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function PetForm({
  index,
  onDone,
  onRemove,
  canRemove,
}: {
  index: number;
  onDone: (pet: Pet) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [age, setAge] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [careNeedIds, setCareNeedIds] = useState<CareNeedId[]>(["feeding", "water", "playtime"]);
  const [photoError, setPhotoError] = useState(false);

  const toggleNeed = (id: CareNeedId) =>
    setCareNeedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const pickPhoto = () => fileRef.current?.click();

  const onFile = async (file?: File) => {
    if (!file) return;
    setPhotoError(false);
    try {
      setPhoto(await fileToDataUrl(file));
    } catch {
      setPhotoError(true);
    }
  };

  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    const input: RealPetInput = { name, species, age, photoDataUrl: photo, careNeedIds };
    onDone(realPetFromInput(input));
  };

  return (
    <div className="rounded-2xl border-2 border-tt-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="tt-heading text-lg text-tt-navy">
          {index === 0 ? "Tell us about your pet" : `Pet #${index + 1}`}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="tt-body text-sm font-bold text-tt-ink-faint hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>

      {/* Photo */}
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={pickPhoto}
          aria-label={photo ? "Change pet photo" : "Add pet photo"}
          className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-tt-pine/30 bg-tt-cream text-4xl transition-transform hover:scale-105 active:scale-95"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Pet photo preview" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">{speciesEmoji(species)}</span>
          )}
          <span
            className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full bg-tt-pine text-white shadow"
            aria-hidden="true"
          >
            📷
          </span>
        </button>
        <div>
          <p className="tt-body text-sm font-bold text-tt-navy">Add a photo</p>
          <p className="tt-body text-xs text-tt-ink-faint">
            {name.trim() ? `${name.trim()}'s` : "Your pet's"} real face makes every mission special.
          </p>
          {photoError && (
            <p className="tt-body mt-1 text-xs text-red-600">Couldn&rsquo;t read that photo — try another.</p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {/* Name */}
      <label className="tt-body mt-4 block text-sm font-bold text-tt-navy">
        Pet&rsquo;s name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Biscuit"
          maxLength={24}
          className="tt-body mt-1 block w-full rounded-xl border-2 border-tt-line bg-tt-cream px-4 py-3 text-tt-navy placeholder:text-tt-ink-faint/60 focus:border-tt-pine focus:outline-none"
        />
      </label>

      {/* Species */}
      <fieldset className="mt-4">
        <legend className="tt-body text-sm font-bold text-tt-navy">What kind of animal?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SPECIES_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSpecies(s.value)}
              aria-pressed={species === s.value}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 transition-all ${
                species === s.value
                  ? "border-tt-pine bg-tt-pine-tint shadow"
                  : "border-tt-line bg-tt-cream hover:border-tt-pine/50"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="tt-body text-xs font-bold text-tt-navy">{s.value}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Age */}
      <label className="tt-body mt-4 block text-sm font-bold text-tt-navy">
        Age <span className="font-normal text-tt-ink-faint">(optional)</span>
        <input
          type="text"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="e.g. 3 years old"
          maxLength={20}
          className="tt-body mt-1 block w-full rounded-xl border-2 border-tt-line bg-tt-cream px-4 py-3 text-tt-navy placeholder:text-tt-ink-faint/60 focus:border-tt-pine focus:outline-none"
        />
      </label>

      {/* Care needs */}
      <fieldset className="mt-4">
        <legend className="tt-body text-sm font-bold text-tt-navy">
          What does {name.trim() || "your pet"} need help with?
        </legend>
        <p className="tt-body text-xs text-tt-ink-faint">Pick all that apply — missions grow from these.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARE_NEED_OPTIONS.map((o) => {
            const on = careNeedIds.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleNeed(o.id)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-sm font-bold transition-all ${
                  on
                    ? "border-tt-pine bg-tt-pine text-white shadow"
                    : "border-tt-line bg-tt-cream text-tt-navy hover:border-tt-pine/50"
                }`}
              >
                <span aria-hidden="true">{o.emoji}</span> {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={save}
        disabled={!valid}
        className="tt-heading mt-5 w-full rounded-2xl bg-tt-pine py-3.5 text-lg text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {valid ? `Add ${name.trim()}! 🎉` : "Give your pet a name first"}
      </button>
    </div>
  );
}

export default function RealPetProfile({
  onComplete,
}: {
  /** Called with the full list of created real pets. */
  onComplete: (pets: Pet[]) => void;
}) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [forms, setForms] = useState<number[]>([0]);
  const [formKey, setFormKey] = useState(0);

  const addForm = () => setForms((f) => [...f, Math.max(...f, -1) + 1]);

  const removeForm = (key: number) => setForms((f) => (f.length > 1 ? f.filter((k) => k !== key) : f));

  const petDone = (pet: Pet) => {
    const next = [...pets, pet];
    setPets(next);
    setForms([]);
    setFormKey((k) => k + 1);
    setForms([0]);
  };

  return (
    <div className="text-center">
      <p className="text-5xl" aria-hidden="true">
        📷
      </p>
      <h2 className="tt-heading mt-3 text-tt-navy">Meet the real star!</h2>
      <p className="tt-body mt-1 text-tt-ink-faint">
        Add your pet&rsquo;s photo and details. Missions will use their real name and face.
      </p>

      {pets.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Added pets">
          {pets.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-2 rounded-full bg-tt-pine-tint py-1.5 pl-1.5 pr-4 font-bold text-tt-pine"
            >
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="size-8 rounded-full object-cover" />
              ) : (
                <span className="grid size-8 place-items-center rounded-full bg-white text-lg" aria-hidden="true">
                  {speciesEmoji(p.species)}
                </span>
              )}
              <span className="tt-body text-sm">{p.name}</span>
              <span aria-hidden="true">✓</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 text-left" key={formKey}>
        {forms.map((key, i) => (
          <PetForm
            key={key}
            index={pets.length + i}
            onDone={petDone}
            onRemove={() => removeForm(key)}
            canRemove={forms.length > 1}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={addForm}
          className="tt-body rounded-2xl border-2 border-dashed border-tt-pine/40 py-3 font-bold text-tt-pine hover:bg-tt-pine-tint"
        >
          + Add another pet
        </button>
        {pets.length > 0 && (
          <button
            type="button"
            onClick={() => onComplete(pets)}
            className="tt-heading rounded-2xl bg-tt-navy py-3.5 text-lg text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Continue with {pets.length} pet{pets.length > 1 ? "s" : ""} →
          </button>
        )}
      </div>
    </div>
  );
}
