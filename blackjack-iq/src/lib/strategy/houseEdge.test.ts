import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "../engine/rules";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../settings";
import { edgeChange, expectedResult, formatEdge, houseEdge } from "./houseEdge";

describe("house edge", () => {
  it("defaults to a 6-deck S17 game at about 0.40%", () => {
    expect(DEFAULT_RULES.dealerHitsSoft17).toBe(false);
    expect(formatEdge(houseEdge(DEFAULT_RULES))).toBe("0.40%");
  });

  it("applies the published effect of each rule", () => {
    expect(houseEdge({ ...DEFAULT_RULES, dealerHitsSoft17: true })).toBeCloseTo(0.0062, 5);
    expect(houseEdge({ ...DEFAULT_RULES, blackjackPayout: "6:5" })).toBeCloseTo(0.0179, 5);
    expect(houseEdge({ ...DEFAULT_RULES, decks: 1 })).toBeLessThan(0);
    expect(houseEdge({ ...DEFAULT_RULES, doubleAfterSplit: false, doubleOn: "10-11" })).toBeCloseTo(0.0072, 5);
  });

  it("explains a change rule by rule", () => {
    const c = edgeChange({ ...DEFAULT_RULES, dealerHitsSoft17: true }, DEFAULT_RULES)!;
    expect(c.from).toBeCloseTo(0.0062, 5);
    expect(c.to).toBeCloseTo(0.004, 5);
    expect(c.reasons).toEqual([{ label: "Dealer now stands on soft 17", effect: -0.0022 }]);
    const otherRulesOnly = { ...DEFAULT_RULES, minBet: 25, insuranceOffered: false };
    expect(edgeChange(DEFAULT_RULES, otherRulesOnly)).toBeNull();
  });

  it("describes the average result per hand, including a player edge", () => {
    expect(expectedResult(0.004, 25)).toBe("lose about $0.10");
    expect(expectedResult(-0.002, 100)).toBe("win about $0.20");
    expect(expectedResult(0, 25)).toBe("break even");
  });
});

describe("soft 17 migration", () => {
  it("switches settings saved before v2 to stand on soft 17, once", () => {
    const old = { rules: { ...DEFAULT_RULES, dealerHitsSoft17: true, decks: 2 } };
    const migrated = sanitizeSettings(old);
    expect(migrated.rules.dealerHitsSoft17).toBe(false);
    expect(migrated.rules.decks).toBe(2);
    expect(migrated.rulesVersion).toBe(DEFAULT_SETTINGS.rulesVersion);
    // After migration, choosing H17 again is respected.
    expect(sanitizeSettings({ ...migrated, rules: { ...migrated.rules, dealerHitsSoft17: true } }).rules.dealerHitsSoft17).toBe(true);
  });
});
