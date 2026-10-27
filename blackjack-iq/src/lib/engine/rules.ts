// Table rules. One Rules object drives the game engine, the strategy engine and the chart,
// so every part of the app always agrees on which game is being played.

export type DeckCount = 1 | 2 | 4 | 6 | 8;
export type BlackjackPayout = "3:2" | "6:5" | "1:1";
export type DoubleRestriction = "any" | "9-11" | "10-11";

export interface Rules {
  decks: DeckCount;
  /** H17 when true, S17 when false. */
  dealerHitsSoft17: boolean;
  blackjackPayout: BlackjackPayout;
  /** Which hard totals may be doubled. "any" = any first two cards (including soft hands). */
  doubleOn: DoubleRestriction;
  doubleAfterSplit: boolean;
  /** Maximum number of hands a player can hold after splitting (2 = no resplits). */
  maxSplitHands: 2 | 3 | 4;
  resplitAces: boolean;
  /** When false (standard), split aces receive exactly one card each. */
  hitSplitAces: boolean;
  insuranceOffered: boolean;
  /** Fraction of the shoe dealt before a reshuffle at the start of the next round. */
  penetration: number;
  minBet: number;
  maxBet: number;
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  dealerHitsSoft17: true,
  blackjackPayout: "3:2",
  doubleOn: "any",
  doubleAfterSplit: true,
  maxSplitHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  insuranceOffered: true,
  penetration: 0.75,
  minBet: 5,
  maxBet: 1000,
};

export const DECK_OPTIONS: readonly DeckCount[] = [1, 2, 4, 6, 8];
export const PAYOUT_OPTIONS: readonly BlackjackPayout[] = ["3:2", "6:5", "1:1"];

export function payoutMultiplier(p: BlackjackPayout): number {
  switch (p) {
    case "3:2":
      return 1.5;
    case "6:5":
      return 1.2;
    case "1:1":
      return 1;
  }
}

export function canDoubleTotal(rules: Rules, total: number, soft: boolean): boolean {
  switch (rules.doubleOn) {
    case "any":
      return true;
    case "9-11":
      return !soft && total >= 9 && total <= 11;
    case "10-11":
      return !soft && total >= 10 && total <= 11;
  }
}

/** Coerces a possibly partial / stale stored object into valid Rules. */
export function sanitizeRules(input: unknown): Rules {
  const r = { ...DEFAULT_RULES };
  if (!input || typeof input !== "object") return r;
  const o = input as Record<string, unknown>;
  if (DECK_OPTIONS.includes(o.decks as DeckCount)) r.decks = o.decks as DeckCount;
  if (typeof o.dealerHitsSoft17 === "boolean") r.dealerHitsSoft17 = o.dealerHitsSoft17;
  if (PAYOUT_OPTIONS.includes(o.blackjackPayout as BlackjackPayout)) r.blackjackPayout = o.blackjackPayout as BlackjackPayout;
  if (o.doubleOn === "any" || o.doubleOn === "9-11" || o.doubleOn === "10-11") r.doubleOn = o.doubleOn;
  if (typeof o.doubleAfterSplit === "boolean") r.doubleAfterSplit = o.doubleAfterSplit;
  if (o.maxSplitHands === 2 || o.maxSplitHands === 3 || o.maxSplitHands === 4) r.maxSplitHands = o.maxSplitHands;
  if (typeof o.resplitAces === "boolean") r.resplitAces = o.resplitAces;
  if (typeof o.hitSplitAces === "boolean") r.hitSplitAces = o.hitSplitAces;
  if (typeof o.insuranceOffered === "boolean") r.insuranceOffered = o.insuranceOffered;
  if (typeof o.penetration === "number" && o.penetration >= 0.5 && o.penetration <= 0.9) r.penetration = o.penetration;
  if (typeof o.minBet === "number" && o.minBet >= 1) r.minBet = o.minBet;
  if (typeof o.maxBet === "number" && o.maxBet >= r.minBet) r.maxBet = o.maxBet;
  return r;
}

/** Short human-readable list of the active rules, e.g. for the settings panel and table felt. */
export function describeRules(rules: Rules): string[] {
  return [
    `${rules.decks} deck${rules.decks > 1 ? "s" : ""}`,
    rules.dealerHitsSoft17 ? "Dealer hits soft 17 (H17)" : "Dealer stands on soft 17 (S17)",
    `Blackjack pays ${rules.blackjackPayout}`,
    rules.doubleOn === "any" ? "Double on any first two cards" : `Double on hard ${rules.doubleOn} only`,
    rules.doubleAfterSplit ? "Double after split allowed" : "No double after split",
    rules.maxSplitHands === 2 ? "Split once (no resplits)" : `Split up to ${rules.maxSplitHands} hands`,
    rules.resplitAces ? "Resplit aces allowed" : "No resplitting aces",
    rules.hitSplitAces ? "Split aces may be hit" : "Split aces get one card",
    rules.insuranceOffered ? "Insurance offered" : "No insurance",
    "Dealer peeks for blackjack (US hole card)",
    "No surrender",
  ];
}

export function feltSummary(rules: Rules): string {
  return `Blackjack pays ${rules.blackjackPayout} · Dealer ${rules.dealerHitsSoft17 ? "hits" : "stands on"} soft 17`;
}
