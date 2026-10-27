import { describe, expect, it } from "vitest";
import { createDeck, createShoe, handValue, isBlackjack, isPair, shuffle } from "./cards";
import { act, changeRules, createGame, createRiggedGame, deal, GameError, legalActions, resolveInsurance, type GameState } from "./game";
import { DEFAULT_RULES, type Rules } from "./rules";
import { cards } from "./testUtils";

const rules = (over: Partial<Rules> = {}): Rules => ({ ...DEFAULT_RULES, insuranceOffered: false, ...over });

// Deal order: player, dealer up, player, dealer hole, then hits in order.
function rig(r: Rules, seq: Parameters<typeof cards>, bankroll = 1000): GameState {
  return createRiggedGame(r, bankroll, cards(...seq));
}

describe("cards and hand values", () => {
  it("builds a 52-card deck and multi-deck shoes", () => {
    expect(createDeck()).toHaveLength(52);
    expect(createShoe(6)).toHaveLength(312);
    expect(new Set(createShoe(8).map((c) => c.id)).size).toBe(416);
  });

  it("shuffles without losing cards", () => {
    const deck = createDeck();
    const s = shuffle(deck, () => 0.5);
    expect(s).toHaveLength(52);
    expect(new Set(s.map((c) => c.id))).toEqual(new Set(deck.map((c) => c.id)));
  });

  it("counts aces as 1 or 11", () => {
    expect(handValue(cards("A", "6"))).toEqual({ total: 17, soft: true, busted: false });
    expect(handValue(cards("A", "6", "10"))).toEqual({ total: 17, soft: false, busted: false });
    expect(handValue(cards("A", "A"))).toEqual({ total: 12, soft: true, busted: false });
    expect(handValue(cards("A", "A", "9"))).toEqual({ total: 21, soft: true, busted: false });
    expect(handValue(cards("A", "A", "A", "A", "7"))).toEqual({ total: 21, soft: true, busted: false });
    expect(handValue(cards("K", "Q", "5"))).toEqual({ total: 25, soft: false, busted: true });
  });

  it("detects blackjack and pairs", () => {
    expect(isBlackjack(cards("A", "K"))).toBe(true);
    expect(isBlackjack(cards("A", "5", "5"))).toBe(false);
    expect(isPair(cards("K", "Q"))).toBe(true);
    expect(isPair(cards("8", "8"))).toBe(true);
    expect(isPair(cards("A", "K"))).toBe(false);
  });
});

describe("naturals", () => {
  it("pays a player blackjack 3:2", () => {
    const g = deal(rig(rules(), ["A", "9", "K", "7"]), 100);
    expect(g.phase).toBe("settled");
    expect(g.result?.hands[0]?.outcome).toBe("blackjack");
    expect(g.result?.net).toBe(150);
    expect(g.bankroll).toBe(1150);
  });

  it("pays 6:5 and 1:1 when configured", () => {
    expect(deal(rig(rules({ blackjackPayout: "6:5" }), ["A", "9", "K", "7"]), 25).result?.net).toBe(30);
    expect(deal(rig(rules({ blackjackPayout: "1:1" }), ["A", "9", "K", "7"]), 25).result?.net).toBe(25);
    expect(deal(rig(rules(), ["A", "9", "K", "7"]), 5).result?.net).toBe(7.5);
  });

  it("dealer blackjack beats the player immediately (peek)", () => {
    const g = deal(rig(rules(), ["10", "A", "9", "K"]), 50);
    expect(g.phase).toBe("settled");
    expect(g.result?.dealerBlackjack).toBe(true);
    expect(g.result?.hands[0]?.outcome).toBe("lose");
    expect(g.bankroll).toBe(950);
  });

  it("dealer blackjack with a ten up is caught by the peek too", () => {
    const g = deal(rig(rules(), ["10", "K", "9", "A"]), 50);
    expect(g.phase).toBe("settled");
    expect(g.result?.dealerBlackjack).toBe(true);
  });

  it("blackjack vs blackjack pushes", () => {
    const g = deal(rig(rules(), ["A", "A", "K", "Q"]), 50);
    expect(g.result?.hands[0]?.outcome).toBe("push");
    expect(g.bankroll).toBe(1000);
  });
});

