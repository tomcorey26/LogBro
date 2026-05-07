"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useStats } from "@/hooks/use-stats";
import { LifetimeTotalsCard } from "@/components/stats/LifetimeTotalsCard";
import { WeekMonthCard } from "@/components/stats/WeekMonthCard";
import { StreaksCard } from "@/components/stats/StreaksCard";
import { YearlyHeatmap } from "@/components/stats/YearlyHeatmap";
import { RankingsSection } from "@/components/stats/RankingsSection";
import type { Stats } from "@/server/db/stats";

export function StatsView({ initialStats }: { initialStats?: Stats }) {
  const { data: stats } = useStats(initialStats);

  return (
    <div className="space-y-4">
      <PageHeader title="Stats" />
      <LifetimeTotalsCard
        totalSeconds={stats.lifetime.totalSeconds}
        totalSessions={stats.lifetime.totalSessions}
      />
      <WeekMonthCard
        weekSeconds={stats.weekSeconds}
        monthSeconds={stats.monthSeconds}
      />
      <StreaksCard
        current={stats.streak.current}
        longest={stats.streak.longest}
      />
      <YearlyHeatmap grid={stats.heatmap} />
      <RankingsSection rankings={stats.rankings} />
    </div>
  );
}
