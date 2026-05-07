import { test, expect } from '@playwright/test';
import { createHabit, startTimer, stopTimer, deleteAllHabits } from './helpers';

const HABIT_NAME = 'E2E-AutoStop';

// All tests in this file share one auth state (one user) and reuse the same
// habit name. Run serially to avoid 409 conflicts on createHabit and races on
// the user's single active timer row.
test.describe.configure({ mode: 'serial' });

test.describe('Countdown Auto-Stop', () => {
  let habitId: number;

  test.beforeEach(async ({ page }) => {
    // Navigate to blank page to stop any TimerSync polling from prior tests
    await page.goto('about:blank');
    await stopTimer(page);
    await deleteAllHabits(page);
    habitId = await createHabit(page, HABIT_NAME);
  });

  test.afterEach(async ({ page }) => {
    await stopTimer(page);
  });

  test('auto-stops and shows success screen when countdown finishes on /habits', async ({ page }) => {
    // Use 5s so the page has time to hydrate and show countdown before it expires
    await startTimer(page, habitId, { targetDurationSeconds: 5 });
    await page.goto('/habits');

    await expect(page.getByText('Counting down...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Session Complete!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /back to habits/i })).toBeVisible();
  });

  test('shows toast when timer expired while user was away (non-habits page)', async ({ page }) => {
    // 5s is the minimum allowed by the API
    await startTimer(page, habitId, { targetDurationSeconds: 5 });
    await page.waitForTimeout(6000);

    // Navigate to a non-habits page — TimerSync hydrates and polling stops it
    await page.goto('/history');

    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('session was recorded');
  });

  test('shows success screen when timer expired while user was away (habits page)', async ({ page }) => {
    await startTimer(page, habitId, { targetDurationSeconds: 5 });
    await page.waitForTimeout(6000);

    // Navigate to habits — TimerView mounts, detects expired, shows success screen
    await page.goto('/habits');

    await expect(page.getByText('Session Complete!')).toBeVisible({ timeout: 10000 });
  });

  test('stopwatch is not affected by auto-stop logic', async ({ page }) => {
    await startTimer(page, habitId);
    await page.goto('/habits');

    await expect(page.getByText('Recording...')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(3000);
    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.getByText('Session Complete!')).not.toBeVisible();
  });
});
