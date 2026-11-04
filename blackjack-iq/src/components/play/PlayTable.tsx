"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, Hand, RotateCcw, Sparkles, Split, Square, TrendingUp, Undo2 } from "lucide-react";
import { CHIP_VALUES, type ChipValue, canAfford, formatChips, money } from "@/lib/engine/bankroll";
import { type Action, illegalReason, insuranceCost, legalActions } from "@/lib/engine/game";
import { bestAffordableTable } from "@/lib/tables";
import { Chip } from "../Chip";
import { useApp } from "../AppProvider";
import { CoachPanel } from "./CoachPanel";
import { DealerArea, PlayerArea } from "./Table";
import { TableLobby } from "./TableLobby";
import { TableScene } from "./TableScene";

const ACTION_META: Record<Action, { label: string; key: string; icon: typeof Hand; color: string }> = {
  hit: { label: "Hit", key: "H", icon: Hand, color: "var(--color-act-hit)" },
  stand: { label: "Stand", key: "S", icon: Square, color: "var(--color-act-stand)" },
  double: { label: "Double", key: "D", icon: TrendingUp, color: "var(--color-act-double)" },
  split: { label: "Split", key: "P", icon: Split, color: "var(--color-act-split)" },
};

const REVEAL_DELAY = { normal: 650, fast: 300, off: 0 } as const;

