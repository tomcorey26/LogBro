// e2e/routine-edit-nav-guard.spec.ts
import { test, expect } from '@playwright/test';
import { createHabit, createRoutine, resetUserState } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('Routine edit — unsaved-changes navigation guard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  test.afterEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  async function setupDirtyRoutineEdit(page: import('@playwright/test').Page) {
    const habitId = await createHabit(page, 'NavGuardHabit');
    const routineId = await createRoutine(page, 'NavGuard Routine', [
      {
        habitId,
        sortOrder: 0,
        notes: null,
        sets: [{ durationSeconds: 60, breakSeconds: 0 }],
      },
    ]);
    await page.goto(`/routines/${routineId}/edit`);
    // Make a dirty change: edit the routine name.
    const nameInput = page.getByPlaceholder('Untitled Routine');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('NavGuard Routine — edited');
    return { routineId };
  }

  test('in-app link click while dirty: cancel keeps URL, leave navigates', async ({ page }) => {
    const { routineId } = await setupDirtyRoutineEdit(page);

    // Click the TabNav "Habits" link.
    await page.getByRole('link', { name: 'Habits' }).first().click();

    // Dialog should be open and URL unchanged.
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Unsaved changes?')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/edit$`));

    // Cancel keeps user on the edit page.
    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/edit$`));

    // Try again, then "Leave" — should navigate to /habits.
    await page.getByRole('link', { name: 'Habits' }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: /^leave$/i }).click();
    await expect(page).toHaveURL(/\/habits$/);
  });

  test('browser back while dirty: cancel keeps URL, leave goes back', async ({ page }) => {
    const { routineId } = await setupDirtyRoutineEdit(page);

    await page.goBack();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/edit$`));

    await dialog.getByRole('button', { name: /^cancel$/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/edit$`));

    // Back again, this time confirm.
    await page.goBack();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('alertdialog').getByRole('button', { name: /^leave$/i }).click();
    await expect(page).not.toHaveURL(new RegExp(`/routines/${routineId}/edit$`));
  });

  test('clean state: link click navigates immediately, no dialog', async ({ page }) => {
    const habitId = await createHabit(page, 'CleanNavHabit');
    const routineId = await createRoutine(page, 'CleanNav Routine', [
      {
        habitId,
        sortOrder: 0,
        notes: null,
        sets: [{ durationSeconds: 60, breakSeconds: 0 }],
      },
    ]);
    await page.goto(`/routines/${routineId}/edit`);
    await expect(page.getByPlaceholder('Untitled Routine')).toBeVisible();

    await page.getByRole('link', { name: 'Habits' }).first().click();

    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page).toHaveURL(/\/habits$/);
  });

  test('save while dirty: no dialog, navigates to /routines', async ({ page }) => {
    await setupDirtyRoutineEdit(page);

    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page).toHaveURL(/\/routines$/);
  });
});
