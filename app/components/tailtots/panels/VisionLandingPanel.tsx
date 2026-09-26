"use client";

import { useEffect, useState } from "react";
import { submitFeedback, submitLaunchInterest } from "@/lib/data/engagement";
import { scrollWindowTo } from "../scroll";
import { petLooks } from "../avatar-looks";
import { ProfilePhoto } from "../ui";
export function VisionLandingPanel({
  openParentDemo,
  openKidDemo,
  onOpenPrivacyPolicy,
}: {
  openParentDemo: () => void;
  openKidDemo: () => void;
  onOpenPrivacyPolicy: () => void;
}) {
  const [echoSlideIndex, setEchoSlideIndex] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [launchInterest, setLaunchInterest] = useState({ email: "", city: "" });
  const [launchInterestStatus, setLaunchInterestStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [launchInterestMessage, setLaunchInterestMessage] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState({ email: "", message: "" });
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const careLoop = [
    ["1", "Parents choose the goal", "Pick the pet-care habit, life skill, reward, or giving purpose."],
    ["2", "Kids get a mission", "TailTots turns it into an age-fit action they can understand."],
    ["3", "Care happens offline", "Kids feed, notice, clean, comfort, save, or give in the real world."],
    ["4", "Growth gets celebrated", "Parents approve progress, badges, Kid Bank choices, and next steps."],
  ];
  const lifeSkills = [
    ["🐾 Responsibility", "Build habits by caring for pets, belongings, and everyday tasks.", "#e7f4ef", "#165a4b"],
    ["❤️ Kindness & Empathy", "Learn to care for animals, family, friends, and the community.", "#fff4d8", "#7a4b12"],
    ["💰 Money Skills", "Earn parent-approved rewards, save, spend, or give.", "#eef2ff", "#2563eb"],
    ["🤝 Teamwork & Leadership", "Complete missions together and learn to take ownership.", "#f8f6ed", "#5f4a24"],
    ["🌎 Community", "Turn kindness into action through shelters, volunteering, and local activities.", "#fde8df", "#b44421"],
  ];
  const trustCards = [
    ["Private by design", "Progress stays inside the family unless parents choose otherwise."],
    ["Parent controlled", "Adults approve missions, rewards, jobs, sharing, and money movement."],
    ["Guided AI", "Helpful prompts support care and learning without becoming an open chat."],
    ["No open kid chat", "No stranger messaging, public rankings, or uncontrolled rewards."],
  ];
  const kidsPetPhotos = [
    ["Kid + dog", "https://images.unsplash.com/photo-1528301725143-1ba694832e77?auto=format&fit=crop&w=720&q=80"],
    ["Kid + rabbit", "https://assets.moargut.com/moargut/2025/12/BAP_3958_RA_2021-1366x2048.jpg"],
    ["Kid + cat", "https://images.unsplash.com/photo-1740679953723-64630527299d?auto=format&fit=crop&w=720&q=80"],
    ["Kid + guinea pig", "https://c.nau.ch/i/LxxZQq/900/kontakt-tiere.jpg"],
  ];
  const echoSlides = [
    {
      step: "1",
      title: "Mission Mode",
      eyebrow: "Kid home screen",
      prompt: "Hi Sahasra. Jack needs fresh water and a comfort check.",
      action: "Start mission",
      detail: "A child sees one parent-approved mission with big steps, clear timing, and no distracting feed.",
      badge: "Parent approved",
      panelTitle: "Fresh water mission",
      panelItems: ["Fill the bottle", "Check the bowl", "Notice how Jack responds"],
      footerStats: ["8 points", "Responsibility", "4:00 PM"],
      bg: "#fff4d8",
      color: "#7a4b12",
    },
    {
      step: "2",
      title: "Guided Pet Helper",
      eyebrow: "Safe AI support",
      prompt: "Why is Jamie hiding? Let's look for quiet, food, water, and comfort.",
      action: "Ask helper",
      detail: "Guided AI supports pet-care learning without becoming open-ended kid chat.",
      badge: "No open chat",
      panelTitle: "Pet Helper answer",
      panelItems: ["Use a calm voice", "Check food and water", "Ask a parent before handling"],
      footerStats: ["Age-aware", "Kindness", "Parent rules"],
      bg: "#e7f4ef",
      color: "#165a4b",
    },
    {
      step: "3",
      title: "Kid Bank",
      eyebrow: "Earn, save, give",
      prompt: "You earned $2 after parent approval. Where should it go?",
      action: "Choose split",
      detail: "Money choices become part of the life-skills loop, not just a chore payout.",
      badge: "Parent released",
      panelTitle: "Today's split",
      panelItems: ["Save $1 for pet tunnel", "Give 50¢ to animal shelter", "Spend 50¢ later"],
      footerStats: ["Save", "Spend", "Give"],
      bg: "#eef2ff",
      color: "#2563eb",
    },
    {
      step: "4",
      title: "Parent Approval",
      eyebrow: "Trust gate",
      prompt: "Mission complete. Ask a parent to approve points, money, and badge.",
      action: "Ask parent",
      detail: "Kids can operate the flow, but adults still control rewards, sharing, and jobs.",
      badge: "Approval needed",
      panelTitle: "Waiting for parent",
      panelItems: ["Review mission note", "Approve $2 Kid Bank", "Award Kind Heart badge"],
      footerStats: ["Private", "No rankings", "Parent control"],
      bg: "#eef2ff",
      color: "#2563eb",
    },
    {
      step: "5",
      title: "Shelter Kindness",
      eyebrow: "Community mission",
      prompt: "This weekend: help build an adoption kit with your family.",
      action: "View quest",
      detail: "TailTots expands from family pet care into supervised kindness and animal welfare.",
      badge: "Family quest",
      panelTitle: "Shelter impact",
      panelItems: ["Pack towels", "Make a kind note", "Donate saved give-money"],
      footerStats: ["Shelter", "Giving", "Teamwork"],
      bg: "#fde8df",
      color: "#b44421",
    },
    {
      step: "6",
      title: "Growth Story",
      eyebrow: "Life-skills portfolio",
      prompt: "Aarush earned On-Time Helper for remembering RB before school.",
      action: "Celebrate",
      detail: "Each screen helps build a private record of responsibility, empathy, leadership, and confidence.",
      badge: "Badge earned",
      panelTitle: "Growth log",
      panelItems: ["Responsibility streak: 5 days", "Empathy note saved", "Leadership badge ready"],
      footerStats: ["Skills", "Moments", "Confidence"],
      bg: "#f0edff",
      color: "#6d3ed1",
    },
  ];
  const activeEchoSlide = echoSlides[echoSlideIndex];

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 520);
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTop);
  }, []);

  async function joinLaunchList() {
    setLaunchInterestStatus("saving");
    setLaunchInterestMessage("");
    try {
      const result = await submitLaunchInterest({
        email: launchInterest.email,
        city: launchInterest.city,
        source: "vision-landing",
      });
      setLaunchInterestStatus("saved");
      setLaunchInterestMessage(result.mode === "cloud" ? "You're on the TailTots family launch list." : "Thanks - you're on the TailTots update list.");
      setLaunchInterest((draft) => ({ ...draft, email: "" }));
    } catch (error) {
      setLaunchInterestStatus("error");
      setLaunchInterestMessage(error instanceof Error ? error.message : "Could not save this signup yet.");
    }
  }

  async function sendWebsiteFeedback() {
    setFeedbackStatus("saving");
    setFeedbackMessage("");
    try {
      const result = await submitFeedback({
        email: feedbackDraft.email,
        message: feedbackDraft.message,
        source: "vision-contact",
      });
      setFeedbackStatus("saved");
      setFeedbackMessage(result.mode === "cloud" ? "Thanks - your note reached TailTots." : "Thanks - your note was saved on this device.");
      setFeedbackDraft({ email: "", message: "" });
    } catch (error) {
      setFeedbackStatus("error");
      setFeedbackMessage(error instanceof Error ? error.message : "Could not send this note yet.");
    }
  }

  const scrollToLandingSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;
    const fixedHeaderOffset = 150;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - fixedHeaderOffset;
    scrollWindowTo(targetTop);
  };

  return (
    <section className="space-y-5">
      {showBackToTop && (
        <button
          onClick={() => scrollToLandingSection("landing-home")}
          className="fixed bottom-5 right-5 z-40 min-h-11 rounded-full bg-[#165a4b] px-4 py-2 text-sm font-black text-white shadow-lg ring-1 ring-white/50"
          aria-label="Back to top"
        >
          Top
        </button>
      )}

      <div id="landing-home" className="-mx-3 scroll-mt-36 overflow-hidden border-y border-[#ded8c7] bg-[#f7fbff] text-[#17231f] shadow-sm sm:mx-0 sm:rounded-lg sm:border">
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-5 xl:p-7">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#165a4b]">Parent-guided real-world growth</p>
            <h2 className="mt-2 max-w-3xl text-[2.35rem] font-black leading-[1.02] text-[#111b4f] sm:text-5xl xl:text-[3.35rem]">
              Pet care that grows capable, kind kids.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] font-semibold leading-6 text-[#31405f] sm:text-base sm:leading-7">
              Turn daily reminders into routines kids can own, with pet-centered missions parents approve and children can feel proud of.
            </p>
            <ul className="mt-4 grid max-w-2xl gap-2 sm:grid-cols-3">
              {[
                ["Parent-controlled approvals", "You approve missions, rewards, jobs, sharing, and money movement."],
                ["Animal-centered responsibility", "Real pets teach real care, empathy, and follow-through."],
                ["Screen-to-real-life design", "The app points kids back to the real world — not deeper into a feed."],
              ].map(([title, body]) => (
                <li key={title} className="rounded-lg border border-[#dce6f8] bg-white p-3">
                  <p className="text-sm font-black text-[#111b4f]">{title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#5f6a65]">{body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={openKidDemo} className="min-h-12 rounded-lg bg-[#f47b20] px-6 py-3 text-base font-black text-white sm:px-8">
                Try the kid demo
              </button>
              <button onClick={openParentDemo} className="min-h-12 rounded-lg border-2 border-[#165a4b] bg-white px-6 py-3 text-base font-black text-[#165a4b] sm:px-8">
                Parent access
              </button>
            </div>
            <p className="mt-3 max-w-2xl text-xs font-bold leading-5 text-[#5f6a65]">
              Explore with the sample family — no account needed, and parents stay in control of every step.
            </p>
            <p className="mt-4 max-w-2xl text-base font-black leading-6 text-[#111b4f] sm:text-lg sm:leading-7">
              Don&apos;t wait until kids enter social media to teach them how to navigate the social world.
            </p>
            <div className="mt-4 rounded-lg border border-[#ded8c7] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">Kids and their pets</p>
                  <p className="mt-1 text-sm font-bold text-[#5f6a65]">TailTots is built around the everyday bond kids have with dogs, cats, rabbits, guinea pigs, and the pets they learn to care for.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {kidsPetPhotos.map(([label, src]) => (
                  <div key={label} className="group overflow-hidden rounded-lg bg-[#f8f6ed] shadow-sm">
                    <img src={src} alt={`${label} using TailTots`} className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:aspect-[16/10]" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#31405f]">
              {['Parent approved', 'Guided AI', 'Kid Bank', 'Shelter kindness', 'Growth badges', 'No open kid chat'].map((label) => (
                <span key={label} className="rounded-full border border-[#dce6f8] bg-white px-3 py-2">{label}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-4xl space-y-4">
            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <article id="landing-demo" className="rounded-lg border border-[#ded8c7] bg-white p-4 shadow-sm sm:border-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#6d3ed1]">Demo</p>
                <h3 className="mt-2 text-2xl font-black text-[#17231f]">Explore with sample data</h3>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">
                  Use the sample family to test kid missions, parent approvals, points, Kid Bank, pets, and badges.
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <button onClick={openKidDemo} className="min-h-12 rounded-lg bg-[#ffd166] px-4 py-2 text-sm font-black text-[#17231f]">
                    Try the kid demo
                  </button>
                  <button onClick={openParentDemo} className="min-h-12 rounded-lg border border-[#dce6f8] bg-[#f7fbff] px-4 py-2 text-sm font-black text-[#1f3b7a]">
                    Parent access
                  </button>
                </div>
              </article>
              <article id="landing-real-app" className="rounded-lg border border-[#165a4b] bg-[#f7fffb] p-4 shadow-sm sm:border-2">
                <h3 className="text-2xl font-black text-[#17231f]">Join the family launch list</h3>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#5f6a65]">
                  Be first to hear when free family accounts are ready, plus early rewards and launch updates.
                </p>
                <div className="mt-4 grid gap-2">
                  <input
                    value={launchInterest.email}
                    onChange={(event) => setLaunchInterest((draft) => ({ ...draft, email: event.target.value }))}
                    className="min-h-11 rounded-lg border border-[#b8cfc6] bg-white px-3 text-sm font-bold"
                    inputMode="email"
                    placeholder="Parent email"
                    type="email"
                  />
                  <input
                    value={launchInterest.city}
                    onChange={(event) => setLaunchInterest((draft) => ({ ...draft, city: event.target.value }))}
                    className="min-h-11 rounded-lg border border-[#b8cfc6] bg-white px-3 text-sm font-bold"
                    placeholder="City"
                  />
                  <button onClick={joinLaunchList} disabled={launchInterestStatus === "saving"} className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:opacity-60">
                    {launchInterestStatus === "saving" ? "Saving..." : "Join launch updates"}
                  </button>
                </div>
                {launchInterestMessage && (
                  <p className={`mt-3 text-sm font-bold ${launchInterestStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`}>
                    {launchInterestMessage}
                  </p>
                )}
              </article>
            </div>
            <div id="landing-how-it-works" className="relative mx-auto rounded-2xl border border-black/10 bg-[#0f1513] p-2 shadow-2xl sm:rounded-[2rem] sm:p-5" aria-label="Tabletop smart display TailTots slideshow">
              <div className="absolute left-4 top-3 z-10 rounded-lg bg-[#ffd166] px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#17231f] shadow-lg sm:left-5 sm:top-4 sm:text-xs">
                Kid tabletop screen
              </div>
              <div className="absolute right-3 top-14 z-10 rounded-lg bg-white px-3 py-2 text-xs font-black text-[#111b4f] shadow-lg sm:right-4 sm:top-4 sm:px-4 sm:py-3 sm:text-sm">
                &quot;Alexa, open TailTots.&quot;
              </div>
              <div className="overflow-hidden rounded-xl bg-[#f8f6ed] p-3 pt-24 text-[#17231f] ring-1 ring-black/20 sm:rounded-[1.2rem] sm:p-5 sm:pt-16">
                <div className="grid gap-2 sm:flex sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: activeEchoSlide.color }}>{activeEchoSlide.eyebrow}</p>
                    <h4 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">{activeEchoSlide.title}</h4>
                  </div>
                  <span className="w-fit shrink-0 rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: activeEchoSlide.bg, color: activeEchoSlide.color }}>
                    {activeEchoSlide.badge}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[0.58fr_1.42fr]">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <ProfilePhoto label="TailTots pet" initial="J" colors={petLooks.jack.colors} size="lg" variant="pet" petKind="guinea" />
                    <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-[#69736f]">Jack and Jamie</p>
                    <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[9px] font-black leading-tight text-[#4f625b] sm:text-[10px]">
                      {activeEchoSlide.footerStats.map((stat) => (
                        <span key={stat} className="label-nowrap rounded-lg bg-[#f8f6ed] px-1 py-2">{stat}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg p-4" style={{ backgroundColor: activeEchoSlide.bg }}>
                    <p className="text-lg font-black leading-6" style={{ color: activeEchoSlide.color }}>
                      {activeEchoSlide.prompt}
                    </p>
                    <div className="mt-4 rounded-lg bg-white/80 p-3">
                      <p className="text-sm font-black text-[#17231f]">{activeEchoSlide.panelTitle}</p>
                      <div className="mt-3 grid gap-2">
                        {activeEchoSlide.panelItems.map((item, index) => (
                          <div key={item} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#4f625b]">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: activeEchoSlide.color }}>{index + 1}</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="text-sm font-semibold leading-5 text-[#4f625b]">{activeEchoSlide.detail}</p>
                  <button onClick={() => setEchoSlideIndex((echoSlideIndex + 1) % echoSlides.length)} className="min-h-12 rounded-lg bg-[#165a4b] px-5 py-3 text-sm font-black text-white">
                    {activeEchoSlide.action}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <span className="text-xs font-black text-[#69736f]">Click through the Echo screen concept</span>
                  <div className="flex gap-1">
                    {echoSlides.map((slide, index) => (
                      <span key={slide.step} className={`h-2 w-5 rounded-full ${echoSlideIndex === index ? "bg-[#165a4b]" : "bg-[#ded8c7]"}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mx-auto mt-3 h-2 w-24 rounded-full bg-white/20" />
            </div>
            <div className="mx-auto h-5 w-64 rounded-b-[2rem] bg-[#0a0f0d] shadow-xl" />
            <div className="mx-auto mt-4 rounded-lg border border-[#dce6f8] bg-white/90 p-4 shadow-sm">
              <p className="text-center text-lg font-black text-[#111b4f]">Parent phone for setup. Kid tabletop screen for missions.</p>
              <p className="text-center text-sm font-black text-[#111b4f]">Voice starts the mission, the counter screen shows each step, and parents stay in control.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="-mx-3 border-y border-[#ded8c7] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <div className="max-w-4xl">
          <div>
            <h3 className="text-2xl font-black sm:text-3xl">Every mission helps kids grow.</h3>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">Start with pet care, then grow into home, money, kindness, and community habits.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lifeSkills.map(([title, body, bg, color]) => (
            <article key={title} className="rounded-lg p-4" style={{ backgroundColor: bg }}>
              <p className="text-base font-black" style={{ color }}>{title}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="-mx-3 border-y border-[#ded8c7] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <div className="max-w-4xl">
          <div>
            <h3 className="text-2xl font-black sm:text-3xl">Kids can hear it. See it. Do it.</h3>
          </div>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#5f6a65]">A parent chooses the goal. TailTots turns it into clear kid steps, then waits for parent approval.</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {careLoop.map(([number, title, body]) => (
            <article key={number} className="flex gap-3 rounded-lg bg-[#f8f6ed] p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#165a4b] text-sm font-black text-white">{number}</span>
              <div className="min-w-0">
                <p className="font-black">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-[#5f6a65]">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="-mx-3 border-y border-[#ded8c7] bg-[#fff4d8] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
          <h3 className="text-2xl font-black sm:text-3xl">Founded by kids. Built for kids.</h3>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#5f4a24]">
            TailTots began with Aarush and Sahasra and a simple idea: what if everyday responsibilities could become something kids actually want to do?
          </p>
          <p className="mt-3 text-sm font-semibold leading-6 text-[#5f4a24]">
            That idea grew from caring for animals into a bigger vision - helping kids build responsibility, kindness, confidence, money skills, and independence through real-world experiences.
          </p>
        </article>

        <article className="-mx-3 border-y border-[#ded8c7] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
          <h3 className="text-2xl font-black sm:text-3xl">Safe learning, with parents always in control.</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {trustCards.map(([title, body]) => (
              <div key={title} className="rounded-lg bg-[#f8f6ed] p-4">
                <p className="font-black text-[#17231f]">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{body}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section aria-labelledby="landing-objections" className="-mx-3 border-y border-[#ded8c7] bg-[#f7fbff] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <h3 id="landing-objections" className="text-2xl font-black sm:text-3xl">Fair questions, straight answers.</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ["Isn't this just more screen time?", "No. The app is the starting line, not the finish line. Missions happen in the kitchen, the yard, and the neighborhood — the screen just helps kids plan, and parents confirm what really got done."],
            ["Is this a kid job board?", "No. TailTots is not a gig marketplace and not kid labor. There are no public jobs, no stranger hiring, no hustle culture — just care and character, with parents approving every step."],
            ["Do kids earn pets as prizes?", "Never. Readiness is proven over 8–12 weeks of real care, and parents make the final decision. TailTots never guarantees adoption and never replaces shelter screening."],
            ["Why animals?", "Animals teach what lectures can't: empathy, patience, and follow-through. A pet that depends on a child makes responsibility feel real — and worth being proud of."],
          ].map(([question, answer]) => (
            <div key={question} className="rounded-lg border border-[#dce6f8] bg-white p-4">
              <p className="font-black text-[#111b4f]">{question}</p>
              <p className="mt-2 text-sm font-semibold leading-5 text-[#4f625b]">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="-mx-3 border-y border-[#ded8c7] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
          <div className="grid gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
            <div>
              <h3 className="text-xl font-black">Everyone knows what is next.</h3>
            </div>
            <span className="w-fit rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-black text-[#2563eb]">This week</span>
          </div>
          <div className="mt-4 grid gap-2">
            {[["Mon", "Pet breakfast", "Kid schedule"], ["Wed", "Shelter kindness quest", "Family"], ["Sat", "Playdate window", "Parent shared"]].map(([day, item, scope]) => (
              <div key={item} className="grid grid-cols-[40px_1fr] gap-2 rounded-lg bg-[#f8f6ed] p-3 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:gap-3">
                <span className="text-xs font-black text-[#165a4b]">{day}</span>
                <span className="min-w-0 text-sm font-black">{item}</span>
                <span className="col-start-2 text-[11px] font-bold text-[#69736f] sm:col-start-auto sm:text-right">{scope}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="-mx-3 border-y border-[#ded8c7] bg-[#e7f4ef] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-black">$14.00</p>
              <p className="text-sm font-semibold text-[#4f625b]">Released only after parent approval</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#165a4b]">+ $2 earned</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[["Save", "$8"], ["Spend", "$4"], ["Give", "$2"]].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white p-3">
                <p className="text-lg font-black">{value}</p>
                <p className="text-xs font-bold text-[#5f6a65]">{label}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="-mx-3 border-y border-[#ded8c7] bg-[#fff4d8] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
          <h3 className="text-xl font-black">Kindness does not stop at the front door.</h3>
          <p className="mt-2 text-sm font-semibold leading-5 text-[#5f4a24]">
            TailTots can connect families with parent-approved ways to care, learn, and give back through shelters, animal welfare groups, and trusted local missions.
          </p>
          <div className="mt-4 rounded-lg bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">Help prepare a pet adoption kit</p>
                <p className="mt-1 text-xs font-bold text-[#69736f]">Trusted family group</p>
              </div>
              <span className="rounded-full bg-[#e7f4ef] px-3 py-1 text-xs font-black text-[#165a4b]">Age fit</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-[#2563eb]">Parent approved</span>
              <span className="rounded-full bg-[#f0edff] px-3 py-1 text-[#6d3ed1]">No child messaging</span>
              <span className="rounded-full bg-[#f8f6ed] px-3 py-1 text-[#5f4a24]">Adult nearby</span>
            </div>
          </div>
        </article>

        <article className="-mx-3 border-y border-[#ded8c7] bg-[#eef2ff] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-5">
          <h3 className="text-xl font-black">AI helps quietly underneath the mission.</h3>
          <p className="mt-2 text-sm font-semibold leading-5 text-[#33245f]">
            Kids get simple, age-aware care prompts while parents control setup, approvals, and what becomes visible.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {['Why is my pet hiding?', 'How can I make playtime calmer?', 'What should I notice today?', 'Tell me a pet-care fact'].map((question) => (
              <div key={question} className="min-h-12 rounded-lg bg-white px-3 py-3 text-left text-sm font-black text-[#33245f] shadow-sm">{question}</div>
            ))}
          </div>
        </article>
      </section>

      <section className="-mx-3 border-y border-[#ded8c7] bg-white p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h3 className="text-2xl font-black sm:text-3xl">Founded by kids. Built for kids.</h3>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#4f625b]">
              TailTots helps kids build responsibility, kindness, confidence, money skills, and independence through real-world experiences.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#4f625b]">
              {['Care', 'Connect', 'Earn', 'Contribute', 'Create', 'Parent control'].map((item) => (
                <span key={item} className="rounded-full bg-[#f8f6ed] px-3 py-2">{item}</span>
              ))}
            </div>
          </div>
          <button onClick={openKidDemo} className="min-h-12 rounded-lg bg-[#165a4b] px-6 py-3 text-sm font-black text-white">Explore the app</button>
        </div>
      </section>

      <section id="landing-contact" className="-mx-3 scroll-mt-36 border-y border-[#ded8c7] bg-[#f7fbff] p-4 shadow-sm sm:mx-0 sm:rounded-lg sm:border sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h3 className="text-2xl font-black sm:text-3xl">Questions, feedback, or partnership ideas?</h3>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#4f625b]">
              Send a note here or email <a className="font-black text-[#165a4b] underline decoration-[#ffd166] decoration-2 underline-offset-4" href="mailto:hello@tailtots.com">hello@tailtots.com</a>. A product email keeps TailTots professional while protecting your personal inbox.
            </p>
          </div>
          <div className="rounded-lg border border-[#c9d8f8] bg-white p-4 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={feedbackDraft.email}
                onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, email: event.target.value }))}
                className="min-h-11 rounded-lg border border-[#c9d8f8] px-3 text-sm font-bold"
                inputMode="email"
                placeholder="Your email, optional"
                type="email"
              />
              <input
                className="min-h-11 rounded-lg border border-[#c9d8f8] px-3 text-sm font-bold"
                value="TailTots website feedback"
                readOnly
                aria-label="Feedback topic"
              />
            </div>
            <textarea
              value={feedbackDraft.message}
              onChange={(event) => setFeedbackDraft((draft) => ({ ...draft, message: event.target.value }))}
              className="mt-2 min-h-28 w-full rounded-lg border border-[#c9d8f8] px-3 py-3 text-sm font-bold"
              placeholder="Ask a question, share feedback, or tell us what would make TailTots useful for your family."
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={sendWebsiteFeedback}
                disabled={feedbackStatus === "saving"}
                className="min-h-11 rounded-lg bg-[#165a4b] px-4 py-2 text-sm font-black text-white disabled:opacity-60"
              >
                {feedbackStatus === "saving" ? "Sending..." : "Send feedback"}
              </button>
              {feedbackMessage && (
                <p className={`text-sm font-bold ${feedbackStatus === "error" ? "text-[#b44421]" : "text-[#165a4b]"}`}>
                  {feedbackMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="-mx-3 mt-2 px-4 py-6 sm:mx-0 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-[#ded8c7] pt-4">
          <p className="text-xs font-bold text-[#69736f]">TailTots — parent-guided real-world growth.</p>
          <button
            onClick={onOpenPrivacyPolicy}
            className="min-h-10 rounded-lg px-3 py-2 text-xs font-black text-[#165a4b] underline decoration-[#ffd166] decoration-2 underline-offset-4"
          >
            Privacy Policy
          </button>
        </div>
      </footer>
    </section>
  );
}