export function PlayTable() {
  const app = useApp();
  const { game, settings, hydrated, lastBet, sound, table, progress, bankrollStatus } = app;
  const [pendingBet, setPendingBet] = useState(0);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const betInitialised = useRef(false);

  useEffect(() => {
    if (hydrated && !betInitialised.current) {
      betInitialised.current = true;
      setPendingBet(Math.min(lastBet, game.bankroll >= game.rules.minBet ? game.bankroll : 0));
    }
  }, [hydrated, lastBet, game.bankroll, game.rules.minBet]);

  // Keep the bet inside the limits of the table you're sitting at.
  useEffect(() => {
    if (!betInitialised.current) return;
    setPendingBet((b) => {
      if (b === 0) return 0;
      const clamped = Math.min(Math.max(b, table.minBet), table.maxBet);
      return game.bankroll >= clamped ? clamped : 0;
    });
  }, [table.minBet, table.maxBet, game.bankroll]);

  // Dealer reveal: number of dealer cards face up (1 = hole card still down). On first render
  // (page load or navigating back) a finished round is shown as-is with no replay or sound.
  const delay = REVEAL_DELAY[settings.animation];
  const [reveal, setReveal] = useState<{ round: number; count: number } | null>(null);
  const announced = useRef(-1);
  useEffect(() => {
    if (!hydrated) return;
    if (reveal === null) {
      announced.current = game.roundNumber;
      setReveal({ round: game.roundNumber, count: game.holeRevealed ? game.dealer.length : 1 });
      return;
    }
    if (reveal.round !== game.roundNumber) {
      setReveal({ round: game.roundNumber, count: 1 });
      return;
    }
    if (game.holeRevealed && reveal.count < game.dealer.length) {
      if (delay === 0) {
        setReveal({ ...reveal, count: game.dealer.length });
        return;
      }
      const t = setTimeout(
        () => {
          sound(reveal.count === 1 ? "flip" : "card");
          setReveal({ ...reveal, count: reveal.count + 1 });
        },
        reveal.count === 1 ? delay * 0.8 : delay,
      );
      return () => clearTimeout(t);
    }
  }, [hydrated, game.roundNumber, game.holeRevealed, game.dealer.length, reveal, delay, sound]);

  const current = reveal !== null && reveal.round === game.roundNumber;
  const revealing = game.phase === "settled" && (!current || reveal.count < game.dealer.length);
  const revealCount = !game.holeRevealed ? 1 : current ? Math.min(reveal.count, game.dealer.length) : 1;
  const result = game.result;

  // Hold the bankroll display at its pre-settlement value until the reveal finishes.
  const { setBankrollHold } = app;
  useEffect(() => {
    if (revealing && result) {
      const staked = result.hands.reduce((a, h) => a + h.bet, 0) + result.insuranceBet;
      setBankrollHold(money(result.bankrollAfter - (result.net + staked)));
    } else setBankrollHold(null);
  }, [revealing, result, setBankrollHold]);
  useEffect(() => () => setBankrollHold(null), [setBankrollHold]);

  // Outcome sound once the reveal completes.
  useEffect(() => {
    if (!result || revealing || announced.current === result.roundNumber) return;
    announced.current = result.roundNumber;
    sound(result.playerBlackjack ? "blackjack" : result.net > 0 ? "win" : result.net < 0 ? "lose" : "push");
  }, [result, revealing, sound]);

  const legal = useMemo(() => legalActions(game), [game]);
  const canBet = game.phase === "betting" || game.phase === "settled";
  const broke = canBet && bankrollStatus === "out-of-chips";
  const belowMin = canBet && bankrollStatus === "below-table-min";
  const fallbackTable = bestAffordableTable(game.bankroll, progress.peakBankroll);

  const addChip = (v: ChipValue) => {
    setError(null);
    const next = pendingBet + v;
    if (!canAfford(game.bankroll, next)) return setError("Not enough chips for that bet.");
    if (next > game.rules.maxBet) return setError(`Table maximum is ${formatChips(game.rules.maxBet)}.`);
    sound("chip");
    setPendingBet(next);
  };

  const dealNow = (amount = pendingBet) => {
    const err = app.placeBet(amount);
    setError(err);
    if (!err) {
      sound("card");
      setPendingBet(amount);
    }
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (game.phase === "player") {
        const map: Record<string, Action> = { h: "hit", s: "stand", d: "double", p: "split" };
        const a = map[k];
        if (a && legal.includes(a)) {
          e.preventDefault();
          app.playAction(a);
        }
      } else if (game.phase === "insurance") {
        if (k === "y") app.decideInsurance(true);
        if (k === "n") app.decideInsurance(false);
      } else if (canBet && !revealing && (k === "enter" || k === " ") && pendingBet > 0) {
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        dealNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const shoeLeft = game.shoe.length / game.shoeSize;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        {/* Table */}
        <TableScene
          table={table}
          game={game}
          onOpenLobby={() => setLobbyOpen(true)}
          lobbyDisabled={!canBet || revealing}
          dealer={<DealerArea game={game} revealCount={revealCount} />}
          player={<PlayerArea game={game} showOutcome={game.phase === "settled" && !revealing} pendingBet={canBet && game.hands.length === 0 ? pendingBet : 0} />}
        />
        <TableLobby open={lobbyOpen} onClose={() => setLobbyOpen(false)} />

        {app.unlockNotice.length > 0 && !revealing && (
          <div className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/50 bg-gold/10 px-5 py-3.5" role="status" data-testid="unlock-notice">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 shrink-0 text-gold-bright" />
              <div>
                <div className="font-display text-lg font-bold text-cream">New table unlocked: {app.unlockNotice[app.unlockNotice.length - 1]!.name}</div>
                <div className="text-sm text-muted">Your bankroll reached {formatChips(progress.peakBankroll)}. It stays unlocked even if your chips drop later.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={app.dismissUnlock} className="rounded-xl border border-line bg-panel-2 px-4 py-2 text-sm font-semibold text-muted hover:text-cream">
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  app.dismissUnlock();
                  setLobbyOpen(true);
                }}
                className="btn-gold rounded-xl px-4 py-2 text-sm font-bold"
              >
                See tables
              </button>
            </div>
          </div>
        )}

        {/* Round result */}
        {game.phase === "settled" && result && !revealing && (
          <div
            className={`animate-rise flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 ${
              result.net > 0 ? "border-good/40 bg-good/10" : result.net < 0 ? "border-bad/40 bg-bad/10" : "border-line bg-panel"
            }`}
            data-testid="round-result"
            role="status"
          >
            <div>
              <div className="font-display text-xl font-bold">
                {result.playerBlackjack && result.net > 0
                  ? "Blackjack!"
                  : result.dealerBlackjack
                    ? "Dealer has blackjack"
                    : result.net > 0
                      ? "You win"
                      : result.net < 0
                        ? result.hands.every((h) => h.outcome === "bust")
                          ? "Bust"
                          : "Dealer wins"
                        : "Push"}
              </div>
              <div className="text-sm text-muted">
                Dealer {result.dealerBlackjack ? "blackjack" : result.dealerBusted ? `busts with ${result.dealerTotal}` : `has ${result.dealerTotal}`}
                {result.insuranceBet > 0 && ` · Insurance ${formatChips(result.insuranceNet, { sign: true })}`}
              </div>
            </div>
            <div className={`text-2xl font-extrabold tabular-nums ${result.net > 0 ? "text-good" : result.net < 0 ? "text-bad" : "text-cream"}`}>
              {formatChips(result.net, { sign: true })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="rounded-2xl border border-line bg-gradient-to-b from-panel to-charcoal p-4 sm:p-5" data-testid="controls">
          {game.phase === "insurance" ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-bold text-cream">{game.hands[0]?.status === "blackjack" ? "Even money?" : "Insurance?"}</div>
                <div className="text-sm text-muted">
                  Dealer shows an ace. Insurance costs {formatChips(insuranceCost(game))} and pays 2:1 if the dealer has blackjack.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => app.decideInsurance(true)}
                  disabled={!canAfford(game.bankroll, insuranceCost(game))}
                  className="rounded-xl border border-line bg-panel-2 px-5 py-3 font-bold text-cream transition hover:border-gold/50 disabled:opacity-40"
                >
                  Take insurance <kbd className="ml-1 text-xs text-dim">Y</kbd>
                </button>
                <button type="button" onClick={() => app.decideInsurance(false)} className="btn-gold rounded-xl px-5 py-3 font-bold">
                  No thanks <kbd className="ml-1 text-xs opacity-60">N</kbd>
                </button>
              </div>
            </div>
          ) : game.phase === "player" ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="Player actions">
              {(Object.keys(ACTION_META) as Action[]).map((a) => {
                const m = ACTION_META[a];
                const enabled = legal.includes(a);
                const Icon = m.icon;
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={!enabled}
                    title={enabled ? `${m.label} (${m.key})` : (illegalReason(game, a) ?? undefined)}
                    onClick={() => app.playAction(a)}
                    className={`group relative flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-base font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 ${
                      "border-line"
                    }`}
                    style={{ background: enabled ? `color-mix(in oklab, ${m.color} 26%, #17191d)` : "#17191d" }}
                    data-testid={`action-${a}`}
                  >
                    <Icon className="h-4 w-4" style={{ color: m.color }} />
                    <span className="text-cream">{m.label}</span>
                    <kbd className="hidden text-xs font-semibold text-dim sm:inline">{m.key}</kbd>
                  </button>
                );
              })}
            </div>
          ) : broke && !revealing ? (
            <div className="flex flex-wrap items-center justify-between gap-3" data-testid="out-of-chips">
              <div>
                <div className="font-bold text-cream">Out of chips</div>
                <div className="text-sm text-muted">
                  You have {formatChips(game.bankroll)}, less than the smallest bet at any table. These are virtual chips, so you can start again with $1,000. Your unlocked tables and statistics stay.
                </div>
              </div>
              <button type="button" onClick={app.resetBankroll} className="btn-gold flex items-center gap-2 rounded-xl px-5 py-3 font-bold" data-testid="reset-bankroll">
                <RotateCcw className="h-4 w-4" /> Reset to $1,000
              </button>
            </div>
          ) : belowMin && !revealing ? (
            <div className="flex flex-wrap items-center justify-between gap-3" data-testid="below-min">
              <div>
                <div className="font-bold text-cream">Below this table&apos;s minimum</div>
                <div className="text-sm text-muted">
                  {table.name} needs at least {formatChips(table.minBet)} a hand and you have {formatChips(game.bankroll)}. Move to a lower-stakes table to keep playing.
                </div>
              </div>
              <button type="button" onClick={() => app.sitAt(fallbackTable.id)} className="btn-gold flex items-center gap-2 rounded-xl px-5 py-3 font-bold">
                <ArrowDownRight className="h-4 w-4" /> Move to {fallbackTable.name}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Chips">
                {CHIP_VALUES.map((v) => {
                  const ok = canAfford(game.bankroll, pendingBet + v) && pendingBet + v <= game.rules.maxBet;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => addChip(v)}
                      disabled={!ok || revealing}
                      aria-label={`Add ${formatChips(v)} chip`}
                      className="rounded-full transition hover:-translate-y-1 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0"
                      data-testid={`chip-${v}`}
                    >
                      <Chip value={v} size={58} className="drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]" />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="text-muted">Bet </span>
                  <span className="text-lg font-extrabold tabular-nums text-cream">{formatChips(pendingBet)}</span>
                  <span className="ml-2 text-xs text-dim">
                    Table limits {formatChips(game.rules.minBet)}–{formatChips(game.rules.maxBet)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingBet(0)}
                    disabled={pendingBet === 0 || revealing}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-cream disabled:opacity-40"
                  >
                    <Undo2 className="h-4 w-4" /> Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = pendingBet * 2;
                      if (canAfford(game.bankroll, d) && d <= game.rules.maxBet) setPendingBet(d);
                    }}
                    disabled={pendingBet === 0 || !canAfford(game.bankroll, pendingBet * 2) || pendingBet * 2 > game.rules.maxBet || revealing}
                    className="rounded-xl border border-line bg-panel-2 px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-cream disabled:opacity-40"
                  >
                    2× Bet
                  </button>
                  <button
                    type="button"
                    onClick={() => dealNow()}
                    disabled={pendingBet <= 0 || revealing || !hydrated}
                    className="btn-gold rounded-xl px-6 py-2.5 font-extrabold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40"
                    data-testid="deal"
                  >
                    {game.phase === "settled" ? "New Round" : "Deal"}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-sm font-semibold text-bad" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
          {app.pendingRulesDiffer && game.phase !== "betting" && game.phase !== "settled" && (
            <p className="mt-3 text-xs text-warn">Rule changes take effect from the next round.</p>
          )}
        </div>
        <p className="text-center text-xs text-dim">
          Virtual chips only. No real money. ·{" "}
          <Link href="/settings" className="underline-offset-2 hover:text-muted hover:underline">
            Table rules
          </Link>
        </p>
      </div>

      <aside className="min-w-0">
        <CoachPanel game={game} revealing={revealing} />
      </aside>
    </div>
  );
}
