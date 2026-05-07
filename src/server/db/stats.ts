// src/server/db/stats.ts
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { habits, timeSessions } from "@/db/schema";
import {
  buildHeatmapGrid,
  computeCurrentStreak,
  computeLongestStreak,
  toUtcDateKey,
  type HeatmapGrid,
} from "@/lib/stats";

export type Ranking = {
  rank: number;
  habitId: number;
  habitName: string;
  totalSeconds: number;
};

export type Stats = {
  lifetime: { totalSeconds: number; totalSessions: number };
  weekSeconds: number;
  monthSeconds: number;
  streak: { current: number; longest: number };
  heatmap: HeatmapGrid;
  todayKey: string;
  rankings: Ranking[];
};

const DAY_SECONDS = 24 * 60 * 60;

export async function getStatsForUser(userId: number): Promise<Stats> {
  const now = new Date();
  const todayKey = toUtcDateKey(now);
  const heatmapStart = new Date(now.getTime() - 371 * DAY_SECONDS * 1000);
  const weekStart = new Date(now.getTime() - 7 * DAY_SECONDS * 1000);
  const monthStart = new Date(now.getTime() - 30 * DAY_SECONDS * 1000);

  const dateExpr = sql<string>`strftime('%Y-%m-%d', ${timeSessions.endTime}, 'unixepoch')`;
  const recentSumExpr = sql<number>`sum(${timeSessions.durationSeconds})`;
  const rankingSumExpr = sql<number>`sum(${timeSessions.durationSeconds})`;

  const [lifetimeRow, recentRows, allDateRows, rankingRows] = await Promise.all([
    // 1. Lifetime totals
    db
      .select({
        totalSeconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)`,
        totalSessions: sql<number>`count(*)`,
      })
      .from(timeSessions)
      .innerJoin(habits, eq(timeSessions.habitId, habits.id))
      .where(eq(habits.userId, userId))
      .get(),

    // 2. Recent (371d) per-day aggregate — heat map + week/month + current streak
    db
      .select({
        date: dateExpr.as("date"),
        seconds: recentSumExpr.as("seconds"),
      })
      .from(timeSessions)
      .innerJoin(habits, eq(timeSessions.habitId, habits.id))
      .where(and(eq(habits.userId, userId), gte(timeSessions.endTime, heatmapStart)))
      .groupBy(dateExpr),

    // 3. All-history distinct date keys — longest streak only
    db
      .selectDistinct({ date: dateExpr.as("date") })
      .from(timeSessions)
      .innerJoin(habits, eq(timeSessions.habitId, habits.id))
      .where(eq(habits.userId, userId)),

    // 4. Rankings (inlined from former getRankingsForUser; cleaned up in Task 15)
    db
      .select({
        habitId: habits.id,
        habitName: habits.name,
        totalSeconds: rankingSumExpr.as("total_seconds"),
      })
      .from(timeSessions)
      .innerJoin(habits, eq(timeSessions.habitId, habits.id))
      .where(eq(habits.userId, userId))
      .groupBy(habits.id, habits.name)
      .orderBy(desc(rankingSumExpr)),
  ]);

  // ─── Assemble ───
  const secondsByDate: Record<string, number> = {};
  for (const r of recentRows) secondsByDate[r.date] = r.seconds;

  const weekStartKey = toUtcDateKey(weekStart);
  const monthStartKey = toUtcDateKey(monthStart);
  let weekSeconds = 0;
  let monthSeconds = 0;
  for (const [date, sec] of Object.entries(secondsByDate)) {
    if (date >= weekStartKey) weekSeconds += sec;
    if (date >= monthStartKey) monthSeconds += sec;
  }

  const recentSet = new Set(Object.keys(secondsByDate));
  const allSet = new Set(allDateRows.map((r) => r.date));

  return {
    lifetime: {
      totalSeconds: lifetimeRow?.totalSeconds ?? 0,
      totalSessions: lifetimeRow?.totalSessions ?? 0,
    },
    weekSeconds,
    monthSeconds,
    streak: {
      current: computeCurrentStreak(recentSet, todayKey),
      longest: computeLongestStreak(allSet),
    },
    heatmap: buildHeatmapGrid(secondsByDate, todayKey),
    todayKey,
    rankings: rankingRows.map((row, index) => ({
      rank: index + 1,
      habitId: row.habitId,
      habitName: row.habitName,
      totalSeconds: row.totalSeconds,
    })),
  };
}
