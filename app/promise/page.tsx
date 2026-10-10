/**
 * Our Promise — plain-language trust commitments.
 *
 * Billion-dollar redesign, Change 6 (Legal & Trust Foundation).
 * This page is the shield: when anyone asks "why should I trust an AI with
 * my child?", the answer lives here in plain language.
 */

import Link from "next/link";

export const metadata = {
  title: "Our Promise — TailTots",
  description:
    "Plain-language commitments: no ads, no data sale, parents own the data, kids never touch the AI, and built-in anxiety guardrails.",
};

const PROMISES: { title: string; body: string }[] = [
  {
    title: "No ads. Ever.",
    body: "TailTots will never show your child an advertisement, and will never show you one inside your child&rsquo;s experience. We make money from families who choose us — not from attention sold to someone else.",
  },
  {
    title: "We don&rsquo;t sell data. We barely keep it.",
    body: "Your family's data is never sold, rented, or shared for marketing. We keep only what's needed to personalize your child&rsquo;s missions, and we publish exactly what that is and how long we keep it. You can export or delete everything, any time.",
  },
  {
    title: "You own your family's data.",
    body: "Every mission, every badge, every insight belongs to your family. Not to us, not to advertisers, not to data brokers. If you leave, your data leaves with you — or is deleted, your choice.",
  },
  {
    title: "Your child never talks to the AI.",
    body: "All AI runs on the parent side. Your child sees missions, pets, and celebrations — never a chatbot, never a conversation, never an open-ended prompt. There is no path by which a child ends up talking to a model.",
  },
  {
    title: "One insight a week — not a worry machine.",
    body: "Our AI can detect dozens of patterns. You see one card a week: the single most useful thing, with honest confidence levels. We throttle insights, never use alarmist language, and you can pause all insights for two weeks whenever life is a lot. Parenting dashboards should reduce worry, not manufacture it.",
  },
  {
    title: "Measured against themselves — never other children.",
    body: "Your child is compared only to their own last week. No leaderboards, no percentiles, no 'other 7-year-olds.' Every child develops on their own timeline, and our product treats that as a fact, not a slogan.",
  },
  {
    title: "You approve everything the AI suggests.",
    body: "AI generates; parents decide. Nothing the AI creates — missions, insights, suggestions — reaches your child without your approval. You are the gate, always.",
  },
  {
    title: "A human is reachable.",
    body: "If something feels wrong — a mission, an insight, anything — you can reach a human at hello@tailtots.com. AI handles scale; humans handle trust.",
  },
];

export default function PromisePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>TAILTOTS</p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>Our Promise</h1>
      <p style={{ fontSize: 16, color: "#4f625b", lineHeight: 1.65, marginTop: 12, maxWidth: 640 }}>
        Trust is the whole product. An AI that helps raise your child has to earn its place in your family every
        single day. Here&rsquo;s what we commit to — in plain language, no fine print.
      </p>

      <div style={{ display: "grid", gap: 14, marginTop: 28 }}>
        {PROMISES.map((p) => (
          <section
            key={p.title}
            style={{
              background: "#fff",
              border: "1px solid #e3ede8",
              borderRadius: 16,
              padding: "18px 20px",
            }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#165a4b", margin: "0 0 8px" }}>{p.title}</h2>
            <p style={{ fontSize: 15, color: "#4f625b", margin: 0, lineHeight: 1.65 }}>{p.body}</p>
          </section>
        ))}
      </div>

      <p style={{ fontSize: 14, color: "#69736f", marginTop: 28, lineHeight: 1.6 }}>
        TailTots is a parenting tool, not a medical or therapeutic service. For concerns about your child&rsquo;s wellbeing,
        please consult your pediatrician.
      </p>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        <Link href="/" style={{ fontWeight: 800, color: "#165a4b" }}>
          ← Back to TailTots
        </Link>
      </p>
    </main>
  );
}
