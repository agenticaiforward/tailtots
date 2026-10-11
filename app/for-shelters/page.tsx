import Link from "next/link";

export const metadata = {
  title: "TailTots for Shelters — Turn visits into character missions",
  description: "Partner with TailTots: kids earn kindness badges through real shelter volunteering.",
};

const STEPS = [
  { icon: "📝", title: "List your needs", line: "Dog walking, cat socializing, reading buddies — what do you need?" },
  { icon: "🐾", title: "We make missions", line: "Your needs become kid-safe missions, matched by age." },
  { icon: "💛", title: "Kids show up", line: "Families book visits. Kids earn badges; animals get love." },
];

const BENEFITS = [
  { icon: "🙋", stat: "Young volunteers", line: "Structured, age-matched kid volunteers" },
  { icon: "📣", stat: "Family advocates", line: "Every family amplifies your animals" },
  { icon: "💰", stat: "Donation goals", line: "Kids fundraise for food, medicine, beds" },
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
            Turn shelter visits into character missions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-7 text-tt-ink-soft">
            Real volunteering, structured for kids. You get helping hands — we handle the rest.
          </p>
          <a href="#partner" className="tt-btn-press mt-6 inline-flex min-h-12 items-center rounded-xl bg-tt-pine px-8 py-3 text-sm font-black text-white shadow-lg">
            Partner with us →
          </a>
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">How it works</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-3xl border border-tt-line bg-white p-6 text-center">
              <p className="text-xs font-black text-tt-ink-faint">STEP {i + 1}</p>
              <p className="mt-2 text-4xl" aria-hidden="true">{s.icon}</p>
              <p className="mt-3 text-base font-black text-tt-navy">{s.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{s.line}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-center text-2xl font-black text-tt-navy">What shelters get</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.stat} className="rounded-3xl bg-tt-pine-tint p-6 text-center">
              <p className="text-4xl" aria-hidden="true">{b.icon}</p>
              <p className="mt-3 text-base font-black text-tt-pine">{b.stat}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{b.line}</p>
            </div>
          ))}
        </div>

        <div id="partner" className="mt-14 rounded-3xl bg-tt-night p-8 text-center sm:p-10">
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
