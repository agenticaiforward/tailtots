import Link from "next/link";
import { TtIllustration, type IllustrationKind } from "../components/TtIllustration";

export const metadata = {
  title: "TailTots for PTOs — Fundraising without the stuff nobody wants",
  description: "Participation-based family challenges. No merchandise, no spreadsheets — live in a week.",
};

const BENEFITS: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "journey", title: "No merchandise", line: "Nothing to stock, ship, or store. No product sales, ever." },
  { illustration: "celebrate", title: "Pledges track themselves", line: "Pledges trigger as missions complete. No envelopes, no spreadsheets." },
  { illustration: "family", title: "Everyone included", line: "Free to join, works on any phone. Nobody is priced out." },
  { illustration: "growth", title: "A report to show", line: "End-of-campaign report for the school — participation and funds raised. Add a matching sponsor to double every pledge." },
];

const IDEAS: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "book", title: "Read-a-thon", line: "Kids log reading; sponsors pledge per book." },
  { illustration: "hands", title: "Kindness week", line: "Kindness missions, sponsored per act." },
  { illustration: "journey", title: "Step challenge", line: "Family steps over a weekend. Pledges per 1,000." },
  { illustration: "growth", title: "Garden grow-out", line: "Kids grow seedlings. Spring sale funds the PTO." },
];

const HOW: { illustration: IllustrationKind; title: string; line: string }[] = [
  { illustration: "mission", title: "Pick a challenge", line: "Templates or your own. Set dates and goal." },
  { illustration: "chat", title: "Invite families", line: "One link. Free, works on any phone." },
  { illustration: "celebrate", title: "Watch it grow", line: "Missions complete, pledges trigger. No envelopes." },
];

const TRUST = [
  "Campaign live within a week",
  "Free to join for every family",
  "Money goes straight to your PTO — never through TailTots",
  "No kid data collected or shared",
];

export default function ForPTOs() {
  return (
    <main className="min-h-screen bg-tt-cream">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <Link href="/" className="text-sm font-bold text-tt-pine hover:underline">← Back to TailTots</Link>

        <div className="mt-6 text-center">
          <div className="overflow-hidden rounded-3xl shadow-xl">
            <img src="/landing/audience-pto-hero.jpg" alt="Families at a school community fundraiser with a friendly dog" className="aspect-[21/9] w-full object-cover" />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-tt-pine">For PTOs & PTAs</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-tt-navy sm:text-5xl">
            Fundraising without the stuff nobody wants.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Participation-based challenges — no inventory, no selling, no spreadsheets.
          </p>
          <a href="#start" className="tt-btn tt-btn-primary tt-btn-lg tt-motion-pop mt-6">
            Start a campaign →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">What your PTO gets</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-3xl border border-tt-line bg-white p-6">
              <div className="mx-auto w-fit"><TtIllustration kind={b.illustration} className="size-14" /></div>
              <p className="mt-3 text-center text-base font-black text-tt-navy">{b.title}</p>
              <p className="mt-1.5 text-center text-sm font-semibold leading-5 text-tt-ink-soft">{b.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-tt-pine p-6 text-center sm:p-8">
          <div className="mx-auto w-fit"><TtIllustration kind="hands" className="size-14" /></div>
          <p className="mt-3 text-2xl font-black text-white">100% reaches your PTO</p>
          <p className="mx-auto mt-2 max-w-xl text-[15px] font-semibold leading-6 text-white/85">
            No platform cut. No processing deduction. Just connect your PTO&rsquo;s free
            Zeffy account to TailTots once — every dollar parents give lands directly
            in your PTO&rsquo;s bank account, never through us.
          </p>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">Campaign ideas</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {IDEAS.map((idea) => (
            <div key={idea.title} className="rounded-3xl border border-tt-line bg-white p-6">
              <div className="mx-auto w-fit"><TtIllustration kind={idea.illustration} className="size-14" /></div>
              <p className="mt-3 text-center text-base font-black text-tt-navy">{idea.title}</p>
              <p className="mt-1.5 text-center text-sm font-semibold leading-5 text-tt-ink-soft">{idea.line}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.title} className="rounded-3xl bg-tt-pine-tint p-6 text-center">
              <p className="text-xs font-black text-tt-ink-faint">STEP {i + 1}</p>
              <div className="mx-auto mt-2 w-fit"><TtIllustration kind={h.illustration} className="size-14" /></div>
              <p className="mt-3 text-base font-black text-tt-navy">{h.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{h.line}</p>
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

        <div id="start" className="mt-14 scroll-mt-24 rounded-3xl bg-tt-night p-8 text-center sm:p-10">
          <h2 className="text-2xl font-black text-white">Launch your campaign</h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] font-semibold leading-6 text-white/75">
            Tell us about your school and your fundraising goal. We&rsquo;ll have your
            campaign live within a week.
          </p>
          <a href="mailto:hello@tailtots.com?subject=PTO%20Campaign" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-sun px-8 py-3 text-sm font-black text-tt-ink">
            Email hello@tailtots.com →
          </a>
        </div>
      </div>
    </main>
  );
}
