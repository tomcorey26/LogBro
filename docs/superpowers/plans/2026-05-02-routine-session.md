# Routine Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the active-routine feature: user starts a routine, runs sets with auto-advancing breaks, edits inline, then either Saves (writes one `timeSessions` row per completed set) or Discards (writes nothing).

**Architecture:** Server holds source of truth in three tables (`routineSessions`, `routineSessionSets`, extended `activeTimers`). Client mirrors via Zustand `routine-session-store`. `RoutineSync` component drives the tick + auto-advance, parallel to existing `TimerSync`. Saving promotes draft sets into `timeSessions` rows tagged `timerMode: 'routine'`.

**Tech Stack:** Next.js 16 App Router, Drizzle (SQLite/Turso), React Query v5, Zustand, Vitest, Playwright, shadcn/ui, Zod.

**Reference spec:** `docs/superpowers/specs/2026-05-02-routine-session-design.md`

**Codebase patterns (read once before starting):**
- API route tests: `src/app/api/timer/stop/route.test.ts`, `src/app/api/routines/route.test.ts` — mocked DB via `vi.hoisted` + `vi.mock`
- Server DB modules: `src/server/db/timers.ts` for transaction patterns; `src/server/db/routines.ts` for snapshot/JSON patterns
- Sync layer: `src/components/TimerSync.tsx` (1s tick + auto-stop)
- Persistent bar: `src/components/MiniTimerBar.tsx`
- Store: `src/stores/timer-store.ts`
- Block UI: `src/components/RoutineBlockCard.tsx` (readonly + editable modes)
- Layout mount point: `src/app/(app)/layout.tsx`
- API client + error: `src/lib/api.ts`
- Auth in routes: `getSessionUserId` from `@/lib/auth`

**Project rules from `AGENTS.md`:**
- Tests first. Mostly integration. No `useCallback`/`useMemo` (React Compiler).
- Database queries always inside a function in `src/server/db/`.
- Business logic outside DB functions where reasonable.
- Transactions for atomicity.
- Zod for input validation.
- Haptics where applicable (`useHaptics`).

---

## File Map

**New files:**

```
src/db/schema.ts                                         (modify)
src/lib/types.ts                                         (modify)
src/lib/routine-session.ts                               (new — pure helpers)
src/lib/routine-session.test.ts                          (new)
src/lib/query-keys.ts                                    (modify)

src/server/db/routine-sessions.ts                        (new)
src/server/db/timers.ts                                  (modify — add routine guard)
src/server/db/habits.ts                                  (modify — add habit-in-use check)

src/app/api/routines/[id]/start/route.ts                 (new)
src/app/api/routines/[id]/start/route.test.ts            (new)
src/app/api/routines/active/route.ts                     (new — GET)
src/app/api/routines/active/route.test.ts                (new)
src/app/api/routines/active/discard/route.ts             (new)
src/app/api/routines/active/discard/route.test.ts        (new)
src/app/api/routines/active/finish/route.ts              (new)
src/app/api/routines/active/finish/route.test.ts         (new)
src/app/api/routines/active/save/route.ts                (new)
src/app/api/routines/active/save/route.test.ts           (new)
src/app/api/routines/active/sets/[setRowId]/start/route.ts        (new)
src/app/api/routines/active/sets/[setRowId]/start/route.test.ts   (new)
src/app/api/routines/active/sets/[setRowId]/complete/route.ts     (new)
src/app/api/routines/active/sets/[setRowId]/complete/route.test.ts(new)
src/app/api/routines/active/sets/[setRowId]/route.ts              (new — PATCH)
src/app/api/routines/active/sets/[setRowId]/route.test.ts         (new)
src/app/api/routines/active/break/skip/route.ts          (new)
src/app/api/routines/active/break/skip/route.test.ts     (new)
src/app/api/routines/active/break/complete/route.ts      (new)
src/app/api/routines/active/break/complete/route.test.ts (new)

src/app/api/timer/start/route.ts                         (modify — guard)
src/app/api/habits/[id]/route.ts                         (modify — habit-in-use guard)

src/stores/routine-session-store.ts                      (new)
src/stores/routine-session-store.test.ts                 (new)

src/hooks/use-active-routine.ts                          (new)

src/components/RoutineSync.tsx                           (new)
src/components/StartNewRoutineConflictDialog.tsx         (new)
src/components/DiscardRoutineDialog.tsx                  (new)
src/components/NoSetsCompletedDialog.tsx                 (new)
src/components/RoutineActionBar.tsx                      (new)
src/components/RoutineActionBar.test.tsx                 (new)
src/components/ActiveRoutineSetRow.tsx                   (new)
src/components/ActiveRoutineSetRow.test.tsx              (new)
src/components/ActiveRoutineView.tsx                     (new)
src/components/ActiveRoutineView.test.tsx                (new)
src/components/RoutineSessionSummary.tsx                 (new)
src/components/RoutineBlockCard.tsx                      (modify — add 'active' mode)
src/components/RoutineDetailView.tsx                     (modify — Start Routine functional)
src/components/RoutinesView.tsx                          (modify — banner + Continue badge)
src/components/Dashboard.tsx                             (modify — banner + disabled buttons)
src/components/MiniTimerBar.tsx                          (modify — gate render)
src/components/HistoryView.tsx                           (modify — collapsible routines)

src/app/(app)/routines/[id]/active/page.tsx              (new)
src/app/(app)/layout.tsx                                 (modify — mount sync + bar)

drizzle/0006_<auto>.sql                                  (generated)

e2e/routine-session.spec.ts                              (new)
```

---

## Phase 1 — Schema, Types, Pure Helpers

### Task 1: Add schema for `routineSessions` and `routineSessionSets`; extend `activeTimers`

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Edit schema**

Add to `src/db/schema.ts` (preserving existing content):

```ts
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
// ...existing imports/tables unchanged...

export const routineSessions = sqliteTable('routine_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  routineNameSnapshot: text('routine_name_snapshot').notNull(),
  status: text('status').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('routine_sessions_one_active_per_user')
    .on(table.userId)
    .where(sql`status = 'active'`),
]);

export const routineSessionSets = sqliteTable('routine_session_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => routineSessions.id, { onDelete: 'cascade' }),
  blockIndex: integer('block_index').notNull(),
  setIndex: integer('set_index').notNull(),
  habitId: integer('habit_id').references(() => habits.id, { onDelete: 'set null' }),
  habitNameSnapshot: text('habit_name_snapshot').notNull(),
  notesSnapshot: text('notes_snapshot'),
  plannedDurationSeconds: integer('planned_duration_seconds').notNull(),
  plannedBreakSeconds: integer('planned_break_seconds').notNull(),
  actualDurationSeconds: integer('actual_duration_seconds'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('routine_session_sets_position').on(table.sessionId, table.blockIndex, table.setIndex),
]);
```

Replace the existing `activeTimers` definition with:

```ts
export const activeTimers = sqliteTable('active_timers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  targetDurationSeconds: integer('target_duration_seconds'),
  routineSessionSetId: integer('routine_session_set_id').references(() => routineSessionSets.id, { onDelete: 'cascade' }),
  phase: text('phase'), // 'set' | 'break' | null (null for individual habit timers)
});
```

Add relations:

```ts
export const routineSessionsRelations = relations(routineSessions, ({ one, many }) => ({
  user: one(users, { fields: [routineSessions.userId], references: [users.id] }),
  routine: one(routines, { fields: [routineSessions.routineId], references: [routines.id] }),
  sets: many(routineSessionSets),
}));

export const routineSessionSetsRelations = relations(routineSessionSets, ({ one }) => ({
  session: one(routineSessions, { fields: [routineSessionSets.sessionId], references: [routineSessions.id] }),
  habit: one(habits, { fields: [routineSessionSets.habitId], references: [habits.id] }),
}));
```

Add to `usersRelations`: `routineSessions: many(routineSessions)`.

- [ ] **Step 2: Generate migration**

Run: `npm run db:generate -- --name add-routine-sessions`
Expected: a new file `drizzle/0006_<auto>.sql` is created including `CREATE TABLE routine_sessions`, `CREATE TABLE routine_session_sets`, and the `ALTER TABLE active_timers` (or table-rebuild equivalent) for the two new columns + the partial unique index.

- [ ] **Step 3: Apply migration locally and confirm**

Run: `npm run db:migrate`
Expected: command succeeds; `local.db` now contains the new tables.

Sanity check: `sqlite3 local.db ".schema routine_sessions"` shows the new table.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(routine-session): schema for sessions, draft sets, timer extensions"
```

---

### Task 2: Add types for routine sessions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Append to types.ts**

```ts
export type RoutineSessionStatus = 'active' | 'completed';
export type RoutineSessionPhase = 'idle' | 'set-running' | 'break-running' | 'summary';
export type ActiveTimerPhase = 'set' | 'break';

export type RoutineSessionSet = {
  id: number;
  sessionId: number;
  blockIndex: number;
  setIndex: number;
  habitId: number | null;
  habitNameSnapshot: string;
  notesSnapshot: string | null;
  plannedDurationSeconds: number;
  plannedBreakSeconds: number;
  actualDurationSeconds: number | null;
  startedAt: string | null;       // ISO
  completedAt: string | null;     // ISO
};

export type RoutineSessionActiveTimer = {
  routineSessionSetId: number;
  phase: ActiveTimerPhase;
  startTime: string;              // ISO
  targetDurationSeconds: number;  // both phases have a target
};

export type ActiveRoutineSession = {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  status: RoutineSessionStatus;
  startedAt: string;              // ISO
  finishedAt: string | null;      // ISO
  sets: RoutineSessionSet[];
  activeTimer: RoutineSessionActiveTimer | null;
};

export type RoutineSessionSummary = {
  routineNameSnapshot: string;
  startedAt: string;
  finishedAt: string;
  totalElapsedSeconds: number;
  totalActiveSeconds: number;
  completedSetCount: number;
  byHabit: Array<{ habitName: string; sets: number; totalSeconds: number }>;
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(routine-session): add ActiveRoutineSession + summary types"
```

---

### Task 3: Add query keys

**Files:**
- Modify: `src/lib/query-keys.ts`

- [ ] **Step 1: Add `routineSession` key**

Replace the file with the existing keys plus:

```ts
  routineSession: {
    active: ['routineSession', 'active'] as const,
  },
```

(Insert before the closing `};`.)

- [ ] **Step 2: Commit**

```bash
git add src/lib/query-keys.ts
git commit -m "feat(routine-session): add routineSession.active query key"
```

---

### Task 4: Pure helpers — `computeNextPhase`

**Files:**
- Create: `src/lib/routine-session.ts`
- Test: `src/lib/routine-session.test.ts`

The function answers: given a session's sets and a just-completed set, what timer (if any) should be inserted next?

- [ ] **Step 1: Write failing test**

Create `src/lib/routine-session.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeNextPhase } from './routine-session';
import type { RoutineSessionSet } from './types';

function makeSet(partial: Partial<RoutineSessionSet> & { blockIndex: number; setIndex: number }): RoutineSessionSet {
  return {
    id: partial.blockIndex * 100 + partial.setIndex,
    sessionId: 1,
    habitId: 1,
    habitNameSnapshot: 'Guitar',
    notesSnapshot: null,
    plannedDurationSeconds: 60,
    plannedBreakSeconds: 30,
    actualDurationSeconds: null,
    startedAt: null,
    completedAt: null,
    ...partial,
  };
}

