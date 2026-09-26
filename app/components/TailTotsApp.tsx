"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Cropper, { type Area } from "react-easy-crop";
import {
  isSupabaseConfigured,
  loadFamilyAccountSnapshot,
  saveFamilyAccountSnapshot,
  sendParentMagicLink,
  signOutParentAccount,
  submitFeedback,
  submitLaunchInterest,
  supabase,
} from "@/lib/supabase";
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

const difficultyAgeGuidance: Record<LevelKey, { minAge: number; label: string }> = {
  easy: { minAge: 4, label: "Ages 4+" },
  medium: { minAge: 7, label: "Ages 7+" },
  hard: { minAge: 10, label: "Ages 10+" },
  super_hard: { minAge: 13, label: "Ages 13+" },
};

const starterChildren: Child[] = [
  { id: "sahasra", name: "Maya", age: 6, secretCode: "", points: 180, coins: 26, level: "medium", streakDays: 5 },
  { id: "aarush", name: "Leo", age: 9, secretCode: "", points: 72, coins: 14, level: "easy", streakDays: 2 },
];

const starterPets: Pet[] = [
  {
    id: "jack",
    name: "Jack",
    species: "Guinea pig",
    favoriteFood: "Romaine",
    careNotes: "Fresh hay, clean cage corners, quiet handling.",
    vet: "Green Trail Vet",
    medicine: "None",
  },
  {
    id: "jamie",
    name: "Jamie",
    species: "Guinea pig",
    favoriteFood: "Bell pepper",
    careNotes: "Check water bottle, refill hay, and keep the bedding dry.",
    vet: "Family Pet Clinic",
    medicine: "None",
  },
  {
    id: "captain",
    name: "Captain",
    species: "Tortoise",
    favoriteFood: "Leafy greens",
    careNotes: "Fresh greens, clean water, and a warm basking spot.",
    vet: "Exotic Pet Clinic",
    medicine: "None",
  },
  {
    id: "rb",
    name: "RB",
    species: "Fish",
    favoriteFood: "Fish flakes",
    careNotes: "Feed a small pinch and check that the water looks clear.",
    vet: "Aquatic care store",
    medicine: "None",
  },
];

type ParentProfile = {
  id: string;
  name: string;
  photoUrl?: string;
};

type PhotoCropDraft = {
  targetType: "parent" | "child" | "pet";
  targetId: string;
  label: string;
  imageUrl: string;
  fit: "cover" | "contain";
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels?: Area;
};

type PhotoCropTarget = Pick<PhotoCropDraft, "targetType" | "targetId" | "label" | "fit">;
type PetKind = "dog" | "guinea" | "tortoise" | "fish" | "pet";
type LifeSkillKey = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";
type TrustSignalKey = "parent_gate" | "age_fit" | "no_messaging" | "adult_nearby" | "private_child";

type BadgeAward = {
  id: string;
  childId: string;
  title: string;
  skill: LifeSkillKey;
  note: string;
  awardedAt: string;
};

type NeighborhoodJob = {
  id: string;
  title: string;
  family: string;
  pet: string;
  time: string;
  rewardDollars: number;
  badgeTitle: string;
  assignedChildIds: string[];
  visibleToKids: boolean;
  checklist: string[];
  safety: string;
  minAge?: number;
  skillFocus?: LifeSkillKey;
  trustSignals?: TrustSignalKey[];
  status: "posted" | "accepted" | "approved" | "completed";
  acceptedBy?: string;
  missionId?: string;
};

type KidScheduleItem = {
  id: string;
  childId: string;
  day: string;
  time: string;
  title: string;
  kind: "pet" | "school" | "family" | "hobby";
  note: string;
};

const starterParents: ParentProfile[] = [{ id: "parent-1", name: "Parent" }];

const starterMissions: Mission[] = [
  {
    id: "feed-jack",
    title: "Feed Jack breakfast",
    category: "pet_care",
    difficulty: "easy",
    points: 12,
    coins: 2,
    allowanceDollars: 0,
    assignedChildId: "aarush",
    petId: "jack",
    question: "Did Jack get fresh food, hay, and water?",
    status: "pending",
  },
  {
    id: "clean-jamie",
    title: "Clean Jamie's cage corner",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    allowanceDollars: 1,
    assignedChildId: "aarush",
    petId: "jamie",
    question: "What did you notice that made Jamie more comfortable?",
    status: "pending",
  },
  {
    id: "check-captain",
    title: "Check Captain's basking spot",
    category: "pet_care",
    difficulty: "medium",
    points: 18,
    coins: 3,
    allowanceDollars: 1,
    assignedChildId: "aarush",
    petId: "captain",
    question: "Was Captain's light, water, and greens ready?",
    status: "pending",
  },
  {
    id: "feed-rb",
    title: "Feed RB",
    category: "pet_care",
    difficulty: "easy",
    points: 10,
    coins: 1,
    allowanceDollars: 0,
    assignedChildId: "sahasra",
    petId: "rb",
    question: "Did RB get a small pinch of food?",
    status: "pending",
  },
  {
    id: "water-plants",
    title: "Water front plants with parent check",
    category: "chore",
    difficulty: "medium",
    points: 18,
    coins: 4,
    allowanceDollars: 3,
    assignedChildId: "aarush",
    question: "Were the plants watered gently and did a parent check the area?",
    status: "pending",
  },
  {
    id: "kind-note",
    title: "Kindness check-in",
    category: "kindness",
    difficulty: "easy",
    points: 12,
    coins: 0,
    allowanceDollars: 0,
    assignedChildId: "sahasra",
    question: "How did you know your pet felt safe or happy today?",
    status: "pending",
  },
];

const starterGoals: SavingsGoal[] = [
  { id: "goal-1", childId: "sahasra", title: "Guinea pig tunnel", target: 24, saved: 15, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Helping Jack and Jamie get more enrichment." },
  { id: "goal-2", childId: "aarush", title: "Fish tank plant", target: 20, saved: 6, type: "toy", sharedWithTrustedFamilies: true, causeNote: "Making RB's tank healthier and more fun." },
];

const starterTransactions: BankTransaction[] = [
  { id: "tx-1", childId: "sahasra", category: "earn", amount: 3, description: "Earned from approved pet care missions", status: "approved" },
  { id: "tx-2", childId: "aarush", category: "save", amount: 2, description: "Save $2 for Fish tank plant", goalId: "goal-2", status: "pending" },
];

const starterMoments: MemoryMoment[] = [
  { id: "moment-1", childId: "sahasra", petId: "jack", mood: "proud", note: "Jack waited calmly while Maya filled the water bowl." },
];

const starterBadges: BadgeAward[] = [
  { id: "badge-1", childId: "sahasra", title: "Gentle Hands", skill: "empathy", note: "Stayed calm and gentle during Jack's water refill.", awardedAt: "Today" },
  { id: "badge-2", childId: "aarush", title: "On-Time Helper", skill: "time", note: "Remembered RB's breakfast before school.", awardedAt: "Today" },
];

const starterNeighborhoodJobs: NeighborhoodJob[] = [
  {
    id: "job-milo",
    title: "Care visit for Milo",
    family: "Patel family",
    pet: "Milo the rabbit",
    time: "Tuesday, 4:30 PM",
    rewardDollars: 4,
    badgeTitle: "Kind Neighbor",
    assignedChildIds: ["sahasra", "aarush"],
    visibleToKids: false,
    checklist: ["Refill hay", "Check water bottle", "Send parent photo"],
    safety: "Parent stays nearby; no cage cleaning yet.",
    minAge: 8,
    skillFocus: "empathy",
    trustSignals: ["parent_gate", "age_fit", "adult_nearby", "private_child"],
    status: "posted",
  },
  {
    id: "job-sunny",
    title: "Morning check for Sunny",
    family: "Garcia family",
    pet: "Sunny the parakeet",
    time: "Saturday morning",
    rewardDollars: 0,
    badgeTitle: "Careful Observer",
    assignedChildIds: ["sahasra"],
    visibleToKids: false,
    checklist: ["Look at water cup", "Check food level", "Tell parent if cage looks messy"],
    safety: "No handling the bird; adult opens cage only.",
    minAge: 10,
    skillFocus: "responsibility",
    trustSignals: ["parent_gate", "age_fit", "no_messaging", "private_child"],
    status: "posted",
  },
];

const starterScheduleItems: KidScheduleItem[] = [
  { id: "schedule-sahasra-1", childId: "sahasra", day: "Today", time: "7:30 AM", title: "RB breakfast check", kind: "pet", note: "Small pinch of food, then tell parent." },
  { id: "schedule-sahasra-2", childId: "sahasra", day: "Today", time: "5:45 PM", title: "Gentle pet moment", kind: "pet", note: "Notice one kind thing about Jack or Jamie." },
  { id: "schedule-sahasra-3", childId: "sahasra", day: "Wednesday", time: "4:30 PM", title: "Drawing and quiet pet time", kind: "hobby", note: "Draw one pet care idea after homework." },
  { id: "schedule-aarush-1", childId: "aarush", day: "Today", time: "7:15 AM", title: "Jack food and water", kind: "pet", note: "Check hay, food, and water before school." },
  { id: "schedule-aarush-2", childId: "aarush", day: "Saturday", time: "10:00 AM", title: "Plant helper round", kind: "family", note: "Water plants with parent check." },
  { id: "schedule-aarush-3", childId: "aarush", day: "Thursday", time: "5:00 PM", title: "Pet passport update", kind: "pet", note: "Add one observation about Captain or RB." },
];

const childLooks: Record<string, { initial: string; colors: string; joy: number; love: number; hair: string }> = {
  sahasra: { initial: "M", colors: "from-[#ffcf70] via-[#ff8a65] to-[#7c3aed]", joy: 92, love: 88, hair: "#4a2718" },
  aarush: { initial: "L", colors: "from-[#79d6ff] via-[#4ade80] to-[#2563eb]", joy: 78, love: 84, hair: "#1f2937" },
};

const petLooks: Record<string, { face: string; colors: string; happiness: number; loved: number; kind: PetKind }> = {
  jack: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 94, loved: 91, kind: "guinea" },
  jamie: { face: "J", colors: "from-[#ffd166] via-[#f47b20] to-[#7c2d12]", happiness: 83, loved: 89, kind: "guinea" },
  captain: { face: "C", colors: "from-[#86efac] via-[#65a30d] to-[#365314]", happiness: 88, loved: 90, kind: "tortoise" },
  rb: { face: "R", colors: "from-[#93c5fd] via-[#06b6d4] to-[#1d4ed8]", happiness: 86, loved: 87, kind: "fish" },
};

const familyStats = [
  ["Care rhythm", 88, "#f47b20"],
  ["Pet comfort", 91, "#0f766e"],
  ["Kid confidence", 86, "#2563eb"],
];

const tabItems = [
  { id: "vision", label: "Vision" },
  { id: "missions", label: "Today" },
  { id: "schedule", label: "Schedule" },
  { id: "hub", label: "Home Hub" },
  { id: "pets", label: "Pet Passports" },
  { id: "pet-helper", label: "Pet Helper" },
  { id: "bank", label: "Kid Bank" },
  { id: "approvals", label: "Parent Review" },
  { id: "setup", label: "Family Setup" },
  { id: "neighborhood", label: "Neighborhood" },
  { id: "growth", label: "Growth Log" },
  { id: "ai", label: "AI" },
  { id: "ecosystem", label: "Ecosystem" },
];

const kidTabIds = ["missions", "schedule", "hub", "pets", "pet-helper", "bank", "neighborhood", "growth"];
const parentTabIds = ["vision", "approvals", "schedule", "hub", "pets", "neighborhood", "growth", "ai", "ecosystem"];
const defaultParentPasscode = "4321";

const savedFamilyStateKey = "tailtots-family-state-v1";
const legacySavedFamilyStateKey = "pawpal-family-state-v1";

type SavedFamilyState = {
  familyName?: string;
  parentPasscode?: string;
  parents: ParentProfile[];
  children: Child[];
  pets: Pet[];
  missions?: Mission[];
  transactions?: BankTransaction[];
  goals?: SavingsGoal[];
  badges?: BadgeAward[];
  neighborhoodJobs?: NeighborhoodJob[];
  moments?: MemoryMoment[];
  familyPhotoUrl?: string;
  activeChildId?: string;
};

