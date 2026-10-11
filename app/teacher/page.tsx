/**
 * Teacher view — classroom mission board over the same AI backend.
 *
 * What teachers get:
 * - Assign age-banded missions from the Kindness Crew ladder
 * - Approve artifacts (Seesaw gatekeeper pattern) before they reach families
 * - See AGGREGATE trait trends for the class — never individual child data
 *
 * What teachers NEVER get: individual trait scores, raw behavioral streams,
 * or any child's cross-context data without parent consent.
 */
import Link from "next/link";
import { TtIllustration, type IllustrationKind } from "@/app/components/TtIllustration";

export const metadata = {
  title: "TailTots for Teachers — Classroom kindness missions",
  description: "Assign age-banded character missions, approve class moments, and see aggregate growth trends.",
};

const HOW_IT_WORKS: { illustration: IllustrationKind; title: string; line: string }[] = [
  {
    illustration: "mission",
    title: "Pick a mission",
    line: "Age-banded, 10–30 min. No prep.",
  },
  {
    illustration: "shield",
    title: "Approve the moment",
    line: "You approve photos before families see them.",
  },
  {
    illustration: "growth",
    title: "See the class bloom",
    line: "Aggregate trends only. Never individual data.",
  },
];

const GUARANTEES: { illustration: IllustrationKind; line: string }[] = [
  { illustration: "shield", line: "Your classroom only. Nothing from home without parent consent." },
  { illustration: "shield", line: "No individual scores, ever. Trends — never labels." },
  { illustration: "book", line: "You approve every artifact. Nothing auto-publishes." },
  { illustration: "hands", line: "Strength-based language only. No deficit labels possible." },
];

export default function TeacherPage() {
  return (
    <main className="min-h-screen bg-tt-cream">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Link href="/" className="text-sm font-bold text-tt-pine hover:underline">← Back to TailTots</Link>

        <div className="mt-6 text-center">
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <img
              src="/landing/audience-school-hero.jpg"
              alt="Students reading to a therapy dog in their classroom"
              className="aspect-[21/9] w-full object-cover"
            />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-tt-pine">For teachers</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-tt-navy sm:text-5xl">
            Character missions for your classroom
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Weekly missions, zero prep. You assign, you approve — never a child&apos;s data.
          </p>
          <a href="#start" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-pine px-8 py-3 text-sm font-black text-white shadow-lg">
            Bring it to my classroom →
          </a>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.title} className="rounded-3xl border border-tt-line bg-tt-paper p-5">
              <div className="mx-auto w-fit"><TtIllustration kind={s.illustration} className="size-12" /></div>
              <p className="mt-2 text-sm font-black text-tt-ink">{s.title}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">{s.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl bg-tt-night p-6 text-white sm:p-8">
          <h2 className="text-xl font-black">Our promise to your classroom</h2>
          <ul className="mt-4 space-y-3">
            {GUARANTEES.map((g, i) => (
              <li key={i} className="flex gap-3">
                <TtIllustration kind={g.illustration} className="size-8" />
                <p className="text-sm font-semibold leading-6 text-white/90">{g.line}</p>
              </li>
            ))}
          </ul>
        </div>

        <div id="start" className="mt-10 rounded-3xl border border-tt-line bg-tt-paper p-6 text-center sm:p-8">
          <h2 className="text-2xl font-black text-tt-ink">Start with one mission</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-6 text-tt-ink-soft">
            No signup, no roster, no IT ticket. Try one mission this week.
          </p>
          <div className="mt-4 rounded-2xl bg-tt-cream p-4 text-left">
            <p className="text-xs font-black uppercase tracking-widest text-tt-pine">This week&apos;s starter</p>
            <p className="mt-1 text-sm font-extrabold text-tt-ink">🤝 Welcome buddy</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-tt-ink-soft">
              Notice someone sitting alone at lunch or recess and invite them to join you — kindly, no pressure.
              10 minutes. Practices empathy and kindness.
            </p>
          </div>
          <a
            href="mailto:hello@tailtots.com?subject=TailTots%20for%20my%20classroom"
            className="tt-btn-press mt-5 inline-flex min-h-12 items-center rounded-xl bg-tt-sun px-8 py-3 text-sm font-black text-tt-ink"
          >
            Get the classroom kit →
          </a>
          <p className="mt-3 text-[11px] font-semibold text-tt-ink-faint">
            Free for Title I schools. Always free to try.
          </p>
        </div>
      </div>
    </main>
  );
}
