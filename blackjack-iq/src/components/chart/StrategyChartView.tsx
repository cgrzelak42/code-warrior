"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { type UpcardValue, UPCARDS, upcardLabel } from "@/lib/engine/cards";
import type { Action } from "@/lib/engine/game";
import { DECK_OPTIONS, type DeckCount } from "@/lib/engine/rules";
import { CODE_LABEL, type StrategyCode, chartDescription, chartForRules } from "@/lib/strategy/chart";
import { ACTION_LABEL, type HandCategory, explainCell, rowLabel } from "@/lib/strategy/coach";
import { useApp } from "../AppProvider";
import { RecommendationView } from "../play/CoachPanel";
import { CODE_COLOR, PageHeader, Panel, Segmented } from "../ui";

interface Cell {
  table: HandCategory;
  row: number;
  up: UpcardValue;
}

const HARD_ROWS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const SOFT_ROWS = [13, 14, 15, 16, 17, 18, 19, 20];
const PAIR_ROWS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function hardLabel(r: number) {
  return r === 7 ? "5–7" : r === 17 ? "17+" : String(r);
}

/** Maps any hand position (e.g. from a coach link) onto a displayed chart cell. */
function normalise(table: string | null, row: number, up: number): Cell | null {
  if (!UPCARDS.includes(up as UpcardValue)) return null;
  const u = up as UpcardValue;
  if (table === "hard") return { table, row: Math.max(7, Math.min(17, row)), up: u };
  if (table === "soft") {
    if (row === 12) return { table: "pair", row: 11, up: u };
    return { table, row: Math.max(13, Math.min(20, row)), up: u };
  }
  if (table === "pair" && PAIR_ROWS.includes(row)) return { table, row, up: u };
  return null;
}

const LEGEND: StrategyCode[] = ["H", "S", "D", "Ds", "P"];

