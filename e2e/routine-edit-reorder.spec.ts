import { test, expect } from '@playwright/test';
import { createHabit, createRoutine, resetUserState } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Routine edit — reorder blocks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  test.afterEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  test('move-down on first block reorders and persists after save + reload', async ({ page }) => {
    const habitAId = await createHabit(page, 'AlphaHabit');
    const habitBId = await createHabit(page, 'BetaHabit');
    const routineId = await createRoutine(page, 'Reorder E2E Routine', [
      {
        habitId: habitAId,
        sortOrder: 0,
        notes: null,
        sets: [{ durationSeconds: 60, breakSeconds: 0 }],
      },
      {
        habitId: habitBId,
        sortOrder: 1,
        notes: null,
        sets: [{ durationSeconds: 60, breakSeconds: 0 }],
      },
    ]);

    await page.goto(`/routines/${routineId}/edit`);

    // Sanity: AlphaHabit appears before BetaHabit in the document
    const alphaHeading = page.getByRole('heading', { name: 'AlphaHabit' });
    const betaHeading = page.getByRole('heading', { name: 'BetaHabit' });
    await expect(alphaHeading).toBeVisible();
    await expect(betaHeading).toBeVisible();

    // Confirm initial order: AlphaHabit before BetaHabit
    const initialHeadings = page.getByRole('heading').filter({ hasText: /AlphaHabit|BetaHabit/ });
    await expect(initialHeadings.nth(0)).toHaveText('AlphaHabit');
    await expect(initialHeadings.nth(1)).toHaveText('BetaHabit');

    // Click "Move block down" on the first block (AlphaHabit). There are two such
    // buttons; the first one corresponds to AlphaHabit.
    const moveDownButtons = page.getByRole('button', { name: 'Move block down' });
    await moveDownButtons.first().click();

    // Save
    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page).toHaveURL(/\/routines$/);

    // Reload edit page; BetaHabit should now appear before AlphaHabit
    await page.goto(`/routines/${routineId}/edit`);
    const headings = page.getByRole('heading').filter({ hasText: /AlphaHabit|BetaHabit/ });
    await expect(headings.nth(0)).toHaveText('BetaHabit');
    await expect(headings.nth(1)).toHaveText('AlphaHabit');
  });
});
