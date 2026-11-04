"use client";

// The seated view: the landscape fills the background and the table lies in perspective in
// front of the player, its near rail running off the bottom edge as if you're sitting at it.

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LayoutGrid, Shuffle } from "lucide-react";
import { formatChips } from "@/lib/engine/bankroll";
import type { GameState } from "@/lib/engine/game";
import type { TableDef } from "@/lib/tables";
import { SCENE_FOCUS, SCENE_HEIGHT, Scenery } from "./Scenery";

const TRAY_COLORS = ["#b3262e", "#1f7a4a", "#1b1d22", "#5b3aa0", "#c8a04a", "#1f7a4a", "#b3262e"];

function ChipTray() {
  return (
    <div className="mx-auto flex w-fit items-end gap-1 rounded-b-xl border border-t-0 border-black/50 bg-black/45 px-3 pb-1.5 pt-1 shadow-[inset_0_6px_12px_rgba(0,0,0,0.6)]" aria-hidden>
      {TRAY_COLORS.map((c, i) => (
        <div key={i} className="flex flex-col-reverse">
          {Array.from({ length: 5 + ((i * 3) % 4) }, (_, j) => (
            <span
              key={j}
              className="-mt-[5px] block h-[7px] w-5 rounded-[50%] border border-black/40 sm:w-7"
              style={{ background: `linear-gradient(90deg, ${c}, ${c} 30%, #f3e6d0 30%, #f3e6d0 40%, ${c} 40%, ${c} 70%, #f3e6d0 70%, #f3e6d0 80%, ${c} 80%)` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardShoe() {
  return (
    <div className="absolute right-[6%] top-3 hidden h-14 w-16 sm:block" aria-hidden>
      <div className="absolute inset-0 rounded-md border border-black/50 bg-gradient-to-b from-[#3a2516] to-[#1d120a] shadow-[0_8px_14px_rgba(0,0,0,0.5)]" />
      <div className="card-back-pattern absolute bottom-2 left-2 right-3 top-3 rounded-sm border border-gold/40" />
      <div className="absolute -bottom-1 left-1 right-2 h-2 rounded-sm bg-black/50" />
    </div>
  );
}

/** "BLACKJACK PAYS 3 TO 2" printed in an arc on the felt. */
function FeltPrint({ payout, h17, insurance }: { payout: string; h17: boolean; insurance: boolean }) {
  const words = payout === "3:2" ? "3 TO 2" : payout === "6:5" ? "6 TO 5" : "1 TO 1";
  return (
    <div className="pointer-events-none select-none text-center" aria-label={`Blackjack pays ${payout}. Dealer ${h17 ? "hits" : "stands on"} soft 17.`}>
      <svg viewBox="0 0 600 70" className="mx-auto block h-auto w-[min(92%,560px)]" aria-hidden>
        <defs>
          <path id="felt-arc" d="M40,14 Q300,92 560,14" />
        </defs>
        <text className="font-display" fill="var(--felt-print)" fontSize="30" fontWeight="700" letterSpacing="6" textAnchor="middle">
          <textPath href="#felt-arc" startOffset="50%">
            BLACKJACK PAYS {words}
          </textPath>
        </text>
      </svg>
      <div className="-mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--felt-print)] opacity-80 sm:text-xs">
        Dealer {h17 ? "hits" : "stands on"} soft 17{insurance ? " · Insurance pays 2 to 1" : ""}
      </div>
    </div>
  );
}

export function TableScene({
  table,
  game,
  onOpenLobby,
  lobbyDisabled,
  dealer,
  player,
  overlay,
}: {
  table: TableDef;
  game: GameState;
  onOpenLobby: () => void;
  lobbyDisabled: boolean;
  dealer: ReactNode;
  player: ReactNode;
  overlay?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);

  // Gentle parallax: the landscape shifts a little as the pointer moves, like turning your head.
  useEffect(() => {
    const el = frame.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", x.toFixed(3));
        el.style.setProperty("--py", y.toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const shoeLeft = game.shoe.length / game.shoeSize;
  const feltVars = {
    "--felt": table.felt.base,
    "--felt-light": table.felt.light,
    "--felt-dark": table.felt.dark,
    "--ambient": table.ambient,
    "--felt-print": "rgba(236, 208, 138, 0.82)",
  } as CSSProperties;

  return (
    <div ref={frame} className="scene-frame relative isolate overflow-hidden rounded-[28px] border border-line bg-ink shadow-[0_30px_80px_rgba(0,0,0,0.55)]" data-testid="table" data-table={table.id}>
      <div className="scene-backdrop" style={{ "--scene-focus": ((SCENE_FOCUS[table.id] / SCENE_HEIGHT) * 100).toFixed(2) } as CSSProperties}>
        <Scenery scene={table.id} className="h-full w-full" />
      </div>
      {/* Atmosphere: darken the edges and the area behind the table so cards stay readable. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,transparent_45%,rgba(0,0,0,0.4))]" />

      {/* Table plaque and controls */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
          <div className="font-display text-sm font-bold leading-tight text-cream sm:text-base" data-testid="table-name">
            {table.name}
          </div>
          <div className="text-[11px] font-semibold tabular-nums text-cream/70">
            {formatChips(table.minBet)}–{formatChips(table.maxBet)} · {game.rules.decks} decks · Round {game.roundNumber}
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10" title={`${Math.round(shoeLeft * 100)}% of the shoe remaining`}>
            <div className="h-full bg-gold/80" style={{ width: `${shoeLeft * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenLobby}
          disabled={lobbyDisabled}
          title={lobbyDisabled ? "Finish the round to change tables" : "Choose a table"}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-sm font-semibold text-cream backdrop-blur-md transition hover:border-gold/60 hover:text-gold-bright disabled:opacity-40"
          data-testid="open-lobby"
        >
          <LayoutGrid className="h-4 w-4" /> Tables
        </button>
      </div>

      {/* The table, in perspective */}
      <div className="table-stage relative z-10" style={feltVars}>
        <div className="table-surface felt">
          <ChipTray />
          <CardShoe />
          <div className="table-content">
            {dealer}
            <div className="my-2 sm:my-3">
              <FeltPrint payout={game.rules.blackjackPayout} h17={game.rules.dealerHitsSoft17} insurance={game.rules.insuranceOffered} />
              {game.shuffledThisRound && game.roundNumber > 0 && (
                <div className="mt-2 text-center">
                  <span className="animate-rise inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-cream/85">
                    <Shuffle className="h-3.5 w-3.5" /> Fresh shoe shuffled
                  </span>
                </div>
              )}
            </div>
            {player}
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
