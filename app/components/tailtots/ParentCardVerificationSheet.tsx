import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import type { ParentIdentityVerification } from "../../lib/privacy/verification";

/**
 * Parent identity verification — COPPA verifiable parental consent (§312.5).
 *
 * A credit/debit card check is an FTC-approved verification method that
 * needs no third-party vendor. The parent's card is tokenized by Stripe.js
 * in the browser: the raw card number NEVER touches TailTots servers.
 * Our backend places a $1 authorization and immediately refunds it; only a
 * successful authorization counts as verification.
 *
 * Rendered only in parent-gated areas. Children never see this sheet.
 */
export function ParentCardVerificationSheet(props: {
  open: boolean;
  onVerified: (proof: ParentIdentityVerification) => void;
  onClose: () => void;
  getAccessToken: () => Promise<string | null>;
}) {
  const { open, onVerified, onClose, getAccessToken } = props;
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState("");
  const mountRef = useRef<HTMLDivElement>(null);
  const publishableKey =
    (import.meta as any).env?.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  useEffect(() => {
    if (!open || !publishableKey) return;
    let cancelled = false;
    let element: StripeCardElement | null = null;
    setStatus("idle");
    setError("");
    loadStripe(publishableKey).then((s) => {
      if (cancelled || !s || !mountRef.current) return;
      setStripe(s);
      const elements = s.elements();
      element = elements.create("card", {
        style: {
          base: { fontSize: "16px", color: "#17231f", fontFamily: "inherit" },
        },
      });
      element.mount(mountRef.current);
      setCardElement(element);
    });
    return () => {
      cancelled = true;
      try {
        element?.destroy();
      } catch {
        /* noop */
      }
      setCardElement(null);
      setStripe(null);
    };
  }, [open, publishableKey]);

  if (!open) return null;

  async function postVerify(paymentMethodId: string): Promise<Response> {
    const token = await getAccessToken();
    return fetch("/api/parent/verify-card", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ paymentMethodId }),
    });
  }

  async function handleSubmit() {
    if (!stripe || !cardElement || status === "working") return;
    setStatus("working");
    setError("");
    try {
      const pm = await stripe.createPaymentMethod({ type: "card", card: cardElement });
      if (pm.error || !pm.paymentMethod) {
        throw new Error(pm.error?.message ?? "Card could not be read. Check the details and try again.");
      }
      const res = await postVerify(pm.paymentMethod.id);
      const data = (await res.json()) as {
        verified?: boolean;
        needsAction?: boolean;
        clientSecret?: string;
        paymentIntentId?: string;
        verificationId?: string;
        brand?: string;
        last4?: string;
        at?: string;
        error?: string;
      };
      // 3-D Secure: complete the challenge, then the $1 is authorized.
      if (res.ok && data.needsAction && data.clientSecret) {
        const confirmed = await stripe.confirmCardPayment(data.clientSecret);
        if (confirmed.error) {
          throw new Error(confirmed.error.message ?? "Card verification was not completed.");
        }
        // Re-run the server step now that the card is confirmed: create a
        // fresh PaymentMethod from the same element for the final attempt.
        const pm2 = await stripe.createPaymentMethod({ type: "card", card: cardElement });
        if (pm2.error || !pm2.paymentMethod) {
          throw new Error(pm2.error?.message ?? "Card could not be read.");
        }
        const res2 = await postVerify(pm2.paymentMethod.id);
        const data2 = (await res2.json()) as typeof data;
        if (!res2.ok || !data2.verified) {
          throw new Error(data2.error ?? "Card verification failed.");
        }
        onVerified({
          method: "card",
          verificationId: data2.verificationId ?? "",
          brand: data2.brand ?? "card",
          last4: data2.last4 ?? "••••",
          at: data2.at ?? new Date().toISOString(),
        });
        return;
      }
      if (!res.ok || !data.verified) {
        throw new Error(data.error ?? "Card verification failed.");
      }
      onVerified({
        method: "card",
        verificationId: data.verificationId ?? "",
        brand: data.brand ?? "card",
        last4: data.last4 ?? "••••",
        at: data.at ?? new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Card verification failed.");
      setStatus("error");
    } finally {
      if (status !== "error") setStatus("idle");
    }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17231f]/60 p-4" role="dialog" aria-modal="true" aria-label="Verify parent identity">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-tt-pine">For parents · identity check</p>
        <h2 className="mt-2 text-2xl font-black text-tt-ink">Verify you&apos;re the parent</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
          US children&apos;s-privacy law (COPPA) requires us to verify that an adult — not a child —
          approved the collection of your child&apos;s information. A quick card check does that.
        </p>

        <div className="mt-4 rounded-2xl bg-tt-cream/70 p-4 text-sm font-semibold leading-6 text-tt-ink-soft">
          <p className="font-black text-tt-ink">What happens with your card</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>A temporary <strong className="text-tt-ink">$1 authorization</strong> is placed, then <strong className="text-tt-ink">immediately refunded</strong>. Your card is never charged.</li>
            <li>Your card details are handled by <strong className="text-tt-ink">Stripe</strong> — TailTots never sees or stores your full card number.</li>
            <li>We keep only the proof of verification (card brand, last 4 digits, date) with your consent record.</li>
          </ul>
        </div>

        {!publishableKey ? (
          <p className="mt-4 rounded-2xl border border-tt-line bg-tt-cream/50 p-4 text-sm font-semibold text-tt-ink-soft">
            Card verification isn&apos;t configured yet. The site owner needs to add the Stripe
            publishable key — then this check will work.
          </p>
        ) : (
          <div className="mt-4">
            <label className="text-sm font-black text-tt-ink">Card details</label>
            <div ref={mountRef} className="mt-2 rounded-xl border-2 border-tt-line bg-white p-3" />
          </div>
        )}

        {error ? (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{error}</p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!publishableKey || status === "working"}
            className="min-h-12 flex-1 rounded-xl bg-tt-pine px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {status === "working" ? "Verifying…" : "Verify $1 (refunded)"}
          </button>
          <button
            onClick={onClose}
            className="min-h-12 rounded-xl border-2 border-tt-line px-5 py-3 text-sm font-black text-tt-ink-soft"
          >
            Not now
          </button>
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-tt-ink-soft">
          You can use TailTots without this check; verification simply upgrades your consent
          records to the legally recognized proof before launch.
        </p>
      </div>
    </div>
  );
}
