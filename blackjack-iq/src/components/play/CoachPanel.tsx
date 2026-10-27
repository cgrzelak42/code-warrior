"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Brain, CheckCircle2, ChevronDown, Eye, Info, Lightbulb, XCircle } from "lucide-react";
import { upcardLabel } from "@/lib/engine/cards";
import type { Action, GameState } from "@/lib/engine/game";
import { ACTION_LABEL, DISCLAIMER, type ChartRef, type Recommendation } from "@/lib/strategy/coach";
import { type ReviewItem, useApp } from "../AppProvider";
import { PlayingCard } from "../PlayingCard";
import { ActionPill, Panel, StrengthMeter } from "../ui";

export function chartHref(ref: ChartRef): string {
  return `/chart?t=${ref.table}&r=${ref.row}&u=${ref.up}`;
}

const choiceLabel = (c: ReviewItem["chosen"]) =>
  c === "insurance" ? "Take insurance" : c === "no-insurance" ? "Decline insurance" : ACTION_LABEL[c];

export function oddsCaption(rec: Recommendation, decks: number): string {
  return rec.oddsFrom === "shoe"
    ? `Odds from the ${rec.shoeSize} cards you hadn't seen at that moment (the rest of the shoe plus the dealer's hole card).`
    : `Odds from a fresh ${decks}-deck shoe with these cards removed.`;
}

