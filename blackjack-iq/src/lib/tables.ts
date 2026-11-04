// Table progression. Each table has its own scenery, felt and stakes, and unlocks once the
// player's bankroll has reached a set high point. Unlocks are permanent: losing chips or
// resetting the bankroll never locks a table again.

import { STARTING_BANKROLL } from "./engine/bankroll";

export type SceneId = "lake" | "alpine" | "beach" | "aurora";

export interface TableDef {
  id: SceneId;
  name: string;
  tagline: string;
  /** Highest bankroll the player must have reached to sit here. */
  unlockAt: number;
  minBet: number;
  maxBet: number;
  felt: { base: string; light: string; dark: string };
  /** Light falling on the table from the scene (sunset glow, moonlight). */
  ambient: string;
}

export const TABLES: readonly TableDef[] = [
  {
    id: "lake",
    name: "Lakeside Lodge",
    tagline: "Dusk over a still mountain lake",
    unlockAt: 0,
    minBet: 5,
    maxBet: 500,
    felt: { base: "#14604f", light: "#1f7d68", dark: "#0a3a30" },
    ambient: "rgba(255, 170, 120, 0.16)",
  },
  {
    id: "alpine",
    name: "Alpine Chalet",
    tagline: "Snow peaks in the last light",
    unlockAt: 2_000,
    minBet: 10,
    maxBet: 1_000,
    felt: { base: "#1b5a36", light: "#26744a", dark: "#0d341f" },
    ambient: "rgba(255, 214, 160, 0.14)",
  },
  {
    id: "beach",
    name: "Sunset Beach Club",
    tagline: "Palms, surf and a sinking sun",
    unlockAt: 4_000,
    minBet: 25,
    maxBet: 2_500,
    felt: { base: "#0f5873", light: "#187594", dark: "#073246" },
    ambient: "rgba(255, 140, 90, 0.2)",
  },
  {
    id: "aurora",
    name: "Aurora Fjord",
    tagline: "High stakes under the northern lights",
    unlockAt: 8_000,
    minBet: 100,
    maxBet: 5_000,
    felt: { base: "#4a1d4f", light: "#62296a", dark: "#260c2a" },
    ambient: "rgba(110, 255, 200, 0.12)",
  },
];

export const LOWEST_MIN_BET = Math.min(...TABLES.map((t) => t.minBet));

export function tableById(id: string | undefined): TableDef {
  return TABLES.find((t) => t.id === id) ?? (TABLES[0] as TableDef);
}

export function isUnlocked(table: TableDef, peak: number): boolean {
  return peak >= table.unlockAt;
}

/** Tables newly unlocked when the peak bankroll rises from `before` to `after`. */
export function newlyUnlocked(before: number, after: number): TableDef[] {
  return TABLES.filter((t) => t.unlockAt > 0 && before < t.unlockAt && after >= t.unlockAt);
}

/** The next table still locked at this peak, if any. */
export function nextLocked(peak: number): TableDef | null {
  return TABLES.find((t) => !isUnlocked(t, peak)) ?? null;
}

export type BankrollState = "ok" | "below-table-min" | "out-of-chips";

/**
 * Whether the player can keep betting. "below-table-min" means they can still play at a
 * cheaper table; only "out-of-chips" (below every table's minimum) allows a reset.
 */
export function bankrollState(bankroll: number, table: TableDef): BankrollState {
  if (bankroll < LOWEST_MIN_BET) return "out-of-chips";
  if (bankroll < table.minBet) return "below-table-min";
  return "ok";
}

/** The highest-stakes unlocked table the player can afford to sit at. */
export function bestAffordableTable(bankroll: number, peak: number): TableDef {
  const options = TABLES.filter((t) => isUnlocked(t, peak) && bankroll >= t.minBet);
  return options[options.length - 1] ?? (TABLES[0] as TableDef);
}

export interface Progress {
  version: 1;
  /** Highest bankroll ever reached; drives unlocks and never goes down. */
  peakBankroll: number;
  tableId: SceneId;
  /** Number of times the player has reset after running out of chips. */
  resets: number;
}

export function defaultProgress(): Progress {
  return { version: 1, peakBankroll: STARTING_BANKROLL, tableId: "lake", resets: 0 };
}

export function sanitizeProgress(raw: unknown): Progress {
  const d = defaultProgress();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return d;
  const peak = typeof o.peakBankroll === "number" && Number.isFinite(o.peakBankroll) ? Math.max(d.peakBankroll, o.peakBankroll) : d.peakBankroll;
  const table = tableById(typeof o.tableId === "string" ? o.tableId : undefined);
  return {
    version: 1,
    peakBankroll: peak,
    // Never restore a seat at a table that isn't unlocked.
    tableId: isUnlocked(table, peak) ? table.id : "lake",
    resets: typeof o.resets === "number" && o.resets >= 0 ? Math.floor(o.resets) : 0,
  };
}
