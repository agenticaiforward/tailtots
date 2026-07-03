const missions = [
  ["Feed Luna", "Pet care", "+12", "Done"],
  ["Fresh water bowl", "Kindness", "+8", "Check"],
  ["Brush coat", "Empathy", "+10", "Voice"],
];

const traits: [string, number, string][] = [
  ["Responsibility", 86, "#0f766e"],
  ["Empathy", 74, "#dc6b19"],
  ["Kindness", 91, "#7c3aed"],
  ["Money habits", 63, "#2563eb"],
];

const pages = [
  "Landing",
  "Parent signup/login",
  "Family setup",
  "Add child",
  "Add pet",
  "Pet Passport",
  "Child dashboard",
  "Daily missions",
  "Rewards and stickers",
  "Kid Bank",
  "Parent approvals",
  "Family progress",
];

const tables = [
  "families",
  "parents",
  "children",
  "pets",
  "pet_passports",
  "tasks",
  "task_completions",
  "chores",
  "rewards",
  "stickers",
  "kid_bank_transactions",
  "savings_goals",
  "donations",
  "levels",
  "approvals",
];

const pro = [
  "Parent-approved payments",
  "Public pet-job marketplace",
  "Neighborhood job requests",
  "Family social messaging",
  "GPS safety check-ins",
  "Paid AI coaching APIs",
  "Local Ollama character coach",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fbfaf4] text-[#18231f]">
      <section className="overflow-hidden border-b border-[#ded8c7] bg-[#f7f1df]">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#165a4b] text-xl text-white shadow-sm">
              P
            </span>
            <span>
              <span className="block text-lg font-black">PawPal Quest</span>
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#6a736f]">
                Character Growth PWA
              </span>
            </span>
          </a>
          <div className="hidden items-center gap-2 rounded-full border border-[#d7cfb8] bg-white/70 p-1 text-sm font-bold md:flex">
            <a className="rounded-full px-4 py-2 hover:bg-[#ecf7f0]" href="#mvp">
              MVP
            </a>
            <a className="rounded-full px-4 py-2 hover:bg-[#ecf7f0]" href="#bank">
              Kid Bank
            </a>
            <a className="rounded-full px-4 py-2 hover:bg-[#ecf7f0]" href="#safety">
              Safety
            </a>
          </div>
          <a
            href="#prototype"
            className="rounded-full bg-[#18231f] px-4 py-2 text-sm font-black text-white shadow-sm"
          >
            View App
          </a>
        </nav>

        <div
          id="top"
          className="mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:pb-16"
        >
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-[#d9c9a4] bg-[#fffaf0] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#7a4b12]">
              A family app for real pet responsibility
            </p>
            <h1 className="text-5xl font-black leading-[0.95] tracking-normal text-[#13241f] sm:text-6xl lg:text-7xl">
              Raise caring kids, one pet mission at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#4b5b54]">
              PawPal Quest turns daily pet care, chores, saving goals, and
              parent-approved rewards into a child-safe growth system for
              responsibility, empathy, kindness, leadership, teamwork, financial
              literacy, community service, and animal welfare.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#mvp"
                className="rounded-full bg-[#f47b20] px-6 py-4 text-center text-sm font-black text-white shadow-[0_10px_24px_rgba(244,123,32,0.28)]"
              >
                Explore MVP
              </a>
              <a
                href="#architecture"
                className="rounded-full border border-[#b8c7bc] bg-white px-6 py-4 text-center text-sm font-black text-[#18322c]"
              >
                See build plan
              </a>
            </div>
          </div>

          <div id="prototype" className="relative mx-auto w-full max-w-[390px]">
            <div className="rounded-[2.1rem] border-8 border-[#1e2a26] bg-[#eff8f0] p-4 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#66736e]">
                    Today
                  </p>
                  <h2 className="text-2xl font-black">Maya + Luna</h2>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                  <p className="text-xs font-black text-[#68736f]">Level</p>
                  <p className="text-lg font-black text-[#0f766e]">Medium</p>
                </div>
              </div>
              <div className="rounded-3xl bg-[#165a4b] p-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#bfe7d7]">
                      Pet Passport
                    </p>
                    <h3 className="mt-1 text-3xl font-black">Luna</h3>
                    <p className="mt-1 text-sm font-semibold text-[#d7f5e8]">
                      Golden mix. Loves carrots. Needs evening brushing.
                    </p>
                  </div>
                  <div className="grid size-20 place-items-center rounded-full bg-[#ffd166] text-4xl">
                    🐶
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-black">
                  <span className="rounded-2xl bg-white/15 px-2 py-3">Fed</span>
                  <span className="rounded-2xl bg-white/15 px-2 py-3">Walked</span>
                  <span className="rounded-2xl bg-white/15 px-2 py-3">Loved</span>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {missions.map(([title, kind, points, state]) => (
                  <div
                    key={title}
                    className="flex items-center justify-between rounded-3xl bg-white p-4 shadow-sm"
                  >
                    <div>
                      <p className="font-black">{title}</p>
                      <p className="text-xs font-bold text-[#69746f]">{kind}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#f47b20]">{points}</p>
                      <p className="text-xs font-black text-[#0f766e]">{state}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-3xl bg-[#fff4d8] p-4">
                <p className="text-sm font-black">Kid Bank</p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs font-black">
                  {["Earn", "Save", "Spend", "Give"].map((item) => (
                    <span key={item} className="rounded-2xl bg-white px-2 py-3">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="mvp" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#0f766e]">
              MVP Pages
            </p>
            <h2 className="mt-3 text-4xl font-black">One flow for the whole family.</h2>
            <p className="mt-4 text-base font-medium leading-7 text-[#56645f]">
              Parent creates the family, adds children and pets, assigns missions,
              approves completions, then watches growth over time.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => (
              <div key={page} className="rounded-lg border border-[#ded8c7] bg-white p-4">
                <span className="text-xs font-black text-[#f47b20]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 font-black">{page}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#173d35] px-5 py-14 text-white sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#a8e4cf]">
              Growth Engine
            </p>
            <h2 className="mt-3 text-4xl font-black">Rewards character, not just chores.</h2>
          </div>
          <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
            {traits.map(([label, value, color]) => (
              <div key={label} className="rounded-lg bg-white/10 p-5">
                <div className="flex items-center justify-between font-black">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="mt-4 h-3 rounded-full bg-white/15">
                  <div
                    className="h-3 rounded-full"
                    style={{ width: `${value}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="bank" className="mx-auto grid max-w-7xl gap-5 px-5 py-14 sm:px-8 lg:grid-cols-3">
        {[
          ["Daily Missions", "Pet care checklists, household chores, quick voice check-ins, and Easy to Super Hard progression."],
          ["Rewards Studio", "Coins, stickers, badges, levels, family rewards, and parent-approved redemption rules."],
          ["Kid Bank", "Earn, save, spend, and give categories with goals for toys, pet food, treats, donations, and family rewards."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-lg border border-[#ded8c7] bg-white p-6">
            <h3 className="text-2xl font-black">{title}</h3>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#58665f]">{body}</p>
          </article>
        ))}
      </section>

      <section id="safety" className="bg-[#efe7d3] px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-7 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#7a4b12]">
              Child-safe by default
            </p>
            <h2 className="mt-3 text-4xl font-black">No social pressure in the free MVP.</h2>
            <p className="mt-4 font-medium leading-7 text-[#5d584a]">
              Children use secret-code login. Parents approve tasks, rewards, and
              money movement. MVP has no child-to-child messaging, public profiles,
              GPS tracking, payments, or marketplace access.
            </p>
          </div>
          <div className="rounded-lg bg-white p-6">
            <h3 className="text-xl font-black">Pro account modules</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pro.map((item) => (
                <div key={item} className="rounded-lg border border-[#ded8c7] px-4 py-3 text-sm font-black">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="architecture" className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#2563eb]">
              Open-source MVP stack
            </p>
            <h2 className="mt-3 text-4xl font-black">Next.js, TypeScript, Tailwind, Supabase, PostgreSQL, PWA.</h2>
            <p className="mt-4 font-medium leading-7 text-[#56645f]">
              No paid APIs are required for the first release. Optional local AI
              through Ollama can later summarize parent-approved growth patterns.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tables.map((table) => (
              <code key={table} className="rounded-lg bg-[#18231f] px-3 py-3 text-xs font-bold text-[#d8f3e7]">
                {table}
              </code>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
