"use client";

import { useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import type {
  BankCategory,
  BankTransaction,
  Child,
  LevelKey,
  MemoryMoment,
  Mission,
  Pet,
  Role,
  SavingsGoal,
} from "@/lib/types";

const levelLabels: Record<LevelKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  super_hard: "Super Hard",
};

const starterChildren: Child[] = [
  { id: "maya", name: "Maya", secretCode: "2468", points: 180, coins: 26, level: "medium", streakDays: 5 },
  { id: "leo", name: "Leo", secretCode: "1357", points: 72, coins: 14, level: "easy", streakDays: 2 },
];

const starterPets: Pet[] = [
  {
    id: "luna",
    name: "Luna",
    species: "Dog",
    favoriteFood: "Carrots",
    careNotes: "Brush in the evening. Refill water after walks.",
    vet: "Green Trail Vet",
    medicine: "Monthly flea medicine",
  },
  {
    id: "mochi",
    name: "Mochi",
    species: "Guinea pig",
    favoriteFood: "Romaine",
    careNotes: "Fresh hay, clean cage corners, quiet handling.",
    vet: "Family Pet Clinic",
    medicine: "None",
  },
];

const starterMissions: Mission[] = [
  {
    id: "feed-luna",
    title: "Feed Luna breakfast",
    category: "pet_care",
    difficulty: "easy",
    points: 12,
    coins: 2,
    petId: "luna",
    question: "Did Luna get the right food and fresh water?",
    status: "pending",
  },
  {
    id: "clean-mochi",
    title: "Clean Mochi's cage corner",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    petId: "mochi",
    question: "What did you notice that made Mochi more comfortable?",
    status: "pending",
  },
  {
    id: "kind-note",
    title: "Kindness check-in",
    category: "kindness",
    difficulty: "hard",
    points: 22,
    coins: 0,
    question: "How did you know your pet felt safe or happy today?",
    status: "pending",
  },
];

const starterGoals: SavingsGoal[] = [
  { id: "goal-1", childId: "maya", title: "New chew toy", target: 24, saved: 15, type: "toy" },
  { id: "goal-2", childId: "leo", title: "Shelter donation", target: 20, saved: 6, type: "donation" },
];

const starterTransactions: BankTransaction[] = [
  { id: "tx-1", childId: "maya", category: "earn", amount: 3, description: "Approved pet care missions", status: "approved" },
  { id: "tx-2", childId: "leo", category: "give", amount: 2, description: "Donation jar request", status: "pending" },
];

const childLooks: Record<string, { initial: string; colors: string; joy: number; love: number; hair: string }> = {
  maya: { initial: "M", colors: "from-[#ffcf70] via-[#ff8a65] to-[#7c3aed]", joy: 92, love: 88, hair: "#4a2718" },
  leo: { initial: "L", colors: "from-[#79d6ff] via-[#4ade80] to-[#2563eb]", joy: 78, love: 84, hair: "#1f2937" },
};

const petLooks: Record<string, { face: string; colors: string; happiness: number; loved: number; kind: "dog" | "guinea" | "pet" }> = {
  luna: { face: "D", colors: "from-[#fbbf24] via-[#f97316] to-[#7c2d12]", happiness: 94, loved: 91, kind: "dog" },
  mochi: { face: "G", colors: "from-[#bef264] via-[#5eead4] to-[#0f766e]", happiness: 83, loved: 89, kind: "guinea" },
};

const familyStats = [
  ["Family joy", 88, "#f47b20"],
  ["Pet happiness", 91, "#0f766e"],
  ["Kids loving it", 86, "#7c3aed"],
];

