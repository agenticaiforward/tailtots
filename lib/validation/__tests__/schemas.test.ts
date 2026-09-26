import { describe, expect, it } from "vitest";
import { safeParseFamilyState } from "@/lib/validation/family";
import { feedbackSchema, launchInterestSchema, parentAuthSchema } from "@/lib/validation/inputs";
import { approvalDecisionSchema, bankMoveSchema, missionWriteSchema, savingsGoalWriteSchema } from "@/lib/validation/writes";
import { safeParseAlexaEvent } from "@/lib/validation/alexa";

describe("safeParseFamilyState", () => {
  it("accepts a minimal valid snapshot and fills defaults", () => {
    const result = safeParseFamilyState({ children: [], pets: [] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.missions).toEqual([]);
      expect(result.state.readinessSignOffs).toEqual([]);
    }
  });

  it("accepts a full realistic snapshot", () => {
    const result = safeParseFamilyState({
      familyName: "Crew",
      parents: [{ id: "p1", name: "Parent" }],
      children: [
        { id: "c1", name: "Kid", age: 8, secretCode: "", points: 10, coins: 2, level: "easy", streakDays: 3 },
      ],
      pets: [],
      missions: [
        {
          id: "m1",
          title: "Feed",
          category: "pet_care",
          difficulty: "easy",
          points: 10,
          coins: 1,
          question: "Done?",
          status: "pending",
        },
      ],
      readinessSignOffs: [{ milestoneId: "care-rhythm", childId: "c1", signedAt: "today" }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects garbage, hostile shapes, and out-of-range values", () => {
    expect(safeParseFamilyState(null).ok).toBe(false);
    expect(safeParseFamilyState("nope").ok).toBe(false);
    expect(safeParseFamilyState({ children: "oops" }).ok).toBe(false);
    expect(
      safeParseFamilyState({ children: [{ id: "c1", name: "K", age: 99, secretCode: "", points: -5 }] }).ok,
    ).toBe(false);
    const bad = safeParseFamilyState({ children: [{ id: "c1" }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.length).toBeGreaterThan(0);
  });

  it("strips unknown keys instead of failing", () => {
    const result = safeParseFamilyState({ children: [], __proto__: { polluted: true }, extra: "x" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.state as Record<string, unknown>).extra).toBeUndefined();
    }
  });

  it("keeps neighborhood groups and job group tags on round-trip", () => {
    const result = safeParseFamilyState({
      children: [],
      pets: [],
      neighborhoodGroups: [
        { id: "g1", name: "Maple Street crew", note: "Near the park", inviteCode: "ABC123", memberNames: ["Crew"], createdAt: "2026-09-26" },
      ],
      neighborhoodJobs: [
        { id: "j1", title: "Pet sit", family: "Smiths", pet: "Rex", groupId: "g1" },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.neighborhoodGroups).toHaveLength(1);
      expect(result.state.neighborhoodGroups?.[0]?.inviteCode).toBe("ABC123");
      expect(result.state.neighborhoodJobs?.[0]?.groupId).toBe("g1");
    }
  });

  it("rejects oversized or malformed group fields", () => {
    expect(safeParseFamilyState({ children: [], pets: [], neighborhoodGroups: [{ id: "g1", name: "", inviteCode: "X" }] }).ok).toBe(false);
    expect(safeParseFamilyState({ children: [], pets: [], neighborhoodGroups: [{ id: "g1", name: "ok", inviteCode: "x".repeat(100) }] }).ok).toBe(false);
  });
});

describe("launchInterestSchema", () => {
  it("normalizes email and defaults the source", () => {
    const parsed = launchInterestSchema.safeParse({ email: "Parent@Example.COM" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("parent@example.com");
      expect(parsed.data.source).toBe("tailtots-app");
      expect(parsed.data.city).toBeNull();
    }
  });

  it("rejects bad emails", () => {
    expect(launchInterestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(launchInterestSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("feedbackSchema", () => {
  it("allows blank email but requires a real message", () => {
    const parsed = feedbackSchema.safeParse({ message: "Loved the demo!" });
    expect(parsed.success).toBe(true);
    expect(feedbackSchema.safeParse({ message: "short" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ email: "bad", message: "A long enough message here" }).success).toBe(false);
  });
});

describe("parentAuthSchema", () => {
  it("requires a valid email and an 8+ character password", () => {
    expect(parentAuthSchema.safeParse({ email: "a@b.co", password: "secret12" }).success).toBe(true);
    expect(parentAuthSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
    expect(parentAuthSchema.safeParse({ email: "bad", password: "secret12" }).success).toBe(false);
  });
});

describe("write schemas", () => {
  it("validates mission writes", () => {
    expect(
      missionWriteSchema.safeParse({ title: "Feed", category: "pet_care", difficulty: "easy", points: 10 }).success,
    ).toBe(true);
    expect(
      missionWriteSchema.safeParse({ title: "", category: "pet_care", difficulty: "easy", points: 10 }).success,
    ).toBe(false);
    expect(
      missionWriteSchema.safeParse({ title: "Feed", category: "weird", difficulty: "easy", points: 10 }).success,
    ).toBe(false);
  });

  it("validates bank moves", () => {
    expect(
      bankMoveSchema.safeParse({ childId: "c1", category: "save", amount: 3, description: "Save up" }).success,
    ).toBe(true);
    expect(bankMoveSchema.safeParse({ childId: "c1", category: "save", amount: 0, description: "x" }).success).toBe(false);
    expect(bankMoveSchema.safeParse({ childId: "c1", category: "steal", amount: 3, description: "x" }).success).toBe(
      false,
    );
  });

  it("validates approval decisions and savings goals", () => {
    expect(approvalDecisionSchema.safeParse({ targetId: "t1", decision: "approved" }).success).toBe(true);
    expect(approvalDecisionSchema.safeParse({ targetId: "t1", decision: "maybe" }).success).toBe(false);
    expect(
      savingsGoalWriteSchema.safeParse({ childId: "c1", title: "Bike", target: 50, type: "toy" }).success,
    ).toBe(true);
    expect(savingsGoalWriteSchema.safeParse({ childId: "c1", title: "Bike", target: 0, type: "toy" }).success).toBe(
      false,
    );
  });
});

describe("safeParseAlexaEvent", () => {
  it("accepts launch and intent requests", () => {
    expect(safeParseAlexaEvent({ request: { type: "LaunchRequest" } }).ok).toBe(true);
    const intent = safeParseAlexaEvent({ request: { type: "IntentRequest", intent: { name: "PetCheckIntent" } } });
    expect(intent.ok).toBe(true);
    if (intent.ok) expect(intent.event.request.intent?.name).toBe("PetCheckIntent");
  });

  it("rejects malformed events", () => {
    expect(safeParseAlexaEvent(null).ok).toBe(false);
    expect(safeParseAlexaEvent({}).ok).toBe(false);
    expect(safeParseAlexaEvent({ request: { type: "IntentRequest" } }).ok).toBe(false);
    expect(safeParseAlexaEvent({ request: { type: "IntentRequest", intent: { name: "" } } }).ok).toBe(false);
  });
});
