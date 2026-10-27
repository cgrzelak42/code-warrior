import { Suspense } from "react";
import { StrategyChartView } from "@/components/chart/StrategyChartView";

export const metadata = { title: "Strategy Chart · Blackjack IQ" };

export default function ChartPage() {
  return (
    <Suspense>
      <StrategyChartView />
    </Suspense>
  );
}