export function PawPalApp() {
  const [role, setRole] = useState<Role>("parent");
  const [activeTab, setActiveTab] = useState("missions");
  const [children, setChildren] = useState(starterChildren);
  const [pets, setPets] = useState(starterPets);
  const [missions, setMissions] = useState(starterMissions);
  const [transactions, setTransactions] = useState(starterTransactions);
  const [goals] = useState(starterGoals);
  const [moments, setMoments] = useState<MemoryMoment[]>([
    { id: "moment-1", childId: "maya", petId: "luna", mood: "proud", note: "Luna waited calmly while Maya filled the water bowl." },
  ]);
  const [activeChildId, setActiveChildId] = useState(children[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [missionNote, setMissionNote] = useState("");
  const [newChild, setNewChild] = useState({ name: "", code: "" });
  const [newPet, setNewPet] = useState({ name: "", species: "", food: "" });
  const [momentDraft, setMomentDraft] = useState("A kind moment with our pet was...");

  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0];
  const activePet = pets[0];
  const approvedMissionCount = missions.filter((mission) => mission.status === "approved").length;
  const completedMissionCount = missions.filter((mission) => mission.completedBy).length;
  const taskProgress = Math.round((completedMissionCount / Math.max(1, missions.length)) * 100);

  const pendingApprovals = useMemo(
    () => [
      ...missions.filter((mission) => mission.status === "pending" && mission.completedBy),
      ...transactions.filter((transaction) => transaction.status === "pending"),
    ],
    [missions, transactions],
  );

  function addChild() {
    if (!newChild.name.trim() || !newChild.code.trim()) return;
    const child: Child = {
      id: `child-${Date.now()}`,
      name: newChild.name.trim(),
      secretCode: newChild.code.trim(),
      points: 0,
      coins: 0,
      level: "easy",
      streakDays: 0,
    };
    setChildren((items) => [...items, child]);
    setActiveChildId(child.id);
    setNewChild({ name: "", code: "" });
  }

  function addPet() {
    if (!newPet.name.trim() || !newPet.species.trim()) return;
    setPets((items) => [
      ...items,
      {
        id: `pet-${Date.now()}`,
        name: newPet.name.trim(),
        species: newPet.species.trim(),
        favoriteFood: newPet.food.trim() || "Add favorite food",
        careNotes: "Add care notes in the passport.",
        vet: "Add vet",
        medicine: "Add medicine",
      },
    ]);
    setNewPet({ name: "", species: "", food: "" });
  }

  function childLogin() {
    const match = children.find((child) => child.secretCode === code.trim());
    if (!match) return;
    setActiveChildId(match.id);
    setRole("child");
    setActiveTab("missions");
    setCode("");
  }

  function completeMission(missionId: string) {
    if (!activeChild) return;
    setMissions((items) =>
      items.map((mission) =>
        mission.id === missionId
          ? { ...mission, completedBy: activeChild.id, note: missionNote || "Voice check-in saved.", status: "pending" }
          : mission,
      ),
    );
    setMissionNote("");
  }

  function approveMission(missionId: string) {
    const mission = missions.find((item) => item.id === missionId);
    if (!mission?.completedBy) return;
    setMissions((items) => items.map((item) => (item.id === missionId ? { ...item, status: "approved" } : item)));
    setChildren((items) =>
      items.map((child) =>
        child.id === mission.completedBy
          ? { ...child, points: child.points + mission.points, coins: child.coins + mission.coins, streakDays: child.streakDays + 1 }
          : child,
      ),
    );
  }

  function approveTransaction(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    setTransactions((items) => items.map((item) => (item.id === transactionId ? { ...item, status: "approved" } : item)));
    if (transaction.category === "save" || transaction.category === "give" || transaction.category === "spend") {
      setChildren((items) =>
        items.map((child) =>
          child.id === transaction.childId ? { ...child, coins: Math.max(0, child.coins - transaction.amount) } : child,
        ),
      );
    }
  }

  function requestBankMove(category: BankCategory) {
    if (!activeChild) return;
    setTransactions((items) => [
      {
        id: `tx-${Date.now()}`,
        childId: activeChild.id,
        category,
        amount: category === "earn" ? 1 : 3,
        description: `${category.toUpperCase()} request from ${activeChild.name}`,
        status: "pending",
      },
      ...items,
    ]);
  }

  function addMoment() {
    if (!activeChild || !momentDraft.trim()) return;
    setMoments((items) => [
      {
        id: `moment-${Date.now()}`,
        childId: activeChild.id,
        petId: activePet?.id,
        mood: "kind",
        note: momentDraft.trim(),
      },
      ...items,
    ]);
    setMomentDraft("");
  }

  return (
    <main className="min-h-screen bg-[#fbfaf4] text-[#17231f]">
      <header className="sticky top-0 z-20 border-b border-[#ded8c7] bg-[#fbfaf4]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#165a4b] text-lg font-black text-white">P</span>
            <div>
              <h1 className="text-lg font-black leading-tight">PawPal Quest</h1>
              <p className="text-xs font-bold text-[#69736f]">Care. Earn. Save. Give. Grow.</p>
            </div>
          </div>
          <div className="flex rounded-full border border-[#d9d0bb] bg-white p-1 text-xs font-black">
            {(["parent", "child"] as Role[]).map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={`rounded-full px-4 py-2 capitalize ${role === item ? "bg-[#165a4b] text-white" : "text-[#53615b]"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-[#ded8c7] bg-white">
            <div className="relative h-36 bg-[linear-gradient(135deg,#165a4b,#f47b20_50%,#7c3aed)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(255,255,255,0.55),transparent_22%),radial-gradient(circle_at_70%_35%,rgba(255,255,255,0.35),transparent_18%)]" />
              <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/88 p-3 shadow-sm backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7a4b12]">Family</p>
                <h2 className="text-2xl font-black">Nalajala Pack</h2>
              </div>
            </div>
            <p className="p-4 text-sm font-semibold text-[#5f6a65]">
              {isSupabaseConfigured ? "Supabase connected" : "Demo mode until Supabase keys are added"}
            </p>
          </div>

          {role === "child" && (
            <div className="rounded-lg border border-[#ded8c7] bg-[#fff4d8] p-4">
              <p className="text-sm font-black">Secret code login</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#d7caa9] px-3 py-2 text-sm font-bold"
                  placeholder="2468"
                />
                <button onClick={childLogin} className="rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white">
                  Go
                </button>
              </div>
            </div>
          )}

          <nav className="grid gap-2">
            {["missions", "pets", "bank", "approvals", "setup", "growth"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-4 py-3 text-left text-sm font-black capitalize ${
                  activeTab === tab ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#28342f]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>

        <div className="space-y-5">
          <Hero
            child={activeChild}
            pet={activePet}
            pendingCount={pendingApprovals.length}
            taskProgress={taskProgress}
            approvedMissionCount={approvedMissionCount}
          />
          <FamilyPhotoStrip childProfiles={children} pets={pets} />
          {activeTab === "missions" && (
            <MissionsPanel
              activeChild={activeChild}
              missions={missions}
              pets={pets}
              missionNote={missionNote}
              setMissionNote={setMissionNote}
              completeMission={completeMission}
            />
          )}
          {activeTab === "pets" && <PassportPanel pets={pets} />}
          {activeTab === "bank" && (
            <BankPanel child={activeChild} transactions={transactions} goals={goals} requestBankMove={requestBankMove} />
          )}
          {activeTab === "approvals" && (
            <ApprovalsPanel
              missions={missions}
              transactions={transactions}
              childProfiles={children}
              approveMission={approveMission}
              approveTransaction={approveTransaction}
            />
          )}
          {activeTab === "setup" && (
            <SetupPanel
              newChild={newChild}
              setNewChild={setNewChild}
              addChild={addChild}
              newPet={newPet}
              setNewPet={setNewPet}
              addPet={addPet}
            />
          )}
          {activeTab === "growth" && (
            <GrowthPanel
              childProfiles={children}
              moments={moments}
              momentDraft={momentDraft}
              setMomentDraft={setMomentDraft}
              addMoment={addMoment}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function Hero({
  child,
  pet,
  pendingCount,
  taskProgress,
  approvedMissionCount,
}: {
  child?: Child;
  pet?: Pet;
  pendingCount: number;
  taskProgress: number;
  approvedMissionCount: number;
}) {
  const childLook = getChildLook(child?.id);
  const petLook = getPetLook(pet?.id);
  return (
    <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="overflow-hidden rounded-lg bg-[#165a4b] text-white">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7e7d5]">Today&apos;s quest</p>
            <h2 className="mt-3 text-4xl font-black">Help {pet?.name ?? "your pet"} feel safe, fed, and loved.</h2>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-[#d8f5e8]">
              The app now tracks task progress, pet happiness, and how much kids are enjoying the habit.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <ProfilePhoto label={child?.name ?? "Kid"} initial={childLook.initial} colors={childLook.colors} size="lg" variant="kid" hair={childLook.hair} />
            <ProfilePhoto label={pet?.name ?? "Pet"} initial={petLook.face} colors={petLook.colors} size="lg" variant="pet" petKind={petLook.kind} />
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/15 bg-white/8 p-5 sm:grid-cols-3">
          {familyStats.map(([label, value, color]) => (
            <Meter key={label} label={String(label)} value={Number(value)} color={String(color)} dark />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5">
        <div className="flex items-center gap-4">
          <ProfilePhoto label={child?.name ?? "Kid"} initial={childLook.initial} colors={childLook.colors} variant="kid" hair={childLook.hair} />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Active child</p>
            <h3 className="text-3xl font-black">{child?.name ?? "Add a child"}</h3>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-sm font-black">
            <span>Task progress</span>
            <span>{taskProgress}%</span>
          </div>
          <div className="h-4 rounded-full bg-[#f0ead8]">
            <div className="h-4 rounded-full bg-[#f47b20]" style={{ width: `${taskProgress}%` }} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
          <span className="rounded-lg bg-[#ecf7f0] p-3">{child?.points ?? 0}<br />points</span>
          <span className="rounded-lg bg-[#fff4d8] p-3">{approvedMissionCount}<br />approved</span>
          <span className="rounded-lg bg-[#f0edff] p-3">{pendingCount}<br />pending</span>
        </div>
        <div className="mt-4 grid gap-3">
          <Meter label="Loving the app" value={childLook.love} color="#7c3aed" />
          <Meter label="Happiness today" value={childLook.joy} color="#0f766e" />
        </div>
      </div>
    </section>
  );
}

function FamilyPhotoStrip({ childProfiles, pets }: { childProfiles: Child[]; pets: Pet[] }) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-4">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative min-h-48 overflow-hidden rounded-lg bg-[linear-gradient(135deg,#ffe6a7,#b8f7d4_45%,#d8ccff)] p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.75),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.55),transparent_16%),radial-gradient(circle_at_50%_78%,rgba(255,255,255,0.45),transparent_24%)]" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">Family picture</p>
            <h2 className="mt-2 max-w-md text-3xl font-black">A bright home base for everyone caring together.</h2>
          </div>
          <div className="absolute bottom-5 left-5 flex -space-x-3">
            {childProfiles.map((child) => {
              const look = getChildLook(child.id);
              return <ProfilePhoto key={child.id} label={child.name} initial={look.initial} colors={look.colors} variant="kid" hair={look.hair} />;
            })}
            {pets.map((pet) => {
              const look = getPetLook(pet.id);
              return <ProfilePhoto key={pet.id} label={pet.name} initial={look.face} colors={look.colors} variant="pet" petKind={look.kind} />;
            })}
          </div>
          <div className="absolute bottom-5 right-5 hidden items-end gap-3 sm:flex">
            <AnimatedFamilyCharacter tone="#ffd166" shirt="#165a4b" delay="0s" />
            <AnimatedFamilyCharacter tone="#f6b38a" shirt="#7c3aed" delay="0.25s" />
            <AnimatedPetBuddy color="#f47b20" delay="0.1s" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {familyStats.map(([label, value, color]) => (
            <div key={label} className="rounded-lg bg-[#f8f6ed] p-4">
              <Meter label={String(label)} value={Number(value)} color={String(color)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  missionNote: string;
  setMissionNote: (value: string) => void;
  completeMission: (missionId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Daily missions</p>
          <h2 className="mt-2 text-3xl font-black">Question-based care checklist</h2>
        </div>
        <textarea
          value={props.missionNote}
          onChange={(event) => props.setMissionNote(event.target.value)}
          className="min-h-20 rounded-lg border border-[#ded8c7] px-3 py-2 text-sm font-semibold sm:w-80"
          placeholder="Quick voice/text check-in..."
        />
      </div>
      <div className="mt-5 grid gap-3">
        {props.missions.map((mission) => {
          const pet = props.pets.find((item) => item.id === mission.petId);
          return (
            <article key={mission.id} className="grid gap-3 rounded-lg bg-[#f8f6ed] p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ef] py-1 pl-1 pr-3 text-xs font-black">
                    <ProfilePhoto label={pet?.name ?? "Family"} initial={getPetLook(pet?.id).face} colors={getPetLook(pet?.id).colors} size="xs" variant="pet" petKind={getPetLook(pet?.id).kind} />
                    {pet?.name ?? "Family"}
                  </span>
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                </div>
                <h3 className="mt-3 text-xl font-black">{mission.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{mission.question}</p>
              </div>
              <button
                onClick={() => props.completeMission(mission.id)}
                disabled={!props.activeChild || mission.status === "approved"}
                className="rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white disabled:bg-[#b9b2a2]"
              >
                {mission.status === "approved" ? "Approved" : mission.completedBy ? "Waiting" : "Complete"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PassportPanel({ pets }: { pets: Pet[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {pets.map((pet) => (
        <article key={pet.id} className="rounded-lg border border-[#ded8c7] bg-white p-5">
          <div className="flex items-center gap-4">
            <ProfilePhoto label={pet.name} initial={getPetLook(pet.id).face} colors={getPetLook(pet.id).colors} size="lg" variant="pet" petKind={getPetLook(pet.id).kind} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">{pet.name}&apos;s passport</p>
              <h2 className="text-3xl font-black">{pet.name}</h2>
              <p className="text-sm font-black text-[#0f766e]">{pet.species}</p>
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
    </section>
  );
}

function BankPanel(props: {
  child?: Child;
  transactions: BankTransaction[];
  goals: SavingsGoal[];
  requestBankMove: (category: BankCategory) => void;
}) {
  const childTransactions = props.transactions.filter((item) => item.childId === props.child?.id);
  const childGoals = props.goals.filter((item) => item.childId === props.child?.id);
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Kid Bank</p>
      <h2 className="mt-2 text-3xl font-black">Earn, save, spend, give</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["earn", "save", "spend", "give"] as BankCategory[]).map((category) => (
          <button key={category} onClick={() => props.requestBankMove(category)} className="rounded-lg bg-[#17231f] p-4 text-left text-sm font-black capitalize text-white">
            {category}
            <span className="mt-2 block text-xs font-semibold text-[#cdd7d1]">Request parent approval</span>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-[#f8f6ed] p-4">
          <h3 className="font-black">Savings goals</h3>
          {childGoals.map((goal) => (
            <div key={goal.id} className="mt-3">
              <div className="flex justify-between text-sm font-black"><span>{goal.title}</span><span>${goal.saved}/${goal.target}</span></div>
              <div className="mt-2 h-3 rounded-full bg-white"><div className="h-3 rounded-full bg-[#0f766e]" style={{ width: `${Math.min(100, (goal.saved / goal.target) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-[#f8f6ed] p-4">
          <h3 className="font-black">Transactions</h3>
          {childTransactions.map((tx) => (
            <p key={tx.id} className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold">
              <b className="capitalize">{tx.category}</b> ${tx.amount} - {tx.description} - {tx.status}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApprovalsPanel(props: {
  missions: Mission[];
  transactions: BankTransaction[];
  childProfiles: Child[];
  approveMission: (missionId: string) => void;
  approveTransaction: (transactionId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent dashboard</p>
      <h2 className="mt-2 text-3xl font-black">Approvals keep the app safe</h2>
      <div className="mt-5 grid gap-3">
        {props.missions.filter((mission) => mission.completedBy && mission.status === "pending").map((mission) => (
          <article key={mission.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:flex-row sm:items-center">
            <p className="font-semibold"><b>{props.childProfiles.find((child) => child.id === mission.completedBy)?.name}</b> completed {mission.title}. Note: {mission.note}</p>
            <button onClick={() => props.approveMission(mission.id)} className="rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Approve</button>
          </article>
        ))}
        {props.transactions.filter((tx) => tx.status === "pending").map((tx) => (
          <article key={tx.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#fff4d8] p-4 sm:flex-row sm:items-center">
            <p className="font-semibold"><b>{props.childProfiles.find((child) => child.id === tx.childId)?.name}</b> requested {tx.category} ${tx.amount}: {tx.description}</p>
            <button onClick={() => props.approveTransaction(tx.id)} className="rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Approve</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function SetupPanel(props: {
  newChild: { name: string; code: string };
  setNewChild: (value: { name: string; code: string }) => void;
  addChild: () => void;
  newPet: { name: string; species: string; food: string };
  setNewPet: (value: { name: string; species: string; food: string }) => void;
  addPet: () => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5">
        <h2 className="text-2xl font-black">Add child</h2>
        <input className="mt-4 w-full rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" placeholder="Child name" value={props.newChild.name} onChange={(event) => props.setNewChild({ ...props.newChild, name: event.target.value })} />
        <input className="mt-3 w-full rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" placeholder="Secret code" value={props.newChild.code} onChange={(event) => props.setNewChild({ ...props.newChild, code: event.target.value })} />
        <button onClick={props.addChild} className="mt-4 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Create child profile</button>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5">
        <h2 className="text-2xl font-black">Add pet</h2>
        <input className="mt-4 w-full rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" placeholder="Pet name" value={props.newPet.name} onChange={(event) => props.setNewPet({ ...props.newPet, name: event.target.value })} />
        <input className="mt-3 w-full rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" placeholder="Species" value={props.newPet.species} onChange={(event) => props.setNewPet({ ...props.newPet, species: event.target.value })} />
        <input className="mt-3 w-full rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" placeholder="Favorite food" value={props.newPet.food} onChange={(event) => props.setNewPet({ ...props.newPet, food: event.target.value })} />
        <button onClick={props.addPet} className="mt-4 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Create pet passport</button>
      </div>
    </section>
  );
}

function GrowthPanel(props: {
  childProfiles: Child[];
  moments: MemoryMoment[];
  momentDraft: string;
  setMomentDraft: (value: string) => void;
  addMoment: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Character growth</p>
      <h2 className="mt-2 text-3xl font-black">Responsibility, empathy, kindness, leadership</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-lg bg-[#f8f6ed] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ProfilePhoto label={child.name} initial={getChildLook(child.id).initial} colors={getChildLook(child.id).colors} variant="kid" hair={getChildLook(child.id).hair} />
                <h3 className="text-xl font-black">{child.name}</h3>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[child.level]}</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Meter label="Task progress" value={Math.min(100, Math.round((child.points / 220) * 100))} color="#f47b20" />
              <Meter label="Loving it" value={getChildLook(child.id).love} color="#7c3aed" />
              <Meter label="Happiness" value={getChildLook(child.id).joy} color="#0f766e" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-white p-3">{child.points}<br />points</span>
              <span className="rounded-lg bg-white p-3">{child.streakDays}<br />streak</span>
              <span className="rounded-lg bg-white p-3">{child.coins}<br />coins</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-[#f0edff] p-4">
        <h3 className="font-black">Memory moments</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className="min-w-0 flex-1 rounded-lg border border-[#ded8c7] px-3 py-3 font-semibold" value={props.momentDraft} onChange={(event) => props.setMomentDraft(event.target.value)} />
          <button onClick={props.addMoment} className="rounded-lg bg-[#7c3aed] px-5 py-3 text-sm font-black text-white">Save moment</button>
        </div>
        {props.moments.map((moment) => (
          <p key={moment.id} className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold">{moment.note}</p>
        ))}
      </div>
    </section>
  );
}

function ProfilePhoto({
  label,
  initial,
  colors,
  size = "md",
  variant = "kid",
  hair = "#2f1b12",
  petKind = "pet",
}: {
  label: string;
  initial: string;
  colors: string;
  size?: "xs" | "md" | "lg";
  variant?: "kid" | "pet";
  hair?: string;
  petKind?: "dog" | "guinea" | "pet";
}) {
  const sizeClass = size === "lg" ? "size-24 text-4xl" : size === "xs" ? "size-7 text-xs" : "size-16 text-2xl";
  return (
    <div
      aria-label={`${label} photo placeholder`}
      className={`${sizeClass} relative grid shrink-0 place-items-center overflow-visible rounded-full border-4 border-white bg-gradient-to-br ${colors} font-black text-white shadow-md`}
      title={`${label} photo`}
    >
      {variant === "pet" ? (
        <PetCharacter kind={petKind} size={size} />
      ) : (
        <KidCharacter initial={initial} hair={hair} size={size} />
      )}
    </div>
  );
}

function KidCharacter({ initial, hair, size }: { initial: string; hair: string; size: "xs" | "md" | "lg" }) {
  const compact = size === "xs";
  return (
    <div className={`relative ${compact ? "scale-[0.45]" : size === "lg" ? "scale-110" : "scale-90"} animate-[character-bob_2.8s_ease-in-out_infinite]`}>
      <div className="absolute -left-5 top-6 h-7 w-3 origin-top rounded-full bg-[#ffe7c2] animate-[arm-wave_1.8s_ease-in-out_infinite]" />
      <div className="absolute -right-5 top-7 h-7 w-3 origin-top rounded-full bg-[#ffe7c2] animate-[arm-wave_2.1s_ease-in-out_infinite_reverse]" />
      <div className="relative size-14 rounded-full bg-[#ffe7c2] shadow-inner">
        <div className="absolute -top-2 left-2 right-2 h-5 rounded-t-full" style={{ backgroundColor: hair }} />
        <div className="absolute left-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
        <div className="absolute right-4 top-6 size-1.5 rounded-full bg-[#17231f]" />
        <div className="absolute bottom-3 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
      </div>
      <div className="mx-auto -mt-1 grid h-8 w-12 place-items-center rounded-t-2xl bg-white/90 text-sm font-black text-[#17231f]">
        {initial}
      </div>
    </div>
  );
}

function PetCharacter({ kind, size }: { kind: "dog" | "guinea" | "pet"; size: "xs" | "md" | "lg" }) {
  const compact = size === "xs";
  const isDog = kind === "dog";
  return (
    <div className={`relative ${compact ? "scale-[0.42]" : size === "lg" ? "scale-110" : "scale-90"} animate-[pet-wiggle_2.4s_ease-in-out_infinite]`}>
      {isDog ? (
        <>
          <div className="absolute -left-4 top-2 h-9 w-5 rotate-[-22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_1.9s_ease-in-out_infinite]" />
          <div className="absolute -right-4 top-2 h-9 w-5 rotate-[22deg] rounded-full bg-[#6b3b19] animate-[ear-flop_2.1s_ease-in-out_infinite_reverse]" />
        </>
      ) : (
        <>
          <div className="absolute -left-2 top-0 size-5 rounded-full bg-[#f7d7aa]" />
          <div className="absolute -right-2 top-0 size-5 rounded-full bg-[#f7d7aa]" />
        </>
      )}
      <div className="relative size-16 rounded-full bg-[#f9d8a7] shadow-inner">
        <div className="absolute left-4 top-6 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute right-4 top-6 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute left-1/2 top-8 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
        <div className="absolute bottom-3 left-1/2 h-2 w-6 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
        <div className="absolute -bottom-1 right-2 h-3 w-6 rounded-full bg-[#ff7a7a] animate-[tongue-pop_2.5s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

function AnimatedFamilyCharacter({ tone, shirt, delay }: { tone: string; shirt: string; delay: string }) {
  return (
    <div className="relative h-24 w-16 animate-[character-bob_2.6s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <div className="absolute left-1/2 top-0 size-12 -translate-x-1/2 rounded-full shadow-inner" style={{ backgroundColor: tone }}>
        <div className="absolute left-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
        <div className="absolute right-3 top-6 size-1.5 rounded-full bg-[#17231f]" />
        <div className="absolute bottom-2 left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-[#17231f]" />
      </div>
      <div className="absolute bottom-0 left-1/2 h-12 w-14 -translate-x-1/2 rounded-t-3xl" style={{ backgroundColor: shirt }} />
      <div className="absolute bottom-7 left-0 h-8 w-3 origin-top rounded-full animate-[arm-wave_1.7s_ease-in-out_infinite]" style={{ backgroundColor: tone }} />
    </div>
  );
}

function AnimatedPetBuddy({ color, delay }: { color: string; delay: string }) {
  return (
    <div className="relative h-20 w-20 animate-[pet-wiggle_2.1s_ease-in-out_infinite]" style={{ animationDelay: delay }}>
      <div className="absolute left-2 top-3 h-9 w-5 -rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute right-2 top-3 h-9 w-5 rotate-12 rounded-full bg-[#6b3b19]" />
      <div className="absolute bottom-0 left-1/2 size-16 -translate-x-1/2 rounded-full" style={{ backgroundColor: color }}>
        <div className="absolute left-5 top-7 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute right-5 top-7 size-2 rounded-full bg-[#17231f]" />
        <div className="absolute bottom-4 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#17231f]" />
      </div>
    </div>
  );
}

function Meter({ label, value, color, dark = false }: { label: string; value: number; color: string; dark?: boolean }) {
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

function getChildLook(childId?: string) {
  return childLooks[childId ?? ""] ?? { initial: "K", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", joy: 80, love: 80, hair: "#2f1b12" };
}

function getPetLook(petId?: string) {
  return petLooks[petId ?? ""] ?? { face: "P", colors: "from-[#ffd166] via-[#f47b20] to-[#165a4b]", happiness: 80, loved: 80, kind: "pet" };
}
