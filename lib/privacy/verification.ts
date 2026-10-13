/**
 * Parent identity verification (COPPA verifiable parental consent, §312.5).
 *
 * The in-app parent passcode is a parental gate, not verifiable parental
 * consent. For real families, TailTots verifies the parent with an
 * FTC-approved method that needs no third-party vendor: a credit/debit
 * card check (16 CFR §312.5(b)(2)).
 *
 * How it works:
 *  1. The parent enters their card in a Stripe-hosted card element.
 *     Raw card numbers NEVER touch TailTots servers — Stripe.js turns the
 *     card into a PaymentMethod id (pm_...) in the browser.
 *  2. Our worker sends that id to Stripe: $1 authorization, confirmed,
 *     then immediately refunded. Only a successful authorization counts.
 *  3. We store the PROOF (Stripe payment-intent id, card brand, last4,
 *     timestamp) — never the PAN, never the full card number.
 *
 * What the parent is told (must stay true in the UI):
 *  - A temporary $1 authorization is placed and immediately refunded.
 *  - The card is used ONLY to verify you are the parent, never charged.
 *  - We never see or store your full card number.
 */

export interface ParentIdentityVerification {
  /** Always "card" for now; the shape allows future methods (id-check, kba). */
  method: "card";
  /** Stripe payment-intent id, e.g. "pi_...". Proof of the verification. */
  verificationId: string;
  /** Card brand, e.g. "visa". */
  brand: string;
  /** Last 4 digits only. */
  last4: string;
  /** ISO timestamp of the successful verification. */
  at: string;
}

/** Stripe PaymentMethod ids look like "pm_1Ab2Cd...". */
export function isValidPaymentMethodId(id: unknown): id is string {
  return typeof id === "string" && /^pm_[a-zA-Z0-9]{10,}$/.test(id);
}

/** Stripe payment-intent ids look like "pi_1Ab2Cd...". */
export function isValidPaymentIntentId(id: unknown): id is string {
  return typeof id === "string" && /^pi_[a-zA-Z0-9]{10,}$/.test(id);
}

export interface VerifyCardRequest {
  paymentMethodId: string;
}

export function validateVerifyCardBody(body: unknown): { ok: true; value: VerifyCardRequest } | { ok: false; error: string } {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const { paymentMethodId } = body as Record<string, unknown>;
  if (!isValidPaymentMethodId(paymentMethodId)) {
    return { ok: false, error: "paymentMethodId must be a valid Stripe PaymentMethod id." };
  }
  return { ok: true, value: { paymentMethodId } };
}

/** Build a ParentIdentityVerification from a successful Stripe charge. */
export function buildVerificationProof(args: {
  paymentIntentId: string;
  brand: string;
  last4: string;
}): ParentIdentityVerification {
  return {
    method: "card",
    verificationId: args.paymentIntentId,
    brand: args.brand.toLowerCase(),
    last4: args.last4,
    at: new Date().toISOString(),
  };
}