describe('computeNextPhase', () => {
  it('returns break when set has break and is not the final set', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'break', breakSeconds: 30, setRowId: sets[0].id });
  });

  it('returns idle when completed set has zero break', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0, plannedBreakSeconds: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'idle' });
  });

  it('returns idle when this is the final set of the final block', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 0, setIndex: 1 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[1].id });
    expect(result).toEqual({ phase: 'idle' });
  });

  it('returns break when last set of a non-final block has a break', () => {
    const sets = [
      makeSet({ blockIndex: 0, setIndex: 0 }),
      makeSet({ blockIndex: 1, setIndex: 0 }),
    ];
    const result = computeNextPhase({ sets, completedSetId: sets[0].id });
    expect(result).toEqual({ phase: 'break', breakSeconds: 30, setRowId: sets[0].id });
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: FAIL — "Cannot find module './routine-session'".

- [ ] **Step 3: Implement**

Create `src/lib/routine-session.ts`:

```ts
import type { RoutineSessionSet } from './types';

export type NextPhaseInput = {
  sets: RoutineSessionSet[];
  completedSetId: number;
};

export type NextPhaseResult =
  | { phase: 'idle' }
  | { phase: 'break'; breakSeconds: number; setRowId: number };

export function computeNextPhase({ sets, completedSetId }: NextPhaseInput): NextPhaseResult {
  const completed = sets.find((s) => s.id === completedSetId);
  if (!completed) return { phase: 'idle' };

  if (completed.plannedBreakSeconds === 0) return { phase: 'idle' };

  const sorted = [...sets].sort(
    (a, b) => a.blockIndex - b.blockIndex || a.setIndex - b.setIndex,
  );
  const last = sorted[sorted.length - 1];
  if (last.id === completedSetId) return { phase: 'idle' };

  return {
    phase: 'break',
    breakSeconds: completed.plannedBreakSeconds,
    setRowId: completed.id,
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routine-session.ts src/lib/routine-session.test.ts
git commit -m "feat(routine-session): computeNextPhase helper"
```

---

### Task 5: Pure helpers — `computeReplayForward`

Given an active timer and `now`, decide whether the timer has already elapsed and if so what action to take. Caller loops until `{ action: 'stable' }`.

**Files:**
- Modify: `src/lib/routine-session.ts`
- Modify: `src/lib/routine-session.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/routine-session.test.ts`:

```ts
import { computeReplayForward } from './routine-session';
import type { RoutineSessionActiveTimer } from './types';

function makeTimer(p: Partial<RoutineSessionActiveTimer> = {}): RoutineSessionActiveTimer {
  return {
    routineSessionSetId: 1,
    phase: 'set',
    startTime: '2026-05-02T00:00:00.000Z',
    targetDurationSeconds: 60,
    ...p,
  };
}

describe('computeReplayForward', () => {
  it('returns stable when no timer', () => {
    expect(computeReplayForward(null, new Date())).toEqual({ action: 'stable' });
  });

  it('returns stable when timer has not elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 30_000);
    expect(computeReplayForward(makeTimer({ targetDurationSeconds: 60 }), now)).toEqual({ action: 'stable' });
  });

  it('returns complete-set when set timer elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 120_000);
    expect(computeReplayForward(makeTimer({ phase: 'set', targetDurationSeconds: 60 }), now)).toEqual({
      action: 'complete-set',
      setRowId: 1,
    });
  });

  it('returns complete-break when break timer elapsed', () => {
    const start = new Date('2026-05-02T00:00:00.000Z');
    const now = new Date(start.getTime() + 120_000);
    expect(computeReplayForward(makeTimer({ phase: 'break', targetDurationSeconds: 60 }), now)).toEqual({
      action: 'complete-break',
    });
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: FAIL — "Cannot find module export computeReplayForward".

- [ ] **Step 3: Implement**

Append to `src/lib/routine-session.ts`:

```ts
import type { RoutineSessionActiveTimer } from './types';

export type ReplayAction =
  | { action: 'stable' }
  | { action: 'complete-set'; setRowId: number }
  | { action: 'complete-break' };

export function computeReplayForward(
  timer: RoutineSessionActiveTimer | null,
  now: Date,
): ReplayAction {
  if (!timer) return { action: 'stable' };
  const elapsed = (now.getTime() - new Date(timer.startTime).getTime()) / 1000;
  if (elapsed < timer.targetDurationSeconds) return { action: 'stable' };
  if (timer.phase === 'set') return { action: 'complete-set', setRowId: timer.routineSessionSetId };
  return { action: 'complete-break' };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routine-session.ts src/lib/routine-session.test.ts
git commit -m "feat(routine-session): computeReplayForward helper"
```

---

### Task 6: Pure helpers — `computeSummary`

Aggregates totals for the Finish summary screen.

**Files:**
- Modify: `src/lib/routine-session.ts`
- Modify: `src/lib/routine-session.test.ts`

- [ ] **Step 1: Write failing tests**

Append:

```ts
import { computeSummary } from './routine-session';

describe('computeSummary', () => {
  it('aggregates completed sets only', () => {
    const sets: RoutineSessionSet[] = [
      makeSet({ blockIndex: 0, setIndex: 0, habitNameSnapshot: 'Guitar', actualDurationSeconds: 60 }),
      makeSet({ blockIndex: 0, setIndex: 1, habitNameSnapshot: 'Guitar', actualDurationSeconds: 30 }),
      makeSet({ blockIndex: 1, setIndex: 0, habitNameSnapshot: 'Piano', actualDurationSeconds: 0 }),
      makeSet({ blockIndex: 1, setIndex: 1, habitNameSnapshot: 'Piano', actualDurationSeconds: null }),
    ];
    const startedAt = '2026-05-02T00:00:00.000Z';
    const finishedAt = '2026-05-02T00:10:00.000Z';
    const result = computeSummary({
      routineNameSnapshot: 'Morning',
      sets,
      startedAt,
      finishedAt,
    });
    expect(result.totalElapsedSeconds).toBe(600);
    expect(result.totalActiveSeconds).toBe(90);
    expect(result.completedSetCount).toBe(2);
    expect(result.byHabit).toEqual([
      { habitName: 'Guitar', sets: 2, totalSeconds: 90 },
    ]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: FAIL — `computeSummary is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/routine-session.ts`:

```ts
import type { RoutineSessionSummary } from './types';

export function computeSummary(input: {
  routineNameSnapshot: string;
  sets: RoutineSessionSet[];
  startedAt: string;
  finishedAt: string;
}): RoutineSessionSummary {
  const completed = input.sets.filter(
    (s) => (s.actualDurationSeconds ?? 0) > 0,
  );
  const totalActiveSeconds = completed.reduce(
    (sum, s) => sum + (s.actualDurationSeconds ?? 0),
    0,
  );
  const totalElapsedSeconds = Math.max(
    0,
    Math.floor(
      (new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime()) / 1000,
    ),
  );
  const byHabitMap = new Map<string, { sets: number; totalSeconds: number }>();
  for (const s of completed) {
    const e = byHabitMap.get(s.habitNameSnapshot) ?? { sets: 0, totalSeconds: 0 };
    e.sets += 1;
    e.totalSeconds += s.actualDurationSeconds ?? 0;
    byHabitMap.set(s.habitNameSnapshot, e);
  }
  return {
    routineNameSnapshot: input.routineNameSnapshot,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    totalElapsedSeconds,
    totalActiveSeconds,
    completedSetCount: completed.length,
    byHabit: Array.from(byHabitMap, ([habitName, v]) => ({ habitName, ...v })),
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routine-session.ts src/lib/routine-session.test.ts
git commit -m "feat(routine-session): computeSummary helper"
```

---

### Task 7: Pure helpers — `snapshotRoutineToSets`

Converts a Routine (template) into a flat list of session-set inserts at start time.

**Files:**
- Modify: `src/lib/routine-session.ts`
- Modify: `src/lib/routine-session.test.ts`

- [ ] **Step 1: Write failing test**

Append:

```ts
import { snapshotRoutineToSets } from './routine-session';
import type { Routine } from './types';

describe('snapshotRoutineToSets', () => {
  it('flattens routine blocks into ordered session sets', () => {
    const routine: Routine = {
      id: 1,
      name: 'Morning',
      blocks: [
        {
          id: 10,
          habitId: 100,
          habitName: 'Guitar',
          sortOrder: 0,
          notes: 'warm up',
          sets: [
            { durationSeconds: 60, breakSeconds: 30 },
            { durationSeconds: 90, breakSeconds: 0 },
          ],
        },
        {
          id: 11,
          habitId: 200,
          habitName: 'Piano',
          sortOrder: 1,
          notes: null,
          sets: [{ durationSeconds: 120, breakSeconds: 60 }],
        },
      ],
      createdAt: '',
      updatedAt: '',
    };
    const result = snapshotRoutineToSets(routine);
    expect(result).toEqual([
      { blockIndex: 0, setIndex: 0, habitId: 100, habitNameSnapshot: 'Guitar', notesSnapshot: 'warm up', plannedDurationSeconds: 60, plannedBreakSeconds: 30 },
      { blockIndex: 0, setIndex: 1, habitId: 100, habitNameSnapshot: 'Guitar', notesSnapshot: 'warm up', plannedDurationSeconds: 90, plannedBreakSeconds: 0 },
      { blockIndex: 1, setIndex: 0, habitId: 200, habitNameSnapshot: 'Piano', notesSnapshot: null, plannedDurationSeconds: 120, plannedBreakSeconds: 60 },
    ]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Append to `src/lib/routine-session.ts`:

```ts
import type { Routine } from './types';

export type SnapshotInsert = {
  blockIndex: number;
  setIndex: number;
  habitId: number;
  habitNameSnapshot: string;
  notesSnapshot: string | null;
  plannedDurationSeconds: number;
  plannedBreakSeconds: number;
};

export function snapshotRoutineToSets(routine: Routine): SnapshotInsert[] {
  const sortedBlocks = [...routine.blocks].sort((a, b) => a.sortOrder - b.sortOrder);
  return sortedBlocks.flatMap((block, blockIndex) =>
    block.sets.map((set, setIndex) => ({
      blockIndex,
      setIndex,
      habitId: block.habitId,
      habitNameSnapshot: block.habitName,
      notesSnapshot: block.notes,
      plannedDurationSeconds: set.durationSeconds,
      plannedBreakSeconds: set.breakSeconds,
    })),
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:unit -- src/lib/routine-session.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/routine-session.ts src/lib/routine-session.test.ts
git commit -m "feat(routine-session): snapshotRoutineToSets helper"
```

---

## Phase 2 — Server DB Module

### Task 8: Skeleton `src/server/db/routine-sessions.ts`

**Files:**
- Create: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Create file with stubs**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  routineSessions,
  routineSessionSets,
  activeTimers,
  habits,
  timeSessions,
  routines,
} from '@/db/schema';
import type {
  ActiveRoutineSession,
  RoutineSessionSet,
  RoutineSessionActiveTimer,
} from '@/lib/types';
import { snapshotRoutineToSets, computeNextPhase, computeSummary } from '@/lib/routine-session';
import { getRoutineById } from '@/server/db/routines';

function rowToSet(row: typeof routineSessionSets.$inferSelect): RoutineSessionSet {
  return {
    id: row.id,
    sessionId: row.sessionId,
    blockIndex: row.blockIndex,
    setIndex: row.setIndex,
    habitId: row.habitId,
    habitNameSnapshot: row.habitNameSnapshot,
    notesSnapshot: row.notesSnapshot,
    plannedDurationSeconds: row.plannedDurationSeconds,
    plannedBreakSeconds: row.plannedBreakSeconds,
    actualDurationSeconds: row.actualDurationSeconds,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function rowToTimer(
  row: typeof activeTimers.$inferSelect | undefined,
): RoutineSessionActiveTimer | null {
  if (!row || !row.routineSessionSetId || !row.phase || row.targetDurationSeconds === null) {
    return null;
  }
  return {
    routineSessionSetId: row.routineSessionSetId,
    phase: row.phase as 'set' | 'break',
    startTime: row.startTime.toISOString(),
    targetDurationSeconds: row.targetDurationSeconds,
  };
}

// Stubs — implemented in subsequent tasks:
export async function startRoutineSessionForUser(_userId: number, _routineId: number) {
  throw new Error('not implemented');
}
export async function getActiveRoutineSessionForUser(_userId: number): Promise<ActiveRoutineSession | null> {
  throw new Error('not implemented');
}
export async function discardActiveRoutineSessionForUser(_userId: number) {
  throw new Error('not implemented');
}
export async function buildSummaryForUser(_userId: number) {
  throw new Error('not implemented');
}
export async function saveActiveRoutineSessionForUser(_userId: number) {
  throw new Error('not implemented');
}
export async function startSetForUser(_userId: number, _setRowId: number) {
  throw new Error('not implemented');
}
export async function completeSetForUser(_userId: number, _setRowId: number, _endedAt?: Date) {
  throw new Error('not implemented');
}
export async function patchSetForUser(_userId: number, _setRowId: number, _patch: { plannedDurationSeconds?: number; plannedBreakSeconds?: number; actualDurationSeconds?: number }) {
  throw new Error('not implemented');
}
export async function skipBreakForUser(_userId: number) {
  throw new Error('not implemented');
}
export async function completeBreakForUser(_userId: number) {
  throw new Error('not implemented');
}
export async function userHasActiveRoutineSession(userId: number): Promise<boolean> {
  const row = await db
    .select({ id: routineSessions.id })
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  return !!row;
}
export async function habitIsInActiveRoutineSession(userId: number, habitId: number): Promise<boolean> {
  const row = await db
    .select({ id: routineSessionSets.id })
    .from(routineSessionSets)
    .innerJoin(routineSessions, eq(routineSessions.id, routineSessionSets.sessionId))
    .where(
      and(
        eq(routineSessions.userId, userId),
        eq(routineSessions.status, 'active'),
        eq(routineSessionSets.habitId, habitId),
      ),
    )
    .get();
  return !!row;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): db module skeleton"
```

---

### Task 9: Implement `getActiveRoutineSessionForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function getActiveRoutineSessionForUser(
  userId: number,
): Promise<ActiveRoutineSession | null> {
  const session = await db
    .select()
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  if (!session) return null;

  const setRows = await db
    .select()
    .from(routineSessionSets)
    .where(eq(routineSessionSets.sessionId, session.id));

  const sortedSets = setRows
    .map(rowToSet)
    .sort((a, b) => a.blockIndex - b.blockIndex || a.setIndex - b.setIndex);

  const timerRow = await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.userId, userId))
    .get();

  return {
    id: session.id,
    routineId: session.routineId,
    routineNameSnapshot: session.routineNameSnapshot,
    status: session.status as 'active' | 'completed',
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    sets: sortedSets,
    activeTimer: rowToTimer(timerRow),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): getActiveRoutineSessionForUser"
```

---

### Task 10: Implement `startRoutineSessionForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function startRoutineSessionForUser(
  userId: number,
  routineId: number,
): Promise<ActiveRoutineSession | { conflict: 'active_timer_exists' } | null> {
  const routine = await getRoutineById(routineId, userId);
  if (!routine) return null;

  return db.transaction(async (tx) => {
    const existingTimer = await tx
      .select({ id: activeTimers.id })
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();
    if (existingTimer) return { conflict: 'active_timer_exists' as const };

    const existingSession = await tx
      .select({ id: routineSessions.id })
      .from(routineSessions)
      .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
      .get();
    if (existingSession) return { conflict: 'active_timer_exists' as const };

    const now = new Date();
    const [session] = await tx
      .insert(routineSessions)
      .values({
        userId,
        routineId: routine.id,
        routineNameSnapshot: routine.name,
        status: 'active',
        startedAt: now,
      })
      .returning();

    const inserts = snapshotRoutineToSets(routine).map((s) => ({
      sessionId: session.id,
      ...s,
    }));
    if (inserts.length > 0) {
      await tx.insert(routineSessionSets).values(inserts);
    }

    return await reloadActiveSession(tx, userId);
  });
}

async function reloadActiveSession(
  tx: typeof db,
  userId: number,
): Promise<ActiveRoutineSession | null> {
  // Same body as getActiveRoutineSessionForUser but using `tx`. Inline-duplicated
  // to avoid a public signature change on the existing helper.
  const session = await tx
    .select()
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  if (!session) return null;
  const setRows = await tx
    .select()
    .from(routineSessionSets)
    .where(eq(routineSessionSets.sessionId, session.id));
  const sortedSets = setRows
    .map(rowToSet)
    .sort((a, b) => a.blockIndex - b.blockIndex || a.setIndex - b.setIndex);
  const timerRow = await tx
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.userId, userId))
    .get();
  return {
    id: session.id,
    routineId: session.routineId,
    routineNameSnapshot: session.routineNameSnapshot,
    status: session.status as 'active' | 'completed',
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    sets: sortedSets,
    activeTimer: rowToTimer(timerRow),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): startRoutineSessionForUser snapshots routine"
```

---

### Task 11: Implement `discardActiveRoutineSessionForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function discardActiveRoutineSessionForUser(
  userId: number,
): Promise<{ discarded: boolean }> {
  return db.transaction(async (tx) => {
    const session = await tx
      .select({ id: routineSessions.id })
      .from(routineSessions)
      .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
      .get();
    if (!session) return { discarded: false };

    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
    await tx.delete(routineSessions).where(eq(routineSessions.id, session.id));
    return { discarded: true };
  });
}
```

The cascade in the schema deletes `routineSessionSets`. The activeTimers `routineSessionSetId` cascade also fires, but we delete the timer first to be explicit.

- [ ] **Step 2: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): discardActiveRoutineSessionForUser"
```

---

### Task 12: Implement `startSetForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function startSetForUser(
  userId: number,
  setRowId: number,
): Promise<ActiveRoutineSession | { conflict: 'set_already_running' } | null> {
  return db.transaction(async (tx) => {
    const set = await tx
      .select({
        id: routineSessionSets.id,
        sessionId: routineSessionSets.sessionId,
        habitId: routineSessionSets.habitId,
        plannedDurationSeconds: routineSessionSets.plannedDurationSeconds,
        startedAt: routineSessionSets.startedAt,
      })
      .from(routineSessionSets)
      .innerJoin(routineSessions, eq(routineSessions.id, routineSessionSets.sessionId))
      .where(
        and(
          eq(routineSessionSets.id, setRowId),
          eq(routineSessions.userId, userId),
          eq(routineSessions.status, 'active'),
        ),
      )
      .get();
    if (!set) return null;
    if (set.startedAt) return { conflict: 'set_already_running' as const };

    const existingTimer = await tx
      .select({ id: activeTimers.id })
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();
    if (existingTimer) return { conflict: 'set_already_running' as const };

    if (!set.habitId) return null; // habit deleted out from under us

    const now = new Date();
    await tx
      .update(routineSessionSets)
      .set({ startedAt: now })
      .where(eq(routineSessionSets.id, set.id));

    await tx.insert(activeTimers).values({
      habitId: set.habitId,
      userId,
      startTime: now,
      targetDurationSeconds: set.plannedDurationSeconds,
      routineSessionSetId: set.id,
      phase: 'set',
    });

    return await reloadActiveSession(tx, userId);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): startSetForUser inserts set timer"
```

---

### Task 13: Implement `completeSetForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function completeSetForUser(
  userId: number,
  setRowId: number,
  endedAt?: Date,
): Promise<ActiveRoutineSession | null> {
  return db.transaction(async (tx) => {
    const timerRow = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();

    const set = await tx
      .select()
      .from(routineSessionSets)
      .innerJoin(routineSessions, eq(routineSessions.id, routineSessionSets.sessionId))
      .where(
        and(
          eq(routineSessionSets.id, setRowId),
          eq(routineSessions.userId, userId),
          eq(routineSessions.status, 'active'),
        ),
      )
      .get();
    if (!set) return null;
    const setRow = set.routine_session_sets;

    const now = endedAt ?? new Date();

    // Compute actual duration: prefer the timer for cleanest math; fall back to set.startedAt.
    const startedAt = setRow.startedAt ?? timerRow?.startTime ?? now;
    const elapsed = Math.max(0, Math.ceil((now.getTime() - startedAt.getTime()) / 1000));
    const actualDurationSeconds = Math.min(elapsed, setRow.plannedDurationSeconds);

    await tx
      .update(routineSessionSets)
      .set({ actualDurationSeconds, completedAt: now })
      .where(eq(routineSessionSets.id, setRow.id));

    if (timerRow && timerRow.routineSessionSetId === setRow.id) {
      await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
    }

    // Decide next phase using pure helper
    const allSetRows = await tx
      .select()
      .from(routineSessionSets)
      .where(eq(routineSessionSets.sessionId, setRow.sessionId));
    const next = computeNextPhase({
      sets: allSetRows.map(rowToSet),
      completedSetId: setRow.id,
    });

    if (next.phase === 'break' && setRow.habitId) {
      await tx.insert(activeTimers).values({
        habitId: setRow.habitId,
        userId,
        startTime: now,
        targetDurationSeconds: next.breakSeconds,
        routineSessionSetId: setRow.id,
        phase: 'break',
      });
    }

    return await reloadActiveSession(tx, userId);
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `set.routine_session_sets` shape complains, replace the inner-join select with a flat shape per Drizzle's join behavior — see `getRoutineById` in `src/server/db/routines.ts:99` for an example pattern; otherwise this shape works.)

- [ ] **Step 3: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): completeSetForUser writes actual + advances phase"
```

---

### Task 14: Implement `skipBreakForUser` and `completeBreakForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stubs**

```ts
export async function skipBreakForUser(userId: number): Promise<ActiveRoutineSession | null> {
  return db.transaction(async (tx) => {
    const timer = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();
    if (!timer || timer.phase !== 'break') return null;
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
    return await reloadActiveSession(tx, userId);
  });
}

export const completeBreakForUser = skipBreakForUser; // identical semantics
```

- [ ] **Step 2: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): skip/complete break clears break timer"
```

---

### Task 15: Implement `patchSetForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stub**

```ts
export async function patchSetForUser(
  userId: number,
  setRowId: number,
  patch: {
    plannedDurationSeconds?: number;
    plannedBreakSeconds?: number;
    actualDurationSeconds?: number;
  },
): Promise<ActiveRoutineSession | { conflict: 'set_locked' } | null> {
  return db.transaction(async (tx) => {
    const row = await tx
      .select()
      .from(routineSessionSets)
      .innerJoin(routineSessions, eq(routineSessions.id, routineSessionSets.sessionId))
      .where(
        and(
          eq(routineSessionSets.id, setRowId),
          eq(routineSessions.userId, userId),
          eq(routineSessions.status, 'active'),
        ),
      )
      .get();
    if (!row) return null;
    const setRow = row.routine_session_sets;

    const isUpcoming = !setRow.startedAt;
    const isCompleted = !!setRow.completedAt;
    const isRunning = !!setRow.startedAt && !setRow.completedAt;

    const update: Partial<typeof routineSessionSets.$inferInsert> = {};
    if (patch.plannedDurationSeconds !== undefined) {
      if (!isUpcoming) return { conflict: 'set_locked' as const };
      update.plannedDurationSeconds = patch.plannedDurationSeconds;
    }
    if (patch.plannedBreakSeconds !== undefined) {
      if (!isUpcoming) return { conflict: 'set_locked' as const };
      update.plannedBreakSeconds = patch.plannedBreakSeconds;
    }
    if (patch.actualDurationSeconds !== undefined) {
      if (!isCompleted || isRunning) return { conflict: 'set_locked' as const };
      update.actualDurationSeconds = patch.actualDurationSeconds;
    }

    if (Object.keys(update).length === 0) return await reloadActiveSession(tx, userId);

    await tx
      .update(routineSessionSets)
      .set(update)
      .where(eq(routineSessionSets.id, setRow.id));

    return await reloadActiveSession(tx, userId);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): patchSetForUser with upcoming/completed guards"
```

---

### Task 16: Implement `buildSummaryForUser` and `saveActiveRoutineSessionForUser`

**Files:**
- Modify: `src/server/db/routine-sessions.ts`

- [ ] **Step 1: Replace stubs**

```ts
export async function buildSummaryForUser(
  userId: number,
): Promise<
  | { ok: true; summary: import('@/lib/types').RoutineSessionSummary }
  | { ok: false; reason: 'no_active_session' | 'no_completed_sets' }
> {
  const session = await db
    .select()
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  if (!session) return { ok: false, reason: 'no_active_session' };

  const setRows = await db
    .select()
    .from(routineSessionSets)
    .where(eq(routineSessionSets.sessionId, session.id));

  const sets = setRows.map(rowToSet);
  const completed = sets.filter((s) => (s.actualDurationSeconds ?? 0) > 0);
  if (completed.length === 0) return { ok: false, reason: 'no_completed_sets' };

  const summary = computeSummary({
    routineNameSnapshot: session.routineNameSnapshot,
    sets,
    startedAt: session.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  });
  return { ok: true, summary };
}

export async function saveActiveRoutineSessionForUser(
  userId: number,
): Promise<
  | { ok: true; sessionId: number }
  | { ok: false; reason: 'no_active_session' | 'no_completed_sets' }
> {
  return db.transaction(async (tx) => {
    const session = await tx
      .select()
      .from(routineSessions)
      .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
      .get();
    if (!session) return { ok: false, reason: 'no_active_session' as const };

    const setRows = await tx
      .select()
      .from(routineSessionSets)
      .where(eq(routineSessionSets.sessionId, session.id));
    const completed = setRows.filter((r) => (r.actualDurationSeconds ?? 0) > 0 && r.habitId !== null);
    if (completed.length === 0) return { ok: false, reason: 'no_completed_sets' as const };

    const now = new Date();
    for (const r of completed) {
      const start = r.startedAt ?? new Date(now.getTime() - (r.actualDurationSeconds ?? 0) * 1000);
      const end = new Date(start.getTime() + (r.actualDurationSeconds ?? 0) * 1000);
      await tx.insert(timeSessions).values({
        habitId: r.habitId!,
        userId,
        startTime: start,
        endTime: end,
        durationSeconds: r.actualDurationSeconds!,
        timerMode: 'routine',
      });
    }

    await tx
      .update(routineSessions)
      .set({ status: 'completed', finishedAt: now })
      .where(eq(routineSessions.id, session.id));

    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));

    return { ok: true, sessionId: session.id };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/server/db/routine-sessions.ts
git commit -m "feat(routine-session): finish summary + save (transactional)"
```

---

### Task 17: Add guard to `startTimerForUser`

**Files:**
- Modify: `src/server/db/timers.ts`

- [ ] **Step 1: Edit `startTimerForUser`**

Locate `src/server/db/timers.ts:14`. Inside the function, immediately before reading `existingTimer`, add:

```ts
    const activeRoutine = await tx
      .select({ id: routineSessions.id })
      .from(routineSessions)
      .where(
        and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')),
      )
      .get();
    if (activeRoutine) return { conflict: 'routine_session_active' as const };
```

Update the import at the top:

```ts
import { activeTimers, habits, timeSessions, routineSessions } from "@/db/schema";
```

Update the function return type to include the conflict shape — change the existing `return { ... }` to remain a happy-path return; the conflict short-circuits with `{ conflict: ... }`.

- [ ] **Step 2: Update caller `src/app/api/timer/start/route.ts`**

Replace the existing handler tail:

```ts
  const timer = await startTimerForUser({
    userId,
    habitId,
    targetDurationSeconds,
    startTime: startTime ? new Date(startTime) : undefined,
  });
  if (!timer) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
  if ('conflict' in timer)
    return NextResponse.json(
      { error: 'Routine in progress', code: 'routine_session_active' },
      { status: 409 },
    );
  return NextResponse.json(timer);
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Update existing test**

In `src/app/api/timer/start/route.test.ts` (read it first to find the right insertion point), add this case:

```ts
  it('returns 409 when a routine session is active', async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockStartTimerForUser.mockResolvedValue({ conflict: 'routine_session_active' });
    // ... fire POST, expect status 409, expect body.code === 'routine_session_active'
  });
```

(Match the existing test file's mocking pattern; the file already follows the `vi.mock('@/server/db/timers', ...)` shape — extend it.)

- [ ] **Step 5: Run tests**

Run: `npm run test:unit -- src/app/api/timer/start`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/timers.ts src/app/api/timer/start/route.ts src/app/api/timer/start/route.test.ts
git commit -m "feat(routine-session): guard individual timer start during active routine"
```

---

### Task 18: Add guard to habit deletion

**Files:**
- Modify: `src/app/api/habits/[id]/route.ts` (or wherever the DELETE handler lives)
- Modify: `src/server/db/habits.ts`

- [ ] **Step 1: Inspect existing handler**

Read `src/app/api/habits/[id]/route.ts` to confirm shape. Reference the `habitIsInActiveRoutineSession` helper added in Task 8.

- [ ] **Step 2: Add 409 branch**

Before calling the existing delete-habit DB function, call `habitIsInActiveRoutineSession(userId, habitId)`. If true:

```ts
return NextResponse.json(
  { error: 'Habit is in use by your active routine', code: 'habit_in_use' },
  { status: 409 },
);
```

- [ ] **Step 3: Update test**

In `src/app/api/habits/[id]/route.test.ts`, add a 409 case mocking `habitIsInActiveRoutineSession` to return true.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- src/app/api/habits/\\[id\\]`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/habits/\[id\]/route.ts src/app/api/habits/\[id\]/route.test.ts
git commit -m "feat(routine-session): block habit deletion while in use by active session"
```

---

## Phase 3 — API Routes

For all API route tests in this phase, follow the existing pattern: `vi.hoisted` for mock factories + `vi.mock` for `@/lib/auth` and `@/server/db/routine-sessions`. See `src/app/api/timer/stop/route.test.ts` for the canonical shape.

### Task 19: `POST /api/routines/[id]/start`

**Files:**
- Create: `src/app/api/routines/[id]/start/route.ts`
- Test: `src/app/api/routines/[id]/start/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, startRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  startRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ startRoutineSessionForUser }));

import { POST } from './route';

function req() {
  return new Request('http://localhost/api/routines/1/start', { method: 'POST' });
}

describe('POST /api/routines/[id]/start', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when routine not found', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue(null);
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 409 with code when conflict', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ conflict: 'active_timer_exists' });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('active_timer_exists');
  });

  it('returns 201 with session', async () => {
    getSessionUserId.mockResolvedValue(1);
    startRoutineSessionForUser.mockResolvedValue({ id: 99, sets: [] });
    const res = await POST(req(), { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.session.id).toBe(99);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:unit -- src/app/api/routines/\\[id\\]/start`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { startRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const routineId = Number(id);
  if (!Number.isInteger(routineId) || routineId <= 0)
    return NextResponse.json({ error: 'Invalid routine id' }, { status: 400 });

  const result = await startRoutineSessionForUser(userId, routineId);
  if (!result) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
  if ('conflict' in result)
    return NextResponse.json(
      { error: 'Active timer exists', code: result.conflict },
      { status: 409 },
    );

  return NextResponse.json({ session: result }, { status: 201 });
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:unit -- src/app/api/routines/\\[id\\]/start`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/routines/\[id\]/start/
git commit -m "feat(routine-session): POST /api/routines/[id]/start"
```

---

### Task 20: `GET /api/routines/active`

**Files:**
- Create: `src/app/api/routines/active/route.ts`
- Test: `src/app/api/routines/active/route.test.ts`

- [ ] **Step 1: Test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUserId, getActiveRoutineSessionForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getActiveRoutineSessionForUser: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getSessionUserId }));
vi.mock('@/server/db/routine-sessions', () => ({ getActiveRoutineSessionForUser }));

import { GET } from './route';

describe('GET /api/routines/active', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without auth', async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns null when no active session', async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveRoutineSessionForUser.mockResolvedValue(null);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.session).toBeNull();
  });

  it('returns session when present', async () => {
    getSessionUserId.mockResolvedValue(1);
    getActiveRoutineSessionForUser.mockResolvedValue({ id: 7, sets: [] });
    const res = await GET();
    const body = await res.json();
    expect(body.session.id).toBe(7);
  });
});
```

- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getActiveRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getActiveRoutineSessionForUser(userId);
  return NextResponse.json({ session });
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit**

```bash
git add src/app/api/routines/active/route.ts src/app/api/routines/active/route.test.ts
git commit -m "feat(routine-session): GET /api/routines/active"
```

---

### Task 21: `POST /api/routines/active/discard`

**Files:**
- Create: `src/app/api/routines/active/discard/route.ts`
- Test: same dir

- [ ] **Step 1: Test (3 cases)**

Mock `discardActiveRoutineSessionForUser`. Tests: 401, 200 with `{ discarded: true }`, 200 with `{ discarded: false }` (idempotent — still 200).

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { discardActiveRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await discardActiveRoutineSessionForUser(userId);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/discard/
git commit -m "feat(routine-session): POST /api/routines/active/discard"
```

---

### Task 22: `POST /api/routines/active/finish`

**Files:**
- Create: `src/app/api/routines/active/finish/route.ts`
- Test: same dir

- [ ] **Step 1: Test (4 cases)** — 401; 404 `no_active_session`; 409 `no_completed_sets`; 200 with summary.

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { buildSummaryForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await buildSummaryForUser(userId);
  if (!result.ok && result.reason === 'no_active_session')
    return NextResponse.json({ error: 'No active session', code: result.reason }, { status: 404 });
  if (!result.ok && result.reason === 'no_completed_sets')
    return NextResponse.json({ error: 'No completed sets', code: result.reason }, { status: 409 });
  return NextResponse.json({ summary: (result as Extract<typeof result, { ok: true }>).summary });
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/finish/
git commit -m "feat(routine-session): POST /api/routines/active/finish"
```

---

### Task 23: `POST /api/routines/active/save`

**Files:**
- Create: `src/app/api/routines/active/save/route.ts`
- Test: same dir

- [ ] **Step 1: Test** — 401; 404 no active; 409 no completed; 200 with `{ sessionId }`.

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { saveActiveRoutineSessionForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await saveActiveRoutineSessionForUser(userId);
  if (!result.ok && result.reason === 'no_active_session')
    return NextResponse.json({ error: 'No active session', code: result.reason }, { status: 404 });
  if (!result.ok && result.reason === 'no_completed_sets')
    return NextResponse.json({ error: 'No completed sets', code: result.reason }, { status: 409 });
  return NextResponse.json({ sessionId: (result as Extract<typeof result, { ok: true }>).sessionId });
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/save/
git commit -m "feat(routine-session): POST /api/routines/active/save"
```

---

### Task 24: `POST /api/routines/active/sets/[setRowId]/start`

**Files:**
- Create: `src/app/api/routines/active/sets/[setRowId]/start/route.ts`
- Test: same dir

- [ ] **Step 1: Test (4 cases)** — 401; 404 not found; 409 `set_already_running`; 200 with session.

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { startSetForUser } from '@/server/db/routine-sessions';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });
  const result = await startSetForUser(userId, id);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  if ('conflict' in result)
    return NextResponse.json({ error: 'Conflict', code: result.conflict }, { status: 409 });
  return NextResponse.json({ session: result });
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/sets/\[setRowId\]/start/
git commit -m "feat(routine-session): POST .../sets/[setRowId]/start"
```

---

### Task 25: `POST /api/routines/active/sets/[setRowId]/complete`

**Files:**
- Create: `src/app/api/routines/active/sets/[setRowId]/complete/route.ts`
- Test: same dir

- [ ] **Step 1: Test** — 401; 404 not found; 200 with optional `endedEarlyAt` body. Validate Zod parse.

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { completeSetForUser } from '@/server/db/routine-sessions';

const bodySchema = z.object({
  endedEarlyAt: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });

  let body: unknown = {};
  try { body = await req.json(); } catch {}
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const endedAt = parsed.data.endedEarlyAt ? new Date(parsed.data.endedEarlyAt) : undefined;
  const result = await completeSetForUser(userId, id, endedAt);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  return NextResponse.json({ session: result });
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/sets/\[setRowId\]/complete/
git commit -m "feat(routine-session): POST .../sets/[setRowId]/complete"
```

---

### Task 26: `PATCH /api/routines/active/sets/[setRowId]`

**Files:**
- Create: `src/app/api/routines/active/sets/[setRowId]/route.ts`
- Test: same dir

- [ ] **Step 1: Test** — 401; 404 not found; 409 `set_locked`; 200 success; 400 invalid body.

- [ ] **Step 2: Implement**

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUserId } from '@/lib/auth';
import { patchSetForUser } from '@/server/db/routine-sessions';

