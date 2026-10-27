"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Brain, CheckCircle2, Info, Lightbulb, ShieldAlert, XCircle } from "lucide-react";
import { upcardLabel } from "@/lib/engine/cards";
import type { GameState } from "@/lib/engine/game";
import { ACTION_LABEL, DISCLAIMER, type ChartRef, type Recommendation, insuranceAdvice } from "@/lib/strategy/coach";
import { type DecisionFeedback, useApp } from "../AppProvider";
import { ActionPill, Panel, StrengthMeter } from "../ui";

export function chartHref(ref: ChartRef): string {
  return `/chart?t=${ref.table}&r=${ref.row}&u=${ref.up}`;
}

const choiceLabel = (c: DecisionFeedback["chosen"]) =>
  c === "insurance" ? "Take insurance" : c === "no-insurance" ? "Decline insurance" : ACTION_LABEL[c];

export function FeedbackCard({ fb }: { fb: DecisionFeedback }) {
  return (
    <div
      key={fb.id}
      className={`animate-rise rounded-xl border p-4 ${fb.correct ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10"}`}
      data-testid="feedback"
      role="status"
    >
      <div className="flex items-center gap-2 font-bold">
        {fb.correct ? <CheckCircle2 className="h-5 w-5 text-good" /> : <XCircle className="h-5 w-5 text-bad" />}
        <span className={fb.correct ? "text-good" : "text-bad"}>{fb.correct ? "Followed basic strategy" : "Not the basic-strategy play"}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {fb.position}: you chose <strong className="text-cream">{choiceLabel(fb.chosen)}</strong>
        {!fb.correct && (
          <>
            {" "}
            · recommended <strong className="text-cream">{choiceLabel(fb.recommended)}</strong>
          </>
        )}
      </p>
      {!fb.correct && <p className="mt-2 text-sm leading-relaxed text-cream/90">{fb.explanation}</p>}
      {fb.rec && (
        <Link href={chartHref(fb.rec.chartRef)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-bright">
          <BookOpen className="h-4 w-4" /> View in strategy chart
        </Link>
      )}
    </div>
  );
}

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
        <span className="text-sm font-semibold text-muted">Recommended</span>
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

export function CoachPanel({ game, rec }: { game: GameState; rec: Recommendation | null }) {
  const { settings, updateSettings, feedback } = useApp();
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const decisionKey = `${game.roundNumber}-${game.activeHand}-${game.hands[game.activeHand]?.cards.length ?? 0}`;
  const showFeedback = settings.feedback && feedback;

  let body: React.ReactNode;
  if (game.phase === "insurance") {
    const advice = insuranceAdvice(game.hands[0]?.status === "blackjack");
    body =
      settings.coach === "off" ? null : (
        <div className="space-y-2" data-testid="coach-insurance">
          <div className="flex items-center gap-2 font-bold text-cream">
            <ShieldAlert className="h-5 w-5 text-warn" /> Recommended: decline
          </div>
          <p className="text-sm leading-relaxed text-cream/90">{advice.explanation}</p>
        </div>
      );
  } else if (rec && settings.coach !== "off") {
    body =
      settings.coach === "always" || revealedFor === decisionKey ? (
        <RecommendationView rec={rec} />
      ) : (
        <button
          type="button"
          onClick={() => setRevealedFor(decisionKey)}
          className="w-full rounded-xl border border-dashed border-gold/40 py-4 text-sm font-semibold text-gold transition hover:bg-gold/5"
        >
          Show the coach&apos;s recommendation
        </button>
      );
  } else if (settings.coach === "off") {
    body = (
      <p className="text-sm text-muted">
        Pre-decision coaching is off.{" "}
        <button type="button" className="font-semibold text-gold underline-offset-2 hover:underline" onClick={() => updateSettings({ coach: "always" })}>
          Turn it on
        </button>
      </p>
    );
  } else {
    body = (
      <p className="text-sm leading-relaxed text-muted">
        Place a bet and deal. Before each decision the coach shows the basic-strategy play for your hand against the dealer&apos;s upcard, and afterwards it tells you how your choice compared.
      </p>
    );
  }

  return (
    <Panel title="Strategy Coach" icon={<Brain className="h-4 w-4" />} className="h-full">
      <div className="space-y-4">
        {showFeedback && <FeedbackCard fb={feedback} />}
        {body}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-dim">{DISCLAIMER}</p>
      </div>
    </Panel>
  );
}
