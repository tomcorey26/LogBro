# Stats Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/rankings` into a `/stats` dashboard with lifetime totals, week/month time, daily streaks, a yearly heat map, and a top-5 rankings section.

**Architecture:** One server function `getStatsForUser(userId)` joins everything we need (lifetime totals, last-371-day session aggregate, full-history date keys, rankings). One `/api/stats` endpoint. One `useStats` suspense hook. One `StatsView` client component composes five widgets. Pure helpers in `src/lib/stats.ts` for streak + heat-map math (testable without DB).

**Tech Stack:** Next.js 16 App Router, React 19, Drizzle ORM (Turso/SQLite), TanStack Query v5, Tailwind 4, shadcn `Card`, Vitest, Playwright. UTC date keys server-side for stats (matches heat map render exactly).

**Branch:** Already on `stats-dashboard`. Spec: `docs/superpowers/specs/2026-05-06-stats-dashboard-design.md`.

---

## File map

**New files**
- `src/lib/stats.ts` — pure helpers: `bucketSeconds`, `computeCurrentStreak`, `computeLongestStreak`, `buildHeatmapGrid`, types
- `src/lib/stats.test.ts` — unit tests for the helpers
- `src/server/db/stats.ts` — `getStatsForUser`
- `src/app/api/stats/route.ts` — GET handler
- `src/hooks/use-stats.ts` — `useStats(initial?)`
- `src/components/StatsView.tsx` — orchestrator
- `src/components/stats/LifetimeTotalsCard.tsx`
- `src/components/stats/WeekMonthCard.tsx`
- `src/components/stats/StreaksCard.tsx`
- `src/components/stats/YearlyHeatmap.tsx`
- `src/components/stats/RankingsSection.tsx`
- `src/app/(app)/stats/page.tsx`
- `e2e/stats.spec.ts`

**Modified files**
- `src/lib/query-keys.ts` — add `stats.all`
- `src/hooks/use-habits.ts` — invalidate `stats.all` on stop timer
- `src/hooks/use-history.ts` — invalidate `stats.all` on delete + log
- `src/hooks/use-active-routine.ts` — invalidate `stats.all` on save
- `src/components/TimerSync.tsx` — invalidate `stats.all` on auto-save
- `src/components/TabNav.tsx` — Rankings → Stats, href `/stats`
- `src/proxy.ts` — add `/stats` to protected routes + matcher
- `src/app/(app)/rankings/page.tsx` — replace body with `redirect('/stats')`
- `e2e/mocks.ts` — add `**/api/stats*` route mock

**Deleted files (final task)**
- `src/components/RankingsView.tsx` (superseded by `RankingsSection`)
- `src/hooks/use-rankings.ts` (superseded by `useStats`)
- `src/app/api/rankings/route.ts` (no remaining consumers after refactor)
- `src/server/db/rankings.ts` (delegate now lives inside `getStatsForUser`)

---

## Task 1: Pure stats helpers (lib/stats.ts) — TDD

**Files:**
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

- [ ] **Step 1.1: Write failing tests**

