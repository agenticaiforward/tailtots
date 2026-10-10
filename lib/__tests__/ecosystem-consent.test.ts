import { describe, expect, it } from "vitest";
import {
  approveArtifact,
  createArtifact,
  pendingApproval,
  shareArtifact,
  visibleArtifacts,
} from "../ecosystem/artifacts";
import {
  activeGrantsForChild,
  grantConsent,
  hasConsent,
  isGrantActive,
  revokeConsent,
} from "../ecosystem/consent";
import type { ConsentGrant, EcoArtifact } from "../ecosystem/types";

const PARENT = "parent_1";
const CHILD = "child_1";
const NOW = Date.now();

function grant(
  from: "home" | "school" | "community" = "community",
  to: "home" | "school" | "community" = "home",
): ConsentGrant {
  const r = grantConsent({
    childId: CHILD,
    fromContext: from,
    toContext: to,
    grantedBy: PARENT,
    scope: ["artifacts"],
  });
  if (!r.ok) throw new Error("grant failed in test setup");
  return r.grant;
}

function approvedArtifact(): EcoArtifact {
  const c = createArtifact({
    childId: CHILD,
    context: "community",
    type: "photo",
    caption: "Maya reading to a shy cat at the shelter",
    createdBy: "org_leader_1",
    traitTags: ["patience", "kindness"],
  });
  if (!c.ok) throw new Error("create failed in test setup");
  const a = approveArtifact(c.artifact, "org_leader_1");
  if (!a.ok) throw new Error("approve failed in test setup");
  return a.artifact;
}

describe("consent — default deny", () => {
  it("denies cross-context reads with no grants", () => {
    expect(hasConsent([], CHILD, "community", "home", "artifacts", NOW)).toBe(false);
  });

  it("allows within-context reads without a grant", () => {
    expect(hasConsent([], CHILD, "home", "home", "artifacts", NOW)).toBe(true);
  });

  it("grants and checks a direction", () => {
    const g = grant("community", "home");
    expect(hasConsent([g], CHILD, "community", "home", "artifacts", NOW)).toBe(true);
    // reverse direction still denied
    expect(hasConsent([g], CHILD, "home", "community", "artifacts", NOW)).toBe(false);
  });

  it("denies when scope does not match", () => {
    const r = grantConsent({
      childId: CHILD,
      fromContext: "community",
      toContext: "home",
      grantedBy: PARENT,
      scope: ["aggregate_trends"],
    });
    if (!r.ok) throw new Error("setup failed");
    expect(hasConsent([r.grant], CHILD, "community", "home", "artifacts", NOW)).toBe(false);
    expect(hasConsent([r.grant], CHILD, "community", "home", "aggregate_trends", NOW)).toBe(true);
  });

  it("rejects same-context grants", () => {
    const r = grantConsent({
      childId: CHILD,
      fromContext: "home",
      toContext: "home",
      grantedBy: PARENT,
      scope: ["artifacts"],
    });
    expect(r.ok).toBe(false);
  });

  it("revocation is immediate and total", () => {
    const g = grant("community", "home");
    expect(hasConsent([g], CHILD, "community", "home", "artifacts", NOW)).toBe(true);
    const revoked = revokeConsent([g], g.id);
    expect(hasConsent(revoked, CHILD, "community", "home", "artifacts", NOW)).toBe(false);
    expect(isGrantActive(revoked[0], NOW)).toBe(false);
  });

  it("expired grants are inactive", () => {
    const r = grantConsent({
      childId: CHILD,
      fromContext: "community",
      toContext: "home",
      grantedBy: PARENT,
      scope: ["artifacts"],
      expiresInDays: -1, // already expired
    });
    if (!r.ok) throw new Error("setup failed");
    expect(hasConsent([r.grant], CHILD, "community", "home", "artifacts", NOW)).toBe(false);
  });

  it("activeGrantsForChild filters revoked and expired", () => {
    const g1 = grant("community", "home");
    const g2 = grant("school", "home");
    const revoked = revokeConsent([g1, g2], g1.id);
    const active = activeGrantsForChild(revoked, CHILD, NOW);
    expect(active.map((g) => g.id)).toEqual([g2.id]);
  });
});

describe("artifacts — gatekeeper + consent", () => {
  it("creates with visibleTo = [origin context] only", () => {
    const r = createArtifact({
      childId: CHILD,
      context: "school",
      type: "reflection",
      caption: "I helped a new student today",
      createdBy: "teacher_1",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.artifact.visibleTo).toEqual(["school"]);
  });

  it("rejects deficit language in captions", () => {
    const r = createArtifact({
      childId: CHILD,
      context: "home",
      type: "reflection",
      caption: "Maya was struggling and impatient today",
      createdBy: PARENT,
    });
    expect(r.ok).toBe(false);
  });

  it("blocks sharing without gatekeeper approval", () => {
    const c = createArtifact({
      childId: CHILD,
      context: "community",
      type: "photo",
      caption: "Shelter visit",
      createdBy: "org_leader_1",
    });
    if (!c.ok) throw new Error("setup failed");
    const s = shareArtifact(c.artifact, "home", [grant("community", "home")], NOW);
    expect(s.ok).toBe(false);
  });

  it("blocks sharing without consent (default deny)", () => {
    const s = shareArtifact(approvedArtifact(), "home", [], NOW);
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.error).toMatch(/consent/i);
  });

  it("shares with approval + consent", () => {
    const s = shareArtifact(approvedArtifact(), "home", [grant("community", "home")], NOW);
    expect(s.ok).toBe(true);
    if (s.ok) expect(s.artifact.visibleTo).toContain("home");
  });

  it("visibleArtifacts filters by consent even when shared", () => {
    const art = approvedArtifact();
    const g = grant("community", "home");
    const shared = shareArtifact(art, "home", [g], NOW);
    if (!shared.ok) throw new Error("setup failed");
    // consent revoked after sharing -> no longer visible
    const grants = revokeConsent([g], g.id);
    const visible = visibleArtifacts([shared.artifact], CHILD, "home", grants, NOW);
    expect(visible).toHaveLength(0);
  });

  it("within-context artifacts always visible", () => {
    const c = createArtifact({
      childId: CHILD,
      context: "home",
      type: "badge",
      caption: "Brave Try badge",
      createdBy: PARENT,
    });
    if (!c.ok) throw new Error("setup failed");
    expect(visibleArtifacts([c.artifact], CHILD, "home", [], NOW)).toHaveLength(1);
  });

  it("pendingApproval lists unapproved artifacts per context", () => {
    const c = createArtifact({
      childId: CHILD,
      context: "school",
      type: "photo",
      caption: "Class project",
      createdBy: "teacher_1",
    });
    if (!c.ok) throw new Error("setup failed");
    expect(pendingApproval([c.artifact], "school")).toHaveLength(1);
    expect(pendingApproval([c.artifact], "home")).toHaveLength(0);
  });
});