describe("hit, stand, bust, push", () => {
  it("player busts and loses without the dealer drawing", () => {
    let g = deal(rig(rules(), ["10", "6", "6", "10", "K", "5"]), 10);
    g = act(g, "hit");
    expect(g.phase).toBe("settled");
    expect(g.result?.hands[0]?.outcome).toBe("bust");
    expect(g.dealer).toHaveLength(2);
    expect(g.bankroll).toBe(990);
  });

  it("dealer busts and player wins even money", () => {
    let g = deal(rig(rules(), ["10", "6", "8", "10", "K"]), 10);
    g = act(g, "stand");
    expect(g.result?.dealerBusted).toBe(true);
    expect(g.result?.hands[0]?.outcome).toBe("win");
    expect(g.bankroll).toBe(1010);
  });

  it("equal totals push", () => {
    let g = deal(rig(rules(), ["10", "10", "8", "8"]), 10);
    g = act(g, "stand");
    expect(g.result?.hands[0]?.outcome).toBe("push");
    expect(g.bankroll).toBe(1000);
  });

  it("auto-stands when a hit reaches 21", () => {
    let g = deal(rig(rules(), ["5", "10", "6", "8", "K"]), 10);
    g = act(g, "hit");
    expect(handValue(g.hands[0]!.cards).total).toBe(21);
    expect(g.phase).toBe("settled");
    expect(g.result?.hands[0]?.outcome).toBe("win");
  });
});

describe("dealer soft 17", () => {
  // Player 10,8 = 18; dealer A,6 = soft 17, next card 3.
  const seq: Parameters<typeof cards> = ["10", "A", "8", "6", "3"];
  it("S17: dealer stands on soft 17", () => {
    const g = act(deal(rig(rules({ dealerHitsSoft17: false }), seq), 10), "stand");
    expect(g.result?.dealerTotal).toBe(17);
    expect(g.result?.hands[0]?.outcome).toBe("win");
  });
  it("H17: dealer hits soft 17", () => {
    const g = act(deal(rig(rules({ dealerHitsSoft17: true }), seq), 10), "stand");
    expect(g.result?.dealerTotal).toBe(20);
    expect(g.result?.hands[0]?.outcome).toBe("lose");
  });
  it("both rules stand on hard 17", () => {
    const g = act(deal(rig(rules({ dealerHitsSoft17: true }), ["10", "10", "8", "7", "3"]), 10), "stand");
    expect(g.result?.dealerTotal).toBe(17);
  });
});

describe("double down", () => {
  it("doubles the bet and deals exactly one card", () => {
    let g = deal(rig(rules(), ["6", "6", "5", "10", "10", "9"]), 20);
    expect(legalActions(g)).toContain("double");
    g = act(g, "double");
    expect(g.hands[0]!.cards).toHaveLength(3);
    expect(g.hands[0]!.bet).toBe(40);
    expect(g.result?.hands[0]?.outcome).toBe("win");
    expect(g.bankroll).toBe(1040);
  });

  it("losing a double costs twice the bet", () => {
    let g = deal(rig(rules(), ["6", "10", "5", "9", "2"]), 20);
    g = act(g, "double");
    expect(g.bankroll).toBe(960);
  });

  it("cannot double after hitting", () => {
    let g = deal(rig(rules(), ["2", "10", "3", "7", "2"]), 10);
    g = act(g, "hit");
    expect(legalActions(g)).not.toContain("double");
    expect(() => act(g, "double")).toThrow(GameError);
  });

  it("respects double-on-9-11 restriction", () => {
    const g = deal(rig(rules({ doubleOn: "9-11" }), ["A", "6", "7", "10"]), 10);
    expect(legalActions(g)).not.toContain("double");
    const g2 = deal(rig(rules({ doubleOn: "10-11" }), ["5", "6", "4", "10"]), 10);
    expect(legalActions(g2)).not.toContain("double");
  });

  it("blocks doubling without enough chips", () => {
    const g = deal(rig(rules(), ["6", "6", "5", "10"], 15), 10);
    expect(legalActions(g)).not.toContain("double");
  });
});

