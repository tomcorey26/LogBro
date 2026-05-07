# Stats Dashboard — Design

## Goal

Refactor the standalone `/rankings` page into a `/stats` dashboard that surfaces the metrics LogBro already implies in its README and landing page (lifetime totals, streaks, calendar heat map) but never exposes. Rankings becomes one section of the new page.

## Non-goals

- New chart libraries — render heat map and stat cards with plain Tailwind + theme tokens.
- Per-skill heat map filtering, year selector, or 10,000-hour progress bar.
- Redesigning rankings list rows or other unrelated pages.
- Removing the `/api/rankings` endpoint (kept for now; remove in follow-up if no other consumer).

## Information architecture

- Tab nav `Rankings` → `Stats`. Route `/rankings` redirects to `/stats`.
- Single scrollable page at `/stats`, top to bottom:
  1. **Lifetime totals** — total hours logged, total sessions
  2. **This week / this month** — two stats side-by-side
  3. **Streaks** — current daily streak + longest daily streak
  4. **Yearly heat map** — 53-week × 7-day grid, last 365 days
  5. **Rankings** — top 5 habits by total time, with "Show all" button revealing the rest

## Data layer

### Server function

`src/server/db/stats.ts` — `getStatsForUser(userId)` returns:

```ts
type Stats = {
  lifetime: { totalSeconds: number; totalSessions: number };
  weekSeconds: number;     // last 7 days, today inclusive
  monthSeconds: number;    // last 30 days, today inclusive
  streak: { current: number; longest: number };
  heatmap: { date: string; seconds: number }[]; // YYYY-MM-DD, only days with sessions
  rankings: Ranking[];     // delegate to existing getRankingsForUser
};
```

Implementation:

- One Drizzle query aggregating `timeSessions` by local-date key for the user's last 371 days (53 weeks), joined to `habits` for ownership filter — yields rows of `{ dateKey, seconds }`. Reused for heat map, week/month totals, and streaks (current streak only — longest streak needs full history, see below).
- Longest streak: separate query selecting distinct `endTime` date keys across all sessions for the user (cheap; one row per session-day). Walked in JS to find the longest run.
- Lifetime totals: separate `count(*)` + `sum(durationSeconds)` query (covers all history, not just 365d).
- `weekSeconds` / `monthSeconds`: filter the 365-day aggregate in JS — no extra query.
- Streaks: walk the set of date keys in JS.
- Rankings: delegate to existing `getRankingsForUser`.

### API + hook

- `GET /api/stats` route returns the `Stats` payload.
- `src/hooks/use-stats.ts` exports `useStats(initialData?: Stats)` using `useSuspenseQuery` (matches existing `useRankings` pattern).
- Page server-renders with `initialData` so first paint has all numbers.

### Query keys

Add `queryKeys.stats.all` to `src/lib/query-keys.ts`. Mutations that already invalidate `rankings` and `habits` (history delete, manual log, timer stop) also invalidate `stats`.

## Streak computation

Daily streak = consecutive calendar days (local time) ending today with at least one session, across **all** habits.

Two pure functions on `Set<string>` of date keys:

1. **Current** (input: 53-week aggregate keys): walk back from today's key; if today missing, start from yesterday (so a streak isn't lost the moment the day rolls over before the user practices). Count consecutive present keys.
2. **Longest** (input: full-history distinct keys): sort all keys ascending, scan once tracking the longest run of consecutive days.

Edge cases:
- Empty history → `{ current: 0, longest: 0 }`.
- Today empty, yesterday present → current counts from yesterday.
- Today empty, yesterday empty → current = 0.

## Heat map widget

`src/components/stats/YearlyHeatmap.tsx`.

