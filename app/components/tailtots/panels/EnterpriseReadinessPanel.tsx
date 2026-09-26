"use client";
export function EnterpriseReadinessPanel() {
  const checks = [
    ["Child privacy", "Kids are not searchable, and community actions stay parent-led."],
    ["Reward governance", "Points, dollars, badges, and giving requests require parent approval."],
    ["Life-skills evidence", "Badges roll up into responsibility, empathy, teamwork, leadership, and time management."],
    ["Deployment path", "PWA-ready for phone, tablet, and home hub screens before native app investment."],
  ];

  return (
    <section className="rounded-lg border border-[#ded8c7] bg-[#17231f] p-5 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd166]">Family safety model</p>
      <h2 className="mt-2 text-2xl font-black sm:text-3xl">Parent-controlled, kid-simple, values-measurable</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {checks.map(([title, body]) => (
          <article key={title} className="rounded-lg bg-white/10 p-4">
            <p className="text-base font-black">{title}</p>
            <p className="mt-2 text-sm font-semibold leading-5 text-white/75">{body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
