import { describe, expect, it } from "vitest";
import { act, createRiggedGame, deal, setBankroll } from "./engine/game";
import { DEFAULT_RULES } from "./engine/rules";
import { cards } from "./engine/testUtils";
import {
  LOWEST_MIN_BET,
  TABLES,
  bankrollState,
  bestAffordableTable,
  defaultProgress,
  isUnlocked,
  newlyUnlocked,
  nextLocked,
  sanitizeProgress,
  tableById,
} from "./tables";

const lake = tableById("lake");
const beach = tableById("beach");

describe("table unlocks", () => {
  it("starts with only the first table unlocked", () => {
    const peak = defaultProgress().peakBankroll;
    expect(TABLES.filter((t) => isUnlocked(t, peak)).map((t) => t.id)).toEqual(["lake"]);
    expect(nextLocked(peak)?.id).toBe("alpine");
  });

  it("unlocks tables as the best bankroll passes each threshold", () => {
    expect(newlyUnlocked(1_000, 1_999).map((t) => t.id)).toEqual([]);
    expect(newlyUnlocked(1_000, 2_000).map((t) => t.id)).toEqual(["alpine"]);
    expect(newlyUnlocked(1_900, 9_000).map((t) => t.id)).toEqual(["alpine", "beach", "aurora"]);
    expect(newlyUnlocked(4_500, 5_000)).toEqual([]);
    expect(nextLocked(8_000)).toBeNull();
  });

  it("thresholds and stakes rise table by table", () => {
    for (let i = 1; i < TABLES.length; i++) {
      expect(TABLES[i]!.unlockAt).toBeGreaterThan(TABLES[i - 1]!.unlockAt);
      expect(TABLES[i]!.minBet).toBeGreaterThanOrEqual(TABLES[i - 1]!.minBet);
    }
    expect(LOWEST_MIN_BET).toBe(5);
  });

  it("restores progress safely and never seats you at a locked table", () => {
    expect(sanitizeProgress({ version: 1, peakBankroll: 2_500, tableId: "aurora", resets: 2 })).toEqual({
      version: 1,
      peakBankroll: 2_500,
      tableId: "lake",
      resets: 2,
    });
    expect(sanitizeProgress({ version: 1, peakBankroll: 9_000, tableId: "aurora", resets: 0 }).tableId).toBe("aurora");
    expect(sanitizeProgress("garbage")).toEqual(defaultProgress());
    expect(sanitizeProgress({ version: 1, peakBankroll: -50, tableId: "nope" }).peakBankroll).toBe(1_000);
  });
});

describe("bankroll limits", () => {
  it("only counts as out of chips below every table's minimum", () => {
    expect(bankrollState(1_000, beach)).toBe("ok");
    expect(bankrollState(20, beach)).toBe("below-table-min");
    expect(bankrollState(20, lake)).toBe("ok");
    expect(bankrollState(4.99, lake)).toBe("out-of-chips");
    expect(bankrollState(0, beach)).toBe("out-of-chips");
  });

  it("suggests the highest-stakes table you can still afford", () => {
    expect(bestAffordableTable(20, 9_000).id).toBe("alpine");
    expect(bestAffordableTable(20, 1_000).id).toBe("lake");
    expect(bestAffordableTable(500, 9_000).id).toBe("aurora");
  });
});

describe("bankroll carries over between hands", () => {
  it("each new deal starts from the previous hand's bankroll", () => {
    const rules = { ...DEFAULT_RULES, insuranceOffered: false };
    // Round 1: player 20 vs dealer 18 → +10. Round 2: player 16 hits and busts → −10.
    let g = createRiggedGame(rules, 1_000, cards("10", "10", "10", "8", "10", "9", "6", "7", "K"));
    g = act(deal(g, 10), "stand");
    expect(g.bankroll).toBe(1_010);
    g = deal(g, 10); // the bet comes off the bankroll when the hand is dealt
    expect(g.bankroll).toBe(1_000);
    g = act(g, "hit");
    expect(g.phase).toBe("settled");
    expect(g.result?.net).toBe(-10);
    expect(g.bankroll).toBe(1_000);
    // A reset is a separate, explicit step.
    expect(setBankroll(g, 1_000).bankroll).toBe(1_000);
  });
});