- Grid: 53 columns (weeks), 7 rows (Mon–Sun), Mon-start to match existing `CalendarView`.
- Window: 53 weeks ending with the current week. Earliest cell = Monday of (52 weeks before current week's Monday). Latest cell = Sunday of the current week. Trailing days after today are rendered as empty placeholders (no cell or `bg-transparent`).
- Cell input: total seconds for that date (0 if missing).
- Bucketing:

  | Bucket | Range | Token |
  |---|---|---|
  | 0 | 0 sec | `bg-muted` |
  | 1 | 1s – 15min | `bg-primary/20` |
  | 2 | 15min – 60min | `bg-primary/40` |
  | 3 | 60min – 3h | `bg-primary/70` |
  | 4 | > 3h | `bg-primary` |

- Cells: 12px square (`h-3 w-3`), 2px gap (`gap-0.5`), `rounded-sm`. Compact on mobile via responsive sizing if needed.
- Month labels along the top (rendered above the first column of each month).
- Weekday labels on the left for Mon / Wed / Fri only (compact).
- Interaction: tap or hover a cell shows tooltip — `"Mon, May 5 · 1h 23m"` or `"Wed, May 7 · No sessions"`. Hover via title attribute initially; can upgrade to a Radix Tooltip later if needed.
- Empty state (zero sessions in the user's entire history): render the empty grid (all bucket-0 cells) with copy below: `"Log your first session to start your heat map."`
- Horizontally scrollable on narrow viewports; legend (`Less` … 5 squares … `More`) below the grid.

## Stat cards

All cards are `Card` + `CardContent` (existing primitives) sitting in a vertical stack with `gap-4`.

- **LifetimeTotalsCard** — large value: `formatTime(totalSeconds)` (existing util). Sub-text: `"{totalSessions} sessions"`. Heading: `"Lifetime"`.
- **WeekMonthCard** — two-column grid: `"This week" : formatTime(weekSeconds)` and `"This month" : formatTime(monthSeconds)`.
- **StreaksCard** — two-column grid with flame icon: `"Current" : "{current} days"`, `"Longest" : "{longest} days"`. Subtle copy below if `current > 0`: `"Don't break the chain."`.

## Rankings section

Reuse existing `RankingsView` data shape but adapted:

- Default render: top 5 rows.
- If more than 5 exist: "Show all" button reveals the rest (client state, no extra fetch).
- Heading: `"Rankings"`. No `PageHeader` — the dashboard owns the page title.
- The standalone `/rankings/page.tsx` is replaced by a redirect to `/stats`. `RankingsView`'s `PageHeader` usage is removed since it now lives inside `StatsView`.

## Page composition

```
StatsView (client)
├── PageHeader title="Stats"
├── LifetimeTotalsCard
├── WeekMonthCard
├── StreaksCard
├── YearlyHeatmap
└── RankingsSection
```

`/stats/page.tsx` is a server component that awaits `getStatsForUser(userId)` and passes `initialStats` to `StatsView`.

## File changes

**New**
- `src/app/(app)/stats/page.tsx`
- `src/app/api/stats/route.ts`
- `src/server/db/stats.ts`
- `src/server/db/stats.test.ts` (streak + bucketing unit tests use the helper exports)
- `src/hooks/use-stats.ts`
- `src/components/StatsView.tsx`
- `src/components/stats/LifetimeTotalsCard.tsx`
- `src/components/stats/WeekMonthCard.tsx`
- `src/components/stats/StreaksCard.tsx`
- `src/components/stats/YearlyHeatmap.tsx`
- `src/components/stats/RankingsSection.tsx` (extracted from `RankingsView`, top-5 + show-all)

**Updated**
- `src/components/TabNav.tsx` — rename `Rankings` → `Stats`, href `/stats`.
- `src/lib/query-keys.ts` — add `stats: { all: ['stats'] as const }`.
- `src/hooks/use-history.ts`, `src/hooks/use-habits.ts`, any timer mutation hook — invalidate `queryKeys.stats.all` alongside existing invalidations.
- E2E tests referencing `/rankings` — update path or assert redirect.

**Replaced**
- `src/app/(app)/rankings/page.tsx` — becomes a `redirect('/stats')` server component (preserves any deep links).

**Possibly removed in follow-up (not this spec)**
- `src/components/RankingsView.tsx` — superseded by `RankingsSection`. Keep file alive only if `/api/rankings` stays for an external consumer.

## Testing

**Unit (Vitest)**
- `computeStreak` — empty history, today present, today missing+yesterday present, gaps, all-time longest.
- `bucketSeconds` — boundary values (0, 1, 900, 901, 3600, 3601, 10800, 10801).
- Heat-map padding — 365-day window correctly fills leading week.

**E2E (Playwright)**
- `/rankings` redirects to `/stats`.
- Stats page renders all five sections for a user with sessions.
- Empty-state copy renders for a brand-new user.
- Top 5 + "Show all" toggle works in rankings section.

## Trade-offs

- **One endpoint vs. per-widget endpoints** — chose one `/api/stats` for SSR simplicity. If any single widget becomes expensive, split it later.
- **Heat map without a chart lib** — keeps bundle small and matches the project's "Tailwind + tokens" aesthetic. If we later need axes or animations, swap in a lib.
- **Streaks computed in JS** — cheap (≤365 keys); no need for a recursive SQL CTE.

## Risks

- Existing tests or analytics that hard-code `/rankings` will break if the redirect is missed — mitigated by E2E coverage.
- `RankingsView` is currently exported from a top-level path; downstream imports must follow the rename to `RankingsSection`.

## Open questions (none — all resolved during brainstorming)

- ✅ Tab rename: `Rankings` → `Stats`
- ✅ Widgets: lifetime totals (no 10k progress), week/month, streaks, yearly heat map
- ✅ Heat map: aggregate, rolling 365 days
- ✅ Rankings placement: section on Stats page
- ✅ Buckets: 0 / ≤15m / ≤60m / ≤3h / >3h
- ✅ Top-N rankings cap: 5
- ✅ Heat map empty state: empty grid with copy
