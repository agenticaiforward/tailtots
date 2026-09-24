import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      getUser: mocks.getUser,
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: mocks.upsert,
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
  }),
}));

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubGlobal("window", { location: { origin: "https://app.example" } });

const {
  isSupabaseConfigured,
  sendParentMagicLink,
  saveFamilyAccountSnapshot,
  loadFamilyAccountSnapshot,
  submitLaunchInterest,
  submitFeedback,
} = await import("../supabase");

describe("parent supabase auth wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("is configured from env vars in the test", () => {
    expect(isSupabaseConfigured).toBe(true);
  });

  describe("sendParentMagicLink", () => {
    it("calls signInWithOtp with a normalized email and the app origin redirect", async () => {
      await sendParentMagicLink("  Parent@Example.COM ");
      expect(mocks.signInWithOtp).toHaveBeenCalledWith({
        email: "parent@example.com",
        options: { emailRedirectTo: "https://app.example" },
      });
    });

    it("rejects invalid emails before touching supabase", async () => {
      await expect(sendParentMagicLink("not-an-email")).rejects.toThrow("Enter a valid parent email address.");
      expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    });

    it("surfaces supabase errors", async () => {
      mocks.signInWithOtp.mockResolvedValue({ data: {}, error: new Error("rate limited") });
      await expect(sendParentMagicLink("parent@example.com")).rejects.toThrow("rate limited");
    });
  });

  describe("family account snapshots", () => {
    it("saveFamilyAccountSnapshot throws when no user is signed in", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(saveFamilyAccountSnapshot({ familyName: "Demo" })).rejects.toThrow(
        "Sign in before saving this family account.",
      );
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

    it("loadFamilyAccountSnapshot throws when no user is signed in", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(loadFamilyAccountSnapshot()).rejects.toThrow("Sign in before loading this family account.");
      expect(mocks.maybeSingle).not.toHaveBeenCalled();
    });

    it("saveFamilyAccountSnapshot upserts under the signed-in user id", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
      await saveFamilyAccountSnapshot({ familyName: "Demo" });
      expect(mocks.upsert).toHaveBeenCalledTimes(1);
      const payload = mocks.upsert.mock.calls[0][0] as { auth_user_id: string; snapshot: unknown };
      expect(payload.auth_user_id).toBe("user-1");
      expect(payload.snapshot).toEqual({ familyName: "Demo" });
    });

    it("loadFamilyAccountSnapshot returns the stored snapshot for the signed-in user", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
      mocks.maybeSingle.mockResolvedValue({ data: { snapshot: { familyName: "Demo" } }, error: null });
      const snapshot = await loadFamilyAccountSnapshot<{ familyName: string }>();
      expect(snapshot).toEqual({ familyName: "Demo" });
    });

    it("loadFamilyAccountSnapshot returns null when nothing is stored yet", async () => {
      mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
      mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(loadFamilyAccountSnapshot()).resolves.toBeNull();
    });
  });

  describe("launch interest and feedback validation", () => {
    it("submitLaunchInterest still rejects invalid emails", async () => {
      await expect(submitLaunchInterest({ email: "bad" })).rejects.toThrow("Enter a valid parent email address.");
    });

    it("submitLaunchInterest accepts a valid email in cloud mode", async () => {
      await expect(submitLaunchInterest({ email: "Parent@Example.com", city: "Frisco" })).resolves.toEqual({
        mode: "cloud",
      });
    });

    it("submitFeedback still rejects short messages", async () => {
      await expect(submitFeedback({ message: "hi" })).rejects.toThrow("Write a short question or feedback note first.");
    });

    it("submitFeedback still rejects invalid emails", async () => {
      await expect(submitFeedback({ email: "bad", message: "A real question about TailTots." })).rejects.toThrow(
        "Enter a valid email address, or leave email blank.",
      );
    });

    it("submitFeedback accepts a message without an email in cloud mode", async () => {
      await expect(submitFeedback({ message: "A real question about TailTots." })).resolves.toEqual({ mode: "cloud" });
    });
  });
});
