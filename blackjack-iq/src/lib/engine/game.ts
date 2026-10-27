// Blackjack round state machine. Every transition is a pure function that returns a new state
// and throws GameError when the move is not legal, so the UI can never put the game in an
// impossible state (e.g. hitting after standing, or doubling where the rules forbid it).

import {
  type Card,
  type Rng,
  cryptoRng,
  createShoe,
  handValue,
  isBlackjack,
  isPair,
  isTenValue,
} from "./cards";
import { type Rules, canDoubleTotal, payoutMultiplier } from "./rules";
import { canAfford, money } from "./bankroll";

export type Phase = "betting" | "insurance" | "player" | "settled";
export type Action = "hit" | "stand" | "double" | "split";
export const ACTIONS: readonly Action[] = ["hit", "stand", "double", "split"];
export type Outcome = "blackjack" | "win" | "push" | "lose" | "bust";
export type HandStatus = "playing" | "stood" | "busted" | "blackjack";

export interface PlayerHand {
  readonly id: number;
  cards: Card[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  /** Hand produced by splitting aces. */
  splitAces: boolean;
  status: HandStatus;
  outcome?: Outcome;
  /** Net chips won (+) or lost (−) for this hand once settled. */
  net?: number;
}

export interface RoundResult {
  roundNumber: number;
  hands: { cards: Card[]; bet: number; outcome: Outcome; net: number; doubled: boolean; fromSplit: boolean }[];
  dealerCards: Card[];
  dealerTotal: number;
  dealerBusted: boolean;
  dealerBlackjack: boolean;
  playerBlackjack: boolean;
  insuranceBet: number;
  insuranceNet: number;
  /** Total net for the round including insurance. */
  net: number;
  bankrollAfter: number;
}

export interface GameState {
  rules: Rules;
  /** Remaining undealt cards; the next card dealt is shoe[0]. */
  shoe: Card[];
  shoeSize: number;
  /** True when the shoe was reshuffled at the start of the current round. */
  shuffledThisRound: boolean;
  phase: Phase;
  bankroll: number;
  dealer: Card[];
  holeRevealed: boolean;
  hands: PlayerHand[];
  activeHand: number;
  insuranceBet: number;
  roundNumber: number;
  result: RoundResult | null;
}

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export function createGame(rules: Rules, bankroll: number, rng: Rng = cryptoRng): GameState {
  const shoe = createShoe(rules.decks, rng);
  return {
    rules,
    shoe,
    shoeSize: shoe.length,
    shuffledThisRound: false,
    phase: "betting",
    bankroll: money(bankroll),
    dealer: [],
    holeRevealed: false,
    hands: [],
    activeHand: 0,
    insuranceBet: 0,
    roundNumber: 0,
    result: null,
  };
}

/** Builds a game whose shoe deals the given cards in order (for tests and training set-ups). */
export function createRiggedGame(rules: Rules, bankroll: number, cards: Card[]): GameState {
  return { ...createGame(rules, bankroll, () => 0), shoe: cards.slice(), shoeSize: cards.length };
}

function clone(s: GameState): GameState {
  return {
    ...s,
    shoe: s.shoe.slice(),
    dealer: s.dealer.slice(),
    hands: s.hands.map((h) => ({ ...h, cards: h.cards.slice() })),
  };
}

function draw(s: GameState, rng: Rng): Card {
  if (s.shoe.length === 0) {
    // Only reachable in extreme split-heavy rounds deep in a single-deck shoe.
    s.shoe = createShoe(s.rules.decks, rng);
    s.shoeSize = s.shoe.length;
  }
  return s.shoe.shift() as Card;
}

export function needsReshuffle(s: Pick<GameState, "shoe" | "shoeSize" | "rules">): boolean {
  return s.shoe.length <= s.shoeSize * (1 - s.rules.penetration);
}

export function activeHandOf(s: GameState): PlayerHand | undefined {
  return s.phase === "player" ? s.hands[s.activeHand] : undefined;
}

/** Applies new rules between rounds. A deck-count change means a fresh shoe. */
export function changeRules(s: GameState, rules: Rules, rng: Rng = cryptoRng): GameState {
  if (s.phase === "insurance" || s.phase === "player") throw new GameError("Rules can only change between rounds.");
  const next = { ...clone(s), rules };
  if (rules.decks !== s.rules.decks) {
    next.shoe = createShoe(rules.decks, rng);
    next.shoeSize = next.shoe.length;
  }
  return next;
}

export function setBankroll(s: GameState, amount: number): GameState {
  if (s.phase === "insurance" || s.phase === "player") throw new GameError("Bankroll can only be reset between rounds.");
  return { ...clone(s), bankroll: money(amount) };
}

export function validateBet(s: GameState, bet: number): string | null {
  if (s.phase !== "betting" && s.phase !== "settled") return "A round is already in progress.";
  if (!Number.isFinite(bet) || bet <= 0) return "Place a bet to deal.";
  if (bet < s.rules.minBet) return `Minimum bet is $${s.rules.minBet}.`;
  if (bet > s.rules.maxBet) return `Maximum bet is $${s.rules.maxBet}.`;
  if (!canAfford(s.bankroll, bet)) return "Not enough chips for that bet.";
  return null;
}

export function deal(state: GameState, bet: number, rng: Rng = cryptoRng): GameState {
  const err = validateBet(state, bet);
  if (err) throw new GameError(err);
  const s = clone(state);
  s.shuffledThisRound = false;
  if (needsReshuffle(s)) {
    s.shoe = createShoe(s.rules.decks, rng);
    s.shoeSize = s.shoe.length;
    s.shuffledThisRound = true;
  }
  s.roundNumber += 1;
  s.result = null;
  s.insuranceBet = 0;
  s.holeRevealed = false;
  s.bankroll = money(s.bankroll - bet);
  const hand: PlayerHand = { id: 0, cards: [], bet, doubled: false, fromSplit: false, splitAces: false, status: "playing" };
  s.dealer = [];
  // Deal order: player, dealer upcard, player, dealer hole card.
  hand.cards.push(draw(s, rng));
  s.dealer.push(draw(s, rng));
  hand.cards.push(draw(s, rng));
  s.dealer.push(draw(s, rng));
  s.hands = [hand];
  s.activeHand = 0;
  if (isBlackjack(hand.cards)) hand.status = "blackjack";

  const up = s.dealer[0] as Card;
  if (up.rank === "A" && s.rules.insuranceOffered) {
    s.phase = "insurance";
    return s;
  }
  return peek(s, rng);
}

/** Maximum insurance stake: half the original bet. */
export function insuranceCost(s: GameState): number {
  return money((s.hands[0]?.bet ?? 0) / 2);
}

export function resolveInsurance(state: GameState, take: boolean, rng: Rng = cryptoRng): GameState {
  if (state.phase !== "insurance") throw new GameError("Insurance is not being offered.");
  const s = clone(state);
  if (take) {
    const cost = insuranceCost(s);
    if (!canAfford(s.bankroll, cost)) throw new GameError("Not enough chips for insurance.");
    s.bankroll = money(s.bankroll - cost);
    s.insuranceBet = cost;
  }
  return peek(s, rng);
}

/** Dealer checks for blackjack when showing an ace or ten, then the player acts. */
function peek(s: GameState, rng: Rng): GameState {
  const up = s.dealer[0] as Card;
  const dealerCanHaveBJ = up.rank === "A" || isTenValue(up.rank);
  if (dealerCanHaveBJ && isBlackjack(s.dealer)) return settle(s);
  const hand = s.hands[0] as PlayerHand;
  if (hand.status === "blackjack") return settle(s);
  s.phase = "player";
  return advance(s, rng);
}

export function legalActions(s: GameState): Action[] {
  const hand = activeHandOf(s);
  if (!hand || hand.status !== "playing") return [];
  const actions: Action[] = ["stand"];
  const v = handValue(hand.cards);
  const lockedAces = hand.splitAces && !s.rules.hitSplitAces;
  if (!lockedAces && v.total < 21) actions.unshift("hit");
  if (canDouble(s, hand)) actions.push("double");
  if (canSplit(s, hand)) actions.push("split");
  return actions;
}

export function canDouble(s: GameState, hand: PlayerHand): boolean {
  if (hand.cards.length !== 2 || hand.status !== "playing") return false;
  if (hand.fromSplit && !s.rules.doubleAfterSplit) return false;
  if (hand.splitAces && !s.rules.hitSplitAces) return false;
  const v = handValue(hand.cards);
  if (v.total >= 21) return false;
  if (!canDoubleTotal(s.rules, v.total, v.soft)) return false;
  return canAfford(s.bankroll, hand.bet);
}

export function canSplit(s: GameState, hand: PlayerHand): boolean {
  if (hand.status !== "playing" || !isPair(hand.cards)) return false;
  if (s.hands.length >= s.rules.maxSplitHands) return false;
  if (hand.splitAces && !s.rules.resplitAces) return false;
  return canAfford(s.bankroll, hand.bet);
}

/** Why an action is unavailable, for button tooltips. */
export function illegalReason(s: GameState, action: Action): string | null {
  if (legalActions(s).includes(action)) return null;
  const hand = activeHandOf(s);
  if (!hand) return "No hand is in play.";
  if (action === "double") {
    if (hand.cards.length !== 2) return "You can only double on your first two cards.";
    if (hand.fromSplit && !s.rules.doubleAfterSplit) return "Doubling after a split is not allowed by these rules.";
    if (hand.splitAces && !s.rules.hitSplitAces) return "Split aces receive one card only.";
    const v = handValue(hand.cards);
    if (!canDoubleTotal(s.rules, v.total, v.soft)) return `These rules only allow doubling on hard ${s.rules.doubleOn}.`;
    if (!canAfford(s.bankroll, hand.bet)) return "Not enough chips to double.";
  }
  if (action === "split") {
    if (!isPair(hand.cards)) return "You can only split two cards of the same value.";
    if (s.hands.length >= s.rules.maxSplitHands) return `Maximum of ${s.rules.maxSplitHands} hands reached.`;
    if (hand.splitAces && !s.rules.resplitAces) return "Resplitting aces is not allowed.";
    if (!canAfford(s.bankroll, hand.bet)) return "Not enough chips to split.";
  }
  if (action === "hit") {
    if (hand.splitAces && !s.rules.hitSplitAces) return "Split aces receive one card only.";
    return "You already have 21.";
  }
  return "Not available right now.";
}

export function act(state: GameState, action: Action, rng: Rng = cryptoRng): GameState {
  if (state.phase !== "player") throw new GameError("It is not your turn to act.");
  if (!legalActions(state).includes(action)) {
    throw new GameError(illegalReason(state, action) ?? `Cannot ${action} now.`);
  }
  const s = clone(state);
  const hand = s.hands[s.activeHand] as PlayerHand;
  switch (action) {
    case "hit": {
      hand.cards.push(draw(s, rng));
      const v = handValue(hand.cards);
      if (v.busted) hand.status = "busted";
      else if (v.total === 21) hand.status = "stood";
      break;
    }
    case "stand":
      hand.status = "stood";
      break;
    case "double": {
      s.bankroll = money(s.bankroll - hand.bet);
      hand.bet = money(hand.bet * 2);
      hand.doubled = true;
      hand.cards.push(draw(s, rng));
      hand.status = handValue(hand.cards).busted ? "busted" : "stood";
      break;
    }
    case "split": {
      s.bankroll = money(s.bankroll - hand.bet);
      const aces = hand.cards[0]?.rank === "A";
      const second = hand.cards.pop() as Card;
      hand.fromSplit = true;
      hand.splitAces = aces;
      const nextId = Math.max(...s.hands.map((h) => h.id)) + 1;
      const sibling: PlayerHand = {
        id: nextId,
        cards: [second],
        bet: hand.bet,
        doubled: false,
        fromSplit: true,
        splitAces: aces,
        status: "playing",
      };
      s.hands.splice(s.activeHand + 1, 0, sibling);
      break;
    }
  }
  return advance(s, rng);
}

/**
 * Moves play forward: deals the second card to freshly split hands, auto-stands hands that
 * cannot act (21, one-card split aces), and hands over to the dealer when every hand is done.
 */
function advance(s: GameState, rng: Rng): GameState {
  for (;;) {
    const hand = s.hands[s.activeHand];
    if (!hand) break;
    if (hand.status === "playing") {
      if (hand.cards.length === 1) hand.cards.push(draw(s, rng));
      const v = handValue(hand.cards);
      if (v.total === 21) {
        hand.status = "stood";
      } else if (hand.splitAces && !s.rules.hitSplitAces && hand.cards.length === 2 && !canSplit(s, hand)) {
        hand.status = "stood";
      } else {
        return s;
      }
    }
    s.activeHand += 1;
  }
  return finishPlayerTurn(s, rng);
}

function dealerShouldHit(rules: Rules, cards: Card[]): boolean {
  const v = handValue(cards);
  if (v.total < 17) return true;
  return v.total === 17 && v.soft && rules.dealerHitsSoft17;
}

function finishPlayerTurn(s: GameState, rng: Rng): GameState {
  const anyLive = s.hands.some((h) => h.status === "stood");
  if (anyLive) {
    while (dealerShouldHit(s.rules, s.dealer)) s.dealer.push(draw(s, rng));
  }
  return settle(s);
}

function settle(s: GameState): GameState {
  s.phase = "settled";
  s.holeRevealed = true;
  s.activeHand = Math.min(s.activeHand, Math.max(0, s.hands.length - 1));
  const dv = handValue(s.dealer);
  const dealerBJ = isBlackjack(s.dealer);
  const mult = payoutMultiplier(s.rules.blackjackPayout);
  let returned = 0;
  let net = 0;
  for (const h of s.hands) {
    const pv = handValue(h.cards);
    const playerBJ = h.status === "blackjack";
    let outcome: Outcome;
    let back: number;
    if (pv.busted) {
      outcome = "bust";
      back = 0;
    } else if (playerBJ && dealerBJ) {
      outcome = "push";
      back = h.bet;
    } else if (playerBJ) {
      outcome = "blackjack";
      back = h.bet + h.bet * mult;
    } else if (dealerBJ) {
      outcome = "lose";
      back = 0;
    } else if (dv.busted || pv.total > dv.total) {
      outcome = "win";
      back = h.bet * 2;
    } else if (pv.total === dv.total) {
      outcome = "push";
      back = h.bet;
    } else {
      outcome = "lose";
      back = 0;
    }
    h.outcome = outcome;
    h.net = money(back - h.bet);
    returned += back;
    net += back - h.bet;
  }
  let insuranceNet = 0;
  if (s.insuranceBet > 0) {
    if (dealerBJ) {
      returned += s.insuranceBet * 3;
      insuranceNet = s.insuranceBet * 2;
    } else {
      insuranceNet = -s.insuranceBet;
    }
  }
  s.bankroll = money(s.bankroll + returned);
  s.result = {
    roundNumber: s.roundNumber,
    hands: s.hands.map((h) => ({
      cards: h.cards.slice(),
      bet: h.bet,
      outcome: h.outcome as Outcome,
      net: h.net as number,
      doubled: h.doubled,
      fromSplit: h.fromSplit,
    })),
    dealerCards: s.dealer.slice(),
    dealerTotal: dv.total,
    dealerBusted: dv.busted,
    dealerBlackjack: dealerBJ,
    playerBlackjack: s.hands.length === 1 && s.hands[0]?.status === "blackjack",
    insuranceBet: s.insuranceBet,
    insuranceNet: money(insuranceNet),
    net: money(net + insuranceNet),
    bankrollAfter: s.bankroll,
  };
  return s;
}

/** Cards the player can currently see (hides the dealer hole card until it is revealed). */
export function visibleDealerCards(s: GameState): Card[] {
  return s.holeRevealed ? s.dealer : s.dealer.slice(0, 1);
}
