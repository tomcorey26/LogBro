import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const timeSessions = sqliteTable('time_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  timerMode: text('timer_mode').notNull().$type<'stopwatch' | 'countdown' | 'manual' | 'routine'>().$default(() => 'stopwatch'),
  routineSessionId: integer('routine_session_id').references(() => routineSessions.id, { onDelete: 'set null' }),
}, (table) => [
  uniqueIndex('time_sessions_user_start_uniq').on(table.userId, table.startTime),
]);

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const routineBlocks = sqliteTable('routine_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  notes: text('notes'),
  sets: text('sets').notNull(), // JSON: [{durationSeconds, breakSeconds}]
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const routineSessions = sqliteTable('routine_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  routineNameSnapshot: text('routine_name_snapshot').notNull(),
  status: text('status').notNull().$type<'active' | 'completed'>(),
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

export const activeTimers = sqliteTable('active_timers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  targetDurationSeconds: integer('target_duration_seconds'),
  // NOTE: cascade is aspirational — the live constraint is NO ACTION because
  // SQLite's `ALTER TABLE ADD COLUMN ... REFERENCES` (used in 0006) drops the
  // ON DELETE clause. Runtime cleanup is handled in routine-sessions.ts.
  routineSessionSetId: integer('routine_session_set_id').references(() => routineSessionSets.id, { onDelete: 'cascade' }),
  phase: text('phase').$type<'set' | 'break'>(),
});

export const usersRelations = relations(users, ({ many }) => ({
  habits: many(habits),
  activeTimers: many(activeTimers),
  routines: many(routines),
  routineSessions: many(routineSessions),
}));

export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  timeSessions: many(timeSessions),
  activeTimers: many(activeTimers),
  routineBlocks: many(routineBlocks),
}));

export const timeSessionsRelations = relations(timeSessions, ({ one }) => ({
  habit: one(habits, { fields: [timeSessions.habitId], references: [habits.id] }),
  user: one(users, { fields: [timeSessions.userId], references: [users.id] }),
}));

export const activeTimersRelations = relations(activeTimers, ({ one }) => ({
  habit: one(habits, { fields: [activeTimers.habitId], references: [habits.id] }),
  user: one(users, { fields: [activeTimers.userId], references: [users.id] }),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, { fields: [routines.userId], references: [users.id] }),
  blocks: many(routineBlocks),
}));

export const routineBlocksRelations = relations(routineBlocks, ({ one }) => ({
  routine: one(routines, { fields: [routineBlocks.routineId], references: [routines.id] }),
  habit: one(habits, { fields: [routineBlocks.habitId], references: [habits.id] }),
}));

export const routineSessionsRelations = relations(routineSessions, ({ one, many }) => ({
  user: one(users, { fields: [routineSessions.userId], references: [users.id] }),
  routine: one(routines, { fields: [routineSessions.routineId], references: [routines.id] }),
  sets: many(routineSessionSets),
}));

export const routineSessionSetsRelations = relations(routineSessionSets, ({ one }) => ({
  session: one(routineSessions, { fields: [routineSessionSets.sessionId], references: [routineSessions.id] }),
  habit: one(habits, { fields: [routineSessionSets.habitId], references: [habits.id] }),
}));
