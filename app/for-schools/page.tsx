import Link from "next/link";

export const metadata = {
  title: "TailTots for Schools — Character development without the testing",
  description: "The alternative to SEL surveillance: growth kids choose, data parents own, zero student scoring.",
};

const PRINCIPLES = [
  { icon: "🚫", title: "No student scoring", line: "Never scored, ranked, or profiled. No admin dashboards of child psychology." },
  { icon: "🏠", title: "Home is where it happens", line: "Schools see participation rates — never trait data." },
  { icon: "🔒", title: "Parents own everything", line: "Families control all data. Schools can't access or keep it." },
];

const PILOT = [
  { icon: "1️⃣", title: "Pick a classroom", line: "One class, one month. Zero IT lift." },
  { icon: "2️⃣", title: "Families opt in", line: "Parents choose. No mandates." },
  { icon: "3️⃣", title: "See participation", line: "Aggregate engagement only. Nothing more." },
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
            Character development without the testing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Character education without surveillance. Families own the data.
          </p>
          <a href="#pilot" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-pine px-8 py-3 text-sm font-black text-white shadow-lg">
            Start a pilot →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">Our student-data promise</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-3xl border-2 border-tt-pine bg-white p-6 text-center">
              <p className="text-4xl" aria-hidden="true">{p.icon}</p>
              <p className="mt-3 text-base font-black text-tt-navy">{p.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{p.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl bg-tt-sun/20 p-6 text-center">
          <p className="text-[15px] font-bold leading-6 text-tt-navy">
            “We were looking for character programming that didn&rsquo;t turn our students into data points.
            TailTots was the only option that put families first.”
          </p>
          <p className="mt-2 text-sm font-semibold text-tt-ink-soft">— Pilot school principal (name on request)</p>
        </div>

        <h2 id="pilot" className="mt-14 scroll-mt-24 text-center text-2xl font-black text-tt-navy">Pilot in a week</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PILOT.map((p) => (
            <div key={p.title} className="rounded-3xl border border-tt-line bg-white p-6 text-center">
              <p className="text-4xl" aria-hidden="true">{p.icon}</p>
              <p className="mt-3 text-base font-black text-tt-navy">{p.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{p.line}</p>
            </div>
          ))}
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
