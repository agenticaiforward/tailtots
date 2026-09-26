/**
 * Zod schemas for write payloads: missions, Kid Bank moves, approvals,
 * savings goals. Every mutation path validates before touching storage.
 */
import { z } from "zod";

const idSchema = z.string().min(1).max(64);

export const missionWriteSchema = z.object({
  title: z.string().trim().min(1, "Give the mission a title.").max(160),
  category: z.enum(["pet_care", "chore", "kindness", "money", "community"]),
  difficulty: z.enum(["easy", "medium", "hard", "super_hard"]),
  points: z.number().int().min(0).max(1000),
  coins: z.number().int().min(0).max(1000).default(0),
  allowanceDollars: z.number().min(0).max(10000).default(0),
  assignedChildId: idSchema.optional(),
  petId: idSchema.optional(),
  question: z.string().trim().max(512).default(""),
});

export type MissionWrite = z.infer<typeof missionWriteSchema>;

export const bankMoveSchema = z.object({
  childId: idSchema,
  category: z.enum(["earn", "save", "spend", "give"]),
  amount: z.number().min(1, "Enter an amount of at least 1.").max(100000),
  description: z.string().trim().min(1, "Add a short note.").max(256),
  goalId: idSchema.optional(),
});

export type BankMove = z.infer<typeof bankMoveSchema>;

export const approvalDecisionSchema = z.object({
  targetId: idSchema,
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(512).default(""),
});

export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const savingsGoalWriteSchema = z.object({
  childId: idSchema,
  title: z.string().trim().min(1, "Name the savings goal.").max(128),
  target: z.number().min(1, "Set a target of at least 1.").max(1000000),
  type: z.enum(["toy", "pet_food", "treats", "donation", "family_reward"]),
});

export type SavingsGoalWrite = z.infer<typeof savingsGoalWriteSchema>;
