import type { Area } from "react-easy-crop";
import type {
  BankTransaction,
  Child,
  MemoryMoment,
  Mission,
  Pet,
  SavingsGoal,
} from "@/lib/types";
export type ParentProfile = {
  id: string;
  name: string;
  photoUrl?: string;
};

export type PhotoCropDraft = {
  targetType: "parent" | "child" | "pet";
  targetId: string;
  label: string;
  imageUrl: string;
  fit: "cover" | "contain";
  crop: { x: number; y: number };
  zoom: number;
  croppedAreaPixels?: Area;
};

export type PhotoCropTarget = Pick<PhotoCropDraft, "targetType" | "targetId" | "label" | "fit">;
export type PetKind = "dog" | "guinea" | "tortoise" | "fish" | "pet";
export type LifeSkillKey = "responsibility" | "empathy" | "teamwork" | "leadership" | "time";
export type TrustSignalKey = "parent_gate" | "age_fit" | "no_messaging" | "adult_nearby" | "private_child";

export type BadgeAward = {
  id: string;
  childId: string;
  title: string;
  skill: LifeSkillKey;
  note: string;
  awardedAt: string;
};

export type NeighborhoodJob = {
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
  groupId?: string;
};

export type NeighborhoodGroup = {
  id: string;
  name: string;
  note: string;
  inviteCode: string;
  memberNames: string[];
  createdAt: string;
};

export type KidScheduleItem = {
  id: string;
  childId: string;
  day: string;
  time: string;
  title: string;
  kind: "pet" | "school" | "family" | "hobby";
  note: string;
};

export type SavedFamilyState = {
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
  neighborhoodGroups?: NeighborhoodGroup[];
  moments?: MemoryMoment[];
  familyPhotoUrl?: string;
  activeChildId?: string;
  readinessSignOffs?: ReadinessSignOff[];
};

export type ReadinessSignOff = {
  milestoneId: string;
  childId: string;
  signedAt: string;
};
