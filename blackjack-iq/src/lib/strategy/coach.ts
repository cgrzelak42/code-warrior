// The strategy coach: turns a hand + dealer upcard + legal actions into a recommendation,
// a strength rating, an explanation and a chart reference. Deterministic, no AI service.

import { type Card, type Rank, type UpcardValue, cardPoints, handValue, isPair, upcardLabel, upcardValue } from "../engine/cards";
import type { Action } from "../engine/game";
import { type Rules, canDoubleTotal } from "../engine/rules";
import { type PairRank, type StrategyCode, CODE_LABEL, chartForRules, deckClass } from "./chart";
import { type ActionEVs, actionEVs, dealerOutcome } from "./ev";

export type HandCategory = "hard" | "soft" | "pair";

export interface ChartRef {
  table: HandCategory;
  /** Hard/soft total, or pair card value (11 = aces). */
  row: number;
  up: UpcardValue;
}

export type Strength = "strong" | "clear" | "close";

export interface Recommendation {
  action: Action;
  code: StrategyCode;
  category: HandCategory;
  total: number;
  soft: boolean;
  chartRef: ChartRef;
  /** e.g. "Hard 16 vs 10" */
  position: string;
  ev: Partial<Record<Action, number>>;
  /** EV advantage of the recommended play over the next-best legal play (fraction of the bet). */
  edge: number | null;
  strength: Strength;
  /** 0–100 meter value derived from the edge. */
  strengthScore: number;
  explanation: string;
  dealerNote: string;
  dealerBust: number;
  notes: string[];
}

export interface LegalContext {
  canHit: boolean;
  canDouble: boolean;
  canSplit: boolean;
}

export const ACTION_LABEL: Record<Action, string> = { hit: "Hit", stand: "Stand", double: "Double Down", split: "Split" };

export function pairRow(rank: Rank): PairRank {
  return upcardValue(rank) as PairRank;
}

export function rowLabel(table: HandCategory, row: number): string {
  if (table === "pair") {
    const l = row === 11 ? "A" : row === 10 ? "10" : String(row);
    return `${l},${l}`;
  }
  if (table === "soft") return `A,${row - 11}`;
  return String(row);
}

export function positionLabel(ref: ChartRef): string {
  const up = upcardLabel(ref.up);
  if (ref.table === "pair") return `Pair ${rowLabel("pair", ref.row)} vs ${up}`;
  if (ref.table === "soft") return `Soft ${ref.row} (${rowLabel("soft", ref.row)}) vs ${up}`;
  return `Hard ${ref.row} vs ${up}`;
}

/** Legal actions on the first two cards under the rules (used by training and the chart). */
export function firstTwoCardContext(rules: Rules, cards: readonly Pick<Card, "rank">[]): LegalContext {
  const v = handValue(cards);
  return {
    canHit: v.total < 21,
    canDouble: v.total < 21 && canDoubleTotal(rules, v.total, v.soft),
    canSplit: isPair(cards),
  };
}

function resolveCode(code: StrategyCode, ctx: LegalContext): Action {
  switch (code) {
    case "P":
      return ctx.canSplit ? "split" : ctx.canHit ? "hit" : "stand";
    case "D":
      return ctx.canDouble ? "double" : ctx.canHit ? "hit" : "stand";
    case "Ds":
      return ctx.canDouble ? "double" : "stand";
    case "H":
      return ctx.canHit ? "hit" : "stand";
    case "S":
      return "stand";
  }
}

function dealerNoteFor(up: UpcardValue, bust: number): string {
  const pct = Math.round(bust * 100);
  const label = upcardLabel(up);
  if (up >= 2 && up <= 6)
    return `Dealer ${label} is a weak "bust card": from here the dealer busts about ${pct}% of the time.`;
  if (up <= 9)
    return `Dealer ${label} is a medium card: the dealer usually reaches a pat hand and busts only about ${pct}% of the time.`;
  return `Dealer ${label} is the strongest kind of upcard: the dealer busts only about ${pct}% of the time and often makes 19–21.`;
}

