# Routine Session — Design Spec

**Date:** 2026-05-02
**Status:** Draft, pending user review

## Goal

Let a user run a routine end-to-end: start it, work through sets with auto-advancing breaks, edit on the fly, then either save (records all completed sets to history) or discard (no record kept). Inspired by Hevy/Strong's workout flow plus Interval Timer's automatic phase transitions. Replaces the disabled "Start Routine (Coming Soon)" button on `RoutineDetailView`.

## Non-goals

- Pause/resume of a running set
- Concurrent active routines per user (DB-enforced one-at-a-time)
- Live multi-device sync (single-device session is fine)
- Sound effects for individual set completion (haptic only; fanfare on Save only)

## Architecture

Three layers, each with one owner.

**Server (Drizzle/Turso) — persistence + recovery source of truth.**
- `routineSessions` — one row per session, status `active | completed`, unique-active-per-user via partial index.
- `routineSessionSets` — flat snapshot of all planned sets at session start; mutates with `actualDurationSeconds`/`startedAt`/`completedAt` during the run.
- `activeTimers` — extended with `routineSessionSetId` and `phase` columns; still unique on `userId`. Same row drives both individual habit timers and routine set/break timers; the new columns tell consumers which kind it is.
- `timeSessions` — only written on Save (one row per completed set, `timerMode: 'routine'`). Untouched by an active or discarded session.

**Client (Zustand) — UI display state.**
- New `routine-session-store`, parallel to existing `timer-store`. Holds hydrated session, current set index, phase (`idle | set-running | break-running | summary`), display time strings.
- Selector `mode: 'none' | 'timer' | 'routine'` drives mutual exclusion between `MiniTimerBar` and the new `RoutineActionBar`.

**Sync (`RoutineSync` component) — bridges server and client.**
- Mounts in `(app)/layout.tsx` alongside existing `TimerSync`.
- On mount: `GET /api/routines/active` hydrates store.
- Owns the 1s tick interval that updates display time and detects natural set/break completion (same pattern as `TimerSync.tsx:69-117`).
- On set/break natural completion, calls server endpoint to advance phase; server is authoritative for transitions.
- Replay-forward on hydration: if `activeTimers.startTime + targetDurationSeconds < now`, the timer already elapsed while user was away — advance phase server-side and re-fetch. Bounded by remaining sets.

## Database Schema

```ts
// New
export const routineSessions = sqliteTable('routine_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  routineNameSnapshot: text('routine_name_snapshot').notNull(),
  status: text('status').notNull(), // 'active' | 'completed'
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
}, (table) => [
  uniqueIndex('routine_sessions_one_active_per_user')
    .on(table.userId)
    .where(sql`status = 'active'`),
]);

// New
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

// Modified — add to existing activeTimers
//   routineSessionSetId: integer (nullable, FK to routine_session_sets.id ON DELETE CASCADE)
//   phase: text (nullable, 'set' | 'break')
```

**Snapshot rationale:** `routineNameSnapshot`, `habitNameSnapshot`, `notesSnapshot` decouple the session from later edits or deletes of the routine/habit. `routineId` and `habitId` use `ON DELETE SET NULL` so saved sessions survive deletes; History falls back to snapshot for display.

**`timerMode` extension:** `timeSessions.timerMode` gains a fourth allowed value, `'routine'`. History UI uses this to group rows under their parent routine.

## API Routes

