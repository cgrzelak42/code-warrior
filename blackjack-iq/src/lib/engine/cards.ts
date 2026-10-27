// Cards, decks, shoes and hand valuation. Pure functions, no UI dependencies.

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
  /** Unique within a shoe; lets the UI key and animate individual cards. */
  readonly id: string;
}

/** Random source returning a float in [0, 1). Injectable so shuffles are testable. */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return (buf[0] as number) / 4294967296;
  }
  return Math.random();
};

/** Blackjack point value of a single card, counting aces as 1. */
export function cardPoints(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

/** Strategy-relevant value 2..11 (ten-value cards = 10, ace = 11). */
export type UpcardValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export const UPCARDS: readonly UpcardValue[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function upcardValue(rank: Rank): UpcardValue {
  if (rank === "A") return 11;
  return cardPoints(rank) as UpcardValue;
}

export function isTenValue(rank: Rank): boolean {
  return cardPoints(rank) === 10;
}

export function createDeck(prefix = "d0"): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) cards.push({ rank, suit, id: `${prefix}-${rank}${suit[0]}` });
  }
  return cards;
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

export function createShoe(decks: number, rng: Rng = cryptoRng, shoeId = Date.now().toString(36)): Card[] {
  if (!Number.isInteger(decks) || decks < 1 || decks > 8) throw new Error(`Unsupported deck count: ${decks}`);
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) cards.push(...createDeck(`${shoeId}-${d}`));
  return shuffle(cards, rng);
}

export interface HandValue {
  /** Best total (≤ 21 when possible). */
  total: number;
  /** True when an ace is currently counted as 11. */
  soft: boolean;
  busted: boolean;
}

export function handValue(cards: readonly Pick<Card, "rank">[]): HandValue {
  let hard = 0;
  let aces = 0;
  for (const c of cards) {
    hard += cardPoints(c.rank);
    if (c.rank === "A") aces++;
  }
  const soft = aces > 0 && hard + 10 <= 21;
  const total = soft ? hard + 10 : hard;
  return { total, soft, busted: total > 21 };
}

export function isBlackjack(cards: readonly Pick<Card, "rank">[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Two cards of the same blackjack value (e.g. K-Q counts as a pair of tens). */
export function isPair(cards: readonly Pick<Card, "rank">[]): boolean {
  return cards.length === 2 && cardPoints((cards[0] as Card).rank) === cardPoints((cards[1] as Card).rank);
}

const SUIT_SYMBOL: Record<Suit, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function upcardLabel(v: UpcardValue): string {
  return v === 11 ? "A" : String(v);
}
