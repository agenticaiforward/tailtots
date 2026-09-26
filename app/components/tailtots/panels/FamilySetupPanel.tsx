"use client";

import { isSupabaseConfigured } from "@/lib/data/supabase-client";
import type { Child, Pet } from "@/lib/types";
import type { ParentProfile } from "@/lib/domain/family-types";
import { levelLabels } from "@/lib/domain/starter-data";
import { getChildLook, getPetLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";
export function FamilySetupPanel(props: {
  cloudAccountEmail: string;
  accountDraft: { email: string; password: string };
  setAccountDraft: (value: { email: string; password: string }) => void;
  accountStatus: "idle" | "saving" | "loading" | "error" | "saved";
  accountMessage: string;
  createParentAccount: () => void;
  signInParentAccount: () => void;
  signOutParentAccount: () => void;
  saveCurrentFamilyAccount: () => void;
  loadCurrentFamilyAccount: () => void;
  familyName: string;
  setFamilyName: (value: string) => void;
  parents: ParentProfile[];
  updateParent: (parentId: string, updates: Partial<ParentProfile>) => void;
  updateParentPhoto: (parentId: string, file?: File) => void;
  childProfiles: Child[];
  updateChild: (childId: string, updates: Partial<Child>) => void;
  updateChildPhoto: (childId: string, file?: File) => void;
  pets: Pet[];
  updatePet: (petId: string, updates: Partial<Pet>) => void;
  updatePetPhoto: (petId: string, file?: File) => void;
  newChild: { name: string; age: string };
  setNewChild: (value: { name: string; age: string }) => void;
  addChild: () => void;
  newPet: { name: string; species: string; food: string };
  setNewPet: (value: { name: string; species: string; food: string }) => void;
  addPet: () => void;
  updateFamilyPhoto: (file?: File) => void;
  updateFamilyPhotoAndPickProfiles: (file?: File) => void;
  pickProfilesFromSavedFamilyPhoto: () => void;
  hasFamilyPhoto: boolean;
  parentPasscode: string;
  setParentPasscode: (value: string) => void;
}) {
  const setupSteps = [
    ["Parent account", Boolean(props.cloudAccountEmail), props.cloudAccountEmail ? "Signed in" : "Create or sign in"],
    ["Household", Boolean(props.familyName.trim()), props.familyName.trim() || "Name your family"],
    ["Kids", props.childProfiles.length > 0, `${props.childProfiles.length} added`],
    ["Pets", props.pets.length > 0, `${props.pets.length} added`],
    ["First goals", true, "Use Today and Kid Bank next"],
  ] as const;
  const completedSteps = setupSteps.filter(([, done]) => done).length;

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#fffdf7] p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Real family setup</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Start simple. Add the family pieces first.</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
              Set up the parent account, household, kids, and pets. TailTots can grow into goals, rewards, and Kid Bank after the first mission.
            </p>
          </div>
          <div className="rounded-lg bg-[#165a4b] px-4 py-3 text-sm font-black text-white">
            {completedSteps} of {setupSteps.length} ready
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {setupSteps.map(([label, done, detail]) => (
            <div key={label} className={`rounded-lg border p-3 ${done ? "border-[#b8cfc6] bg-[#e7f4ef]" : "border-[#ded8c7] bg-white"}`}>
              <p className="text-sm font-black text-[#17231f]">{label}</p>
              <p className={`mt-1 text-xs font-bold ${done ? "text-[#165a4b]" : "text-[#7a4b12]"}`}>{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#c9d8f8] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Parent account</p>
            <h2 className="mt-2 text-3xl font-black">Save this family setup</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
              A signed-in parent account can keep this family&apos;s profiles, family photos, kids, pets, goals, points, coins, Kid Bank, badges, and parent settings together.
            </p>
          </div>
          <div className={`rounded-lg px-4 py-3 text-sm font-black ${props.cloudAccountEmail ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
            {props.cloudAccountEmail ? `Signed in: ${props.cloudAccountEmail}` : isSupabaseConfigured ? "Ready for account sign in" : "Account setup"}
          </div>
        </div>

        {!props.cloudAccountEmail && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={props.accountDraft.email}
              onChange={(event) => props.setAccountDraft({ ...props.accountDraft, email: event.target.value })}
              className="min-h-12 rounded-lg border border-[#c9d8f8] px-4 py-3 font-semibold"
              inputMode="email"
              placeholder="Parent email"
              type="email"
            />
            <input
              value={props.accountDraft.password}
              onChange={(event) => props.setAccountDraft({ ...props.accountDraft, password: event.target.value })}
              className="min-h-12 rounded-lg border border-[#c9d8f8] px-4 py-3 font-semibold"
              placeholder="Password"
              type="password"
            />
            <button onClick={props.createParentAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              Create account
            </button>
            <button onClick={props.signInParentAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#c9d8f8] bg-white px-5 py-3 text-sm font-black text-[#1f3b7a] disabled:opacity-60">
              Sign in
            </button>
          </div>
        )}

        {props.cloudAccountEmail && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={props.saveCurrentFamilyAccount} disabled={props.accountStatus === "saving"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {props.accountStatus === "saving" ? "Saving..." : "Save family account"}
            </button>
            <button onClick={props.loadCurrentFamilyAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#c9d8f8] bg-white px-5 py-3 text-sm font-black text-[#1f3b7a] disabled:opacity-60">
              Load account
            </button>
            <button onClick={props.signOutParentAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#ded8c7] bg-[#f8f6ed] px-5 py-3 text-sm font-black text-[#5f4a24] disabled:opacity-60">
              Sign out
            </button>
          </div>
        )}

        {props.accountMessage && (
          <p className={`mt-3 text-sm font-bold ${props.accountStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`}>
            {props.accountMessage}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Family setup</p>
        <h2 className="mt-2 text-3xl font-black">Household, kids, and pets</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
          This is the control room for who uses TailTots. Keep parent info simple, make each kid easy to recognize, and make every pet passport easy to scan.
        </p>
        <label className="mt-5 block text-sm font-black text-[#25352f]">
          Household name
          <input
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            value={props.familyName}
            onChange={(event) => props.setFamilyName(event.target.value)}
            placeholder="The Smith Crew"
          />
        </label>
        <label className="mt-4 block max-w-xs text-sm font-black text-[#25352f]">
          Parent passcode
          <input
            className="mt-2 w-full rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold"
            value={props.parentPasscode}
            onChange={(event) => props.setParentPasscode(event.target.value)}
            inputMode="numeric"
            placeholder="4321"
          />
        </label>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Photo setup</p>
        <h3 className="mt-2 text-2xl font-black">Pick each profile photo correctly</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Upload one family picture and TailTots will walk you through cropping the parent and kids from that same photo. Pets can still use their own passport photos below.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
            Upload family photo and pick profiles
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhotoAndPickProfiles(event.target.files?.[0])} />
          </label>
          <label className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-[#ded8c7] bg-white px-5 py-3 text-sm font-black text-[#17231f]">
            Set family picture only
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhoto(event.target.files?.[0])} />
          </label>
          <button
            onClick={props.pickProfilesFromSavedFamilyPhoto}
            disabled={!props.hasFamilyPhoto}
            className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8c4bf]"
          >
            Pick profiles from current family photo
          </button>
        </div>
      </div>

      <section className="grid gap-4 2xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Parents</p>
          <h3 className="mt-2 text-2xl font-black">Grown-up profiles</h3>
          <div className="mt-4 grid gap-3">
            {props.parents.map((parent) => (
              <article key={parent.id} className="rounded-lg bg-[#f8f6ed] p-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto label={parent.name} initial={parent.name.trim()[0]?.toUpperCase() ?? "P"} colors="from-[#ffd166] via-[#f47b20] to-[#7c3aed]" variant="kid" hair="#4a2718" photoUrl={parent.photoUrl} />
                  <label className="min-w-0 flex-1 text-sm font-black">
                    Parent name
                    <input
                      className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold"
                      value={parent.name}
                      onChange={(event) => props.updateParent(parent.id, { name: event.target.value })}
                    />
                  </label>
                </div>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-xs font-black text-[#17231f]">
                  Upload parent face
                  <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateParentPhoto(parent.id, event.target.files?.[0])} />
                </label>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Kids</p>
          <h3 className="mt-2 text-2xl font-black">Kid profiles</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {props.childProfiles.map((child) => {
              const look = getChildLook(child.id);
              return (
                <article key={child.id} className="rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4">
                  <div className="flex items-center gap-3">
                    <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
                    <div className="min-w-0">
                      <p className="truncate text-xl font-black">{child.name || "Kid profile"}</p>
                      <p className="text-xs font-bold text-[#69736f]">Age {child.age} • {levelLabels[child.level]} helper</p>
                    </div>
                  </div>
                  <label className="mt-4 block text-sm font-black">
                    Kid name
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={child.name} onChange={(event) => props.updateChild(child.id, { name: event.target.value })} />
                  </label>
                  <label className="mt-3 block text-sm font-black">
                    Age
                    <input
                      className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold"
                      value={child.age}
                      onChange={(event) => props.updateChild(child.id, { age: Math.max(3, Math.min(18, Number(event.target.value) || child.age || 8)) })}
                      inputMode="numeric"
                      type="number"
                      min={3}
                      max={18}
                    />
                  </label>
                  <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-xs font-black text-[#17231f]">
                    Capture kid face
                    <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateChildPhoto(child.id, event.target.files?.[0])} />
                  </label>
                </article>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Add another kid</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold" placeholder="Child name" value={props.newChild.name} onChange={(event) => props.setNewChild({ ...props.newChild, name: event.target.value })} />
              <input className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold" placeholder="Age" value={props.newChild.age} onChange={(event) => props.setNewChild({ ...props.newChild, age: event.target.value })} inputMode="numeric" type="number" min={3} max={18} />
              <button onClick={props.addChild} className="min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Add kid</button>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Pets</p>
        <h3 className="mt-2 text-2xl font-black">Pet passports</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {props.pets.map((pet) => {
            const look = getPetLook(pet.id);
            return (
              <article key={pet.id} className="rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4">
                <div className="flex items-center gap-3">
                  <ProfilePhoto label={pet.name} initial={look.face} colors={look.colors} variant="pet" petKind={look.kind} photoUrl={pet.photoUrl} />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black">{pet.name || "Pet profile"}</p>
                    <p className="text-xs font-bold text-[#69736f]">{pet.species || "Species"}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-black">
                    Pet name
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.name} onChange={(event) => props.updatePet(pet.id, { name: event.target.value })} />
                  </label>
                  <label className="text-sm font-black">
                    Species
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.species} onChange={(event) => props.updatePet(pet.id, { species: event.target.value })} />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-black">
                  Favorite food
                  <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.favoriteFood} onChange={(event) => props.updatePet(pet.id, { favoriteFood: event.target.value })} />
                </label>
                <label className="mt-3 block text-sm font-black">
                  Care notes
                  <textarea className="mt-2 min-h-24 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.careNotes} onChange={(event) => props.updatePet(pet.id, { careNotes: event.target.value })} />
                </label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-black">
                    Vet
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.vet} onChange={(event) => props.updatePet(pet.id, { vet: event.target.value })} />
                  </label>
                  <label className="text-sm font-black">
                    Medicine
                    <input className="mt-2 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-3 text-base font-semibold" value={pet.medicine} onChange={(event) => props.updatePet(pet.id, { medicine: event.target.value })} />
                  </label>
                </div>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-[#165a4b] px-4 py-2 text-xs font-black text-white">
                  Capture pet face
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => props.updatePetPhoto(pet.id, event.target.files?.[0])} />
                </label>
              </article>
            );
          })}
        </div>
        <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
          <h4 className="text-lg font-black">Add another pet</h4>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="rounded-lg border border-[#b7d9cc] px-4 py-3 font-semibold" placeholder="Pet name" value={props.newPet.name} onChange={(event) => props.setNewPet({ ...props.newPet, name: event.target.value })} />
            <input className="rounded-lg border border-[#b7d9cc] px-4 py-3 font-semibold" placeholder="Species" value={props.newPet.species} onChange={(event) => props.setNewPet({ ...props.newPet, species: event.target.value })} />
            <input className="rounded-lg border border-[#b7d9cc] px-4 py-3 font-semibold" placeholder="Favorite food" value={props.newPet.food} onChange={(event) => props.setNewPet({ ...props.newPet, food: event.target.value })} />
            <button onClick={props.addPet} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">Add pet</button>
          </div>
        </div>
      </div>
    </section>
  );
}
