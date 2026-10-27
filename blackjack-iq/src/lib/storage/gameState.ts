// Restores a saved table (including a round in progress) after a refresh.

import { RANKS, SUITS, type Card } from "../engine/cards";
import { type GameState, createGame } from "../engine/game";
import { STARTING_BANKROLL } from "../engine/bankroll";
import type { Rules } from "../engine/rules";

const PHASES = new Set(["betting", "insurance", "player", "settled"]);

function isCard(c: unknown): c is Card {
  if (!c || typeof c !== "object") return false;
  const o = c as Record<string, unknown>;
  return (RANKS as readonly unknown[]).includes(o.rank) && (SUITS as readonly unknown[]).includes(o.suit) && typeof o.id === "string";
}

const cardArray = (v: unknown): v is Card[] => Array.isArray(v) && v.every(isCard);

export function restoreGame(raw: unknown, rules: Rules): GameState {
  const fresh = () => createGame(rules, STARTING_BANKROLL);
  if (!raw || typeof raw !== "object") return fresh();
  const o = raw as Record<string, unknown>;
  if (
    !PHASES.has(o.phase as string) ||
    typeof o.bankroll !== "number" ||
    !Number.isFinite(o.bankroll) ||
    !cardArray(o.shoe) ||
    !cardArray(o.dealer) ||
    !Array.isArray(o.hands) ||
    !(o.hands as unknown[]).every((h) => h && typeof h === "object" && cardArray((h as Record<string, unknown>).cards))
  ) {
    return fresh();
  }
  const g = o as unknown as GameState;
  const restored: GameState = { ...g, rules: g.phase === "betting" || g.phase === "settled" ? rules : g.rules };
  // Mid-round saves keep the rules they started with; between rounds the current settings apply.
  if ((restored.phase === "betting" || restored.phase === "settled") && restored.rules.decks !== g.rules?.decks) {
    return { ...createGame(rules, g.bankroll), roundNumber: g.roundNumber ?? 0 };
  }
  return restored;
}
