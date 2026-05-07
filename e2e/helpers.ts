import { Page } from '@playwright/test';

/**
 * Create a habit via the real API. Returns the habit id.
 */
export async function createHabit(page: Page, name: string): Promise<number> {
  const res = await page.request.post('/api/habits', {
    data: { name },
  });
  const { habit } = await res.json();
  return habit.id;
}

/**
 * Start a timer via the real API.
 */
export async function startTimer(
  page: Page,
  habitId: number,
  opts?: { targetDurationSeconds?: number },
) {
  await page.request.post('/api/timer/start', {
    data: { habitId, ...opts },
  });
}

/**
 * Stop any active timer via the real API (cleanup).
 */
export async function stopTimer(page: Page) {
  await page.request.post('/api/timer/stop');
}

/**
 * Delete all habits for the current user (cleanup).
 */
export async function deleteAllHabits(page: Page) {
  const res = await page.request.get('/api/habits');
  const { habits } = await res.json();
  for (const habit of habits) {
    await page.request.delete(`/api/habits/${habit.id}`);
  }
}

/**
 * Intercept POST /api/timer/stop to track how many times it's called.
 * The request still hits the real server.
 */
export async function trackStopCalls(page: Page) {
  const calls: { timestamp: number }[] = [];
  await page.route('**/api/timer/stop', async (route) => {
    calls.push({ timestamp: Date.now() });
    await route.continue();
  });
  return calls;
}

export type RoutineBlockInput = {
  habitId: number;
  sortOrder: number;
  notes?: string | null;
  sets: Array<{ durationSeconds: number; breakSeconds: number }>;
};

/**
 * Create a routine via the real API. Returns the routine id.
 */
export async function createRoutine(
  page: Page,
  name: string,
  blocks: RoutineBlockInput[],
): Promise<number> {
  const res = await page.request.post('/api/routines', {
    data: { name, blocks },
  });
  if (!res.ok()) {
    throw new Error(`createRoutine failed: ${res.status()} ${await res.text()}`);
  }
  const { routine } = await res.json();
  return routine.id;
}

/**
 * Delete all routines for the current user (cleanup).
 */
export async function deleteAllRoutines(page: Page) {
  const res = await page.request.get('/api/routines');
  const { routines } = await res.json();
  for (const r of routines) {
    await page.request.delete(`/api/routines/${r.id}`);
  }
}

/**
 * Discard any active routine session for the current user (cleanup).
 * Idempotent — safe to call when nothing is active.
 */
export async function discardActiveRoutineSession(page: Page) {
  await page.request.post('/api/routines/active/discard');
}

/**
 * Start a routine session via the real API.
 */
export async function startRoutineSession(page: Page, routineId: number) {
  const res = await page.request.post(`/api/routines/${routineId}/start`);
  if (!res.ok()) {
    throw new Error(`startRoutineSession failed: ${res.status()} ${await res.text()}`);
  }
  return await res.json();
}

/**
 * Full reset: discard any active routine session, delete all routines, delete all habits.
 * Run this at the start (or end) of every routine-related test for a clean slate.
 */
export async function resetUserState(page: Page) {
  await discardActiveRoutineSession(page);
  await stopTimer(page);
  await deleteAllRoutines(page);
  await deleteAllHabits(page);
}
