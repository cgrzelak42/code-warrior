// Statistics model. Game results (chips, wins, losses) and strategy performance (decision
// accuracy) are tracked separately on purpose: a correct decision can still lose the hand.

import type { Action, RoundResult } from "../engine/game";
import type { HandCategory } from "../strategy/coach";

export type DecisionCategory = HandCategory | "insurance";
export type DecisionChoice = Action | "insurance" | "no-insurance" | "timeout";
export type DecisionSource = "play" | "train";

export interface DecisionInput {
  source: DecisionSource;
  category: DecisionCategory;
  /** e.g. "Hard 16 vs 10" */
  position: string;
  chosen: DecisionChoice;
  recommended: DecisionChoice;
  t?: number;
}

export interface Tally {
  total: number;
  correct: number;
}

export interface Mistake {
  position: string;
  chosen: DecisionChoice;
  recommended: DecisionChoice;
  category: DecisionCategory;
  count: number;
  lastAt: number;
}

export interface RoundPoint {
  t: number;
  round: number;
  net: number;
  bankroll: number;
}

export interface DecisionPoint {
  t: number;
  correct: boolean;
  source: DecisionSource;
}

export interface Stats {
  version: 1;
  rounds: number;
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  doubles: number;
  splits: number;
  dealerBlackjacks: number;
  totalWagered: number;
  net: number;
  biggestWin: number;
  biggestLoss: number;
  /** Rounds where every decision matched basic strategy but the round still lost chips. */
  correctButLost: number;
  decisions: Tally & { byCategory: Record<DecisionCategory, Tally>; bySource: Record<DecisionSource, Tally> };
  streak: { current: number; best: number };
  mistakes: Record<string, Mistake>;
  roundHistory: RoundPoint[];
  decisionHistory: DecisionPoint[];
  startedAt: number;
}

const MAX_ROUNDS = 500;
const MAX_DECISIONS = 2000;

const tally = (): Tally => ({ total: 0, correct: 0 });

export function emptyStats(now = Date.now()): Stats {
  return {
    version: 1,
    rounds: 0,
    hands: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    busts: 0,
    doubles: 0,
    splits: 0,
    dealerBlackjacks: 0,
    totalWagered: 0,
    net: 0,
    biggestWin: 0,
    biggestLoss: 0,
    correctButLost: 0,
    decisions: {
      total: 0,
      correct: 0,
      byCategory: { hard: tally(), soft: tally(), pair: tally(), insurance: tally() },
      bySource: { play: tally(), train: tally() },
    },
    streak: { current: 0, best: 0 },
    mistakes: {},
    roundHistory: [],
    decisionHistory: [],
    startedAt: now,
  };
}

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const sanTally = (v: unknown): Tally => {
  const o = (v ?? {}) as Record<string, unknown>;
  return { total: num(o.total), correct: num(o.correct) };
};

/** Validates stored stats; unknown or corrupt data falls back to safe defaults. */
export function sanitizeStats(raw: unknown): Stats {
  const base = emptyStats();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return base;
  const s: Stats = { ...base };
  for (const k of [
    "rounds", "hands", "wins", "losses", "pushes", "blackjacks", "busts", "doubles", "splits",
    "dealerBlackjacks", "totalWagered", "net", "biggestWin", "biggestLoss", "correctButLost", "startedAt",
  ] as const) {
    s[k] = num(o[k], base[k]);
  }
  const d = (o.decisions ?? {}) as Record<string, unknown>;
  const bc = (d.byCategory ?? {}) as Record<string, unknown>;
  const bs = (d.bySource ?? {}) as Record<string, unknown>;
  s.decisions = {
    total: num(d.total),
    correct: num(d.correct),
    byCategory: { hard: sanTally(bc.hard), soft: sanTally(bc.soft), pair: sanTally(bc.pair), insurance: sanTally(bc.insurance) },
    bySource: { play: sanTally(bs.play), train: sanTally(bs.train) },
  };
  const st = (o.streak ?? {}) as Record<string, unknown>;
  s.streak = { current: num(st.current), best: num(st.best) };
  s.mistakes = o.mistakes && typeof o.mistakes === "object" ? (o.mistakes as Record<string, Mistake>) : {};
  s.roundHistory = Array.isArray(o.roundHistory) ? (o.roundHistory as RoundPoint[]).slice(-MAX_ROUNDS) : [];
  s.decisionHistory = Array.isArray(o.decisionHistory) ? (o.decisionHistory as DecisionPoint[]).slice(-MAX_DECISIONS) : [];
  return s;
}

