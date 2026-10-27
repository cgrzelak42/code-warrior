// User preferences (rules + presentation). Persisted with the storage layer.

import { DEFAULT_RULES, type Rules, sanitizeRules } from "./engine/rules";
import type { Difficulty } from "./training/training";

export type CoachMode = "always" | "on-demand" | "off";
export type AnimationSpeed = "normal" | "fast" | "off";

export interface Settings {
  rules: Rules;
  sound: boolean;
  volume: number;
  animation: AnimationSpeed;
  /** Show the coaching panel before each decision. */
  coach: CoachMode;
  /** Show post-decision feedback comparing the play with basic strategy. */
  feedback: boolean;
  trainingTimer: 0 | 5 | 10 | 15;
  trainingDifficulty: Difficulty;
}

export const DEFAULT_SETTINGS: Settings = {
  rules: DEFAULT_RULES,
  sound: true,
  volume: 0.5,
  animation: "normal",
  coach: "always",
  feedback: true,
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
  if (o.coach === "always" || o.coach === "on-demand" || o.coach === "off") s.coach = o.coach;
  if (typeof o.feedback === "boolean") s.feedback = o.feedback;
  if (o.trainingTimer === 0 || o.trainingTimer === 5 || o.trainingTimer === 10 || o.trainingTimer === 15) s.trainingTimer = o.trainingTimer;
  if (o.trainingDifficulty === "easy" || o.trainingDifficulty === "medium" || o.trainingDifficulty === "hard")
    s.trainingDifficulty = o.trainingDifficulty;
  return s;
}
