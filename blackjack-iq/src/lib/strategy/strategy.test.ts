import { describe, expect, it } from "vitest";
import type { Rank } from "../engine/cards";
import { UPCARDS } from "../engine/cards";
import { DEFAULT_RULES, type Rules } from "../engine/rules";
import { baseChart, chartForRules } from "./chart";
import { explainCell, firstTwoCardContext, insuranceAdvice, recommend } from "./coach";
import { actionEVs, dealerOutcome, fullShoeCounts, withoutCards } from "./ev";

const R = (over: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, ...over });
const hand = (...ranks: Rank[]) => ranks.map((rank) => ({ rank }));

function rec(r: Rules, ranks: Rank[], up: Rank) {
  const cards = hand(...ranks);
  return recommend(cards, up, r, firstTwoCardContext(r, cards));
}

describe("multi-deck basic strategy", () => {
  const s17 = R({ decks: 6, dealerHitsSoft17: false });
  const h17 = R({ decks: 6, dealerHitsSoft17: true });

  it.each([
    [["10", "6"], "10", "hit"],
    [["10", "6"], "6", "stand"],
    [["10", "2"], "3", "hit"],
    [["10", "2"], "4", "stand"],
    [["7", "5"], "2", "hit"],
    [["9", "4"], "2", "stand"],
    [["10", "7"], "A", "stand"],
    [["5", "4"], "2", "hit"],
    [["5", "4"], "3", "double"],
    [["6", "4"], "9", "double"],
    [["6", "4"], "10", "hit"],
    [["6", "5"], "10", "double"],
    [["6", "5"], "A", "hit"],
    [["A", "7"], "2", "stand"],
    [["A", "7"], "6", "double"],
    [["A", "7"], "9", "hit"],
    [["A", "6"], "3", "double"],
    [["A", "2"], "4", "hit"],
    [["A", "2"], "5", "double"],
    [["A", "8"], "6", "stand"],
    [["A", "A"], "A", "split"],
    [["8", "8"], "10", "split"],
    [["10", "K"], "6", "stand"],
    [["5", "5"], "9", "double"],
    [["9", "9"], "7", "stand"],
    [["9", "9"], "8", "split"],
    [["4", "4"], "5", "split"],
    [["2", "2"], "2", "split"],
    [["6", "6"], "7", "hit"],
  ] as [Rank[], Rank, string][])("S17 %j vs %s → %s", (cards, up, action) => {
    expect(rec(s17, cards, up).action).toBe(action);
  });

  it("H17 changes 11 vs A, soft 18 vs 2 and soft 19 vs 6", () => {
    expect(rec(h17, ["6", "5"], "A").action).toBe("double");
    expect(rec(h17, ["A", "7"], "2").action).toBe("double");
    expect(rec(h17, ["A", "8"], "6").action).toBe("double");
    expect(rec(s17, ["A", "8"], "6").action).toBe("stand");
  });

  it("no-DAS removes marginal splits", () => {
    const noDas = R({ decks: 6, dealerHitsSoft17: false, doubleAfterSplit: false });
    expect(rec(noDas, ["2", "2"], "2").action).toBe("hit");
    expect(rec(noDas, ["4", "4"], "5").action).toBe("hit");
    expect(rec(noDas, ["6", "6"], "2").action).toBe("hit");
    expect(rec(noDas, ["6", "6"], "3").action).toBe("split");
  });
});

describe("single and double deck variations", () => {
  it("single deck doubles 8 vs 6 and 9 vs 2, splits 7,7 vs 8 (DAS), stands 7,7 vs 10", () => {
    const r = R({ decks: 1, dealerHitsSoft17: false });
    expect(rec(r, ["5", "3"], "6").action).toBe("double");
    expect(rec(r, ["5", "4"], "2").action).toBe("double");
    expect(rec(r, ["7", "7"], "8").action).toBe("split");
    expect(rec(r, ["7", "7"], "10").action).toBe("stand");
    expect(rec(r, ["6", "5"], "A").action).toBe("double");
  });
  it("double deck doubles 9 vs 2 and 11 vs A under S17", () => {
    const r = R({ decks: 2, dealerHitsSoft17: false });
    expect(rec(r, ["5", "4"], "2").action).toBe("double");
    expect(rec(r, ["6", "5"], "A").action).toBe("double");
    expect(rec(r, ["5", "3"], "6").action).toBe("hit");
  });
});

