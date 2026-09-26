"use client";
export function EcosystemRoadmapPanel() {
  const revenuePaths = [
    ["Family subscription", "$2-$5/month starter plan for chores, Kid Bank, badges, calendar, and parent controls."],
    ["Premium family plan", "$7-$10/month for AI planning, multi-kid fairness, availability links, portfolios, and advanced insights."],
    ["Neighborhood job fee", "Small flat or percentage fee on parent-approved paid jobs once trust and liquidity exist."],
    ["Shelter and sponsor programs", "Pet brands, shelters, and local partners sponsor quests, adoption learning, and donation drives."],
    ["Schools and community groups", "Life-skills curriculum, family clubs, scout-style programs, and neighborhood pilots."],
    ["Marketplace later", "Pet enrichment kits, adoption starter kits, allowance-funded goals, and trusted local services."],
  ];
  const ecosystemLoops = [
    ["Kid loop", "Learn skill -> care for pet -> complete task -> earn badge/money -> build confidence -> grow portfolio."],
    ["Parent loop", "Choose value -> approve job -> balance points -> verify completion -> track life-skill growth."],
    ["Neighborhood loop", "Trusted family posts need -> parent approves visibility -> kid confirms -> parent finalizes -> community trust grows."],
    ["Shelter loop", "Shelter posts learning quest -> family participates -> child earns impact badge -> shelter gains adopters, volunteers, donations."],
  ];
  const foundations = [
    ["Safety and privacy", "Parent-controlled accounts, no direct child messaging, limited public data, audit trail, and approval gates."],
    ["Secure backend", "Supabase or equivalent with row-level security, family isolation, encrypted transport, and deletion/export paths."],
    ["Kid portfolio", "Private skill evidence, badges, pet-care moments, completed missions, money habits, and volunteer history."],
    ["Partner console", "Later shelter, school, sponsor, and neighborhood admin surfaces with parent approval by default."],
  ];
  const phases = [
    ["Phase 1", "Family app: chores, pet care, Kid Bank, badges, calendar, parent AI, kid-safe AI prompts."],
    ["Phase 2", "Neighborhood beta: availability links, parent-approved jobs, playdates, trusted family groups."],
    ["Phase 3", "Impact network: shelters, adoption learning, volunteer quests, sponsor-backed badges."],
    ["Phase 4", "Youth pet entrepreneurship: portfolios, repeat customers, reputation, business tools, marketplace."],
  ];

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Path to profit and impact</p>
        <h2 className="mt-2 text-3xl font-black">TailTots ecosystem skeleton</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#dce7e2]">
          TailTots starts as a family-safe pet-care life-skills app, then expands into neighborhood jobs, shelter impact, sponsor programs, youth portfolios, and kid entrepreneurship.
        </p>
      </div>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0f766e]">Business model</p>
        <h3 className="mt-2 text-2xl font-black">Revenue paths to validate</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {revenuePaths.map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#e7f4ef] p-4">
              <p className="text-base font-black">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#7c3aed]">Impact loops</p>
        <h3 className="mt-2 text-2xl font-black">How value compounds</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {ecosystemLoops.map(([title, body]) => (
            <article key={title} className="rounded-lg bg-[#f0edff] p-4">
              <p className="text-base font-black text-[#33245f]">{title}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2563eb]">Product foundations</p>
          <h3 className="mt-2 text-2xl font-black">Build before scaling</h3>
          <div className="mt-4 grid gap-3">
            {foundations.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#eef2ff] p-4">
                <p className="text-base font-black">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#ded8c7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f47b20]">Rollout phases</p>
          <h3 className="mt-2 text-2xl font-black">From family tool to network</h3>
          <div className="mt-4 grid gap-3">
            {phases.map(([title, body]) => (
              <article key={title} className="rounded-lg bg-[#fff4d8] p-4">
                <p className="text-base font-black">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
