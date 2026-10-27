// Entry point for the single-file build (npm run build:standalone). Renders the same
// components as the Next.js app, with a hash router in place of Next's file routes.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "@/components/AppProvider";
import { Nav } from "@/components/Nav";
import { StrategyChartView } from "@/components/chart/StrategyChartView";
import { PlayTable } from "@/components/play/PlayTable";
import { SettingsView } from "@/components/settings/SettingsView";
import { StatsDashboard } from "@/components/stats/StatsDashboard";
import { Trainer } from "@/components/train/Trainer";
import { usePathname } from "./router";

const TITLES: Record<string, string> = {
  "/": "Blackjack IQ",
  "/train": "Train · Blackjack IQ",
  "/chart": "Strategy Chart · Blackjack IQ",
  "/stats": "Statistics · Blackjack IQ",
  "/settings": "Settings · Blackjack IQ",
};

function Routes() {
  const path = usePathname();
  if (typeof document !== "undefined") document.title = TITLES[path] ?? "Blackjack IQ";
  switch (path) {
    case "/train":
      return <Trainer />;
    case "/chart":
      return <StrategyChartView />;
    case "/stats":
      return <StatsDashboard />;
    case "/settings":
      return <SettingsView />;
    default:
      return <PlayTable />;
  }
}

function App() {
  return (
    <AppProvider>
      <Nav />
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-4 sm:px-6 md:pb-10">
        <Routes />
      </main>
    </AppProvider>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
