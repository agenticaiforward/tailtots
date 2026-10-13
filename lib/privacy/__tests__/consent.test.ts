import { describe, expect, it } from "vitest";
import {
  grantConsent,
  hasConsent,
  revokeConsent,
  detectTranscriptionPath,
  transcriptionPathLabel,
  CONSENT_POLICY_VERSION,
} from "../consent";

describe("consent records", () => {
  it("starts with no consents", () => {
    expect(hasConsent({}, "voice")).toBe(false);
    expect(hasConsent(undefined, "marketing")).toBe(false);
  });

  it("grants voice consent with a timestamp and method", () => {
    const c = grantConsent({}, "voice", { method: "parent-passcode", transcriptionDisclosureShown: true });
    expect(hasConsent(c, "voice")).toBe(true);
    expect(c.voice?.method).toBe("parent-passcode");
    expect(c.voice?.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(c.voice?.transcriptionDisclosureShown).toBe(true);
    expect(typeof c.voice?.at).toBe("string");
  });

  it("keeps marketing separate from voice (never bundled)", () => {
    const c = grantConsent({}, "voice", { method: "parent-passcode" });
    // Granting voice must NOT grant marketing.
    expect(hasConsent(c, "marketing")).toBe(false);
    const c2 = grantConsent(c, "marketing", { method: "parent-passcode" });
    expect(hasConsent(c2, "marketing")).toBe(true);
    expect(hasConsent(c2, "voice")).toBe(true);
  });

  it("revokes cleanly and records the revocation", () => {
    const c = grantConsent({}, "voice", { method: "parent-passcode" });
    const r = revokeConsent(c, "voice");
    expect(hasConsent(r, "voice")).toBe(false);
    expect(r.voice?.granted).toBe(false);
  });

  it("marketing defaults to off", () => {
    const c = grantConsent(grantConsent({}, "voice", { method: "parent-passcode" }), "data-collection", {
      method: "parent-passcode",
    });
    expect(hasConsent(c, "marketing")).toBe(false);
  });
});

describe("transcription path", () => {
  it("labels the on-device path honestly", () => {
    expect(transcriptionPathLabel("on-device")).toContain("never leaves this device");
  });
  it("discloses the Google path explicitly", () => {
    const label = transcriptionPathLabel("google");
    expect(label).toContain("Google");
    expect(label).toContain("sent to Google");
  });
  it("detects a path without crashing (SSR-safe)", () => {
    expect(["on-device", "google"]).toContain(detectTranscriptionPath());
  });
});
