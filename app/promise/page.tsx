/**
 * Our Promise — plain-language trust commitments, visual-first.
 *
 * Rule: icon + headline + ONE line. Details element for the rest.
 */

import Link from "next/link";

export const metadata = {
  title: "Our Promise — TailTots",
  description:
    "Plain-language commitments: parents own the data, kids never touch the AI, and built-in calm guardrails.",
};

const PROMISES: { icon: string; title: string; line: string; more?: string }[] = [
  {
    illustration: "shield",
    title: "Your child's experience is sacred",
    line: "No popups, no distractions, no third-party content during missions.",
    more: "We make money from families who choose us — not from attention sold to someone else.",
  },
  {
    illustration: "shield",
    title: "We don't sell data. We barely keep it.",
    line: "Never sold, rented, or shared for marketing. Export or delete anytime.",
  },
  {
    illustration: "family",
    title: "You own your family's data",
    line: "Every mission, badge, and insight belongs to you — not us.",
    more: "If you leave, your data leaves with you — or is deleted, your choice.",
  },
  {
    illustration: "shield",
    title: "Your child never talks to the AI",
    line: "All AI runs parent-side. Kids see missions and pets — never a chatbot.",
  },
  {
    illustration: "hands",
    title: "One insight a week — not a worry machine",
    line: "The single most useful thing, with honest confidence. Pause anytime.",
    more: "We throttle insights, never use alarmist language, and you can pause all insights for two weeks whenever life is a lot.",
  },
  {
    illustration: "growth",
    title: "Measured against themselves only",
    line: "No leaderboards, no percentiles, no comparisons to other children.",
  },
  {
    icon: "✅",
    title: "You approve everything",
    line: "AI suggests; you decide. Nothing reaches your child without you.",
  },
  {
    icon: "📞",
    title: "A human is reachable",
    line: "Something feels wrong? Reach us at hello@tailtots.com.",
  },
];

export default function PromisePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>TAILTOTS</p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>Our Promise</h1>
      <p style={{ fontSize: 16, color: "#4f625b", lineHeight: 1.65, marginTop: 12, maxWidth: 640 }}>
        Trust is the whole product. Here&rsquo;s what we commit to — plain language, no fine print.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 28, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {PROMISES.map((p) => (
          <section
            key={p.title}
            style={{ background: "#fff", border: "1px solid #e3ede8", borderRadius: 16, padding: "18px" }}
          >
            <TtIllustration kind={p.illustration} className="size-12" />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#165a4b", margin: "8px 0 4px" }}>{p.title}</h2>
            <p style={{ fontSize: 14, color: "#4f625b", margin: 0, lineHeight: 1.55 }}>{p.line}</p>
            {p.more && (
              <details style={{ marginTop: 8, fontSize: 13, color: "#69736f" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "#165a4b" }}>More</summary>
                <p style={{ marginTop: 6, lineHeight: 1.55 }}>{p.more}</p>
              </details>
            )}
          </section>
        ))}
      </div>

      <p style={{ fontSize: 13, color: "#69736f", marginTop: 24, lineHeight: 1.6 }}>
        TailTots is a parenting tool, not a medical service. For wellbeing concerns, consult your pediatrician.
      </p>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        <Link href="/" style={{ fontWeight: 800, color: "#165a4b" }}>← Back to TailTots</Link>
      </p>
    </main>
  );
}
