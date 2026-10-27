"use client";

import { useState } from "react";
import { Brain, Gauge, RotateCcw, Scale, Volume2 } from "lucide-react";
import { STARTING_BANKROLL, formatChips } from "@/lib/engine/bankroll";
import { DECK_OPTIONS, DEFAULT_RULES, type DeckCount, PAYOUT_OPTIONS, type BlackjackPayout, type DoubleRestriction, describeRules } from "@/lib/engine/rules";
import type { AnimationSpeed, CoachMode } from "@/lib/settings";
import { useApp } from "../AppProvider";
import { PageHeader, Panel, Segmented, Toggle } from "../ui";

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line/70 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div>
        <div className="font-semibold text-cream">{label}</div>
        {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const { settings, updateSettings, updateRules, game, resetBankroll, pendingRulesDiffer, sound } = useApp();
  const r = settings.rules;
  const midRound = game.phase === "player" || game.phase === "insurance";
  const [confirmBankroll, setConfirmBankroll] = useState(false);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Table rules drive the game, the strategy coach, training and the chart together, so they always agree." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Game rules" icon={<Scale className="h-4 w-4" />}>
            {midRound && pendingRulesDiffer && (
              <p className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">A round is in progress. Rule changes apply from the next round.</p>
            )}
            <Row label="Number of decks" description="A fresh shoe is shuffled when the deck count changes.">
              <Segmented<DeckCount> label="Number of decks" value={r.decks} options={DECK_OPTIONS.map((d) => ({ value: d, label: String(d) }))} onChange={(d) => updateRules({ decks: d })} />
            </Row>
            <Row label="Dealer on soft 17" description="H17 is more common today and slightly worse for the player.">
              <Segmented<string>
                label="Dealer on soft 17"
                value={r.dealerHitsSoft17 ? "H17" : "S17"}
                options={[
                  { value: "H17", label: "Hits" },
                  { value: "S17", label: "Stands" },
                ]}
                onChange={(v) => updateRules({ dealerHitsSoft17: v === "H17" })}
              />
            </Row>
            <Row label="Blackjack pays" description="6:5 adds roughly 1.4% to the house edge compared with 3:2.">
              <Segmented<BlackjackPayout> label="Blackjack payout" value={r.blackjackPayout} options={PAYOUT_OPTIONS.map((p) => ({ value: p, label: p }))} onChange={(p) => updateRules({ blackjackPayout: p })} />
            </Row>
            <Row label="Double down on" description="Restricted doubling turns some chart doubles into hits or stands.">
              <Segmented<DoubleRestriction>
                label="Double down on"
                value={r.doubleOn}
                options={[
                  { value: "any", label: "Any two" },
                  { value: "9-11", label: "9–11" },
                  { value: "10-11", label: "10–11" },
                ]}
                onChange={(v) => updateRules({ doubleOn: v })}
              />
            </Row>
            <Toggle checked={r.doubleAfterSplit} onChange={(v) => updateRules({ doubleAfterSplit: v })} label="Double after split (DAS)" description="Changes which small pairs are worth splitting." />
            <Row label="Maximum hands from splitting">
              <Segmented<number>
                label="Maximum split hands"
                value={r.maxSplitHands}
                options={[
                  { value: 2, label: "2" },
                  { value: 3, label: "3" },
                  { value: 4, label: "4" },
                ]}
                onChange={(v) => updateRules({ maxSplitHands: v as 2 | 3 | 4 })}
              />
            </Row>
            <Toggle checked={r.resplitAces} onChange={(v) => updateRules({ resplitAces: v })} label="Resplit aces" />
            <Toggle checked={r.hitSplitAces} onChange={(v) => updateRules({ hitSplitAces: v })} label="Hit split aces" description="Off by default: split aces normally receive one card each." />
            <Toggle checked={r.insuranceOffered} onChange={(v) => updateRules({ insuranceOffered: v })} label="Offer insurance" description="Offered when the dealer shows an ace. Basic strategy always declines it." />
            <Row label="Table limits">
              <div className="flex items-center gap-2 text-sm">
                <select
                  aria-label="Minimum bet"
                  value={r.minBet}
                  onChange={(e) => updateRules({ minBet: Number(e.target.value) })}
                  className="rounded-lg border border-line bg-ink px-2 py-1.5 text-cream"
                >
                  {[5, 10, 25, 100].map((v) => (
                    <option key={v} value={v}>
                      {formatChips(v)}
                    </option>
                  ))}
                </select>
                <span className="text-muted">to</span>
                <select
                  aria-label="Maximum bet"
                  value={r.maxBet}
                  onChange={(e) => updateRules({ maxBet: Number(e.target.value) })}
                  className="rounded-lg border border-line bg-ink px-2 py-1.5 text-cream"
                >
                  {[500, 1000, 2500, 5000].map((v) => (
                    <option key={v} value={v}>
                      {formatChips(v)}
                    </option>
                  ))}
                </select>
              </div>
            </Row>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => updateRules(DEFAULT_RULES)}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:text-cream"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Restore default rules
              </button>
            </div>
          </Panel>

          <Panel title="Coaching" icon={<Brain className="h-4 w-4" />}>
            <Row label="Strategy coach before decisions" description="Show the recommended play, its strength and the reasoning.">
              <Segmented<CoachMode>
                label="Coach mode"
                value={settings.coach}
                options={[
                  { value: "always", label: "Always" },
                  { value: "on-demand", label: "On request" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => updateSettings({ coach: v })}
              />
            </Row>
            <Toggle checked={settings.feedback} onChange={(v) => updateSettings({ feedback: v })} label="Feedback after each decision" description="Compare your play with basic strategy after you act." />
          </Panel>

          <Panel title="Sound & motion" icon={<Volume2 className="h-4 w-4" />}>
            <Toggle checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} label="Sound effects" />
            <Row label="Volume">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volume}
                disabled={!settings.sound}
                onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
                onPointerUp={() => sound("chip")}
                aria-label="Volume"
                className="w-48 accent-[var(--color-gold)] disabled:opacity-40"
              />
            </Row>
            <Row label="Animations" description="Your system's reduced-motion setting is always respected.">
              <Segmented<AnimationSpeed>
                label="Animation speed"
                value={settings.animation}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "fast", label: "Fast" },
                  { value: "off", label: "Off" },
                ]}
                onChange={(v) => updateSettings({ animation: v })}
              />
            </Row>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <Panel title="Active rules" icon={<Gauge className="h-4 w-4" />}>
            <ul className="space-y-2 text-sm" data-testid="active-rules">
              {describeRules(game.rules).map((line) => (
                <li key={line} className="flex gap-2 text-cream/90">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {line}
                </li>
              ))}
              <li className="flex gap-2 text-cream/90">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                Reshuffle at {Math.round(game.rules.penetration * 100)}% penetration
              </li>
            </ul>
            {pendingRulesDiffer && <p className="mt-3 text-xs text-warn">Your changes apply when the current round ends.</p>}
          </Panel>
          <Panel title="Virtual bankroll">
            <p className="text-sm text-muted">
              Current bankroll <strong className="text-cream">{formatChips(game.bankroll)}</strong>. Chips are play money only: there are no deposits, withdrawals or payments.
            </p>
            <button
              type="button"
              disabled={midRound}
              onClick={() => {
                if (confirmBankroll) {
                  resetBankroll();
                  setConfirmBankroll(false);
                } else setConfirmBankroll(true);
              }}
              onBlur={() => setConfirmBankroll(false)}
              className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-4 py-2 text-sm font-semibold text-cream disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              {confirmBankroll ? "Click again to confirm" : `Reset bankroll to ${formatChips(STARTING_BANKROLL)}`}
            </button>
          </Panel>
          <Panel title="About the coach">
            <p className="text-sm leading-relaxed text-muted">
              Recommendations come from published basic-strategy charts for single-deck, double-deck and 4–8 deck games, adjusted for H17/S17, double-after-split and doubling restrictions. Recommendation strength comes from an infinite-deck expected-value model. Not modeled: surrender (not offered at this table), card counting and composition-dependent plays.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
