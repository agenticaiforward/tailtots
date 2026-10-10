/**
 * TailTots Ecosystem — shared data model.
 *
 * One AI backend, many front-ends. Every event is tagged with an EcoContext
 * (home / school / community); cross-context reads require explicit consent.
 *
 * Design principles (from research):
 * 1. Artifacts cross boundaries, not raw data. Photos, reflections, badges —
 *    approved by the adult gatekeeper — travel between stakeholders. Raw
 *    behavioral streams never leave their context. (ClassDojo/Seesaw pattern;
 *    inBloom died doing the opposite.)
 * 2. Default deny. No cross-context visibility without a ConsentGrant.
 * 3. COPPA: under-13 community participation requires parent enrollment as
 *    primary; no child accounts for org contexts. Only the parent can grant
 *    or revoke consent.
 * 4. No affective labels on under-13s. Artifacts carry strength tags only
 *    (e.g. "patience", "kindness") — never deficit labels.
 *
 * Pure functions + types only. No framework imports so this module is usable
 * from Worker routes, components, and unit tests alike.
 */

/** Where an event or artifact belongs. One child, one profile, many contexts. */
export type EcoContext = "home" | "school" | "community";

export const ECO_CONTEXTS: readonly EcoContext[] = ["home", "school", "community"] as const;

export const ECO_CONTEXT_LABELS: Record<EcoContext, string> = {
  home: "Home",
  school: "School",
  community: "Community",
};

/** What can travel between contexts. Gatekeeper-approved only. */
export type ArtifactType = "photo" | "reflection" | "badge" | "project";

export const ARTIFACT_TYPES: readonly ArtifactType[] = [
  "photo",
  "reflection",
  "badge",
  "project",
] as const;

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  photo: "Photo",
  reflection: "Reflection",
  badge: "Badge",
  project: "Project",
};

export const ARTIFACT_TYPE_EMOJI: Record<ArtifactType, string> = {
  photo: "📸",
  reflection: "💭",
  badge: "🏅",
  project: "🎨",
};

/**
 * A gatekeeper-approved artifact. Created in one context; may become visible
 * in others only through explicit consent (see consent.ts) + gatekeeper
 * approval. `visibleTo` always includes the origin context.
 */
export interface EcoArtifact {
  id: string;
  childId: string;
  /** Where this artifact was created. */
  context: EcoContext;
  type: ArtifactType;
  caption: string;
  /** Free-text body for reflections/projects. */
  body?: string;
  /** Photo artifacts: data URL or storage path. Never a raw upload without consent. */
  mediaUrl?: string;
  /** Adult gatekeeper (parent / teacher / org leader) who created it. */
  createdBy: string;
  /** Gatekeeper who approved cross-context visibility. Required before sharing. */
  approvedBy?: string;
  approvedAt?: string;
  /** Contexts allowed to see this artifact. Always includes `context`. */
  visibleTo: EcoContext[];
  createdAt: string; // ISO
  /**
   * Strength tags only — e.g. "patience", "kindness", "perseverance".
   * NEVER deficit or affective labels ("anxious", "impatient", ...).
   */
  traitTags?: string[];
}

/** What a consent grant covers. */
export type ConsentScope = "artifacts" | "aggregate_trends";

export const CONSENT_SCOPES: readonly ConsentScope[] = ["artifacts", "aggregate_trends"] as const;

/**
 * A parent's explicit grant allowing data to flow from one context to another.
 * COPPA rule: only the parent (never the org, never the child) can grant.
 * Revocation is immediate and total.
 */
export interface ConsentGrant {
  id: string;
  childId: string;
  fromContext: EcoContext;
  toContext: EcoContext;
  /** Parent user id. Only parents can grant. */
  grantedBy: string;
  scope: ConsentScope[];
  grantedAt: string; // ISO
  revokedAt?: string; // ISO — set on revoke; revoked grants never un-revoke
  expiresAt?: string; // ISO — optional TTL (e.g. school-year grants)
}

/** Input for creating an artifact. Gatekeeper id required at creation. */
export interface CreateArtifactInput {
  childId: string;
  context: EcoContext;
  type: ArtifactType;
  caption: string;
  body?: string;
  mediaUrl?: string;
  createdBy: string;
  traitTags?: string[];
}

/** A per-context trait strength summary for cross-context AI. Coarse aggregates only. */
export interface ContextTraitSummary {
  context: EcoContext;
  /** Trait key, e.g. "patience", "kindness". Strength names only. */
  trait: string;
  /** 0..1 aggregate strength in this context. */
  score: number;
  /** Missions completed in this context — evidence threshold. */
  missionsCompleted: number;
}

/** Who receives a coaching suggestion. Always an adult, never the child. */
export type CoachingAdult = "parent" | "teacher";

/**
 * The ONLY output shape of cross-context AI. Strength-based coaching for an
 * adult — never a label about the child, never an autonomous decision.
 */
export interface CoachingSuggestion {
  forAdult: CoachingAdult;
  /** Strength name, e.g. "patience". */
  strength: string;
  fromContext: EcoContext;
  toContext: EcoContext;
  suggestedActivity: string;
  /** Human sentence, strength-first. Example: "Maya shows real patience at the
   * shelter — here's a home game that builds on that same strength." */
  framing: string;
}
