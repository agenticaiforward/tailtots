"use client";

/**
 * AudienceLanes — 4-tab audience switcher for the landing page.
 *
 * Each audience understands their benefit in 10 seconds:
 *   👨‍👩‍👧 Parents  → "AI that helps your child thrive" → Try it free
 *   🐾 Shelters → "Turn visits into character missions" → Partner with us
 *   🏫 Schools  → "Character development without the testing" → Pilot program
 *   🎉 PTOs     → "Fundraise through family challenges" → Start a campaign
 *
 * Visual-first: icons + short lines, never paragraphs.
 */

import { useState } from "react";

type LaneId = "parents" | "shelters" | "schools" | "ptos";

interface Lane {
  id: LaneId;
  tabIcon: string;
  tabLabel: string;
  headline: string;
  subline: string;
  benefits: { icon: string; title: string; line: string }[];
  ctaLabel: string;
  ctaHref: string;
  ctaSecondary?: { label: string; href: string };
}

const LANES: Lane[] = [
  {
    id: "parents",
    tabIcon: "👨‍👩‍👧",
    tabLabel: "Parents",
    headline: "An AI that helps your child thrive",
    subline: "Personalized missions, calm insights, zero surveillance. Ten minutes a day.",
    benefits: [
      { icon: "🎯", title: "Missions made for your kid", line: "AI builds each week around your child's needs — not a generic list." },
      { icon: "💡", title: "One insight a week", line: "A single useful observation, not a dashboard of worry." },
      { icon: "🐾", title: "A pet that grows with them", line: "Their companion evolves as they do — from egg to wise friend." },
    ],
    ctaLabel: "Try it free",
    ctaHref: "#start-onboarding",
  },
  {
    id: "shelters",
    tabIcon: "🐾",
    tabLabel: "Shelters",
    headline: "Turn shelter visits into character missions",
    subline: "Kids earn kindness badges through real shelter volunteering — and shelters get young advocates.",
    benefits: [
      { icon: "🤝", title: "Volunteer missions", line: "Walking, socializing, reading to animals — structured as kid missions." },
      { icon: "💛", title: "Donation goals kids earn", line: "Kids work toward real giving goals for animals waiting in shelters." },
      { icon: "📣", title: "Young advocates", line: "Every participating family becomes a voice for your animals." },
    ],
    ctaLabel: "Partner with us",
    ctaHref: "/for-shelters",
    ctaSecondary: { label: "How it works", href: "/for-shelters" },
  },
  {
    id: "schools",
    tabIcon: "🏫",
    tabLabel: "Schools",
    headline: "Character development without the testing",
    subline: "The alternative to SEL surveillance: growth kids choose, data parents own, zero student scoring.",
    benefits: [
      { icon: "🌱", title: "No student dashboards", line: "We never score, rank, or profile individual students. Ever." },
      { icon: "🏠", title: "Home-school bridge", line: "Character practice happens at home; teachers see participation, not psychology." },
      { icon: "📋", title: "Pilot in a week", line: "One classroom, one month, zero IT lift. We bring the kit." },
    ],
    ctaLabel: "Start a pilot",
    ctaHref: "/for-schools",
    ctaSecondary: { label: "Our student-data promise", href: "/promise" },
  },
  {
    id: "ptos",
    tabIcon: "🎉",
    tabLabel: "PTOs",
    headline: "Fundraise through family challenges",
    subline: "Turn your next fundraiser into missions families actually enjoy — with funds that track themselves.",
    benefits: [
      { icon: "🏆", title: "Challenge campaigns", line: "Read-a-thons, kindness weeks, step challenges — as TailTots missions." },
      { icon: "💰", title: "Funds on autopilot", line: "Pledges per mission, tracked automatically. No envelopes, no spreadsheets." },
      { icon: "👨‍👩‍👧", title: "Every family included", line: "Free to join, works on any phone. Nobody priced out of participating." },
    ],
    ctaLabel: "Start a campaign",
    ctaHref: "/for-ptos",
    ctaSecondary: { label: "See campaign ideas", href: "/for-ptos" },
  },
];

export default function AudienceLanes({ onTryFree }: { onTryFree?: () => void }) {
  const [active, setActive] = useState<LaneId>("parents");
  const lane = LANES.find((l) => l.id === active)!;

  const handleCta = (e: React.MouseEvent, href: string) => {
    if (href === "#start-onboarding" && onTryFree) {
      e.preventDefault();
      onTryFree();
    }
  };

  return (
    <section aria-label="Who TailTots is for" className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-tt-pine">
        Built for everyone raising kids
      </p>
      <h2 className="mt-2 text-center text-3xl font-black tracking-tight text-tt-navy sm:text-4xl">
        Pick your lane
      </h2>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Audience">
        {LANES.map((l) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={active === l.id}
            onClick={() => setActive(l.id)}
            className={`tt-btn-press flex min-h-12 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black transition-all ${
              active === l.id
                ? "bg-tt-pine text-white shadow-lg"
                : "border-2 border-tt-line bg-white text-tt-ink-soft hover:border-tt-pine"
            }`}
          >
            <span aria-hidden="true" className="text-lg">{l.tabIcon}</span>
            {l.tabLabel}
          </button>
        ))}
      </div>

      {/* Lane content — swaps in place */}
      <div key={lane.id} className="mt-8 rounded-3xl border border-tt-line bg-white p-6 shadow-sm sm:p-10">
        <h3 className="text-center text-2xl font-black tracking-tight text-tt-navy sm:text-3xl">
          {lane.headline}
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] font-semibold leading-6 text-tt-ink-soft">
          {lane.subline}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {lane.benefits.map((b) => (
            <div key={b.title} className="rounded-2xl bg-tt-cream p-5 text-center">
              <p className="text-4xl" aria-hidden="true">{b.icon}</p>
              <p className="mt-3 text-[15px] font-black text-tt-navy">{b.title}</p>
              <p className="mt-1.5 text-sm font-semibold leading-5 text-tt-ink-soft">{b.line}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={lane.ctaHref}
            onClick={(e) => handleCta(e, lane.ctaHref)}
            className="tt-btn-press inline-flex min-h-12 items-center rounded-xl bg-tt-pine px-8 py-3 text-sm font-black text-white shadow-lg"
          >
            {lane.ctaLabel} →
          </a>
          {lane.ctaSecondary && (
            <a
              href={lane.ctaSecondary.href}
              className="tt-btn-press inline-flex min-h-12 items-center rounded-xl border-2 border-tt-line bg-white px-6 py-3 text-sm font-black text-tt-pine"
            >
              {lane.ctaSecondary.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