export function recordDecision(prev: Stats, d: DecisionInput): Stats {
  const t = d.t ?? Date.now();
  const correct = d.chosen === d.recommended;
  const s: Stats = structuredClone(prev);
  s.decisions.total++;
  s.decisions.byCategory[d.category].total++;
  s.decisions.bySource[d.source].total++;
  if (correct) {
    s.decisions.correct++;
    s.decisions.byCategory[d.category].correct++;
    s.decisions.bySource[d.source].correct++;
    s.streak.current++;
    s.streak.best = Math.max(s.streak.best, s.streak.current);
  } else {
    s.streak.current = 0;
    const key = `${d.position}|${d.chosen}`;
    const m = s.mistakes[key];
    s.mistakes[key] = m
      ? { ...m, count: m.count + 1, lastAt: t, recommended: d.recommended }
      : { position: d.position, chosen: d.chosen, recommended: d.recommended, category: d.category, count: 1, lastAt: t };
  }
  s.decisionHistory.push({ t, correct, source: d.source });
  if (s.decisionHistory.length > MAX_DECISIONS) s.decisionHistory.splice(0, s.decisionHistory.length - MAX_DECISIONS);
  return s;
}

/**
 * Records a settled round. `allDecisionsCorrect` (null when no decision was made) lets the
 * dashboard show how often correct play still lost.
 */
export function recordRound(prev: Stats, r: RoundResult, allDecisionsCorrect: boolean | null, t = Date.now()): Stats {
  const s: Stats = structuredClone(prev);
  s.rounds++;
  for (const h of r.hands) {
    s.hands++;
    s.totalWagered += h.bet;
    if (h.outcome === "win") s.wins++;
    else if (h.outcome === "blackjack") {
      s.wins++;
      s.blackjacks++;
    } else if (h.outcome === "push") s.pushes++;
    else {
      s.losses++;
      if (h.outcome === "bust") s.busts++;
    }
    if (h.doubled) s.doubles++;
  }
  if (r.hands.length > 1) s.splits += r.hands.length - 1;
  if (r.dealerBlackjack) s.dealerBlackjacks++;
  s.totalWagered += r.insuranceBet;
  s.net = Math.round((s.net + r.net) * 100) / 100;
  s.biggestWin = Math.max(s.biggestWin, r.net);
  s.biggestLoss = Math.min(s.biggestLoss, r.net);
  if (allDecisionsCorrect === true && r.net < 0) s.correctButLost++;
  s.roundHistory.push({ t, round: s.rounds, net: r.net, bankroll: r.bankrollAfter });
  if (s.roundHistory.length > MAX_ROUNDS) s.roundHistory.splice(0, s.roundHistory.length - MAX_ROUNDS);
  return s;
}

export function accuracy(t: Tally): number | null {
  return t.total === 0 ? null : t.correct / t.total;
}

export function topMistakes(s: Stats, n = 5): Mistake[] {
  return Object.values(s.mistakes)
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, n);
}

/** Accuracy in consecutive blocks of decisions, for the "over time" chart. */
export function accuracyTrend(s: Stats, block = 20): { label: string; accuracy: number; decisions: number }[] {
  const out: { label: string; accuracy: number; decisions: number }[] = [];
  const h = s.decisionHistory;
  for (let i = 0; i < h.length; i += block) {
    // Fold a short trailing chunk into the previous block so one decision can't swing the line.
    if (out.length > 0 && h.length - i < block / 2) {
      const last = out.pop() as { label: string; accuracy: number; decisions: number };
      i -= last.decisions;
      const chunk = h.slice(i);
      const correct = chunk.filter((d) => d.correct).length;
      out.push({ label: `${i + 1}–${h.length}`, accuracy: Math.round((correct / chunk.length) * 100), decisions: chunk.length });
      break;
    }
    const chunk = h.slice(i, i + block);
    const correct = chunk.filter((d) => d.correct).length;
    out.push({ label: `${i + 1}–${i + chunk.length}`, accuracy: Math.round((correct / chunk.length) * 100), decisions: chunk.length });
  }
  return out;
}
