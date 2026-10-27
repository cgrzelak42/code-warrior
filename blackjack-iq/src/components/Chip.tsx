"use client";

import type { ChipValue } from "@/lib/engine/bankroll";

const CHIP_STYLE: Record<ChipValue, { base: string; edge: string; text: string }> = {
  5: { base: "#b3262e", edge: "#f3e6d0", text: "#fff" },
  25: { base: "#1f7a4a", edge: "#f3e6d0", text: "#fff" },
  100: { base: "#1b1d22", edge: "#d4af5a", text: "#ecd08a" },
  500: { base: "#5b3aa0", edge: "#f3e6d0", text: "#fff" },
  1000: { base: "#c8a04a", edge: "#3a2a0c", text: "#2a1d05" },
};

export function Chip({ value, size = 56, className = "" }: { value: ChipValue; size?: number; className?: string }) {
  const s = CHIP_STYLE[value];
  const label = value >= 1000 ? `${value / 1000}K` : String(value);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={`chip-sheen-${value}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={s.base} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={s.edge} strokeWidth="9" strokeDasharray="14 11.1" />
      <circle cx="50" cy="50" r="31" fill={s.base} stroke={s.edge} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="48" fill={`url(#chip-sheen-${value})`} />
      <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize={label.length > 2 ? 22 : 26} fontWeight="800" fill={s.text} fontFamily="var(--font-manrope), sans-serif">
        {label}
      </text>
    </svg>
  );
}

/** A small stacked pile of chips representing a wager. */
export function ChipStack({ chips, size = 44 }: { chips: ChipValue[]; size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size + Math.max(0, chips.length - 1) * 5 }}>
      {chips.map((v, i) => (
        <div key={i} className="chip-anim absolute left-0 drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)]" style={{ bottom: i * 5, animationDelay: `${i * 30}ms` }}>
          <Chip value={v} size={size} />
        </div>
      ))}
    </div>
  );
}
