import { describe, expect, it } from "vitest";
import {
  buildVerificationProof,
  isValidPaymentIntentId,
  isValidPaymentMethodId,
  validateVerifyCardBody,
} from "../verification";

describe("card verification (COPPA VPC)", () => {
  it("accepts well-formed Stripe PaymentMethod ids", () => {
    expect(isValidPaymentMethodId("pm_1Ab2Cd3Ef4Gh5Ij6")).toBe(true);
  });

  it("rejects malformed ids and non-strings", () => {
    expect(isValidPaymentMethodId("pm_short")).toBe(false);
    expect(isValidPaymentMethodId("card_1234567890")).toBe(false);
    expect(isValidPaymentMethodId("")).toBe(false);
    expect(isValidPaymentMethodId(null)).toBe(false);
    expect(isValidPaymentMethodId(undefined)).toBe(false);
    expect(isValidPaymentMethodId(123)).toBe(false);
  });

  it("accepts well-formed payment-intent ids", () => {
    expect(isValidPaymentIntentId("pi_1Ab2Cd3Ef4Gh5Ij6")).toBe(true);
    expect(isValidPaymentIntentId("pm_1Ab2Cd3Ef4Gh5Ij6")).toBe(false);
  });

  it("validates the verify-card request body", () => {
    expect(validateVerifyCardBody({ paymentMethodId: "pm_1Ab2Cd3Ef4Gh5Ij6" }).ok).toBe(true);
    expect(validateVerifyCardBody({ paymentMethodId: "nope" }).ok).toBe(false);
    expect(validateVerifyCardBody({}).ok).toBe(false);
    expect(validateVerifyCardBody(null).ok).toBe(false);
    expect(validateVerifyCardBody("pm_1Ab2Cd3Ef4Gh5Ij6").ok).toBe(false);
  });

  it("builds a proof record carrying only brand/last4/id/date — never the PAN", () => {
    const proof = buildVerificationProof({
      paymentIntentId: "pi_1Ab2Cd3Ef4Gh5Ij6",
      brand: "Visa",
      last4: "4242",
    });
    expect(proof).toMatchObject({
      method: "card",
      verificationId: "pi_1Ab2Cd3Ef4Gh5Ij6",
      brand: "visa",
      last4: "4242",
    });
    expect(typeof proof.at).toBe("string");
    // The proof must never contain anything resembling a full card number.
    expect(JSON.stringify(proof)).not.toMatch(/\d{13,19}/);
  });
});