```typescript
// src/lib/stats.test.ts
import { describe, it, expect } from "vitest";
import {
  bucketSeconds,
  computeCurrentStreak,
  computeLongestStreak,
  buildHeatmapGrid,
} from "./stats";

describe("bucketSeconds", () => {
  it("returns 0 for zero seconds", () => {
    expect(bucketSeconds(0)).toBe(0);
  });
  it("returns 1 for 1 second up to 15 minutes", () => {
    expect(bucketSeconds(1)).toBe(1);
    expect(bucketSeconds(15 * 60)).toBe(1);
  });
  it("returns 2 for >15min up to 60min", () => {
    expect(bucketSeconds(15 * 60 + 1)).toBe(2);
    expect(bucketSeconds(60 * 60)).toBe(2);
  });
  it("returns 3 for >60min up to 3h", () => {
    expect(bucketSeconds(60 * 60 + 1)).toBe(3);
    expect(bucketSeconds(3 * 60 * 60)).toBe(3);
  });
  it("returns 4 for >3h", () => {
    expect(bucketSeconds(3 * 60 * 60 + 1)).toBe(4);
    expect(bucketSeconds(10 * 60 * 60)).toBe(4);
  });
});

describe("computeCurrentStreak", () => {
  it("returns 0 for empty set", () => {
    expect(computeCurrentStreak(new Set(), "2026-05-06")).toBe(0);
  });
  it("counts back from today when today is present", () => {
    const dates = new Set(["2026-05-06", "2026-05-05", "2026-05-04"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(3);
  });
  it("counts back from yesterday when today missing but yesterday present", () => {
    const dates = new Set(["2026-05-05", "2026-05-04"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(2);
  });
  it("returns 0 when neither today nor yesterday is present", () => {
    const dates = new Set(["2026-05-04", "2026-05-03"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(0);
  });
  it("stops at the first gap", () => {
    const dates = new Set(["2026-05-06", "2026-05-05", "2026-05-03"]);
    expect(computeCurrentStreak(dates, "2026-05-06")).toBe(2);
  });
});

describe("computeLongestStreak", () => {
  it("returns 0 for empty set", () => {
    expect(computeLongestStreak(new Set())).toBe(0);
  });
  it("returns 1 for a single day", () => {
    expect(computeLongestStreak(new Set(["2026-05-06"]))).toBe(1);
  });
  it("finds longest run anywhere in history", () => {
    const dates = new Set([
      "2026-01-01", "2026-01-02", // 2
      "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05", // 5
      "2026-03-01", // 1
    ]);
    expect(computeLongestStreak(dates)).toBe(5);
  });
  it("handles unsorted input", () => {
    const dates = new Set(["2026-01-03", "2026-01-01", "2026-01-02"]);
    expect(computeLongestStreak(dates)).toBe(3);
  });
});

describe("buildHeatmapGrid", () => {
  it("produces 53 weeks × 7 days = 371 cells", () => {
    const grid = buildHeatmapGrid({}, "2026-05-06");
    expect(grid.weeks).toHaveLength(53);
    for (const week of grid.weeks) expect(week.days).toHaveLength(7);
  });
  it("ends on Sunday of the current week (Mon-start, Sun=last)", () => {
    // 2026-05-06 is a Wednesday. Sunday of that week is 2026-05-10.
    const grid = buildHeatmapGrid({}, "2026-05-06");
    const lastWeek = grid.weeks[grid.weeks.length - 1];
    expect(lastWeek.days[6].date).toBe("2026-05-10");
  });
  it("sets seconds for known dates and 0 for unknown", () => {
    const grid = buildHeatmapGrid({ "2026-05-06": 600 }, "2026-05-06");
    const found = grid.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date === "2026-05-06");
    expect(found?.seconds).toBe(600);
    expect(found?.bucket).toBe(1);
  });
  it("flags days after today as future (no cell render)", () => {
    const grid = buildHeatmapGrid({}, "2026-05-06");
    const future = grid.weeks
      .flatMap((w) => w.days)
      .find((d) => d.date === "2026-05-10");
    expect(future?.isFuture).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npm run test:unit -- src/lib/stats.test.ts`
Expected: FAIL with "Cannot find module './stats'"

- [ ] **Step 1.3: Implement `src/lib/stats.ts`**