describe("legal-action awareness", () => {
  it("falls back from double to hit / stand when doubling is not allowed", () => {
    const r = R();
    expect(recommend(hand("6", "5"), "6", r, { canHit: true, canDouble: false, canSplit: false }).action).toBe("hit");
    expect(recommend(hand("A", "7"), "4", r, { canHit: true, canDouble: false, canSplit: false }).action).toBe("stand");
    // three-card soft 18 vs 4 → stand (Ds fallback)
    expect(recommend(hand("A", "3", "4"), "4", r, { canHit: true, canDouble: false, canSplit: false }).action).toBe("stand");
  });

  it("uses the total when splitting is not possible", () => {
    const r = R();
    expect(recommend(hand("8", "8"), "10", r, { canHit: true, canDouble: true, canSplit: false }).action).toBe("hit");
    expect(recommend(hand("A", "A"), "6", r, { canHit: true, canDouble: true, canSplit: false }).action).toBe("hit");
    expect(recommend(hand("5", "5"), "6", r, { canHit: true, canDouble: true, canSplit: true }).category).toBe("pair");
  });

  it("respects double-on-10-11 rule in recommendations and chart", () => {
    const r = R({ doubleOn: "10-11" });
    expect(rec(r, ["5", "4"], "5").action).toBe("hit");
    expect(rec(r, ["A", "6"], "5").action).toBe("hit");
    expect(rec(r, ["A", "7"], "5").action).toBe("stand");
    expect(rec(r, ["6", "4"], "5").action).toBe("double");
    const chart = chartForRules(r);
    expect(chart.hard[9]![5]).toBe("H");
    expect(chart.soft[18]![5]).toBe("S");
    expect(chart.hard[10]![5]).toBe("D");
  });

  it("always stands on 21", () => {
    expect(rec(R(), ["A", "5", "5"], "10").action).toBe("stand");
  });

  it("never recommends insurance", () => {
    expect(insuranceAdvice(false).take).toBe(false);
    expect(insuranceAdvice(true).take).toBe(false);
  });
});

describe("chart integrity", () => {
  it("every chart cell exists for every rule combination", () => {
    for (const decks of [1, 2, 6] as const)
      for (const h17 of [true, false])
        for (const das of [true, false]) {
          const c = baseChart({ decks, dealerHitsSoft17: h17, doubleAfterSplit: das });
          for (const u of UPCARDS) {
            for (let t = 4; t <= 21; t++) expect(c.hard[t]?.[u]).toBeDefined();
            for (let t = 13; t <= 21; t++) expect(c.soft[t]?.[u]).toBeDefined();
            for (const p of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const) expect(c.pairs[p][u]).toBeDefined();
            expect(c.pairs[11][u]).toBe("P");
            expect(c.pairs[8][u]).toBe("P");
            expect(c.pairs[10][u]).toBe("S");
            expect(c.hard[17]![u]).toBe("S");
          }
        }
  });

  it("chart cell explanations agree with the chart", () => {
    const r = R();
    const chart = chartForRules(r);
    for (const u of UPCARDS) {
      for (let t = 5; t <= 20; t++) {
        const e = explainCell(r, "hard", t, u);
        const code = chart.hard[t]![u];
        const expected = code === "H" ? "hit" : code === "S" ? "stand" : "double";
        expect(e.action).toBe(expected);
        expect(e.explanation.length).toBeGreaterThan(20);
      }
      for (const p of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const e = explainCell(r, "pair", p, u);
        if (chart.pairs[p as 2]![u] === "P") expect(e.action).toBe("split");
      }
    }
  });

  it("the EV model agrees with the 6-deck chart outside known borderline cells", () => {
    const rules = { dealerHitsSoft17: false, doubleAfterSplit: true, hitSplitAces: false };
    const chart = baseChart({ decks: 6, ...rules });
    let mismatches = 0;
    for (const u of UPCARDS)
      for (let t = 5; t <= 20; t++) {
        const ev = actionEVs(t, false, u, rules, null);
        const best = ev.double > Math.max(ev.hit, ev.stand) ? "D" : ev.hit > ev.stand ? "H" : "S";
        const code = chart.hard[t]![u];
        if ((code === "Ds" ? "D" : code) !== best) mismatches++;
      }
    expect(mismatches).toBe(0);
  });
});

