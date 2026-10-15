import Link from "next/link";
import { TtIllustration, type IllustrationKind } from "../components/TtIllustration";

export const metadata = {
  title: "TailTots for Shelters — Weekend volunteers who show up with a parent",
  description: "Partner with TailTots: structured, parent-supervised kid volunteering. Free, always.",
};

const STEPS: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "book", title: "List your needs", line: "Dog walking, cat socializing, reading buddies — what do you need?" },
  { illustration: "paw-house", title: "We make missions", line: "Your needs become kid-safe missions, matched by age." },
  { illustration: "hands", title: "Families show up", line: "Parent-supervised visits. Animals get love and care." },
];

const BENEFITS: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "hands", title: "Helping hands", line: "Structured, parent-supervised kid volunteers — walking, socializing, reading buddies." },
  { illustration: "paw-house", title: "Adoption ready", line: "Kids learn real animal care before adopting — fewer returns." },
  { illustration: "celebrate", title: "Real donations", line: "Kids' giving goals, funded by parents. Food, medicine, beds." },
  { illustration: "family", title: "Weekend traffic", line: "Family foot traffic plus humane education schools love." },
];

const TRUST = [
  "Free for shelters, always",
  "We handle the structure — you just welcome",
  "No kid data collected or shared",
];

export default function ForShelters() {
  return (
    <main className="min-h-screen bg-tt-cream">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Link href="/" className="text-sm font-bold text-tt-pine hover:underline">← Back to TailTots</Link>

        <div className="mt-6 text-center">
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <img src="/landing/audience-shelter-hero.jpg" alt="Young volunteers playing with shelter dogs in the outdoor play yard" className="aspect-[21/9] w-full object-cover" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-tt-pine">For animal shelters</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-tt-navy sm:text-5xl">
            Weekend volunteers who show up with a parent.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Real volunteering, structured for kids. Free for shelters, always.
          </p>
          <a href="#partner" className="tt-btn tt-btn-primary tt-btn-lg tt-motion-pop mt-6">
            Partner with us →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">What shelters get</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-3xl bg-tt-pine-tint p-6">
              <div className="mx-auto w-fit"><TtIllustration kind={b.illustration} className="size-14" /></div>
              <p className="mt-3 text-center text-base font-black text-tt-pine">{b.title}</p>
              <p className="mt-1.5 text-center text-sm font-semibold leading-5 text-tt-ink-soft">{b.line}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-3xl border border-tt-line bg-white p-6 text-center">
              <p className="text-xs font-black text-tt-ink-faint">STEP {i + 1}</p>
              <div className="mx-auto mt-2 w-fit"><TtIllustration kind={s.illustration} className="size-14" /></div>
              <p className="mt-3 text-base font-black text-tt-navy">{s.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{s.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-tt-line bg-white p-6">
          <ul className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm font-semibold leading-5 text-tt-ink-soft">
                <span className="mt-0.5 shrink-0 font-black text-tt-pine" aria-hidden="true">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div id="partner" className="mt-14 scroll-mt-24 rounded-3xl bg-tt-night p-8 text-center sm:p-10">
          <h2 className="text-2xl font-black text-white">Ready to partner?</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] font-semibold leading-6 text-white/75">
            Free for shelters, always.
          </p>
          <a href="mailto:hello@tailtots.com?subject=Shelter%20Partnership" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-sun px-8 py-3 text-sm font-black text-tt-ink">
            Email hello@tailtots.com →
          </a>
        </div>
      </div>
    </main>
  );
}
