import type { Card, Rank } from "./cards";

let n = 0;
/** Builds cards from short codes like "A", "10", "K" (suits cycle so IDs stay unique). */
export function cards(...ranks: Rank[]): Card[] {
  const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
  return ranks.map((rank) => ({ rank, suit: suits[n % 4] as Card["suit"], id: `t${n++}` }));
}