function explain(
  category: HandCategory,
  total: number,
  pairValue: number | null,
  up: UpcardValue,
  action: Action,
  code: StrategyCode,
  bust: number,
  rules: Rules,
): string {
  const upL = upcardLabel(up);
  const weak = up >= 2 && up <= 6;
  const strong = up >= 7;
  const bustPct = `${Math.round(bust * 100)}%`;
  const fellBack = (code === "D" || code === "Ds") && action !== "double";
  const fallbackNote = fellBack
    ? " The chart prefers doubling here, but doubling isn't available on this hand, so this is the next-best play."
    : "";

  if (category === "pair" && pairValue !== null) {
    const pl = pairValue === 11 ? "aces" : `${pairValue === 10 ? "ten" : pairValue}s`;
    if (action === "split") {
      if (pairValue === 11)
        return `Always split aces. Together they make a clumsy soft 12, but each ace starts a new hand at 11, a powerful starting point against any upcard.`;
      if (pairValue === 8)
        return `Always split 8s. Sixteen is the worst total in blackjack; two hands starting from 8 lose far less over time than one 16, even against a strong ${upL}.`;
      if (pairValue === 9)
        return `Split 9s against ${upL}. 18 is a good but not dominant total here; two hands starting at 9 earn more on average than standing on 18.`;
      return weak
        ? `Split ${pl} against the dealer's weak ${upL}. The dealer busts about ${bustPct} of the time, so playing two hands puts more money out while the dealer is vulnerable.${rules.doubleAfterSplit ? " Being allowed to double after splitting makes this even stronger." : ""}`
        : `Split ${pl} against ${upL}. Two hands starting from ${pairValue} play better than a single ${total}, which is weak against a ${upL}.`;
    }
    if (pairValue === 10)
      return `Never split tens. Hard 20 wins most hands, even against ${upL}; splitting would trade a strong position for two hands that each average far less.`;
    if (pairValue === 5)
      return `Never split 5s: play the hand as hard 10. ${action === "double" ? `Ten is an excellent doubling total against ${upL}.` : `Against ${upL}, hit and build your 10 into a strong total.`}${fallbackNote}`;
    if (pairValue === 9 && action === "stand")
      return up === 7
        ? `Stand on 9,9 against a 7. The dealer's likeliest result is 17, which your 18 already beats.`
        : `Stand on 9,9 against ${upL}. 18 holds up better than two hands starting from 9 against such a strong upcard.`;
    if (pairValue === 7 && action === "stand")
      return `With only one deck, two 7s leave few 7s for drawing, and standing on 14 against a ten narrowly beats hitting.`;
    return `Don't split ${pl} against ${upL}; splitting would just create two weak hands against a strong dealer card. Play it as hard ${total}: ${ACTION_LABEL[action].toLowerCase()}.${fallbackNote}`;
  }

  if (category === "soft") {
    if (action === "double")
      return `Double soft ${total} against the weak ${upL}. You can't bust with one card, and the dealer busts about ${bustPct} of the time, so this is the moment to get more money on the table.`;
    if (action === "hit")
      return total <= 17
        ? `Hit soft ${total}. ${total === 17 ? "Soft 17 rarely wins as it is" : "This total cannot win unless the dealer busts"}, and the ace means no single card can bust you.${fallbackNote}`
        : `Hit soft 18 against ${upL}. 18 is an underdog to a strong dealer card, and the soft ace lets you try to improve with no risk of busting on the next card.`;
    return total >= 19
      ? `Stand on soft ${total}. It is already a strong total; drawing would usually make it worse.${fallbackNote}`
      : `Stand on soft 18 against ${upL}. 18 is a solid total here; against a 7 or 8 it is already ahead of the dealer's likeliest outcome.${fallbackNote}`;
  }

  // Hard totals
  if (action === "double")
    return `Double on ${total} against ${upL}. ${total === 11 ? "Eleven" : `A ${total}`} is a strong starting point, and with ${weak ? `the dealer busting about ${bustPct} of the time` : "this many ten-value cards in the deck"} you hold the advantage, so doubling increases your expected win. You get exactly one more card.`;
  if (total >= 17)
    return `Stand on hard ${total}. Hitting would bust you too often${total >= 19 ? "" : "; even though 17 or 18 can lose, drawing makes it worse on average"}.`;
  if (total <= 11)
    return `Hit hard ${total}. No single card can bust you, so there's only upside in drawing.${fallbackNote}`;
  if (action === "stand") {
    return `Stand on hard ${total} against the dealer's weak ${upL}. The dealer busts about ${bustPct} of the time from here, while hitting your ${total} risks busting first. Let the dealer take the risk.`;
  }
  if (total === 12 && weak)
    return `Hit 12 against ${upL}. Only ten-value cards (4 of 13) bust you, and a ${upL} isn't weak enough to justify standing on such a low total.`;
  return strong
    ? `Hit hard ${total} against ${upL}. The dealer will usually make 17 or better (busting only about ${bustPct} of the time), so standing on ${total} mostly loses. Hitting risks a bust but loses less over many hands.`
    : `Hit hard ${total}.`;
}

/**
 * Basic-strategy recommendation for a hand. `ctx` lists the actions that are legal right now,
 * so the advice is always something the player can actually do.
 */