const bodySchema = z.object({
  plannedDurationSeconds: z.number().int().min(60).max(7200).optional(),
  plannedBreakSeconds: z.number().int().min(0).max(3600).optional(),
  actualDurationSeconds: z.number().int().min(0).max(7200).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ setRowId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { setRowId } = await params;
  const id = Number(setRowId);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: 'Invalid set id' }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const result = await patchSetForUser(userId, id, parsed.data);
  if (!result) return NextResponse.json({ error: 'Set not found' }, { status: 404 });
  if ('conflict' in result)
    return NextResponse.json({ error: 'Set is locked', code: result.conflict }, { status: 409 });
  return NextResponse.json({ session: result });
}
```

- [ ] **Step 3: Run + commit**

```bash
git add src/app/api/routines/active/sets/\[setRowId\]/route.ts src/app/api/routines/active/sets/\[setRowId\]/route.test.ts
git commit -m "feat(routine-session): PATCH .../sets/[setRowId]"
```

---

### Task 27: `POST /api/routines/active/break/skip` and `/break/complete`

**Files:**
- Create: `src/app/api/routines/active/break/skip/route.ts`
- Create: `src/app/api/routines/active/break/complete/route.ts`
- Tests: same dirs

- [ ] **Step 1: Test (each route, 3 cases)** — 401; 404 (no break running); 200 with session.

- [ ] **Step 2: Implement skip**

```ts
import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { skipBreakForUser } from '@/server/db/routine-sessions';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await skipBreakForUser(userId);
  if (!result) return NextResponse.json({ error: 'No break running' }, { status: 404 });
  return NextResponse.json({ session: result });
}
```

- [ ] **Step 3: Implement complete** (identical except imports `completeBreakForUser`).

- [ ] **Step 4: Run + commit**

```bash
git add src/app/api/routines/active/break/
git commit -m "feat(routine-session): break skip + complete endpoints"
```

---

## Phase 4 — Client Store + Hook

### Task 28: Create `routine-session-store`

**Files:**
- Create: `src/stores/routine-session-store.ts`
- Test: `src/stores/routine-session-store.test.ts`

The store mirrors the server's active-session shape and provides display-time strings driven by `RoutineSync`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useRoutineSessionStore } from './routine-session-store';

describe('routine-session-store', () => {
  beforeEach(() => useRoutineSessionStore.getState().reset());

  it('starts in inactive mode', () => {
    expect(useRoutineSessionStore.getState().mode).toBe('inactive');
  });

  it('hydrate sets active session and mode', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: 'iso', finishedAt: null, sets: [], activeTimer: null,
    });
    expect(useRoutineSessionStore.getState().mode).toBe('active');
  });

  it('mode is "summary" when summary is set', () => {
    useRoutineSessionStore.getState().setSummary({ routineNameSnapshot: 'M', startedAt: '', finishedAt: '', totalElapsedSeconds: 0, totalActiveSeconds: 0, completedSetCount: 0, byHabit: [] });
    expect(useRoutineSessionStore.getState().mode).toBe('summary');
  });
});
```