function CodeCell({ code, selected, onClick, label }: { code: StrategyCode; selected: boolean; onClick: () => void; label: string }) {
  const isDs = code === "Ds";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative grid h-9 w-full place-items-center rounded-[3px] text-[13px] font-extrabold text-white transition hover:z-10 hover:scale-110 hover:shadow-lg sm:h-10 ${
        selected ? "z-20 scale-110 outline-2 outline-offset-1 outline-cream" : ""
      }`}
      style={{
        background: isDs
          ? `linear-gradient(135deg, var(--color-act-double) 0 55%, var(--color-act-stand) 55% 100%)`
          : CODE_COLOR[code],
      }}
    >
      {code}
    </button>
  );
}

function ChartTable({
  title,
  rows,
  table,
  data,
  labelFor,
  selected,
  onSelect,
}: {
  title: string;
  rows: number[];
  table: HandCategory;
  data: Record<number, Record<UpcardValue, StrategyCode>>;
  labelFor: (r: number) => string;
  selected: Cell | null;
  onSelect: (c: Cell) => void;
}) {
  return (
    <Panel title={title} className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[440px] table-fixed border-separate border-spacing-[2px]" data-testid={`chart-${table}`}>
        <thead>
          <tr>
            <th className="w-14 pb-1 text-left text-[10px] font-bold uppercase tracking-wider text-dim">
              You \ Dealer
            </th>
            {UPCARDS.map((u) => (
              <th key={u} className={`pb-1 text-center text-sm font-bold ${selected?.table === table && selected.up === u ? "text-gold-bright" : "text-muted"}`}>
                {upcardLabel(u)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className={`pr-2 text-left text-sm font-bold whitespace-nowrap ${selected?.table === table && selected.row === r ? "text-gold-bright" : "text-cream"}`}>
                {labelFor(r)}
              </th>
              {UPCARDS.map((u) => {
                const code = data[r]![u];
                const isSel = selected?.table === table && selected.row === r && selected.up === u;
                return (
                  <td key={u} className="p-0">
                    <CodeCell
                      code={code}
                      selected={isSel}
                      onClick={() => onSelect({ table, row: r, up: u })}
                      label={`${title} ${labelFor(r)} vs ${upcardLabel(u)}: ${CODE_LABEL[code]}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function StrategyChartView() {
  const { settings, updateRules } = useApp();
  const rules = settings.rules;
  const params = useSearchParams();
  const initial = useMemo(
    () => normalise(params.get("t"), Number(params.get("r")), Number(params.get("u"))),
    [params],
  );
  const [selected, setSelected] = useState<Cell | null>(initial ?? { table: "hard", row: 16, up: 10 });
  const chart = useMemo(() => chartForRules(rules), [rules]);
  const detail = useMemo(() => {
    if (!selected) return null;
    const row = selected.table === "hard" && selected.row === 17 ? 17 : selected.row;
    return explainCell(rules, selected.table, row, selected.up);
  }, [selected, rules]);

  return (
    <div>
      <PageHeader title="Basic Strategy Chart" subtitle="The mathematically best play for every two-card starting hand, for the table rules below. Click any cell for the reasoning.">
        <span className="rounded-full border border-gold/30 bg-panel px-3 py-1.5 text-sm font-semibold text-gold-bright" data-testid="chart-rules">
          {chartDescription(rules)}
        </span>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-line bg-panel/70 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Decks</span>
          <Segmented<DeckCount> label="Decks" value={rules.decks} options={DECK_OPTIONS.map((d) => ({ value: d, label: String(d) }))} onChange={(d) => updateRules({ decks: d })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Soft 17</span>
          <Segmented<string>
            label="Dealer soft 17"
            value={rules.dealerHitsSoft17 ? "H17" : "S17"}
            options={[
              { value: "H17", label: "Hits (H17)" },
              { value: "S17", label: "Stands (S17)" },
            ]}
            onChange={(v) => updateRules({ dealerHitsSoft17: v === "H17" })}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Double after split</span>
          <Segmented<string>
            label="Double after split"
            value={rules.doubleAfterSplit ? "yes" : "no"}
            options={[
              { value: "yes", label: "Allowed" },
              { value: "no", label: "No" },
            ]}
            onChange={(v) => updateRules({ doubleAfterSplit: v === "yes" })}
          />
        </div>
        <p className="w-full text-xs text-dim">
          These are the same rules the table and coach use; changing them here changes them everywhere (from the next round).
          {rules.doubleOn !== "any" && ` Doubling is limited to hard ${rules.doubleOn}, so other double cells show the fallback play.`}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
        {LEGEND.map((c) => (
          <span key={c} className="flex items-center gap-2 text-sm text-muted">
            <span
              className="grid h-6 w-8 place-items-center rounded text-xs font-extrabold text-white"
              style={{
                background: c === "Ds" ? `linear-gradient(135deg, var(--color-act-double) 0 55%, var(--color-act-stand) 55% 100%)` : CODE_COLOR[c],
              }}
            >
              {c}
            </span>
            {CODE_LABEL[c]}
          </span>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-5 2xl:grid-cols-2">
          <ChartTable title="Hard totals" rows={HARD_ROWS} table="hard" data={chart.hard} labelFor={hardLabel} selected={selected} onSelect={setSelected} />
          <div className="grid min-w-0 gap-5">
            <ChartTable title="Soft totals" rows={SOFT_ROWS} table="soft" data={chart.soft} labelFor={(r) => rowLabel("soft", r)} selected={selected} onSelect={setSelected} />
            <ChartTable title="Pairs" rows={PAIR_ROWS} table="pair" data={chart.pairs} labelFor={(r) => rowLabel("pair", r)} selected={selected} onSelect={setSelected} />
          </div>
        </div>
        <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
          <Panel title={detail ? detail.position : "Cell detail"} icon={<MousePointerClick className="h-4 w-4" />}>
            {detail ? (
              <div className="space-y-4" data-testid="chart-detail">
                <RecommendationView rec={detail} />
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Estimated value of each play</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {(Object.entries(detail.ev) as [Action, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([a, v]) => (
                          <tr key={a} className="border-t border-line">
                            <td className={`py-1.5 ${a === detail.action ? "font-bold text-cream" : "text-muted"}`}>{ACTION_LABEL[a]}</td>
                            <td className={`py-1.5 text-right tabular-nums ${v >= 0 ? "text-good" : "text-bad"}`}>
                              {v >= 0 ? "+" : "−"}
                              {Math.abs(v * 100).toFixed(1)}% of bet
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-dim">
                    Average result per hand, calculated from a fresh {rules.decks}-deck shoe with your cards and the dealer's upcard removed, after the dealer has checked for blackjack. Even the best play can have a negative value: it is the play that loses least. At the table, the coach's review uses the cards actually left in the shoe.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Select a cell to see why.</p>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
