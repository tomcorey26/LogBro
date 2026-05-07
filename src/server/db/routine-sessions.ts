import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  routineSessions,
  routineSessionSets,
  activeTimers,
  timeSessions,
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

function deriveFinishedAt(rows: { completedAt: Date }[]): Date {
  let max = rows[0].completedAt;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].completedAt.getTime() > max.getTime()) max = rows[i].completedAt;
  }
  return max;
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
export async function startRoutineSessionForUser(
  userId: number,
  routineId: number,
): Promise<
  | ActiveRoutineSession
  | { conflict: 'active_timer_exists' | 'active_session_exists' | 'empty_routine' }
  | null
> {
  return db.transaction(async (tx) => {
    const routine = await getRoutineById(routineId, userId, tx);
    if (!routine) return null;

    // Defense-in-depth: API validation enforces min(1) blocks/sets, but reject empty
    // routines at the DB layer too — an empty session can only be Discarded.
    const snapshot = snapshotRoutineToSets(routine);
    if (snapshot.length === 0) return { conflict: 'empty_routine' as const };

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
    if (existingSession) return { conflict: 'active_session_exists' as const };

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

    const inserts = snapshot.map((s) => ({
      sessionId: session.id,
      ...s,
    }));
    await tx.insert(routineSessionSets).values(inserts);

    return await reloadActiveSession(tx, userId);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function loadActiveSession(
  conn: typeof db | Tx,
  userId: number,
): Promise<ActiveRoutineSession | null> {
  const session = await conn
    .select()
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  if (!session) return null;
  const setRows = await conn
    .select()
    .from(routineSessionSets)
    .where(eq(routineSessionSets.sessionId, session.id));
  const sortedSets = setRows
    .map(rowToSet)
    .sort((a, b) => a.blockIndex - b.blockIndex || a.setIndex - b.setIndex);
  const timerRow = await conn
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

const reloadActiveSession = loadActiveSession;

export async function getActiveRoutineSessionForUser(
  userId: number,
): Promise<ActiveRoutineSession | null> {
  return db.transaction((tx) => loadActiveSession(tx, userId));
}
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
export async function buildSummaryForUser(
  userId: number,
): Promise<
  | { ok: true; summary: import('@/lib/types').RoutineSessionSummary }
  | { ok: false; reason: 'no_active_session' | 'no_completed_sets' }
> {
  return db.transaction(async (tx) => {
    const session = await tx
      .select()
      .from(routineSessions)
      .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
      .get();
    if (!session) return { ok: false as const, reason: 'no_active_session' as const };

    const setRows = await tx
      .select()
      .from(routineSessionSets)
      .where(eq(routineSessionSets.sessionId, session.id));

    const completedRows = setRows.filter(
      (r): r is typeof r & { completedAt: Date } =>
        r.completedAt !== null && (r.actualDurationSeconds ?? 0) > 0,
    );
    if (completedRows.length === 0)
      return { ok: false as const, reason: 'no_completed_sets' as const };

    // Derive finishedAt as the latest completedAt across sets, so summary and the
    // persisted record always agree (no drift from per-call new Date()).
    const finishedAt = deriveFinishedAt(completedRows);

    const summary = computeSummary({
      routineNameSnapshot: session.routineNameSnapshot,
      sets: setRows.map(rowToSet),
      startedAt: session.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
    return { ok: true as const, summary };
  });
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
    const completed = setRows.filter(
      (r): r is typeof r & { completedAt: Date; habitId: number } =>
        r.completedAt !== null && (r.actualDurationSeconds ?? 0) > 0 && r.habitId !== null,
    );
    if (completed.length === 0) return { ok: false, reason: 'no_completed_sets' as const };

    const now = new Date();
    const inserts = completed.map((r) => {
      const start = r.startedAt ?? new Date(now.getTime() - (r.actualDurationSeconds ?? 0) * 1000);
      const end = new Date(start.getTime() + (r.actualDurationSeconds ?? 0) * 1000);
      return {
        habitId: r.habitId,
        userId,
        startTime: start,
        endTime: end,
        durationSeconds: r.actualDurationSeconds!,
        timerMode: 'routine' as const,
        routineSessionId: session.id,
      };
    });
    // On (userId, startTime) conflict, prefer the newest values rather than silently
    // dropping. Concurrent or replayed saves are rare but real; doing nothing would
    // hide which write actually landed and could mask a stale duration.
    await tx
      .insert(timeSessions)
      .values(inserts)
      .onConflictDoUpdate({
        target: [timeSessions.userId, timeSessions.startTime],
        set: {
          habitId: sql`excluded.habit_id`,
          endTime: sql`excluded.end_time`,
          durationSeconds: sql`excluded.duration_seconds`,
          timerMode: sql`excluded.timer_mode`,
          routineSessionId: sql`excluded.routine_session_id`,
        },
      });

    // Persist finishedAt derived from the latest set completion so it matches the
    // value the summary endpoint reports.
    const finishedAt = deriveFinishedAt(completed);
    await tx
      .update(routineSessions)
      .set({ status: 'completed', finishedAt })
      .where(eq(routineSessions.id, session.id));

    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));

    return { ok: true, sessionId: session.id };
  });
}
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

    // Idempotency: a stale setRowId (replayed request, unmount/remount race in
    // RoutineSync) must not overwrite the recorded duration. Return the current
    // session as a no-op success so retries don't surface a misleading 404.
    if (setRow.completedAt) return await reloadActiveSession(tx, userId);

    const now = endedAt ?? new Date();

    // Compute actual duration: prefer the timer for cleanest math; fall back to set.startedAt.
    // Floor at 1s so a completed set always has nonzero duration — otherwise the row passes
    // the "completed" UI check but is filtered out of save/summary, silently losing data.
    const startedAt = setRow.startedAt ?? timerRow?.startTime ?? now;
    const elapsed = Math.max(1, Math.ceil((now.getTime() - startedAt.getTime()) / 1000));
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
      if (!isCompleted) return { conflict: 'set_locked' as const };
      // Floor at 1: a completed set with 0s gets filtered out of save/summary
      // (>0 check), making the row exist on disk but invisible to the user. The
      // route enforces min(1), but this is defense-in-depth for direct callers.
      update.actualDurationSeconds = Math.max(1, patch.actualDurationSeconds);
    }

    if (Object.keys(update).length === 0) return await reloadActiveSession(tx, userId);

    await tx
      .update(routineSessionSets)
      .set(update)
      .where(eq(routineSessionSets.id, setRow.id));

    return await reloadActiveSession(tx, userId);
  });
}
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
export async function userHasActiveRoutineSession(userId: number): Promise<boolean> {
  const row = await db
    .select({ id: routineSessions.id })
    .from(routineSessions)
    .where(and(eq(routineSessions.userId, userId), eq(routineSessions.status, 'active')))
    .get();
  return !!row;
}
