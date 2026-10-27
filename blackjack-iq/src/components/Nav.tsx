"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, GraduationCap, LayoutGrid, Settings as SettingsIcon, Spade, Volume2, VolumeX } from "lucide-react";
import { formatChips } from "@/lib/engine/bankroll";
import { useApp } from "./AppProvider";

const LINKS = [
  { href: "/", label: "Play", icon: Spade },
  { href: "/train", label: "Train", icon: GraduationCap },
  { href: "/chart", label: "Strategy Chart", short: "Chart", icon: LayoutGrid },
  { href: "/stats", label: "Statistics", short: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Blackjack IQ home">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-gold/40 bg-gradient-to-b from-panel-2 to-ink shadow-[0_0_20px_rgba(212,175,90,0.15)]">
        <Spade className="h-5 w-5 text-gold" fill="currentColor" />
      </span>
      <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight sm:text-xl">
        <span className="text-cream">Blackjack</span> <span className="gold-text">IQ</span>
      </span>
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const { displayBankroll, settings, updateSettings, hydrated } = useApp();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  active(href) ? "bg-panel-2 text-gold-bright" : "text-muted hover:bg-panel hover:text-cream"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-gold/30 bg-panel px-3 py-1.5 sm:px-3.5" title="Virtual chips (play money)">
              <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-b from-gold-bright to-gold-deep" aria-hidden />
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted sm:inline">Bankroll</span>
              <span className="font-bold tabular-nums text-cream" data-testid="nav-bankroll">
                {hydrated ? formatChips(displayBankroll) : "—"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => updateSettings({ sound: !settings.sound })}
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-muted transition hover:text-cream"
              aria-label={settings.sound ? "Mute sound" : "Unmute sound"}
              aria-pressed={!settings.sound}
            >
              {settings.sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${active(l.href) ? "text-gold-bright" : "text-muted"}`}
              >
                <Icon className="h-5 w-5" />
                {"short" in l ? l.short : l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
