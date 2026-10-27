"use client";

// Small shared presentational pieces.

import type { ReactNode } from "react";
import type { Action } from "@/lib/engine/game";
import type { StrategyCode } from "@/lib/strategy/chart";
import type { Strength } from "@/lib/strategy/coach";

export function Panel({ children, className = "", title, icon, action }: { children: ReactNode; className?: string; title?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-line bg-gradient-to-b from-panel to-charcoal p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${className}`}>
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-gold">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export const ACTION_COLOR: Record<Action, string> = {
  hit: "var(--color-act-hit)",
  stand: "var(--color-act-stand)",
  double: "var(--color-act-double)",
  split: "var(--color-act-split)",
};

export const CODE_COLOR: Record<StrategyCode, string> = {
  H: "var(--color-act-hit)",
  S: "var(--color-act-stand)",
  D: "var(--color-act-double)",
  Ds: "var(--color-act-double)",
  P: "var(--color-act-split)",
};

export function ActionPill({ action, label, className = "" }: { action: Action; label?: string; className?: string }) {
  const text = label ?? { hit: "Hit", stand: "Stand", double: "Double Down", split: "Split" }[action];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold text-white ${className}`}
      style={{ background: ACTION_COLOR[action] }}
    >
      {text}
    </span>
  );
}

const STRENGTH_LABEL: Record<Strength, string> = { strong: "Strong", clear: "Clear", close: "Close call" };

export function StrengthMeter({ strength, score, edge }: { strength: Strength; score: number; edge: number | null }) {
  const color = strength === "strong" ? "var(--color-good)" : strength === "clear" ? "var(--color-gold)" : "var(--color-warn)";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-muted">Recommendation strength</span>
        <span className="font-bold" style={{ color }}>
          {STRENGTH_LABEL[strength]}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label="Recommendation strength">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${score}%`, background: color }} />
      </div>
      {edge !== null && (
        <p className="mt-1.5 text-xs text-dim">
          {edge >= 0
            ? `About ${(edge * 100).toFixed(1)}% of your bet better than the next-best play, on average.`
            : "The alternatives are almost exactly equal in value."}
        </p>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block font-semibold text-cream">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${checked ? "border-gold/60 bg-gold/80" : "border-line bg-panel-2"}`}
      >
        <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-cream shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-ink/60 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${o.value === value ? "bg-gold text-ink shadow" : "text-muted hover:text-cream"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "default" | "good" | "bad" | "gold" }) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "gold" ? "text-gold-bright" : "text-cream";
  return (
    <div className="rounded-xl border border-line bg-panel/80 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1.5 text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-dim">{sub}</div>}
    </div>
  );
}
