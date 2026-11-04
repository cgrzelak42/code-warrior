"use client";

import { useEffect, useRef } from "react";
import { Check, Lock, X } from "lucide-react";
import { formatChips } from "@/lib/engine/bankroll";
import { TABLES, type TableDef, isUnlocked } from "@/lib/tables";
import { useApp } from "../AppProvider";
import { Scenery } from "./Scenery";

function TableCard({ t, onSit }: { t: TableDef; onSit: () => void }) {
  const { progress, game } = useApp();
  const unlocked = isUnlocked(t, progress.peakBankroll);
  const seated = progress.tableId === t.id;
  const affordable = game.bankroll >= t.minBet;
  const pct = Math.min(100, Math.round((progress.peakBankroll / t.unlockAt) * 100));
  return (
    <li className={`overflow-hidden rounded-2xl border ${seated ? "border-gold/70" : "border-line"} bg-panel`} data-testid={`lobby-${t.id}`}>
      <div className="relative aspect-[16/8] overflow-hidden">
        <Scenery scene={t.id} className={`h-full w-full ${unlocked ? "" : "brightness-[0.45] grayscale-[0.6]"}`} />
        <div
          className="absolute inset-x-[12%] bottom-[-30%] h-[60%] rounded-[50%] border-[6px] border-[#2b1a10] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
          style={{ background: `radial-gradient(ellipse at 50% 30%, ${t.felt.light}, ${t.felt.base} 50%, ${t.felt.dark})` }}
          aria-hidden
        />
        {!unlocked && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-black/55 backdrop-blur">
              <Lock className="h-5 w-5 text-cream" />
            </span>
          </div>
        )}
        {seated && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-extrabold uppercase text-ink">
            <Check className="h-3.5 w-3.5" /> Seated
          </span>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-cream">{t.name}</h3>
          <span className="text-sm font-semibold tabular-nums text-gold-bright">
            {formatChips(t.minBet)}–{formatChips(t.maxBet)}
          </span>
        </div>
        <p className="text-sm text-muted">{t.tagline}</p>
        {unlocked ? (
          <button
            type="button"
            onClick={onSit}
            disabled={seated || !affordable}
            className="btn-gold w-full rounded-xl py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {seated ? "You're seated here" : affordable ? "Take a seat" : `Needs ${formatChips(t.minBet)} to sit`}
          </button>
        ) : (
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Unlocks when your bankroll reaches {formatChips(t.unlockAt)}</span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to unlock ${t.name}`}>
              <div className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-bright" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function TableLobby({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { sitAt, progress, sound } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-rise max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line bg-charcoal p-5 shadow-2xl outline-none sm:p-7"
        data-testid="lobby"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="lobby-title" className="font-display text-2xl font-bold text-cream sm:text-3xl">
              Choose your table
            </h2>
            <p className="mt-1 text-sm text-muted">
              New tables unlock as your bankroll grows, and stay unlocked for good. Your best so far:{" "}
              <strong className="tabular-nums text-gold-bright">{formatChips(progress.peakBankroll)}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-cream">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {TABLES.map((t) => (
            <TableCard
              key={t.id}
              t={t}
              onSit={() => {
                sitAt(t.id);
                sound("chip");
                onClose();
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
