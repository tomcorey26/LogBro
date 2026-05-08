# Routine Edit Navigation Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warn users before leaving the routine builder (create or edit) when there are unsaved changes — for browser back/forward, in-app `<Link>` clicks, and tab close/refresh.

**Architecture:** New `useNavigationGuard` hook owns all three triggers. It (a) reuses the existing `beforeunload` for hard nav, (b) pushes a sentinel `history` entry then listens to `popstate` for back/forward, (c) intercepts internal anchor clicks at the document level in capture phase. `RoutineBuilder` wires the hook to the existing `AlertDialog` via a `pendingNavigate` closure.

**Tech Stack:** Next.js App Router, React, Playwright (e2e), TypeScript.

---

## File Structure

| File | Purpose |
| --- | --- |
| `src/hooks/use-navigation-guard.ts` (new) | The hook. One responsibility: detect attempted nav-aways while guarded and surface them via `onAttempt(proceed)`. |
| `src/components/RoutineBuilder.tsx` (modify) | Drop local `beforeunload`, wire hook to existing AlertDialog with a `pendingNavigate` closure, update dialog text. |
| `e2e/routine-edit-nav-guard.spec.ts` (new) | E2E coverage for the three positive scenarios + clean-state pass-through + save-bypass. |

---

## Task 1: E2E tests (failing first)

**Files:**
- Create: `e2e/routine-edit-nav-guard.spec.ts`

- [ ] **Step 1.1: Create the failing test file**

```ts
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

    // The "edit" page was reached via page.goto, so there is a prior history entry
    // (about:blank). Push a known prior page to make `goBack` deterministic:
    // (Navigate via the API URL? Just rely on goBack — the sentinel keeps us pinned.)
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
```

- [ ] **Step 1.2: Run the new e2e file and confirm the first three tests fail**

Run: `npx playwright test e2e/routine-edit-nav-guard.spec.ts --reporter=list`

Expected:
- "in-app link click while dirty…" — FAIL (no dialog appears, URL changes immediately).
- "browser back while dirty…" — FAIL (no dialog).
- "clean state…" — PASS.
- "save while dirty…" — PASS.

If "clean state" or "save while dirty" fail, stop and investigate before continuing — they should already work.

- [ ] **Step 1.3: Commit the failing tests**

```bash
git add e2e/routine-edit-nav-guard.spec.ts
git commit -m "test(e2e): add failing nav-guard tests for dirty routine edit"
```

---

## Task 2: Implement `useNavigationGuard` hook

**Files:**
- Create: `src/hooks/use-navigation-guard.ts`

- [ ] **Step 2.1: Write the hook**

```ts
// src/hooks/use-navigation-guard.ts
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type NavigationAttempt =
  | { type: "back" }
  | { type: "link"; href: string };

type Options = {
  shouldGuard: boolean;
  onAttempt: (attempt: NavigationAttempt, proceed: () => void) => void;
};

const SENTINEL_KEY = "__routine_builder_nav_guard__";

export function useNavigationGuard({ shouldGuard, onAttempt }: Options) {
  const router = useRouter();
  // Keep a ref so listeners always read the latest callback without re-binding.
  const onAttemptRef = useRef(onAttempt);
  useEffect(() => {
    onAttemptRef.current = onAttempt;
  }, [onAttempt]);

  useEffect(() => {
    if (!shouldGuard) return;

    // 1. beforeunload — tab close, refresh, address bar, external link.
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Older Safari needs a return value set to trigger the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);

    // 2. popstate sentinel — push a duplicate state so back/forward fires popstate
    //    while keeping the user on the same URL. On popstate, push another
    //    sentinel to stay, then surface the attempt.
    history.pushState({ [SENTINEL_KEY]: true }, "", location.href);
    const onPopState = () => {
      // Re-pin the user before showing the dialog.
      history.pushState({ [SENTINEL_KEY]: true }, "", location.href);
      onAttemptRef.current({ type: "back" }, () => {
        // Pop the sentinel (current pushed state) so history.back() lands on
        // the original previous entry the user wanted.
        history.go(-2);
      });
    };
    window.addEventListener("popstate", onPopState);

    // 3. In-app anchor click capture.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const path = e.composedPath ? e.composedPath() : [];
      let anchor: HTMLAnchorElement | null = null;
      for (const node of path) {
        if (node instanceof HTMLAnchorElement) {
          anchor = node;
          break;
        }
      }
      if (!anchor) return;
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#")) return;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Resolve to URL to detect external origin.
      let url: URL;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;

      e.preventDefault();
      const target = url.pathname + url.search + url.hash;
      onAttemptRef.current({ type: "link", href: target }, () => {
        router.push(target);
      });
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", onClick, true);
    };
  }, [shouldGuard, router]);
}
```

