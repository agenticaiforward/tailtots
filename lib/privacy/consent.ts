/**
 * Parental consent records (COPPA-oriented).
 *
 * Three SEPARATE consents — never bundled, per the FTC's 2024 COPPA Rule
 * amendments (separate verifiable parental consent before disclosing a
 * child's personal information to third parties, including for
 * targeted advertising):
 *
 * - "data-collection": parent consents to the app collecting the child's
 *   personal information (name, age, photos, activity) to operate the service.
 * - "voice": parent consents to voice collection — mic audio transcribed for
 *   voice commands and the voice quiz. Audio is never stored; transcripts are
 *   processed and deleted per the retention schedule.
 * - "marketing": OPTIONAL, OFF BY DEFAULT. Parent opts in to receiving
 *   promotions/recommendations (shelters, schools, products) informed by the
 *   child's interests. Parent-directed: the opt-in checkbox lives in the
 *   parent permission sheet (labeled "for parents", completion requires the
 *   parent passcode); promotions render ONLY to the verified parent, never
 *   to the child. Revocable at any time; revocation deletes the marketing
 *   profile.
 *
 * PRODUCTION NOTE: true COPPA "verifiable parental consent" requires an
 * approved method (credit/debit card check, knowledge-based authentication,
 * ID verification, or a safe-harbor vendor such as PRIVO). The in-app parent
 * passcode gate below is a parental gate + consent record suitable for demo
 * and internal testing — it MUST be replaced with a VPC vendor before launch
 * with real families. The record shape is designed to carry the vendor's
 * verification proof (method + verificationId) when that lands.
 */

export type ConsentType = "data-collection" | "voice" | "marketing";

/** Current policy copy version — bump when consent wording changes. */
export const CONSENT_POLICY_VERSION = 1;

export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  /** ISO timestamp of the grant (or most recent revocation). */
  at: string;
  /**
   * How the parent verified: "parent-passcode" (in-app gate, demo),
   * "parent-account" (signed-in parent), "card-verified" (FTC-approved
   * card check via Stripe — verifiable parental consent for real families),
   * or a VPC vendor id later.
   */
  method: "parent-passcode" | "parent-account" | "card-verified" | string;
  /** For "card-verified": the Stripe payment-intent id proving verification. */
  verificationId?: string;
  policyVersion: number;
  /** Voice consent only: was the Chrome→Google transcription path disclosed? */
  transcriptionDisclosureShown?: boolean;
}

export type FamilyConsents = Partial<Record<ConsentType, ConsentRecord>>;

export function hasConsent(consents: FamilyConsents | undefined, type: ConsentType): boolean {
  return consents?.[type]?.granted === true;
}

export function grantConsent(
  consents: FamilyConsents | undefined,
  type: ConsentType,
  opts: { method: ConsentRecord["method"]; transcriptionDisclosureShown?: boolean },
): FamilyConsents {
  return {
    ...consents,
    [type]: {
      type,
      granted: true,
      at: new Date().toISOString(),
      method: opts.method,
      policyVersion: CONSENT_POLICY_VERSION,
      ...(type === "voice" ? { transcriptionDisclosureShown: opts.transcriptionDisclosureShown ?? false } : {}),
    },
  };
}

export function revokeConsent(consents: FamilyConsents | undefined, type: ConsentType): FamilyConsents {
  const existing = consents?.[type];
  return {
    ...consents,
    [type]: {
      type,
      granted: false,
      at: new Date().toISOString(),
      method: existing?.method ?? "parent-passcode",
      policyVersion: existing?.policyVersion ?? CONSENT_POLICY_VERSION,
    },
  };
}

/**
 * Re-stamp already-granted consents with the stronger card-verification
 * proof after the parent completes the card check. Grants that were made
 * under the passcode gate keep their original timestamp; only the proof
 * of *who* verified is upgraded.
 */
export function upgradeConsentsToCardVerified(
  consents: FamilyConsents | undefined,
  verificationId: string,
): FamilyConsents {
  const next: FamilyConsents = { ...(consents ?? {}) };
  for (const type of Object.keys(next) as ConsentType[]) {
    const record = next[type];
    if (record?.granted) {
      next[type] = { ...record, method: "card-verified", verificationId };
    }
  }
  return next;
}

/**
 * Where does transcribed audio go on this browser?
 * - Safari / WebKit: on-device transcription — audio never leaves the device.
 * - Chrome / Chromium: the Web Speech API streams audio to Google's servers.
 *   Under COPPA that is a disclosure of a child's voice to a third party and
 *   must be explicitly disclosed in the consent sheet.
 */
export function detectTranscriptionPath(): "on-device" | "google" {
  if (typeof navigator === "undefined") return "on-device";
  const ua = navigator.userAgent || "";
  const isChrome = /Chrome|Chromium|Edg|OPR/i.test(ua) && !/Version\//.test(ua);
  // Safari (and iOS Safari / WKWebView) transcribe on-device.
  if (!isChrome) return "on-device";
  return "google";
}

/** Human-readable line for the consent sheet, based on the real browser. */
export function transcriptionPathLabel(path: "on-device" | "google"): string {
  return path === "on-device"
    ? "On this device, your child's voice is transcribed on the device itself. Audio never leaves this device and is never stored."
    : "On this browser (Chrome), transcription is done by Google: your child's voice audio is sent to Google's servers to be turned into text. Audio is not stored by TailTots.";
}
