// Basic-strategy charts derived from the active rules.
//
// Sources: standard published total-dependent basic strategy (e.g. Wizard of Odds / Griffin)
// for single-deck, double-deck and 4–8 deck games, with H17/S17 and DAS/no-DAS variants.
// The game offers no surrender, so the no-surrender charts are used.

import type { UpcardValue } from "../engine/cards";
import { UPCARDS } from "../engine/cards";
import { type Rules, canDoubleTotal } from "../engine/rules";

/** H hit · S stand · D double (else hit) · Ds double (else stand) · P split. */
export type StrategyCode = "H" | "S" | "D" | "Ds" | "P";
export type ChartRow = Record<UpcardValue, StrategyCode>;
export type DeckClass = "single" | "double" | "multi";
export type PairRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface StrategyChart {
  deckClass: DeckClass;
  /** Hard totals 4..21. */
  hard: Record<number, ChartRow>;
  /** Soft totals 13..21 (A,2 through A,10). Soft 12 is A,A, handled as a pair or a hit. */
  soft: Record<number, ChartRow>;
  /** Pair rows keyed by card value (11 = aces). Non-split cells hold the play for the hand. */
  pairs: Record<PairRank, ChartRow>;
}

export function deckClass(decks: number): DeckClass {
  if (decks === 1) return "single";
  if (decks === 2) return "double";
  return "multi";
}

type Spec = Partial<Record<UpcardValue, StrategyCode>>;

function row(base: StrategyCode, ...overrides: [UpcardValue[], StrategyCode][]): ChartRow {
  const r = {} as ChartRow;
  for (const u of UPCARDS) r[u] = base;
  for (const [ups, code] of overrides) for (const u of ups) r[u] = code;
  return r;
}

function merge(r: ChartRow, spec: Spec): ChartRow {
  return { ...r, ...spec };
}

const R = (a: UpcardValue, b: UpcardValue): UpcardValue[] => UPCARDS.filter((u) => u >= a && u <= b);

function hardTable(dc: DeckClass, h17: boolean): Record<number, ChartRow> {
  const t: Record<number, ChartRow> = {};
  for (let total = 4; total <= 21; total++) t[total] = row(total >= 17 ? "S" : "H");
  if (dc === "single") t[8] = row("H", [R(5, 6), "D"]);
  t[9] = dc === "multi" ? row("H", [R(3, 6), "D"]) : row("H", [R(2, 6), "D"]);
  t[10] = row("H", [R(2, 9), "D"]);
  t[11] = dc === "multi" && !h17 ? row("H", [R(2, 10), "D"]) : row("D");
  t[12] = row("H", [R(4, 6), "S"]);
  for (const total of [13, 14, 15, 16]) t[total] = row("H", [R(2, 6), "S"]);
  return t;
}

function softTable(dc: DeckClass, h17: boolean): Record<number, ChartRow> {
  const t: Record<number, ChartRow> = {};
  if (dc === "single") {
    for (const total of [13, 14, 15, 16]) t[total] = row("H", [R(4, 6), "D"]);
    t[17] = row("H", [R(2, 6), "D"]);
    t[18] = h17
      ? row("H", [R(2, 6), "Ds"], [R(7, 8), "S"])
      : row("H", [[2], "S"], [R(3, 6), "Ds"], [R(7, 8), "S"], [[11], "S"]);
    t[19] = row("S", [[6], "Ds"]);
  } else {
    t[13] = row("H", [R(5, 6), "D"]);
    t[14] = row("H", [R(5, 6), "D"]);
    t[15] = row("H", [R(4, 6), "D"]);
    t[16] = row("H", [R(4, 6), "D"]);
    t[17] = row("H", [R(3, 6), "D"]);
    t[18] = h17
      ? row("H", [R(2, 6), "Ds"], [R(7, 8), "S"])
      : row("H", [[2], "S"], [R(3, 6), "Ds"], [R(7, 8), "S"]);
    t[19] = h17 ? row("S", [[6], "Ds"]) : row("S");
  }
  t[20] = row("S");
  t[21] = row("S");
  return t;
}

