import { test, expect, type Page } from '@playwright/test';
import {
  createHabit,
  createRoutine,
  resetUserState,
} from './helpers';

async function setupTestRoutineWithFastSets(
  page: Page,
  habitName: string,
  routineName: string,
) {
  const habitId = await createHabit(page, habitName);
  // Two short sets so the test runs fast. Min duration is 60s (Zod validates >= 60).
  // We end sets early via the UI to keep the test runtime tight.
  const routineId = await createRoutine(page, routineName, [
    {
      habitId,
      sortOrder: 0,
      notes: null,
      sets: [
        { durationSeconds: 60, breakSeconds: 0 },
        { durationSeconds: 60, breakSeconds: 0 },
      ],
    },
  ]);
  return { habitId, routineId };
}

// All routine-session tests share a single auth state (one user). Run serially
// to avoid races on `resetUserState` and unique-name constraints.
test.describe.configure({ mode: 'serial' });

test.describe('Routine Session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  test.afterEach(async ({ page }) => {
    await page.goto('about:blank');
    await resetUserState(page);
  });

  test('happy path: start routine, run sets, finish, save, see in history', async ({ page }) => {
    const routineName = 'E2E Happy Path Routine';
    const { routineId } = await setupTestRoutineWithFastSets(page, 'HappyHabit', routineName);

    await page.goto(`/routines/${routineId}`);
    await page.getByRole('button', { name: /^start routine$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/active$`));

    // Start first set (uses aria-label "Start set")
    await page.getByRole('button', { name: /^start set$/i }).first().click();
    // End it early
    await page.getByRole('button', { name: /^end set$/i }).click();

    // Wait for the second set's start button to be enabled
    await expect(page.getByRole('button', { name: /^start set$/i })).toBeEnabled();

    // Finish (toolbar button labeled "Finish")
    await page.getByRole('button', { name: /^finish$/i }).click();

    // Save from summary screen (button labeled "Save")
    await page.getByRole('button', { name: /^save$/i }).click();

    // Back on /routines
    await expect(page).toHaveURL(/\/routines$/);

    // History page shows the routine
    await page.goto('/history');
    await expect(page.getByText(routineName)).toBeVisible();
  });

  test('discard from toolbar removes the active session', async ({ page }) => {
    const { routineId } = await setupTestRoutineWithFastSets(
      page,
      'DiscardHabit',
      'E2E Discard Routine',
    );

    await page.goto(`/routines/${routineId}`);
    await page.getByRole('button', { name: /^start routine$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/active$`));

    // Toolbar "Discard"
    await page.getByRole('button', { name: /^discard$/i }).click();
    // Confirm in alertdialog
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^discard$/i })
      .click();

    await expect(page).toHaveURL(/\/routines$/);
    await expect(page.getByText(/routine in progress/i)).toHaveCount(0);
  });

  test('refresh mid-set persists state', async ({ page }) => {
    const { routineId } = await setupTestRoutineWithFastSets(
      page,
      'RefreshHabit',
      'E2E Refresh Routine',
    );

    await page.goto(`/routines/${routineId}`);
    await page.getByRole('button', { name: /^start routine$/i }).click();
    await page.getByRole('button', { name: /^start set$/i }).first().click();
    await expect(page.getByRole('button', { name: /^end set$/i })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /^end set$/i })).toBeVisible();
  });

  test('habit start buttons disabled during active routine', async ({ page }) => {
    const { routineId } = await setupTestRoutineWithFastSets(
      page,
      'DisabledHabit',
      'E2E Disabled Routine',
    );

    await page.goto(`/routines/${routineId}`);
    await page.getByRole('button', { name: /^start routine$/i }).click();
    await expect(page).toHaveURL(new RegExp(`/routines/${routineId}/active$`));

    await page.goto('/habits');
    await expect(page.getByText(/routine in progress/i)).toBeVisible();
    const startButtons = page.getByRole('button', { name: /^start$/i });
    const count = await startButtons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(startButtons.nth(i)).toBeDisabled();
    }
  });
});
