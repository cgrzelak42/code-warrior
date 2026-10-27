"use client";

// App-wide state: settings, the table, statistics, sound. Engine calls happen in event handlers
// (never inside state updaters) so each round and decision is recorded exactly once.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STARTING_BANKROLL } from "@/lib/engine/bankroll";
import { type Action, type GameState, act, changeRules, createGame, deal, legalActions, resolveInsurance, setBankroll } from "@/lib/engine/game";
import type { Rules } from "@/lib/engine/rules";
import { type Recommendation, insuranceAdvice, recommend } from "@/lib/strategy/coach";
import { type DecisionInput, type Stats, emptyStats, recordDecision, recordRound, sanitizeStats } from "@/lib/stats/stats";
import { restoreGame } from "@/lib/storage/gameState";
import { STORAGE_KEYS, browserStore, loadJSON, saveJSON } from "@/lib/storage/persist";
import { DEFAULT_SETTINGS, type Settings, sanitizeSettings } from "@/lib/settings";
import { type SoundName, playSound } from "@/lib/sound";

export interface DecisionFeedback {
  id: number;
  kind: "action" | "insurance";
  chosen: Action | "insurance" | "no-insurance";
  recommended: Action | "insurance" | "no-insurance";
  correct: boolean;
  position: string;
  explanation: string;
  rec: Recommendation | null;
}