- [ ] **Step 2: Run, expect failure**
- [ ] **Step 3: Implement**

```ts
import { create } from 'zustand';
import type { ActiveRoutineSession, RoutineSessionSummary } from '@/lib/types';

type Mode = 'inactive' | 'active' | 'summary';

type State = {
  session: ActiveRoutineSession | null;
  summary: RoutineSessionSummary | null;
  displayTime: string;
  mode: Mode;
  hydrate: (session: ActiveRoutineSession | null) => void;
  setSummary: (summary: RoutineSessionSummary | null) => void;
  setDisplayTime: (time: string) => void;
  reset: () => void;
};

export const useRoutineSessionStore = create<State>((set, get) => ({
  session: null,
  summary: null,
  displayTime: '00:00:00',
  mode: 'inactive',
  hydrate: (session) =>
    set({ session, mode: session ? 'active' : get().summary ? 'summary' : 'inactive' }),
  setSummary: (summary) =>
    set({ summary, mode: summary ? 'summary' : get().session ? 'active' : 'inactive' }),
  setDisplayTime: (time) => set({ displayTime: time }),
  reset: () => set({ session: null, summary: null, displayTime: '00:00:00', mode: 'inactive' }),
}));
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit**

```bash
git add src/stores/routine-session-store.ts src/stores/routine-session-store.test.ts
git commit -m "feat(routine-session): zustand routine-session-store"
```

---

### Task 29: `use-active-routine` hook

**Files:**
- Create: `src/hooks/use-active-routine.ts`

Encapsulates the React Query hook + mutations. No tests needed at this layer (covered by component integration tests).

- [ ] **Step 1: Write file**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { ActiveRoutineSession, RoutineSessionSummary } from '@/lib/types';

type ActiveResp = { session: ActiveRoutineSession | null };
type SessionResp = { session: ActiveRoutineSession };
type SummaryResp = { summary: RoutineSessionSummary };

export function useActiveRoutine() {
  return useQuery({
    queryKey: queryKeys.routineSession.active,
    queryFn: () => api<ActiveResp>('/api/routines/active'),
    select: (d) => d.session,
    staleTime: Infinity,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: queryKeys.routineSession.active });
}

export function useStartRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routineId: number) =>
      api<SessionResp>(`/api/routines/${routineId}/start`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDiscardRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ discarded: boolean }>('/api/routines/active/discard', { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useFinishRoutineSession() {
  return useMutation({
    mutationFn: () =>
      api<SummaryResp>('/api/routines/active/finish', { method: 'POST' }),
  });
}

export function useSaveRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ sessionId: number }>('/api/routines/active/save', { method: 'POST' }),
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: queryKeys.history.all });
      qc.invalidateQueries({ queryKey: queryKeys.habits.all });
      qc.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}

export function useStartSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setRowId: number) =>
      api<SessionResp>(`/api/routines/active/sets/${setRowId}/start`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCompleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { setRowId: number; endedEarlyAt?: string }) =>
      api<SessionResp>(`/api/routines/active/sets/${vars.setRowId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ endedEarlyAt: vars.endedEarlyAt }),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function usePatchSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      setRowId: number;
      patch: { plannedDurationSeconds?: number; plannedBreakSeconds?: number; actualDurationSeconds?: number };
    }) =>
      api<SessionResp>(`/api/routines/active/sets/${vars.setRowId}`, {
        method: 'PATCH',
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSkipBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SessionResp>('/api/routines/active/break/skip', { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCompleteBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SessionResp>('/api/routines/active/break/complete', { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}
```

- [ ] **Step 2: Type-check + commit**

```bash
git add src/hooks/use-active-routine.ts
git commit -m "feat(routine-session): use-active-routine hook (queries + mutations)"
```

---

## Phase 5 — Sync + Persistent UI

### Task 30: `RoutineSync` component

**Files:**
- Create: `src/components/RoutineSync.tsx`

Mirrors `TimerSync.tsx` but for routine sessions. Hydrates store on data, drives display tick, and triggers replay-forward / natural-completion mutations.

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActiveRoutine, useCompleteSet, useCompleteBreak } from '@/hooks/use-active-routine';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { computeReplayForward } from '@/lib/routine-session';
import { formatRemaining } from '@/lib/format';

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

export function RoutineSync() {
  const { data: session } = useActiveRoutine();
  const completeSet = useCompleteSet();
  const completeBreak = useCompleteBreak();
  const advancingRef = useRef(false);

  // Hydrate store on each fetch.
  useEffect(() => {
    useRoutineSessionStore.getState().hydrate(session ?? null);
  }, [session]);

  const activeTimer = session?.activeTimer ?? null;

  // Replay-forward / natural-completion driver
  useEffect(() => {
    if (!activeTimer) return;
    let cancelled = false;
    async function tick() {
      if (cancelled || advancingRef.current) return;
      const action = computeReplayForward(activeTimer, new Date());
      if (action.action === 'stable') return;
      advancingRef.current = true;
      try {
        if (action.action === 'complete-set') {
          await completeSet.mutateAsync({ setRowId: action.setRowId });
          sendBrowserNotification('Set complete', 'Break starting');
        } else {
          await completeBreak.mutateAsync();
          sendBrowserNotification('Break complete', 'Ready for next set');
        }
      } catch {
        toast.error('Could not advance routine');
      } finally {
        advancingRef.current = false;
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeTimer, completeSet, completeBreak]);

  // Display-time tick
  useEffect(() => {
    if (!activeTimer) {
      useRoutineSessionStore.getState().setDisplayTime('00:00:00');
      return;
    }
    function tick() {
      useRoutineSessionStore.getState().setDisplayTime(
        formatRemaining(activeTimer.startTime, activeTimer.targetDurationSeconds),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  return null;
}
```

- [ ] **Step 2: Type-check + commit**

```bash
git add src/components/RoutineSync.tsx
git commit -m "feat(routine-session): RoutineSync hydrates store + drives auto-advance"
```

---

### Task 31: `RoutineActionBar`

**Files:**
- Create: `src/components/RoutineActionBar.tsx`
- Test: `src/components/RoutineActionBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { RoutineActionBar } from './RoutineActionBar';

describe('RoutineActionBar', () => {
  it('renders nothing when inactive', () => {
    useRoutineSessionStore.getState().reset();
    const { container } = render(<RoutineActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it('shows habit name + set X of Y when running', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'M', status: 'active',
      startedAt: '', finishedAt: null,
      sets: [
        { id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30, actualDurationSeconds: null, startedAt: '2026-05-02T00:00:00Z', completedAt: null },
        { id: 2, sessionId: 1, blockIndex: 0, setIndex: 1, habitId: 1, habitNameSnapshot: 'Guitar', notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 0, actualDurationSeconds: null, startedAt: null, completedAt: null },
      ],
      activeTimer: { routineSessionSetId: 1, phase: 'set', startTime: '2026-05-02T00:00:00Z', targetDurationSeconds: 60 },
    });
    render(<RoutineActionBar />);
    expect(screen.getByText(/Guitar/)).toBeInTheDocument();
    expect(screen.getByText(/Set 1 of 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { useHaptics } from '@/hooks/use-haptics';

export function RoutineActionBar() {
  const router = useRouter();
  const { trigger } = useHaptics();
  const session = useRoutineSessionStore((s) => s.session);
  const displayTime = useRoutineSessionStore((s) => s.displayTime);
  const mode = useRoutineSessionStore((s) => s.mode);

  if (mode !== 'active' || !session) return null;

  const totalSets = session.sets.length;
  const activeTimer = session.activeTimer;

  const currentSetIndex = (() => {
    if (activeTimer) {
      const idx = session.sets.findIndex((s) => s.id === activeTimer.routineSessionSetId);
      return idx >= 0 ? idx : 0;
    }
    const nextIdle = session.sets.findIndex((s) => !s.completedAt);
    return nextIdle >= 0 ? nextIdle : totalSets - 1;
  })();
  const currentSet = session.sets[currentSetIndex];

  let phaseLabel: string;
  if (activeTimer?.phase === 'set') phaseLabel = 'Recording';
  else if (activeTimer?.phase === 'break') phaseLabel = 'Resting';
  else phaseLabel = `Tap to start set ${currentSetIndex + 1}`;

  return (
    <button
      type="button"
      onClick={() => {
        trigger('light');
        if (session.routineId) router.push(`/routines/${session.routineId}/active`);
      }}
      className="w-full px-4 py-3 bg-primary/10 border-t border-primary/30 flex items-center justify-between hover:bg-primary/15 transition-colors"
      aria-label="Open active routine"
    >
      <div className="flex flex-col items-start min-w-0">
        <span className="font-semibold text-sm truncate max-w-[60vw]">
          {currentSet?.habitNameSnapshot ?? session.routineNameSnapshot} — Set {currentSetIndex + 1} of {totalSets}
        </span>
        <span className="text-xs text-muted-foreground">{phaseLabel}</span>
      </div>
      <span className="font-mono text-sm">{displayTime}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run + commit**

```bash
git add src/components/RoutineActionBar.tsx src/components/RoutineActionBar.test.tsx
git commit -m "feat(routine-session): RoutineActionBar persistent bottom bar"
```

---

### Task 32: Mount `RoutineSync` + `RoutineActionBar` and gate `MiniTimerBar`

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/MiniTimerBar.tsx`

- [ ] **Step 1: Edit layout**

In `src/app/(app)/layout.tsx`, import:

```tsx
import { RoutineSync } from "@/components/RoutineSync";
import { RoutineActionBar } from "@/components/RoutineActionBar";
```

Replace the `<MiniTimerBar />` line with:

```tsx
<RoutineActionBar />
<MiniTimerBar />
```

Replace the `<TimerSync />` line with:

```tsx
<TimerSync />
<RoutineSync />
```

- [ ] **Step 2: Gate `MiniTimerBar`**

In `src/components/MiniTimerBar.tsx`, near the top of the function, add:

```tsx
import { useRoutineSessionStore } from '@/stores/routine-session-store';
// ...
const routineMode = useRoutineSessionStore((s) => s.mode);
if (routineMode === 'active' || routineMode === 'summary') return null;
```

- [ ] **Step 3: Update `MiniTimerBar.test.tsx`** to assert hidden when routine mode is active.

- [ ] **Step 4: Run tests + commit**

```bash
git add src/app/\(app\)/layout.tsx src/components/MiniTimerBar.tsx src/components/MiniTimerBar.test.tsx
git commit -m "feat(routine-session): mount sync + bar; mutual exclusion w/ MiniTimerBar"
```

---

## Phase 6 — Active Routine View

### Task 33: `DiscardRoutineDialog`

**Files:**
- Create: `src/components/DiscardRoutineDialog.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function DiscardRoutineDialog({ open, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard routine?</AlertDialogTitle>
          <AlertDialogDescription>
            Your active routine will be permanently deleted. No history will be saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DiscardRoutineDialog.tsx
git commit -m "feat(routine-session): DiscardRoutineDialog"
```

---

### Task 34: `NoSetsCompletedDialog`

**Files:**
- Create: `src/components/NoSetsCompletedDialog.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
};

export function NoSetsCompletedDialog({ open, onOpenChange, onDiscard }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>No completed sets</AlertDialogTitle>
          <AlertDialogDescription>
            You haven&apos;t completed any sets yet. Discard the routine instead?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NoSetsCompletedDialog.tsx
git commit -m "feat(routine-session): NoSetsCompletedDialog"
```

---

### Task 35: `StartNewRoutineConflictDialog`

**Files:**
- Create: `src/components/StartNewRoutineConflictDialog.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResume: () => void;
  onStartNew: () => void;
};

export function StartNewRoutineConflictDialog({ open, onOpenChange, onResume, onStartNew }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Routine in progress</AlertDialogTitle>
          <AlertDialogDescription>
            Starting a new routine will permanently delete your routine in progress. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={onResume}>Resume routine in progress</Button>
          <Button variant="destructive" onClick={onStartNew}>Start new routine</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StartNewRoutineConflictDialog.tsx
git commit -m "feat(routine-session): StartNewRoutineConflictDialog"
```

---

### Task 36: `ActiveRoutineSetRow`

**Files:**
- Create: `src/components/ActiveRoutineSetRow.tsx`
- Test: `src/components/ActiveRoutineSetRow.test.tsx`

This row replaces the readonly/editable set row inside an active block. Renders one of five states (upcoming-idle, upcoming-disabled, running, break-running, completed) and emits action callbacks.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveRoutineSetRow } from './ActiveRoutineSetRow';
import type { RoutineSessionSet } from '@/lib/types';

const baseSet: RoutineSessionSet = {
  id: 1, sessionId: 1, blockIndex: 0, setIndex: 0, habitId: 1, habitNameSnapshot: 'Guitar',
  notesSnapshot: null, plannedDurationSeconds: 60, plannedBreakSeconds: 30,
  actualDurationSeconds: null, startedAt: null, completedAt: null,
};

describe('ActiveRoutineSetRow', () => {
  it('renders Start when upcoming and no other set running', () => {
    const onStart = vi.fn();
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-idle" onStart={onStart} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:01:00" />);
    expect(screen.getByRole('button', { name: /start/i })).toBeEnabled();
  });

  it('disables Start when another set is running', () => {
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-disabled" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:01:00" />);
    expect(screen.getByRole('button', { name: /start/i })).toBeDisabled();
  });

  it('shows End when running', async () => {
    const onEnd = vi.fn();
    render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="running" onStart={() => {}} onEnd={onEnd} onSkipBreak={() => {}} onPatch={() => {}} displayTime="00:00:30" />);
    await userEvent.click(screen.getByRole('button', { name: /end/i }));
    expect(onEnd).toHaveBeenCalled();
  });

  it('shows checkmark when completed', () => {
    const completed = { ...baseSet, actualDurationSeconds: 60, startedAt: 'iso', completedAt: 'iso' };
    render(<ActiveRoutineSetRow set={completed} setNumber={1} state="completed" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={() => {}} displayTime="" />);
    expect(screen.getByLabelText(/completed/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
'use client';

import { Play, Square, Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RoutineSessionSet } from '@/lib/types';

export type SetRowState =
  | 'upcoming-idle'
  | 'upcoming-disabled'
  | 'running'
  | 'break-running'
  | 'completed';

type Props = {
  set: RoutineSessionSet;
  setNumber: number;
  state: SetRowState;
  displayTime: string;
  onStart: () => void;
  onEnd: () => void;
  onSkipBreak: () => void;
  onPatch: (patch: { plannedDurationSeconds?: number; plannedBreakSeconds?: number; actualDurationSeconds?: number }) => void;
};

function fmtMins(s: number) {
  return `${Math.round(s / 60)} min`;
}

export function ActiveRoutineSetRow({ set, setNumber, state, displayTime, onStart, onEnd, onSkipBreak }: Props) {
  const isActive = state === 'running' || state === 'break-running';
  const rowClasses = [
    'grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 items-center py-1.5 px-1 rounded',
    isActive ? 'bg-primary/10 border-l-2 border-primary' : '',
    setNumber % 2 === 0 ? 'bg-muted/60' : '',
  ].join(' ');

  return (
    <div className={rowClasses}>
      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium relative">
        {setNumber}
        {state === 'running' && (
          <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </span>

      <span className="text-sm text-foreground font-mono">
        {state === 'running' ? displayTime : fmtMins(set.plannedDurationSeconds)}
      </span>

      <span className="text-xs text-muted-foreground italic">
        {state === 'break-running'
          ? `Break ${displayTime}`
          : set.plannedBreakSeconds > 0
            ? `${fmtMins(set.plannedBreakSeconds)} break`
            : 'No break'}
      </span>

      <div className="flex items-center justify-end">
        {state === 'upcoming-idle' && (
          <Button size="icon-sm" variant="default" onClick={onStart} aria-label="Start set">
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {state === 'upcoming-disabled' && (
          <Button size="icon-sm" variant="default" disabled aria-label="Start set">
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {state === 'running' && (
          <Button size="icon-sm" variant="destructive" onClick={onEnd} aria-label="End set">
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        {state === 'break-running' && (
          <Button size="icon-sm" variant="ghost" onClick={onSkipBreak} aria-label="Skip break">
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        )}
        {state === 'completed' && (
          <span aria-label="Set completed" className="text-primary">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
```

(Note: inline editing of duration/break/actual is deferred to Task 37 — the props leave room.)

- [ ] **Step 4: Run, expect pass + commit**

```bash
git add src/components/ActiveRoutineSetRow.tsx src/components/ActiveRoutineSetRow.test.tsx
git commit -m "feat(routine-session): ActiveRoutineSetRow with five states"
```

---

### Task 37: Add inline editing to `ActiveRoutineSetRow`

**Files:**
- Modify: `src/components/ActiveRoutineSetRow.tsx`
- Modify: `src/components/ActiveRoutineSetRow.test.tsx`

Reuse the `Stepper` from `RoutineBlockCard.tsx:59-112`. Extract it first.

- [ ] **Step 1: Extract `Stepper` to its own file**

Create `src/components/ui/stepper.tsx`. Copy the Stepper function body verbatim from `RoutineBlockCard.tsx:59-112`. Export it. Update `RoutineBlockCard.tsx` to import from the new location.

- [ ] **Step 2: Add failing test for inline edit**

In `ActiveRoutineSetRow.test.tsx`, add:

```ts
it('calls onPatch when upcoming-idle duration stepper is incremented', async () => {
  const onPatch = vi.fn();
  render(<ActiveRoutineSetRow set={baseSet} setNumber={1} state="upcoming-idle" displayTime="" onStart={() => {}} onEnd={() => {}} onSkipBreak={() => {}} onPatch={onPatch} />);
  await userEvent.click(screen.getByLabelText(/Increase Set 1 duration/i));
  expect(onPatch).toHaveBeenCalledWith({ plannedDurationSeconds: 120 });
});
```

- [ ] **Step 3: Update `ActiveRoutineSetRow`**

When `state === 'upcoming-idle'` or `state === 'upcoming-disabled'`, render `Stepper` for duration and break instead of the static text. Wire `onChange` to call `onPatch({ plannedDurationSeconds: mins * 60 })` etc. Disabled-style when `upcoming-disabled` (don't actually disable the steppers — the user can still adjust upcoming sets, but visually de-emphasize by using `aria-disabled` if you wish).

When `state === 'completed'`, render a small Stepper for `actualDurationSeconds` (in minutes) next to the checkmark.

When `state === 'running'` or `state === 'break-running'`, render only the live displayTime text — do NOT render Steppers. The set is locked.

- [ ] **Step 4: Run + commit**

```bash
git add src/components/ActiveRoutineSetRow.tsx src/components/ActiveRoutineSetRow.test.tsx src/components/ui/stepper.tsx src/components/RoutineBlockCard.tsx
git commit -m "feat(routine-session): inline edits in ActiveRoutineSetRow"
```

---

### Task 38: `ActiveRoutineView`

**Files:**
- Create: `src/components/ActiveRoutineView.tsx`
- Test: `src/components/ActiveRoutineView.test.tsx`

Renders the active routine page: sticky header (Discard/Finish), block list (`RoutineBlockCard` in `mode="active"`), and the summary screen when in summary mode.

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { ActiveRoutineView } from './ActiveRoutineView';
// Wrap with QueryClientProvider helper as in other component tests if needed.

describe('ActiveRoutineView', () => {
  it('shows Discard and Finish buttons in active mode', () => {
    useRoutineSessionStore.getState().hydrate({
      id: 1, routineId: 1, routineNameSnapshot: 'Morning', status: 'active',
      startedAt: '', finishedAt: null, sets: [], activeTimer: null,
    });
    render(<ActiveRoutineView />);
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument();
  });
});
```

(Add a QueryClient wrapper helper if this is the first component test using mutations. Use the pattern from `Dashboard.test.tsx`.)

- [ ] **Step 2: Run, expect failure.**

- [ ] **Step 3: Implement**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import {
  useDiscardRoutineSession, useFinishRoutineSession, useStartSet,
  useCompleteSet, usePatchSet, useSkipBreak,
} from '@/hooks/use-active-routine';
import { RoutineBlockCard } from '@/components/RoutineBlockCard';
import { DiscardRoutineDialog } from '@/components/DiscardRoutineDialog';
import { NoSetsCompletedDialog } from '@/components/NoSetsCompletedDialog';
import { RoutineSessionSummary } from '@/components/RoutineSessionSummary';
import { useHaptics } from '@/hooks/use-haptics';
import { ApiError } from '@/lib/api';
import type { RoutineSessionSet } from '@/lib/types';

export function ActiveRoutineView() {
  const router = useRouter();
  const { trigger } = useHaptics();
  const session = useRoutineSessionStore((s) => s.session);
  const summary = useRoutineSessionStore((s) => s.summary);
  const setSummary = useRoutineSessionStore((s) => s.setSummary);
  const reset = useRoutineSessionStore((s) => s.reset);
  const displayTime = useRoutineSessionStore((s) => s.displayTime);

  const discard = useDiscardRoutineSession();
  const finish = useFinishRoutineSession();
  const startSet = useStartSet();
  const completeSet = useCompleteSet();
  const patchSet = usePatchSet();
  const skipBreak = useSkipBreak();

  const [discardOpen, setDiscardOpen] = useState(false);
  const [noCompletedOpen, setNoCompletedOpen] = useState(false);

  if (summary) {
    return (
      <RoutineSessionSummary
        summary={summary}
        onDiscard={() => setDiscardOpen(true)}
        onSaved={() => {
          setSummary(null);
          reset();
          router.push('/routines');
        }}
      />
    );
  }

  if (!session) return null;

  const blocks = groupSetsByBlock(session.sets);
  const activeTimer = session.activeTimer;

  function rowState(set: RoutineSessionSet) {
    if (set.completedAt) return 'completed' as const;
    if (activeTimer?.routineSessionSetId === set.id) {
      return activeTimer.phase === 'break' ? ('break-running' as const) : ('running' as const);
    }
    return activeTimer ? ('upcoming-disabled' as const) : ('upcoming-idle' as const);
  }

  async function handleFinish() {
    try {
      const data = await finish.mutateAsync();
      setSummary(data.summary);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setNoCompletedOpen(true);
      else toast.error('Could not finish routine');
    }
  }

  async function handleDiscard() {
    trigger('error');
    setDiscardOpen(false);
    setNoCompletedOpen(false);
    await discard.mutateAsync();
    setSummary(null);
    reset();
    router.push('/routines');
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="sticky -top-0.5 md:-top-6 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{session.routineNameSnapshot}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>Discard</Button>
          <Button size="sm" onClick={handleFinish}>Finish</Button>
        </div>
      </div>

      <div className="flex-1 py-4 space-y-3">
        {blocks.map((block, i) => (
          <RoutineBlockCard
            key={i}
            mode="active"
            habitName={block.sets[0].habitNameSnapshot}
            notes={block.sets[0].notesSnapshot}
            rows={block.sets.map((set) => ({
              set,
              state: rowState(set),
              displayTime,
              onStart: () => startSet.mutate(set.id),
              onEnd: () => completeSet.mutate({ setRowId: set.id }),
              onSkipBreak: () => skipBreak.mutate(),
              onPatch: (patch) => patchSet.mutate({ setRowId: set.id, patch }),
            }))}
          />
        ))}
      </div>

      <DiscardRoutineDialog open={discardOpen} onOpenChange={setDiscardOpen} onConfirm={handleDiscard} />
      <NoSetsCompletedDialog open={noCompletedOpen} onOpenChange={setNoCompletedOpen} onDiscard={handleDiscard} />
    </div>
  );
}

function groupSetsByBlock(sets: RoutineSessionSet[]) {
  const map = new Map<number, RoutineSessionSet[]>();
  for (const s of sets) {
    const list = map.get(s.blockIndex) ?? [];
    list.push(s);
    map.set(s.blockIndex, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([_, set]) => ({ sets: set.sort((x, y) => x.setIndex - y.setIndex) }));
}
```

This depends on Task 39 wiring `RoutineBlockCard` to accept a third `mode: 'active'` with a `renderSetRow` prop.

- [ ] **Step 4: Skip pass-test for now (depends on Task 39); commit anyway**

```bash
git add src/components/ActiveRoutineView.tsx src/components/ActiveRoutineView.test.tsx
git commit -m "feat(routine-session): ActiveRoutineView (depends on RoutineBlockCard active mode)"
```

---

### Task 39: Add `mode: 'active'` to `RoutineBlockCard`

**Files:**
- Modify: `src/components/RoutineBlockCard.tsx`

The active mode does NOT consume `BuilderBlock` — it has its own props shape, because `BuilderSet` (`{ durationSeconds, breakSeconds, clientId }`) is a different shape than `RoutineSessionSet`. The shared structure is the outer Card, header text, and notes banner.

- [ ] **Step 1: Extend Props with a self-contained `ActiveProps`**

Add to the top of the file:

```ts
import type { RoutineSessionSet } from '@/lib/types';
import { ActiveRoutineSetRow, type SetRowState } from './ActiveRoutineSetRow';

type ActiveRow = {
  set: RoutineSessionSet;
  state: SetRowState;
  displayTime: string;
  onStart: () => void;
  onEnd: () => void;
  onSkipBreak: () => void;
  onPatch: (patch: { plannedDurationSeconds?: number; plannedBreakSeconds?: number; actualDurationSeconds?: number }) => void;
};

type ActiveProps = {
  mode: 'active';
  habitName: string;
  notes: string | null;
  rows: ActiveRow[];
};

type Props = ReadonlyProps | EditableProps | ActiveProps;
```

- [ ] **Step 2: Branch the render**

Replace the body to switch on `props.mode`:

```tsx
export function RoutineBlockCard(props: Props) {
  if (props.mode === 'active') {
    return (
      <Card className="overflow-hidden pb-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold">{props.habitName}</h3>
        </div>
        {props.notes && (
          <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
            <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground">{props.notes}</span>
          </div>
        )}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide mb-0.5 px-1">
            <span>Set</span><span>Duration</span><span>Break</span><span />
          </div>
          {props.rows.map((row, i) => (
            <ActiveRoutineSetRow key={row.set.id} setNumber={i + 1} {...row} />
          ))}
        </div>
      </Card>
    );
  }

  // existing readonly/editable body unchanged — keep as-is below
  const { block, mode } = props;
  const isEditable = mode === 'editable';
  // ...rest of existing body unchanged...
}
```

- [ ] **Step 3: Run existing tests**

Run: `npm run test:unit -- RoutineBlockCard`
Expected: existing readonly/editable tests still pass.

- [ ] **Step 3: Run all RoutineBlockCard tests**

Run: `npm run test:unit -- RoutineBlockCard`
Expected: existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/RoutineBlockCard.tsx
git commit -m "feat(routine-session): RoutineBlockCard active mode w/ ActiveRoutineSetRow"
```

---

### Task 40: `RoutineSessionSummary`

**Files:**
- Create: `src/components/RoutineSessionSummary.tsx`

- [ ] **Step 1: Write file**

```tsx
'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSaveRoutineSession } from '@/hooks/use-active-routine';
import { useHaptics } from '@/hooks/use-haptics';
import { formatTime } from '@/lib/format';
import type { RoutineSessionSummary as Summary } from '@/lib/types';

function playFanfare() {
  try {
    new Audio('/fanfare.mp3').play().catch(() => {});
  } catch {}
}

type Props = {
  summary: Summary;
  onDiscard: () => void;
  onSaved: () => void;
};

export function RoutineSessionSummary({ summary, onDiscard, onSaved }: Props) {
  const save = useSaveRoutineSession();
  const { trigger } = useHaptics();

  useEffect(() => {
    trigger('light');
  }, [trigger]);

  async function handleSave() {
    try {
      await save.mutateAsync();
      trigger('buzz');
      playFanfare();
      toast.success('Routine saved');
      onSaved();
    } catch {
      toast.error('Could not save routine');
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center text-center px-6 space-y-4 py-8">
      <h2 className="text-2xl font-bold">{summary.routineNameSnapshot}</h2>
      <p className="text-4xl font-mono">{formatTime(summary.totalElapsedSeconds)}</p>
      <p className="text-sm text-muted-foreground">
        {summary.completedSetCount} {summary.completedSetCount === 1 ? 'set' : 'sets'} ·
        {' '}{formatTime(summary.totalActiveSeconds)} active
      </p>

      <div className="w-full max-w-sm space-y-1">
        {summary.byHabit.map((h) => (
          <div key={h.habitName} className="flex justify-between text-sm">
            <span>{h.habitName}</span>
            <span className="font-mono text-muted-foreground">
              {h.sets} {h.sets === 1 ? 'set' : 'sets'} · {formatTime(h.totalSeconds)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 w-full max-w-sm pt-4">
        <Button variant="outline" className="flex-1" onClick={onDiscard}>Discard</Button>
        <Button className="flex-1" onClick={handleSave} disabled={save.isPending}>
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RoutineSessionSummary.tsx
git commit -m "feat(routine-session): RoutineSessionSummary view"
```

---

### Task 41: Active routine page

**Files:**
- Create: `src/app/(app)/routines/[id]/active/page.tsx`

- [ ] **Step 1: Create file**

```tsx
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/auth';
import { getActiveRoutineSessionForUser } from '@/server/db/routine-sessions';
import { ActiveRoutineView } from '@/components/ActiveRoutineView';

export default async function ActiveRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const { id } = await params;
  const session = await getActiveRoutineSessionForUser(userId);
  if (!session || session.routineId !== Number(id)) redirect(`/routines/${id}`);
  return <ActiveRoutineView />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/routines/\[id\]/active/
git commit -m "feat(routine-session): /routines/[id]/active page"
```

---

## Phase 7 — Integration with Existing Pages

### Task 42: Make `RoutineDetailView` Start Routine functional

**Files:**
- Modify: `src/components/RoutineDetailView.tsx`

- [ ] **Step 1: Replace bottom button block**

```tsx
'use client';
// ...existing imports...
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useActiveRoutine, useStartRoutineSession, useDiscardRoutineSession } from '@/hooks/use-active-routine';
import { StartNewRoutineConflictDialog } from '@/components/StartNewRoutineConflictDialog';
import { ApiError } from '@/lib/api';

// inside component, before return:
const router = useRouter();
const { data: active } = useActiveRoutine();
const startSession = useStartRoutineSession();
const discardSession = useDiscardRoutineSession();
const [conflictOpen, setConflictOpen] = useState(false);

async function start() {
  if (active) {
    setConflictOpen(true);
    return;
  }
  try {
    await startSession.mutateAsync(routineId);
    router.push(`/routines/${routineId}/active`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      setConflictOpen(true);
      return;
    }
    toast.error('Could not start routine');
  }
}

async function startNewAfterDiscard() {
  await discardSession.mutateAsync();
  await startSession.mutateAsync(routineId);
  setConflictOpen(false);
  router.push(`/routines/${routineId}/active`);
}
```

Replace the disabled "Coming Soon" footer button with:

```tsx
<Button className="w-full" onClick={start} disabled={startSession.isPending}>
  Start Routine
</Button>
```

Mount the conflict dialog at the end of the JSX:

```tsx
<StartNewRoutineConflictDialog
  open={conflictOpen}
  onOpenChange={setConflictOpen}
  onResume={() => {
    if (active?.routineId) router.push(`/routines/${active.routineId}/active`);
    setConflictOpen(false);
  }}
  onStartNew={startNewAfterDiscard}
/>
```

- [ ] **Step 2: Type-check + commit**

```bash
git add src/components/RoutineDetailView.tsx
git commit -m "feat(routine-session): RoutineDetailView Start Routine button functional"
```

---

### Task 43: Active-session banner + Continue badge in `RoutinesView`

**Files:**
- Modify: `src/components/RoutinesView.tsx`

- [ ] **Step 1: Edit**

At the top of the export, before the grid:

```tsx
const { data: active } = useActiveRoutine();
```

Above the grid:

```tsx
{active && (
  <div className="mb-4 rounded-md bg-primary/10 border border-primary/30 px-4 py-3 flex items-center justify-between">
    <span className="text-sm">
      Routine in progress: <strong>{active.routineNameSnapshot}</strong>
    </span>
    {active.routineId && (
      <Link href={`/routines/${active.routineId}/active`}>
        <Button size="sm">Continue</Button>
      </Link>
    )}
  </div>
)}
```

In `RoutineCard`, accept an `isActive` prop. When `isActive`, render a "Continue" badge in the top-right of the card (next to or replacing the Edit/Delete buttons — small chip):

```tsx
{isActive && (
  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
    Continue
  </span>
)}
```

In the grid, pass `isActive={active?.routineId === routine.id}`.

- [ ] **Step 2: Commit**

```bash
git add src/components/RoutinesView.tsx
git commit -m "feat(routine-session): banner + Continue badge in RoutinesView"
```

---

### Task 44: Disable individual habit timers + banner in `Dashboard`

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: Add active-session check**

Near the top of `Dashboard`:

```tsx
import { useActiveRoutine } from '@/hooks/use-active-routine';
// ...
const { data: activeRoutine } = useActiveRoutine();
const routineActive = !!activeRoutine;
```

Before the habit list/grid:

```tsx
{routineActive && (
  <div className="mb-3 rounded-md bg-primary/10 border border-primary/30 px-4 py-2 text-sm">
    Routine in progress — finish or discard it to start individual timers.
  </div>
)}
```

Update `handleStartClick` to no-op when `routineActive` (or just disable the buttons):

In the `renderAction` callback for `HabitList`, add `disabled={routineActive}` to the Start button. Also pass `disabled` to `HabitCard` for grid mode (modify `HabitCard.tsx` if needed to support `disabled` on its Start button).

- [ ] **Step 2: Commit**

```bash
git add src/components/Dashboard.tsx src/components/HabitCard.tsx
git commit -m "feat(routine-session): disable individual timers + banner during active routine"
```

---

## Phase 8 — History View

### Task 45: Surface `timerMode: 'routine'` rows + group by routine session

**Files:**
- Modify: `src/server/db/history.ts`
- Modify: `src/components/HistoryView.tsx`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Extend HistoryEntry shape**

In `src/lib/types.ts`, add:

```ts
export type HistoryRoutineGroup = {
  kind: 'routine';
  routineSessionId: number;
  routineNameSnapshot: string;
  startedAt: string;
  finishedAt: string;
  totalDurationSeconds: number;
  entries: HistoryEntry[];
};

export type HistoryListItem =
  | { kind: 'session'; entry: HistoryEntry }
  | HistoryRoutineGroup;
```

- [ ] **Step 2: Update server query**

In `src/server/db/history.ts:getHistoryForUser`, after building rows, partition by `timerMode === 'routine'`. For routine rows, group by their parent `routineSessions.id` (you'll need to JOIN to find each row's session — easier: add `routineSessionId` to `timeSessions` schema).

**Decision:** add a `routineSessionId` nullable column to `timeSessions` to make this efficient. This requires a migration.

- [ ] **Step 3: Schema + migration**

Add to `timeSessions` in `src/db/schema.ts`:

```ts
routineSessionId: integer('routine_session_id').references(() => routineSessions.id, { onDelete: 'set null' }),
```

Run: `npm run db:generate -- --name link-time-sessions-to-routine`
Run: `npm run db:migrate`

- [ ] **Step 4: Wire `saveActiveRoutineSessionForUser`** (Task 16) to set `routineSessionId: session.id` on each `timeSessions` insert.

- [ ] **Step 5: Group in `getHistoryForUser`**

Replace the `getHistoryForUser` body's row-mapping tail with grouping logic. The full updated function:

```ts
import { activeTimers, habits, routineSessions, timeSessions } from '@/db/schema';
import type { HistoryEntry, HistoryListItem } from '@/lib/types';

export async function getHistoryForUser(
  userId: number,
  filters: HistoryFilters,
): Promise<{ history: HistoryListItem[]; totalSeconds: number }> {
  const dateFilter = getDateFilter(filters.range);
  const conditions = [eq(habits.userId, userId)];
  if (filters.habitId) conditions.push(eq(timeSessions.habitId, Number(filters.habitId)));
  if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));

  const rows = await db
    .select({
      id: timeSessions.id,
      habitName: habits.name,
      habitId: timeSessions.habitId,
      startTime: timeSessions.startTime,
      endTime: timeSessions.endTime,
      durationSeconds: timeSessions.durationSeconds,
      timerMode: timeSessions.timerMode,
      routineSessionId: timeSessions.routineSessionId,
      routineNameSnapshot: routineSessions.routineNameSnapshot,
      sessionStartedAt: routineSessions.startedAt,
      sessionFinishedAt: routineSessions.finishedAt,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .leftJoin(routineSessions, eq(timeSessions.routineSessionId, routineSessions.id))
    .where(and(...conditions))
    .orderBy(desc(timeSessions.endTime));

  const totalSeconds = rows.reduce((s, r) => s + r.durationSeconds, 0);

  const filtered = !!filters.habitId;
  const flat: HistoryEntry[] = rows.map((r) => ({
    id: r.id,
    habitName: r.habitName,
    habitId: r.habitId,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    durationSeconds: r.durationSeconds,
    timerMode: r.timerMode,
  }));

  if (filtered) {
    return { history: flat.map((entry) => ({ kind: 'session', entry })), totalSeconds };
  }

  // Group: rows with the same routineSessionId become one routine group.
  // Non-routine rows (routineSessionId === null) are individual sessions.
  // Output preserves overall chronological order by group/session most-recent-end.
  const groupsById = new Map<number, HistoryListItem & { kind: 'routine' }>();
  const out: HistoryListItem[] = [];
  for (const r of rows) {
    if (r.routineSessionId === null) {
      out.push({
        kind: 'session',
        entry: {
          id: r.id, habitName: r.habitName, habitId: r.habitId,
          startTime: r.startTime.toISOString(), endTime: r.endTime.toISOString(),
          durationSeconds: r.durationSeconds, timerMode: r.timerMode,
        },
      });
      continue;
    }
    const existing = groupsById.get(r.routineSessionId);
    if (existing) {
      existing.entries.push({
        id: r.id, habitName: r.habitName, habitId: r.habitId,
        startTime: r.startTime.toISOString(), endTime: r.endTime.toISOString(),
        durationSeconds: r.durationSeconds, timerMode: r.timerMode,
      });
      existing.totalDurationSeconds += r.durationSeconds;
      continue;
    }
    const group: HistoryListItem & { kind: 'routine' } = {
      kind: 'routine',
      routineSessionId: r.routineSessionId,
      routineNameSnapshot: r.routineNameSnapshot ?? '(deleted routine)',
      startedAt: r.sessionStartedAt?.toISOString() ?? r.startTime.toISOString(),
      finishedAt: r.sessionFinishedAt?.toISOString() ?? r.endTime.toISOString(),
      totalDurationSeconds: r.durationSeconds,
      entries: [{
        id: r.id, habitName: r.habitName, habitId: r.habitId,
        startTime: r.startTime.toISOString(), endTime: r.endTime.toISOString(),
        durationSeconds: r.durationSeconds, timerMode: r.timerMode,
      }],
    };
    groupsById.set(r.routineSessionId, group);
    out.push(group);
  }

  return { history: out, totalSeconds };
}
```

- [ ] **Step 6: Update `HistoryView`**

Render each item by `kind`. For `kind === 'routine'`: a collapsible card titled `routineNameSnapshot` with total time and set count; expanded shows each entry inside. Reuse Framer Motion for expand animation.

- [ ] **Step 7: Tests**

In `src/app/api/history/route.test.ts` (mocked DB), add a case where rows include grouped routine sessions and assert the response shape.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema.ts drizzle/ src/server/db/history.ts src/server/db/routine-sessions.ts src/components/HistoryView.tsx src/lib/types.ts src/app/api/history/route.test.ts
git commit -m "feat(routine-session): history groups routine sessions; flat when filtered"
```

---

## Phase 9 — E2E

### Task 46: Playwright happy path

**Files:**
- Create: `e2e/routine-session.spec.ts`

Reference existing E2E patterns under `e2e/` for setup (login fixture, etc.).

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '@playwright/test';

test('start, run a set, finish, save', async ({ page }) => {
  // sign in (use existing fixture/helper if present)
  await page.goto('/login');
  // ... login steps based on existing e2e/login pattern ...

  // create a routine via UI or API helper. Existing patterns may have a helper; if not, POST via request().
  // For this test we'll assume one routine "Test" with one block, two sets of 1 minute each, no break.
  await page.goto('/routines');
  await page.getByText('Test').click();
  await page.getByRole('button', { name: 'Start Routine' }).click();

  await expect(page).toHaveURL(/\/routines\/.+\/active$/);

  await page.getByRole('button', { name: /start set/i }).first().click();
  await page.getByRole('button', { name: /end set/i }).click();

  await page.getByRole('button', { name: /finish/i }).click();
  await page.getByRole('button', { name: /save/i }).click();

  await expect(page).toHaveURL(/\/routines$/);
  await page.goto('/history');
  await expect(page.getByText('Test')).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `npm run test:e2e -- routine-session`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/routine-session.spec.ts
git commit -m "test(routine-session): e2e happy path"
```

---

### Task 47: Playwright — discard from toolbar; refresh persists state

**Files:**
- Modify: `e2e/routine-session.spec.ts`

- [ ] **Step 1: Add two more `test(...)` blocks**

Use the same login + start-routine helpers introduced in Task 46. Concrete bodies:

```ts
test('discard from toolbar removes the active session', async ({ page }) => {
  await loginAndStartTestRoutine(page);
  await expect(page).toHaveURL(/\/routines\/.+\/active$/);
  await page.getByRole('button', { name: /discard/i }).click();
  await page.getByRole('button', { name: /^discard$/i }).click(); // confirm
  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByText(/routine in progress/i)).toHaveCount(0);
});

test('refresh mid-set persists state', async ({ page }) => {
  await loginAndStartTestRoutine(page);
  await page.getByRole('button', { name: /start set/i }).first().click();
  await expect(page.getByRole('button', { name: /end set/i })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /end set/i })).toBeVisible();
});
```

If `loginAndStartTestRoutine` doesn't exist yet, factor it out of Task 46 into a top-of-file helper that logs in, ensures the "Test" routine exists, and starts it.

- [ ] **Step 2: Run + commit**

```bash
git add e2e/routine-session.spec.ts
git commit -m "test(routine-session): discard + refresh-persistence e2e"
```

---

### Task 48: Playwright — habit timer disabled during routine

**Files:**
- Modify: `e2e/routine-session.spec.ts`

- [ ] **Step 1: Add test**

```ts
test('habit start buttons disabled when routine is active', async ({ page }) => {
  // log in + start routine
  await page.goto('/habits');
  // banner present
  await expect(page.getByText(/routine in progress/i)).toBeVisible();
  // Start buttons disabled
  const startButtons = page.getByRole('button', { name: 'Start' });
  for (const b of await startButtons.all()) {
    await expect(b).toBeDisabled();
  }
});
```

- [ ] **Step 2: Run + commit**

```bash
git add e2e/routine-session.spec.ts
git commit -m "test(routine-session): habit timers disabled during routine e2e"
```

---

## Phase 10 — Final cleanup

### Task 49: Manual smoke + lint + tests + commit

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e`
Expected: all pass.

- [ ] **Step 5: Manual sanity in dev**

```bash
npm run dev
```

Walk the flows:
- Start a routine; run a set with break; verify break auto-starts; skip break; start next set; finish; save; see in History as collapsible routine card.
- Refresh during a set — state persists.
- Try to start an individual habit timer with an active routine — Start is disabled, banner shown.
- Try to start a different routine while one is active — conflict modal opens.
- Discard from toolbar — confirmation modal; on confirm nothing in history.
- Finish with no completed sets — modal blocks save.

- [ ] **Step 6: Update `notes.md`** with a short summary of what was learned during implementation (per `AGENTS.md`).

- [ ] **Step 7: Final commit**

```bash
git add notes.md
git commit -m "docs: routine session implementation notes"
```

---

## Risks / Watchouts

- **`activeTimers` cascade.** When `routineSessionSets` is deleted (via session cascade), the FK `routineSessionSetId` cascade also deletes the timer row. Verified at schema level — double-check during Task 1.
- **`reloadActiveSession` vs `getActiveRoutineSessionForUser`.** Two near-identical helpers (one transactional, one not). If Drizzle exposes a way to share via passing the tx as the same type as `db`, prefer that. If not, accept the duplication for now.
- **Test pattern for API routes is mocked, not real-DB.** This contradicts the spec's "real test DB" note; the existing codebase uses mocks. Plan honors the existing pattern. (Real-DB integration tests can be added later if desired.)
- **Existing `MiniTimerBar.test.tsx`** must be updated when gating it (Task 32). If the test file doesn't exist for the routine-active case, add the case.
- **History grouping (Task 45) requires a second migration.** Carefully sequence: write the column, then update the Save flow, then update queries.
- **`computeNextPhase` uses `RoutineSessionSet.id`** which assumes server-assigned ids. The pure helper test mocks ids — fine. Real flow always has DB-assigned ids by the time this is called.
- **React Compiler.** No `useCallback`/`useMemo`. Don't add them.