- [ ] **Step 2.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors related to the new file.

- [ ] **Step 2.3: Commit the hook (without integration yet)**

```bash
git add src/hooks/use-navigation-guard.ts
git commit -m "feat(routines): add useNavigationGuard hook"
```

---

## Task 3: Wire hook into `RoutineBuilder` and update dialog text

**Files:**
- Modify: `src/components/RoutineBuilder.tsx` (drop existing `beforeunload` effect at lines 85-92, add hook + pendingNavigate, update dialog text)

- [ ] **Step 3.1: Replace the `beforeunload` effect and discard handlers**

Open `src/components/RoutineBuilder.tsx`. Apply these edits:

a) Add the hook import near the other hook imports (after the `use-haptics` import):

```tsx
import { useNavigationGuard, type NavigationAttempt } from "@/hooks/use-navigation-guard";
```

b) Replace the existing `beforeunload` effect block (the one that begins with `// beforeunload handler`) and the two existing handlers `handleDiscard` / `handleConfirmDiscard`:

```tsx
const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);

useNavigationGuard({
  shouldGuard: isDirty,
  onAttempt: (_attempt: NavigationAttempt, proceed) => {
    setPendingNavigate(() => proceed);
    setShowDiscardDialog(true);
  },
});

function handleDiscard() {
  if (isDirty) {
    setPendingNavigate(() => () => router.push("/routines"));
    setShowDiscardDialog(true);
  } else {
    router.push("/routines");
  }
}

function handleConfirmDiscard() {
  setShowDiscardDialog(false);
  builder.markClean();
  const nav = pendingNavigate ?? (() => router.push("/routines"));
  setPendingNavigate(null);
  nav();
}
```

c) Add a cancel handler that clears the pending nav:

```tsx
function handleCancelDiscard() {
  setShowDiscardDialog(false);
  setPendingNavigate(null);
}
```

d) Update the dialog JSX. Change:
- `<AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>` → `<AlertDialog open={showDiscardDialog} onOpenChange={(open) => { if (!open) handleCancelDiscard(); }}>`
- `<AlertDialogTitle>Discard changes?</AlertDialogTitle>` → `<AlertDialogTitle>Unsaved changes?</AlertDialogTitle>`
- `<AlertDialogDescription>You have unsaved changes. Are you sure you want to discard them?</AlertDialogDescription>` → `<AlertDialogDescription>You have unsaved changes. If you leave now, they will be lost.</AlertDialogDescription>`
- `<AlertDialogAction variant="destructive" onClick={handleConfirmDiscard}>Discard</AlertDialogAction>` → `<AlertDialogAction variant="destructive" onClick={handleConfirmDiscard}>Leave</AlertDialogAction>`

e) Leave the sticky-header "Discard" button label alone — that's a separate explicit-discard affordance, not the dialog body.

- [ ] **Step 3.2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3.3: Run e2e suite, expect all four nav-guard tests to pass**

Run: `npx playwright test e2e/routine-edit-nav-guard.spec.ts --reporter=list`
Expected: all 4 tests PASS.

If a test fails:
- Link-click test failing because dialog has wrong title → re-check Step 3.1(d).
- Back-button test loops forever / lands wrong → re-check `history.go(-2)` semantics in `use-navigation-guard.ts`.

- [ ] **Step 3.4: Run the full e2e suite to catch regressions**

Run: `npx playwright test --reporter=list`
Expected: full suite passes (in particular, `routine-edit-reorder.spec.ts` and `routine-session.spec.ts` should still pass).

- [ ] **Step 3.5: Run unit tests**

Run: `npm run test:unit`
Expected: pass.

- [ ] **Step 3.6: Lint**

Run: `npm run lint`
Expected: pass.

- [ ] **Step 3.7: Commit**

```bash
git add src/components/RoutineBuilder.tsx
git commit -m "feat(routines): guard nav-away from dirty routine edits"
```

---

## Self-Review

1. **Spec coverage:**
   - Tab close / refresh / external link → preserved in hook (Task 2 Step 2.1, beforeunload block).
   - Browser back / forward → Task 2 (popstate sentinel) + Task 1 e2e test.
   - In-app `<Link>` clicks → Task 2 (click capture) + Task 1 e2e test.
   - Save flow not blocked → Task 1 e2e test "save while dirty".
   - Delete flow not blocked → unchanged (delete handler doesn't touch `pendingNavigate`).
   - Programmatic `router.push` from outside builder → out of scope per spec; not implemented.
   - Dialog text "Unsaved changes?" / "Leave" → Task 3 Step 3.1(d).
2. **Placeholder scan:** none — every step has concrete code or a concrete command.
3. **Type consistency:** `NavigationAttempt`, `useNavigationGuard`, `markClean`, `pendingNavigate` names all consistent across Tasks 2 and 3.