interface AppContextValue {
  hydrated: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  updateRules: (patch: Partial<Rules>) => void;
  game: GameState;
  /** Rules the next round will use (may differ from game.rules mid-round). */
  pendingRulesDiffer: boolean;
  placeBet: (amount: number) => string | null;
  playAction: (action: Action) => void;
  decideInsurance: (take: boolean) => void;
  resetBankroll: () => void;
  lastBet: number;
  feedback: DecisionFeedback | null;
  clearFeedback: () => void;
  stats: Stats;
  logDecision: (d: DecisionInput) => void;
  resetStats: () => void;
  sound: (name: SoundName) => void;
  /** Bankroll to display: held at the pre-settlement amount while the dealer reveal animates. */
  displayBankroll: number;
  setBankrollHold: (amount: number | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Recommendation for the active hand right now, or null if no decision is pending. */
export function currentRecommendation(game: GameState): Recommendation | null {
  if (game.phase !== "player") return null;
  const hand = game.hands[game.activeHand];
  const up = game.dealer[0];
  if (!hand || !up) return null;
  const legal = legalActions(game);
  if (legal.length === 0) return null;
  return recommend(hand.cards, up.rank, game.rules, {
    canHit: legal.includes("hit"),
    canDouble: legal.includes("double"),
    canSplit: legal.includes("split"),
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [game, setGame] = useState<GameState>(() => createGame(DEFAULT_SETTINGS.rules, STARTING_BANKROLL, () => 0.5));
  const [stats, setStats] = useState<Stats>(() => emptyStats(0));
  const [feedback, setFeedback] = useState<DecisionFeedback | null>(null);
  const [lastBet, setLastBet] = useState(25);
  const [bankrollHold, setBankrollHold] = useState<number | null>(null);
  const roundDecisions = useRef<boolean[]>([]);
  const feedbackId = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Load persisted state once on the client.
  useEffect(() => {
    const store = browserStore();
    const s = loadJSON(store, STORAGE_KEYS.settings, sanitizeSettings, DEFAULT_SETTINGS);
    setSettings(s);
    setStats(loadJSON(store, STORAGE_KEYS.stats, sanitizeStats, emptyStats()));
    const rawGame = loadJSON<unknown>(store, STORAGE_KEYS.game, (x) => x, null);
    const g = restoreGame(rawGame, s.rules);
    setGame(g);
    const lb = Number(store.getItem(STORAGE_KEYS.lastBet));
    if (Number.isFinite(lb) && lb > 0) setLastBet(lb);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveJSON(browserStore(), STORAGE_KEYS.settings, settings);
  }, [settings, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON(browserStore(), STORAGE_KEYS.stats, stats);
  }, [stats, hydrated]);
  useEffect(() => {
    if (hydrated) saveJSON(browserStore(), STORAGE_KEYS.game, game);
  }, [game, hydrated]);
  useEffect(() => {
    document.documentElement.dataset.anim = settings.animation;
  }, [settings.animation]);

  const sound = useCallback((name: SoundName) => {
    const s = settingsRef.current;
    if (s.sound) playSound(name, s.volume);
  }, []);

  const logDecision = useCallback((d: DecisionInput) => setStats((prev) => recordDecision(prev, d)), []);

  const settleIfDone = useCallback((next: GameState) => {
    if (next.phase === "settled" && next.result) {
      const decisions = roundDecisions.current;
      const allCorrect = decisions.length === 0 ? null : decisions.every(Boolean);
      const result = next.result;
      setStats((prev) => recordRound(prev, result, allCorrect));
      roundDecisions.current = [];
    }
  }, []);

  const placeBet = useCallback(
    (amount: number): string | null => {
      try {
        let g = game;
        const rules = settingsRef.current.rules;
        if (g.rules !== rules && JSON.stringify(g.rules) !== JSON.stringify(rules)) g = changeRules(g, rules);
        roundDecisions.current = [];
        const next = deal(g, amount);
        setGame(next);
        setLastBet(amount);
        setFeedback(null);
        try {
          browserStore().setItem(STORAGE_KEYS.lastBet, String(amount));
        } catch {
          /* ignore */
        }
        if (next.shuffledThisRound) sound("shuffle");
        settleIfDone(next);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "Could not deal.";
      }
    },
    [game, settleIfDone, sound],
  );

  const playAction = useCallback(
    (action: Action) => {
      const rec = currentRecommendation(game);
      let next: GameState;
      try {
        next = act(game, action);
      } catch {
        return; // Illegal moves are blocked in the UI; ignore stray key presses.
      }
      if (rec) {
        const correct = rec.action === action;
        roundDecisions.current.push(correct);
        setStats((prev) =>
          recordDecision(prev, { source: "play", category: rec.category, position: rec.position, chosen: action, recommended: rec.action }),
        );
        feedbackId.current += 1;
        setFeedback({
          id: feedbackId.current,
          kind: "action",
          chosen: action,
          recommended: rec.action,
          correct,
          position: rec.position,
          explanation: rec.explanation,
          rec,
        });
      }
      sound(action === "split" || action === "double" ? "chip" : action === "stand" ? "flip" : "card");
      setGame(next);
      settleIfDone(next);
    },
    [game, settleIfDone, sound],
  );

  const decideInsurance = useCallback(
    (take: boolean) => {
      let next: GameState;
      try {
        next = resolveInsurance(game, take);
      } catch {
        return;
      }
      const playerBJ = game.hands[0]?.status === "blackjack";
      const advice = insuranceAdvice(playerBJ);
      const correct = !take;
      roundDecisions.current.push(correct);
      const position = playerBJ ? "Even money (blackjack vs A)" : "Insurance vs A";
      setStats((prev) =>
        recordDecision(prev, { source: "play", category: "insurance", position, chosen: take ? "insurance" : "no-insurance", recommended: "no-insurance" }),
      );
      feedbackId.current += 1;
      setFeedback({
        id: feedbackId.current,
        kind: "insurance",
        chosen: take ? "insurance" : "no-insurance",
        recommended: "no-insurance",
        correct,
        position,
        explanation: advice.explanation,
        rec: null,
      });
      if (take) sound("chip");
      setGame(next);
      settleIfDone(next);
    },
    [game, settleIfDone, sound],
  );

  const resetBankroll = useCallback(() => {
    try {
      setGame((g) => setBankroll(g, STARTING_BANKROLL));
    } catch {
      /* mid-round: ignored, button is disabled then */
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const updateRules = useCallback((patch: Partial<Rules>) => {
    setSettings((s) => {
      const rules = { ...s.rules, ...patch };
      if (rules.maxBet < rules.minBet) rules.maxBet = rules.minBet;
      return { ...s, rules };
    });
  }, []);

  // Apply rule changes to the table immediately when no round is in progress.
  useEffect(() => {
    if (!hydrated) return;
    setGame((g) => {
      if (g.phase === "player" || g.phase === "insurance") return g;
      if (JSON.stringify(g.rules) === JSON.stringify(settings.rules)) return g;
      return changeRules(g, settings.rules);
    });
  }, [settings.rules, hydrated]);

  const resetStats = useCallback(() => setStats(emptyStats()), []);
  const clearFeedback = useCallback(() => setFeedback(null), []);

  const pendingRulesDiffer = JSON.stringify(game.rules) !== JSON.stringify(settings.rules);

  const value = useMemo<AppContextValue>(
    () => ({
      hydrated,
      settings,
      updateSettings,
      updateRules,
      game,
      pendingRulesDiffer,
      placeBet,
      playAction,
      decideInsurance,
      resetBankroll,
      lastBet,
      feedback,
      clearFeedback,
      stats,
      logDecision,
      resetStats,
      sound,
      displayBankroll: bankrollHold ?? game.bankroll,
      setBankrollHold,
    }),
    [bankrollHold, hydrated, settings, updateSettings, updateRules, game, pendingRulesDiffer, placeBet, playAction, decideInsurance, resetBankroll, lastBet, feedback, clearFeedback, stats, logDecision, resetStats, sound],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