All under `/api/routines/active/` (singular — there's at most one).

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/routines/[id]/start` | Snapshot routine into session + sets. Idle state. 409 if any `activeTimers` row exists. |
| `GET` | `/api/routines/active` | Returns active session + sets + active timer, or `null`. Used for hydration. |
| `POST` | `/api/routines/active/discard` | Hard-delete (cascade). Idempotent. |
| `POST` | `/api/routines/active/finish` | Validate ≥1 completed set; return summary payload. Does not save. 409 `no_completed_sets`. |
| `POST` | `/api/routines/active/save` | Transactional: write `timeSessions` rows, mark session `completed`, clear active timer. |
| `POST` | `/api/routines/active/sets/[setRowId]/start` | Insert `activeTimers` row (`phase: 'set'`); update `startedAt`. 409 if another set/break is active. |
| `POST` | `/api/routines/active/sets/[setRowId]/complete` | Compute `actualDurationSeconds`, set `completedAt`, delete timer. Insert break timer unless `plannedBreakSeconds === 0` OR this is the final set of the final block; otherwise idle. Body: `{ endedEarlyAt?: ISO }`. |
| `POST` | `/api/routines/active/break/skip` | Delete break timer; transition to idle. 404 if no break running. |
| `POST` | `/api/routines/active/break/complete` | Same as skip but called by sync layer on natural completion. |
| `PATCH` | `/api/routines/active/sets/[setRowId]` | Inline edit. Server enforces: planned fields editable only when set is upcoming (no `startedAt`); `actualDurationSeconds` editable only when set is completed. Currently-running set is locked. |

**Existing routes that gain a guard:**
- `POST /api/timer/start` — 409 if user has an active routine session.
- `DELETE /api/habits/[id]` — 409 if habit is referenced by an active session's `routineSessionSets`.

All bodies validated with Zod. All mutations wrap in `db.transaction`.

## Lifecycles

**Start:** User taps Start Routine → conflict modal if needed → `POST /api/routines/[id]/start` → snapshot transaction → invalidate → router push to `/routines/[id]/active` → idle state.

**Run a set:** User taps `▶ Start` on a set row → `POST .../sets/[id]/start` → `activeTimers` row inserted (`phase: 'set'`) → `RoutineSync` ticks → on natural completion or End-early tap → `POST .../sets/[id]/complete` → server transactionally completes set + (if applicable) inserts break timer → client picks up new state from response.

**Auto-advance to break:** Inside the `complete` transaction. Skip the break if `plannedBreakSeconds === 0` (rule D) OR this is the final set of the final block (rule A2). Otherwise honor the configured break.

**Skip / complete break:** `/break/skip` or `/break/complete` → delete break timer → idle. Next set is manual (user must tap Start).

**Inline edit:** `Stepper` change → optimistic store update → debounced `PATCH .../sets/[id]` → on failure: revert + toast.

**Finish:** `POST /api/routines/active/finish` → validate ≥1 set with `actualDurationSeconds > 0` → 409 `no_completed_sets` (modal: Discard/Cancel) or 200 with summary → client renders `RoutineSessionSummary`.

**Save:** `POST /api/routines/active/save` → transaction: write one `timeSessions` row per completed set with `timerMode: 'routine'`; mark session `completed`; clear timer → invalidate `habits | history | rankings | routineSession.active` → router push to `/routines` → toast + fanfare + haptic.

**Discard:** Confirmation `AlertDialog` → `POST /api/routines/active/discard` → cascade delete + clear timer → router push to `/routines`. Nothing hits `timeSessions`.

**Hydrate / refresh:** `RoutineSync` calls `GET /api/routines/active`. If active timer has elapsed past target, replay-forward: call `complete`, re-fetch, repeat until stable.

**Conflict — start individual timer mid-routine:** UI buttons disabled. Defense in depth: `POST /api/timer/start` returns 409 `routine_session_active` → toast.

## Components

```
src/components/
├── ActiveRoutineView.tsx               # Page: sticky header (Discard/Finish) + block list
├── ActiveRoutineSetRow.tsx             # Set row: inline timer, start, checkbox, edit
├── RoutineActionBar.tsx                # Persistent bottom bar
├── RoutineSync.tsx                     # Hydration + tick + auto-advance driver
├── RoutineSessionSummary.tsx           # Finish summary (Save/Discard)
├── DiscardRoutineDialog.tsx
├── NoSetsCompletedDialog.tsx
└── StartNewRoutineConflictDialog.tsx   # Resume / Start new / Cancel

src/stores/routine-session-store.ts
src/hooks/use-active-routine.ts
src/server/db/routine-sessions.ts
src/lib/routine-session.ts              # Pure helpers (computeNextPhase, replayForward, summary)
```

**`RoutineBlockCard`** gains a third `mode: 'active'` rather than fork. Most layout shared with readonly/editable; `active` mode swaps in `ActiveRoutineSetRow` for set rendering.

**`ActiveRoutineSetRow` per state:**
- Upcoming, no other set running → `▶ Start` button enabled
- Upcoming, another set running → `▶ Start` disabled
- Currently running → highlighted background + left-border accent + pulsing dot in set number, `■ End` button, live countdown
- Break running → "Break — 0:42" with `Skip` button, distinct break-styling
- Completed → filled `✓`, actual duration shown (inline-editable)

**`RoutineActionBar`** mounted globally in `(app)/layout.tsx` next to `MiniTimerBar`. Mutually exclusive render via `routine-session-store.mode` selector.

**Touched components:**
- `RoutineDetailView` — Start Routine becomes functional, opens conflict modal if needed
- `RoutinesView` — active-session banner + Continue badge on the active routine card
- `Dashboard` / habit list — start-timer buttons disabled + banner when routine active
- `MiniTimerBar` — gates render on no-routine-active
- `(app)/layout.tsx` — mount `<RoutineSync />` and `<RoutineActionBar />`
- `HistoryView` — collapsible routine cards; flat-when-filtered-by-habit
- `query-keys.ts` — add `queryKeys.routineSession.active`

## UX Decisions

- **Inline edits:** allowed on upcoming sets (planned duration + break) and completed sets (actual duration). Currently-running set is locked.
- **Break rules:** auto-start after set completes (including end-early). Skippable. Auto-skipped if `plannedBreakSeconds === 0` (D) or this is the final set of the final block (A2).
- **Completed-set definition:** any set the user started with `actualDurationSeconds > 0` (E2).
- **No-completed-sets on Finish:** modal offers Discard/Cancel only — no Save path.
- **Conflict modal (B2):** "Routine in progress / Starting a new routine will permanently delete your routine in progress. This cannot be undone." Buttons (top to bottom): Resume routine in progress / Start new routine (destructive) / Cancel.
- **History:** routines render as collapsible cards in the same timeline as individual sessions. Tap to expand. When filtered by a single habit, routines flatten into individual rows.
- **Haptics:** light on set complete and break complete; success on save; error on discard.
- **Browser notification:** on set/break complete when tab is backgrounded (reuses `sendBrowserNotification` pattern from `TimerSync`).
- **Sound:** `playFanfare()` only on Save.

## Error Handling

**Server:** standard codes (200/400/401/404/409/500). Conflict responses include a `code` string for client branching (`routine_session_active`, `no_completed_sets`, `set_already_running`, `habit_in_use`).

**Client:** mutations are pessimistic for state transitions, optimistic for inline edits. Toast on failure. Hydration failure is silent (next page load retries).

**Atomicity:** every mutation wraps in `db.transaction`. Save is the largest transaction (N inserts + 1 update + 1 delete) but bounded by routine size.

## Testing Strategy

**Unit (Vitest, pure functions in `src/lib/routine-session.ts`):**
- `computeNextPhase`
- `replayForward` against `now`
- `computeSummary` aggregation
- snapshot shape conversion (routine → session sets)

**Integration (Vitest + RTL):**
- `ActiveRoutineView` per state (idle / set-running / break-running / no-completed-sets)
- `RoutineActionBar` mutual exclusion with `MiniTimerBar`
- Inline edit guards (running set locked)
- Conflict modal flow

**API (Vitest, real test DB, alongside existing `route.test.ts` files):**
- Full happy path (start → run set → break → next set → finish → save)
- Conflict guards (start-while-active, start-individual-while-routine, delete-habit-in-use)
- Discard removes everything, writes nothing to `timeSessions`
- Save writes correct `timeSessions` rows with `timerMode: 'routine'`
- Replay-forward through multiple elapsed phases

**E2E (Playwright):**
- Happy path: start, run two sets with break, finish, save, see in history
- Discard from toolbar; discard from summary
- Refresh mid-set persists state
- Habit timer disabled during routine; banner visible

Per `AGENTS.md`: tests written first, iterated to green.

## Open Questions

None.
