"use client";

import type { Pet } from "@/lib/types";
import { getPetLook } from "../avatar-looks";
import { Meter, ProfilePhoto } from "../ui";
export function PassportPanel({ pets, updatePetPhoto }: { pets: Pet[]; updatePetPhoto?: (petId: string, file?: File) => void }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Pet passports</p>
        <h2 className="mt-2 text-3xl font-black">Everything kids need to care correctly</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Each passport keeps the pet&apos;s food, care notes, vet, and medicine in one place so kids do not have to guess.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {pets.map((pet) => (
          <article key={pet.id} className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ProfilePhoto label={pet.name} initial={getPetLook(pet.id).face} colors={getPetLook(pet.id).colors} size="lg" variant="pet" petKind={getPetLook(pet.id).kind} photoUrl={pet.photoUrl} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">{pet.name}&apos;s passport</p>
              <h2 className="text-3xl font-black">{pet.name}</h2>
              <p className="text-sm font-black text-[#0f766e]">{pet.species}</p>
              {updatePetPhoto && (
              <label className="mt-3 inline-flex cursor-pointer rounded-lg bg-[#165a4b] px-3 py-2 text-xs font-black text-white">
                Capture pet photo
                <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => updatePetPhoto(pet.id, event.target.files?.[0])} />
              </label>
              )}
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <Meter label={`${pet.name} happiness`} value={getPetLook(pet.id).happiness} color="#f47b20" />
            <Meter label={`${pet.name} feeling loved`} value={getPetLook(pet.id).loved} color="#0f766e" />
          </div>
          <dl className="mt-5 grid gap-3 text-sm">
            <div className="rounded-lg bg-[#f8f6ed] p-3"><dt className="font-black">Favorite food</dt><dd>{pet.favoriteFood}</dd></div>
            <div className="rounded-lg bg-[#f8f6ed] p-3"><dt className="font-black">Care notes</dt><dd>{pet.careNotes}</dd></div>
            <div className="rounded-lg bg-[#f8f6ed] p-3"><dt className="font-black">Vet</dt><dd>{pet.vet}</dd></div>
            <div className="rounded-lg bg-[#f8f6ed] p-3"><dt className="font-black">Medicine</dt><dd>{pet.medicine}</dd></div>
          </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
