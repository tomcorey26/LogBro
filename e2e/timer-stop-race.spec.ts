import { test, expect } from '@playwright/test';
import { createHabit, startTimer, stopTimer, deleteAllHabits, trackStopCalls } from './helpers';

const HABIT_NAME = 'E2E-Race';

// All tests in this file share one auth state (one user) and reuse the same
// habit name. Run serially to avoid 409 conflicts on createHabit and races on
// the user's single active timer row.
test.describe.configure({ mode: 'serial' });

test.describe('Timer stop race condition', () => {
  let habitId: number;

  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await stopTimer(page);
    await deleteAllHabits(page);
    habitId = await createHabit(page, HABIT_NAME);
  });

  test.afterEach(async ({ page }) => {
    await stopTimer(page);
  });

  test('foreground: success screen when countdown finishes on /habits, exactly one stop call', async ({
    page,
  }) => {
    const stopCalls = await trackStopCalls(page);
    // 5s gives enough time for page to load and show countdown
    await startTimer(page, habitId, { targetDurationSeconds: 5 });

    await page.goto('/habits');

    await expect(page.getByText('Counting down...')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Session Complete!')).toBeVisible({ timeout: 15000 });

    // Foreground path uses success screen, not toast
    await expect(page.locator('[data-sonner-toast]')).not.toBeVisible();

    expect(stopCalls.length).toBe(1);
  });

  test('no double stop: navigating away mid-countdown fires exactly one stop call', async ({
    page,
  }) => {
    const stopCalls = await trackStopCalls(page);
    // 8s gives time to see countdown and navigate away before it expires
    await startTimer(page, habitId, { targetDurationSeconds: 8 });

    await page.goto('/habits');
    await expect(page.getByText('Counting down...')).toBeVisible({ timeout: 10000 });

    // Navigate away — TimerSync polling takes over
    await page.getByText('Back').click();

    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-sonner-toast]').first()).toContainText('session was recorded');

    expect(stopCalls.length).toBe(1);
  });

  test('stopwatch mode is not affected by auto-stop', async ({ page }) => {
    const stopCalls = await trackStopCalls(page);
    await startTimer(page, habitId);

    await page.goto('/habits');
    await expect(page.getByText('Recording...')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(3000);
    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.getByText('Session Complete!')).not.toBeVisible();

    expect(stopCalls.length).toBe(0);
  });
});
