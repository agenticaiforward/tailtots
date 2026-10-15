import Link from "next/link";
import { TtIllustration, type IllustrationKind } from "../components/TtIllustration";

export const metadata = {
  title: "TailTots for Schools — Character growth you can see. Data you never touch.",
  description: "SEL outcomes without another test, survey, or curriculum purchase. Families own the data.",
};

const BENEFITS: { illustration: IllustrationKind; title: string; line: string }[] = [
  {
    illustration: "growth",
    title: "Proof, not tests",
    line: "Kids practice 8 character traits through real responsibility at home. Your school sees classroom-level growth summaries — no tests, surveys, or new curriculum.",
  },
  {
    illustration: "chat",
    title: "Teachers connect",
    line: "In the pilot, teachers get a weekly one-line pointer per participating student — a conversation starter from what the child practiced, chosen by the family. \"Ask Leo about the neighbor's dog he walked all week.\"",
  },
  {
    illustration: "family",
    title: "Families engage",
    line: "Measurable parent involvement your school can report upward — with reading and service tie-ins built in.",
  },
  {
    illustration: "shield",
    title: "Zero burden",
    line: "No student accounts. No devices. No teacher data entry. No IT ticket. Families own the data — you never hold it.",
  },
];

const PILOT: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "book", title: "Pick a classroom", line: "One class, one month. Zero IT lift." },
  { illustration: "family", title: "Families opt in", line: "Parents give COPPA-verified consent. No mandates." },
  { illustration: "growth", title: "See the class bloom", line: "Classroom summaries only. Nothing individual, ever." },
];

const TRUST = [
  "COPPA-verified parental consent, every family",
  "FERPA-aligned DPA ready to sign",
  "No ads. No child data sold. Ever.",
  "Students never scored, ranked, or profiled",
  "Formal accessibility (WCAG) audit before pilots",
];

export default function ForSchools() {
  return (
    <main className="min-h-screen bg-tt-cream">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Link href="/" className="text-sm font-bold text-tt-pine hover:underline">← Back to TailTots</Link>

        <div className="mt-6 text-center">
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <img src="/landing/audience-school-hero.jpg" alt="Students reading to a therapy dog in their classroom" className="aspect-[21/9] w-full object-cover" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-tt-pine">For schools</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-tt-navy sm:text-5xl">
            Character growth you can see. Data you never touch.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            SEL outcomes without another test, survey, or curriculum purchase — and without a privacy fight.
          </p>
          <a href="#pilot" className="tt-btn tt-btn-primary tt-btn-lg tt-motion-pop mt-6">
            Start a pilot →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">What your school gets</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-3xl border border-tt-line bg-white p-6">
              <div className="mx-auto w-fit"><TtIllustration kind={b.illustration} className="size-14" /></div>
              <p className="mt-3 text-center text-base font-black text-tt-navy">{b.title}</p>
              <p className="mt-1.5 text-center text-sm font-semibold leading-5 text-tt-ink-soft">{b.line}</p>
            </div>
          ))}
        </div>

        <h2 id="pilot" className="mt-14 scroll-mt-24 text-center text-2xl font-black text-tt-navy">Pilot in a week</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PILOT.map((p, i) => (
            <div key={p.title} className="rounded-3xl border border-tt-line bg-white p-6 text-center">
              <p className="text-xs font-black text-tt-ink-faint">STEP {i + 1}</p>
              <div className="mx-auto mt-2 w-fit"><TtIllustration kind={p.illustration} className="size-14" /></div>
              <p className="mt-3 text-base font-black text-tt-navy">{p.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{p.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border-2 border-tt-pine bg-white p-6">
          <p className="text-center text-[15px] font-black text-tt-navy">Zero risk, by design</p>
          <ul className="mx-auto mt-3 grid max-w-2xl gap-2 sm:grid-cols-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm font-semibold leading-5 text-tt-ink-soft">
                <span className="mt-0.5 shrink-0 font-black text-tt-pine" aria-hidden="true">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 rounded-3xl bg-tt-night p-8 text-center sm:p-10">
          <h2 className="text-2xl font-black text-white">Bring TailTots to your school</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] font-semibold leading-6 text-white/75">
            Pilots are free for Title I schools. We&rsquo;ll co-design the rollout with your team.
          </p>
          <a href="mailto:hello@tailtots.com?subject=School%20Pilot" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-sun px-8 py-3 text-sm font-black text-tt-ink">
            Email hello@tailtots.com →
          </a>
        </div>
      </div>
    </main>
  );
}
