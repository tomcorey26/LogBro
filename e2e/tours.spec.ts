import { test, expect } from '@playwright/test';
import { mockApi, makeHabit } from './mocks';

async function clearTourStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('tours.seen.'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  });
}

test.describe('First-visit tours', () => {
  test('shows the habits tour on first visit and persists dismissal', async ({ page }) => {
    const state = await mockApi(page);
    state.habits.push(makeHabit({ name: 'Guitar' }));
    await clearTourStorage(page);

    await page.goto('/habits');

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Welcome to LogBro');

    // Dismiss
    await page.locator('.driver-popover-close-btn').click();
    await expect(popover).toHaveCount(0);

    // Confirm flag was written
    const seen = await page.evaluate(() => localStorage.getItem('tours.seen.habits'));
    expect(seen).toBe('1');

    // Reload — tour must NOT reappear
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Habits' })).toBeVisible();
    await expect(page.locator('.driver-popover')).toHaveCount(0);
  });

  test('Replay tours button on /account resets seen flags', async ({ page }) => {
    await mockApi(page);
    await page.goto('/account');
    await page.evaluate(() => {
      localStorage.setItem('tours.seen.habits', '1');
      localStorage.setItem('tours.seen.routines', '1');
      localStorage.setItem('tours.seen.stats', '1');
    });

    await page.getByRole('button', { name: 'Replay tours' }).click();

    // We get redirected to /habits — verify storage was cleared
    await expect(page).toHaveURL(/\/habits$/);
    const after = await page.evaluate(() => ({
      habits: localStorage.getItem('tours.seen.habits'),
      routines: localStorage.getItem('tours.seen.routines'),
      stats: localStorage.getItem('tours.seen.stats'),
    }));
    expect(after).toEqual({ habits: null, routines: null, stats: null });
  });
});
