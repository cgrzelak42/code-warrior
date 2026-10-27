// Infinite-deck expected-value model. Used to rate how clear-cut a basic-strategy decision is
// (the EV gap between the recommended play and the next-best play) and to quote dealer bust
// odds. It assumes the dealer has already peeked and does not hold blackjack.
//
// Limitations (stated in the UI): infinite-deck probabilities (no card removal), split EV
// assumes no resplits. The chart remains the source of the recommendation; this model only
// grades its strength.

import type { UpcardValue } from "../engine/cards";
import type { Rules } from "../engine/rules";

/** Card value 1..10 (1 = ace) → probability in an infinite deck. */
const P = (v: number) => (v === 10 ? 4 / 13 : 1 / 13);
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface DealerOutcome {
  /** Probability of finishing on 17, 18, 19, 20, 21. */
  totals: Record<17 | 18 | 19 | 20 | 21, number>;
  bust: number;
}

const best = (hard: number, ace: boolean) => (ace && hard + 10 <= 21 ? hard + 10 : hard);

const dealerCache = new Map<string, DealerOutcome>();

export function dealerOutcome(up: UpcardValue, hitsSoft17: boolean): DealerOutcome {
  const key = `${up}-${hitsSoft17}`;
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
        const sub = from(hard + v, ace || v === 1);
        for (let i = 0; i < 6; i++) out[i] = (out[i] as number) + P(v) * (sub[i] as number);
      }
    }
    memo.set(k, out);
    return out;
  };

  const upV = up === 11 ? 1 : up;
  const dist = [0, 0, 0, 0, 0, 0];
  // Condition the hole card on "no dealer blackjack" (the dealer peeks on A and ten).
  let norm = 0;
  for (const v of VALUES) {
    if ((upV === 1 && v === 10) || (upV === 10 && v === 1)) continue;
    norm += P(v);
  }
  for (const v of VALUES) {
    if ((upV === 1 && v === 10) || (upV === 10 && v === 1)) continue;
    const sub = from(upV + v, upV === 1 || v === 1);
    for (let i = 0; i < 6; i++) dist[i] = (dist[i] as number) + (P(v) / norm) * (sub[i] as number);
  }
  const result: DealerOutcome = {
    totals: { 17: dist[0] as number, 18: dist[1] as number, 19: dist[2] as number, 20: dist[3] as number, 21: dist[4] as number },
    bust: dist[5] as number,
  };
  dealerCache.set(key, result);
  return result;
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
  constructor(private d: DealerOutcome) {}

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
      const h = hard + v;
      const a = ace || v === 1;
      if (best(h, a) > 21) ev -= P(v);
      else ev += P(v) * Math.max(this.stand(h, a), best(h, a) === 21 ? -Infinity : this.hit(h, a));
    }
    this.hitMemo.set(k, ev);
    return ev;
  }

  double(hard: number, ace: boolean): number {
    let ev = 0;
    for (const v of VALUES) ev += P(v) * 2 * this.stand(hard + v, ace || v === 1);
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

const modelCache = new Map<string, HandModel>();
function modelFor(up: UpcardValue, h17: boolean): HandModel {
  const k = `${up}-${h17}`;
  let m = modelCache.get(k);
  if (!m) {
    m = new HandModel(dealerOutcome(up, h17));
    modelCache.set(k, m);
  }
  return m;
}

/**
 * EVs (in units of the original bet) for each action from a hand described by its hard sum
 * (aces counted as 1) and whether it contains an ace.
 */
export function actionEVs(
  hardSum: number,
  hasAce: boolean,
  up: UpcardValue,
  rules: Pick<Rules, "dealerHitsSoft17" | "doubleAfterSplit" | "hitSplitAces">,
  pairValue: number | null,
): ActionEVs {
  const m = modelFor(up, rules.dealerHitsSoft17);
  let split: number | null = null;
  if (pairValue !== null) {
    const pv = pairValue === 11 ? 1 : pairValue;
    let ev = 0;
    for (const v of VALUES) {
      const hard = pv + v;
      const ace = pv === 1 || v === 1;
      const handEV =
        pv === 1 && !rules.hitSplitAces ? m.stand(hard, ace) : m.bestTwoCard(hard, ace, rules.doubleAfterSplit);
      ev += P(v) * handEV;
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
