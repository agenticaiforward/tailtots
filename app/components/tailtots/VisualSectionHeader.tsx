/**
 * VisualSectionHeader — picture-first section headers for parent pages.
 *
 * Replaces text-heavy "kicker + big title + paragraph" blocks with a compact
 * visual header: animated icon, short title, one-line subtitle max.
 * Long explanations move into collapsible <details> — available, not imposed.
 */
"use client";

import type { ReactNode } from "react";

export function VisualSectionHeader({
  icon,
  title,
  subtitle,
  gradient = "from-tt-cream to-white",
}: {
  icon: string;
  title: string;
  subtitle?: string;
  gradient?: string;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-3xl bg-gradient-to-br ${gradient} p-3 ring-1 ring-tt-line`}>
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl shadow-sm tt-animate-float-slow">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-black leading-tight text-tt-ink sm:text-xl">{title}</h2>
        {subtitle && (
          <p className="truncate text-xs font-semibold text-tt-ink/60">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Collapsible explainer — long "how this works" text lives here,
 * one tap away instead of filling the screen.
 */
export function Explainer({
  label = "How this works",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-2xl bg-tt-cream/50 px-3 py-2">
      <summary className="cursor-pointer text-xs font-black text-tt-ink/70">
        💡 {label}
      </summary>
      <div className="pt-2 text-xs font-semibold leading-5 text-tt-ink/70">{children}</div>
    </details>
  );
}
