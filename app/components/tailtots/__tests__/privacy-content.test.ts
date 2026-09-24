import { readFileSync } from "node:fs";
// vitest is the project's test runner (not a declared dependency yet);
// this import resolves when the suite is executed.
import { describe, expect, it } from "vitest";

// The privacy policy is shared JSX rendered by the /privacy route and the
// in-app privacy overlay. These tests read its source as text so the required
// disclosures can be verified without rendering React or hitting any network.
const source = readFileSync(new URL("../PrivacyPolicyContent.tsx", import.meta.url), "utf8");
// JSX wraps copy across lines, so collapse whitespace before matching phrases.
const text = source.replace(/\s+/g, " ");

describe("PrivacyPolicyContent required disclosures", () => {
  it("describes the parent-side Supabase backend", () => {
    expect(text).toContain("Supabase");
    expect(text).toContain("magic link");
    expect(text).toContain("parent account");
  });

  it("discloses family data isolation via row-level security", () => {
    expect(text).toMatch(/row-level security/i);
    expect(text).toMatch(/one family/i);
  });

  it("keeps the kids' side on-device only", () => {
    expect(text).toMatch(/kids/i);
    expect(text).toContain("only on your device");
    expect(text).toContain("no cloud sync");
  });

  it("keeps all four required pet-language points", () => {
    expect(text).toContain("never a prize");
    expect(text).toContain("does not guarantee adoption");
    expect(text).toContain("Parents make the final decision");
    expect(text).toContain("does not replace shelter screening");
  });

  it("keeps the Cloudflare Workers AI disclosure and the effective date", () => {
    expect(text).toContain("Cloudflare Workers AI");
    expect(text).toContain("September 24, 2026");
  });

  it("no longer claims there is no backend", () => {
    expect(text).not.toContain("there are none connected in this build");
    expect(text).not.toContain("If a future version connects a secure family account backend");
  });
});
