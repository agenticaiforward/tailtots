/**
 * Our Science — what guides TailTots&rsquo; AI, visual-first.
 *
 * Deliberate policy: NO living researcher&rsquo;s name appears anywhere.
 * Ideas only — "informed by published developmental research."
 */

import Link from "next/link";

export const metadata = {
  title: "Our Science — TailTots",
  description:
    "What guides TailTots&rsquo; AI: character traits, wellbeing, right-sized challenge, and body-first regulation.",
};

const PILLARS: { icon: string; title: string; line: string }[] = [
  { icon: "🌱", title: "Character traits", line: "We notice which strengths are blooming and nurture the rest. Growth, never grades." },
  { icon: "💛", title: "Wellbeing first", line: "Joy, persistence, togetherness, giving, mastery — tracked from real behavior." },
  { icon: "🎯", title: "Right-sized challenge", line: "AI calibrates difficulty to each child. Brave attempts count as much as completions." },
  { icon: "🧘", title: "Body first, then brain", line: "Calming activities before thinking tasks. Regulation before reasoning, always." },
  { icon: "📈", title: "Grows with your child", line: "A 5-year-old and a 10-year-old need different things. The AI adapts." },
  { icon: "👪", title: "Parents are the program", line: "Our AI coaches you — spotting patterns, suggesting one thing to try." },
];

const SAFETY: { icon: string; title: string; line: string }[] = [
  { icon: "🤝", title: "Supportive, never clinical", line: "No diagnosing, no labeling, no alarmist language. Ever." },
  { icon: "✅", title: "Parents in the loop", line: "AI generates, parents approve. Nothing reaches your child without you." },
  { icon: "🚫", title: "No comparisons", line: "Your child vs. their own last week — never vs. other children." },
  { icon: "🔕", title: "Calm by design", line: "One insight a week. Pause button for overwhelming weeks." },
  { icon: "🔒", title: "Privacy first", line: "Behavioral patterns, not personal data. Kids never touch the AI." },
];

function CardGrid({ items }: { items: { icon: string; title: string; line: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {items.map((p) => (
        <section key={p.title} style={{ background: "#fff", border: "1px solid #e3ede8", borderRadius: 16, padding: "16px" }}>
          <p style={{ fontSize: 26, margin: 0 }} aria-hidden="true">{p.icon}</p>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#165a4b", margin: "8px 0 4px" }}>{p.title}</h3>
          <p style={{ fontSize: 14, color: "#4f625b", margin: 0, lineHeight: 1.55 }}>{p.line}</p>
        </section>
      ))}
    </div>
  );
}

export default function SciencePage() {
  return (
    <main style={{ margin: "0 auto", maxWidth: 860, padding: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", color: "#165a4b" }}>TAILTOTS</p>
      <h1 style={{ fontSize: 32, fontWeight: 900, color: "#17231f", marginTop: 8 }}>Our Science</h1>
      <p style={{ fontSize: 16, color: "#4f625b", lineHeight: 1.65, marginTop: 12, maxWidth: 640 }}>
        Kids grow from the right challenge at the right moment, noticed by an adult who gets them.
        Our AI does exactly that — informed by published developmental research.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#17231f", marginTop: 32 }}>What guides our AI</h2>
      <CardGrid items={PILLARS} />

      <h2 style={{ fontSize: 20, fontWeight: 900, color: "#17231f", marginTop: 32 }}>How we keep it safe</h2>
      <CardGrid items={SAFETY} />

      <details style={{ marginTop: 28, fontSize: 14, color: "#4f625b", background: "#f7f5ec", borderRadius: 12, padding: "14px 16px" }}>
        <summary style={{ cursor: "pointer", fontWeight: 800, color: "#165a4b" }}>Our research approach</summary>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          TailTots&rsquo; engine is our own original software, informed by deep study of published research in
          developmental psychology, learning science, and child wellbeing. No researcher&rsquo;s work is reproduced
          here, and no researcher has endorsed this product.
        </p>
      </details>

      <p style={{ fontSize: 13, color: "#69736f", marginTop: 20, lineHeight: 1.6 }}>
        TailTots is a parenting tool, not a medical service. For wellbeing concerns, consult your pediatrician.
      </p>
      <p style={{ fontSize: 14, marginTop: 16 }}>
        <Link href="/promise" style={{ fontWeight: 800, color: "#165a4b", marginRight: 16 }}>Read Our Promise →</Link>
        <Link href="/" style={{ fontWeight: 800, color: "#165a4b" }}>← Back to TailTots</Link>
      </p>
    </main>
  );
}
