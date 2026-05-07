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
