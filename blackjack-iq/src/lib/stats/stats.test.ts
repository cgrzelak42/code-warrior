import { describe, expect, it } from "vitest";
import { act, createRiggedGame, deal } from "../engine/game";
import { DEFAULT_RULES } from "../engine/rules";
import { cards } from "../engine/testUtils";
import { loadJSON, memoryStore, saveJSON, STORAGE_KEYS } from "../storage/persist";
import { restoreGame } from "../storage/gameState";
import { sanitizeSettings, DEFAULT_SETTINGS } from "../settings";
import { generateScenario, gradeAnswer, scoreFor } from "../training/training";
import { accuracy, accuracyTrend, emptyStats, recordDecision, recordRound, sanitizeStats, topMistakes } from "./stats";

const rules = { ...DEFAULT_RULES, insuranceOffered: false };

describe("statistics", () => {
  it("tracks decisions, streaks and mistakes", () => {
    let s = emptyStats();
    const d = { source: "play" as const, category: "hard" as const, position: "Hard 16 vs 10", recommended: "hit" as const };
    s = recordDecision(s, { ...d, chosen: "hit" });
    s = recordDecision(s, { ...d, chosen: "hit" });
    s = recordDecision(s, { ...d, chosen: "stand" });
    s = recordDecision(s, { ...d, chosen: "stand" });
    s = recordDecision(s, { ...d, chosen: "hit" });
    expect(s.decisions.total).toBe(5);
    expect(s.decisions.correct).toBe(3);
    expect(accuracy(s.decisions)).toBeCloseTo(0.6);
    expect(s.streak).toEqual({ current: 1, best: 2 });
    expect(topMistakes(s)[0]).toMatchObject({ position: "Hard 16 vs 10", chosen: "stand", count: 2 });
    expect(s.decisions.byCategory.hard.total).toBe(5);
    expect(accuracyTrend(s, 2).map((p) => p.accuracy)).toEqual([100, 0, 100]);
  });

  it("records game results separately from strategy accuracy", () => {
    let g = deal(createRiggedGame(rules, 1000, cards("10", "10", "6", "9", "8")), 10);
    g = act(g, "stand"); // flagged below as a round with all-correct decisions that still lost
    let s = recordRound(emptyStats(), g.result!, true);
    expect(s.rounds).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.net).toBe(-10);
    expect(s.correctButLost).toBe(1);
    g = deal(createRiggedGame(rules, 1000, cards("A", "9", "K", "7")), 10);
    s = recordRound(s, g.result!, null);
    expect(s.blackjacks).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.net).toBe(5);
    expect(s.roundHistory).toHaveLength(2);
  });

  it("persists across a simulated refresh", () => {
    const store = memoryStore();
    let s = emptyStats();
    s = recordDecision(s, { source: "train", category: "soft", position: "Soft 18 (A,7) vs 9", chosen: "stand", recommended: "hit" });
    saveJSON(store, STORAGE_KEYS.stats, s);
    const loaded = loadJSON(store, STORAGE_KEYS.stats, sanitizeStats, emptyStats());
    expect(loaded).toEqual(s);
  });

  it("recovers from corrupt stored data", () => {
    const store = memoryStore();
    store.setItem(STORAGE_KEYS.stats, "{not json");
    expect(loadJSON(store, STORAGE_KEYS.stats, sanitizeStats, emptyStats()).rounds).toBe(0);
    expect(sanitizeStats({ version: 99 }).rounds).toBe(0);
    expect(sanitizeSettings({ rules: { decks: 3, blackjackPayout: "6:5" }, coachReview: "bogus" })).toMatchObject({
      coachReview: DEFAULT_SETTINGS.coachReview,
      rules: { decks: DEFAULT_RULES.decks, blackjackPayout: "6:5" },
    });
  });

  it("restores a round in progress after refresh", () => {
    const store = memoryStore();
    const g = deal(createRiggedGame(rules, 1000, cards("10", "9", "6", "8", "5", "3")), 25);
    expect(g.phase).toBe("player");
    saveJSON(store, STORAGE_KEYS.game, g);
    const restored = restoreGame(loadJSON(store, STORAGE_KEYS.game, (x) => x, null), rules);
    expect(restored.phase).toBe("player");
    expect(restored.bankroll).toBe(975);
    const next = act(restored, "hit");
    expect(next.hands[0]!.cards).toHaveLength(3);
    expect(restoreGame({ garbage: true }, rules).phase).toBe("betting");
  });
});

describe("training", () => {
  let n = 0;
  const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);

  it("generates valid scenarios for each difficulty", () => {
    for (const diff of ["easy", "medium", "hard"] as const)
      for (let i = 0; i < 100; i++) {
        const s = generateScenario(diff, rules, rng);
        expect(s.cards).toHaveLength(2);
        if (diff === "easy") {
          expect(s.category).toBe("hard");
          expect(s.recommendation.strength).toBe("strong");
        }
        if (s.recommendation.action === "split") expect(s.ctx.canSplit).toBe(true);
        if (s.recommendation.action === "double") expect(s.ctx.canDouble).toBe(true);
      }
  });

  it("grades answers and scores faster answers higher", () => {
    const s = generateScenario("medium", rules, rng);
    const right = gradeAnswer(s, s.recommendation.action, 1000);
    const wrong = gradeAnswer(s, s.recommendation.action === "hit" ? "stand" : "hit", 1000);
    expect(right.correct).toBe(true);
    expect(wrong.correct).toBe(false);
    expect(gradeAnswer(s, null, 10000).correct).toBe(false);
    expect(scoreFor(right, "medium", 10)).toBeGreaterThan(scoreFor({ ...right, timeMs: 9000 }, "medium", 10));
    expect(scoreFor(wrong, "hard", 10)).toBe(0);
  });
});