export function recommend(
  cards: readonly Pick<Card, "rank">[],
  dealerUp: Rank,
  rules: Rules,
  ctx: LegalContext,
): Recommendation {
  const v = handValue(cards);
  const up = upcardValue(dealerUp);
  const chart = chartForRules(rules);
  const pair = isPair(cards) && ctx.canSplit;
  let category: HandCategory;
  let code: StrategyCode;
  let ref: ChartRef;
  if (pair) {
    const pv = pairRow((cards[0] as Pick<Card, "rank">).rank);
    category = "pair";
    code = chart.pairs[pv][up];
    ref = { table: "pair", row: pv, up };
  } else if (v.soft && v.total >= 13) {
    category = "soft";
    code = (chart.soft[v.total] ?? chart.soft[21])![up];
    ref = { table: "soft", row: v.total, up };
  } else {
    category = v.soft ? "soft" : "hard";
    const t = v.soft ? 12 : Math.max(4, Math.min(21, v.total));
    code = v.soft ? "H" : chart.hard[t]![up];
    ref = { table: v.soft ? "soft" : "hard", row: v.soft ? 12 : t, up };
  }
  if (v.total >= 21) code = "S";
  const action = resolveCode(code, ctx);

  // Strength grading with the EV model.
  let hardSum = 0;
  let hasAce = false;
  for (const c of cards) {
    hardSum += cardPoints(c.rank);
    if (c.rank === "A") hasAce = true;
  }
  const evs: ActionEVs = actionEVs(hardSum, hasAce, up, rules, pair ? pairRow((cards[0] as Pick<Card, "rank">).rank) : null);
  const ev: Partial<Record<Action, number>> = { stand: evs.stand };
  if (ctx.canHit) ev.hit = evs.hit;
  if (ctx.canDouble) ev.double = evs.double;
  if (ctx.canSplit && evs.split !== null) ev.split = evs.split;
  const recEV = ev[action];
  const others = (Object.keys(ev) as Action[]).filter((a) => a !== action).map((a) => ev[a] as number);
  const edge = recEV === undefined || others.length === 0 ? null : recEV - Math.max(...others);
  let strength: Strength;
  if (edge === null) strength = "strong";
  else if (edge >= 0.1) strength = "strong";
  else if (edge >= 0.03) strength = "clear";
  else strength = "close";
  const strengthScore = edge === null ? 100 : Math.round(Math.max(8, Math.min(100, 30 + (edge / 0.25) * 70)));

  const dealer = dealerOutcome(up, rules.dealerHitsSoft17);
  const notes: string[] = [];
  const dc = deckClass(rules.decks);
  if (dc !== "multi")
    notes.push(
      `${dc === "single" ? "Single" : "Double"}-deck chart is total-dependent; rare composition-dependent exceptions are not modeled.`,
    );
  if (edge !== null && edge < 0)
    notes.push("Near-even decision: the simplified EV model rates the alternatives about equal. The published chart play is shown.");
  if (category === "pair" && action === "split" && rules.maxSplitHands > 2)
    notes.push("Split EV estimate assumes no resplits, so it slightly understates the value of splitting.");

  const pairValue = pair ? pairRow((cards[0] as Pick<Card, "rank">).rank) : null;
  return {
    action,
    code,
    category,
    total: v.total,
    soft: v.soft,
    chartRef: ref,
    position: positionLabel(ref),
    ev,
    edge,
    strength,
    strengthScore,
    explanation: explain(category, v.total, pairValue, up, action, code, dealer.bust, rules),
    dealerNote: dealerNoteFor(up, dealer.bust),
    dealerBust: dealer.bust,
    notes,
  };
}

/** Explanation for a chart cell, built from a representative two-card hand. */
export function explainCell(rules: Rules, table: HandCategory, row: number, up: UpcardValue): Recommendation {
  const cards = representativeHand(table, row);
  const ctx = firstTwoCardContext(rules, cards);
  if (table !== "pair") ctx.canSplit = false;
  return recommend(cards, up === 11 ? "A" : up === 10 ? "10" : (String(up) as Rank), rules, ctx);
}

export function representativeHand(table: HandCategory, row: number): { rank: Rank }[] {
  const r = (n: number): Rank => (n === 11 || n === 1 ? "A" : n === 10 ? "10" : (String(n) as Rank));
  if (table === "pair") return [{ rank: r(row) }, { rank: r(row) }];
  if (table === "soft") return [{ rank: "A" }, { rank: r(row - 11) }];
  if (row <= 11) return [{ rank: "2" }, { rank: r(row - 2) }];
  if (row === 21) return [{ rank: "10" }, { rank: "6" }, { rank: "5" }];
  if (row === 20) return [{ rank: "10" }, { rank: "K" }];
  return [{ rank: "10" }, { rank: r(row - 10) }];
}

export interface InsuranceAdvice {
  take: false;
  explanation: string;
}

export function insuranceAdvice(playerHasBlackjack: boolean): InsuranceAdvice {
  return {
    take: false,
    explanation: playerHasBlackjack
      ? "Decline even money. Insurance pays 2:1, but fewer than one card in three is a ten, so the side bet loses money over time, even when you hold blackjack."
      : "Decline insurance. It is a side bet that pays 2:1 on the dealer having a ten underneath, but only about 31% of cards are tens (it would need to be over 33% to break even).",
  };
}

export const DISCLAIMER =
  "Basic strategy is the mathematically best play for each situation on average. It improves your long-run results and reduces the house edge, but it can't remove the house edge or guarantee any single hand.";