describe("splitting", () => {
  it("splits a pair and plays each hand in turn", () => {
    // P 8, D 6, P 8, D 10, then: hand1 gets 3 (11) → double gets 10 (21); hand2 gets 9 (17) stand; dealer 6+10 draws 7 = 23.
    let g = deal(rig(rules(), ["8", "6", "8", "10", "3", "10", "9", "7"]), 10);
    expect(legalActions(g)).toContain("split");
    g = act(g, "split");
    expect(g.hands).toHaveLength(2);
    expect(g.bankroll).toBe(980);
    expect(g.activeHand).toBe(0);
    expect(g.hands[0]!.cards.map((c) => c.rank)).toEqual(["8", "3"]);
    expect(g.hands[1]!.cards).toHaveLength(1);
    g = act(g, "double"); // DAS
    expect(g.activeHand).toBe(1);
    expect(g.hands[1]!.cards.map((c) => c.rank)).toEqual(["8", "9"]);
    g = act(g, "stand");
    expect(g.phase).toBe("settled");
    expect(g.result?.dealerBusted).toBe(true);
    expect(g.result?.hands.map((h) => h.outcome)).toEqual(["win", "win"]);
    expect(g.bankroll).toBe(1030);
  });

  it("a split hand making 21 is not a blackjack", () => {
    let g = deal(rig(rules(), ["K", "9", "K", "9", "A", "7"]), 10);
    g = act(g, "split");
    // first hand K,A = 21 auto-stands; second hand K,7 = 17
    expect(g.activeHand).toBe(1);
    g = act(g, "stand");
    expect(g.result?.hands[0]?.outcome).toBe("win");
    expect(g.result?.hands[0]?.net).toBe(10);
    expect(g.result?.hands[1]?.outcome).toBe("lose");
  });

  it("split aces get one card each and auto-stand", () => {
    let g = deal(rig(rules(), ["A", "7", "A", "10", "5", "9"]), 10);
    g = act(g, "split");
    expect(g.phase).toBe("settled");
    expect(g.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(g.result?.hands.map((h) => h.outcome)).toEqual(["lose", "win"]);
  });

  it("no double after split when DAS is off", () => {
    let g = deal(rig(rules({ doubleAfterSplit: false }), ["8", "6", "8", "10", "3", "9"]), 10);
    g = act(g, "split");
    expect(legalActions(g)).not.toContain("double");
  });

  it("limits the number of split hands", () => {
    let g = deal(rig(rules({ maxSplitHands: 2 }), ["8", "6", "8", "10", "8", "8"]), 10);
    g = act(g, "split");
    expect(g.hands[0]!.cards.map((c) => c.rank)).toEqual(["8", "8"]);
    expect(legalActions(g)).not.toContain("split");
  });

  it("allows resplitting up to the limit", () => {
    let g = deal(rig(rules({ maxSplitHands: 4 }), ["8", "6", "8", "10", "8", "2", "10", "10", "9"]), 10);
    g = act(g, "split");
    expect(legalActions(g)).toContain("split");
    g = act(g, "split");
    expect(g.hands).toHaveLength(3);
    expect(g.bankroll).toBe(970);
  });

  it("blocks resplitting aces unless allowed", () => {
    const g = act(deal(rig(rules({ resplitAces: false }), ["A", "7", "A", "10", "A", "9"]), 10), "split");
    expect(g.phase).toBe("settled");
    let g2 = act(deal(rig(rules({ resplitAces: true }), ["A", "7", "A", "10", "A", "9", "5", "6"]), 10), "split");
    expect(g2.phase).toBe("player");
    expect(legalActions(g2).sort()).toEqual(["split", "stand"]);
    g2 = act(g2, "split");
    expect(g2.hands).toHaveLength(3);
  });

  it("cannot split non-pairs", () => {
    const g = deal(rig(rules(), ["8", "6", "9", "10"]), 10);
    expect(legalActions(g)).not.toContain("split");
    expect(() => act(g, "split")).toThrow(GameError);
  });
});

describe("insurance", () => {
  it("is offered against an ace and pays 2:1 when the dealer has blackjack", () => {
    let g = deal(rig(rules({ insuranceOffered: true }), ["10", "A", "9", "K"]), 100);
    expect(g.phase).toBe("insurance");
    expect(() => act(g, "hit")).toThrow(GameError);
    g = resolveInsurance(g, true);
    expect(g.phase).toBe("settled");
    expect(g.result?.insuranceNet).toBe(100);
    expect(g.result?.net).toBe(0);
    expect(g.bankroll).toBe(1000);
  });

  it("insurance is lost when the dealer has no blackjack", () => {
    let g = deal(rig(rules({ insuranceOffered: true }), ["10", "A", "9", "6", "K"]), 100);
    g = resolveInsurance(g, true);
    expect(g.phase).toBe("player");
    g = act(g, "stand");
    expect(g.result?.insuranceNet).toBe(-50);
    expect(g.result?.hands[0]?.outcome).toBe("win");
    expect(g.result?.net).toBe(50);
  });

  it("is not offered when disabled", () => {
    const g = deal(rig(rules({ insuranceOffered: false }), ["10", "A", "9", "6"]), 100);
    expect(g.phase).toBe("player");
  });
});

describe("invalid transitions", () => {
  it("cannot act after standing or once settled", () => {
    let g = deal(rig(rules(), ["10", "10", "8", "7"]), 10);
    g = act(g, "stand");
    expect(g.phase).toBe("settled");
    expect(legalActions(g)).toEqual([]);
    expect(() => act(g, "hit")).toThrow(GameError);
    expect(() => act(g, "stand")).toThrow(GameError);
  });

  it("cannot act before dealing", () => {
    const g = createGame(rules(), 1000);
    expect(() => act(g, "hit")).toThrow(GameError);
  });

  it("validates bets", () => {
    const g = createGame(rules({ minBet: 5, maxBet: 500 }), 100);
    expect(() => deal(g, 0)).toThrow(/bet/i);
    expect(() => deal(g, 2)).toThrow(/Minimum/);
    expect(() => deal(g, 600)).toThrow(/Maximum/);
    expect(() => deal(g, 200)).toThrow(/Not enough/);
  });

  it("cannot deal while a round is in progress", () => {
    const g = deal(rig(rules(), ["10", "10", "6", "7"]), 10);
    expect(g.phase).toBe("player");
    expect(() => deal(g, 10)).toThrow(GameError);
    expect(() => changeRules(g, rules())).toThrow(GameError);
  });
});

describe("shoe management", () => {
  it("reshuffles once penetration is reached", () => {
    let g = createGame(rules({ decks: 1, penetration: 0.75 }), 100000);
    let shuffled = false;
    for (let i = 0; i < 30; i++) {
      g = deal(g, 5);
      if (g.shuffledThisRound) shuffled = true;
      while (g.phase === "player") g = act(g, "stand");
      if (g.phase === "insurance") g = resolveInsurance(g, false);
      while (g.phase === "player") g = act(g, "stand");
    }
    expect(shuffled).toBe(true);
  });

  it("chip totals are conserved across many random rounds", () => {
    let g = createGame(rules({ insuranceOffered: true }), 100000);
    let net = 0;
    for (let i = 0; i < 400; i++) {
      g = deal(g, 10);
      if (g.phase === "insurance") g = resolveInsurance(g, i % 2 === 0);
      let guard = 0;
      while (g.phase === "player" && guard++ < 50) {
        const legal = legalActions(g);
        g = act(g, legal[i % legal.length]!);
      }
      expect(g.phase).toBe("settled");
      net += g.result!.net;
    }
    expect(Math.round(g.bankroll * 100)).toBe(Math.round((100000 + net) * 100));
  });
});
