import { test, expect } from '@playwright/test';
import { mockApi, makeHabit } from './mocks';
import { deleteAllHabits, stopTimer } from './helpers';

test.describe('Unified Timer Start', () => {
  test.beforeEach(async ({ page }) => {
    // SSR for /habits reads from the real DB (page.route can't intercept it).
    // Clear any habits left over from real-API tests first, so SSR returns the
    // same empty list the mocked client sees — otherwise React throws a
    // hydration mismatch and discards the tree mid-click.
    await page.goto('about:blank');
    await stopTimer(page);
    await deleteAllHabits(page);

    const piano = makeHabit({ name: 'Piano Practice' });
    await mockApi(page, { habits: [piano] });
    await page.goto('/habits');
  });

  test('starting in stopwatch mode begins recording', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.getByText('Recording...')).toBeVisible();
    await expect(page.locator('p').filter({ hasText: /\d{2}:\d{2}:\d{2}/ })).toBeVisible();
  });

  test('starting in countdown mode begins countdown', async ({ page }) => {
    await page.getByRole('button', { name: /start/i }).click();
    await page.getByRole('button', { name: 'Countdown' }).click();
    await page.getByRole('button', { name: /^start$/i }).click();

    await expect(page.locator('p').filter({ hasText: /2[45]:\d{2}/ })).toBeVisible();
  });
});
