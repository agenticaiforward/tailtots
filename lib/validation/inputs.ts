/**
 * Zod schemas for parent-facing input forms (launch list, feedback, auth).
 */
import { z } from "zod";

const emailSchema = z.string().trim().email("Enter a valid email address.").max(254);

export const launchInterestSchema = z.object({
  email: emailSchema.transform((value) => value.toLowerCase()),
  city: z
    .string()
    .trim()
    .max(128)
    .optional()
    .transform((value) => value || null),
  source: z.string().trim().max(64).default("tailtots-app"),
});

export type LaunchInterestInput = z.infer<typeof launchInterestSchema>;

export const feedbackSchema = z.object({
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Enter a valid email address, or leave email blank.",
    }),
  message: z.string().trim().min(8, "Write a short question or feedback note first.").max(4000),
  source: z.string().trim().max(64).default("tailtots-website"),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const parentAuthSchema = z.object({
  email: emailSchema.transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(128),
});

export type ParentAuthInput = z.infer<typeof parentAuthSchema>;