/** Value of each play, best first. */
export function EvTable({ rec }: { rec: Recommendation }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {(Object.entries(rec.ev) as [Action, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([a, v]) => (
            <tr key={a} className="border-t border-line">
              <td className={`py-1.5 ${a === rec.action ? "font-bold text-cream" : "text-muted"}`}>
                {ACTION_LABEL[a]}
                {a === rec.action && <span className="ml-1.5 text-xs font-semibold text-gold">basic strategy</span>}
              </td>
              <td className={`py-1.5 text-right tabular-nums ${v >= 0 ? "text-good" : "text-bad"}`}>
                {v >= 0 ? "+" : "−"}
                {Math.abs(v * 100).toFixed(1)}% of bet
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

/** Full write-up of a recommendation (used by the chart page). */
export function RecommendationView({ rec }: { rec: Recommendation }) {
  return (
    <div className="space-y-4" data-testid="coach-recommendation">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-line bg-ink/50 p-3">
          <div className="text-xs uppercase tracking-wider text-dim">Your hand</div>
          <div className="mt-0.5 font-bold text-cream">
            {rec.category === "pair" ? "Pair · " : ""}
            {rec.soft ? "Soft" : "Hard"} {rec.total}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-ink/50 p-3">
          <div className="text-xs uppercase tracking-wider text-dim">Dealer shows</div>
          <div className="mt-0.5 font-bold text-cream">{upcardLabel(rec.chartRef.up)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted">Basic strategy</span>
        <ActionPill action={rec.action} className="px-4 py-1 text-base" />
      </div>
      <StrengthMeter strength={rec.strength} score={rec.strengthScore} edge={rec.edge} />
      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold">
          <Lightbulb className="h-3.5 w-3.5" /> Why
        </h3>
        <p className="text-sm leading-relaxed text-cream/90">{rec.explanation}</p>
      </div>
      <p className="rounded-lg border border-line bg-ink/40 p-3 text-sm text-muted">{rec.dealerNote}</p>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          Chart: <strong className="text-cream">{rec.position}</strong>
        </span>
        <Link href={chartHref(rec.chartRef)} className="inline-flex items-center gap-1 font-semibold text-gold hover:text-gold-bright">
          <BookOpen className="h-4 w-4" /> Open
        </Link>
      </div>
      {rec.notes.map((n) => (
        <p key={n} className="flex gap-2 text-xs text-dim">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {n}
        </p>
      ))}
    </div>
  );
}

function ReviewCard({ item, decks, startOpen }: { item: ReviewItem; decks: number; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const rec = item.rec;
  return (
    <li className={`rounded-xl border p-4 ${item.correct ? "border-good/35 bg-good/[0.07]" : "border-bad/40 bg-bad/[0.08]"}`} data-testid="review-item">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-bold">
            {item.correct ? <CheckCircle2 className="h-5 w-5 shrink-0 text-good" /> : <XCircle className="h-5 w-5 shrink-0 text-bad" />}
            <span className={item.correct ? "text-good" : "text-bad"}>{item.correct ? "Basic strategy" : "Not basic strategy"}</span>
          </div>
          <div className="mt-1 text-sm text-cream">
            {item.handNumber > 0 && <span className="text-muted">Hand {item.handNumber} · </span>}
            {item.position}
          </div>
        </div>
        {item.cards.length > 0 && (
          <div className="flex shrink-0 items-center" aria-hidden>
            {item.cards.map((c, i) => (
              <PlayingCard key={c.id} card={c} size="sm" animate={false} className={i ? "-ml-9" : ""} />
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">
        You chose <strong className="text-cream">{choiceLabel(item.chosen)}</strong>
        {!item.correct && (
          <>
            {" "}
            · basic strategy says <strong className="text-cream">{choiceLabel(item.recommended)}</strong>
          </>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-cream/90">{item.explanation}</p>
      {rec && (
        <>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="mt-3 flex items-center gap-1 text-sm font-semibold text-gold hover:text-gold-bright"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            {open ? "Hide the odds" : "Show the odds"}
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              <StrengthMeter strength={rec.strength} score={rec.strengthScore} edge={rec.edge} />
              <p className="text-sm text-muted">{rec.dealerNote}</p>
              <EvTable rec={rec} />
              {rec.notes.map((n) => (
                <p key={n} className="flex gap-2 text-xs text-dim">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {n}
                </p>
              ))}
              <p className="text-xs text-dim">{oddsCaption(rec, decks)}</p>
              <Link href={chartHref(rec.chartRef)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-bright">
                <BookOpen className="h-4 w-4" /> View in strategy chart
              </Link>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function CoachPanel({ game, revealing }: { game: GameState; revealing: boolean }) {
  const { settings, updateSettings, review } = useApp();
  const inRound = game.phase === "player" || game.phase === "insurance";
  const items = review.round === game.roundNumber ? review.items : [];

  let body: React.ReactNode;
  if (!settings.coachReview) {
    body = (
      <p className="text-sm text-muted">
        The hand review is off.{" "}
        <button type="button" className="font-semibold text-gold underline-offset-2 hover:underline" onClick={() => updateSettings({ coachReview: true })}>
          Turn it on
        </button>
      </p>
    );
  } else if (inRound || revealing) {
    body = (
      <div className="flex gap-3 rounded-xl border border-line bg-ink/40 p-4" data-testid="coach-waiting">
        <Eye className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <div className="text-sm leading-relaxed text-muted">
          <p className="font-semibold text-cream">The coach is watching.</p>
          <p className="mt-1">
            Play the hand your way. Once the round is over, you&apos;ll see how each of your decisions compares with basic strategy.
          </p>
          {items.length > 0 && (
            <p className="mt-2 text-xs text-dim">
              {items.length} decision{items.length === 1 ? "" : "s"} noted so far.
            </p>
          )}
        </div>
      </div>
    );
  } else if (game.phase === "settled") {
    const right = items.filter((i) => i.correct).length;
    body =
      items.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted" data-testid="coach-review-empty">
          No decisions this round: {game.result?.playerBlackjack ? "your blackjack paid out straight away" : game.result?.dealerBlackjack ? "the dealer had blackjack" : "the round ended on the deal"}.
        </p>
      ) : (
        <div className="space-y-3" data-testid="coach-review">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-cream">Hand review</h3>
            <span className={`text-sm font-bold tabular-nums ${right === items.length ? "text-good" : "text-warn"}`}>
              {right} of {items.length} by the book
            </span>
          </div>
          {right === items.length && game.result && game.result.net < 0 && (
            <p className="text-sm text-muted">Every decision was right and the hand still lost. That&apos;s the randomness basic strategy can&apos;t remove.</p>
          )}
          {right < items.length && game.result && game.result.net > 0 && (
            <p className="text-sm text-muted">You won this round, but the plays marked below lose more often than basic strategy over many hands.</p>
          )}
          <ul className="space-y-3">
            {items.map((item) => (
              <ReviewCard key={item.id} item={item} decks={game.rules.decks} startOpen={!item.correct && items.length === 1} />
            ))}
          </ul>
        </div>
      );
  } else {
    body = (
      <p className="text-sm leading-relaxed text-muted">
        Place a bet and deal. The coach stays quiet while you play, then reviews every decision you made once the round is over, using the odds from the cards actually left in the shoe.
      </p>
    );
  }

  return (
    <Panel title="Strategy Coach" icon={<Brain className="h-4 w-4" />} className="h-full">
      <div className="space-y-4">
        {body}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-dim">{DISCLAIMER}</p>
      </div>
    </Panel>
  );
}