```typescript
// src/lib/stats.ts

/** UTC date key (YYYY-MM-DD) from an ISO string or Date. */
export function toUtcDateKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toISOString().slice(0, 10);
}

/** Add `days` to a UTC date key. Handles month/year rollover. */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0/1/2/3/4 buckets matching the heat-map design. */
export function bucketSeconds(seconds: number): 0 | 1 | 2 | 3 | 4 {
  if (seconds <= 0) return 0;
  if (seconds <= 15 * 60) return 1;
  if (seconds <= 60 * 60) return 2;
  if (seconds <= 3 * 60 * 60) return 3;
  return 4;
}

/**
 * Days ending today with at least one session, walking backwards.
 * If today is missing, start from yesterday so the streak isn't lost
 * before the user practices today.
 */
export function computeCurrentStreak(
  dates: Set<string>,
  todayKey: string,
): number {
  let cursor = todayKey;
  if (!dates.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!dates.has(cursor)) return 0;
  }
  let count = 0;
  while (dates.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Longest run of consecutive present days anywhere in `dates`. */
export function computeLongestStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const sorted = [...dates].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === addDays(sorted[i - 1], 1)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

export type HeatmapDay = {
  date: string;       // YYYY-MM-DD (UTC)
  seconds: number;
  bucket: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;  // true for cells after `todayKey`
};

export type HeatmapGrid = {
  weeks: { days: HeatmapDay[] }[]; // length 53; days length 7 (Mon..Sun)
};

/**
 * Build a 53-week × 7-day grid (Mon..Sun) ending on the Sunday of the
 * current week. Cells past `todayKey` get isFuture=true (caller hides them).
 */
export function buildHeatmapGrid(
  secondsByDate: Record<string, number>,
  todayKey: string,
): HeatmapGrid {
  // ISO weekday: Mon=1..Sun=7. JS getUTCDay: Sun=0..Sat=6.
  const todayJsDay = new Date(todayKey + "T00:00:00Z").getUTCDay();
  const daysUntilSunday = todayJsDay === 0 ? 0 : 7 - todayJsDay;
  const lastSunday = addDays(todayKey, daysUntilSunday);
  // First Monday = 53 weeks × 7 days = 371 cells back, +1 because lastSunday is inclusive
  const firstMonday = addDays(lastSunday, -370);

  const weeks: { days: HeatmapDay[] }[] = [];
  let cursor = firstMonday;
  for (let w = 0; w < 53; w++) {
    const days: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const seconds = secondsByDate[cursor] ?? 0;
      days.push({
        date: cursor,
        seconds,
        bucket: bucketSeconds(seconds),
        isFuture: cursor > todayKey,
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push({ days });
  }
  return { weeks };
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npm run test:unit -- src/lib/stats.test.ts`
Expected: PASS, all green.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat(stats): pure helpers for streaks, buckets, heatmap grid"
```

---

## Task 2: Server query (server/db/stats.ts) — TDD-light

**Files:**
- Create: `src/server/db/stats.ts`

The `Ranking` shape is already produced by `getRankingsForUser` in `src/server/db/rankings.ts` — we reuse it but inline the implementation here so we can later delete `rankings.ts`.

- [ ] **Step 2.1: Write the server function**

```typescript
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
  const sumExpr = sql<number>`sum(${timeSessions.durationSeconds})`;

  // 1. Lifetime totals
  const lifetimeRow = await db
    .select({
      totalSeconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)`,
      totalSessions: sql<number>`count(*)`,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId))
    .get();

  // 2. Recent (371d) per-day aggregate — heat map + week/month + current streak
  const recentRows = await db
    .select({
      date: dateExpr.as("date"),
      seconds: sumExpr.as("seconds"),
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(and(eq(habits.userId, userId), gte(timeSessions.endTime, heatmapStart)))
    .groupBy(dateExpr);

  // 3. All-history distinct date keys — longest streak only
  const allDateRows = await db
    .selectDistinct({ date: dateExpr.as("date") })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId));

  // 4. Rankings (inlined from former getRankingsForUser)
  const rankingRows = await db
    .select({
      habitId: habits.id,
      habitName: habits.name,
      totalSeconds: sumExpr.as("total_seconds"),
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId))
    .groupBy(habits.id, habits.name)
    .orderBy(desc(sumExpr));

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
```

- [ ] **Step 2.2: Type-check the file**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/server/db/stats.ts`. If `Ranking` import collisions with the legacy file appear, ignore — `getRankingsForUser` is still callable until Task 16.

- [ ] **Step 2.3: Commit**

```bash
git add src/server/db/stats.ts
git commit -m "feat(stats): server query aggregating totals, streak, heatmap, rankings"
```

---

## Task 3: API route + query key

**Files:**
- Create: `src/app/api/stats/route.ts`
- Modify: `src/lib/query-keys.ts`

- [ ] **Step 3.1: Add `stats` query key**

Replace the contents of `src/lib/query-keys.ts` with:

```typescript
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  habits: {
    all: ['habits'] as const,
  },
  history: {
    all: ['history'] as const,
    list: (filters: { habitId?: string; range?: string; viewMode: string }) =>
      ['history', 'list', filters] as const,
  },
  rankings: {
    all: ['rankings'] as const,
  },
  stats: {
    all: ['stats'] as const,
  },
  routines: {
    all: ['routines'] as const,
    detail: (id: number) => ['routines', id] as const,
  },
  features: {
    all: ['features'] as const,
  },
  routineSession: {
    active: ['routineSession', 'active'] as const,
  },
};
```

- [ ] **Step 3.2: Create the API route**

```typescript
// src/app/api/stats/route.ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getStatsForUser } from "@/server/db/stats";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getStatsForUser(userId);
  return NextResponse.json({ stats });
}
```

- [ ] **Step 3.3: Smoke-test the route locally**

Run: `npm run dev` (background) then in another terminal `curl -i -b "session=$(cat .playwright-auth.json | jq -r '.cookies[] | select(.name==\"session\") | .value')" http://localhost:3000/api/stats | head -40`. Expected: 200 and JSON containing `stats.lifetime`, `stats.heatmap.weeks`. Skip if no `.playwright-auth.json` — Task 15 will smoke this end-to-end. Stop dev server.

