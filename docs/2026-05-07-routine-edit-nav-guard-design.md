# Navigation Guard for Dirty Routine Edits — Design

## Goal

Prevent accidental loss of unsaved work in the routine builder (`/routines/new`, `/routines/[id]/edit`) by warning the user before any client-side or browser navigation away from the page when `isDirty === true`.

## Scope

Both create and edit modes share `RoutineBuilder`, so a single guard covers both.

### Triggers handled

| Trigger | Today | Plan |
| --- | --- | --- |
| Tab close, page refresh, address bar, external link | `beforeunload` at `RoutineBuilder.tsx:85-92` | Move into hook, no behavior change |
| Browser back / forward button | Not handled | Sentinel `pushState` + `popstate` listener |
| In-app `<Link>` click (TabNav, etc.) | Not handled | Document-level click-capture on internal anchors |
| Programmatic `router.push` from outside builder | Not handled | Out of scope (no current call sites; additional complexity not justified) |
| Save flow (`router.replace("/routines")`) | Calls `markClean()` first | No change — guard already won't trigger |
| Delete flow | Confirmed via own dialog | No change — user already opted into destruction |

## Architecture

### New hook: `src/hooks/use-navigation-guard.ts`

```ts
type NavigationAttempt =
  | { type: "back" }
  | { type: "link"; href: string };

useNavigationGuard({
  shouldGuard: boolean,
  onAttempt: (attempt: NavigationAttempt, proceed: () => void) => void,
});
```

Responsibilities:

1. **`beforeunload`** — when `shouldGuard`, attach handler that calls `e.preventDefault()` (and `e.returnValue = ""` for older Safari).
2. **`popstate` sentinel** — when `shouldGuard` becomes `true`, push a duplicate-URL state. On `popstate`, push another duplicate to keep the user on the page, then call `onAttempt({ type: "back" }, () => history.back())`.
3. **Document click capture** — listener on `document` (capture phase). Walks from `e.target` up to the closest `<a>`. Skips and lets the click through if any of:
   - `e.defaultPrevented`
   - modifier keys (`metaKey`, `ctrlKey`, `shiftKey`, `altKey`)
   - middle / right click (`button !== 0`)
   - `target="_blank"` or `_top` etc.
   - `download` attribute
   - missing href, hash-only same-page (`href` starts with `#`)
   - external origin
   Otherwise: `e.preventDefault()`, call `onAttempt({ type: "link", href }, () => router.push(href))`.

Cleanup on unmount and on `shouldGuard` flipping to `false`.

### `RoutineBuilder.tsx` changes

- Remove local `beforeunload` effect (lines 85-92).
- Add `pendingNavigate: (() => void) | null` state.
- Wire `useNavigationGuard({ shouldGuard: isDirty, onAttempt })`.
- `onAttempt(_, proceed)`: setPendingNavigate(() => proceed); setShowDiscardDialog(true).
- `handleConfirmDiscard()`: existing path goes to `/routines`. New behavior — if `pendingNavigate` is set, run it; otherwise default to `router.push("/routines")`. Always `builder.markClean()` first so the guard doesn't re-fire mid-navigation.
- Cancel path: `pendingNavigate = null`.
- Dialog text: title `Discard changes?` → `Unsaved changes?`; button `Discard` → `Leave`. The dialog is also reused by the explicit Discard button in the sticky header — "Leave" still reads correctly there since that action also leaves the editor.

## Tests

E2E only (per discussion — guard is browser-integration heavy):

`e2e/routine-edit-nav-guard.spec.ts`

1. **Link click guard** — open existing routine for edit, change name, click TabNav "Habits" link → dialog appears, URL unchanged → click "Cancel" → still on `/routines/[id]/edit` → click TabNav again → "Leave" → land on `/habits`.
2. **Back button guard** — same setup, dirty change, `page.goBack()` → dialog appears, URL unchanged → "Cancel" → still on edit page → goBack again → "Leave" → on `/routines`.
3. **Clean state** — open routine for edit, do not change anything, click TabNav "Habits" → no dialog, lands on `/habits` immediately.
4. **Save bypasses guard** — dirty change, click Save → no dialog, lands on `/routines`.

## Files

| File | Action |
| --- | --- |
| `src/hooks/use-navigation-guard.ts` | new |
| `src/components/RoutineBuilder.tsx` | edit |
| `e2e/routine-edit-nav-guard.spec.ts` | new |

## Decisions

- **Reuse existing AlertDialog** rather than native `confirm()`. Native dialog can't be invoked synchronously for in-app routing cleanly, and modern browsers strip custom messages from `beforeunload` anyway.
- **Hybrid native + custom**: `beforeunload` for tab close (browser does not allow custom UI before unload); custom AlertDialog for client-side nav.
- **No guard for programmatic `router.push`** from outside the builder. No current call sites; would force a global guard registry.

## Out of scope

- Routes other than the routine builder.
- Persisted drafts to localStorage.
- Re-show prompt if the user navigates back to the editor with unsaved-but-stashed changes.
