"use client";

/**
 * Founder gate for /ai-insights (founder decision, 2026-10-15).
 *
 * The AI Insights dashboard exposes live algorithm validation detail —
 * founder/pitch material, never a public surface (moat rule: public
 * pages carry outcome language only). The page renders ONLY for a
 * signed-in founder account; everyone else gets a lock panel. The
 * dashboard code itself ships in the bundle, but its data is synthetic,
 * so this gate protects disclosure, not secrets.
 */
import { useEffect, useState, type ReactNode } from "react";
import { getBrowserSupabaseClient } from "../../lib/supabase-browser";

const FOUNDER_EMAILS = ["hello@tailtots.com"];

function isFounderEmail(email: string | null | undefined): boolean {
  return !!email && FOUNDER_EMAILS.includes(email.trim().toLowerCase());
}

export function FounderGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    const client = getBrowserSupabaseClient();
    if (!client) {
      setState("denied");
      return;
    }
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (!cancelled) setState(isFounderEmail(data.session?.user?.email) ? "ok" : "denied");
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState(isFounderEmail(session?.user?.email) ? "ok" : "denied");
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  if (state === "ok") return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-tt-cream px-4 py-10 text-tt-ink">
      <section className="w-full max-w-md rounded-lg border border-tt-line bg-white p-6 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">🔒</p>
        <h1 className="mt-3 text-2xl font-black">Founder-only page</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-tt-ink-soft">
          {state === "checking"
            ? "Checking your sign-in…"
            : "This page holds TailTots' working notes on how the AI thinks. It isn't part of the public site."}
        </p>
        {state === "denied" && (
          <>
            <a
              href="/"
              className="mt-5 inline-block min-h-12 rounded-lg bg-tt-pine px-6 py-3 text-sm font-black text-white"
            >
              Go to TailTots
            </a>
            <p className="mt-4 text-xs font-semibold leading-5 text-tt-ink-faint">
              Founder? Sign in on the site with the founder account first, then come back to this page.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
