import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  activeTimers,
  habits,
  routineSessions,
  routineSessionSets,
  timeSessions,
} from "@/db/schema";
import type { Habit } from "@/lib/types";

export async function getHabitsForUser(userId: number): Promise<Habit[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const userHabits = await db
    .select({ id: habits.id, name: habits.name })
    .from(habits)
    .where(eq(habits.userId, userId))
    .orderBy(sql`COALESCE((SELECT MAX(${timeSessions.endTime}) FROM ${timeSessions} WHERE ${timeSessions.habitId} = ${habits.id}), ${habits.createdAt}) DESC`);

  return Promise.all(
    userHabits.map(async (habit) => {
      const [todayResult, totalResult, timer, streak] = await Promise.all([
        db
          .select({
            total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)`,
          })
          .from(timeSessions)
          .where(
            and(
              eq(timeSessions.habitId, habit.id),
              gte(timeSessions.endTime, todayStart),
            ),
          )
          .get(),
        db
          .select({
            total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)`,
          })
          .from(timeSessions)
          .where(eq(timeSessions.habitId, habit.id))
          .get(),
        db
          .select()
          .from(activeTimers)
          .where(and(eq(activeTimers.habitId, habit.id), eq(activeTimers.userId, userId)))
          .get(),
        computeStreak(habit.id),
      ]);

      return {
        id: habit.id,
        name: habit.name,
        todaySeconds: todayResult?.total ?? 0,
        totalSeconds: totalResult?.total ?? 0,
        streak,
        activeTimer: timer
          ? {
              startTime: timer.startTime.toISOString(),
              targetDurationSeconds: timer.targetDurationSeconds ?? null,
            }
          : null,
      };
    }),
  );
}

export function getHabitByIdForUser(habitId: number, userId: number) {
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();
}

export function getHabitByNameForUser(userId: number, name: string) {
  return db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        sql`LOWER(${habits.name}) = LOWER(${name})`
      )
    )
    .get();
}

export async function createHabitForUser(userId: number, name: string) {
  const [habit] = await db.insert(habits).values({ userId, name }).returning();
  return habit;
}

export async function deleteHabitForUser(habitId: number, userId: number) {
  const [deletedHabit] = await db
    .delete(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .returning();

  return deletedHabit ?? null;
}

export async function deleteHabitForUserGuarded(
  habitId: number,
  userId: number,
): Promise<
  | { ok: true; habit: typeof habits.$inferSelect }
  | { ok: false; reason: 'not_found' | 'habit_in_use' }
> {
  return db.transaction(async (tx) => {
    const inUse = await tx
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
    if (inUse) return { ok: false as const, reason: 'habit_in_use' as const };

    const [deletedHabit] = await tx
      .delete(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .returning();
    if (!deletedHabit) return { ok: false as const, reason: 'not_found' as const };
    return { ok: true as const, habit: deletedHabit };
  });
}

async function computeStreak(habitId: number): Promise<number> {
  const rows = await db
    .select({
      date: sql<string>`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')`,
    })
    .from(timeSessions)
    .where(eq(timeSessions.habitId, habitId))
    .groupBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')`)
    .orderBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime') DESC`);

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let expected = today;

  for (const row of rows) {
    const rowDate = new Date(`${row.date}T00:00:00`);
    const diffDays = Math.round(
      (expected.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      streak++;
      expected = new Date(expected.getTime() - 24 * 60 * 60 * 1000);
    } else if (diffDays === 1 && streak === 0) {
      streak++;
      expected = new Date(rowDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

const DEFAULT_HABITS = [
  "Meditation",
  "Coding",
  "Guitar",
  "Painting",
  "Reading",
  "Exercise",
  "Writing",
  "Cooking",
  "Language Study",
  "Chess",
];

export type SeededHabit = { id: number; name: string };

export async function seedDefaultHabits(userId: number): Promise<SeededHabit[]> {
  return db
    .insert(habits)
    .values(DEFAULT_HABITS.map((name) => ({ userId, name })))
    .returning({ id: habits.id, name: habits.name });
}
