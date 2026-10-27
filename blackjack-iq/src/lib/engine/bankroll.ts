// Virtual bankroll helpers. Chips are play money only: there are no deposits, withdrawals or payments.

export const STARTING_BANKROLL = 1000;
export const CHIP_VALUES = [5, 25, 100, 500, 1000] as const;
export type ChipValue = (typeof CHIP_VALUES)[number];

/** Rounds to cents so 3:2 and 6:5 payouts never accumulate floating-point drift. */
export function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function canAfford(bankroll: number, amount: number): boolean {
  return money(bankroll) + 1e-9 >= money(amount);
}

export function formatChips(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(n);
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  if (opts.sign) return `${n > 0 ? "+" : n < 0 ? "−" : ""}$${body}`;
  return `${n < 0 ? "−" : ""}$${body}`;
}

/** Breaks an amount into chip denominations (largest first) for rendering chip stacks. */
export function chipBreakdown(amount: number): ChipValue[] {
  const chips: ChipValue[] = [];
  let rest = Math.floor(amount);
  for (const v of [...CHIP_VALUES].reverse()) {
    while (rest >= v && chips.length < 12) {
      chips.push(v);
      rest -= v;
    }
  }
  return chips;
}
