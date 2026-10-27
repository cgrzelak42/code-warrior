// Training-mode scenario generation and grading. No chips are involved.

import { type Card, type Rank, type Rng, type Suit, SUITS, cryptoRng, upcardLabel, type UpcardValue, UPCARDS } from "../engine/cards";
import type { Action } from "../engine/game";
import type { Rules } from "../engine/rules";
import { type HandCategory, type LegalContext, type Recommendation, firstTwoCardContext, recommend } from "../strategy/coach";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; description: string }> = {
  easy: { label: "Rookie", description: "Hard totals with clear-cut answers." },
  medium: { label: "Regular", description: "Hard and soft totals, including some closer calls." },
  hard: { label: "High Roller", description: "Pairs, soft doubles and the closest decisions in the chart." },
};

export interface Scenario {
  id: string;
  cards: Card[];
  dealerUp: Card;
  category: HandCategory;
  ctx: LegalContext;
  recommendation: Recommendation;
}

export interface TrainingAnswer {
  scenario: Scenario;
  chosen: Action | null; // null = timed out
  correct: boolean;
  timeMs: number;
}

const TEN_RANKS: Rank[] = ["10", "J", "Q", "K"];
let seq = 0;

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)] as T;
}

function rankFor(value: number, rng: Rng): Rank {
  if (value === 11 || value === 1) return "A";
  if (value === 10) return pick(TEN_RANKS, rng);
  return String(value) as Rank;
}

function makeCard(rank: Rank, rng: Rng): Card {
  const suit: Suit = pick(SUITS, rng);
  return { rank, suit, id: `tr${seq++}-${rank}${suit[0]}` };
}

function hardPair(total: number, rng: Rng): [number, number] {
  const options: [number, number][] = [];
  for (let a = 2; a <= 10; a++) {
    const b = total - a;
    if (b >= 2 && b <= 10 && a !== b && a < b) options.push([a, b]);
  }
  return pick(options, rng);
}

function buildScenario(category: HandCategory, row: number, up: UpcardValue, rules: Rules, rng: Rng): Scenario {
  let values: [number, number];
  if (category === "pair") values = [row, row];
  else if (category === "soft") values = [11, row - 11];
  else values = hardPair(row, rng);
  const cards = values.map((v) => makeCard(rankFor(v, rng), rng));
  if (rng() < 0.5) cards.reverse();
  const dealerUp = makeCard(rankFor(up, rng), rng);
  const ctx = firstTwoCardContext(rules, cards);
  return {
    id: `s${seq++}`,
    cards,
    dealerUp,
    category,
    ctx,
    recommendation: recommend(cards, dealerUp.rank, rules, ctx),
  };
}

const ROWS: Record<HandCategory, number[]> = {
  hard: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
  soft: [13, 14, 15, 16, 17, 18, 19, 20],
  pair: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const WEIGHTS: Record<Difficulty, [HandCategory, number][]> = {
  easy: [["hard", 1]],
  medium: [["hard", 0.6], ["soft", 0.4]],
  hard: [["hard", 0.35], ["soft", 0.3], ["pair", 0.35]],
};

export function generateScenario(difficulty: Difficulty, rules: Rules, rng: Rng = cryptoRng): Scenario {
  for (let attempt = 0; attempt < 40; attempt++) {
    let r = rng();
    let category: HandCategory = "hard";
    for (const [c, w] of WEIGHTS[difficulty]) {
      if (r < w) {
        category = c;
        break;
      }
      r -= w;
    }
    const rows = ROWS[category].filter((row) => !(difficulty === "hard" && category === "hard" && (row < 8 || row > 17)));
    const s = buildScenario(category, pick(rows, rng), pick(UPCARDS, rng), rules, rng);
    const strength = s.recommendation.strength;
    if (difficulty === "easy" && strength !== "strong") continue;
    // High Roller favours close and moderately close decisions.
    if (difficulty === "hard" && strength === "strong" && rng() < 0.7) continue;
    return s;
  }
  return buildScenario("hard", 16, 10, rules, rng);
}

export function gradeAnswer(s: Scenario, chosen: Action | null, timeMs: number): TrainingAnswer {
  return { scenario: s, chosen, correct: chosen === s.recommendation.action, timeMs };
}

export function scenarioTitle(s: Scenario): string {
  return `${s.recommendation.position.replace(/ vs .*/, "")} vs dealer ${upcardLabel(s.recommendation.chartRef.up)}`;
}

/** Points per correct answer: harder difficulty and faster answers score more. */
export function scoreFor(answer: TrainingAnswer, difficulty: Difficulty, timerSeconds: number): number {
  if (!answer.correct) return 0;
  const base = difficulty === "easy" ? 10 : difficulty === "medium" ? 15 : 25;
  if (!timerSeconds) return base;
  const remaining = Math.max(0, 1 - answer.timeMs / (timerSeconds * 1000));
  return base + Math.round(base * remaining);
}
