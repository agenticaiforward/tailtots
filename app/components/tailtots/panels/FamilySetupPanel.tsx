"use client";

import { isSupabaseConfigured } from "@/lib/data/supabase-client";
import type { Child, Pet } from "@/lib/types";
import type { ParentProfile } from "@/lib/domain/family-types";
import { levelLabels } from "@/lib/domain/starter-data";
import { getChildLook, getPetLook } from "../avatar-looks";
import { ProfilePhoto } from "../ui";
import { VisualSectionHeader, Explainer } from "./VisualSectionHeader";
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
    ["Parent account", "👤", Boolean(props.cloudAccountEmail), props.cloudAccountEmail ? "Signed in" : "Create or sign in"],
    ["Household", "🏠", Boolean(props.familyName.trim()), props.familyName.trim() || "Name your family"],
    ["Kids", "🧒", props.childProfiles.length > 0, `${props.childProfiles.length} added`],
    ["Pets", "🐾", props.pets.length > 0, `${props.pets.length} added`],
    ["First goals", "🎯", true, "Use Today and Kid Bank next"],
  ] as const;
  const completedSteps = setupSteps.filter(([, , done]) => done).length;

  return (
    <section className="space-y-4">
      {/* Visual setup progress */}
      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <VisualSectionHeader icon="🚀" title="Setup" />
          <div className="shrink-0 rounded-2xl bg-tt-pine px-3 py-2 text-center shadow">
            <div className="text-lg font-black text-white">{completedSteps}/{setupSteps.length}</div>
            <div className="text-[10px] font-bold text-white/80">ready</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {setupSteps.map(([label, icon, done, detail]) => (
            <div key={label} className={`rounded-2xl p-3 text-center ring-1 transition-transform hover:scale-105 ${done ? "bg-emerald-50 ring-emerald-200" : "bg-tt-cream/50 ring-tt-line"}`}>
              <div className="text-2xl">{done ? "✅" : icon}</div>
              <p className="mt-1 text-xs font-black text-tt-ink">{label}</p>
              <p className={`text-[11px] font-bold ${done ? "text-emerald-700" : "text-tt-ink/50"}`}>{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <VisualSectionHeader icon="🔐" title="Parent Account" />
          <div className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-black ${props.cloudAccountEmail ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {props.cloudAccountEmail ? `✓ ${props.cloudAccountEmail}` : isSupabaseConfigured ? "Ready" : "Setup"}
          </div>
        </div>
        <div className="mt-3">
          <Explainer>
            One account holds your whole family.
          </Explainer>
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

      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <VisualSectionHeader icon="🏠" title="Household" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-black text-tt-ink">
            Household name
            <input
              className="mt-1.5 w-full rounded-2xl border border-tt-line bg-tt-cream/30 px-4 py-3 text-base font-semibold focus:border-tt-pine focus:outline-none"
              value={props.familyName}
              onChange={(event) => props.setFamilyName(event.target.value)}
              placeholder="The Smith Crew"
            />
          </label>
          <label className="block text-sm font-black text-tt-ink">
            Parent passcode
            <input
              className="mt-1.5 w-full rounded-2xl border border-tt-line bg-tt-cream/30 px-4 py-3 text-base font-semibold focus:border-tt-pine focus:outline-none"
              value={props.parentPasscode}
              onChange={(event) => props.setParentPasscode(event.target.value)}
              inputMode="numeric"
              placeholder="4321"
            />
          </label>
        </div>
      </div>

      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <VisualSectionHeader icon="📸" title="Family photo" subtitle="One photo → crop everyone" />
        <div className="mt-3">
          <Explainer>
            Crop everyone from one photo.
          </Explainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="tt-btn-press inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-tt-ink px-5 py-3 text-sm font-black text-white shadow">
            📤 Upload & pick profiles
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhotoAndPickProfiles(event.target.files?.[0])} />
          </label>
          <label className="tt-btn-press inline-flex min-h-12 cursor-pointer items-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-tt-ink ring-1 ring-tt-line">
            🖼️ Set picture only
            <input className="sr-only" type="file" accept="image/*" onChange={(event) => props.updateFamilyPhoto(event.target.files?.[0])} />
          </label>
          <button
            onClick={props.pickProfilesFromSavedFamilyPhoto}
            disabled={!props.hasFamilyPhoto}
            className="tt-btn-press min-h-12 rounded-2xl bg-tt-pine px-5 py-3 text-sm font-black text-white shadow disabled:opacity-40"
          >
            ✂️ Pick from current photo
          </button>
        </div>
      </div>

      <section className="grid gap-4 2xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <VisualSectionHeader icon="👤" title="Parents" />
          <div className="mt-3 grid gap-2.5">
            {props.parents.map((parent) => (
              <article key={parent.id} className="rounded-2xl bg-tt-cream/40 p-3 ring-1 ring-tt-line">
                <div className="flex items-center gap-3">
                  <ProfilePhoto label={parent.name} initial={parent.name.trim()[0]?.toUpperCase() ?? "P"} colors="from-[#ffd166] via-[#f47b20] to-[#7c3aed]" variant="kid" hair="#4a2718" photoUrl={parent.photoUrl} />
                  <input
                    className="min-w-0 flex-1 rounded-2xl border border-tt-line bg-white px-4 py-2.5 text-base font-bold focus:border-tt-pine focus:outline-none"
                    value={parent.name}
                    onChange={(event) => props.updateParent(parent.id, { name: event.target.value })}
                    placeholder="Parent name"
                  />
                </div>
                <label className="tt-btn-press mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-xs font-black text-tt-ink ring-1 ring-tt-line">
                  📷 Upload face
                  <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateParentPhoto(parent.id, event.target.files?.[0])} />
                </label>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
          <VisualSectionHeader icon="🧒" title="Kids" />
          <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
            {props.childProfiles.map((child) => {
              const look = getChildLook(child.id);
              return (
                <article key={child.id} className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 p-3 ring-1 ring-violet-200">
                  <div className="flex items-center gap-2.5">
                    <ProfilePhoto label={child.name} initial={look.initial} colors={look.colors} variant="kid" hair={look.hair} photoUrl={child.photoUrl} />
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full rounded-xl border border-tt-line bg-white px-3 py-2 text-base font-black focus:border-tt-pine focus:outline-none"
                        value={child.name}
                        onChange={(event) => props.updateChild(child.id, { name: event.target.value })}
                        placeholder="Kid name"
                      />
                      <div className="mt-1.5 flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-black text-tt-ink/70">
                          Age
                          <input
                            className="w-14 rounded-xl border border-tt-line bg-white px-2 py-1.5 text-sm font-bold focus:border-tt-pine focus:outline-none"
                            value={child.age}
                            onChange={(event) => props.updateChild(child.id, { age: Math.max(3, Math.min(18, Number(event.target.value) || child.age || 8)) })}
                            inputMode="numeric"
                            type="number"
                            min={3}
                            max={18}
                          />
                        </label>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-tt-ink/60">{levelLabels[child.level]}</span>
                        <label className="tt-btn-press cursor-pointer rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-tt-ink ring-1 ring-tt-line">
                          📷 Face
                          <input className="sr-only" type="file" accept="image/*" capture="user" onChange={(event) => props.updateChildPhoto(child.id, event.target.files?.[0])} />
                        </label>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <div className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
              <input className="rounded-2xl border border-tt-line bg-white px-4 py-2.5 font-semibold focus:border-tt-pine focus:outline-none" placeholder="Child name" value={props.newChild.name} onChange={(event) => props.setNewChild({ ...props.newChild, name: event.target.value })} />
              <input className="rounded-2xl border border-tt-line bg-white px-4 py-2.5 font-semibold focus:border-tt-pine focus:outline-none" placeholder="Age" value={props.newChild.age} onChange={(event) => props.setNewChild({ ...props.newChild, age: event.target.value })} inputMode="numeric" type="number" min={3} max={18} />
              <button onClick={props.addChild} className="tt-btn-press rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-black text-white shadow">➕ Add kid</button>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-tt-line bg-white p-4 shadow-sm">
        <VisualSectionHeader icon="🐾" title="Pets" />
        <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
          {props.pets.map((pet) => {
            const look = getPetLook(pet.id);
            return (
              <article key={pet.id} className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 p-3 ring-1 ring-orange-200">
                <div className="flex items-center gap-2.5">
                  <ProfilePhoto label={pet.name} initial={look.face} colors={look.colors} variant="pet" petKind={look.kind} photoUrl={pet.photoUrl} />
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-black focus:border-tt-pine focus:outline-none"
                      value={pet.name}
                      onChange={(event) => props.updatePet(pet.id, { name: event.target.value })}
                      placeholder="Pet name"
                    />
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-bold focus:border-tt-pine focus:outline-none"
                      value={pet.species}
                      onChange={(event) => props.updatePet(pet.id, { species: event.target.value })}
                      placeholder="Species"
                    />
                  </div>
                  <label className="tt-btn-press shrink-0 cursor-pointer rounded-2xl bg-tt-pine px-3 py-2 text-xs font-black text-white shadow">
                    📷
                    <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => props.updatePetPhoto(pet.id, event.target.files?.[0])} />
                  </label>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-black text-tt-ink/60">Care details ▾</summary>
                  <div className="grid gap-1.5 pt-2 sm:grid-cols-2">
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-semibold focus:border-tt-pine focus:outline-none"
                      value={pet.favoriteFood}
                      onChange={(event) => props.updatePet(pet.id, { favoriteFood: event.target.value })}
                      placeholder="🍎 Favorite food"
                    />
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-semibold focus:border-tt-pine focus:outline-none"
                      value={pet.vet}
                      onChange={(event) => props.updatePet(pet.id, { vet: event.target.value })}
                      placeholder="🏥 Vet"
                    />
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-semibold focus:border-tt-pine focus:outline-none"
                      value={pet.medicine}
                      onChange={(event) => props.updatePet(pet.id, { medicine: event.target.value })}
                      placeholder="💊 Medicine"
                    />
                    <input
                      className="rounded-xl border border-tt-line bg-white px-3 py-2 text-sm font-semibold focus:border-tt-pine focus:outline-none"
                      value={pet.careNotes}
                      onChange={(event) => props.updatePet(pet.id, { careNotes: event.target.value })}
                      placeholder="📝 Care notes"
                    />
                  </div>
                </details>
              </article>
            );
          })}
        </div>
        <div className="mt-3 rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
          <div className="grid gap-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
            <input className="rounded-2xl border border-tt-line bg-white px-4 py-2.5 text-sm font-semibold focus:border-tt-pine focus:outline-none" placeholder="🐾 Pet name" value={props.newPet.name} onChange={(event) => props.setNewPet({ ...props.newPet, name: event.target.value })} />
            <input className="rounded-2xl border border-tt-line bg-white px-4 py-2.5 text-sm font-semibold focus:border-tt-pine focus:outline-none" placeholder="Species" value={props.newPet.species} onChange={(event) => props.setNewPet({ ...props.newPet, species: event.target.value })} />
            <input className="rounded-2xl border border-tt-line bg-white px-4 py-2.5 text-sm font-semibold focus:border-tt-pine focus:outline-none" placeholder="🍎 Favorite food" value={props.newPet.food} onChange={(event) => props.setNewPet({ ...props.newPet, food: event.target.value })} />
            <button onClick={props.addPet} className="tt-btn-press rounded-2xl bg-tt-pine px-5 py-2.5 text-sm font-black text-white shadow">➕ Add pet</button>
          </div>
        </div>
      </div>
    </section>
  );
}
