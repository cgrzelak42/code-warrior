"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, Flame, ListRestart, Target, Timer, Trash2, Trophy, XCircle } from "lucide-react";
import { type Action, ACTIONS } from "@/lib/engine/game";
import { ACTION_LABEL } from "@/lib/strategy/coach";
import { STORAGE_KEYS, browserStore, loadJSON, saveJSON } from "@/lib/storage/persist";
import {
  DIFFICULTY_INFO,
  type Difficulty,
  MAX_MISSED,
  type MissedDecision,
  type Scenario,
  type TrainingAnswer,
  generateScenario,
  gradeAnswer,
  sanitizeMissed,
  scenarioFromCards,
  scoreFor,
} from "@/lib/training/training";
import { useApp } from "../AppProvider";
import { PlayingCard } from "../PlayingCard";
import { chartHref } from "../play/CoachPanel";
import { ACTION_COLOR, ActionPill, PageHeader, Panel, Segmented, StatCard, StrengthMeter } from "../ui";

const KEYS: Record<string, Action> = { h: "hit", s: "stand", d: "double", p: "split" };

export function Trainer() {
  const { settings, updateSettings, logDecision, sound, hydrated } = useApp();
  const rules = settings.rules;
  const difficulty = settings.trainingDifficulty;
  const timer = settings.trainingTimer;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [answer, setAnswer] = useState<TrainingAnswer | null>(null);
  const [session, setSession] = useState({ score: 0, answered: 0, correct: 0, streak: 0, best: 0 });
  const [missed, setMissed] = useState<MissedDecision[]>([]);
  const [queue, setQueue] = useState<MissedDecision[]>([]);
  const [drilling, setDrilling] = useState<MissedDecision | null>(null);
  const [remaining, setRemaining] = useState(timer * 1000);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    setMissed(loadJSON(browserStore(), STORAGE_KEYS.missed, sanitizeMissed, []));
  }, [hydrated]);
  const saveMissed = (m: MissedDecision[]) => {
    setMissed(m);
    saveJSON(browserStore(), STORAGE_KEYS.missed, m);
  };

  const next = useCallback(() => {
    setAnswer(null);
    if (queue.length > 0) {
      const [head, ...rest] = queue;
      setQueue(rest);
      setDrilling(head!);
      setScenario(scenarioFromCards(head!.cards, head!.dealerUp, rules));
    } else {
      setDrilling(null);
      setScenario(generateScenario(difficulty, rules));
    }
    startedAt.current = performance.now();
    setRemaining(timer * 1000);
  }, [queue, rules, difficulty, timer]);

  const startDrill = () => {
    const [head, ...rest] = missed.slice().sort((a, b) => b.t - a.t).slice(0, 20);
    if (!head) return;
    setQueue(rest);
    setDrilling(head);
    setScenario(scenarioFromCards(head.cards, head.dealerUp, rules));
    setAnswer(null);
    startedAt.current = performance.now();
    setRemaining(timer * 1000);
  };

  // First scenario once settings are loaded; new scenario when difficulty or rules change.
  const configKey = `${difficulty}-${JSON.stringify(rules)}`;
  const lastConfig = useRef("");
  useEffect(() => {
    if (!hydrated || lastConfig.current === configKey) return;
    lastConfig.current = configKey;
    next();
  }, [hydrated, configKey, next]);

  const submit = useCallback(
    (chosen: Action | null) => {
      if (!scenario || answer) return;
      const elapsed = performance.now() - startedAt.current;
      const result = gradeAnswer(scenario, chosen, elapsed);
      setAnswer(result);
      sound(result.correct ? "correct" : "wrong");
      const rec = scenario.recommendation;
      setSession((s) => {
        const streak = result.correct ? s.streak + 1 : 0;
        return {
          score: s.score + scoreFor(result, difficulty, timer),
          answered: s.answered + 1,
          correct: s.correct + (result.correct ? 1 : 0),
          streak,
          best: Math.max(s.best, streak),
        };
      });
      logDecision({ source: "train", category: rec.category, position: rec.position, chosen: chosen ?? "timeout", recommended: rec.action });
      if (!result.correct) {
        const entry: MissedDecision = {
          id: scenario.id,
          cards: scenario.cards,
          dealerUp: scenario.dealerUp,
          position: rec.position,
          chosen,
          recommended: rec.action,
          explanation: rec.explanation,
          t: Date.now(),
        };
        saveMissed([entry, ...missed.filter((m) => m.position !== rec.position)].slice(0, MAX_MISSED));
      } else if (drilling) {
        saveMissed(missed.filter((m) => m.position !== drilling.position));
      }
    },
    [scenario, answer, difficulty, timer, missed, drilling, logDecision, sound],
  );

  // Countdown
  useEffect(() => {
    if (!scenario || answer || timer === 0) return;
    const id = setInterval(() => {
      const left = timer * 1000 - (performance.now() - startedAt.current);
      setRemaining(Math.max(0, left));
      if (left <= 0) submit(null);
    }, 100);
    return () => clearInterval(id);
  }, [scenario, answer, timer, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!answer && KEYS[k] && scenario) {
        const a = KEYS[k]!;
        if (isLegal(scenario, a)) submit(a);
      } else if (answer && (k === "enter" || k === " " || k === "n")) {
        if (e.target instanceof HTMLButtonElement && k !== "n") return;
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, scenario, submit, next]);

  const acc = session.answered ? Math.round((session.correct / session.answered) * 100) : null;
  const rec = scenario?.recommendation;
  const pct = timer ? remaining / (timer * 1000) : 1;

  const missedSorted = useMemo(() => missed.slice().sort((a, b) => b.t - a.t), [missed]);

  return (
    <div>
      <PageHeader title="Training" subtitle="Practice decisions with no chips at stake. Each hand is a fresh situation; answer with the basic-strategy play.">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Difficulty>
            label="Difficulty"
            value={difficulty}
            options={(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTY_INFO[d].label }))}
            onChange={(d) => updateSettings({ trainingDifficulty: d })}
          />
          <Segmented<number>
            label="Decision timer"
            value={timer}
            options={[
              { value: 0, label: "No timer" },
              { value: 5, label: "5s" },
              { value: 10, label: "10s" },
              { value: 15, label: "15s" },
            ]}
            onChange={(t) => updateSettings({ trainingTimer: t as 0 | 5 | 10 | 15 })}
          />
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Score" value={<span data-testid="train-score">{session.score}</span>} tone="gold" sub={DIFFICULTY_INFO[difficulty].description} />
        <StatCard label="Accuracy" value={acc === null ? "—" : `${acc}%`} sub={`${session.correct} of ${session.answered} correct`} tone={acc !== null && acc >= 90 ? "good" : "default"} />
        <StatCard label="Streak" value={<span className="flex items-center gap-1.5"><Flame className="h-5 w-5 text-warn" />{session.streak}</span>} sub={`Best this session: ${session.best}`} />
        <StatCard label="To review" value={missed.length} sub="Missed decisions saved below" tone={missed.length ? "bad" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="felt felt-rail relative overflow-hidden rounded-[28px] px-4 py-6 sm:rounded-[36px] sm:px-8" data-testid="train-table">
            {drilling && (
              <span className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-bright">Review drill</span>
            )}
            {timer > 0 && (
              <div className="absolute right-4 top-4 flex items-center gap-2 text-sm font-bold tabular-nums text-cream/80" aria-live="off">
                <Timer className="h-4 w-4" />
                {answer ? "—" : `${(remaining / 1000).toFixed(1)}s`}
              </div>
            )}
            {scenario && (
              <div key={scenario.id} className="flex flex-col items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.25em] text-cream/60">Dealer shows</span>
                  <div className="flex">
                    <PlayingCard card={scenario.dealerUp} size="md" dealIndex={1} />
                    <PlayingCard faceDown size="md" dealIndex={3} className="-ml-10 sm:-ml-12" />
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex">
                    {scenario.cards.map((c, i) => (
                      <PlayingCard key={c.id} card={c} size="lg" dealIndex={i * 2} className={i ? "-ml-12 sm:-ml-14" : ""} />
                    ))}
                  </div>
                  <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-sm font-bold text-cream">
                    {rec!.category === "pair" ? "Pair · " : ""}
                    {rec!.soft ? "Soft" : "Hard"} {rec!.total}
                  </span>
                </div>
              </div>
            )}
            {timer > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                <div
                  className="h-full transition-[width] duration-100 ease-linear"
                  style={{ width: `${(answer ? 0 : pct) * 100}%`, background: pct < 0.3 ? "var(--color-bad)" : "var(--color-gold)" }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="Your decision">
            {ACTIONS.map((a) => {
              const legal = scenario ? isLegal(scenario, a) : false;
              const isAnswer = answer && rec?.action === a;
              const isChosenWrong = answer && answer.chosen === a && !answer.correct;
              return (
                <button
                  key={a}
                  type="button"
                  disabled={!legal || !!answer}
                  onClick={() => submit(a)}
                  className={`rounded-xl border px-4 py-3.5 text-base font-bold text-cream transition active:scale-[0.98] disabled:cursor-not-allowed ${
                    isAnswer ? "border-good ring-2 ring-good/60" : isChosenWrong ? "border-bad ring-2 ring-bad/60" : "border-line"
                  } ${!legal ? "opacity-25" : answer && !isAnswer && !isChosenWrong ? "opacity-50" : ""}`}
                  style={{ background: `color-mix(in oklab, ${ACTION_COLOR[a]} 26%, #17191d)` }}
                  data-testid={`train-${a}`}
                >
                  {ACTION_LABEL[a]} <kbd className="ml-1 hidden text-xs text-dim sm:inline">{a === "split" ? "P" : a[0]!.toUpperCase()}</kbd>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0">
          <Panel title="Feedback" icon={<Target className="h-4 w-4" />} className="h-full">
            {answer && rec ? (
              <div className="animate-rise space-y-4" data-testid="train-feedback">
                <div className={`flex items-center gap-2 text-lg font-bold ${answer.correct ? "text-good" : "text-bad"}`}>
                  {answer.correct ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                  {answer.correct ? "Correct" : answer.chosen === null ? "Time's up" : "Not quite"}
                  {answer.correct && <span className="ml-auto text-sm text-gold-bright">+{scoreFor(answer, difficulty, timer)}</span>}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{rec.position}</span>
                  <ActionPill action={rec.action} />
                </div>
                {!answer.correct && answer.chosen && (
                  <p className="text-sm text-muted">
                    You chose <strong className="text-cream">{ACTION_LABEL[answer.chosen]}</strong>.
                  </p>
                )}
                <p className="text-sm leading-relaxed text-cream/90">{rec.explanation}</p>
                <StrengthMeter strength={rec.strength} score={rec.strengthScore} edge={rec.edge} />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <Link href={chartHref(rec.chartRef)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-gold-bright">
                    <BookOpen className="h-4 w-4" /> View chart
                  </Link>
                  <button type="button" onClick={next} className="btn-gold rounded-xl px-5 py-2.5 font-bold" data-testid="train-next" autoFocus>
                    Next hand <kbd className="ml-1 text-xs opacity-60">↵</kbd>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm leading-relaxed text-muted">
                <p>Pick the play you would make. Keys: H hit, S stand, D double, P split.</p>
                <p>
                  Practice uses the current table rules: <span className="text-cream">{rules.decks} decks, {rules.dealerHitsSoft17 ? "H17" : "S17"}, {rules.doubleAfterSplit ? "DAS" : "no DAS"}</span>. Results count toward your strategy accuracy in Statistics.
                </p>
                {queue.length > 0 && <p className="text-gold-bright">{queue.length} missed hand(s) queued for review.</p>}
              </div>
            )}
          </Panel>
        </aside>
      </div>

      <Panel
        title="Review missed decisions"
        icon={<ListRestart className="h-4 w-4" />}
        className="mt-5"
        action={
          missed.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startDrill}
                className="btn-gold rounded-lg px-3 py-1.5 text-sm font-bold"
                data-testid="drill-missed"
              >
                Drill these
              </button>
              <button type="button" onClick={() => saveMissed([])} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:text-cream">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          )
        }
      >
        {missed.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Trophy className="h-4 w-4 text-gold" /> Nothing to review yet. Hands you miss will be saved here so you can drill them.
          </p>
        ) : (
          <ul className="divide-y divide-line" data-testid="missed-list">
            {missedSorted.map((m) => (
              <li key={m.id} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                <div>
                  <div className="font-semibold text-cream">{m.position}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    You: <span className="font-bold text-bad">{m.chosen ? ACTION_LABEL[m.chosen] : "No answer"}</span> · Correct: <ActionPill action={m.recommended} className="px-2 py-0 text-xs" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">{m.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function isLegal(s: Scenario, a: Action): boolean {
  if (a === "hit") return s.ctx.canHit;
  if (a === "double") return s.ctx.canDouble;
  if (a === "split") return s.ctx.canSplit;
  return true;
}
