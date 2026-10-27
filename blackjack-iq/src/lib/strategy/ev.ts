// Expected-value model. Used to rate how clear-cut a basic-strategy decision is (the EV gap
// between the recommended play and the next-best play) and to quote dealer bust odds. It
// assumes the dealer has already peeked and does not hold blackjack.
//
// Card odds come from a shoe composition: the cards actually left in the shoe at the table,
// a fresh N-deck shoe for the chart and training, or an endless deck when none is given.
// Within one hand the odds are held at that composition (cards drawn during the hand are not
// removed again), and split EV assumes no resplits. The chart remains the source of the
// recommendation; this model grades its strength.

import { type Card, type UpcardValue, cardPoints } from "../engine/cards";
import type { Rules } from "../engine/rules";

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Card counts by value: index 1 = aces, 2..9, 10 = all ten-value cards. Index 0 unused. */
export type ShoeCounts = number[];

export function emptyCounts(): ShoeCounts {
  return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

export function countsFromCards(cards: readonly Pick<Card, "rank">[]): ShoeCounts {
  const c = emptyCounts();
  for (const card of cards) c[cardPoints(card.rank)]! += 1;
  return c;
}

export function fullShoeCounts(decks: number): ShoeCounts {
  const c = emptyCounts();
  for (let v = 1; v <= 9; v++) c[v] = 4 * decks;
  c[10] = 16 * decks;
  return c;
}

/** Removes known cards (e.g. the player's hand and the dealer upcard) from a composition. */
export function withoutCards(counts: ShoeCounts, cards: readonly Pick<Card, "rank">[]): ShoeCounts {
  const c = counts.slice();
  for (const card of cards) {
    const v = cardPoints(card.rank);
    c[v] = Math.max(0, (c[v] ?? 0) - 1);
  }
  return c;
}

const INFINITE: number[] = [0, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 4 / 13];

/** Draw probabilities for each value; falls back to an endless deck for an empty or missing shoe. */
function probabilities(shoe?: ShoeCounts): number[] {
  if (!shoe) return INFINITE;
  const total = VALUES.reduce((a, v) => a + (shoe[v] ?? 0), 0);
  if (total <= 0) return INFINITE;
  return [0, ...VALUES.map((v) => (shoe[v] ?? 0) / total)];
}

export interface DealerOutcome {
  /** Probability of finishing on 17, 18, 19, 20, 21. */
  totals: Record<17 | 18 | 19 | 20 | 21, number>;
  bust: number;
}

const best = (hard: number, ace: boolean) => (ace && hard + 10 <= 21 ? hard + 10 : hard);

// Small bounded caches: shoe compositions change every hand, so entries are short-lived.
function boundedCache<V>(limit = 300) {
  const m = new Map<string, V>();
  return {
    get: (k: string) => m.get(k),
    set: (k: string, v: V) => {
      if (m.size >= limit) m.delete(m.keys().next().value as string);
      m.set(k, v);
    },
  };
}

const dealerCache = boundedCache<DealerOutcome>();

function dealerFromProbs(up: UpcardValue, hitsSoft17: boolean, P: number[]): DealerOutcome {
  const key = `${up}-${hitsSoft17}-${P.join(",")}`;
  const cached = dealerCache.get(key);
  if (cached) return cached;

  const memo = new Map<string, number[]>();
  // Returns [p17, p18, p19, p20, p21, pBust] from a given dealer state.
  const from = (hard: number, ace: boolean): number[] => {
    const k = `${hard}-${ace}`;
    const m = memo.get(k);
    if (m) return m;
    const total = best(hard, ace);
    const soft = ace && hard + 10 <= 21;
    let out: number[];
    if (total > 21) out = [0, 0, 0, 0, 0, 1];
    else if (total > 17 || (total === 17 && !(soft && hitsSoft17))) {
      out = [0, 0, 0, 0, 0, 0];
      out[total - 17] = 1;
    } else {
      out = [0, 0, 0, 0, 0, 0];
      for (const v of VALUES) {
        const p = P[v] as number;
        if (p === 0) continue;
        const sub = from(hard + v, ace || v === 1);
        for (let i = 0; i < 6; i++) out[i] = (out[i] as number) + p * (sub[i] as number);
      }
    }
    memo.set(k, out);
    return out;
  };

  const upV = up === 11 ? 1 : up;
  const dist = [0, 0, 0, 0, 0, 0];
  // Condition the hole card on "no dealer blackjack" (the dealer peeks on A and ten).
  const excluded = (v: number) => (upV === 1 && v === 10) || (upV === 10 && v === 1);
  let norm = 0;
  for (const v of VALUES) if (!excluded(v)) norm += P[v] as number;
  if (norm > 0) {
    for (const v of VALUES) {
      if (excluded(v) || P[v] === 0) continue;
      const sub = from(upV + v, upV === 1 || v === 1);
      for (let i = 0; i < 6; i++) dist[i] = (dist[i] as number) + ((P[v] as number) / norm) * (sub[i] as number);
    }
  }
  const result: DealerOutcome = {
    totals: { 17: dist[0] as number, 18: dist[1] as number, 19: dist[2] as number, 20: dist[3] as number, 21: dist[4] as number },
    bust: dist[5] as number,
  };
  dealerCache.set(key, result);
  return result;
}

export function dealerOutcome(up: UpcardValue, hitsSoft17: boolean, shoe?: ShoeCounts): DealerOutcome {
  return dealerFromProbs(up, hitsSoft17, probabilities(shoe));
}

export interface ActionEVs {
  stand: number;
  hit: number;
  double: number;
  split: number | null;
}

export function standEV(total: number, d: DealerOutcome): number {
  if (total > 21) return -1;
  let ev = d.bust;
  for (const t of [17, 18, 19, 20, 21] as const) {
    const p = d.totals[t];
    if (total > t) ev += p;
    else if (total < t) ev -= p;
  }
  return ev;
}

class HandModel {
  private hitMemo = new Map<string, number>();
  constructor(
    private d: DealerOutcome,
    private P: number[],
  ) {}

  stand(hard: number, ace: boolean): number {
    return standEV(best(hard, ace), this.d);
  }

  /** EV of hitting once and then playing optimally (hit/stand). */
  hit(hard: number, ace: boolean): number {
    const k = `${hard}-${ace}`;
    const m = this.hitMemo.get(k);
    if (m !== undefined) return m;
    let ev = 0;
    for (const v of VALUES) {
      const p = this.P[v] as number;
      if (p === 0) continue;
      const h = hard + v;
      const a = ace || v === 1;
      if (best(h, a) > 21) ev -= p;
      else ev += p * Math.max(this.stand(h, a), best(h, a) === 21 ? -Infinity : this.hit(h, a));
    }
    this.hitMemo.set(k, ev);
    return ev;
  }

  double(hard: number, ace: boolean): number {
    let ev = 0;
    for (const v of VALUES) ev += (this.P[v] as number) * 2 * this.stand(hard + v, ace || v === 1);
    return ev;
  }

  /** Best of stand/hit (and double when allowed) from a two-card state. */
  bestTwoCard(hard: number, ace: boolean, canDouble: boolean): number {
    const total = best(hard, ace);
    if (total === 21) return this.stand(hard, ace);
    let ev = Math.max(this.stand(hard, ace), this.hit(hard, ace));
    if (canDouble) ev = Math.max(ev, this.double(hard, ace));
    return ev;
  }
}

const modelCache = boundedCache<HandModel>();
function modelFor(up: UpcardValue, h17: boolean, P: number[]): HandModel {
  const k = `${up}-${h17}-${P.join(",")}`;
  let m = modelCache.get(k);
  if (!m) {
    m = new HandModel(dealerFromProbs(up, h17, P), P);
    modelCache.set(k, m);
  }
  return m;
}

/**
 * EVs (in units of the original bet) for each action from a hand described by its hard sum
 * (aces counted as 1) and whether it contains an ace. `shoe` is the composition the next cards
 * come from; omit it for an endless deck.
 */
export function actionEVs(
  hardSum: number,
  hasAce: boolean,
  up: UpcardValue,
  rules: Pick<Rules, "dealerHitsSoft17" | "doubleAfterSplit" | "hitSplitAces">,
  pairValue: number | null,
  shoe?: ShoeCounts,
): ActionEVs {
  const P = probabilities(shoe);
  const m = modelFor(up, rules.dealerHitsSoft17, P);
  let split: number | null = null;
  if (pairValue !== null) {
    const pv = pairValue === 11 ? 1 : pairValue;
    let ev = 0;
    for (const v of VALUES) {
      const hard = pv + v;
      const ace = pv === 1 || v === 1;
      const handEV =
        pv === 1 && !rules.hitSplitAces ? m.stand(hard, ace) : m.bestTwoCard(hard, ace, rules.doubleAfterSplit);
      ev += (P[v] as number) * handEV;
    }
    split = 2 * ev;
  }
  return {
    stand: m.stand(hardSum, hasAce),
    hit: best(hardSum, hasAce) >= 21 ? -1 : m.hit(hardSum, hasAce),
    double: m.double(hardSum, hasAce),
    split,
  };
}

/** Share of ten-value cards in a composition (insurance breaks even at one in three). */
export function tenShare(shoe?: ShoeCounts): number {
  return probabilities(shoe)[10] as number;
}
