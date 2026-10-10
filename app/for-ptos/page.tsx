import Link from "next/link";

export const metadata = {
  title: "TailTots for PTOs — Fundraise through family challenges",
  description: "Turn fundraisers into missions families enjoy, with funds that track themselves.",
};

const IDEAS = [
  { icon: "📚", title: "Read-a-thon", line: "Kids log reading missions; sponsors pledge per book. Leaderboard optional — participation is the point." },
  { icon: "💛", title: "Kindness week", line: "A week of kindness missions. Local businesses sponsor each completed act." },
  { icon: "👟", title: "Step challenge", line: "Family step missions over a weekend. Pledges per 1,000 steps." },
  { icon: "🌱", title: "Garden grow-out", line: "Kids grow seedlings as missions. Spring plant sale funds the PTO." },
];

const HOW = [
  { icon: "🎯", title: "Pick a challenge", line: "Choose from templates or design your own. Set the dates and the goal." },
  { icon: "📣", title: "Invite families", line: "Share one link. Families join free — works on any phone." },
  { icon: "💰", title: "Watch it grow", line: "Missions complete, pledges trigger, funds track automatically. No envelopes." },
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
            Fundraise through family challenges
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Turn your next fundraiser into missions families actually enjoy —
            with pledges and funds that track themselves. No wrapping paper. No envelopes.
          </p>
          <a href="#start" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-pine px-8 py-3 text-sm font-black text-white shadow-lg">
            Start a campaign →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">Campaign ideas</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {IDEAS.map((idea) => (
            <div key={idea.title} className="rounded-3xl border border-tt-line bg-white p-6">
              <p className="text-4xl" aria-hidden="true">{idea.icon}</p>
              <p className="mt-3 text-base font-black text-tt-navy">{idea.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{idea.line}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HOW.map((h, i) => (
            <div key={h.title} className="rounded-3xl bg-tt-pine-tint p-6 text-center">
              <p className="text-xs font-black text-tt-ink-faint">STEP {i + 1}</p>
              <p className="mt-2 text-4xl" aria-hidden="true">{h.icon}</p>
              <p className="mt-3 text-base font-black text-tt-navy">{h.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{h.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-white border border-tt-line p-6 text-center">
          <p className="text-[15px] font-bold text-tt-navy">💡 Every family included</p>
          <p className="mx-auto mt-2 max-w-lg text-sm font-semibold leading-5 text-tt-ink-soft">
            Free to join, works on any phone. Participation-based, not purchase-based —
            nobody is priced out of your fundraiser.
          </p>
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
