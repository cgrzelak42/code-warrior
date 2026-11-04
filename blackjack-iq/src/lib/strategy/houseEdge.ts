// House edge for a rule set, assuming perfect basic strategy. Estimated the standard way:
// a baseline game plus the published effect of each rule change (as in the Wizard of Odds
// rule-variation tables). Accurate to within about ±0.05% for typical games.

import type { Rules } from "../engine/rules";

/** Baseline: 6 decks, dealer stands on soft 17, 3:2, double any two, DAS, split to 4, no RSA, peek, no surrender. */
const BASELINE = 0.004;

const DECK_EFFECT: Record<number, number> = { 1: -0.0048, 2: -0.0019, 4: -0.0006, 6: 0, 8: 0.0002 };

export type EdgeRules = Pick<
  Rules,
  "decks" | "dealerHitsSoft17" | "blackjackPayout" | "doubleOn" | "doubleAfterSplit" | "maxSplitHands" | "resplitAces" | "hitSplitAces"
>;

export const EDGE_RULE_KEYS: readonly (keyof EdgeRules)[] = [
  "decks",
  "dealerHitsSoft17",
  "blackjackPayout",
  "doubleOn",
  "doubleAfterSplit",
  "maxSplitHands",
  "resplitAces",
  "hitSplitAces",
];

export function edgeRulesOf(r: EdgeRules): EdgeRules {
  const out = {} as Record<string, unknown>;
  for (const k of EDGE_RULE_KEYS) out[k] = r[k];
  return out as unknown as EdgeRules;
}

/** Effect of one rule's current setting on the house edge, relative to the baseline. */
function effectOf(key: keyof EdgeRules, r: EdgeRules): number {
  switch (key) {
    case "decks":
      return DECK_EFFECT[r.decks] ?? 0;
    case "dealerHitsSoft17":
      return r.dealerHitsSoft17 ? (r.decks === 1 ? 0.0019 : 0.0022) : 0;
    case "blackjackPayout":
      return r.blackjackPayout === "6:5" ? 0.0139 : r.blackjackPayout === "1:1" ? 0.0227 : 0;
    case "doubleOn":
      return r.doubleOn === "9-11" ? 0.0009 : r.doubleOn === "10-11" ? 0.0018 : 0;
    case "doubleAfterSplit":
      return r.doubleAfterSplit ? 0 : 0.0014;
    case "maxSplitHands":
      return r.maxSplitHands === 2 ? 0.0005 : r.maxSplitHands === 3 ? 0.0001 : 0;
    case "resplitAces":
      return r.resplitAces ? -0.0008 : 0;
    case "hitSplitAces":
      return r.hitSplitAces ? -0.0019 : 0;
  }
}

/** House edge as a fraction of each bet (0.004 = 0.4%). Negative means the player has the edge. */
export function houseEdge(r: EdgeRules): number {
  let edge = BASELINE;
  for (const k of EDGE_RULE_KEYS) edge += effectOf(k, r);
  return Math.round(edge * 100000) / 100000;
}

function settingLabel(key: keyof EdgeRules, r: EdgeRules): string {
  switch (key) {
    case "decks":
      return `${r.decks} deck${r.decks === 1 ? "" : "s"}`;
    case "dealerHitsSoft17":
      return r.dealerHitsSoft17 ? "Dealer now hits soft 17" : "Dealer now stands on soft 17";
    case "blackjackPayout":
      return `Blackjack now pays ${r.blackjackPayout}`;
    case "doubleOn":
      return r.doubleOn === "any" ? "Double on any two cards" : `Double on ${r.doubleOn} only`;
    case "doubleAfterSplit":
      return r.doubleAfterSplit ? "Double after split allowed" : "No double after split";
    case "maxSplitHands":
      return r.maxSplitHands === 2 ? "No resplitting" : `Split up to ${r.maxSplitHands} hands`;
    case "resplitAces":
      return r.resplitAces ? "Aces can be resplit" : "Aces can't be resplit";
    case "hitSplitAces":
      return r.hitSplitAces ? "Split aces can be hit" : "Split aces get one card";
  }
}

export interface EdgeChange {
  from: number;
  to: number;
  /** Each rule that changed and how much it moved the edge (positive = worse for the player). */
  reasons: { label: string; effect: number }[];
}

export function edgeChange(before: EdgeRules, after: EdgeRules): EdgeChange | null {
  const reasons: { label: string; effect: number }[] = [];
  for (const k of EDGE_RULE_KEYS) {
    if (before[k] === after[k]) continue;
    reasons.push({ label: settingLabel(k, after), effect: Math.round((effectOf(k, after) - effectOf(k, before)) * 100000) / 100000 });
  }
  if (reasons.length === 0) return null;
  return { from: houseEdge(before), to: houseEdge(after), reasons };
}

export function formatEdge(edge: number): string {
  return `${(edge * 100).toFixed(2)}%`;
}

/** "lose about $0.10" / "win about $0.05": the average result per hand at this edge. */
export function expectedResult(edge: number, bet: number): string {
  if (Math.abs(edge) < 0.00005) return "break even";
  return `${edge > 0 ? "lose" : "win"} about ${costPerHand(edge, bet)}`;
}

/** Size of the average result per hand for a bet at this edge, e.g. "$0.10". */
export function costPerHand(edge: number, bet: number): string {
  const v = Math.abs(edge * bet);
  return `$${v < 1 ? v.toFixed(2) : v.toFixed(2).replace(/\.00$/, "")}`;
}
