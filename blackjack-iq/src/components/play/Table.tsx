"use client";

import type { Card } from "@/lib/engine/cards";
import { handValue } from "@/lib/engine/cards";
import { type ChipValue, chipBreakdown, formatChips } from "@/lib/engine/bankroll";
import type { GameState, Outcome, PlayerHand } from "@/lib/engine/game";
import { ChipStack } from "../Chip";
import { PlayingCard } from "../PlayingCard";

const OUTCOME_STYLE: Record<Outcome, { label: string; cls: string }> = {
  blackjack: { label: "Blackjack!", cls: "bg-gradient-to-b from-gold-bright to-gold-deep text-ink" },
  win: { label: "Win", cls: "bg-good text-ink" },
  push: { label: "Push", cls: "bg-cream/85 text-ink" },
  lose: { label: "Lose", cls: "bg-bad text-white" },
  bust: { label: "Bust", cls: "bg-bad text-white" },
};

function TotalBadge({ cards, hidden = false }: { cards: Card[]; hidden?: boolean }) {
  if (cards.length === 0) return null;
  const v = handValue(cards);
  const text = hidden ? `${v.soft ? "Soft " : ""}${v.total}` : v.busted ? `${v.total} · Bust` : cards.length === 2 && v.total === 21 ? "21" : `${v.soft && v.total < 21 ? "Soft " : ""}${v.total}`;
  return (
    <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-sm font-bold tabular-nums text-cream shadow backdrop-blur-sm" data-testid="hand-total">
      {text}
    </span>
  );
}

function CardRow({ cards, faceDownFrom = Infinity, size, startIndex = 0, overlap }: { cards: Card[]; faceDownFrom?: number; size: "md" | "lg"; startIndex?: number; overlap: string }) {
  return (
    <div className="flex items-end justify-center">
      {cards.map((c, i) => (
        <PlayingCard
          key={c.id}
          card={i >= faceDownFrom ? undefined : c}
          faceDown={i >= faceDownFrom}
          size={size}
          dealIndex={i < 2 ? startIndex + i * 2 : 0}
          className={i > 0 ? overlap : ""}
          style={{ zIndex: i }}
        />
      ))}
    </div>
  );
}

export function DealerArea({ game, revealCount }: { game: GameState; revealCount: number }) {
  const shown = game.dealer.slice(0, Math.max(2, Math.min(game.dealer.length, revealCount)));
  const faceUp = shown.slice(0, revealCount);
  return (
    <div className="flex min-h-[150px] flex-col items-center gap-3 sm:min-h-[180px]" data-testid="dealer-area">
      <div className="flex h-7 items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-cream/60">Dealer</span>
        {shown.length > 0 && <TotalBadge cards={faceUp} hidden={revealCount < 2} />}
      </div>
      {shown.length > 0 ? (
        <CardRow cards={shown} faceDownFrom={revealCount} size="md" startIndex={1} overlap="-ml-9 sm:-ml-10" />
      ) : (
        <div className="grid h-[96px] w-[68px] place-items-center rounded-lg border-2 border-dashed border-cream/15 sm:h-[118px] sm:w-[84px]" aria-hidden />
      )}
    </div>
  );
}

function HandView({ hand, active, showOutcome, many }: { hand: PlayerHand; active: boolean; showOutcome: boolean; many: boolean }) {
  const outcome = showOutcome && hand.outcome ? OUTCOME_STYLE[hand.outcome] : null;
  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl px-2 pb-2 pt-3 transition-all duration-300 ${
        active ? "bg-gold/10 ring-2 ring-gold/70 shadow-[0_0_30px_rgba(212,175,90,0.25)]" : many ? "opacity-80" : ""
      }`}
      data-testid="player-hand"
      data-active={active}
    >
      <CardRow cards={hand.cards} size={many ? "md" : "lg"} startIndex={0} overlap={many ? "-ml-11 sm:-ml-14" : "-ml-12 sm:-ml-16"} />
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <TotalBadge cards={hand.cards} />
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold tabular-nums text-gold-bright">
          {formatChips(hand.bet)}
          {hand.doubled ? " · 2×" : ""}
        </span>
      </div>
      {outcome && (
        <span className={`animate-pop absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-sm font-extrabold uppercase tracking-wide shadow-lg ${outcome.cls}`} data-testid="hand-outcome">
          {outcome.label}
          {hand.net !== undefined && hand.net !== 0 ? ` ${formatChips(hand.net, { sign: true })}` : ""}
        </span>
      )}
    </div>
  );
}

export function PlayerArea({ game, showOutcome, pendingBet }: { game: GameState; showOutcome: boolean; pendingBet: number }) {
  const many = game.hands.length > 1;
  const inRound = game.hands.length > 0;
  const betChips: ChipValue[] = chipBreakdown(pendingBet);
  return (
    <div className="flex min-h-[230px] flex-col items-center justify-end gap-3 sm:min-h-[260px]" data-testid="player-area">
      {inRound ? (
        <div className="flex max-w-full flex-wrap items-end justify-center gap-x-4 gap-y-6 sm:gap-x-8">
          {game.hands.map((h, i) => (
            <HandView key={h.id} hand={h} active={game.phase === "player" && i === game.activeHand} showOutcome={showOutcome} many={many} />
          ))}
        </div>
      ) : null}
      {!inRound && (
        <div className="flex flex-col items-center gap-1">
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-gold/45 bg-black/15 shadow-[inset_0_0_25px_rgba(0,0,0,0.35)]" data-testid="bet-spot">
            {pendingBet > 0 ? <ChipStack chips={betChips} size={50} /> : <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/70">Place bet</span>}
          </div>
          <span className="text-sm font-bold tabular-nums text-cream" data-testid="pending-bet">
            {pendingBet > 0 ? formatChips(pendingBet) : " "}
          </span>
        </div>
      )}
    </div>
  );
}