- [ ] **Step 3.4: Commit**

```bash
git add src/lib/query-keys.ts src/app/api/stats/route.ts
git commit -m "feat(stats): /api/stats endpoint and stats query key"
```

---

## Task 4: useStats hook

**Files:**
- Create: `src/hooks/use-stats.ts`

- [ ] **Step 4.1: Implement the hook**

```typescript
// src/hooks/use-stats.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Stats } from "@/server/db/stats";

export function useStats(initialData?: Stats) {
  return useSuspenseQuery({
    queryKey: queryKeys.stats.all,
    queryFn: () => api<{ stats: Stats }>("/api/stats"),
    select: (data) => data.stats,
    ...(initialData ? { initialData: { stats: initialData } } : {}),
  });
}
```

- [ ] **Step 4.2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4.3: Commit**

```bash
git add src/hooks/use-stats.ts
git commit -m "feat(stats): useStats suspense hook"
```

---

## Task 5: Wire stats invalidations into existing mutation hooks

**Files:**
- Modify: `src/hooks/use-habits.ts:42-52`
- Modify: `src/hooks/use-history.ts:25-49`
- Modify: `src/hooks/use-active-routine.ts:49-61`
- Modify: `src/components/TimerSync.tsx:107`

Every place that already invalidates `queryKeys.rankings.all` must also invalidate `queryKeys.stats.all` (since stats subsumes rankings + totals + streaks).

- [ ] **Step 5.1: Patch `use-habits.ts` `useStopTimer`**

In `src/hooks/use-habits.ts`, replace the `useStopTimer` body (lines 42-52):

```typescript
export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ durationSeconds: number; habitId: number }>('/api/timer/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
```

- [ ] **Step 5.2: Patch `use-history.ts`**

Add `queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });` to the `onSuccess` of both `useDeleteHistoryEntry` (after line 33) and `useLogHistory` (after line 46).

After the change, `useDeleteHistoryEntry`'s `onSuccess` reads:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
},
```

`useLogHistory`'s `onSuccess` reads:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
},
```

- [ ] **Step 5.3: Patch `use-active-routine.ts` `useSaveRoutineSession`**

In `src/hooks/use-active-routine.ts`, the `useSaveRoutineSession` `onSuccess` block (lines 54-60) becomes:

```typescript
onSuccess: () => {
  invalidate(qc);
  qc.invalidateQueries({ queryKey: queryKeys.history.all });
  qc.invalidateQueries({ queryKey: queryKeys.habits.all });
  qc.invalidateQueries({ queryKey: queryKeys.rankings.all });
  qc.invalidateQueries({ queryKey: queryKeys.stats.all });
},
```

- [ ] **Step 5.4: Patch `TimerSync.tsx`**

In `src/components/TimerSync.tsx`, find the line near 107:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
```

Add immediately after it:

```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
```

- [ ] **Step 5.5: Run unit tests**

Run: `npm run test:unit`
Expected: all pass (no consumer of these hooks asserts on invalidation contents directly).

- [ ] **Step 5.6: Commit**

```bash
git add src/hooks/use-habits.ts src/hooks/use-history.ts src/hooks/use-active-routine.ts src/components/TimerSync.tsx
git commit -m "feat(stats): invalidate stats query on timer/history/routine mutations"
```

---

## Task 6: YearlyHeatmap component

**Files:**
- Create: `src/components/stats/YearlyHeatmap.tsx`

- [ ] **Step 6.1: Implement the heatmap**

```tsx
// src/components/stats/YearlyHeatmap.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import type { HeatmapGrid } from "@/lib/stats";

const BUCKET_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-muted",
  1: "bg-primary/20",
  2: "bg-primary/40",
  3: "bg-primary/70",
  4: "bg-primary",
};

