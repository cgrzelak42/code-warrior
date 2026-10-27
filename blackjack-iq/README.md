# Blackjack IQ

A premium blackjack table and basic-strategy coach. You play with virtual chips only: there are no deposits, withdrawals or payments. It opens straight to the table, with no account needed.

## Features

- **Play**: full blackjack with hit, stand, double down, split (with resplits), insurance and even money, natural blackjack, dealer peek, and an H17 or S17 dealer. Blackjack pays 3:2, 6:5 or 1:1, and a multi-deck shoe reshuffles at the cut card. You get a virtual bankroll with chips, and the table has animated dealing, a hole-card flip, sound effects and keyboard shortcuts (H/S/D/P, Y/N, Enter).
- **Strategy coach**: the coach stays quiet while you play, so it never tells you what to do mid-hand. Once the round is over (after the dealer's cards are revealed), it reviews every decision you made, including insurance: whether it matched basic strategy, what basic strategy says and why, how strong that recommendation is, the dealer's bust odds, and the value of each possible play. All of these numbers are calculated from the cards actually left in the shoe at the moment you decided.
- **Train**: random decisions with no chips at stake. Three difficulty levels and an optional 5/10/15-second timer. Score, accuracy and streaks are tracked, and missed hands are saved for review so you can drill them again.
- **Strategy chart**: an interactive chart of hard totals, soft totals and pairs for the active rules. Click any cell to see the reasoning and the estimated value of every possible play.
- **Statistics**: game results (hands, W/L/P, blackjacks, net chips, bankroll over time) are tracked separately from strategy performance (accuracy, streaks, accuracy by hand type and over time, most common mistakes). It also counts how often correct play still lost.
- **Settings**: table rules (decks, soft 17, payout, doubling, DAS, split limits, resplit/hit split aces, insurance, table limits), how the coach appears, sound and volume, and animation speed.

Everything is saved in `localStorage`: settings, statistics, the missed-hand review list and the table itself, including a round in progress. All of it survives a refresh.

## Running it

Requires Node 20+.

```bash
cd blackjack-iq
npm install
npm run dev        # http://localhost:3000
npm test           # engine, strategy, stats and persistence tests (Vitest)
npm run lint       # strict TypeScript check
npm run build && npm start   # production build
npm run build:standalone     # one self-contained file: dist/blackjack-iq.html
```

The standalone build bundles the whole app (React, charts, styles) into a single HTML file. You can double-click it to play offline, put it on any static host, or publish it as one page. It uses a hash router instead of Next's file routes: `#play`, `#train`, `#chart`, `#stats` and `#rules` (Settings).

## Architecture

The game logic is plain TypeScript with no React, so it can be tested on its own.

| Module | Responsibility |
|---|---|
| `src/lib/engine/cards.ts` | Cards, decks, shoes, Fisher–Yates shuffle (crypto RNG, injectable), hand values |
| `src/lib/engine/rules.ts` | `Rules` type, defaults, validation, doubling restrictions |
| `src/lib/engine/game.ts` | Round state machine: deal → insurance → peek → player turn → dealer → settle. Every transition is pure and throws `GameError` on an illegal move |
| `src/lib/engine/bankroll.ts` | Chip values, money rounding, formatting |
| `src/lib/strategy/chart.ts` | Basic-strategy charts for 1, 2 and 4–8 decks × H17/S17 × DAS/no-DAS, with doubling restrictions applied |
| `src/lib/strategy/ev.ts` | Expected-value model from a shoe composition (dealer outcome distribution, stand/hit/double/split EV) |
| `src/lib/strategy/coach.ts` | Recommendation for legal actions, strength rating, explanations, insurance advice |
| `src/lib/training/training.ts` | Scenario generation by difficulty, grading, scoring, missed-hand review |
| `src/lib/stats/stats.ts` | Statistics model, recording, trends, mistakes |
| `src/lib/storage/*` | Versioned `localStorage` persistence with validation and a memory fallback |
| `src/components/*` | UI (Next.js App Router, React, Tailwind CSS, Lucide, Recharts) |

### How the coach decides

The **recommendation** comes from the published total-dependent basic-strategy chart for the active rules. The game offers no surrender, so it uses the no-surrender charts. When the chart's play isn't legal right now, the coach falls back the standard way: no double after a hit → hit (or stand for "Ds"), no split → play the total.

**Recommendation strength** comes from the EV model, run on the real shoe. At the table that means the cards you haven't seen (the undealt cards plus the dealer's hole card). The chart and training use a fresh shoe with the known cards removed. Strength is the gap in expected value between the recommended play and the next-best legal play. The model also supplies the dealer bust percentages quoted in explanations. When the remaining cards favor a different play than basic strategy (what a card counter would exploit), the review points it out, but decisions are still graded against basic strategy. With an endless deck, the model's best play matches the hard-total chart in every cell, and it differs on only two well-known borderline soft doubles. A test checks this.

The coach never claims a correct play wins the hand: basic strategy improves long-run expected results but cannot remove the house edge.

### Known limitations

- Surrender isn't offered, so it isn't part of the strategy.
- Single- and double-deck charts are total-dependent. Rare composition-dependent exceptions, and any card-counting deviations, aren't modeled.
- The odds use the shoe as it stood at the decision; cards drawn later in the same hand aren't removed again within the calculation, and split EV assumes no resplits. For close decisions the coach says so instead of claiming precision.
- Statistics live in this browser's storage, so they don't sync between devices.
