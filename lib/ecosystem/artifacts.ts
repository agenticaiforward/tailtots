/**
 * TailTots Ecosystem — artifact lifecycle.
 *
 * Artifacts (photos, reflections, badges, projects) are the ONLY things that
 * cross context boundaries — never raw behavioral streams. Every crossing
 * requires:
 *   1. Gatekeeper approval (parent / teacher / org leader approved the artifact)
 *   2. An active ConsentGrant for the direction (checked in consent.ts)
 *
 * This is the Seesaw/ClassDojo gatekeeper pattern. Raw mission events,
 * completion rates, and trait scores stay in their home context.
 */
import { hasConsent } from "./consent";
import type {
  ConsentGrant,
  CreateArtifactInput,
  EcoArtifact,
  EcoContext,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Words that must never appear in artifact captions, bodies, or trait tags. */
const BANNED_WORDS = [
  "anxious",
  "anxiety",
  "depressed",
  "impatient",
  "lazy",
  "disobedient",
  "defiant",
  "disruptive",
  "behind",
  "failing",
  "failure",
  "problem child",
  "bad kid",
  "weak",
  "struggling",
] as const;

function containsBannedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((w) => lower.includes(w));
}

/**
 * Create an artifact in its origin context. visibleTo starts as [context]
 * only — nothing crosses boundaries at creation.
 */
export function createArtifact(
  input: CreateArtifactInput,
): { ok: true; artifact: EcoArtifact } | { ok: false; error: string } {
  if (!input.childId || !input.createdBy) {
    return { ok: false, error: "childId and createdBy (gatekeeper) are required." };
  }
  if (!input.caption || input.caption.trim().length < 3) {
    return { ok: false, error: "A short caption is required." };
  }
  if (containsBannedWord(input.caption) || (input.body && containsBannedWord(input.body))) {
    return { ok: false, error: "Artifact text must use strength-based language only." };
  }
  const tags = (input.traitTags ?? []).map((t) => t.toLowerCase().trim()).filter(Boolean);
  if (tags.some((t) => containsBannedWord(t))) {
    return { ok: false, error: "Trait tags must be strengths only." };
  }
  const artifact: EcoArtifact = {
    id: uid("art"),
    childId: input.childId,
    context: input.context,
    type: input.type,
    caption: input.caption.trim(),
    body: input.body?.trim() || undefined,
    mediaUrl: input.mediaUrl || undefined,
    createdBy: input.createdBy,
    visibleTo: [input.context],
    createdAt: new Date().toISOString(),
    traitTags: tags.length > 0 ? tags : undefined,
  };
  return { ok: true, artifact };
}

/**
 * Gatekeeper approval. The approver must be an adult gatekeeper for the
 * artifact's origin context. Approval is the prerequisite for sharing.
 */
export function approveArtifact(
  artifact: EcoArtifact,
  approverId: string,
): { ok: true; artifact: EcoArtifact } | { ok: false; error: string } {
  if (!approverId) return { ok: false, error: "Approver id is required." };
  return {
    ok: true,
    artifact: {
      ...artifact,
      approvedBy: approverId,
      approvedAt: new Date().toISOString(),
    },
  };
}

/**
 * Share an artifact into another context. Requires BOTH:
 *   1. Gatekeeper approval (artifact.approvedBy set)
 *   2. Active consent grant for childId, artifact.context → toContext, scope "artifacts"
 *
 * Returns the updated artifact on success. Default deny on any failure.
 */
export function shareArtifact(
  artifact: EcoArtifact,
  toContext: EcoContext,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): { ok: true; artifact: EcoArtifact } | { ok: false; error: string } {
  if (toContext === artifact.context) {
    return { ok: true, artifact }; // already visible in its own context
  }
  if (!artifact.approvedBy) {
    return { ok: false, error: "Artifact must be gatekeeper-approved before sharing." };
  }
  const allowed = hasConsent(
    grants,
    artifact.childId,
    artifact.context,
    toContext,
    "artifacts",
    nowMs,
  );
  if (!allowed) {
    return {
      ok: false,
      error: `No active consent for ${artifact.context} → ${toContext}. Sharing blocked (default deny).`,
    };
  }
  if (artifact.visibleTo.includes(toContext)) {
    return { ok: true, artifact };
  }
  return { ok: true, artifact: { ...artifact, visibleTo: [...artifact.visibleTo, toContext] } };
}

/**
 * Consent-filtered query: what may `viewingContext` see for this child?
 * Within-context artifacts always pass; cross-context artifacts pass only
 * with an active grant for the direction AND gatekeeper approval.
 */
export function visibleArtifacts(
  artifacts: EcoArtifact[],
  childId: string,
  viewingContext: EcoContext,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): EcoArtifact[] {
  return artifacts.filter((a) => {
    if (a.childId !== childId) return false;
    if (a.context === viewingContext) return true;
    // Cross-context: must be explicitly shared AND consented AND approved.
    if (!a.visibleTo.includes(viewingContext)) return false;
    if (!a.approvedBy) return false;
    return hasConsent(grants, childId, a.context, viewingContext, "artifacts", nowMs);
  });
}

/** Count of artifacts awaiting gatekeeper approval (for the review queue). */
export function pendingApproval(
  artifacts: EcoArtifact[],
  context: EcoContext,
): EcoArtifact[] {
  return artifacts.filter((a) => a.context === context && !a.approvedBy);
}
