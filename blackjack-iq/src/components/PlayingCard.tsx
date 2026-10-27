"use client";

import type { CSSProperties } from "react";
import { type Card, type Rank, isRedSuit, suitSymbol } from "@/lib/engine/cards";

type Size = "sm" | "md" | "lg";

const SIZE: Record<Size, string> = {
  sm: "w-[52px] h-[74px] text-[13px]",
  md: "w-[68px] h-[96px] sm:w-[84px] sm:h-[118px] text-[15px] sm:text-[17px]",
  lg: "w-[88px] h-[124px] sm:w-[104px] sm:h-[146px] text-[18px] sm:text-[20px]",
};

// Pip layout (column%, row%) for number cards, like a real deck.
const PIPS: Partial<Record<Rank, [number, number][]>> = {
  "2": [[50, 18], [50, 82]],
  "3": [[50, 18], [50, 50], [50, 82]],
  "4": [[30, 18], [70, 18], [30, 82], [70, 82]],
  "5": [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  "6": [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  "7": [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  "8": [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  "9": [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  "10": [[30, 16], [70, 16], [50, 28], [30, 39], [70, 39], [30, 61], [70, 61], [50, 72], [30, 84], [70, 84]],
};

function Face({ card }: { card: Card }) {
  const red = isRedSuit(card.suit);
  const sym = suitSymbol(card.suit);
  const color = red ? "text-[#c0242f]" : "text-[#16181c]";
  const pips = PIPS[card.rank];
  const court = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  return (
    <div
      className={`card-face absolute inset-0 overflow-hidden rounded-[9%/6.5%] border border-black/10 bg-gradient-to-br from-white to-[#f1ece2] shadow-[0_6px_14px_rgba(0,0,0,0.45)] ${color}`}
    >
      <div className="absolute left-[7%] top-[5%] flex flex-col items-center leading-none font-bold">
        <span className="font-sans tracking-tighter">{card.rank}</span>
        <span className="text-[0.85em]">{sym}</span>
      </div>
      <div className="absolute bottom-[5%] right-[7%] flex rotate-180 flex-col items-center leading-none font-bold">
        <span className="font-sans tracking-tighter">{card.rank}</span>
        <span className="text-[0.85em]">{sym}</span>
      </div>
      <div className="absolute inset-x-[20%] inset-y-[14%]">
        {card.rank === "A" ? (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[2.6em] leading-none">{sym}</span>
        ) : court ? (
          <div className={`absolute inset-0 grid place-items-center rounded-[6px] border ${red ? "border-[#c0242f]/40" : "border-black/30"} bg-gradient-to-b from-[#f7e7b8]/70 to-[#e9d39a]/40`}>
            <span className="font-display text-[2.1em] font-bold leading-none">{card.rank}</span>
            <span className="absolute bottom-[8%] text-[0.9em]">{sym}</span>
            <span className="absolute top-[8%] text-[0.9em]">{sym}</span>
          </div>
        ) : (
          pips?.map(([x, y], i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[1.05em] leading-none"
              style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%)${y > 55 ? " rotate(180deg)" : ""}` }}
            >
              {sym}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function Back() {
  return (
    <div className="card-face card-back-face absolute inset-0 rounded-[9%/6.5%] border border-black/40 bg-[#4a0f17] p-[7%] shadow-[0_6px_14px_rgba(0,0,0,0.45)]">
      <div className="card-back-pattern grid h-full w-full place-items-center rounded-[6%/4%] border border-gold/50">
        <span className="font-display text-[1.1em] font-bold text-gold/80">IQ</span>
      </div>
    </div>
  );
}

export interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: Size;
  /** Order in the deal, used to stagger the deal animation. */
  dealIndex?: number;
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function PlayingCard({ card, faceDown = false, size = "md", dealIndex = 0, animate = true, className = "", style }: PlayingCardProps) {
  const label = faceDown || !card ? "Face-down card" : `${card.rank} of ${card.suit}`;
  return (
    <div
      role="img"
      aria-label={label}
      className={`card-3d relative shrink-0 ${SIZE[size]} ${animate ? "animate-deal" : ""} ${className}`}
      style={{ animationDelay: animate ? `calc(var(--deal-ms) * ${dealIndex * 0.45})` : undefined, ...style }}
    >
      <div className="card-inner relative h-full w-full" data-flipped={faceDown || !card ? "true" : "false"}>
        {card ? <Face card={card} /> : <div className="card-face absolute inset-0" />}
        <Back />
      </div>
    </div>
  );
}
