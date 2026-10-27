"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Brain, Coins, Flame, Info, RotateCcw } from "lucide-react";
import { formatChips } from "@/lib/engine/bankroll";
import { ACTION_LABEL } from "@/lib/strategy/coach";
import { type DecisionChoice, accuracy, accuracyTrend, topMistakes } from "@/lib/stats/stats";
import { useApp } from "../AppProvider";
import { PageHeader, Panel, StatCard } from "../ui";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const choiceLabel = (c: DecisionChoice) =>
  c === "insurance" ? "Take insurance" : c === "no-insurance" ? "Decline insurance" : c === "timeout" ? "Ran out of time" : ACTION_LABEL[c];

const AXIS = { stroke: "#3a3f47", tick: { fill: "#a3a7ae", fontSize: 12 }, tickLine: false } as const;

function ChartTooltip({ active, payload, label, fmt, labelPrefix }: { active?: boolean; payload?: { value: number }[]; label?: string | number; fmt: (v: number) => string; labelPrefix: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-ink/95 px-3 py-2 text-sm shadow-xl">
      <div className="text-xs text-muted">
        {labelPrefix}
        {label}
      </div>
      <div className="font-bold text-cream">{fmt(payload[0]!.value)}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full min-h-[160px] place-items-center rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function StatsDashboard() {
  const { stats, resetStats, hydrated } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const s = stats;

  const bankrollSeries = useMemo(() => s.roundHistory.map((p) => ({ round: p.round, bankroll: p.bankroll })), [s.roundHistory]);
  const trend = useMemo(() => accuracyTrend(s, s.decisionHistory.length > 200 ? 50 : s.decisionHistory.length > 60 ? 20 : 10), [s]);
  const byType = useMemo(
    () =>
      (
        [
          ["Hard totals", s.decisions.byCategory.hard],
          ["Soft totals", s.decisions.byCategory.soft],
          ["Pairs", s.decisions.byCategory.pair],
          ["Insurance", s.decisions.byCategory.insurance],
        ] as const
      ).map(([name, t]) => ({ name, accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0, total: t.total, correct: t.correct })),
    [s],
  );
  const mistakes = topMistakes(s, 6);
  const settledHands = s.wins + s.losses + s.pushes;
  const outcomes = [
    { label: "Wins", value: s.wins, color: "var(--color-good)" },
    { label: "Pushes", value: s.pushes, color: "var(--color-muted)" },
    { label: "Losses", value: s.losses, color: "var(--color-bad)" },
  ];

  if (!hydrated) return <PageHeader title="Statistics" subtitle="Loading your saved statistics…" />;

  return (
    <div>
      <PageHeader title="Statistics" subtitle="Your results at the table and how closely you follow basic strategy. Saved in this browser.">
        <button
          type="button"
          onClick={() => {
            if (confirmReset) {
              resetStats();
              setConfirmReset(false);
            } else setConfirmReset(true);
          }}
          onBlur={() => setConfirmReset(false)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${confirmReset ? "border-bad bg-bad/15 text-bad" : "border-line bg-panel text-muted hover:text-cream"}`}
        >
          <RotateCcw className="h-4 w-4" /> {confirmReset ? "Click again to erase all stats" : "Reset statistics"}
        </button>
      </PageHeader>

      <div className="mb-6 flex gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-cream/90">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <p>
          <strong className="text-gold-bright">Results and decisions are tracked separately.</strong> Chips won or lost depend on the cards; decision accuracy measures whether you made the
          basic-strategy play. A correct decision can still lose the hand. Over many hands, better decisions lower the house edge, but they can't remove it.
          {s.correctButLost > 0 && (
            <>
              {" "}
              So far, <strong className="text-cream">{s.correctButLost}</strong> round{s.correctButLost === 1 ? "" : "s"} where every decision was correct still lost chips.
            </>
          )}
        </p>
      </div>

      {/* Game results */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-gold">
        <Coins className="h-4 w-4" /> Game results
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="results-cards">
        <StatCard label="Rounds played" value={s.rounds} sub={`${s.hands} hands incl. splits`} />
        <StatCard label="Win / Loss / Push" value={`${s.wins}/${s.losses}/${s.pushes}`} sub={settledHands ? `${pct(s.wins / settledHands)} of hands won` : "No hands yet"} />
        <StatCard label="Blackjacks" value={s.blackjacks} sub={s.rounds ? `${((s.blackjacks / s.rounds) * 100).toFixed(1)}% of rounds (≈4.7% expected)` : "—"} tone="gold" />
        <StatCard label="Net chips" value={formatChips(s.net, { sign: true })} tone={s.net > 0 ? "good" : s.net < 0 ? "bad" : "default"} sub={`${formatChips(s.totalWagered)} wagered`} />
        <StatCard label="Doubles / Splits" value={`${s.doubles} / ${s.splits}`} sub={`${s.busts} busts`} />
        <StatCard label="Best round" value={formatChips(s.biggestWin, { sign: true })} sub={`Worst ${formatChips(s.biggestLoss, { sign: true })}`} />
      </div>

      <div className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Bankroll over time">
          {bankrollSeries.length < 2 ? (
            <Empty>Play a couple of rounds to see your bankroll chart.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bankrollSeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4af5a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#d4af5a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#262a30" vertical={false} />
                  <XAxis dataKey="round" {...AXIS} />
                  <YAxis {...AXIS} width={64} tickFormatter={(v: number) => formatChips(v)} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip fmt={(v) => formatChips(v)} labelPrefix="Round " />} cursor={{ stroke: "#6f747c", strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="bankroll" stroke="#d4af5a" strokeWidth={2} fill="url(#bankrollFill)" dot={false} activeDot={{ r: 5, stroke: "#17191d", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Hand outcomes">
          {settledHands === 0 ? (
            <Empty>No hands played yet.</Empty>
          ) : (
            <div className="space-y-4" data-testid="outcomes">
              <div className="flex h-4 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                {outcomes.map((o) => o.value > 0 && <div key={o.label} style={{ flexGrow: o.value, background: o.color }} title={`${o.label}: ${o.value}`} />)}
              </div>
              <ul className="space-y-2 text-sm">
                {outcomes.map((o) => (
                  <li key={o.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                      {o.label}
                    </span>
                    <span className="tabular-nums text-cream">
                      {o.value} <span className="text-dim">({pct(o.value / settledHands)})</span>
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between border-t border-line pt-2">
                  <span className="text-muted">Dealer blackjacks</span>
                  <span className="tabular-nums text-cream">{s.dealerBlackjacks}</span>
                </li>
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {/* Strategy performance */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-gold">
        <Brain className="h-4 w-4" /> Strategy performance
      </h2>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="strategy-cards">
        <StatCard
          label="Decision accuracy"
          value={pct(accuracy(s.decisions))}
          sub={`${s.decisions.correct} of ${s.decisions.total} decisions`}
          tone={(accuracy(s.decisions) ?? 0) >= 0.9 ? "good" : "default"}
        />
        <StatCard label="Current streak" value={<span className="flex items-center gap-1.5"><Flame className="h-5 w-5 text-warn" />{s.streak.current}</span>} sub="Correct decisions in a row" />
        <StatCard label="Best streak" value={s.streak.best} tone="gold" sub="All time" />
        <StatCard
          label="At the table / training"
          value={`${pct(accuracy(s.decisions.bySource.play))} / ${pct(accuracy(s.decisions.bySource.train))}`}
          sub={`${s.decisions.bySource.play.total} table · ${s.decisions.bySource.train.total} training decisions`}
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Accuracy over time">
          {trend.length < 2 ? (
            <Empty>Make at least 20 decisions (at the table or in training) to see your trend.</Empty>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#262a30" vertical={false} />
                  <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
                  <YAxis {...AXIS} domain={[0, 100]} width={44} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip content={<ChartTooltip fmt={(v) => `${v}% correct`} labelPrefix="Decisions " />} cursor={{ stroke: "#6f747c", strokeDasharray: "3 3" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="#4cc38a" strokeWidth={2} dot={{ r: 4, fill: "#4cc38a", stroke: "#17191d", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Accuracy by hand type">
          {s.decisions.total === 0 ? (
            <Empty>No decisions recorded yet.</Empty>
          ) : (
            <div className="h-64" data-testid="by-type">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 8 }} barCategoryGap={10}>
                  <CartesianGrid stroke="#262a30" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} {...AXIS} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis type="category" dataKey="name" {...AXIS} width={92} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="rounded-lg border border-line bg-ink/95 px-3 py-2 text-sm shadow-xl">
                          <div className="text-xs text-muted">{(payload[0]!.payload as { name: string }).name}</div>
                          <div className="font-bold text-cream">
                            {(payload[0]!.payload as { correct: number }).correct} / {(payload[0]!.payload as { total: number }).total} correct
                          </div>
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} maxBarSize={26}>
                    {byType.map((d) => (
                      <Cell key={d.name} fill={d.total ? "#d4af5a" : "#2b2f36"} />
                    ))}
                    <LabelList
                      dataKey="accuracy"
                      position="right"
                      fill="#f4eedf"
                      fontSize={12}
                      formatter={(v: unknown) => `${v as number}%`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Most common strategic mistakes" icon={<AlertTriangle className="h-4 w-4" />}>
        {mistakes.length === 0 ? (
          <Empty>No mistakes recorded. Keep playing or training to build up your profile.</Empty>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[520px] text-sm" data-testid="mistakes">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-dim">
                  <th className="pb-2 font-semibold">Situation</th>
                  <th className="pb-2 font-semibold">You chose</th>
                  <th className="pb-2 font-semibold">Basic strategy</th>
                  <th className="pb-2 text-right font-semibold">Times</th>
                </tr>
              </thead>
              <tbody>
                {mistakes.map((m) => (
                  <tr key={`${m.position}|${m.chosen}`} className="border-t border-line">
                    <td className="py-2.5 font-semibold text-cream">{m.position}</td>
                    <td className="py-2.5 text-bad">{choiceLabel(m.chosen)}</td>
                    <td className="py-2.5 text-good">{choiceLabel(m.recommended)}</td>
                    <td className="py-2.5 text-right tabular-nums text-cream">{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-dim">
              Drill these in{" "}
              <Link href="/train" className="text-gold hover:text-gold-bright">
                Training
              </Link>{" "}
              or look them up in the{" "}
              <Link href="/chart" className="text-gold hover:text-gold-bright">
                strategy chart
              </Link>
              .
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