function pairTable(dc: DeckClass, das: boolean, hard: Record<number, ChartRow>): Record<PairRank, ChartRow> {
  const asHard = (total: number) => ({ ...(hard[total] as ChartRow) });
  const split = (r: ChartRow, ups: UpcardValue[]): ChartRow => {
    const out = { ...r };
    for (const u of ups) out[u] = "P";
    return out;
  };
  const p = {} as Record<PairRank, ChartRow>;
  p[11] = row("P");
  p[10] = row("S");
  p[8] = row("P");
  p[5] = asHard(10);
  p[9] = merge(row("S"), { 2: "P", 3: "P", 4: "P", 5: "P", 6: "P", 8: "P", 9: "P" });

  if (dc === "multi") {
    p[2] = split(asHard(4), das ? R(2, 7) : R(4, 7));
    p[3] = split(asHard(6), das ? R(2, 7) : R(4, 7));
    p[4] = das ? split(asHard(8), R(5, 6)) : asHard(8);
    p[6] = split(asHard(12), das ? R(2, 6) : R(3, 6));
    p[7] = split(asHard(14), R(2, 7));
  } else if (dc === "double") {
    p[2] = split(asHard(4), das ? R(2, 7) : R(3, 7));
    p[3] = split(asHard(6), das ? R(2, 7) : R(4, 7));
    p[4] = das ? split(asHard(8), R(5, 6)) : asHard(8);
    p[6] = split(asHard(12), das ? R(2, 7) : R(2, 6));
    p[7] = split(asHard(14), das ? R(2, 8) : R(2, 7));
  } else {
    p[2] = split(asHard(4), das ? R(2, 7) : R(3, 7));
    p[3] = split(asHard(6), das ? R(2, 8) : R(4, 7));
    p[4] = das ? split(asHard(8), R(4, 6)) : asHard(8);
    p[6] = split(asHard(12), das ? R(2, 7) : R(2, 6));
    p[7] = merge(split(asHard(14), das ? R(2, 8) : R(2, 7)), { 10: "S" });
  }
  return p;
}

const cache = new Map<string, StrategyChart>();

/** The raw published chart for these rules (doubling restrictions not yet applied). */
export function baseChart(rules: Pick<Rules, "decks" | "dealerHitsSoft17" | "doubleAfterSplit">): StrategyChart {
  const dc = deckClass(rules.decks);
  const key = `${dc}-${rules.dealerHitsSoft17}-${rules.doubleAfterSplit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const hard = hardTable(dc, rules.dealerHitsSoft17);
  const chart: StrategyChart = {
    deckClass: dc,
    hard,
    soft: softTable(dc, rules.dealerHitsSoft17),
    pairs: pairTable(dc, rules.doubleAfterSplit, hard),
  };
  cache.set(key, chart);
  return chart;
}

/** Falls back from a double to the second-best play when doubling is not allowed. */
export function withoutDouble(code: StrategyCode): StrategyCode {
  if (code === "D") return "H";
  if (code === "Ds") return "S";
  return code;
}

/**
 * The chart as it applies at this table: if the rules restrict doubling to certain totals,
 * cells for other totals show the fallback play instead of a double.
 */
export function chartForRules(rules: Rules): StrategyChart {
  const base = baseChart(rules);
  if (rules.doubleOn === "any") return base;
  const mapRow = (r: ChartRow, total: number, soft: boolean): ChartRow => {
    if (canDoubleTotal(rules, total, soft)) return r;
    const out = { ...r };
    for (const u of UPCARDS) out[u] = withoutDouble(out[u]);
    return out;
  };
  const hard: Record<number, ChartRow> = {};
  for (const [k, r] of Object.entries(base.hard)) hard[Number(k)] = mapRow(r, Number(k), false);
  const soft: Record<number, ChartRow> = {};
  for (const [k, r] of Object.entries(base.soft)) soft[Number(k)] = mapRow(r, Number(k), true);
  const pairs = {} as Record<PairRank, ChartRow>;
  for (const [k, r] of Object.entries(base.pairs)) {
    const v = Number(k) as PairRank;
    pairs[v] = v === 11 ? r : mapRow(r, v * 2, false);
  }
  return { deckClass: base.deckClass, hard, soft, pairs };
}

export const CODE_LABEL: Record<StrategyCode, string> = {
  H: "Hit",
  S: "Stand",
  D: "Double (else hit)",
  Ds: "Double (else stand)",
  P: "Split",
};

export function chartDescription(rules: Rules): string {
  const dc = deckClass(rules.decks);
  const decks = dc === "single" ? "Single deck" : dc === "double" ? "Double deck" : "4–8 decks";
  return `${decks} · ${rules.dealerHitsSoft17 ? "H17" : "S17"} · ${rules.doubleAfterSplit ? "DAS" : "No DAS"} · No surrender`;
}