const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTooltipDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthLabels(grid: HeatmapGrid): (string | null)[] {
  // For each week column, label it if its first (Monday) day is in a different
  // calendar month from the previous week's first day.
  const labels: (string | null)[] = [];
  let prevMonth = -1;
  for (const week of grid.weeks) {
    const firstDay = week.days[0].date;
    const month = Number(firstDay.slice(5, 7)) - 1;
    if (month !== prevMonth) {
      labels.push(MONTH_NAMES[month]);
      prevMonth = month;
    } else {
      labels.push(null);
    }
  }
  return labels;
}

export function YearlyHeatmap({
  grid,
  isEmpty,
}: {
  grid: HeatmapGrid;
  isEmpty: boolean;
}) {
  const monthLabels = buildMonthLabels(grid);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Last 12 months</h3>
          {isEmpty && (
            <span className="text-xs text-muted-foreground">
              Log your first session to start your heat map.
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="inline-flex flex-col gap-1 min-w-full">
            {/* Month label row */}
            <div className="flex gap-0.5 pl-8">
              {monthLabels.map((label, i) => (
                <div
                  key={i}
                  className="w-3 text-[10px] text-muted-foreground text-left"
                >
                  {label ?? ""}
                </div>
              ))}
            </div>

            {/* Grid: 7 rows × 53 columns */}
            <div className="flex gap-0.5">
              {/* Weekday labels column */}
              <div className="flex flex-col gap-0.5 pr-1 w-7">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="h-3 text-[10px] leading-3 text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
              {/* Week columns */}
              {grid.weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.days.map((day) => (
                    <div
                      key={day.date}
                      className={`h-3 w-3 rounded-sm ${
                        day.isFuture
                          ? "bg-transparent"
                          : BUCKET_CLASSES[day.bucket]
                      }`}
                      title={
                        day.isFuture
                          ? ""
                          : day.seconds > 0
                            ? `${formatTooltipDate(day.date)} · ${formatTime(day.seconds)}`
                            : `${formatTooltipDate(day.date)} · No sessions`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1 mt-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((b) => (
                <span
                  key={b}
                  className={`block h-3 w-3 rounded-sm ${BUCKET_CLASSES[b]}`}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6.2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/stats/YearlyHeatmap.tsx
git commit -m "feat(stats): YearlyHeatmap widget with bucketed cells and tooltips"
```

---

## Task 7: LifetimeTotalsCard

**Files:**
- Create: `src/components/stats/LifetimeTotalsCard.tsx`

- [ ] **Step 7.1: Implement**

```tsx
// src/components/stats/LifetimeTotalsCard.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";

export function LifetimeTotalsCard({
  totalSeconds,
  totalSessions,
}: {
  totalSeconds: number;
  totalSessions: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground">Lifetime</h3>
        <p className="text-3xl font-bold mt-1">{formatTime(totalSeconds)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {totalSessions} {totalSessions === 1 ? "session" : "sessions"}
        </p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7.2: Commit**

```bash
git add src/components/stats/LifetimeTotalsCard.tsx
git commit -m "feat(stats): LifetimeTotalsCard widget"
```

---

## Task 8: WeekMonthCard

**Files:**
- Create: `src/components/stats/WeekMonthCard.tsx`

- [ ] **Step 8.1: Implement**

```tsx
// src/components/stats/WeekMonthCard.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatTime } from "@/lib/format";

export function WeekMonthCard({
  weekSeconds,
  monthSeconds,
}: {
  weekSeconds: number;
  monthSeconds: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            This week
          </h3>
          <p className="text-2xl font-bold mt-1">{formatTime(weekSeconds)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            This month
          </h3>
          <p className="text-2xl font-bold mt-1">{formatTime(monthSeconds)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
git add src/components/stats/WeekMonthCard.tsx
git commit -m "feat(stats): WeekMonthCard widget"
```

---

## Task 9: StreaksCard

**Files:**
- Create: `src/components/stats/StreaksCard.tsx`

- [ ] **Step 9.1: Implement**

```tsx
// src/components/stats/StreaksCard.tsx
"use client";

import { Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StreaksCard({
  current,
  longest,
}: {
  current: number;
  longest: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-muted-foreground">Streaks</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-2xl font-bold mt-1">
              {current} <span className="text-sm font-normal text-muted-foreground">{current === 1 ? "day" : "days"}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Longest</p>
            <p className="text-2xl font-bold mt-1">
              {longest} <span className="text-sm font-normal text-muted-foreground">{longest === 1 ? "day" : "days"}</span>
            </p>
          </div>
        </div>
        {current > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            Don&apos;t break the chain.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9.2: Commit**

```bash
git add src/components/stats/StreaksCard.tsx
git commit -m "feat(stats): StreaksCard widget"
```

---

## Task 10: RankingsSection (extracted, top-5 + show-all)

**Files:**
- Create: `src/components/stats/RankingsSection.tsx`

- [ ] **Step 10.1: Implement**

```tsx
// src/components/stats/RankingsSection.tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import type { Ranking } from "@/server/db/stats";

const RANK_COLORS: Record<number, string> = {
  1: "text-rank-gold",
  2: "text-rank-silver",
  3: "text-rank-bronze",
};

const TOP_N = 5;

export function RankingsSection({ rankings }: { rankings: Ranking[] }) {
  const [expanded, setExpanded] = useState(false);

  if (rankings.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-2">Rankings</h3>
        <p className="text-sm text-muted-foreground py-4">No rankings yet</p>
      </div>
    );
  }

  const visible = expanded ? rankings : rankings.slice(0, TOP_N);
  const hasMore = rankings.length > TOP_N;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Rankings</h3>
      {visible.map((r) => (
        <Card key={r.habitId}>
          <CardContent className="p-3 flex items-center gap-3">
            <span
              className={`text-lg font-bold w-8 ${
                RANK_COLORS[r.rank] || "text-muted-foreground"
              }`}
            >
              #{r.rank}
            </span>
            <span className="font-medium flex-1 truncate min-w-0">
              {r.habitName}
            </span>
            <span className="font-mono text-sm text-muted-foreground">
              {formatTime(r.totalSeconds)}
            </span>
          </CardContent>
        </Card>
      ))}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all (${rankings.length})`}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 10.2: Commit**

```bash
git add src/components/stats/RankingsSection.tsx
git commit -m "feat(stats): RankingsSection with top-5 + show-all toggle"
```

---

## Task 11: StatsView orchestrator

**Files:**
- Create: `src/components/StatsView.tsx`

- [ ] **Step 11.1: Implement**

```tsx
// src/components/StatsView.tsx
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
  const isEmpty = stats.lifetime.totalSessions === 0;

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
      <YearlyHeatmap grid={stats.heatmap} isEmpty={isEmpty} />
      <RankingsSection rankings={stats.rankings} />
    </div>
  );
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/components/StatsView.tsx
git commit -m "feat(stats): StatsView orchestrator composing all widgets"
```

---

## Task 12: /stats page (server component) + /rankings redirect + proxy + TabNav

**Files:**
- Create: `src/app/(app)/stats/page.tsx`
- Modify: `src/app/(app)/rankings/page.tsx`
- Modify: `src/proxy.ts`
- Modify: `src/components/TabNav.tsx`

- [ ] **Step 12.1: Create the stats page**

```tsx
// src/app/(app)/stats/page.tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { StatsView } from "@/components/StatsView";
import { getSessionUserId } from "@/lib/auth";
import { getStatsForUser } from "@/server/db/stats";

export default async function StatsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const stats = await getStatsForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <StatsView initialStats={stats} />
    </Suspense>
  );
}
```

- [ ] **Step 12.2: Replace `/rankings/page.tsx` with a redirect**

Overwrite `src/app/(app)/rankings/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function RankingsRedirect() {
  redirect("/stats");
}
```

- [ ] **Step 12.3: Update `src/proxy.ts`**

In `src/proxy.ts`:

Replace line 4:

```typescript
const PROTECTED_ROUTES = ['/habits', '/routines', '/history', '/rankings', '/stats', '/timer', '/account'];
```

Replace line 68:

```typescript
matcher: ['/login', '/habits/:path*', '/routines/:path*', '/sessions/:path*', '/rankings/:path*', '/stats/:path*', '/timer/:path*', '/account/:path*', '/api/auth/:path*'],
```

- [ ] **Step 12.4: Update `src/components/TabNav.tsx`**

Replace the `TABS` constant (lines 7-12):

```typescript
const TABS = [
  { href: '/routines', label: 'Routines' },
  { href: '/habits', label: 'Habits' },
  { href: '/history', label: 'History' },
  { href: '/stats', label: 'Stats' },
];
```

- [ ] **Step 12.5: Manual smoke test**

Run: `npm run dev` (background).
- Open `http://localhost:3000/stats` → renders dashboard
- Open `http://localhost:3000/rankings` → redirects to `/stats`
- Click "Stats" tab → highlighted, shows the page
- Stop dev server.

- [ ] **Step 12.6: Commit**

```bash
git add src/app/\(app\)/stats/page.tsx src/app/\(app\)/rankings/page.tsx src/proxy.ts src/components/TabNav.tsx
git commit -m "feat(stats): /stats page, /rankings redirect, nav rename"
```

---

## Task 13: Update e2e mocks for /api/stats

**Files:**
- Modify: `e2e/mocks.ts`

- [ ] **Step 13.1: Add `stats` to `MockState` and a default**

Insert into `MockState` (around line 39, near `rankings`):

```typescript
stats: {
  lifetime: { totalSeconds: number; totalSessions: number };
  weekSeconds: number;
  monthSeconds: number;
  streak: { current: number; longest: number };
  heatmap: { weeks: { days: { date: string; seconds: number; bucket: 0 | 1 | 2 | 3 | 4; isFuture: boolean }[] }[] };
  todayKey: string;
  rankings: { rank: number; habitId: number; habitName: string; totalSeconds: number }[];
};
```

In `defaultState()`, add:

```typescript
stats: {
  lifetime: { totalSeconds: 0, totalSessions: 0 },
  weekSeconds: 0,
  monthSeconds: 0,
  streak: { current: 0, longest: 0 },
  heatmap: { weeks: [] },
  todayKey: new Date().toISOString().slice(0, 10),
  rankings: [],
},
```

- [ ] **Step 13.2: Add a `**/api/stats*` route mock**

Place this just below the existing rankings route (around line 227):

```typescript
await page.route('**/api/stats*', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ stats: state.stats }),
  });
});
```

- [ ] **Step 13.3: Commit**

```bash
git add e2e/mocks.ts
git commit -m "test(e2e): mock /api/stats endpoint"
```

---

## Task 14: E2E coverage (stats.spec.ts)

**Files:**
- Create: `e2e/stats.spec.ts`

- [ ] **Step 14.1: Write the spec**

```typescript
// e2e/stats.spec.ts
import { test, expect } from '@playwright/test';
import { mockApi } from './mocks';

test.describe('Stats dashboard', () => {
  test('renders the five sections for a user with sessions', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.lifetime = { totalSeconds: 3 * 3600, totalSessions: 5 };
    state.stats.weekSeconds = 1800;
    state.stats.monthSeconds = 7200;
    state.stats.streak = { current: 3, longest: 7 };
    state.stats.rankings = [
      { rank: 1, habitId: 1, habitName: 'Guitar', totalSeconds: 3600 },
    ];
    // Minimal one-week grid so the heat map doesn't blow up the snapshot
    state.stats.heatmap = {
      weeks: [{
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-05-0${i + 1}`,
          seconds: i === 0 ? 600 : 0,
          bucket: (i === 0 ? 1 : 0) as 0 | 1,
          isFuture: false,
        })),
      }],
    };

    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
    await expect(page.getByText('Lifetime')).toBeVisible();
    await expect(page.getByText('This week')).toBeVisible();
    await expect(page.getByText('This month')).toBeVisible();
    await expect(page.getByText('Streaks')).toBeVisible();
    await expect(page.getByText('Last 12 months')).toBeVisible();
    await expect(page.getByText('Rankings')).toBeVisible();
    await expect(page.getByText('Guitar')).toBeVisible();
    await expect(page.getByText('3', { exact: false })).toBeVisible(); // current streak
  });

  test('/rankings redirects to /stats', async ({ page }) => {
    await mockApi(page);
    await page.goto('/rankings');
    await expect(page).toHaveURL(/\/stats$/);
  });

  test('renders heatmap empty-state copy when zero sessions', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.heatmap = {
      weeks: [{
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-05-0${i + 1}`,
          seconds: 0,
          bucket: 0 as const,
          isFuture: false,
        })),
      }],
    };
    await page.goto('/stats');
    await expect(
      page.getByText('Log your first session to start your heat map.'),
    ).toBeVisible();
  });

  test('Show all reveals rankings beyond top 5', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.rankings = Array.from({ length: 7 }, (_, i) => ({
      rank: i + 1,
      habitId: i + 1,
      habitName: `Skill ${i + 1}`,
      totalSeconds: (7 - i) * 600,
    }));
    state.stats.heatmap = { weeks: [] };
    await page.goto('/stats');

    await expect(page.getByText('Skill 1')).toBeVisible();
    await expect(page.getByText('Skill 5')).toBeVisible();
    await expect(page.getByText('Skill 6')).not.toBeVisible();

    await page.getByRole('button', { name: 'Show all (7)' }).click();
    await expect(page.getByText('Skill 6')).toBeVisible();
    await expect(page.getByText('Skill 7')).toBeVisible();
  });
});
```

- [ ] **Step 14.2: Run e2e**

Run: `npm run test:e2e -- stats.spec.ts`
Expected: 4 passing tests. If a test fails because Playwright workers ran the dev server cold, retry once.

- [ ] **Step 14.3: Commit**

```bash
git add e2e/stats.spec.ts
git commit -m "test(e2e): stats dashboard, redirect, empty state, show-all"
```

---

## Task 15: Cleanup obsolete files

**Files:**
- Delete: `src/components/RankingsView.tsx`
- Delete: `src/hooks/use-rankings.ts`
- Delete: `src/app/api/rankings/route.ts`
- Delete: `src/server/db/rankings.ts`

- [ ] **Step 15.1: Confirm no remaining imports**

Run: `grep -rn "RankingsView\|use-rankings\|getRankingsForUser\|/api/rankings" src e2e`
Expected: only matches inside the four files about to be deleted, the e2e mocks (which still mock `/api/rankings*` for backwards safety — leave it), and possibly the `queryKeys.rankings` entries (kept; harmless and may be used by external tests).

If any production code import remains, update it to use `useStats` / `Stats.rankings` instead before deleting.

- [ ] **Step 15.2: Delete the files**

```bash
git rm src/components/RankingsView.tsx src/hooks/use-rankings.ts src/app/api/rankings/route.ts src/server/db/rankings.ts
```

- [ ] **Step 15.3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 15.4: Run full test suite**

Run: `npm run test:unit && npm run test:e2e`
Expected: all green.

- [ ] **Step 15.5: Commit**

```bash
git commit -m "refactor(stats): remove obsolete rankings module"
```

---

## Task 16: README polish (optional but cheap)

**Files:**
- Modify: `README.md` line 29

- [ ] **Step 16.1: Update the `Rankings` bullet to match the new feature**

In the "What It Does" list, replace the line:

```
- **Rankings** — See your skills ranked by total hours logged. Calendar heat maps show your consistency
```

with:

```
- **Stats** — Dashboard with lifetime totals, weekly/monthly time, streaks, a year-long practice heat map, and rankings of your skills by total hours
```

- [ ] **Step 16.2: Commit**

```bash
git add README.md
git commit -m "docs: update README to describe the stats dashboard"
```

---

## Task 17: Open the PR

- [ ] **Step 17.1: Push branch**

Run: `git push -u origin stats-dashboard`

- [ ] **Step 17.2: Open PR**

```bash
gh pr create --title "feat: stats dashboard (rankings refactor)" --body "$(cat <<'EOF'
## Summary
- Refactor `/rankings` into `/stats` dashboard: lifetime totals, week/month time, streaks, yearly heat map, top-5 rankings
- New pure helpers in `src/lib/stats.ts` (streaks + buckets + grid) with full unit coverage
- One server query (`getStatsForUser`) + one endpoint (`/api/stats`) + one suspense hook (`useStats`)
- `/rankings` redirects to `/stats`; tab nav renamed

## Test plan
- [ ] `npm run test:unit` (pure helpers + existing suite)
- [ ] `npm run test:e2e -- stats.spec.ts` (renders, redirect, empty state, show-all)
- [ ] Manual: visit `/stats`, log a session, verify totals/streak/heatmap update
- [ ] Manual: visit `/rankings` → verify redirect

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

- **Spec coverage** — verified each spec section maps to tasks: nav (12), lifetime card (7), week/month (8), streaks (9), heatmap (6), rankings section (10), data layer (2-4), invalidations (5), tests (1, 14), cleanup (15-16).
- **Type consistency** — `Ranking` and `Stats` defined in `src/server/db/stats.ts` (Task 2); imported by `useStats` (4), `StatsView` (11), `RankingsSection` (10), and the e2e mock (13). `HeatmapGrid` defined in `src/lib/stats.ts` (Task 1); imported by Task 2 and Task 6.
- **No placeholders** — every code step shows full code; every command step has expected output or behavior.
