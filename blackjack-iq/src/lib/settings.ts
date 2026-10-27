// User preferences (rules + presentation). Persisted with the storage layer.

import { DEFAULT_RULES, type Rules, sanitizeRules } from "./engine/rules";
import type { Difficulty } from "./training/training";

export type AnimationSpeed = "normal" | "fast" | "off";

export interface Settings {
  rules: Rules;
  sound: boolean;
  volume: number;
  animation: AnimationSpeed;
  /**
   * Show the coach's review of every decision once the round is over. The coach never
   * suggests a play while the hand is still being played.
   */
  coachReview: boolean;
  trainingTimer: 0 | 5 | 10 | 15;
  trainingDifficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = {
  rules: DEFAULT_RULES,
  sound: true,
  volume: 0.5,
  animation: "normal",
  coachReview: true,
  trainingTimer: 10,
  trainingDifficulty: "medium",
};

export function sanitizeSettings(raw: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return s;
  const o = raw as Record<string, unknown>;
  s.rules = sanitizeRules(o.rules);
  if (typeof o.sound === "boolean") s.sound = o.sound;
  if (typeof o.volume === "number" && o.volume >= 0 && o.volume <= 1) s.volume = o.volume;
  if (o.animation === "normal" || o.animation === "fast" || o.animation === "off") s.animation = o.animation;
  if (typeof o.coachReview === "boolean") s.coachReview = o.coachReview;
  if (o.trainingTimer === 0 || o.trainingTimer === 5 || o.trainingTimer === 10 || o.trainingTimer === 15) s.trainingTimer = o.trainingTimer;
  if (o.trainingDifficulty === "easy" || o.trainingDifficulty === "medium" || o.trainingDifficulty === "hard")
    s.trainingDifficulty = o.trainingDifficulty;
  return s;
}
