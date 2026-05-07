import { and, desc, eq, gte } from "drizzle-orm";

import { db } from "@/db";
import { habits, routineSessions, timeSessions } from "@/db/schema";
import type { HistoryEntry, HistoryListItem } from "@/lib/types";

type HistoryFilters = {
  habitId?: string;
  range?: string;
};

type ManualHistoryInput = {
  userId: number;
  habitId: number;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
};

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

  // Group routine rows
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

export async function createManualHistoryEntry({
  userId,
  habitId,
  startTime,
  endTime,
  durationSeconds,
}: ManualHistoryInput) {
  const habit = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();

  if (!habit) return null;

  const [entry] = await db
    .insert(timeSessions)
    .values({
      habitId,
      userId,
      startTime,
      endTime,
      durationSeconds,
      timerMode: "manual",
    })
    .returning();

  return entry;
}

export async function deleteHistoryEntry(
  entryId: number,
  userId: number,
) {
  const [deleted] = await db
    .delete(timeSessions)
    .where(
      and(eq(timeSessions.id, entryId), eq(timeSessions.userId, userId)),
    )
    .returning();

  return deleted ?? null;
}

function getDateFilter(range?: string): Date | null {
  const now = new Date();

  if (range === "today") {
    const dateFilter = new Date(now);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  if (range === "week") {
    const dateFilter = new Date(now);
    dateFilter.setDate(dateFilter.getDate() - 7);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  if (range === "month") {
    const dateFilter = new Date(now);
    dateFilter.setMonth(dateFilter.getMonth() - 1);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  return null;
}
