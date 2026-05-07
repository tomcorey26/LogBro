import { test, expect } from '@playwright/test';
import { mockApi } from './mocks';

test.describe('Stats dashboard', () => {
  test('renders the five sections for a user with sessions', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.lifetime = { totalSeconds: 3 * 3600, totalSessions: 5 };
    state.stats.weekSeconds = 1800;
    state.stats.monthSeconds = 7200;
    state.stats.streak = { current: 3, longest: 7 };
    state.stats.rankings = [
      { rank: 1, habitId: 1, habitName: 'Guitar', totalSeconds: 3600 },
    ];
    // Minimal one-week grid so the heat map doesn't blow up the snapshot
    state.stats.heatmap = {
      weeks: [{
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-05-0${i + 1}`,
          seconds: i === 0 ? 600 : 0,
          bucket: (i === 0 ? 1 : 0) as 0 | 1,
          isFuture: false,
        })),
      }],
    };

    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: 'Stats' })).toBeVisible();
    await expect(page.getByText('Lifetime')).toBeVisible();
    await expect(page.getByText('Last 7 days')).toBeVisible();
    await expect(page.getByText('Last 30 days')).toBeVisible();
    await expect(page.getByText('Streaks')).toBeVisible();
    await expect(page.getByText('Last 12 months')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible();
    await expect(page.getByText('Guitar')).toBeVisible();
    await expect(page.getByText('3 days', { exact: false }).first()).toBeVisible(); // current streak
  });

  test('/rankings redirects to /stats', async ({ page }) => {
    await mockApi(page);
    await page.goto('/rankings');
    await expect(page).toHaveURL(/\/stats$/);
  });

  test('renders heatmap empty-state copy when zero sessions', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.heatmap = {
      weeks: [{
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-05-0${i + 1}`,
          seconds: 0,
          bucket: 0 as const,
          isFuture: false,
        })),
      }],
    };
    await page.goto('/stats');
    await expect(
      page.getByText('Log your first session to start your heat map.'),
    ).toBeVisible();
  });

  test('Show all reveals rankings beyond top 5', async ({ page }) => {
    const state = await mockApi(page);
    state.stats.rankings = Array.from({ length: 7 }, (_, i) => ({
      rank: i + 1,
      habitId: i + 1,
      habitName: `Skill ${i + 1}`,
      totalSeconds: (7 - i) * 600,
    }));
    state.stats.heatmap = { weeks: [] };
    await page.goto('/stats');

    await expect(page.getByText('Skill 1')).toBeVisible();
    await expect(page.getByText('Skill 5')).toBeVisible();
    await expect(page.getByText('Skill 6')).not.toBeVisible();

    await page.getByRole('button', { name: 'Show all (7)' }).click();
    await expect(page.getByText('Skill 6')).toBeVisible();
    await expect(page.getByText('Skill 7')).toBeVisible();
  });
});