export function TailTotsApp() {
  const [role, setRole] = useState<Role>("parent");
  const [activeTab, setActiveTab] = useState("vision");
  const [isParentUnlocked, setIsParentUnlocked] = useState(true);
  const [hasLoadedSavedState, setHasLoadedSavedState] = useState(false);
  const [familyName, setFamilyName] = useState("Demo Crew");
  const [parentPasscode, setParentPasscode] = useState(defaultParentPasscode);
  const [parents, setParents] = useState(starterParents);
  const [children, setChildren] = useState(starterChildren);
  const [pets, setPets] = useState(starterPets);
  const [missions, setMissions] = useState(starterMissions);
  const [transactions, setTransactions] = useState(starterTransactions);
  const [goals, setGoals] = useState(starterGoals);
  const [badges, setBadges] = useState(starterBadges);
  const [neighborhoodJobs, setNeighborhoodJobs] = useState(starterNeighborhoodJobs);
  const [scheduleItems] = useState(starterScheduleItems);
  const [moments, setMoments] = useState<MemoryMoment[]>(starterMoments);
  const [activeChildId, setActiveChildId] = useState(starterChildren[0]?.id ?? "");
  const [missionNote, setMissionNote] = useState("");
  const [newChild, setNewChild] = useState({ name: "", age: "8" });
  const [newPet, setNewPet] = useState({ name: "", species: "", food: "" });
  const [newGoal, setNewGoal] = useState({ title: "", target: "25" });
  const [momentDraft, setMomentDraft] = useState("A kind moment with our pet was...");
  const [familyPhotoUrl, setFamilyPhotoUrl] = useState<string | undefined>();
  const [photoCropDraft, setPhotoCropDraft] = useState<PhotoCropDraft | undefined>();
  const [pendingPhotoCropQueue, setPendingPhotoCropQueue] = useState<PhotoCropTarget[]>([]);
  const [jobDraft, setJobDraft] = useState({
    title: "Pet sitting helper",
    family: "Neighbor family",
    pet: "Pet name",
    time: "Saturday, 10:00 AM",
    rewardDollars: "5",
    badgeTitle: "Trusted Helper",
    safety: "Parent confirms address and stays reachable.",
  });
  const [cloudAccountEmail, setCloudAccountEmail] = useState("");
  const [accountDraft, setAccountDraft] = useState({ email: "" });
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving" | "loading" | "error" | "saved">("idle");
  const [accountMessage, setAccountMessage] = useState("");
  const [appMode, setAppMode] = useState<"demo" | "real">("demo");

  const activeChild = children.find((child) => child.id === activeChildId) ?? children[0];
  const activePet = pets[0];
  const activeChildMissions = missions.filter((mission) => !mission.assignedChildId || mission.assignedChildId === activeChild?.id);
  const activeApprovedMissionCount = activeChildMissions.filter((mission) => mission.status === "approved").length;
  const activeCompletedMissionCount = activeChildMissions.filter((mission) => mission.completedBy).length;
  const taskProgress = Math.round((activeCompletedMissionCount / Math.max(1, activeChildMissions.length)) * 100);
  const fairnessSummary = useMemo(() => getFairnessSummary(missions, children), [children, missions]);
  const familySkillSummary = useMemo(() => getFamilySkillSummary(badges, children), [badges, children]);

  const pendingApprovals = useMemo(
    () => [
      ...missions.filter((mission) => mission.status === "pending" && mission.completedBy),
      ...transactions.filter((transaction) => transaction.status === "pending"),
    ],
    [missions, transactions],
  );
  const visibleTabs = useMemo(
    () => tabItems.filter((tab) => (role === "parent" ? parentTabIds.includes(tab.id) : kidTabIds.includes(tab.id))),
    [role],
  );
  const visibleActiveTab = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : visibleTabs[0]?.id;
  const isRouteChooser = role === "parent" && visibleActiveTab === "vision";
  const operatorLabel = role === "parent" ? "Parent operating" : `${activeChild?.name ?? "Kid"} operating`;

  useEffect(() => {
    queueMicrotask(() => {
      const savedState = loadSavedFamilyState();
      if (savedState) {
        setFamilyName(savedState.familyName ?? "Demo Crew");
        setParentPasscode(defaultParentPasscode);
        setParents(savedState.parents);
        setChildren(savedState.children.map(normalizeChildProfile));
        setPets(savedState.pets.map(normalizePetProfile));
        setMissions(savedState.missions ?? starterMissions);
        setTransactions(savedState.transactions ?? starterTransactions);
        setGoals(savedState.goals ?? starterGoals);
        setBadges(savedState.badges ?? starterBadges);
        setNeighborhoodJobs(savedState.neighborhoodJobs ? savedState.neighborhoodJobs.map(normalizeNeighborhoodJob) : starterNeighborhoodJobs);
        setMoments(savedState.moments ?? starterMoments);
        setFamilyPhotoUrl(savedState.familyPhotoUrl);
        setActiveChildId(savedState.activeChildId ?? savedState.children?.[0]?.id ?? "");
      }
      setHasLoadedSavedState(true);
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setCloudAccountEmail(data.session?.user.email ?? "");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudAccountEmail(session?.user.email ?? "");
      if (session?.user) setMagicLinkSent(false);
    });
    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedState) return;
    saveFamilyState({ familyName, parentPasscode, parents, children, pets, missions, transactions, goals, badges, neighborhoodJobs, moments, familyPhotoUrl, activeChildId });
  }, [activeChildId, badges, children, familyName, familyPhotoUrl, goals, hasLoadedSavedState, missions, moments, neighborhoodJobs, parentPasscode, parents, pets, transactions]);

  useEffect(() => {
    queueMicrotask(() => {
      const requestedTab = new URLSearchParams(window.location.search).get("tab");
      if (!requestedTab || !tabItems.some((tab) => tab.id === requestedTab)) return;
      setActiveTab(requestedTab);
      if (requestedTab === "hub") setRole("child");
    });
  }, []);

  function getCurrentFamilySnapshot(): SavedFamilyState {
    return {
      familyName,
      parentPasscode,
      parents,
      children,
      pets,
      missions,
      transactions,
      goals,
      badges,
      neighborhoodJobs,
      moments,
      familyPhotoUrl,
      activeChildId,
    };
  }

  function applyFamilySnapshot(snapshot: SavedFamilyState) {
    setFamilyName(snapshot.familyName ?? "My Family");
    setParentPasscode(snapshot.parentPasscode ?? defaultParentPasscode);
    setParents(snapshot.parents ?? starterParents);
    setChildren(snapshot.children ? snapshot.children.map(normalizeChildProfile) : starterChildren);
    setPets(snapshot.pets ? snapshot.pets.map(normalizePetProfile) : starterPets);
    setMissions(snapshot.missions ?? starterMissions);
    setTransactions(snapshot.transactions ?? starterTransactions);
    setGoals(snapshot.goals ?? starterGoals);
    setBadges(snapshot.badges ?? starterBadges);
    setNeighborhoodJobs(snapshot.neighborhoodJobs ? snapshot.neighborhoodJobs.map(normalizeNeighborhoodJob) : starterNeighborhoodJobs);
    setMoments(snapshot.moments ?? starterMoments);
    setFamilyPhotoUrl(snapshot.familyPhotoUrl);
    setActiveChildId(snapshot.activeChildId ?? snapshot.children?.[0]?.id ?? (snapshot.children ? "" : starterChildren[0]?.id ?? ""));
  }

  function openRouteChooser() {
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("vision");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function openContactSection() {
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("vision");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById("landing-contact");
        if (!target) return;
        const targetTop = target.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      });
    });
  }

  function loadDemoFamily() {
    setAppMode("demo");
    applyFamilySnapshot({
      familyName: "Demo Crew",
      parentPasscode: defaultParentPasscode,
      parents: starterParents,
      children: starterChildren,
      pets: starterPets,
      missions: starterMissions,
      transactions: starterTransactions,
      goals: starterGoals,
      badges: starterBadges,
      neighborhoodJobs: starterNeighborhoodJobs,
      moments: starterMoments,
      activeChildId: starterChildren[0]?.id ?? "",
    });
  }

  function openParentDemo() {
    loadDemoFamily();
    setRole("parent");
    setIsParentUnlocked(true);
    setActiveTab("approvals");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function openKidDemo() {
    loadDemoFamily();
    setRole("child");
    setActiveChildId(starterChildren[0]?.id ?? "");
    setActiveTab("missions");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  async function sendParentSignInLink() {
    setAccountStatus("loading");
    setAccountMessage("");
    setMagicLinkSent(false);
    try {
      await sendParentMagicLink(accountDraft.email);
      setAccountStatus("saved");
      setMagicLinkSent(true);
      setAccountMessage(`Sign-in link sent to ${accountDraft.email.trim().toLowerCase()}. Check that inbox (and spam) — the link expires soon.`);
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not send the sign-in link.");
    }
  }

  async function saveCurrentFamilyAccount() {
    setAccountStatus("saving");
    setAccountMessage("");
    try {
      await saveFamilyAccountSnapshot(getCurrentFamilySnapshot());
      setAccountStatus("saved");
      setAccountMessage("Saved this family's profiles, photos, goals, points, Kid Bank, and parent settings to the account.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not save this family account.");
    }
  }

  async function loadCurrentFamilyAccount() {
    if (typeof window !== "undefined" && !window.confirm("Load the family setup saved to this parent account? This replaces the family setup on this device.")) {
      return;
    }
    setAccountStatus("loading");
    setAccountMessage("");
    try {
      const snapshot = await loadFamilyAccountSnapshot<SavedFamilyState>();
      if (!snapshot) {
        setAccountStatus("saved");
        setAccountMessage("No saved cloud family setup yet.");
        return;
      }
      applyFamilySnapshot(snapshot);
      setAccountStatus("saved");
      setAccountMessage("Loaded this family's cloud account.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not load this family account.");
    }
  }

  async function signOutParentAccountFromApp() {
    setAccountStatus("loading");
    setAccountMessage("");
    try {
      await signOutParentAccount();
      setCloudAccountEmail("");
      setAccountStatus("idle");
      setAccountMessage("Signed out. This device still keeps the local demo copy.");
    } catch (error) {
      setAccountStatus("error");
      setAccountMessage(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  function addChild() {
    if (!newChild.name.trim()) return;
    const child: Child = {
      id: `child-${Date.now()}`,
      name: newChild.name.trim(),
      age: Math.max(3, Math.min(18, Number(newChild.age) || 8)),
      secretCode: "",
      points: 0,
      coins: 0,
      level: "easy",
      streakDays: 0,
    };
    setChildren((items) => [...items, child]);
    setActiveChildId(child.id);
    setNewChild({ name: "", age: "8" });
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

  function updateParent(parentId: string, updates: Partial<ParentProfile>) {
    setParents((items) => items.map((parent) => (parent.id === parentId ? { ...parent, ...updates } : parent)));
  }


  function updateChild(childId: string, updates: Partial<Child>) {
    setChildren((items) => items.map((child) => (child.id === childId ? normalizeChildProfile({ ...child, ...updates }) : child)));
  }

  function updatePet(petId: string, updates: Partial<Pet>) {
    setPets((items) => items.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet)));
  }

  async function updateFamilyPhoto(file?: File) {
    if (!file) return;
    const url = await resizeImageFile(file, 1200, 0.82);
    setFamilyPhotoUrl(url);
  }

  async function updateFamilyPhotoAndPickProfiles(file?: File) {
    if (!file) return;
    const cropSourceUrl = await fileToDataUrl(file);
    setFamilyPhotoUrl(await resizeImageFile(file, 1200, 0.82));
    startSharedPhotoProfilePicking(cropSourceUrl);
  }

  function pickProfilesFromSavedFamilyPhoto() {
    if (!familyPhotoUrl) return;
    startSharedPhotoProfilePicking(familyPhotoUrl);
  }

  function startSharedPhotoProfilePicking(imageUrl: string) {
    const targets: PhotoCropTarget[] = [
      ...parents.map((parent) => ({
        targetType: "parent" as const,
        targetId: parent.id,
        label: parent.name || "Parent",
        fit: "cover" as const,
      })),
      ...children.map((child) => ({
        targetType: "child" as const,
        targetId: child.id,
        label: child.name || "Kid",
        fit: "cover" as const,
      })),
    ];
    if (!targets.length) return;
    const [firstTarget, ...remainingTargets] = targets;
    setPendingPhotoCropQueue(remainingTargets);
    openPhotoCropFromUrl(firstTarget, imageUrl);
  }

  async function updateChildPhoto(childId: string, file?: File) {
    const child = children.find((item) => item.id === childId);
    await openPhotoCrop("child", childId, child?.name ?? "Child", file, "cover");
  }

  async function updatePetPhoto(petId: string, file?: File) {
    const pet = pets.find((item) => item.id === petId);
    await openPhotoCrop("pet", petId, pet?.name ?? "Pet", file, "contain");
  }

  async function updateParentPhoto(parentId: string, file?: File) {
    const parent = parents.find((item) => item.id === parentId);
    await openPhotoCrop("parent", parentId, parent?.name ?? "Parent", file, "cover");
  }

  async function openPhotoCrop(targetType: PhotoCropDraft["targetType"], targetId: string, label: string, file?: File, fit: PhotoCropDraft["fit"] = "cover") {
    if (!file) return;
    openPhotoCropFromUrl({ targetType, targetId, label, fit }, await fileToDataUrl(file));
  }

  function openPhotoCropFromUrl(target: PhotoCropTarget, imageUrl: string) {
    const isPerson = target.targetType === "parent" || target.targetType === "child";
    setPhotoCropDraft({
      ...target,
      imageUrl,
      crop: { x: 0, y: isPerson ? -12 : 0 },
      zoom: target.fit === "contain" ? 0.85 : isPerson ? 1.45 : 1.05,
    });
  }

  async function savePhotoCrop() {
    if (!photoCropDraft) return;
    const photoUrl = await cropProfileImage(photoCropDraft);
    if (photoCropDraft.targetType === "parent") {
      setParents((items) => items.map((parent) => (parent.id === photoCropDraft.targetId ? { ...parent, photoUrl } : parent)));
    }
    if (photoCropDraft.targetType === "child") {
      setChildren((items) => items.map((child) => (child.id === photoCropDraft.targetId ? { ...child, photoUrl } : child)));
    }
    if (photoCropDraft.targetType === "pet") {
      setPets((items) => items.map((pet) => (pet.id === photoCropDraft.targetId ? { ...pet, photoUrl } : pet)));
    }
    const [nextTarget, ...remainingTargets] = pendingPhotoCropQueue;
    if (nextTarget) {
      setPendingPhotoCropQueue(remainingTargets);
      openPhotoCropFromUrl(nextTarget, photoCropDraft.imageUrl);
      return;
    }
    setPhotoCropDraft(undefined);
  }

  function requestChildSwitch(childId: string) {
    setActiveChildId(childId);
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    setActiveTab(nextRole === "parent" ? "hub" : "missions");
    if (nextRole === "parent") setIsParentUnlocked(true);
    if (nextRole === "child" && !activeChildId) setActiveChildId(children[0]?.id ?? starterChildren[0]?.id ?? "");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function completeMission(missionId: string) {
    if (!activeChild) return;
    const missionToComplete = missions.find((mission) => mission.id === missionId);
    if (missionToComplete?.assignedChildId && missionToComplete.assignedChildId !== activeChild.id) return;
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
    const skill = getMissionLifeSkill(mission);
    setBadges((items) => [
      {
        id: `badge-${Date.now()}`,
        childId: mission.completedBy!,
        title: getBadgeTitle(skill),
        skill,
        note: `Approved: ${mission.title}`,
        awardedAt: "Today",
      },
      ...items,
    ]);
    if (mission.allowanceDollars && mission.allowanceDollars > 0) {
      setTransactions((items) => [
        {
          id: `tx-${Date.now()}`,
          childId: mission.completedBy!,
          category: "earn",
          amount: mission.allowanceDollars ?? 0,
          description: `Earned from approved task: ${mission.title}`,
          activityId: mission.id,
          status: "approved",
        },
        ...items,
      ]);
    }
    setNeighborhoodJobs((items) => items.map((job) => (job.missionId === missionId ? { ...job, status: "completed" } : job)));
  }

  function approveTransaction(transactionId: string) {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) return;
    setTransactions((items) => items.map((item) => (item.id === transactionId ? { ...item, status: "approved" } : item)));
    if (transaction.category === "save" && transaction.goalId) {
      setGoals((items) =>
        items.map((goal) =>
          goal.id === transaction.goalId ? { ...goal, saved: Math.min(goal.target, goal.saved + transaction.amount) } : goal,
        ),
      );
    }
  }

  function rejectMission(missionId: string) {
    setMissions((items) => items.map((mission) => (mission.id === missionId ? { ...mission, completedBy: undefined, note: undefined, status: "rejected" } : mission)));
  }

  function assignMission(missionId: string, childId: string) {
    setMissions((items) =>
      items.map((mission) =>
        mission.id === missionId
          ? { ...mission, assignedChildId: childId, completedBy: undefined, note: undefined, status: "pending" }
          : mission,
      ),
    );
  }

  function autoBalanceMissions() {
    if (!children.length) return;
    setMissions((items) => {
      const totals = Object.fromEntries(children.map((child) => [child.id, 0]));
      const shuffledOpenMissions = [...items]
        .filter((mission) => mission.status !== "approved" && !mission.completedBy)
        .sort(() => Math.random() - 0.5);
      const assignments = new Map<string, string>();

      shuffledOpenMissions.forEach((mission) => {
        const ageFitChildren = children.filter((child) => isMissionAgeAppropriate(mission, child));
        const eligibleChildren = ageFitChildren.length ? ageFitChildren : children;
        const nextChild = [...eligibleChildren].sort((a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0))[0];
        if (!nextChild) return;
        assignments.set(mission.id, nextChild.id);
        totals[nextChild.id] = (totals[nextChild.id] ?? 0) + mission.points;
      });

      return items.map((mission) => (assignments.has(mission.id) ? { ...mission, assignedChildId: assignments.get(mission.id) } : mission));
    });
  }

  function rejectTransaction(transactionId: string) {
    setTransactions((items) => items.map((transaction) => (transaction.id === transactionId ? { ...transaction, status: "rejected" } : transaction)));
  }

  function requestBankMove(category: BankCategory, amount = category === "earn" ? 1 : 3, description?: string, goalId?: string) {
    if (!activeChild) return;
    const childTransactions = transactions.filter((item) => item.childId === activeChild.id && item.status === "approved");
    const approvedEarned = childTransactions.filter((item) => item.category === "earn").reduce((sum, item) => sum + item.amount, 0);
    const approvedSpentOrGiven = childTransactions.filter((item) => item.category === "spend" || item.category === "give").reduce((sum, item) => sum + item.amount, 0);
    const approvedGoalSavings = goals.filter((goal) => goal.childId === activeChild.id).reduce((sum, goal) => sum + goal.saved, 0);
    const availableBalance = Math.max(0, approvedEarned - approvedSpentOrGiven - approvedGoalSavings);
    if ((category === "save" || category === "give" || category === "spend") && amount > availableBalance) return;
    setTransactions((items) => [
      {
        id: `tx-${Date.now()}`,
        childId: activeChild.id,
        category,
        amount,
        description: description ?? `${category.toUpperCase()} request from ${activeChild.name}`,
        goalId,
        status: "pending",
      },
      ...items,
    ]);
  }

  function addSavingsGoal() {
    if (!activeChild || !newGoal.title.trim()) return;
    const target = Math.max(1, Number(newGoal.target) || 25);
    setGoals((items) => [
      {
        id: `goal-${Date.now()}`,
        childId: activeChild.id,
        title: newGoal.title.trim(),
        target,
        saved: 0,
        type: "family_reward",
        sharedWithTrustedFamilies: false,
        causeNote: "Parent can choose to share this goal with trusted families.",
      },
      ...items,
    ]);
    setNewGoal({ title: "", target: "25" });
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

  function postNeighborhoodJob() {
    const allowedChildren = children.map((child) => child.id);
    if (!jobDraft.title.trim() || !jobDraft.family.trim() || !jobDraft.pet.trim() || !allowedChildren.length) return;
    setNeighborhoodJobs((items) => [
      {
        id: `job-${Date.now()}`,
        title: jobDraft.title.trim(),
        family: jobDraft.family.trim(),
        pet: jobDraft.pet.trim(),
        time: jobDraft.time.trim() || "Parent scheduled",
        rewardDollars: Math.max(0, Number(jobDraft.rewardDollars) || 0),
        badgeTitle: jobDraft.badgeTitle.trim() || "Trusted Helper",
        assignedChildIds: allowedChildren,
        visibleToKids: false,
        checklist: ["Review the pet need", "Complete the parent-approved task", "Tell parent what you noticed"],
        safety: jobDraft.safety.trim() || "Parent confirms details first.",
        minAge: Math.min(...children.map((child) => child.age)),
        skillFocus: Number(jobDraft.rewardDollars) >= 8 ? "leadership" : "teamwork",
        trustSignals: ["parent_gate", "age_fit", "no_messaging", "adult_nearby", "private_child"],
        status: "posted",
      },
      ...items,
    ]);
    setJobDraft({ title: "Pet sitting helper", family: "Neighbor family", pet: "Pet name", time: "Saturday, 10:00 AM", rewardDollars: "5", badgeTitle: "Trusted Helper", safety: "Parent confirms address and stays reachable." });
  }

  function acceptNeighborhoodJob(jobId: string) {
    if (!activeChild) return;
    setNeighborhoodJobs((items) =>
      items.map((job) =>
        job.id === jobId && job.visibleToKids && job.assignedChildIds.includes(activeChild.id) && job.status === "posted"
          ? { ...job, acceptedBy: activeChild.id, status: "accepted" }
          : job,
      ),
    );
  }

  function toggleNeighborhoodJobVisibility(jobId: string) {
    setNeighborhoodJobs((items) =>
      items.map((job) =>
        job.id === jobId
          ? { ...job, visibleToKids: !job.visibleToKids, status: job.status === "posted" ? "posted" : job.status }
          : job,
      ),
    );
  }

  function approveNeighborhoodJob(jobId: string) {
    const job = neighborhoodJobs.find((item) => item.id === jobId);
    if (!job?.acceptedBy) return;
    const missionId = `mission-${job.id}`;
    if (!missions.some((mission) => mission.id === missionId)) {
      setMissions((items) => [
        {
          id: missionId,
          title: job.title,
          category: "community",
          difficulty: job.rewardDollars >= 8 ? "hard" : "medium",
          points: job.rewardDollars >= 8 ? 26 : 18,
          coins: job.rewardDollars > 0 ? 3 : 1,
          allowanceDollars: job.rewardDollars,
          assignedChildId: job.acceptedBy,
          question: `${job.checklist.join(" / ")}. What did you notice about ${job.pet}? Skill focus: ${getLifeSkillLabel(job.skillFocus ?? "teamwork")}.`,
          status: "pending",
        },
        ...items,
      ]);
    }
    setNeighborhoodJobs((items) => items.map((item) => (item.id === jobId ? { ...item, status: "approved", missionId } : item)));
  }

  return (
    <main className="tailtots-app min-h-screen bg-[#f7f6f0] text-[#17231f]">
      <header className="sticky top-0 z-20 border-b border-[#ded8c7] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3">
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
            <img src="/tailtots-logo.png" alt="TailTots logo" className="h-12 w-auto shrink-0 rounded-lg object-contain sm:h-14" />
            <div className="min-w-0">
              <h1 className="text-lg font-black leading-tight sm:text-xl">TailTots</h1>
              <p className="hidden text-xs font-bold text-[#69736f] sm:block">Parent-guided real-world growth.</p>
              {!isRouteChooser && (
                <p className="mt-1 inline-flex max-w-full items-center rounded-full bg-[#fff4d8] px-2 py-1 text-[11px] font-black leading-4 text-[#7a4b12] sm:hidden">
                  <span className="truncate">{operatorLabel}</span>
                </p>
              )}
            </div>
          </div>
          {!isRouteChooser && (
          <div className="flex w-full flex-wrap justify-start gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <div className="hidden min-h-11 items-center rounded-full border border-[#d9d0bb] bg-white px-4 text-xs font-black text-[#25352f] md:flex">
              {operatorLabel}
            </div>
            <div className="flex rounded-full border border-[#d9d0bb] bg-[#f8f6ed] p-1 text-xs font-black">
              {(["parent", "child"] as Role[]).map((item) => (
                <button
                  key={item}
                  aria-label={`Switch to ${item} mode`}
                  onClick={() => switchRole(item)}
                  className={`min-h-10 rounded-full px-3 py-2 capitalize sm:min-h-11 sm:px-5 ${role === item ? "bg-[#165a4b] text-white" : "text-[#53615b]"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
      </header>

      {!isRouteChooser && (
        <div className="border-b border-[#ded8c7] bg-[#fffdf7]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:px-5">
            <button onClick={openRouteChooser} className="min-h-10 rounded-lg border border-[#d9d0bb] bg-white px-3 py-2 text-xs font-black text-[#25352f]">
              Start page
            </button>
            <button onClick={openContactSection} className="min-h-10 rounded-lg bg-[#165a4b] px-3 py-2 text-xs font-black text-white">
              Contact us
            </button>
          </div>
        </div>
      )}

      <section className={`mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-5 md:gap-5 ${
        isRouteChooser ? "grid-cols-1" : "lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]"
      }`}>
        <aside className={`min-w-0 space-y-3 lg:space-y-4 ${isRouteChooser ? "hidden" : ""}`}>
          <div className="overflow-hidden rounded-lg border border-[#ded8c7] bg-white shadow-sm">
            <div className="relative min-h-[220px] max-w-full overflow-hidden bg-[linear-gradient(135deg,#165a4b,#f47b20_58%,#2563eb)] sm:min-h-[280px] lg:min-h-[430px]">
              {familyPhotoUrl && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${familyPhotoUrl})` }} />}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(23,35,31,0.72),rgba(23,35,31,0.08)_55%,rgba(23,35,31,0.18))]" />
              {!familyPhotoUrl && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="absolute left-8 top-16 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#7c3aed] shadow-sm animate-[reward-pop_2.8s_ease-in-out_infinite]">+coins</div>
                  <div className="absolute right-8 top-24 rounded-full bg-[#ffd166] px-3 py-1 text-xs font-black text-[#17231f] shadow-sm animate-[reward-pop_3.2s_ease-in-out_infinite]">badge</div>
                  <div className="absolute bottom-28 left-10 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#165a4b] shadow-sm animate-[reward-pop_3.5s_ease-in-out_infinite]">done</div>
                  <FamilyFaceParade parents={parents} childProfiles={children} pets={pets} animated />
                </div>
              )}
              <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-[#165a4b] shadow-sm">
                {appMode === "real" ? "Your family" : "Demo family"}
              </div>
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ffd166]">Household</p>
                <h2 className="text-2xl font-black leading-tight sm:text-3xl">{familyName}</h2>
                {role === "parent" && isParentUnlocked && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-white px-4 py-2 text-xs font-black text-[#17231f] shadow-sm">
                    Family photo
                  <input className="sr-only" type="file" accept="image/*" onChange={(event) => updateFamilyPhoto(event.target.files?.[0])} />
                  </label>
                  <button onClick={() => setActiveTab("pets")} className="min-h-11 rounded-lg bg-[#17231f]/90 px-4 py-2 text-xs font-black text-white shadow-sm">
                    Pets
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>

          {role === "child" && (
            <ChildProfileSwitcher
              activeChild={activeChild}
              childProfiles={children}
              requestChildSwitch={requestChildSwitch}
            />
          )}

          {(role === "child" || isParentUnlocked) && (
          <nav className="grid grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:overflow-visible lg:pb-0">
            {visibleTabs.filter((tab) => tab.id !== "vision").map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-11 min-w-max rounded-lg px-4 py-3 text-left text-sm font-black lg:min-h-12 ${
                  visibleActiveTab === tab.id ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-white text-[#28342f]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          )}
        </aside>

        <div className="space-y-5">
          {role === "parent" && visibleActiveTab === "vision" && (
            <VisionLandingPanel
              openParentDemo={openParentDemo}
              openKidDemo={openKidDemo}
            />
          )}
          {(role === "child" || isParentUnlocked) && visibleActiveTab === "hub" && (
            <HomeHubPanel
              activeChild={activeChild}
              childProfiles={children}
              pets={pets}
              missions={role === "parent" ? missions : activeChildMissions}
              goals={goals}
              moments={moments}
              badges={badges}
              fairnessSummary={fairnessSummary}
              familySkillSummary={familySkillSummary}
              role={role}
              isParentUnlocked={isParentUnlocked}
              pendingCount={pendingApprovals.length}
              setActiveTab={setActiveTab}
              scheduleItems={scheduleItems}
            />
          )}
          {(role === "child" || isParentUnlocked) && visibleActiveTab !== "hub" && (
          <>
          {visibleActiveTab === "missions" && (
            <>
              <Hero
                child={activeChild}
                childProfiles={children}
                setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
                pendingCount={pendingApprovals.length}
                taskProgress={taskProgress}
                approvedMissionCount={activeApprovedMissionCount}
                pets={pets}
                setActiveTab={setActiveTab}
              />
              <MissionsPanel
                activeChild={activeChild}
                missions={activeChildMissions}
                pets={pets}
                allChildren={children}
                missionNote={missionNote}
                setMissionNote={setMissionNote}
                completeMission={completeMission}
              />
            </>
          )}
          {visibleActiveTab === "schedule" && (
            <SchedulePanel
              activeChild={activeChild}
              childProfiles={children}
              missions={role === "parent" ? missions : activeChildMissions}
              scheduleItems={scheduleItems}
              role={role}
              setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
            />
          )}
          {visibleActiveTab === "pets" && <PassportPanel pets={pets} updatePetPhoto={role === "parent" ? updatePetPhoto : undefined} />}
          {visibleActiveTab === "pet-helper" && <KidPetHelperPanel activeChild={activeChild} pets={pets} moments={moments} />}
          {visibleActiveTab === "bank" && (
            <BankPanel
              child={activeChild}
              childProfiles={children}
              setActiveChildId={role === "child" ? requestChildSwitch : setActiveChildId}
              transactions={transactions}
              goals={goals}
              requestBankMove={requestBankMove}
              newGoal={newGoal}
              setNewGoal={setNewGoal}
              addSavingsGoal={addSavingsGoal}
              setActiveTab={setActiveTab}
            />
          )}
          {visibleActiveTab === "approvals" && (
            <div className="space-y-4">
              <EnterpriseReadinessPanel />
              <MissionAssignmentPanel
                missions={missions}
                childProfiles={children}
                badges={badges}
                assignMission={assignMission}
                autoBalanceMissions={autoBalanceMissions}
              />
              <ApprovalsPanel
                missions={missions}
                transactions={transactions}
                childProfiles={children}
                approveMission={approveMission}
                approveTransaction={approveTransaction}
                rejectMission={rejectMission}
                rejectTransaction={rejectTransaction}
              />
            </div>
          )}
          {visibleActiveTab === "setup" && (
            <FamilySetupPanel
              cloudAccountEmail={cloudAccountEmail}
              accountDraft={accountDraft}
              setAccountDraft={setAccountDraft}
              accountStatus={accountStatus}
              accountMessage={accountMessage}
              sendParentSignInLink={sendParentSignInLink}
              magicLinkSent={magicLinkSent}
              signOutParentAccount={signOutParentAccountFromApp}
              saveCurrentFamilyAccount={saveCurrentFamilyAccount}
              loadCurrentFamilyAccount={loadCurrentFamilyAccount}
              familyName={familyName}
              setFamilyName={setFamilyName}
              parents={parents}
              updateParent={updateParent}
              updateParentPhoto={updateParentPhoto}
              childProfiles={children}
              updateChild={updateChild}
              updateChildPhoto={updateChildPhoto}
              pets={pets}
              updatePet={updatePet}
              updatePetPhoto={updatePetPhoto}
              newChild={newChild}
              setNewChild={setNewChild}
              addChild={addChild}
              newPet={newPet}
              setNewPet={setNewPet}
              addPet={addPet}
              updateFamilyPhoto={updateFamilyPhoto}
              updateFamilyPhotoAndPickProfiles={updateFamilyPhotoAndPickProfiles}
              pickProfilesFromSavedFamilyPhoto={pickProfilesFromSavedFamilyPhoto}
              hasFamilyPhoto={Boolean(familyPhotoUrl)}
              parentPasscode={parentPasscode}
              setParentPasscode={setParentPasscode}
            />
          )}
          {visibleActiveTab === "growth" && (
            <GrowthPanel
              childProfiles={children}
              badges={badges}
              moments={moments}
              momentDraft={momentDraft}
              setMomentDraft={setMomentDraft}
              addMoment={addMoment}
            />
          )}
          {visibleActiveTab === "neighborhood" && (
            <NeighborhoodPanel
              goals={goals}
              childProfiles={children}
              activeChild={activeChild}
              role={role}
              jobs={neighborhoodJobs}
              jobDraft={jobDraft}
              setJobDraft={setJobDraft}
              postJob={postNeighborhoodJob}
              acceptJob={acceptNeighborhoodJob}
              approveJob={approveNeighborhoodJob}
              toggleJobVisibility={toggleNeighborhoodJobVisibility}
            />
          )}
          {visibleActiveTab === "ai" && <AIPanel childProfiles={children} missions={missions} parentSignedIn={Boolean(cloudAccountEmail)} />}
          {visibleActiveTab === "ecosystem" && <EcosystemRoadmapPanel />}
          </>
          )}
        </div>
      </section>
      {photoCropDraft && (
        <PhotoCropModal
          draft={photoCropDraft}
          setDraft={setPhotoCropDraft}
          saveCrop={savePhotoCrop}
          close={() => {
            setPendingPhotoCropQueue([]);
            setPhotoCropDraft(undefined);
          }}
        />
      )}
    </main>
  );
}

function CountUp({ to, prefix, durationMs }: { to: number; prefix?: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [value, setValue] = useState(() => (reducedMotion ? to : 0));
  const [started, setStarted] = useState(() => reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, to]);
  useEffect(() => {
    if (!started || reducedMotion) return;
    const total = durationMs ?? 1300;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / total);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, reducedMotion, to, durationMs]);
  return (
    <span ref={ref}>
      {prefix ?? ""}
      {value.toLocaleString()}
    </span>
  );
}

function ShelterGivingShowcase() {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">🐶 Shelter giving, fundraising-style</p>
          <h4 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">Real dogs. Real goals. Real bragging rights.</h4>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/70 ring-1 ring-white/15">
          Illustrative example
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/70">
        You set the goal and fund it — your kid picks the cause and works for it. Here’s what a family giving goal looks like when it’s running:
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { emoji: "🦴", to: 1200, label: "treats funded", note: "one good deed at a time" },
          { emoji: "🚶", to: 340, label: "shelter walks logged", note: "real legs, real dogs" },
          { emoji: "🧸", to: 85, label: "toy drives completed", note: "squeaky ones preferred" },
        ].map((stat) => (
          <div key={stat.label} className="tt-card-lift rounded-2xl bg-white/10 p-4 text-center ring-1 ring-white/15">
            <p className="text-2xl" aria-hidden="true">{stat.emoji}</p>
            <p className="mt-1 text-3xl font-black text-tt-sun">
              <CountUp to={stat.to} />
            </p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.1em] text-white/80">{stat.label}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/55">{stat.note} · example figures</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/70">Example goal thermometer</p>
          <p className="mt-1 text-sm font-black text-white">Chew-toy fund for Sunny Paws Shelter</p>
          <div className="mt-4 flex items-end justify-center gap-4">
            <div className="relative h-44 w-10 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20" role="img" aria-label="Example goal thermometer showing 65 percent raised">
              <div className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-tt-tang to-tt-sun" style={{ height: "65%" }} />
              <div className="absolute inset-x-0 bottom-0 flex items-start justify-center pt-2 text-[11px] font-black text-tt-ink">65%</div>
            </div>
            <div className="pb-1 text-sm font-bold leading-6 text-white/75">
              <p><span className="text-lg font-black text-tt-sun">$65</span> raised</p>
              <p>of an example <span className="font-black text-white">$100</span> goal</p>
              <p className="mt-2 text-xs font-semibold text-white/60">Every mission nudges the mercury. Kids can literally watch kindness rise. 🌡️</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {[
            { title: "Example: Senior-dog blanket drive", meta: "Kid picked · Parent funded", pct: 80, line: "12 of 15 blankets — the shelter naps are about to get luxurious." },
            { title: "Example: New-leash-on-life fund", meta: "Kid picked · Parent funded", pct: 45, line: "Almost halfway to 20 leashes. The dogs are already practicing their strut." },
          ].map((card) => (
            <article key={card.title} className="tt-card-lift rounded-2xl bg-white p-4 text-tt-ink shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black">{card.title}</p>
                <span className="rounded-full bg-tt-pine-tint px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-tt-pine">{card.meta}</span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-tt-sand">
                <div className="h-3 rounded-full bg-gradient-to-r from-tt-pine to-tt-tang" style={{ width: `${card.pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-bold">
                <span className="text-tt-ink-soft">{card.line}</span>
                <span className="ml-2 shrink-0 font-black text-tt-pine">{card.pct}%</span>
              </div>
            </article>
          ))}
          <p className="text-[11px] font-semibold text-white/55">Campaign-style cards, parent-funded, kid-earned. Figures shown are examples, not real totals.</p>
        </div>
      </div>
    </div>
  );
}

function VisionLandingPanel({
  openParentDemo,
  openKidDemo,
}: {
  openParentDemo: () => void;
  openKidDemo: () => void;
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [launchInterest, setLaunchInterest] = useState({ email: "" });
  const [launchInterestStatus, setLaunchInterestStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [launchInterestMessage, setLaunchInterestMessage] = useState("");
  // Once a visitor joins, every launch form collapses into a "you're in" note (persisted per device).
  const [launchJoined, setLaunchJoined] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("tt-launch-joined") === "1";
    } catch {
      return false; // private mode: stay unjoined
    }
  });
  const [feedbackDraft, setFeedbackDraft] = useState({ email: "", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [certCelebrating, setCertCelebrating] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  const journeySteps = [
    ["🔍", "Learn the animal", "Pet Passports decode what the pet really needs — food, space, costs, lifespan. Fantasy out, respect in."],
    ["🎯", "Own the routine", "Daily age-fit missions. Have a pet? Your kid takes over the real routine — feeding, water, comfort checks, for real this time. Don’t? Parent-set home and community chores: the nagging you already do becomes the training ground."],
    ["📈", "Prove it over time", "Streaks plus your approvals build the proof record. Not one good day — sixty. This answers “will they stick with it?”"],
    ["🎓", "Earn the certificate", "The proof record, framed. No pet yet? It’s the case for one. Have one? It’s the title: Certified Pet Hero."],
    ["🌟", "Grow beyond the routine", "The habit loop now runs skills, money smarts, and giving missions — donate, pool money, fund real causes. Same missions, both tracks."],
  ];
  const platformPillars = [
    ["🌐", "Safe social practice", "Training wheels for real-world social life. Kids practice teamwork, leadership, and empathy — with zero strangers, zero feeds, zero DMs."],
    ["🦸", "Character, on purpose", "Responsibility, kindness, honesty: a real character curriculum taught through missions, not lectures."],
    ["🛠️", "Skills that compound", "Time, money, helping at home — the unglamorous skills that quietly run adulthood."],
    ["🐶", "Real shelter dogs", "Kindness that leaves the screen. Kids work toward real giving for real dogs waiting in real shelters."],
    ["🧹", "Chores & neighborhood", "Helper missions at home and around the block. The real world is the playground."],
    ["🎯", "Parent-set donation goals", "You set the goal and fund it — your kid picks the cause and works for it. Giving, earned."],
  ];
  const trustChips = [
    "Private by design",
    "Parents approve everything",
    "Guided AI — never open chat",
    "No rankings, no ads, no strangers",
  ];
  const kidsPetPhotos = [
    ["Kid + dog", "https://images.unsplash.com/photo-1528301725143-1ba694832e77?auto=format&fit=crop&w=720&q=80"],
    ["Kid + rabbit", "https://assets.moargut.com/moargut/2025/12/BAP_3958_RA_2021-1366x2048.jpg"],
    ["Kid + cat", "https://images.unsplash.com/photo-1740679953723-64630527299d?auto=format&fit=crop&w=720&q=80"],
    ["Kid + guinea pig", "https://c.nau.ch/i/LxxZQq/900/kontakt-tiere.jpg"],
  ];
  const kindnessPrompts = [
    "Leave a painted rock where a neighbor will find it. 🪨",
    "Teach your pet one tiny new trick. Treats help. 🦜",
    "Draw a thank-you card for your mail carrier. ✉️",
    "Donate one toy you’ve outgrown. Someone’s treasure awaits. 🧸",
    "Water a thirsty plant like it’s a VIP guest. 🌱",
    "Ask a grandparent about their first pet. Take notes. 📞",
    "Pick up 5 pieces of litter on your street. Captain Planet mode. 🌍",
    "Build your pet a blanket-fort lounge. Interior design counts. 🏕️",
    "Write down the funniest thing your pet did today. 📝",
    "Share a snack with a sibling. Yes, even the good one. 🍪",
  ];
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const todayPrompt = kindnessPrompts[dayOfYear % kindnessPrompts.length];

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  async function joinLaunchList() {
    setLaunchInterestStatus("saving");
    setLaunchInterestMessage("");
    try {
      const result = await submitLaunchInterest({
        email: launchInterest.email,
        source: "vision-landing",
      });
      setLaunchInterestStatus("saved");
      setLaunchInterestMessage(result.mode === "cloud" ? "You’re on the list! Check your inbox for tail wags soon. 🐾" : "Thanks — you’re on the TailTots update list.");
      setLaunchInterest({ email: "" });
      setLaunchJoined(true);
      try { window.localStorage.setItem("tt-launch-joined", "1"); } catch { /* private mode */ }
    } catch (error) {
      setLaunchInterestStatus("error");
      setLaunchInterestMessage(error instanceof Error ? error.message : "Could not save this signup yet.");
    }
  }

  async function sendWebsiteFeedback() {
    setFeedbackStatus("saving");
    setFeedbackMessage("");
    try {
      const result = await submitFeedback({
        email: feedbackDraft.email,
        message: feedbackDraft.message,
        source: "vision-contact",
      });
      setFeedbackStatus("saved");
      setFeedbackMessage(result.mode === "cloud" ? "Thanks — your note reached TailTots." : "Thanks — your note was saved on this device.");
      setFeedbackDraft({ email: "", message: "" });
    } catch (error) {
      setFeedbackStatus("error");
      setFeedbackMessage(error instanceof Error ? error.message : "Could not send this note yet.");
    }
  }

  async function shareText(text: string, okMessage: string) {
    setShareMessage("");
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "TailTots", text });
        setShareMessage("Shared! You’re officially a TailTots ambassador. 🎉");
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareMessage(okMessage);
      } else {
        setShareMessage("Copy this page’s link and send it to your favorite parent. 💌");
      }
    } catch {
      setShareMessage("");
    }
  }

  const scrollToLandingSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    const fixedHeaderOffset = 150;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - fixedHeaderOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  };

  return (
    <section className="space-y-5">
      {showBackToTop && (
        <button
          onClick={() => scrollToLandingSection("landing-home")}
          className="tt-btn-press fixed bottom-5 right-5 z-40 min-h-11 rounded-full bg-tt-pine px-4 py-2 text-sm font-black text-white shadow-lg ring-1 ring-white/50"
          aria-label="Back to top"
        >
          Top
        </button>
      )}

      {/* ============ HERO: the pet-led hook ============ */}
      <div id="landing-home" className="relative -mx-3 scroll-mt-36 overflow-hidden border-y border-tt-line bg-tt-cream text-tt-ink shadow-sm sm:mx-0 sm:rounded-3xl sm:border">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_18%_8%,rgba(255,209,102,0.4),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_92%_88%,rgba(22,90,75,0.14),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-10 -top-10 select-none text-[10rem] opacity-15 tt-animate-float" aria-hidden="true">🐶</div>
        <div className="pointer-events-none absolute -left-6 bottom-16 select-none text-[7rem] opacity-15 tt-animate-float-slow" aria-hidden="true">🐰</div>
        <svg className="pointer-events-none absolute bottom-16 left-[6%] hidden w-64 text-tt-pine opacity-[0.13] md:block lg:w-80" viewBox="0 0 320 80" aria-hidden="true">
          <defs>
            <g id="tt-paw">
              <ellipse cx="0" cy="8" rx="9" ry="7" />
              <circle cx="-12" cy="-4" r="3.6" /><circle cx="-4" cy="-9" r="3.6" /><circle cx="5" cy="-9" r="3.6" /><circle cx="13" cy="-4" r="3.6" />
            </g>
          </defs>
          <g fill="currentColor">
            <use href="#tt-paw" transform="translate(24,54) rotate(-18)" />
            <use href="#tt-paw" transform="translate(104,62) rotate(12)" />
            <use href="#tt-paw" transform="translate(184,48) rotate(-10)" />
            <use href="#tt-paw" transform="translate(264,58) rotate(16)" />
          </g>
        </svg>
        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center xl:p-10">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-tt-pine/30 bg-tt-pine-tint px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-tt-pine">
              <span className="tt-animate-sparkle" aria-hidden="true">✨</span> Free for families · Launching soon
            </p>
            <h2 className="mt-4 max-w-2xl text-[2.6rem] font-black leading-[1.02] tracking-tight text-tt-navy sm:text-6xl">
              “Can we get a <span className="relative inline-block px-1"><span className="absolute inset-0 -rotate-1 rounded bg-tt-sun/70" aria-hidden="true" /><span className="relative">puppy?!</span></span>”
            </h2>
            <p className="mt-4 max-w-xl text-lg font-bold leading-7 text-tt-navy-soft">
              You’ve heard it 47 times this week. TailTots turns that question into real-world responsibility, money smarts, and kindness — with you holding the leash.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              Puppy, kitten, guinea pig, bearded dragon — whatever’s doing those eyes at the pet-store window. <strong className="font-black text-tt-navy">Already have the pet?</strong> Your kid goes from pet owner to pet hero.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              Parent-approved missions. Kid Bank. Zero stranger danger. All the “aww,” none of the chaos.
            </p>
            <p className="mt-2 max-w-xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
              Pet care is where it starts. Character, skills, chores, safe social practice, and real shelter giving — that’s where it goes.
            </p>

            {/* PRIMARY: launch capture. SECONDARY: kid demo. Never equal weight. */}
            {launchJoined ? (
              <p className="mt-6 max-w-xl rounded-2xl border-2 border-tt-pine bg-tt-pine-tint p-4 text-sm font-black text-tt-pine">
                🎉 You’re on the launch list! Watch your inbox for tail wags.
              </p>
            ) : (
            <form
              className="mt-6 max-w-xl rounded-2xl border-2 border-tt-pine bg-white p-3 shadow-[0_10px_30px_-12px_rgba(22,90,75,0.35)] sm:p-4"
              onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
            >
              <label htmlFor="hero-launch-email" className="text-xs font-black uppercase tracking-[0.14em] text-tt-pine">
                👨‍👩‍👧 Get your family on the launch list
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  id="hero-launch-email"
                  value={launchInterest.email}
                  onChange={(event) => setLaunchInterest({ email: event.target.value })}
                  className="min-h-12 rounded-xl border border-tt-line bg-tt-cream px-4 text-sm font-bold text-tt-ink placeholder:text-tt-ink-faint"
                  inputMode="email"
                  placeholder="Parent email (no spam, only tail wags)"
                  type="email"
                  required
                />
                <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press min-h-12 rounded-xl bg-tt-tang px-6 py-3 text-sm font-black text-white shadow-md disabled:opacity-60">
                  {launchInterestStatus === "saving" ? "Saving…" : "Join free 🚀"}
                </button>
              </div>
              {launchInterestMessage && (
                <p className={`mt-2 text-sm font-bold ${launchInterestStatus === "error" ? "text-[#b44421]" : "text-tt-pine"}`} role="status">
                  {launchInterestMessage}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-tt-ink-faint">Free for families. Unsubscribe anytime. Your inbox stays boring; your kids won’t.</p>
            </form>
            )}

            <button onClick={openKidDemo} className="tt-btn-press group mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-2 py-2 text-sm font-black text-tt-pine underline decoration-tt-sun decoration-[3px] underline-offset-4">
              <span aria-hidden="true">👀</span> Skeptical? Let your kid try a mission first
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </button>
          </div>

          {/* Real product visual: the actual Mission Mode UI, alive */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="tt-animate-float-slow absolute -left-4 -top-6 z-10 rotate-[-8deg] rounded-2xl border border-tt-line bg-white px-4 py-3 shadow-lg" aria-hidden="true">
              <p className="text-2xl">🐹</p>
              <p className="text-[11px] font-black text-tt-ink">Jack says hi</p>
            </div>
            <div className="tt-animate-float absolute -right-3 top-1/3 z-10 rotate-[7deg] rounded-2xl border border-tt-line bg-white px-4 py-3 shadow-lg" aria-hidden="true">
              <p className="text-2xl">🏅</p>
              <p className="text-[11px] font-black text-tt-ink">+8 points!</p>
            </div>
            <article className="tt-card-lift tt-animate-pop-in relative rounded-3xl border border-tt-line bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-tang">Mission Mode</p>
                <span className="rounded-full bg-tt-pine-tint px-3 py-1 text-[11px] font-black text-tt-pine">Parent approved ✓</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <ProfilePhoto label="TailTots pet Jack" initial="J" colors={petLooks.jack.colors} size="md" variant="pet" petKind="guinea" />
                <p className="text-base font-black leading-6 text-tt-ink">Hi Maya. Jack needs fresh water and a comfort check.</p>
              </div>
              <ol className="mt-4 grid gap-2">
                {["Fill the bottle", "Check the bowl", "Notice how Jack responds"].map((step, index) => (
                  <li key={step} className="flex items-center gap-3 rounded-xl bg-tt-cream px-3 py-2.5 text-sm font-bold text-tt-ink-soft">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tt-pine text-xs font-black text-white">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <button onClick={openKidDemo} className="tt-btn-press mt-4 min-h-12 w-full rounded-xl bg-tt-pine px-5 py-3 text-sm font-black text-white">
                Start this mission →
              </button>
              <p className="mt-2 text-center text-xs font-semibold text-tt-ink-faint">This is the real kid screen — not a mockup. Go on, tap it.</p>
            </article>
          </div>
        </div>

        {/* marquee of playful proof */}
        <div className="relative overflow-hidden border-t border-tt-line bg-white/70 py-3" aria-hidden="true">
          <div className="tt-marquee-track gap-8 text-sm font-black text-tt-navy-soft">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center gap-8">
                {["🐾 Real pets, real chores", "💰 Kid Bank: earn · save · give", "🎯 Parent-set giving goals", "🐶 Real shelter dogs helped", "🛡️ Parents approve everything", "🚫 Zero stranger chat", "🏅 Badges worth bragging about", "🤖 Guided AI, kid-safe"].map((item) => (
                  <span key={`${copy}-${item}`} className="whitespace-nowrap">{item}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ FOMO STRIP: founding-family window, directly under the hero ============ */}
      <section aria-label="Founding families" className="relative -mx-3 overflow-hidden border-y border-tt-pine/30 bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-tt-sun/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-56 rounded-full bg-tt-tang/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-tt-sun ring-1 ring-white/15">
              <span className="tt-animate-sparkle" aria-hidden="true">🔥</span> Founding 500 · strictly optional, extremely tempting
            </p>
            <h3 className="mt-3 max-w-xl text-2xl font-black tracking-tight sm:text-3xl">
              We’re opening TailTots to our first 500 founding families.
            </h3>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/70">
              Founders get early access, a founding-family badge their kids will absolutely brag about, and first dibs on shelter-giving goals.
              The window closes at launch — no fake countdown, just a real door that shuts when we ship.
            </p>
          </div>
          {launchJoined ? (
            <p className="w-full max-w-md shrink-0 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm font-black text-tt-sun backdrop-blur">
              🎉 You’re in! Your founding-family spot is claimed.
            </p>
          ) : (
          <form
            className="w-full max-w-md shrink-0 rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4"
            onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
          >
            <label htmlFor="fomo-launch-email" className="text-xs font-black uppercase tracking-[0.14em] text-tt-sun">
              🐾 Claim a founding-family spot
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                id="fomo-launch-email"
                value={launchInterest.email}
                onChange={(event) => setLaunchInterest({ email: event.target.value })}
                className="min-h-12 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white placeholder:text-white/50"
                inputMode="email"
                placeholder="Parent email"
                type="email"
                required
              />
              <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press tt-animate-wiggle-hover min-h-12 rounded-xl bg-tt-tang px-6 py-3 text-sm font-black text-white shadow-md disabled:opacity-60">
                {launchInterestStatus === "saving" ? "Saving…" : "Save my spot"}
              </button>
            </div>
            {launchInterestMessage && (
              <p className={`mt-2 text-sm font-bold ${launchInterestStatus === "error" ? "text-tt-sun" : "text-white"}`} role="status">
                {launchInterestMessage}
              </p>
            )}
            <p className="mt-2 text-[11px] font-semibold text-white/55">Free for families. One email. Zero spam, only tail wags.</p>
          </form>
          )}
        </div>
      </section>

      {/* ============ PET PROMISE: photos + the required language ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-tang">Exhibit A: your camera roll 📸</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">Built around the bond kids already have with animals.</h3>
          <p className="text-sm font-bold text-tt-ink-faint">Dogs · Cats · Rabbits · Guinea pigs · Big dreams</p>
        </div>
        <p className="mt-2 max-w-3xl text-[15px] font-semibold leading-6 text-tt-ink-soft">
          That bond is the doorway. On the other side: kids doing <span className="font-black text-tt-ink">real good in the real world</span> —
          caring for shelter dogs, helping neighbors, and earning the giving they choose. Cuteness in, character out.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kidsPetPhotos.map(([label, src]) => (
            <div key={label} className="tt-card-lift group overflow-hidden rounded-2xl bg-tt-sand shadow-sm">
              <img src={src} alt={`${label} learning responsibility with TailTots`} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.04]" loading="lazy" />
            </div>
          ))}
        </div>
        <aside className="mt-4 rounded-2xl border-2 border-dashed border-tt-tang/50 bg-tt-tang-soft/40 p-4">
          <p className="text-sm font-black text-tt-navy">Our pet promise — the fine print we’re proud of:</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-tt-ink-soft">
            A pet is never a prize. Adoption is not guaranteed. Parents make the final decision. TailTots readiness does not replace shelter screening.
          </p>
        </aside>
      </section>

      {/* ============ FAST TRACK: for families who already have a pet ============ */}
      <section className="-mx-3 border-y-2 border-tt-pine/40 bg-tt-pine p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">Already have a pet? 🐾</p>
            <h3 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">You’re on the fast track.</h3>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/80">
              No wish list needed. Your kid takes over the real routine — feeding schedules they actually follow, training missions, vet-visit prep —
              and levels up to shelter-hero giving. From “we have a dog” to “my kid <em>runs</em> the dog.”
            </p>
          </div>
          <a href="#landing-demo" className="tt-btn-press min-h-12 shrink-0 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink">
            See it in action →
          </a>
        </div>
      </section>

      {/* ============ DEMO: the aha moment ============ */}
      <section id="landing-demo" className="-mx-3 scroll-mt-36 border-y border-tt-line bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">The aha moment · 60 seconds</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Watch a mission happen.</h3>
            <p className="mt-3 max-w-lg text-[15px] font-semibold leading-6 text-white/75">
              One parent-approved mission. Big steps, clear timing, coins on the line. This is what your kid sees — no feed, no ads, no “just one more video.”
              Have a pet? Missions run on your real one. Don’t? They build toward it.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={openKidDemo} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink shadow-lg">
                🧒 Try the kid demo
              </button>
              <button onClick={openParentDemo} className="tt-btn-press min-h-12 rounded-xl border-2 border-white/30 bg-white/10 px-6 py-3 text-sm font-black text-white">
                🧑‍💼 See the parent side
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-white/60">Sample family included. Nothing leaves your device in the demo.</p>
            <p className="mt-3 max-w-lg rounded-2xl bg-white/10 p-3 text-sm font-bold leading-6 text-white/85 ring-1 ring-white/15">
              <span aria-hidden="true">🐹</span> Jack’s review: “I got fresh water <em>and</em> a comfort check. 10/10, would be cared for again.”
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["🎯", "Missions", "Age-fit steps"],
              ["💰", "Kid Bank", "Save · Spend · Give"],
              ["🏅", "Badges", "Earned, not given"],
              ["✅", "Approvals", "Parents rule"],
              ["🐾", "Pet passports", "Care, decoded"],
              ["🤖", "Guided AI", "Kid-safe help"],
            ].map(([emoji, title, sub]) => (
              <div key={title} className="tt-card-lift rounded-2xl bg-white/10 p-3 text-center ring-1 ring-white/15 sm:p-4">
                <p className="text-2xl sm:text-3xl" aria-hidden="true">{emoji}</p>
                <p className="mt-1 text-xs font-black sm:text-sm">{title}</p>
                <p className="text-[10px] font-semibold text-white/60 sm:text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ THE JOURNEY: how kids become pet-ready, then everything-ready ============ */}
      <section className="-mx-3 border-y border-tt-line bg-white p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">How it actually works 🗺️</p>
        <h3 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">From “can we get a puppy?!” to “already done, Mom.”</h3>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tt-ink-soft">
          Every kid masters the same habit loop — mission, action, your approval, streak. The doorway differs: real pet care, or parent-set home and community chores. The house is the same.
        </p>
        <aside className="mt-4 max-w-3xl rounded-2xl border-2 border-tt-pine/30 bg-tt-pine-tint p-4">
          <p className="text-sm font-bold leading-6 text-tt-ink-soft">
            <span aria-hidden="true">🐾 </span><span className="font-black text-tt-navy">Already have a pet?</span> Start at step 2 — and it’s not practice. It’s the real routine, transferred from you to your kid, with streaks proving it stuck.
          </p>
        </aside>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
          {journeySteps.map(([emoji, title, body], index) => (
            <li key={title} className="tt-card-lift relative overflow-hidden rounded-2xl bg-tt-cream p-5">
              <span className="pointer-events-none absolute -right-2 -top-4 select-none text-[5rem] font-black text-tt-pine/10" aria-hidden="true">{index + 1}</span>
              <span className="relative z-10 grid size-10 place-items-center rounded-full bg-tt-pine text-base" aria-hidden="true">{emoji}</span>
              <p className="mt-3 text-base font-black text-tt-ink">{index + 1}. {title}</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-tt-ink-soft">{body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-tt-ink-soft">
          Your job? Approve missions — about 30 seconds a day. TailTots does the nagging. <span className="font-black text-tt-ink">No PhD in parenting required.</span>
        </p>
      </section>

      {/* ============ PLATFORM: pet care is the hook, this is the one-stop ============ */}
      <section id="landing-platform" className="relative -mx-3 scroll-mt-36 overflow-hidden border-y border-tt-line bg-tt-night p-5 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,209,102,0.10),transparent_70%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-tt-pine/40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-tt-grape/30 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">One app · The whole childhood</p>
          <h3 className="mt-2 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">Pet care is the hook. This is the platform.</h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/75">
            TailTots is the one stop for raising capable, kind kids — safe social practice, character, skills, chores, neighborhood adventures,
            and giving that actually reaches shelter dogs. Crisp on the surface, deep underneath.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {platformPillars.map(([emoji, title, body]) => (
              <article key={title} className="tt-card-lift rounded-2xl bg-white/10 p-5 ring-1 ring-white/15">
                <p className="text-2xl" aria-hidden="true">{emoji}</p>
                <p className="mt-2 text-lg font-black">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-white/70">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-sun">Every mission grows something real</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["🐾 Responsibility", "❤️ Kindness & Empathy", "💰 Money Skills", "🤝 Teamwork & Leadership", "🌎 Community", "🎁 Bragging rights"].map((chip) => (
                <span key={chip} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/15">{chip}</span>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-white/60">Start with pet care. End up with a kid who budgets. Funny how that works.</p>
          </div>
          <ShelterGivingShowcase />
        </div>
      </section>

      {/* ============ WILDFIRE: certificate + send-a-mission ============ */}
      <section className="-mx-3 border-y border-tt-line bg-gradient-to-br from-tt-grape-soft via-white to-tt-sky p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-grape">The wildfire loop 🔥</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">The Pet Readiness Certificate</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
              Finish the pet-care journey, earn the certificate. Someday your kid will wave this in your face at the shelter. You’ll be ready — and weirdly proud.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => { setCertCelebrating(true); window.setTimeout(() => setCertCelebrating(false), 1800); }}
                className="tt-btn-press tt-animate-wiggle-hover min-h-12 rounded-xl bg-tt-grape px-6 py-3 text-sm font-black text-white shadow-lg"
              >
                🎓 Preview the certificate
              </button>
              <button
                onClick={() => shareText("My kid is earning their TailTots Pet Readiness Certificate — real pet-care missions, parent-approved. 🐾 https://tailtots.com", "Certificate brag copied! Go show it off. 🎓")}
                className="tt-btn-press tt-animate-wiggle-hover min-h-12 rounded-xl border-2 border-tt-grape/30 bg-white px-6 py-3 text-sm font-black text-tt-grape"
              >
                Share it →
              </button>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            {certCelebrating && (
              <div className="pointer-events-none absolute inset-0 z-10" aria-hidden="true">
                {["🎉", "⭐", "🐾", "💛", "🎊", "🌟"].map((emoji, i) => (
                  <span key={i} className="tt-confetti-piece absolute text-2xl" style={{ left: `${8 + i * 15}%`, top: "10%", animationDelay: `${i * 0.12}s` }}>{emoji}</span>
                ))}
              </div>
            )}
            <div className={`tt-card-lift rounded-3xl border-4 border-double border-tt-grape/40 bg-white p-6 text-center shadow-xl ${certCelebrating ? "tt-animate-wiggle-hover" : ""}`}>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-tt-grape">TailTots · Official</p>
              <p className="mt-1 text-2xl font-black text-tt-navy">Pet Readiness Certificate</p>
              <p className="mx-auto mt-3 max-w-[16rem] text-sm font-semibold leading-6 text-tt-ink-soft">
                This certifies that <span className="font-black text-tt-ink">Demo Kid</span> of the <span className="font-black text-tt-ink">Demo Crew</span> is growing into a responsible pet human — one mission at a time.
              </p>
              <div className="mt-4 flex items-center justify-center gap-6 text-3xl" aria-hidden="true">
                <span>🐹</span><span>🐶</span><span>🐱</span>
              </div>
              <p className="mt-4 border-t border-dashed border-tt-line pt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-tt-ink-faint">Parent approved · Shelter respected</p>
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-tt-night p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-black">Know a parent who heard “can we get a puppy?!” — or one whose kids should help with the pet they have? 🐶</p>
              <p className="mt-1 text-sm font-semibold text-white/70">Send their kid a TailTots mission. Be the hero of the group chat.</p>
            </div>
            <button
              onClick={() => shareText("Send your kid a real TailTots mission — feed a pet, earn coins, make a parent proud. Try it free: https://tailtots.com", "Mission invite copied! Paste it into the group chat. 💌")}
              className="tt-btn-press tt-animate-wiggle-hover min-h-12 shrink-0 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink"
            >
              📤 Send a mission to a friend’s kid
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
            <div className="min-w-0">
              <p className="text-lg font-black">Your kid’s giving goal helps real shelter dogs 🐶</p>
              <p className="mt-1 text-sm font-semibold text-white/70">The brag pet parents actually post. Copy it, share it, watch the good spread.</p>
            </div>
            <button
              onClick={() => shareText("My kid’s TailTots giving goal helps real shelter dogs — missions, Kid Bank coins, actual good in the world. 🐾 https://tailtots.com", "Giving brag copied! Go spread the good. 💛")}
              className="tt-btn-press tt-animate-wiggle-hover min-h-12 shrink-0 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink"
            >
              💛 Share the giving goal
            </button>
          </div>
          {shareMessage && <p className="mt-3 text-sm font-bold text-tt-sun" role="status">{shareMessage}</p>}
        </div>
      </section>

      {/* ============ RETURN LOOP: why kids come back, why parents keep it ============ */}
      <section className="relative -mx-3 overflow-hidden border-y border-tt-line bg-white p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <svg className="pointer-events-none absolute right-[4%] top-6 hidden w-56 text-tt-pine opacity-[0.12] md:block" viewBox="0 0 320 80" aria-hidden="true">
          <g fill="currentColor">
            <use href="#tt-paw" transform="translate(24,54) rotate(-18)" />
            <use href="#tt-paw" transform="translate(104,62) rotate(12)" />
            <use href="#tt-paw" transform="translate(184,48) rotate(-10)" />
            <use href="#tt-paw" transform="translate(264,58) rotate(16)" />
          </g>
        </svg>
        <div className="relative">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-grape">The habit loop 🔁</p>
          <h3 className="mt-2 max-w-2xl text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">
            Why kids come back tomorrow. And why parents let them.
          </h3>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-tt-ink-soft">
            Not streaks-for-streaks’-sake. A loop where every turn leaves something real behind — a cared-for pet, a kinder block, a certificate on the fridge.
          </p>
          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["🎯", "Mission", "One clear job. Big steps, real world. The opposite of a feed."],
              ["💛", "Kindness", "A daily prompt that leaves the screen — a rock painted, a neighbor surprised."],
              ["🎓", "Certificate", "Proof it happened. Fridge-worthy, grandparent-forwardable."],
              ["📣", "Share", "One tap invites the next family. The loop feeds itself."],
            ].map(([emoji, title, body], index) => (
              <article key={title} className="tt-card-lift relative overflow-hidden rounded-2xl border border-tt-line bg-tt-cream p-5">
                <p className="text-3xl" aria-hidden="true">{emoji}</p>
                <p className="mt-2 text-base font-black text-tt-ink">
                  <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-tt-grape text-[11px] font-black text-white">{index + 1}</span>
                  {title}
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-tt-ink-soft">{body}</p>
                {index < 3 && (
                  <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-xl text-tt-grape/40 lg:block" aria-hidden="true">→</span>
                )}
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm font-bold text-tt-ink-soft">
            Kids chase the next mission. Parents keep the thing that makes mornings easier. Everybody wins — especially the shelter dogs. 🐶
          </p>
        </div>
      </section>

      {/* ============ DAILY KINDNESS: the reason to come back ============ */}
      <section className="-mx-3 border-y border-tt-line bg-gradient-to-br from-tt-sun-soft via-white to-tt-pine-tint p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8" aria-label="Today's kindness prompt">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-tt-tang shadow-sm">
            <span className="tt-animate-bounce-soft" aria-hidden="true">💛</span> Today’s kindness prompt
          </p>
          <p className="tt-animate-pop-in mt-4 text-2xl font-black leading-snug text-tt-navy sm:text-3xl" key={todayPrompt}>
            {todayPrompt}
          </p>
          <p className="mt-3 text-sm font-semibold text-tt-ink-soft">A new one every day. Like a tiny gym for big hearts. Come back tomorrow — we’ll be here.</p>
          <button
            onClick={() => shareText(`Today's TailTots kindness prompt: ${todayPrompt} Get a new one daily at https://tailtots.com`, "Kindness prompt copied! Spread it around. 💛")}
            className="tt-btn-press mt-4 min-h-11 rounded-full border-2 border-tt-tang/40 bg-white px-5 py-2 text-sm font-black text-tt-tang"
          >
            Share today’s prompt →
          </button>
        </div>
      </section>

      {/* ============ SAFETY: one punchy line ============ */}
      <section className="relative -mx-3 overflow-hidden border-y border-tt-line bg-white p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 select-none text-[11rem] opacity-[0.06]" aria-hidden="true">🛡️</div>
        <div className="pointer-events-none absolute -left-10 -top-10 select-none text-[8rem] opacity-[0.05]" aria-hidden="true">🔒</div>
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">Safety, without the lecture</p>
          <h3 className="mt-3 text-3xl font-black leading-tight tracking-tight text-tt-navy sm:text-4xl">
            Your child will never talk to a stranger on TailTots. <span className="underline decoration-tt-sun decoration-4 underline-offset-4">Period.</span>
          </h3>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {trustChips.map((chip) => (
              <span key={chip} className="rounded-full border border-tt-line-blue bg-tt-sky px-4 py-2 text-xs font-black text-tt-navy">🛡️ {chip}</span>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold text-tt-ink-soft">Progress stays inside your family. Adults approve missions, rewards, jobs, sharing, and every money move.</p>
        </div>
      </section>

      {/* ============ FOUNDER STORY: exactly once ============ */}
      <section className="-mx-3 border-y border-tt-line bg-tt-sun-soft/50 p-5 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-4xl" aria-hidden="true">🐹🐢🐟</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">It started with two guinea pigs, a tortoise, a tank of fish — and one big question.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] font-semibold leading-7 text-tt-ink-soft">
            “Why can’t all the kids in the world have a pet?” That was the question the kids kept asking. It turned into a bigger one: what if everyday responsibilities felt
            like adventures? So we built TailTots — a way for every kid to live the pet-care journey, the feeding schedules, the patience, the pride, whether or not
            their family is ready for the real thing yet. What began with animals grew into a bigger mission: helping kids build responsibility, kindness, confidence,
            money skills, and independence through real-world experiences.
          </p>
          <p className="mt-3 text-sm font-black text-tt-navy">Founded by kids. Built for kids. Approved by parents. 🐾</p>
        </div>
      </section>

      {/* ============ FINAL LAUNCH CTA ============ */}
      <section id="landing-real-app" className="-mx-3 scroll-mt-36 overflow-hidden border-y border-tt-pine/40 bg-tt-pine p-6 text-white shadow-sm sm:mx-0 sm:rounded-3xl sm:border-2 sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-4xl tt-animate-bounce-soft" aria-hidden="true">🚀</p>
          <h3 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Don’t miss the launch. Your kids won’t let you.</h3>
          <p className="mx-auto mt-3 max-w-xl text-[15px] font-semibold leading-6 text-white/80">
            Free family accounts, early rewards, and launch updates. One email — that’s the whole commitment. (The missions are the fun part.)
          </p>
          <p className="mx-auto mt-3 inline-flex max-w-xl items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-tt-sun ring-1 ring-white/20">
            <span aria-hidden="true">⏳</span> Founding-family window closes at launch — no fake countdown, just a real door
          </p>
          {launchJoined ? (
            <p className="mx-auto mt-5 max-w-lg rounded-xl bg-white/10 p-4 text-sm font-black text-tt-sun ring-1 ring-white/20">
              🎉 You’re counted in! See you at launch.
            </p>
          ) : (
          <form
            className="mx-auto mt-5 grid max-w-lg gap-2 sm:grid-cols-[1fr_auto]"
            onSubmit={(event) => { event.preventDefault(); joinLaunchList(); }}
          >
            <label htmlFor="final-launch-email" className="sr-only">Parent email</label>
            <input
              id="final-launch-email"
              value={launchInterest.email}
              onChange={(event) => setLaunchInterest({ email: event.target.value })}
              className="min-h-12 rounded-xl border-2 border-white/30 bg-white/10 px-4 text-sm font-bold text-white placeholder:text-white/60"
              inputMode="email"
              placeholder="Parent email"
              type="email"
              required
            />
            <button type="submit" disabled={launchInterestStatus === "saving"} className="tt-btn-press min-h-12 rounded-xl bg-tt-sun px-6 py-3 text-sm font-black text-tt-ink disabled:opacity-60">
              {launchInterestStatus === "saving" ? "Saving…" : "Count us in 🎉"}
            </button>
          </form>
          )}
          {launchInterestMessage && (
            <p className={`mt-3 text-sm font-bold ${launchInterestStatus === "error" ? "text-tt-sun" : "text-white"}`} role="status">
              {launchInterestMessage}
            </p>
          )}
        </div>
      </section>

      {/* ============ CONTACT ============ */}
      <section id="landing-contact" className="-mx-3 scroll-mt-36 border-y border-tt-line bg-[#f7fbff] p-4 shadow-sm sm:mx-0 sm:rounded-3xl sm:border sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">Questions, feedback, or partnership ideas?</h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-tt-ink-soft">
              Send a note here or email <a className="font-black text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-4" href="mailto:hello@tailtots.com">hello@tailtots.com</a>. We read everything — usually with a guinea pig on our lap.
            </p>
          </div>
          <div className="rounded-2xl border border-tt-line-blue bg-white p-4 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <label htmlFor="feedback-email" className="sr-only">Your email, optional</label>
              <input
                id="feedback-email"
                value={feedbackDraft.email}
                onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, email: event.target.value }))}
                className="min-h-11 rounded-xl border border-tt-line-blue px-3 text-sm font-bold"
                inputMode="email"
                placeholder="Your email, optional"
                type="email"
              />
              <input
                className="min-h-11 rounded-xl border border-tt-line-blue px-3 text-sm font-bold"
                value="TailTots website feedback"
                readOnly
                aria-label="Feedback topic"
              />
            </div>
            <label htmlFor="feedback-message" className="sr-only">Your message</label>
            <textarea
              id="feedback-message"
              value={feedbackDraft.message}
              onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, message: event.target.value }))}
              className="mt-2 min-h-28 w-full rounded-xl border border-tt-line-blue px-3 py-3 text-sm font-bold"
              placeholder="Ask a question, share feedback, or tell us what would make TailTots useful for your family."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={sendWebsiteFeedback}
                disabled={feedbackStatus === "saving"}
                className="tt-btn-press min-h-11 rounded-xl bg-tt-pine px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {feedbackStatus === "saving" ? "Sending…" : "Send feedback"}
              </button>
              {feedbackMessage && (
                <p className={`text-sm font-bold ${feedbackStatus === "error" ? "text-[#b44421]" : "text-tt-pine"}`} role="status">
                  {feedbackMessage}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-tt-line pt-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs font-black text-tt-navy">🐾 TailTots — parent-guided real-world growth.</p>
          <p className="text-[11px] font-semibold text-tt-ink-faint">Made with guinea-pig supervision · <a className="font-bold text-tt-pine underline decoration-tt-sun decoration-2 underline-offset-2" href="mailto:hello@tailtots.com">hello@tailtots.com</a></p>
        </div>
      </section>
    </section>
  );
}

function EcosystemRoadmapPanel() {
  const revenuePaths = [
    ["Family subscription", "$2-$5/month starter plan for chores, Kid Bank, badges, calendar, and parent controls."],
    ["Premium family plan", "$7-$10/month for AI planning, multi-kid fairness, availability links, portfolios, and advanced insights."],
    ["Neighborhood job fee", "Small flat or percentage fee on parent-approved paid jobs once trust and liquidity exist."],
    ["Shelter and sponsor programs", "Pet brands, shelters, and local partners sponsor quests, adoption learning, and donation drives."],
    ["Schools and community groups", "Life-skills curriculum, family clubs, scout-style programs, and neighborhood pilots."],
    ["Marketplace later", "Pet enrichment kits, adoption starter kits, allowance-funded goals, and trusted local services."],
  ];
  const ecosystemLoops = [
    ["Kid loop", "Learn skill -> care for pet -> complete task -> earn badge/money -> build confidence -> grow portfolio."],
    ["Parent loop", "Choose value -> approve job -> balance points -> verify completion -> track life-skill growth."],
    ["Neighborhood loop", "Trusted family posts need -> parent approves visibility -> kid confirms -> parent finalizes -> community trust grows."],
    ["Shelter loop", "Shelter posts learning quest -> family participates -> child earns impact badge -> shelter gains adopters, volunteers, donations."],
  ];
  const foundations = [
    ["Safety and privacy", "Parent-controlled accounts, no direct child messaging, limited public data, audit trail, and approval gates."],
    ["Secure backend", "Supabase or equivalent with row-level security, family isolation, encrypted transport, and deletion/export paths."],
    ["Kid portfolio", "Private skill evidence, badges, pet-care moments, completed missions, money habits, and volunteer history."],
    ["Partner console", "Later shelter, school, sponsor, and neighborhood admin surfaces with parent approval by default."],
  ];
  const phases = [
    ["Phase 1", "Family app: chores, pet care, Kid Bank, badges, calendar, parent AI, kid-safe AI prompts."],
    ["Phase 2", "Neighborhood beta: availability links, parent-approved jobs, playdates, trusted family groups."],
    ["Phase 3", "Impact network: shelters, adoption learning, volunteer quests, sponsor-backed badges."],
    ["Phase 4", "Youth pet entrepreneurship: portfolios, repeat customers, reputation, business tools, marketplace."],
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Path to profit and impact</p>
        <h2 className="mt-2 text-3xl font-black">TailTots ecosystem skeleton</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#dce7e2]">
          TailTots starts as a family-safe pet-care life-skills app, then expands into neighborhood jobs, shelter impact, sponsor programs, youth portfolios, and kid entrepreneurship.
        </p>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Business model</p>
        <h3 className="mt-2 text-2xl font-black">Revenue paths to validate</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {revenuePaths.map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#e7f4ef] p-4">
              <p className="text-base font-black">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Impact loops</p>
        <h3 className="mt-2 text-2xl font-black">How value compounds</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {ecosystemLoops.map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#f0edff] p-4">
              <p className="text-base font-black text-[#33245f]">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Product foundations</p>
          <h3 className="mt-2 text-2xl font-black">Build before scaling</h3>
          <div className="mt-4 grid gap-3">
            {foundations.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#eef2ff] p-4">
                <p className="text-base font-black">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Rollout phases</p>
          <h3 className="mt-2 text-2xl font-black">From family tool to network</h3>
          <div className="mt-4 grid gap-3">
            {phases.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#fff4d8] p-4">
                <p className="text-base font-black">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function SchedulePanel({
  activeChild,
  childProfiles,
  missions,
  scheduleItems,
  role,
  setActiveChildId,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  missions: Mission[];
  scheduleItems: KidScheduleItem[];
  role: Role;
  setActiveChildId: (childId: string) => void;
}) {
  const isParent = role === "parent";
  const visibleItems = scheduleItems.filter((item) => (isParent ? true : item.childId === activeChild?.id));
  const visibleMissions = missions.filter((mission) => (isParent ? true : !mission.assignedChildId || mission.assignedChildId === activeChild?.id)).slice(0, 4);
  const familyAvailabilityLink = `tailtots.com/availability/${childProfiles.map((child) => child.name.toLowerCase()).join("-") || "family"}`;
  const playdateWindows = [
    ["Weekday calm visit", "Tuesday or Thursday, 4:30-6:00 PM", "Parent confirms address, pet temperament, and adult presence."],
    ["Weekend pet hello", "Saturday, 10:00 AM-12:00 PM", "Good for supervised pet introductions or shared care learning."],
    ["Shelter kindness block", "Sunday afternoon", "Parent-reviewed volunteer or donation activity with badge credit."],
  ];
  const calendarDays = ["Today", "Wednesday", "Thursday", "Saturday", "Sunday"];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">{isParent ? "Family calendar" : `${activeChild?.name ?? "Kid"} calendar`}</p>
            <h2 className="mt-2 text-3xl font-black">{isParent ? "Schedules without kid pressure" : "Your day, nice and simple"}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
              {isParent ? "Parents can review the rhythm for each child without showing private parent controls in kid mode." : "See what is next, what pet needs care, and what can wait for a grown-up."}
            </p>
          </div>
          {isParent && (
            <div className="flex flex-wrap gap-2">
              {childProfiles.map((child) => (
                <button key={child.id} onClick={() => setActiveChildId(child.id)} className="min-h-10 rounded-lg border border-[#ded8c7] px-3 py-2 text-sm font-black">
                  {child.name}, {child.age}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">{isParent ? "Combined view" : "My week"}</p>
            <h3 className="mt-2 text-2xl font-black">{isParent ? "All kids in one family calendar" : "Your own schedule"}</h3>
          </div>
          {isParent && <span className="rounded-lg bg-[#f0edff] px-4 py-2 text-sm font-black text-[#33245f]">Parent-only combined calendar</span>}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {calendarDays.map((day) => {
            const dayItems = visibleItems.filter((item) => item.day === day);
            return (
              <article key={day} className="min-h-44 rounded-lg bg-[#f8f6ed] p-3">
                <p className="text-sm font-black text-[#17231f]">{day}</p>
                <div className="mt-3 grid gap-2">
                  {(dayItems.length ? dayItems : [{ id: `${day}-empty`, time: "Open", title: "No scheduled item", note: "Free family time.", childId: activeChild?.id ?? "", day, kind: "family" as const }]).map((item) => {
                    const child = childProfiles.find((profile) => profile.id === item.childId);
                    return (
                      <div key={item.id} className="rounded-lg bg-white p-3">
                        <p className="text-xs font-black text-[#0f766e]">{item.time}</p>
                        <p className="mt-1 text-sm font-black leading-5">{item.title}</p>
                        {isParent && <p className="mt-1 text-xs font-bold text-[#5f6a65]">{child?.name ?? "Family"}</p>}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {isParent && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Playdate availability</p>
          <h3 className="mt-2 text-2xl font-black">Share safe times with a dynamic family link</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
            Parents can share availability without exposing child profiles, home address, or direct kid messaging. The other family requests a time, and the parent approves before kids see anything.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-lg bg-[#eef2ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1d4ed8]">Share link preview</p>
              <p className="mt-2 break-all rounded-lg bg-white p-3 text-sm font-black text-[#17231f]">{familyAvailabilityLink}</p>
              <button className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white">Generate availability link</button>
            </div>
            <div className="grid gap-2">
              {playdateWindows.map(([title, time, note]) => (
                <article key={title} className="rounded-lg bg-[#e7f4ef] p-3">
                  <p className="text-sm font-black">{title}</p>
                  <p className="mt-1 text-xs font-bold text-[#165a4b]">{time}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#4f625b]">{note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Schedule</p>
          <div className="mt-4 grid gap-3">
            {visibleItems.map((item) => {
              const child = childProfiles.find((profile) => profile.id === item.childId);
              return (
                <article key={item.id} className="grid gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:grid-cols-[110px_1fr]">
                  <div className="rounded-lg bg-white p-3 text-sm font-black text-[#165a4b]">
                    <span className="block">{item.day}</span>
                    <span className="block text-[#5f6a65]">{item.time}</span>
                  </div>
                  <div>
                    <p className="text-lg font-black">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{item.note}</p>
                    {isParent && <p className="mt-2 text-xs font-black text-[#0f766e]">{child?.name ?? "Kid"}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Today missions</p>
          <div className="mt-4 grid gap-3">
            {visibleMissions.map((mission) => (
              <article key={mission.id} className="rounded-lg bg-[#fff4d8] p-4">
                <p className="text-lg font-black">{mission.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{mission.question}</p>
                <p className="mt-2 text-xs font-black text-[#7a4b12]">+{mission.points} points after parent approval</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function KidPetHelperPanel({ activeChild, pets, moments }: { activeChild?: Child; pets: Pet[]; moments: MemoryMoment[] }) {
  const pet = pets[0];
  const petName = pet?.name ?? "your pet";
  const [selectedQuestion, setSelectedQuestion] = useState("care");
  const kidQuestions = [
    ["care", `How can I take care of ${petName} today?`],
    ["fact", `Tell me something cool about ${petName}.`],
    ["hobby", "Give me a pet or hobby idea."],
    ["quote", "Give me today's kind quote."],
  ];
  const aiSuggestion = buildKidAiSuggestion(selectedQuestion, petName, activeChild?.name ?? "Kid");
  const helperCards = [
    ["Daily quote", "Small care done every day becomes a big kind habit."],
    ["Pet fact", `${petName} feels safer when food, water, sound, and handling stay calm and predictable.`],
    ["Try today", `Look closely at ${petName} for ten quiet seconds, then tell a parent one thing you noticed.`],
    ["Hobby spark", "Draw your pet's dream home, build a paper maze, or write a tiny care story."],
  ];
  const recentMoment = moments.find((moment) => moment.childId === activeChild?.id);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Kid-safe AI helper</p>
        <h2 className="mt-2 text-3xl font-black">{activeChild?.name ?? "Kid"}, ask about pets without grown-up screens</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
          These are guided prompts, not open chat. They help kids learn pet care, curiosity, and kindness without judging them.
        </p>
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Ask with a button</p>
        <h3 className="mt-2 text-2xl font-black">Pick a safe question</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {kidQuestions.map(([id, question]) => (
            <button
              key={id}
              onClick={() => setSelectedQuestion(id)}
              className={`min-h-14 rounded-lg px-4 py-3 text-left text-sm font-black leading-5 ${
                selectedQuestion === id ? "bg-[#165a4b] text-white" : "border border-[#ded8c7] bg-[#f8f6ed] text-[#17231f]"
              }`}
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">TailTots suggestion</p>
          <p className="mt-2 text-lg font-black leading-7">{aiSuggestion.title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#4f625b]">{aiSuggestion.body}</p>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {helperCards.map(([title, body]) => (
          <article key={title} className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-black">{title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#5f6a65]">{body}</p>
          </article>
        ))}
      </div>
      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Your care memory</p>
        <p className="mt-3 text-lg font-black">{recentMoment?.note ?? "Complete a care mission and your kind pet moment can show here."}</p>
      </section>
    </section>
  );
}

function buildKidAiSuggestion(questionId: string, petName: string, childName: string) {
  const suggestions: Record<string, { title: string; body: string }> = {
    care: {
      title: `${childName}, try a calm care check.`,
      body: `Look at ${petName}'s food, water, comfort, and space. Pick one thing to fix, then ask a parent to review it with you.`,
    },
    fact: {
      title: `${petName} notices routines.`,
      body: "Many pets feel safer when care happens in the same gentle order each day. That is why small habits matter.",
    },
    hobby: {
      title: "Turn care into a mini project.",
      body: `Draw ${petName}'s favorite snack, make a simple care chart, or build a small paper maze or observation journal with a parent nearby.`,
    },
    quote: {
      title: "Kindness grows by practice.",
      body: "A small helpful action today can become a strong life skill tomorrow.",
    },
  };
  return suggestions[questionId] ?? suggestions.care;
}

function HomeHubPanel({
  activeChild,
  childProfiles,
  pets,
  missions,
  goals,
  moments,
  badges,
  fairnessSummary,
  familySkillSummary,
  role,
  isParentUnlocked,
  pendingCount,
  setActiveTab,
  scheduleItems,
}: {
  activeChild?: Child;
  childProfiles: Child[];
  pets: Pet[];
  missions: Mission[];
  goals: SavingsGoal[];
  moments: MemoryMoment[];
  badges: BadgeAward[];
  fairnessSummary: ReturnType<typeof getFairnessSummary>;
  familySkillSummary: ReturnType<typeof getFamilySkillSummary>;
  role: Role;
  isParentUnlocked: boolean;
  pendingCount: number;
  setActiveTab: (tab: string) => void;
  scheduleItems: KidScheduleItem[];
}) {
  const isParentView = role === "parent" && isParentUnlocked;
  const nextMissions = missions.filter((mission) => mission.status === "pending" && !mission.completedBy).slice(0, 4);
  const approvedCount = missions.filter((mission) => mission.status === "approved").length;
  const streakLeader = [...childProfiles].sort((a, b) => b.streakDays - a.streakDays)[0];
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies).slice(0, 2);
  const reminders = isParentView
    ? [
        `Review ${pendingCount} item${pendingCount === 1 ? "" : "s"} before rewards count.`,
        "Check assignment balance so kids are not competing for the same work.",
        "Choose which neighborhood jobs are visible before kids can accept them.",
      ]
    : [
        `Next care idea: check what ${pets[0]?.name ?? "your pet"} needs first.`,
        `${nextMissions[0]?.title ?? "Water check"} can be marked done after a parent looks.`,
        "Rewards count after a grown-up review.",
      ];
  const visibleBadges = (isParentView ? badges : badges.filter((badge) => badge.childId === activeChild?.id)).slice(0, 4);
  const nextSchedule = scheduleItems.filter((item) => (isParentView ? true : item.childId === activeChild?.id)).slice(0, 3);
  const lifeSkillBadges = [
    { title: "Responsibility", detail: "Daily care rhythm", color: "bg-[#e7f4ef] text-[#0f513f]" },
    { title: "Kindness", detail: "Gentle pet moments", color: "bg-[#ffe5f0] text-[#8f1d4f]" },
    { title: "Teamwork", detail: "Family and friends", color: "bg-[#fff4d8] text-[#7a4b12]" },
    { title: "On Time", detail: "Healthy routines", color: "bg-[#eaf1ff] text-[#1d4ed8]" },
  ];

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-lg border border-[#ded8c7] bg-[#17231f] text-white shadow-sm">
          <div className="grid min-h-[320px] gap-5 p-4 sm:p-6 2xl:grid-cols-[minmax(0,1fr)_220px] 2xl:items-center">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd166]">Home Hub</p>
              <p className="mt-3 inline-flex max-w-full rounded-full bg-white/10 px-3 py-2 text-sm font-black text-[#ffd166]">
                <span className="truncate">{isParentView ? "Parent command center" : `${activeChild?.name ?? "Kid helper"} is operating this screen`}</span>
              </p>
              <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl xl:text-5xl">
                {isParentView ? "Family care overview is ready." : `${activeChild?.name ?? "Kid helper"}, your pets are ready.`}
              </h2>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/82 sm:text-lg">
                {isParentView
                  ? "Track approvals, assignment fairness, kid progress, pet care, and parent-gated neighborhood jobs from one place."
                  : "A family display view for tablets, Echo Show-style screens, Google Nest-style screens, and the kitchen counter."}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["Missions", nextMissions.length, "#ffd166"],
                  ["Approved", approvedCount, "#5eead4"],
                  [isParentView ? "Needs review" : "Parent review", pendingCount, "#ff8ab3"],
                ].map(([label, value, color]) => (
                  <div key={label} className="min-w-0 rounded-lg bg-white/10 p-3 sm:p-4">
                    <p className="text-xs font-black uppercase text-white/70 sm:text-sm">{label}</p>
                    <p className="mt-2 text-3xl font-black sm:text-4xl" style={{ color: String(color) }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs font-black uppercase text-white/70">Fairness engine</p>
                  <p className="mt-2 text-lg font-black text-[#ffd166]">{fairnessSummary.label}</p>
                  <p className="mt-1 text-sm font-bold text-white/70">{fairnessSummary.detail}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs font-black uppercase text-white/70">Top value</p>
                  <p className="mt-2 text-lg font-black text-[#5eead4]">{familySkillSummary.topLabel}</p>
                  <p className="mt-1 text-sm font-bold text-white/70">{familySkillSummary.totalBadges} value badges tracked</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white/10 p-5">
              <p className="text-center text-sm font-black uppercase tracking-[0.14em] text-[#ffd166]">Pet buddies</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {pets.slice(0, 4).map((pet) => {
                  const look = getPetLook(pet.id);
                  return (
                    <div key={pet.id} className="grid place-items-center rounded-lg bg-white/10 p-3">
                      <ProfilePhoto
                        label={pet.name}
                        initial={look.face}
                        colors={look.colors}
                        size="md"
                        variant="pet"
                        petKind={look.kind}
                        photoUrl={pet.photoUrl}
                      />
                      <p className="mt-2 max-w-full truncate text-center text-base font-black">{pet.name}</p>
                      <p className="max-w-full truncate text-center text-xs font-bold text-white/70">{pet.species}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Tablet home display</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Parent next steps" : "Kitchen counter view"}</h3>
          <div className="mt-4 grid gap-3">
            {reminders.map((reminder) => (
              <p key={reminder} className="rounded-lg bg-[#f8f6ed] p-4 text-base font-black leading-6 sm:text-lg sm:leading-7">{reminder}</p>
            ))}
          </div>
          <button
            onClick={() => (role === "parent" && isParentUnlocked ? setActiveTab("approvals") : setActiveTab("missions"))}
            className="mt-4 min-h-14 w-full rounded-lg bg-[#165a4b] px-5 py-4 text-lg font-black text-white"
          >
            {role === "parent" && isParentUnlocked ? "Open parent review" : "Ask a grown-up to review"}
          </button>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">{isParentView ? "Open assignments" : "Care list"}</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Family mission board" : "Big-screen mission board"}</h3>
          <div className="mt-4 grid gap-3">
            {nextMissions.map((mission) => (
              <article key={mission.id} className="grid gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-lg font-black sm:text-xl">{mission.title}</p>
                  <p className="mt-1 text-sm font-bold text-[#5f6a65]">{mission.question}</p>
                </div>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#165a4b]">
                  +{mission.points} pts
                </span>
              </article>
            ))}
          </div>
          <button onClick={() => setActiveTab(isParentView ? "approvals" : "missions")} className="mt-4 min-h-14 w-full rounded-lg bg-[#17231f] px-5 py-4 text-lg font-black text-white">
            {isParentView ? "Open parent review" : "Go to Today"}
          </button>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Badges and life skills</p>
          <h3 className="mt-2 text-2xl font-black sm:text-3xl">What kids are learning</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {lifeSkillBadges.map((badge) => (
              <article key={badge.title} className={`min-h-28 rounded-lg p-3 sm:min-h-32 sm:p-4 ${badge.color}`}>
                <p className="text-lg font-black sm:text-xl">{badge.title}</p>
                <p className="mt-2 text-sm font-bold">{badge.detail}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {(visibleBadges.length ? visibleBadges : [{ id: "empty", title: "First badge ready", note: "Complete a mission and a parent can award it.", awardedAt: "Soon" }]).map((badge) => (
              <p key={badge.id} className="rounded-lg bg-white p-3 text-sm font-black shadow-sm">
                {badge.title}
                <span className="block text-xs font-bold text-[#5f6a65]">{badge.note}</span>
              </p>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-[#e7f4ef] p-4">
            <p className="text-lg font-black">{streakLeader?.name ?? "A helper"} leads the streak board</p>
            <p className="mt-1 text-sm font-bold text-[#4f625b]">{streakLeader?.streakDays ?? 0} days of care momentum.</p>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Kid calendar</p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">{isParentView ? "Family schedule snapshot" : "What is next for you"}</h3>
          </div>
          <button onClick={() => setActiveTab("schedule")} className="min-h-11 rounded-lg border border-[#b7d9cc] px-4 py-2 text-sm font-black text-[#165a4b]">
            Open schedule
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(nextSchedule.length ? nextSchedule : [{ id: "empty-schedule", day: "Today", time: "Any time", title: "No scheduled items", note: "Enjoy a calm day.", childId: activeChild?.id ?? "", kind: "family" as const }]).map((item) => {
            const child = childProfiles.find((profile) => profile.id === item.childId);
            return (
              <article key={item.id} className="rounded-lg bg-[#f8f6ed] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5f6a65]">{item.day} - {item.time}</p>
                <p className="mt-2 text-lg font-black">{item.title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{item.note}</p>
                {isParentView && <p className="mt-2 text-xs font-black text-[#165a4b]">{child?.name ?? "Kid"}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood favorite</p>
        <h3 className="mt-2 text-3xl font-black">Parent-approved community moments</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            "Parents post pet care jobs. Kids can apply only after grown-up approval.",
            "Trusted families can plan safe pet playdates without child-to-child messaging.",
            "Kind goals can be shared as causes, including donations to animal shelters.",
          ].map((item) => (
            <p key={item} className="rounded-lg bg-[#f8f6ed] p-4 text-base font-black leading-6">{item}</p>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sharedGoals.map((goal) => (
            <article key={goal.id} className="rounded-lg bg-[#fff4d8] p-4">
              <p className="text-xl font-black">{goal.title}</p>
              <p className="mt-1 text-sm font-bold text-[#6f5c31]">{goal.causeNote}</p>
            </article>
          ))}
          <article className="rounded-lg bg-[#eef2ff] p-4">
            <p className="text-xl font-black">Latest memory</p>
            <p className="mt-1 text-sm font-bold text-[#4c5578]">{moments[0]?.note ?? "A kind pet care moment will show here."}</p>
          </article>
        </div>
      </section>
    </section>
  );
}

function ChildProfileSwitcher({
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

function Hero({
  child,
  childProfiles,
  setActiveChildId,
  pendingCount,
  taskProgress,
  approvedMissionCount,
  pets,
  setActiveTab,
}: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  pendingCount: number;
  taskProgress: number;
  approvedMissionCount: number;
  pets: Pet[];
  setActiveTab: (tab: string) => void;
}) {
  const childLook = getChildLook(child?.id);
  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="overflow-hidden rounded-lg bg-[#165a4b] text-white shadow-sm">
        <div className="p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b7e7d5]">Family pet-care system</p>
            <h2 className="mt-2 max-w-2xl text-2xl font-black leading-tight md:text-3xl">
              Kids care for real pets. Parents stay confident.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#d8f5e8]">
              Pick the child, complete today&apos;s care and helper missions, then parent approval handles rewards.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setActiveTab("missions")} className="min-h-11 rounded-lg bg-[#f47b20] px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                Start today&apos;s missions
              </button>
              <button onClick={() => setActiveTab("setup")} className="min-h-11 rounded-lg border border-white/35 bg-white/10 px-4 py-3 text-sm font-black text-white sm:min-h-12 sm:px-5">
                Manage family setup
              </button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-white/15 bg-white/8 p-4 sm:grid-cols-3">
          {familyStats.map(([label, value, color]) => (
            <Meter key={label} label={String(label)} value={Number(value)} color={String(color)} dark />
          ))}
        </div>
      </div>
      <div className="flex flex-col rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="flex items-center gap-3">
              <ProfilePhoto label={child?.name ?? "Kid"} initial={childLook.initial} colors={childLook.colors} variant="kid" hair={childLook.hair} photoUrl={child?.photoUrl} />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Selected child</p>
                <h3 className="text-2xl font-black">{child?.name ?? "Add a child"}</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {childProfiles.map((item) => {
                const look = getChildLook(item.id);
                const isSelected = item.id === child?.id;
                return (
                  <div key={item.id} className={`rounded-lg border ${isSelected ? "border-[#f47b20] bg-[#fff4d8]" : "border-[#ded8c7] bg-[#f8f6ed]"}`}>
                    <button
                      onClick={() => setActiveChildId(item.id)}
                      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm font-black text-[#17231f]"
                    >
                      <ProfilePhoto label={item.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={item.photoUrl} />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div>
              <div className="mb-2 flex justify-between text-sm font-black">
                <span>Task progress</span>
                <span>{taskProgress}%</span>
              </div>
              <div className="h-4 rounded-full bg-[#f0ead8]">
                <div className="h-4 rounded-full bg-[#f47b20]" style={{ width: `${taskProgress}%` }} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <span className="rounded-lg bg-[#ecf7f0] p-3 text-[#123d33]"><b className="block text-lg">{child?.points ?? 0}</b>points</span>
              <span className="rounded-lg bg-[#fff4d8] p-3 text-[#7a4b12]"><b className="block text-lg">{approvedMissionCount}</b>approved</span>
              <span className="rounded-lg bg-[#eef4ff] p-3 text-[#1d4f91]"><b className="block text-lg">{pendingCount}</b>pending</span>
            </div>
            <div className="mt-4 grid gap-3">
              <Meter label="Loving the app" value={childLook.love} color="#7c3aed" />
              <Meter label="Happiness today" value={childLook.joy} color="#0f766e" />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-[#f8f6ed] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Active pets</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pets.map((item) => {
              const look = getPetLook(item.id);
              return (
                <div key={item.id} className="grid place-items-center gap-1 rounded-lg bg-white p-2 text-center text-[11px] font-black">
                  <ProfilePhoto label={item.name} initial={look.face} colors={look.colors} size="xs" variant="pet" petKind={look.kind} photoUrl={item.photoUrl} />
                  <span className="max-w-full truncate">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
        <button onClick={() => setActiveTab("pets")} className="mt-auto min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          View pet passports
        </button>
      </div>
    </section>
  );
}

function loadSavedFamilyState() {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(savedFamilyStateKey) ?? window.localStorage.getItem(legacySavedFamilyStateKey);
    return raw ? migrateSavedFamilyState(JSON.parse(raw) as SavedFamilyState) : undefined;
  } catch {
    return undefined;
  }
}

function migrateSavedFamilyState(state: SavedFamilyState): SavedFamilyState {
  const hasOldDemoKids = state.children.some((child) => child.id === "maya" || child.id === "leo");
  const hasOldDemoPets = state.pets.some((pet) => pet.id === "luna" || pet.id === "mochi");
  if (!hasOldDemoKids && !hasOldDemoPets) {
    return {
      ...state,
      children: state.children.map(normalizeChildProfile),
    };
  }

  return {
    ...state,
    children: starterChildren,
    pets: starterPets,
    activeChildId: state.activeChildId === "leo" ? "aarush" : "sahasra",
  };
}

function saveFamilyState(state: SavedFamilyState) {
  if (typeof window === "undefined") return;
  const safeState: SavedFamilyState = {
    ...state,
    parentPasscode: undefined,
    children: state.children.map(normalizeChildProfile),
    pets: state.pets.map(normalizePetProfile),
    neighborhoodJobs: state.neighborhoodJobs.map(normalizeNeighborhoodJob),
  };
  try {
    window.localStorage.setItem(savedFamilyStateKey, JSON.stringify(safeState));
  } catch {
    try {
      window.localStorage.setItem(savedFamilyStateKey, JSON.stringify({ ...safeState, familyPhotoUrl: undefined }));
    } catch {
      // Supabase storage will replace local image persistence later.
    }
  }
}

function normalizeChildProfile(child: Child): Child {
  return {
    ...child,
    age: child.id === "sahasra" ? 6 : child.id === "aarush" ? 9 : child.age ?? 8,
    secretCode: "",
  };
}

function normalizeNeighborhoodJob(job: NeighborhoodJob): NeighborhoodJob {
  return {
    ...job,
    visibleToKids: job.visibleToKids === true,
    minAge: job.minAge ?? 4,
    skillFocus: job.skillFocus ?? "teamwork",
    trustSignals: job.trustSignals?.length ? job.trustSignals : ["parent_gate", "age_fit", "private_child"],
  };
}

function normalizePetProfile(pet: Pet): Pet {
  return pet.id === "jack" ? { ...pet, photoUrl: undefined } : pet;
}

function isMissionAgeAppropriate(mission: Mission, child: Child) {
  return child.age >= difficultyAgeGuidance[mission.difficulty].minAge;
}

function getAgeFitCopy(mission: Mission, child?: Child) {
  if (!child) return "Assign a kid to see age fit.";
  const guidance = difficultyAgeGuidance[mission.difficulty];
  return isMissionAgeAppropriate(mission, child)
    ? `Good age fit for ${child.name}. Suggested for ${guidance.label.toLowerCase()}.`
    : `${child.name} is younger than the ${guidance.label.toLowerCase()} guidance. Parent supervision recommended.`;
}

function PhotoCropModal({
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

async function cropProfileImage(draft: PhotoCropDraft) {
  const image = await loadImage(draft.imageUrl);
  const canvas = document.createElement("canvas");
  const outputSize = 256;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext("2d");
  if (!context) return draft.imageUrl;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);

  const area = draft.croppedAreaPixels ?? {
    x: 0,
    y: 0,
    width: Math.min(image.width, image.height),
    height: Math.min(image.width, image.height),
  };

  context.save();
  context.beginPath();
  context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputSize, outputSize);
  context.restore();

  return canvas.toDataURL("image/jpeg", 0.86);
}

async function resizeImageFile(file: File, maxSize: number, quality: number) {
  const image = await loadImage(await fileToDataUrl(file));
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return fileToDataUrl(file);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FamilyFaceParade({
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

function MissionsPanel(props: {
  activeChild?: Child;
  missions: Mission[];
  pets: Pet[];
  allChildren: Child[];
  missionNote: string;
  setMissionNote: (value: string) => void;
  completeMission: (missionId: string) => void;
}) {
  const pawgressTotal = props.missions.length;
  const pawgressDone = props.missions.filter((mission) => mission.completedBy || mission.status === "approved").length;
  const pawgressPct = pawgressTotal === 0 ? 0 : Math.round((pawgressDone / pawgressTotal) * 100);
  const pawgressMessage =
    pawgressTotal === 0
      ? "No missions yet — the paws are napping. 😴"
      : pawgressPct === 100
        ? "All paws accounted for! Legendary status: achieved. 🏆"
        : pawgressPct >= 50
          ? "Over halfway! Somewhere, a guinea pig is impressed. 🐹"
          : pawgressPct > 0
            ? "Paws warming up… the treat jar is watching. 🦴"
            : "The paws are idle. Suspiciously idle. 🐾";
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Today</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Today&apos;s care and helper missions</h2>
          <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#5f6a65]">
            This is the main kid screen. Pick a pet care or helper task, answer the check-in, then wait for parent review.
          </p>
        </div>
        <textarea
          value={props.missionNote}
          onChange={(event) => props.setMissionNote(event.target.value)}
          className="min-h-24 rounded-lg border border-[#ded8c7] px-4 py-3 text-base font-semibold sm:w-80"
          placeholder="What did you notice?"
        />
      </div>
      <div className="mt-4 rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4" aria-label="Mission progress">
        <div className="flex items-center justify-between gap-2 text-sm font-black">
          <span>🐾 Pawgress</span>
          <span>{pawgressDone}/{pawgressTotal} · {pawgressPct}%</span>
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#f0ead8]" role="progressbar" aria-valuenow={pawgressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Pawgress">
          <div
            className="h-4 rounded-full bg-gradient-to-r from-[#f47b20] to-[#ffd166] transition-[width] duration-700"
            style={{ width: `${pawgressPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-bold text-[#5f6a65]">{pawgressMessage}</p>
      </div>
      <div className="mt-5 grid gap-3">
        {props.missions.map((mission) => {
          const pet = props.pets.find((item) => item.id === mission.petId);
          const skill = getMissionLifeSkill(mission);
          const assignedChild = props.allChildren.find((child) => child.id === mission.assignedChildId);
          const missionDone = Boolean(mission.completedBy) || mission.status === "approved";
          return (
            <article
              key={mission.id}
              className={`relative grid gap-4 overflow-hidden rounded-lg border p-4 lg:grid-cols-[1fr_auto] lg:items-center ${
                missionDone
                  ? "border-[#165a4b]/40 bg-[#eef7f2] shadow-[0_8px_24px_-12px_rgba(22,90,75,0.45)]"
                  : "border-[#e8e1cf] bg-[#fbfaf4]"
              }`}
            >
              {missionDone && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {["🎉", "⭐", "🐾", "💛"].map((emoji, i) => (
                    <span key={i} className="tt-confetti-piece absolute text-xl" style={{ left: `${12 + i * 24}%`, top: "8%", animationDelay: `${i * 0.15}s` }}>{emoji}</span>
                  ))}
                </div>
              )}
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                  {pet ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#e7f4ef] py-1 pl-1 pr-3 text-xs font-black">
                      <ProfilePhoto label={pet.name} initial={getPetLook(pet.id).face} colors={getPetLook(pet.id).colors} size="xs" variant="pet" petKind={getPetLook(pet.id).kind} photoUrl={pet.photoUrl} />
                      {pet.name}
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black capitalize">{mission.category.replace("_", " ")}</span>
                  )}
                  <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black">
                    {mission.allowanceDollars ? `+$${mission.allowanceDollars}` : "No dollars"}
                  </span>
                  <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#5b21b6]">
                    {getLifeSkillLabel(skill)}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-black">{mission.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{mission.question}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#165a4b]">
                    Why this is for you: {getKidMissionReason(mission, props.activeChild)}
                  </p>
                  <p className="rounded-lg bg-white p-3 text-xs font-black text-[#7a4b12]">
                    Fairness note: {assignedChild ? `${assignedChild.name} owns this one task.` : "Parent can assign one owner so kids do not fight over it."}
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <button
                  onClick={() => props.completeMission(mission.id)}
                  disabled={!props.activeChild || mission.status === "approved"}
                  className={`tt-btn-press min-h-14 w-full rounded-lg px-6 py-3 text-base font-black text-white disabled:bg-[#b9b2a2] lg:w-auto ${missionDone ? "bg-[#165a4b]" : "bg-[#f47b20]"}`}
                >
                  {mission.status === "approved" ? "Approved ✓" : mission.completedBy ? "Needs approval 👀" : "Mark done"}
                </button>
                {missionDone && (
                  <p className="text-center text-xs font-black text-[#165a4b] lg:text-right">
                    {mission.status === "approved" ? "🎉 Mission crushed. Treats earned." : "🎉 Done! Awaiting the parent high-five."}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PassportPanel({ pets, updatePetPhoto }: { pets: Pet[]; updatePetPhoto?: (petId: string, file?: File) => void }) {
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

function BankPanel(props: {
  child?: Child;
  childProfiles: Child[];
  setActiveChildId: (childId: string) => void;
  transactions: BankTransaction[];
  goals: SavingsGoal[];
  requestBankMove: (category: BankCategory, amount?: number, description?: string, goalId?: string) => void;
  newGoal: { title: string; target: string };
  setNewGoal: (value: { title: string; target: string }) => void;
  addSavingsGoal: () => void;
  setActiveTab: (tab: string) => void;
}) {
  type KidMoneyCategory = Exclude<BankCategory, "earn" | "spend">;
  const childTransactions = props.transactions.filter((item) => item.childId === props.child?.id);
  const childGoals = props.goals.filter((item) => item.childId === props.child?.id);
  const childLook = getChildLook(props.child?.id);
  const approvedTransactions = childTransactions.filter((tx) => tx.status === "approved");
  const approvedAllowance = approvedTransactions.filter((tx) => tx.category === "earn").reduce((sum, tx) => sum + tx.amount, 0);
  const spentOrGiven = approvedTransactions.filter((tx) => tx.category === "spend" || tx.category === "give").reduce((sum, tx) => sum + tx.amount, 0);
  const savedForGoals = childGoals.reduce((sum, goal) => sum + goal.saved, 0);
  const availableBalance = Math.max(0, approvedAllowance - spentOrGiven - savedForGoals);
  const earnedActivityTransactions = childTransactions.filter((tx) => tx.category === "earn" && tx.status === "approved").slice(0, 4);
  const givePurposes = ["Animal shelter", "Classroom cause", "Neighborhood helper fund", "Pet rescue", "Other kindness"];
  const [moneyDraft, setMoneyDraft] = useState({
    category: "save" as KidMoneyCategory,
    amount: "3",
    reason: "",
    goalId: childGoals[0]?.id ?? "",
  });
  const selectedGoalId = childGoals.some((goal) => goal.id === moneyDraft.goalId) ? moneyDraft.goalId : childGoals[0]?.id ?? "";
  const requestedAmount = Math.max(1, Number(moneyDraft.amount) || 1);
  const submitMoneyRequest = () => {
    if (requestedAmount > availableBalance) return;
    const selectedGoal = childGoals.find((goal) => goal.id === selectedGoalId);
    if (moneyDraft.category === "save" && !selectedGoal) return;
    const defaultReason =
      moneyDraft.category === "save"
          ? `Save for ${selectedGoal?.title}`
        : "Give money for kindness";
    const actionLabel = moneyDraft.category === "save" ? "Save" : "Give";
    props.requestBankMove(
      moneyDraft.category,
      requestedAmount,
      `${actionLabel} $${requestedAmount}: ${moneyDraft.reason.trim() || defaultReason}`,
      moneyDraft.category === "save" ? selectedGoal?.id : undefined,
    );
    setMoneyDraft({ ...moneyDraft, amount: "3", reason: "" });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-sm font-black text-white">
          Back to Today
        </button>
        <button onClick={() => props.setActiveTab("pets")} className="min-h-11 rounded-lg border border-[#ded8c7] bg-white px-4 py-2 text-sm font-black text-[#17231f]">
          Pet Passports
        </button>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Choose kid bank</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {props.childProfiles.map((childProfile) => {
            const look = getChildLook(childProfile.id);
            const isSelected = childProfile.id === props.child?.id;
            return (
              <button
                key={childProfile.id}
                onClick={() => props.setActiveChildId(childProfile.id)}
                className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-black ${
                  isSelected ? "border-[#f47b20] bg-[#fff4d8] text-[#17231f] ring-2 ring-[#f47b20]/20" : "border-[#ded8c7] bg-[#f8f6ed] text-[#53615b]"
                }`}
              >
                <ProfilePhoto label={childProfile.name} initial={look.initial} colors={look.colors} size="xs" variant="kid" hair={look.hair} photoUrl={childProfile.photoUrl} />
                <span className="min-w-0 flex-1 truncate">{childProfile.name}</span>
                {isSelected && <span className="rounded-full bg-[#17231f] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white">Selected</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <ProfilePhoto
              label={props.child?.name ?? "Kid"}
              initial={childLook.initial}
              colors={childLook.colors}
              size="lg"
              variant="kid"
              hair={childLook.hair}
              photoUrl={props.child?.photoUrl}
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Kid Bank</p>
              <h2 className="mt-1 text-3xl font-black">{props.child?.name ?? "Kid"}&apos;s money choices</h2>
              <p className="mt-1 text-sm font-semibold text-[#5f6a65]">Coins are app rewards. Dollars are parent-approved allowance money.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#fff4d8] px-4 py-3">
              <p className="text-2xl font-black">${availableBalance}</p>
              <p className="text-xs font-black text-[#7a4b12]">dollars available</p>
            </div>
            <div className="rounded-lg bg-[#e7f4ef] px-4 py-3">
              <p className="text-2xl font-black">${savedForGoals}</p>
              <p className="text-xs font-black text-[#0f766e]">dollars in goals</p>
            </div>
            <div className="rounded-lg bg-[#eef2ff] px-4 py-3">
              <p className="text-2xl font-black">{props.child?.coins ?? 0}</p>
              <p className="text-xs font-black text-[#2563eb]">reward coins</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">My goals</p>
          <h3 className="mt-2 text-2xl font-black">What are you saving for?</h3>
          <div className="mt-4 grid gap-3">
            {!childGoals.length && (
              <div className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">Add one goal first, then move allowance dollars toward it.</div>
            )}
            {childGoals.map((goal) => {
              const percent = Math.min(100, (goal.saved / goal.target) * 100);
              return (
                <article key={goal.id} className="rounded-lg bg-[#f8f6ed] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">{goal.title}</p>
                      <p className="text-sm font-bold text-[#5f6a65]">${goal.target - goal.saved} left to go</p>
                      <p className="mt-1 text-xs font-bold text-[#69736f]">
                        {goal.sharedWithTrustedFamilies ? "Shared with trusted families as a cause" : "Private goal"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black">${goal.saved}/${goal.target}</span>
                  </div>
                  <div className="mt-3 h-4 rounded-full bg-white">
                    <div className="h-4 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">
                    Use the choices panel to move available dollars into this goal.
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Start a new goal</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold"
                placeholder="Example: Captain treats"
                value={props.newGoal.title}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, title: event.target.value })}
              />
              <input
                className="rounded-lg border border-[#d7caa9] px-4 py-3 font-semibold"
                inputMode="numeric"
                placeholder="$ target"
                value={props.newGoal.target}
                onChange={(event) => props.setNewGoal({ ...props.newGoal, target: event.target.value })}
              />
              <button onClick={props.addSavingsGoal} className="min-h-12 rounded-lg bg-[#f47b20] px-5 py-3 text-sm font-black text-white">Add goal</button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#f47b20]">Use available dollars</p>
            <h3 className="mt-2 text-3xl font-black">Choose a money jar</h3>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#5f6a65]">Dollars come from parent-assigned tasks. Kids can save for a goal or give to a parent-approved cause.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {(["save", "give"] as KidMoneyCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setMoneyDraft({ ...moneyDraft, category, reason: "" })}
                  className={`min-h-16 rounded-lg px-4 py-3 text-lg font-black ${
                    moneyDraft.category === category ? "bg-[#17231f] text-white" : "border border-[#ded8c7] bg-[#f8f6ed] text-[#17231f]"
                  }`}
                >
                  {category === "save" ? "Save to goal" : "Give/help"}
                </button>
              ))}
            </div>
            <label className="mt-5 block text-lg font-black">
              Amount
              <div className="mt-3 grid grid-cols-4 gap-3">
                {["1", "2", "5", "10"].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setMoneyDraft({ ...moneyDraft, amount })}
                    className={`min-h-14 rounded-lg px-3 py-2 text-lg font-black ${
                      moneyDraft.amount === amount ? "bg-[#f47b20] text-white" : "border border-[#ded8c7] bg-white text-[#17231f]"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <input
                className="mt-3 w-full rounded-lg border border-[#ded8c7] px-4 py-4 text-lg font-semibold"
                inputMode="numeric"
                value={moneyDraft.amount}
                onChange={(event) => setMoneyDraft({ ...moneyDraft, amount: event.target.value })}
                placeholder="Other amount"
              />
            </label>
            <label className="mt-5 block text-lg font-black">
              {moneyDraft.category === "save" ? "Which goal?" : "Which cause?"}
              {moneyDraft.category === "save" ? (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={selectedGoalId}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, goalId: event.target.value })}
                >
                  {childGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} (${goal.saved}/${goal.target})</option>)}
                </select>
              ) : (
                <select
                  className="mt-3 w-full rounded-lg border border-[#ded8c7] bg-white px-4 py-4 text-lg font-semibold"
                  value={moneyDraft.reason}
                  onChange={(event) => setMoneyDraft({ ...moneyDraft, reason: event.target.value })}
                >
                  <option value="">Choose a purpose</option>
                  {givePurposes.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
                </select>
              )}
            </label>
            <button
              onClick={submitMoneyRequest}
              disabled={requestedAmount > availableBalance || (moneyDraft.category === "save" && !childGoals.length)}
              className="mt-5 min-h-14 w-full rounded-lg bg-[#165a4b] px-5 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8c4bf]"
            >
              Ask parent to approve {moneyDraft.category} ${requestedAmount}
            </button>
            {moneyDraft.category === "save" && !childGoals.length && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">Add a goal before saving dollars.</p>
            )}
            {requestedAmount > availableBalance && (
              <p className="mt-3 text-sm font-bold text-[#7a4b12]">That is more than the available dollars.</p>
            )}
            <div className="mt-4 rounded-lg bg-[#f8f6ed] p-4 text-base font-bold leading-6 text-[#5f6a65]">
              To earn dollars, finish parent-assigned tasks. This panel only moves approved dollars into savings or giving.
            </div>
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
            <h3 className="font-black">Allowance approved for activities</h3>
            {earnedActivityTransactions.map((tx) => (
              <p key={tx.id} className="mt-3 rounded-lg bg-[#e7f4ef] p-3 text-sm font-semibold">
                <b>+${tx.amount}</b>
                <span className="mt-1 block">{tx.description}</span>
              </p>
            ))}
            {!earnedActivityTransactions.length && <p className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold text-[#5f6a65]">Approved allowance tied to activities will show here.</p>}
          </div>

          <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <h3 className="font-black">Waiting and history</h3>
          {childTransactions.map((tx) => (
            <p key={tx.id} className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold">
              <b className="capitalize">{tx.category}</b> ${tx.amount}
              <span className="mt-1 block">{tx.description}</span>
              <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-[#5f6a65]">{tx.status}</span>
            </p>
          ))}
          {!childTransactions.length && <p className="mt-3 rounded-lg bg-[#f8f6ed] p-3 text-sm font-semibold text-[#5f6a65]">No bank moves yet.</p>}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-[#ded8c7] bg-white p-3 shadow-sm sm:hidden">
        <button onClick={() => props.setActiveTab("missions")} className="min-h-12 w-full rounded-lg bg-[#17231f] px-4 py-3 text-sm font-black text-white">
          Back to Today
        </button>
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
  rejectMission: (missionId: string) => void;
  rejectTransaction: (transactionId: string) => void;
}) {
  const pendingMissions = props.missions.filter((mission) => mission.completedBy && mission.status === "pending");
  const pendingTransactions = props.transactions.filter((tx) => tx.status === "pending");
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent dashboard</p>
      <h2 className="mt-2 text-3xl font-black">Review before rewards count</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
        Parents stay in control. Completed missions and Kid Bank requests wait here until a grown-up approves them.
      </p>
      <div className="mt-5 grid gap-3">
        {!pendingMissions.length && !pendingTransactions.length && (
          <div className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">
            Nothing needs review right now. When kids mark missions done or request Kid Bank moves, they will appear here.
          </div>
        )}
        {pendingMissions.map((mission) => (
          <article key={mission.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#f8f6ed] p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">
                <b>{props.childProfiles.find((child) => child.id === mission.completedBy)?.name}</b> completed {mission.title}. Note: {mission.note}. Approval adds {mission.coins} reward coins
                {mission.allowanceDollars ? ` and $${mission.allowanceDollars} allowance.` : " and no allowance dollars."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">Parent approval creates value evidence</span>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => props.approveMission(mission.id)} className="min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white">Approve</button>
              <button onClick={() => props.rejectMission(mission.id)} className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-black text-[#7a2c2c]">Send back</button>
            </div>
          </article>
        ))}
        {pendingTransactions.map((tx) => (
          <article key={tx.id} className="flex flex-col justify-between gap-3 rounded-lg bg-[#fff4d8] p-4 sm:flex-row sm:items-center">
            <p className="font-semibold"><b>{props.childProfiles.find((child) => child.id === tx.childId)?.name}</b> requested {tx.category} ${tx.amount}: {tx.description}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => props.approveTransaction(tx.id)} className="min-h-11 rounded-lg bg-[#165a4b] px-5 py-2 text-sm font-black text-white">Approve</button>
              <button onClick={() => props.rejectTransaction(tx.id)} className="min-h-11 rounded-lg bg-white px-5 py-2 text-sm font-black text-[#7a2c2c]">Decline</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MissionAssignmentPanel(props: {
  missions: Mission[];
  childProfiles: Child[];
  badges: BadgeAward[];
  assignMission: (missionId: string, childId: string) => void;
  autoBalanceMissions: () => void;
}) {
  const plannedPoints = props.childProfiles.map((child) => ({
    child,
    points: props.missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sortedPoints = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sortedPoints[0];
  const highest = sortedPoints[sortedPoints.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  const familySkillSummary = getFamilySkillSummary(props.badges, props.childProfiles);

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Fair mission assignment</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">One owner per task, balanced points</h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">
        Kids only see missions assigned to their profile. Harder work is worth more, and auto-balance prefers age-fit tasks before evening out points.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button onClick={props.autoBalanceMissions} className="min-h-11 rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white">
          Auto balance tasks
        </button>
        <span className="inline-flex min-h-11 items-center rounded-lg bg-[#eef2ff] px-4 py-2 text-sm font-black text-[#1d4ed8]">
          Harder tasks automatically carry more points
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-[#e7f4ef] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Fairness engine</p>
          <p className="mt-2 text-lg font-black">Fairness, not first-click competition</p>
          <p className="mt-1 text-sm font-bold text-[#4f625b]">Every task has one owner, age guidance, and point balancing across kids.</p>
        </div>
        <div className="rounded-lg bg-[#f0edff] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5b21b6]">Values tracked</p>
          <p className="mt-2 text-lg font-black">{familySkillSummary.topLabel}</p>
          <p className="mt-1 text-sm font-bold text-[#5f4b8b]">Badges become parent-visible proof of growth, not just stickers.</p>
        </div>
        <div className="rounded-lg bg-[#fff4d8] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Current spread</p>
          <p className="mt-2 text-lg font-black">{spread} planned points</p>
          <p className="mt-1 text-sm font-bold text-[#6f5c31]">Keep kids near the same total while harder work still earns more.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {plannedPoints.map(({ child, points }) => (
          <div key={child.id} className="rounded-lg bg-[#f8f6ed] p-4">
            <p className="text-lg font-black">{child.name}</p>
            <p className="mt-1 text-sm font-bold text-[#5f6a65]">Age {child.age} • {points} planned points today</p>
          </div>
        ))}
      </div>
      <p className={`mt-3 rounded-lg p-3 text-sm font-black ${spread <= 8 ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-[#fff4d8] text-[#7a4b12]"}`}>
        {spread <= 8
          ? "Looks balanced. Kids should finish with similar points if they complete their assignments."
          : `${highest?.child.name ?? "One kid"} has ${spread} more planned points than ${lowest?.child.name ?? "another kid"}. Move one mission to rebalance.`}
      </p>
      <div className="mt-4 grid gap-3">
        {props.missions.map((mission) => (
          <article key={mission.id} className="grid gap-3 rounded-lg border border-[#e8e1cf] bg-[#fbfaf4] p-4 md:grid-cols-[1fr_190px] md:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black">{levelLabels[mission.difficulty]}</span>
                <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#1d4ed8]">{difficultyAgeGuidance[mission.difficulty].label}</span>
                <span className="rounded-full bg-[#fff4d8] px-3 py-1 text-xs font-black">+{mission.points} pts</span>
                <span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(getMissionLifeSkill(mission))}</span>
                {mission.status === "approved" && <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">Approved</span>}
              </div>
              <h3 className="mt-2 text-lg font-black">{mission.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{mission.question}</p>
              <p className="mt-2 text-xs font-black text-[#6f5c31]">{getAgeFitCopy(mission, props.childProfiles.find((child) => child.id === mission.assignedChildId))}</p>
            </div>
            <label className="text-sm font-black text-[#25352f]">
              Assigned kid
              <select
                value={mission.assignedChildId ?? props.childProfiles[0]?.id ?? ""}
                onChange={(event) => props.assignMission(mission.id, event.target.value)}
                disabled={mission.status === "approved"}
                className="mt-2 min-h-11 w-full rounded-lg border border-[#ded8c7] bg-white px-3 py-2 font-bold disabled:bg-[#ede8db]"
              >
                {props.childProfiles.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnterpriseReadinessPanel() {
  const checks = [
    ["Child privacy", "Kids are not searchable, and community actions stay parent-led."],
    ["Reward governance", "Points, dollars, badges, and giving requests require parent approval."],
    ["Life-skills evidence", "Badges roll up into responsibility, empathy, teamwork, leadership, and time management."],
    ["Deployment path", "PWA-ready for phone, tablet, and home hub screens before native app investment."],
  ];

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Family safety model</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Parent-controlled, kid-simple, values-measurable</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map(([title, body]) => (
          <article key={title} className="rounded-lg bg-white/10 p-4">
            <p className="text-base font-black">{title}</p>
            <p className="mt-2 text-sm font-semibold leading-5 text-white/75">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FamilySetupPanel(props: {
  cloudAccountEmail: string;
  accountDraft: { email: string };
  setAccountDraft: (value: { email: string }) => void;
  accountStatus: "idle" | "saving" | "loading" | "error" | "saved";
  accountMessage: string;
  sendParentSignInLink: () => void;
  magicLinkSent: boolean;
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
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              value={props.accountDraft.email}
              onChange={(event) => props.setAccountDraft({ email: event.target.value })}
              className="min-h-12 rounded-lg border border-[#c9d8f8] px-4 py-3 font-semibold"
              inputMode="email"
              placeholder="Parent email"
              type="email"
              aria-label="Parent email"
            />
            <button onClick={props.sendParentSignInLink} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {props.accountStatus === "loading" ? "Sending..." : "Email me a sign-in link"}
            </button>
          </div>
        )}

        {!props.cloudAccountEmail && props.magicLinkSent && (
          <div className="mt-3 rounded-lg bg-[#e7f4ef] px-4 py-3 text-sm font-bold text-[#165a4b]">
            Check your email — tap the sign-in link to finish signing in. The link expires in about an hour.
          </div>
        )}

        {isSupabaseConfigured && props.cloudAccountEmail && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={props.saveCurrentFamilyAccount} disabled={props.accountStatus === "saving"} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {props.accountStatus === "saving" ? "Saving..." : "Save to parent account"}
            </button>
            <button onClick={props.loadCurrentFamilyAccount} disabled={props.accountStatus === "loading"} className="min-h-12 rounded-lg border border-[#c9d8f8] bg-white px-5 py-3 text-sm font-black text-[#1f3b7a] disabled:opacity-60">
              Load from parent account
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

function GrowthPanel(props: {
  childProfiles: Child[];
  badges: BadgeAward[];
  moments: MemoryMoment[];
  momentDraft: string;
  setMomentDraft: (value: string) => void;
  addMoment: () => void;
}) {
  return (
    <section className="rounded-lg border border-[#ded8c7] bg-white p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Character growth</p>
      <h2 className="mt-2 text-3xl font-black">Responsibility, empathy, kindness, leadership</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {props.childProfiles.map((child) => (
          <div key={child.id} className="rounded-lg bg-[#f8f6ed] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ProfilePhoto label={child.name} initial={getChildLook(child.id).initial} colors={getChildLook(child.id).colors} variant="kid" hair={getChildLook(child.id).hair} photoUrl={child.photoUrl} />
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
            <div className="mt-4 grid gap-2">
              {(["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => {
                const count = props.badges.filter((badge) => badge.childId === child.id && badge.skill === skill).length;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-xs font-black capitalize">
                      <span>{skill === "time" ? "Time management" : skill}</span>
                      <span>{count} badge{count === 1 ? "" : "s"}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-[#7c3aed]" style={{ width: `${Math.min(100, count * 25)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {props.badges.filter((badge) => badge.childId === child.id).slice(0, 3).map((badge) => (
                <p key={badge.id} className="rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">
                  <b className="block text-sm text-[#17231f]">{badge.title}</b>
                  {badge.note}
                </p>
              ))}
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

function NeighborhoodPanel({
  goals,
  childProfiles,
  activeChild,
  role,
  jobs,
  jobDraft,
  setJobDraft,
  postJob,
  acceptJob,
  approveJob,
  toggleJobVisibility,
}: {
  goals: SavingsGoal[];
  childProfiles: Child[];
  activeChild?: Child;
  role: Role;
  jobs: NeighborhoodJob[];
  jobDraft: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string };
  setJobDraft: (value: { title: string; family: string; pet: string; time: string; rewardDollars: string; badgeTitle: string; safety: string }) => void;
  postJob: () => void;
  acceptJob: (jobId: string) => void;
  approveJob: (jobId: string) => void;
  toggleJobVisibility: (jobId: string) => void;
}) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies);
  const visibleJobs =
    role === "parent"
      ? jobs
      : jobs.filter((job) => job.visibleToKids && activeChild && job.assignedChildIds.includes(activeChild.id) && activeChild.age >= (job.minAge ?? 0));
  const skillJobTemplates = [
    ["Responsibility", "Morning pet check for a trusted neighbor", "Easy checklist, parent photo proof, 10-14 points"],
    ["Empathy", "Make a comfort card for a newly adopted pet", "Kindness badge, no money needed"],
    ["Teamwork", "Two-kid supply sorting task with parent", "Split points fairly, one shared family badge"],
    ["Leadership", "Older kid teaches a younger kid safe pet observation", "Higher points, parent nearby"],
  ];
  const privacyRules = [
    "Parents approve every job before it appears to kids.",
    "Kids do not see addresses, phone numbers, or adult contact details.",
    "Applications show parent names and family intent first, not public child profiles.",
    "Completion proof goes to parents only before money, points, or badges are awarded.",
  ];
  const shelterPrograms = [
    ["Shelter reading buddy", "Kids read calmly near adoptable pets while staff and parents supervise.", "Empathy badge"],
    ["Donation helper", "Families collect towels, food, or toys and log the kindness mission.", "Community Kindness badge"],
    ["Adoption learning day", "Parent-approved shelter visit teaches pet needs before adoption.", "Responsible Pet Friend badge"],
    ["Junior volunteer quest", "Age-fit volunteer tasks from a partner shelter, always parent-confirmed.", "Helping Hands badge"],
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet jobs and safe playdates</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Parents post and approve every detail before kids can see anything. Kids only see parent-approved helper jobs, simple checklists, and rewards that teach responsibility, empathy, teamwork, leadership, and time management.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parent posts job",
          "Parent approves visibility for kids",
          "Kid confirms with their profile",
          "Parent makes it final and rewards after completion",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#25352f]">{step}</p>
          </div>
        ))}
      </div>

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Post a job</p>
          <h3 className="mt-2 text-2xl font-black">Create a parent-screened helper mission</h3>
          <p className="mt-2 text-sm font-semibold text-[#5f6a65]">New jobs stay hidden from kids until a parent explicitly approves them for kid view below.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} placeholder="Job title" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.family} onChange={(event) => setJobDraft({ ...jobDraft, family: event.target.value })} placeholder="Family" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.pet} onChange={(event) => setJobDraft({ ...jobDraft, pet: event.target.value })} placeholder="Pet" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.time} onChange={(event) => setJobDraft({ ...jobDraft, time: event.target.value })} placeholder="Time" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.rewardDollars} onChange={(event) => setJobDraft({ ...jobDraft, rewardDollars: event.target.value })} inputMode="numeric" placeholder="$ reward" />
            <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.badgeTitle} onChange={(event) => setJobDraft({ ...jobDraft, badgeTitle: event.target.value })} placeholder="Badge" />
          </div>
          <textarea className="mt-3 min-h-20 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={jobDraft.safety} onChange={(event) => setJobDraft({ ...jobDraft, safety: event.target.value })} placeholder="Safety note" />
          <button onClick={postJob} className="mt-3 min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">Save for parent review</button>
        </section>
      )}

      {role === "parent" && (
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Skill job builder</p>
          <h3 className="mt-2 text-2xl font-black">Post a job around the life skill you want to teach</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
            Parents can start from a value, not just a task. TailTots can suggest checklist, points, money, and badge language before anything is visible to kids or neighbors.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            {skillJobTemplates.map(([skill, title, detail]) => (
              <article key={skill} className="rounded-lg bg-[#f0edff] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#5b21b6]">{skill}</p>
                <p className="mt-2 text-base font-black leading-5">{title}</p>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#5f6a65]">{detail}</p>
                <button className="mt-3 min-h-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#33245f]">Use template</button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">{role === "parent" ? "Job pipeline" : "Jobs for you"}</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Kid confirmations waiting for final approval" : "Confirm a job, then wait for grown-up approval"}</h3>
        <div className="mt-4 grid gap-3">
          {visibleJobs.map((job) => {
            const acceptedChild = childProfiles.find((child) => child.id === job.acceptedBy);
            const skill = job.skillFocus ?? "teamwork";
            return (
              <article key={job.id} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{job.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{job.family} - {job.pet} - {job.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{job.rewardDollars ? `$${job.rewardDollars} allowance` : job.badgeTitle}</p>
                    {acceptedChild && <p className="mt-1 text-xs font-black text-[#165a4b]">Accepted by {acceptedChild.name}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#5b21b6]">{getLifeSkillLabel(skill)}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#1d4ed8]">Age {job.minAge ?? 4}+</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{job.status}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${job.visibleToKids ? "bg-[#e7f4ef] text-[#165a4b]" : "bg-white text-[#7a2c2c]"}`}>
                      {job.visibleToKids ? "Parent approved for kids" : "Hidden until parent approves"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#25352f]">
                      {job.checklist.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#25352f]">{job.safety}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(job.trustSignals ?? ["parent_gate", "private_child"]).map((signal) => (
                    <span key={signal} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">
                      {getTrustSignalLabel(signal)}
                    </span>
                  ))}
                </div>
                {role === "child" && job.status === "posted" && (
                  <button onClick={() => acceptJob(job.id)} className="mt-3 min-h-12 w-full rounded-lg bg-[#f47b20] px-4 py-2 text-sm font-black text-white">Confirm I want this job</button>
                )}
                {role === "child" && job.status !== "posted" && (
                  <p className="mt-3 rounded-lg bg-white p-3 text-sm font-black text-[#5f6a65]">{job.status === "accepted" ? "Waiting for a parent to make it final." : job.status === "approved" ? "Added to Today. Money goes to Kid Bank after parent approves completion." : "Completed and paid if this job had allowance."}</p>
                )}
                {role === "parent" && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[auto_auto_1fr]">
                    <button
                      onClick={() => toggleJobVisibility(job.id)}
                      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-black ${job.visibleToKids ? "bg-white text-[#7a2c2c]" : "bg-[#2563eb] text-white"}`}
                    >
                      {job.visibleToKids ? "Remove kid visibility" : "Approve for kids to see"}
                    </button>
                    <button onClick={() => approveJob(job.id)} disabled={job.status !== "accepted"} className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:bg-[#b9b2a2]">Make final and add to Today</button>
                    <p className="rounded-lg bg-white p-3 text-xs font-bold text-[#5f6a65]">Allowed kids: {job.assignedChildIds.map((id) => childProfiles.find((child) => child.id === id)?.name).filter(Boolean).join(", ")}</p>
                  </div>
                )}
              </article>
            );
          })}
          {!visibleJobs.length && <p className="rounded-lg bg-[#f8f6ed] p-4 text-sm font-semibold text-[#5f6a65]">No parent-approved jobs are available yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Privacy and trust</p>
        <h3 className="mt-2 text-2xl font-black">{role === "parent" ? "Why families can safely apply for jobs" : "What kids do not see"}</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {privacyRules.map((rule) => (
            <p key={rule} className="rounded-lg bg-[#e7f4ef] p-4 text-sm font-black leading-5 text-[#165a4b]">{rule}</p>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Shelters and adoption</p>
        <h3 className="mt-2 text-2xl font-black">Partner with shelters for adoption learning and volunteer badges</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          TailTots can let animal shelters post parent-approved learning missions, adoption-readiness visits, donation drives, and supervised volunteer opportunities for families in the network.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {shelterPrograms.map(([title, detail, badge]) => (
            <article key={title} className="rounded-lg bg-[#fff4d8] p-4">
              <p className="text-base font-black leading-5">{title}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5f6a65]">{detail}</p>
              <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{badge}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Family-supported goals</p>
        <h3 className="mt-2 text-2xl font-black">Trusted families can help a cause</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Parent-shared by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

function LegacyNeighborhoodPanel({ goals, childProfiles }: { goals: SavingsGoal[]; childProfiles: Child[] }) {
  const sharedGoals = goals.filter((goal) => goal.sharedWithTrustedFamilies);
  const trustedFamilies = [
    { name: "Patel family", pets: "Milo the rabbit", match: "Small pet care, after school", status: "Parent-approved" },
    { name: "Garcia family", pets: "Sunny the parakeet", match: "Bird care, weekend mornings", status: "Meet-and-greet" },
  ];
  const sittingRequests = [
    {
      title: "Care visit for Milo",
      family: "Patel family",
      pet: "Milo the rabbit",
      time: "Tuesday, 4:30 PM",
      reward: "$4 allowance",
      status: "Parent checklist needed",
      steps: ["Refill hay", "Check water bottle", "Send parent photo"],
      safety: "Parent stays nearby; no cage cleaning yet.",
    },
    {
      title: "Morning check for Sunny",
      family: "Garcia family",
      pet: "Sunny the parakeet",
      time: "Saturday morning",
      reward: "Kindness badge",
      status: "Needs meet-and-greet",
      steps: ["Look at water cup", "Check food level", "Tell parent if cage looks messy"],
      safety: "No handling the bird; adult opens cage only.",
    },
  ];
  const helperJobs = [
    { title: "Lawn mowing helper", family: "Patel family", time: "Friday, 5:00 PM", reward: "$12 allowance", safety: "Parent checks mower safety and stays reachable." },
    { title: "Bring bins to curb", family: "Garcia family", time: "Monday evening", reward: "$3 allowance", safety: "Stay on driveway; parent confirms address first." },
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Neighborhood</p>
        <h2 className="mt-2 text-3xl font-black">Parent-led pet friends and helper requests</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Kids do not browse or message other kids. Parents discover nearby pet families, compare pets and schedules, then decide whether a playdate, shared care task, or pet-sitting request is safe to show.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        {[
          "Parents match by pet type, distance, and availability",
          "Parents chat and schedule first",
          "Kids only see approved date or helper task",
          "Parent closes the loop with pickup, reward, and notes",
        ].map((step, index) => (
          <div key={step} className="rounded-lg bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#165a4b]">Step {index + 1}</p>
            <p className="mt-2 text-sm font-bold leading-5 text-[#25352f]">{step}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Family matching</p>
          <h3 className="mt-2 text-2xl font-black">Pet families parents can review</h3>
          <div className="mt-4 grid gap-3">
            {trustedFamilies.map((family) => (
              <article key={family.name} className="rounded-lg bg-[#f8f6ed] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{family.name}</p>
                    <p className="text-sm font-semibold text-[#5f6a65]">{family.pets}</p>
                    <p className="mt-1 text-xs font-bold text-[#69736f]">{family.match}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">{family.status}</span>
                </div>
              </article>
            ))}
          </div>
          <button className="mt-4 min-h-12 rounded-lg bg-[#17231f] px-5 py-3 text-sm font-black text-white">
            Review pet family match
          </button>
        </div>

        <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Parent calendar</p>
          <h3 className="mt-2 text-2xl font-black">Pet care requests before kids see them</h3>
          <div className="mt-4 grid gap-3">
            {sittingRequests.map((request) => (
              <article key={request.title} className="rounded-lg bg-[#fff4d8] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-lg font-black">{request.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{request.family} - {request.pet} - {request.time}</p>
                    <p className="mt-1 text-sm font-black text-[#7a4b12]">{request.reward}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#7a4b12]">{request.status}</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#165a4b]">Kid checklist</p>
                    <ul className="mt-2 grid gap-1 text-sm font-semibold text-[#25352f]">
                      {request.steps.map((step) => <li key={step}>{step}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7a4b12]">Safety note</p>
                    <p className="mt-2 text-sm font-semibold text-[#25352f]">{request.safety}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Create kid care mission</button>
                  <button className="min-h-11 rounded-lg border border-[#d7caa9] bg-white px-4 py-2 text-sm font-black">Confirm adult details</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Family-supported goals</p>
        <h3 className="mt-2 text-2xl font-black">Trusted families can help a cause</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          Parents can expose selected goals to trusted families so a neighbor can support the purpose, like pet enrichment or care supplies. The child is not publicly searchable, and parents control who sees it.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {sharedGoals.map((goal) => {
            const child = childProfiles.find((item) => item.id === goal.childId);
            const percent = Math.min(100, (goal.saved / goal.target) * 100);
            return (
              <article key={goal.id} className="rounded-lg bg-[#e7f4ef] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{goal.title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{goal.causeNote}</p>
                    <p className="mt-1 text-xs font-bold text-[#165a4b]">Parent-shared by {child?.name ?? "family"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">${goal.saved}/${goal.target}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white">
                  <div className="h-3 rounded-full bg-[#0f766e]" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white">Offer support</button>
                  <button className="min-h-11 rounded-lg border border-[#b7d9cc] bg-white px-4 py-2 text-sm font-black">Message parent</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Pet-sitting and helper workflow</p>
        <h3 className="mt-2 text-2xl font-black">What a parent must approve</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Pet needs", "Food, water, medicine, handling limits, and what not to do."],
            ["Job details", "Address, parent contact, time window, tools, pickup/dropoff, and emergency backup."],
            ["Kid mission", "A simple checklist with proof photo or parent note."],
            ["Reward", "Allowance dollars for jobs, reward coins for app progress, or kindness badges for favors."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#f8f6ed] p-4">
              <h4 className="font-black">{title}</h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Neighborhood helper jobs</p>
        <h3 className="mt-2 text-2xl font-black">Parent-approved ways kids can earn allowance</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {helperJobs.map((job) => (
            <article key={job.title} className="rounded-lg bg-[#eef2ff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black">{job.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#5f6a65]">{job.family} - {job.time}</p>
                  <p className="mt-1 text-sm font-black text-[#1d4f91]">{job.reward}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2563eb]">Parent-led</span>
              </div>
              <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-[#25352f]">{job.safety}</p>
              <button className="mt-3 min-h-11 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-black text-white">Create helper mission</button>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#ded8c7] bg-[#e7f4ef] p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Safety rules</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">No child profiles are searchable or directly shown to other kids.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Parents lead matching, messages, dates, visit details, and adult contact.</p>
          <p className="rounded-lg bg-white p-3 text-sm font-semibold">Shared goals are opt-in and shown only to trusted families as parent-approved causes.</p>
        </div>
      </div>
    </section>
  );
}

void LegacyNeighborhoodPanel;

function AIPanel({ childProfiles, missions, parentSignedIn }: { childProfiles: Child[]; missions: Mission[]; parentSignedIn: boolean }) {
  const currentUses = [
    ["Local parent tools", "TailTots now has template-powered helpers for missions, care checklists, memories, summaries, journals, and insights."],
    ["AI ideas are live for parents", "The Life Skill Chore Planner can generate activity ideas with Cloudflare Workers AI. Parents review every suggestion before it becomes a mission."],
  ];
  const [aiDraft, setAiDraft] = useState({
    petType: "Guinea pig",
    petAge: "2 years",
    routine: "Morning hay, fresh water, veggie treat, quick cage check",
    vetNotes: "Handle gently. Watch water bottle level. No loud noises near cage.",
    memoryNote: "Leo remembered RB's food before school and checked the water.",
    photoMoment: "Captain basking after fresh greens",
    lifeSkill: "responsibility",
    choreGoal: "Teach responsibility through morning pet care and one family helper task",
  });
  const smartMissions = buildSmartMissions(aiDraft.petType, aiDraft.routine);
  const lifeSkillMissions = buildLifeSkillChores(aiDraft.lifeSkill, aiDraft.choreGoal, childProfiles);
  const fairnessPlan = buildFairnessPlan(missions, childProfiles);
  const coachChecklist = buildCareChecklist(aiDraft.vetNotes);
  const memoryMoment = buildMemoryMoment(aiDraft.memoryNote);
  const passportSummary = buildPassportSummary(aiDraft.petType, aiDraft.petAge, aiDraft.routine, aiDraft.vetNotes);
  const photoJournal = buildPhotoJournal(aiDraft.photoMoment);
  const [aiIdeas, setAiIdeas] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function ageBandForAge(age: number): "4-6" | "7-9" | "10-12" {
    if (age <= 6) return "4-6";
    if (age <= 9) return "7-9";
    return "10-12";
  }

  async function getParentAccessToken(): Promise<string | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }

  async function generateAiIdeas() {
    const child = childProfiles[0];
    setAiLoading(true);
    setAiError(null);
    try {
      const accessToken = await getParentAccessToken();
      if (!accessToken) {
        setAiIdeas(null);
        setAiError("Sign in with your parent account to use the AI helper — the template ideas below still work.");
        return;
      }
      const response = await fetch("/api/ai/ideas", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          lifeSkill: aiDraft.lifeSkill,
          childFirstName: child?.name.trim().split(/\s+/)[0] ?? "your child",
          ageBand: child ? ageBandForAge(child.age) : "7-9",
        }),
      });
      const data = (await response.json()) as { ideas?: unknown };
      const ideas = Array.isArray(data.ideas)
        ? data.ideas.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [];
      if (response.ok && ideas.length > 0) {
        setAiIdeas(ideas);
      } else {
        setAiIdeas(null);
        setAiError("The AI helper is unavailable right now \u2014 showing template ideas instead.");
      }
    } catch {
      setAiIdeas(null);
      setAiError("The AI helper is unavailable right now \u2014 showing template ideas instead.");
    } finally {
      setAiLoading(false);
    }
  }
  const familyInsights = [
    "Leo has a strong helper streak when tasks are short and before school.",
    "Pet care missions are clearer when each one has one animal and one proof step.",
    "Weekend helper work should be parent-scheduled because neighborhood jobs need adult details.",
  ];
  const socialIdeas = [
    "Parent-controlled pet profiles and feeds",
    "AI caption suggestions for Jack, Jamie, Captain, and RB",
    "Weekly pet recaps and milestone cards",
    "Badges for kindness, consistency, savings, and teamwork",
    "Parent approval before anything is shared publicly",
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">AI roadmap</p>
        <h2 className="mt-2 text-3xl font-black">AI should help quietly, safely, and parent-first.</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#dce7e2]">
          TailTots should not become an open-ended chatbot for kids. AI works best here as a behind-the-scenes helper for missions, memories, care summaries, insights, and parent-approved pet social features.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">AI now</p>
          <h3 className="mt-2 text-2xl font-black">What exists today</h3>
          <div className="mt-4 grid gap-3">
            {currentUses.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#f8f6ed] p-4">
                <h4 className="font-black">{title}</h4>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Guardrails</p>
          <h3 className="mt-2 text-2xl font-black">Rules for kid-safe AI</h3>
          <ul className="mt-4 grid gap-3 text-sm font-semibold leading-5 text-[#5f6a65]">
            <li className="rounded-lg bg-[#fff4d8] p-3">Parents control AI setup, publishing, and social sharing.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Kids get simple prompts and choices, not an unrestricted AI chat.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Pet health guidance stays parent-facing and avoids diagnosis.</li>
            <li className="rounded-lg bg-[#fff4d8] p-3">Anything public needs parent approval before it leaves the family.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">AI tools</p>
        <h3 className="mt-2 text-2xl font-black">Parent-side helpers you can use now</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
                    The planner below can generate ideas with AI, or keep using the built-in templates. Nothing is
          saved until a parent chooses it.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg bg-[#eef2ff] p-4">
            <h4 className="text-lg font-black">Life Skill Chore Planner</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select className="rounded-lg border border-[#c8d2f0] px-3 py-3 text-sm font-semibold" value={aiDraft.lifeSkill} onChange={(event) => setAiDraft({ ...aiDraft, lifeSkill: event.target.value })}>
                <option value="responsibility">Responsibility</option>
                <option value="empathy">Empathy</option>
                <option value="teamwork">Teamwork</option>
                <option value="leadership">Leadership</option>
                <option value="time">Time habits</option>
              </select>
              <input className="rounded-lg border border-[#c8d2f0] px-3 py-3 text-sm font-semibold" value={aiDraft.choreGoal} onChange={(event) => setAiDraft({ ...aiDraft, choreGoal: event.target.value })} placeholder="What value should chores teach?" />
            </div>
            <button
              type="button"
              onClick={generateAiIdeas}
              disabled={aiLoading}
              className="mt-3 min-h-11 rounded-lg bg-[#17231f] px-4 py-2 text-xs font-black text-white shadow-sm disabled:opacity-50"
            >
              {aiLoading ? "Generating ideas\u2026" : "Generate with AI"}
            </button>
            {!parentSignedIn && (
              <p className="mt-2 text-xs font-semibold text-[#8a5a00]">
                AI ideas need a signed-in parent account — set one up in Family Setup, under Parent account.
              </p>
            )}
            {aiError && (
              <p className="mt-2 text-xs font-semibold text-[#8a5a00]">{aiError}</p>
            )}
            {aiIdeas && (
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#2563eb]">
                  AI-generated ideas \u2014 review before saving as a mission
                </p>
                <div className="mt-2 grid gap-2">
                  {aiIdeas.map((idea) => (
                    <p key={idea} className="rounded-lg bg-[#eef2ff] p-3 text-sm font-semibold leading-5">{idea}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {lifeSkillMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Fair Chore Distributor</h4>
            <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">Harder work earns more points, but the weekly plan aims for similar totals if everyone completes their assigned chores.</p>
            <div className="mt-3 grid gap-2">
              {fairnessPlan.map((line) => <p key={line} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{line}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#f8f6ed] p-4">
            <h4 className="text-lg font-black">Smart Mission Generator</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petType} onChange={(event) => setAiDraft({ ...aiDraft, petType: event.target.value })} placeholder="Pet type" />
              <input className="rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.petAge} onChange={(event) => setAiDraft({ ...aiDraft, petAge: event.target.value })} placeholder="Pet age" />
            </div>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.routine} onChange={(event) => setAiDraft({ ...aiDraft, routine: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {smartMissions.map((mission) => <p key={mission} className="rounded-lg bg-white p-3 text-sm font-semibold">{mission}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#f8f6ed] p-4">
            <h4 className="text-lg font-black">Pet Care Coach</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#ded8c7] px-3 py-3 text-sm font-semibold" value={aiDraft.vetNotes} onChange={(event) => setAiDraft({ ...aiDraft, vetNotes: event.target.value })} />
            <div className="mt-3 grid gap-2">
              {coachChecklist.map((item) => <p key={item} className="rounded-lg bg-white p-3 text-sm font-semibold">{item}</p>)}
            </div>
          </section>

          <section className="rounded-lg bg-[#fff4d8] p-4">
            <h4 className="text-lg font-black">Memory Moment Writer</h4>
            <textarea className="mt-3 min-h-24 w-full rounded-lg border border-[#d7caa9] px-3 py-3 text-sm font-semibold" value={aiDraft.memoryNote} onChange={(event) => setAiDraft({ ...aiDraft, memoryNote: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{memoryMoment}</p>
          </section>

          <section className="rounded-lg bg-[#e7f4ef] p-4">
            <h4 className="text-lg font-black">Pet Passport Summary</h4>
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{passportSummary}</p>
            <h4 className="mt-4 text-lg font-black">Photo Pet Journal</h4>
            <input className="mt-3 w-full rounded-lg border border-[#b7d9cc] px-3 py-3 text-sm font-semibold" value={aiDraft.photoMoment} onChange={(event) => setAiDraft({ ...aiDraft, photoMoment: event.target.value })} />
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold leading-6">{photoJournal}</p>
          </section>
        </div>

        <section className="mt-4 rounded-lg bg-[#eef2ff] p-4">
          <h4 className="text-lg font-black">Family Insights</h4>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {familyInsights.map((insight) => <p key={insight} className="rounded-lg bg-white p-3 text-sm font-semibold leading-5">{insight}</p>)}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Pet social extension</p>
        <h3 className="mt-2 text-2xl font-black">Future social media for pets</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#5f6a65]">
          A future TailTots social layer could let each pet have a parent-controlled profile, with kids contributing moments and AI helping turn care wins into safe posts, captions, badges, and weekly stories.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {socialIdeas.map((idea) => (
            <div key={idea} className="rounded-lg bg-[#f0edff] p-4 text-sm font-black text-[#33245f]">
              {idea}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function buildSmartMissions(petType: string, routine: string) {
  const pet = petType.trim() || "pet";
  const routineParts = routine.split(",").map((part) => part.trim()).filter(Boolean).slice(0, 3);
  const baseParts = routineParts.length ? routineParts : ["fresh food", "clean water", "comfort check"];
  return baseParts.map((part, index) => `${index + 1}. ${pet} mission: ${part}. Kid step: do it, notice one thing, then ask parent to approve.`);
}

function buildLifeSkillChores(skill: string, goal: string, childProfiles: Child[]) {
  const label = getLifeSkillLabel((skill as LifeSkillKey) || "responsibility");
  const sortedKids = [...childProfiles].sort((a, b) => a.age - b.age);
  const younger = sortedKids[0];
  const older = sortedKids[sortedKids.length - 1];
  const purpose = goal.trim() || `Teach ${label.toLowerCase()} through simple care routines`;
  return [
    `${younger?.name ?? "Younger child"}: easy mission, 10-12 points. Notice one pet need and tell a parent. Purpose: ${purpose}.`,
    `${older?.name ?? "Older child"}: medium mission, 16-20 points. Complete a care checklist and help reset supplies.`,
    "Parent rule: reward effort and completion, not speed. If one child gets harder work, add enough points so weekly totals stay close.",
    "Kid-facing wording: show helpful next steps and badges, not rankings or judgment.",
  ];
}

function buildFairnessPlan(missions: Mission[], childProfiles: Child[]) {
  if (!childProfiles.length) return ["Add children first so TailTots can balance tasks."];
  const totals = childProfiles.map((child) => {
    const assigned = missions.filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved");
    return {
      child,
      points: assigned.reduce((sum, mission) => sum + mission.points, 0),
      count: assigned.length,
    };
  });
  const max = Math.max(...totals.map((item) => item.points), 0);
  return totals.map(({ child, points, count }) => {
    const gap = max - points;
    return `${child.name}, age ${child.age}: ${count} open task${count === 1 ? "" : "s"}, ${points} planned points${gap ? `, add about ${gap} points or one easier helper task to balance` : ", balanced for this plan"}.`;
  });
}

function buildCareChecklist(notes: string) {
  const parts = notes.split(".").map((part) => part.trim()).filter(Boolean).slice(0, 4);
  const safeParts = parts.length ? parts : ["Check food", "Check water", "Use gentle hands"];
  return safeParts.map((part, index) => `${index + 1}. ${part}. Parent note: confirm before kid handles anything risky.`);
}

function buildMemoryMoment(note: string) {
  const cleanNote = note.trim() || "A kind pet care moment happened today.";
  return `Today we noticed responsibility in action: ${cleanNote} It was a small moment, but it showed care, attention, and growing confidence.`;
}

function buildPassportSummary(petType: string, petAge: string, routine: string, notes: string) {
  return `${petType || "Pet"} (${petAge || "age not set"}) needs a calm routine: ${routine || "food, water, and comfort checks"}. Parent care note: ${notes || "Keep instructions simple and confirm safety first."}`;
}

function buildPhotoJournal(moment: string) {
  const cleanMoment = moment.trim() || "A sweet pet moment";
  return `${cleanMoment}. Suggested caption: "A little care today made our pet feel safe, seen, and loved."`;
}

function ProfilePhoto({
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

function KidCharacter({
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

function PetCharacter({
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

function AnimatedFamilyCharacter({
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

function AnimatedPetBuddy({ color, delay, photoUrl, label, kind = "pet" }: { color: string; delay: string; photoUrl?: string; label?: string; kind?: PetKind }) {
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

function getMissionLifeSkill(mission: Mission): LifeSkillKey {
  if (mission.category === "kindness") return "empathy";
  if (mission.category === "community") return "teamwork";
  if (mission.category === "money") return "leadership";
  if (mission.category === "chore") return "time";
  return "responsibility";
}

function getLifeSkillLabel(skill: LifeSkillKey) {
  const labels: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility",
    empathy: "Empathy",
    teamwork: "Teamwork",
    leadership: "Leadership",
    time: "Time management",
  };
  return labels[skill];
}

function getTrustSignalLabel(signal: TrustSignalKey) {
  const labels: Record<TrustSignalKey, string> = {
    parent_gate: "Parent-gated",
    age_fit: "Age-fit",
    no_messaging: "No kid messaging",
    adult_nearby: "Adult nearby",
    private_child: "Child private",
  };
  return labels[signal];
}

function getKidMissionReason(mission: Mission, child?: Child) {
  if (!child) return "A grown-up will choose the right helper.";
  const ageCopy = isMissionAgeAppropriate(mission, child) ? "it fits your age" : "a grown-up will help because it is harder";
  const skillCopy = getLifeSkillLabel(getMissionLifeSkill(mission)).toLowerCase();
  return `${ageCopy}, it builds ${skillCopy}, and it keeps points fair with the family.`;
}

function getFairnessSummary(missions: Mission[], children: Child[]) {
  const plannedPoints = children.map((child) => ({
    child,
    points: missions
      .filter((mission) => mission.assignedChildId === child.id && mission.status !== "approved")
      .reduce((sum, mission) => sum + mission.points, 0),
  }));
  const sorted = [...plannedPoints].sort((a, b) => a.points - b.points);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  const spread = highest && lowest ? highest.points - lowest.points : 0;
  return {
    spread,
    label: spread <= 8 ? "Balanced today" : "Needs balancing",
    detail:
      spread <= 8
        ? "Kids are set up to finish with similar points."
        : `${highest?.child.name ?? "One child"} has ${spread} more planned points than ${lowest?.child.name ?? "another child"}.`,
  };
}

function getFamilySkillSummary(badges: BadgeAward[], children: Child[]) {
  const counts = (["responsibility", "empathy", "teamwork", "leadership", "time"] as LifeSkillKey[]).map((skill) => ({
    skill,
    count: badges.filter((badge) => badge.skill === skill && children.some((child) => child.id === badge.childId)).length,
  }));
  const top = [...counts].sort((a, b) => b.count - a.count)[0];
  return {
    topSkill: top?.skill ?? "responsibility",
    topLabel: top?.count ? getLifeSkillLabel(top.skill) : "First value badge ready",
    totalBadges: counts.reduce((sum, item) => sum + item.count, 0),
  };
}

function getBadgeTitle(skill: LifeSkillKey) {
  const titles: Record<LifeSkillKey, string> = {
    responsibility: "Responsibility Star",
    empathy: "Kind Heart",
    teamwork: "Team Helper",
    leadership: "Junior Leader",
    time: "On-Time Helper",
  };
  return titles[skill];
}
