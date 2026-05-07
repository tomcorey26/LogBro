"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useStats } from "@/hooks/use-stats";
import { useTour } from "@/tours/useTour";
import { LifetimeTotalsCard } from "@/components/stats/LifetimeTotalsCard";
import { WeekMonthCard } from "@/components/stats/WeekMonthCard";
import { StreaksCard } from "@/components/stats/StreaksCard";
import { YearlyHeatmap } from "@/components/stats/YearlyHeatmap";
import { RankingsSection } from "@/components/stats/RankingsSection";
import type { Stats } from "@/server/db/stats";

export function StatsView({ initialStats }: { initialStats?: Stats }) {
  const { data: stats } = useStats(initialStats);

  useTour("stats");

  return (
    <div className="space-y-4">
      <PageHeader title="Stats" />
      <div data-tour="stats-totals">
        <LifetimeTotalsCard
          totalSeconds={stats.lifetime.totalSeconds}
          totalSessions={stats.lifetime.totalSessions}
        />
      </div>
      <WeekMonthCard
        weekSeconds={stats.weekSeconds}
        monthSeconds={stats.monthSeconds}
      />
      <div data-tour="stats-streaks">
        <StreaksCard
          current={stats.streak.current}
          longest={stats.streak.longest}
        />
      </div>
      <div data-tour="stats-heatmap">
        <YearlyHeatmap grid={stats.heatmap} />
      </div>
      <RankingsSection rankings={stats.rankings} />
    </div>
  );
}
