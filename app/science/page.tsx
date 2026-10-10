/**
 * Our Science — what guides TailTots&rsquo; AI, in parent-friendly language.
 *
 * Billion-dollar redesign, Change 6 (Legal & Trust Foundation).
 * Deliberate policy: NO living researcher&rsquo;s name appears anywhere on this
 * page. We describe the IDEAS (character traits, wellbeing pillars,
 * developmental stages, flow, body-first regulation) without attributing
 * them to individuals — "informed by published developmental research."
 * All assessments, language, and methods are our own original work.
 */

import Link from "next/link";

export const metadata = {
  title: "Our Science — TailTots",
  description:
    "What guides TailTots&rsquo; AI: character traits, wellbeing, right-sized challenge, body-first regulation, and developmental stages — in plain language.",
};

const PILLARS: { title: string; body: string }[] = [
  {
    title: "Character traits that help kids thrive",
    body: "Decades of child-development research point to teachable traits — confidence, empathy, self-control, integrity, curiosity, perseverance, optimism — that predict how children handle life's challenges. TailTots notices which traits are blooming and gently nurtures the rest through personalized missions. We track growth, never grades.",
  },
  {
    title: "Wellbeing, not just productivity",
    body: "Positive psychology research describes flourishing as more than achievement: joy, persistence, togetherness, giving, and mastery. Our growth view tracks these five dimensions from your child&rsquo;s real behavior — not screen time, not streaks. Actual development.",
  },
  {
    title: "The right challenge at the right time",
    body: "Learning science shows children grow fastest when challenge matches skill — too easy is boring, too hard shuts them down. Our AI continuously calibrates difficulty to each child, and celebrates brave attempts as much as completions. Effort is the win.",
  },
  {
    title: "Body first, then brain",
    body: "When children are overwhelmed, reasoning doesn't work until their bodies settle. TailTots sequences missions accordingly — calming, rhythmic activities first (often with their pet), then connection, then thinking tasks. Regulation before reasoning, always.",
  },
  {
    title: "Developmental stages matter",
    body: "A 5-year-old and a 10-year-old need fundamentally different things. Our AI adapts its approach to each child&rsquo;s developmental stage — open-ended exploration and initiative for younger kids, real mastery-building and industry for older ones. The product grows up with your child.",
  },
  {
    title: "Parents are the intervention",
    body: "The research is consistent: the single biggest factor in a child&rsquo;s resilience is a present, attuned caregiver. That's why our AI coaches the parent, not just the child — spotting patterns across weeks, suggesting one thing to try, and celebrating what's working. You are the program; we're the assistant.",
  },
];

const SAFETY: { title: string; body: string }[] = [
  {
    title: "Supportive, never clinical",
    body: "We design with awareness of how stress affects children. We do not diagnose, label, or treat — and our AI is blocked from using clinical or alarmist language.",
  },
  {
    title: "Parents in the loop",
    body: "AI generates, parents approve. Nothing reaches your child without you.",
  },
  {
    title: "No comparisons",
    body: "Your child is measured against their own last week — never against other children.",
  },
  {
    title: "Calm by design",
    body: "One insight a week, honest confidence levels, no red alerts, and a pause button for the overwhelming weeks. Parenting tools should reduce worry, not manufacture it.",
  },
  {
    title: "Privacy first",
    body: "AI runs on behavioral patterns, not personal data. Children never interact with the AI directly. Your family's information stays in your family.",
  },
];

export default function SciencePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>TAILTOTS</p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>Our Science</h1>
      <p style={{ fontSize: 16, color: "#4f625b", lineHeight: 1.65, marginTop: 12, maxWidth: 640 }}>
        Kids don&rsquo;t grow from checklists. They grow from the right challenge at the right moment, noticed by an adult
        who gets them. TailTots&rsquo; AI is built to do exactly that — informed by published developmental research,
        translated into everyday parenting.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#17231f", marginTop: 32 }}>What guides our AI</h2>
      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        {PILLARS.map((p) => (
          <section
            key={p.title}
            style={{ background: "#fff", border: "1px solid #e3ede8", borderRadius: 16, padding: "18px 20px" }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#165a4b", margin: "0 0 8px" }}>{p.title}</h3>
            <p style={{ fontSize: 15, color: "#4f625b", margin: 0, lineHeight: 1.65 }}>{p.body}</p>
          </section>
        ))}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#17231f", marginTop: 32 }}>How we keep it safe</h2>
      <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
        {SAFETY.map((s) => (
          <section
            key={s.title}
            style={{ background: "#e7f4ef", border: "1px solid #cfe6db", borderRadius: 16, padding: "18px 20px" }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#165a4b", margin: "0 0 8px" }}>{s.title}</h3>
            <p style={{ fontSize: 15, color: "#4f625b", margin: 0, lineHeight: 1.65 }}>{s.body}</p>
          </section>
        ))}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#17231f", marginTop: 32 }}>Built on open science</h2>
      <p style={{ fontSize: 15, color: "#4f625b", lineHeight: 1.65, maxWidth: 640 }}>
        TailTots&rsquo; engine is our own original software, informed by deep study of published research in developmental
        psychology, learning science, and child wellbeing. We build on the open science — all assessments, language,
        and methods are our own. No researcher&rsquo;s work is reproduced here, and no researcher has endorsed this product.
      </p>

      <p style={{ fontSize: 14, color: "#69736f", marginTop: 24, lineHeight: 1.6 }}>
        TailTots is a parenting tool, not a medical or therapeutic service. For concerns about your child&rsquo;s wellbeing,
        please consult your pediatrician.
      </p>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        <Link href="/promise" style={{ fontWeight: 800, color: "#165a4b", marginRight: 16 }}>
          Read Our Promise →
        </Link>
        <Link href="/" style={{ fontWeight: 800, color: "#165a4b" }}>
          ← Back to TailTots
        </Link>
      </p>
    </main>
  );
}