describe("EV model and strength", () => {
  it("dealer bust probabilities match published figures", () => {
    expect(dealerOutcome(6, false).bust).toBeCloseTo(0.423, 2);
    expect(dealerOutcome(10, false).bust).toBeCloseTo(0.23, 2);
    expect(dealerOutcome(6, true).bust).toBeGreaterThan(dealerOutcome(6, false).bust);
  });

  it("rates obvious plays strong and borderline plays close", () => {
    expect(rec(R(), ["10", "9"], "6").strength).toBe("strong");
    expect(rec(R(), ["A", "A"], "6").strength).toBe("strong");
    expect(rec(R({ dealerHitsSoft17: false }), ["10", "6"], "10").strength).toBe("close");
  });

  it("explanations never promise a win", () => {
    for (const u of ["2", "6", "9", "A"] as Rank[])
      for (const cards of [["10", "6"], ["A", "7"], ["8", "8"], ["6", "5"]] as Rank[][]) {
        const text = rec(R(), cards, u).explanation.toLowerCase();
        expect(text).not.toMatch(/guarantee|always win|sure win/);
      }
  });
});

describe("odds from the real shoe", () => {
  const r = R({ decks: 6, dealerHitsSoft17: false });

  it("a fresh 6-deck shoe gives nearly the same odds as an endless deck", () => {
    expect(dealerOutcome(6, false, fullShoeCounts(6)).bust).toBeCloseTo(dealerOutcome(6, false).bust, 2);
  });

  it("a ten-rich shoe makes the dealer's 6 bust more often", () => {
    const tenRich = fullShoeCounts(1);
    for (const v of [2, 3, 4, 5, 6]) tenRich[v] = 0;
    expect(dealerOutcome(6, false, tenRich).bust).toBeGreaterThan(dealerOutcome(6, false, fullShoeCounts(1)).bust + 0.05);
  });

  it("uses the live shoe when one is given and a fresh shoe otherwise", () => {
    const cards = hand("10", "6");
    const ctx = firstTwoCardContext(r, cards);
    const fresh = recommend(cards, "10", r, ctx);
    expect(fresh.oddsFrom).toBe("fresh-shoe");
    expect(fresh.shoeSize).toBe(312 - 3);
    const live = recommend(cards, "10", r, ctx, withoutCards(fullShoeCounts(6), [{ rank: "5" }, { rank: "4" }]));
    expect(live.oddsFrom).toBe("shoe");
    expect(live.shoeSize).toBe(310);
    // The recommendation itself is always basic strategy.
    expect(live.action).toBe(fresh.action);
  });

  it("notes when the shoe favours a different play than basic strategy", () => {
    // Basic strategy hits 16 vs 10. Once the 2s to 5s are gone, a hit almost always busts and
    // standing comes out ahead; the coach points that out but still grades against basic strategy.
    const tenRich = fullShoeCounts(1);
    for (const v of [2, 3, 4, 5]) tenRich[v] = 0;
    const rec16 = recommend(hand("10", "6"), "10", r, { canHit: true, canDouble: false, canSplit: false }, tenRich);
    expect(rec16.action).toBe("hit");
    expect(rec16.strength).toBe("close");
    expect(rec16.notes.join(" ")).toMatch(/Stand comes out/);
  });

  it("insurance advice quotes the live share of tens and still declines", () => {
    const tenRich = fullShoeCounts(1);
    for (const v of [2, 3, 4, 5]) tenRich[v] = 0;
    const rich = insuranceAdvice(false, tenRich);
    expect(rich.take).toBe(false);
    expect(rich.explanation).toMatch(/would actually be a good bet/);
    expect(insuranceAdvice(false, fullShoeCounts(6)).explanation).toMatch(/loses money/);
  });
});
