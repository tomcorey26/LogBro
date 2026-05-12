# Replace habit in a routine block

Let the user swap which habit a block points to from the edit routine page, without removing/recreating the block and without losing its sets, durations, breaks, or notes (unless they want to tweak them in the same flow).

## User-facing flow

1. On the edit routine page, each block's header action row collapses from `ChevronUp` / `ChevronDown` / `Trash2` icons into a single overflow button (`MoreHorizontal`).
2. Tapping ⋯ opens a `DropdownMenu` with: **Move up · Move down · Replace habit · Delete**. Move up/down are disabled at the edges. Delete still routes through the existing destructive `AlertDialog`.
3. **Replace habit** opens the existing `HabitPicker` dialog with title **`Replace "{habitName}"`** (current block's habit). List body unchanged from the add flow.
4. Picking a habit transitions the dialog to `HabitBlockConfigForm`, **prefilled** with the block's current `sets` / `durationSeconds` / `breakSeconds` / `notes`. Submit button reads **"Replace"** (vs. "Add" in the add flow).
5. Submit → block's `habitId`, `habitName`, `sets`, `notes` swap in atomically. `clientId` and array position are preserved. Routine marked dirty. Dialog closes.
6. Any dismiss path (close button, escape, backdrop click, back from config form) leaves the block unchanged.

The routine-level **Save** button is the only network write. Replace is a local mutation of builder state until Save fires.

## Architecture / components

### State machine: `PickerMode`

The picker dialog's state is consolidated into one discriminated union in `RoutineBuilder`:

```ts
type PickerView =
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };

type PickerMode =
  | { kind: "closed" }
  | { kind: "add"; view: PickerView }
  | { kind: "replace"; clientId: string; habitName: string; view: PickerView };
```

- Opening "Add Habits" → `{ kind: "add", view: { type: "list" } }`.
- Opening "Replace habit" → `{ kind: "replace", clientId, habitName, view: { type: "list" } }`.
- Closing (submit, cancel, escape, backdrop) → `{ kind: "closed" }` in one assignment.

This replaces the current `pickerOpen` + `pickerView` pair and prevents the "next Add flow accidentally prefills from a stale Replace" leak structurally — there's no separate `replaceTarget` to forget to clear.

### `useRoutineBuilder` change

One new method:

```ts
replaceBlock(
  clientId: string,
  input: { habitId: number; habitName: string; notes: string | null; sets: RoutineSet[] }
): void
```

- Finds the block by `clientId`, replaces `habitId` / `habitName` / `notes` / `sets`.
- Keeps `clientId` and the block's index in the `blocks` array.
- Each `set` gets a fresh `clientId` (sets are new objects).
- Calls `setIsDirty(true)`.

### `RoutineBlockCard` (editable mode) change

- Remove the three inline action buttons (move up, move down, delete).
- Add a single `MoreHorizontal` button that opens a `DropdownMenu` with four items: Move up, Move down, Replace habit, Delete.
- Move up/down disabled when `onMoveUp` / `onMoveDown` are undefined (existing edge logic).
- Delete item is destructive-styled and still triggers the existing `AlertDialog` for confirmation.
- New prop: `onReplace: () => void`.

### `RoutineBuilder` wiring

- Replace `pickerOpen` + `pickerView` with single `mode: PickerMode` state.
- `handleOpenPicker()` → set `mode = { kind: "add", view: { type: "list" } }`.
- `handleOpenReplace(block)` → set `mode = { kind: "replace", clientId: block.clientId, habitName: block.habitName, view: { type: "list" } }`.
- `handleSelectHabit(habit)` → if `mode.kind !== "closed"`, set `mode.view = { type: "config", habitId, habitName }`.
- `handleSubmitConfig(payload)` →
  - If `mode.kind === "add"`: `addBlock(payload)`.
  - If `mode.kind === "replace"`: `replaceBlock(mode.clientId, payload)`.
  - Then `mode = { kind: "closed" }`.
- `<Dialog open={mode.kind !== "closed"} onOpenChange={(open) => { if (!open) setMode({ kind: "closed" }); }}>`.

### `HabitPicker` change

- Accept optional `title?: string` prop (default `"Select Habit"`).
- Replace flow passes `Replace "${habitName}"`.

### `HabitBlockConfigForm` change

- Accept optional `initialValues?: { sets: number; durationMinutes: number; breakMinutes: number; notes: string | null }`.
- Accept optional `submitLabel?: string` (default `"Add"`; replace passes `"Replace"`).
- Internal `useState` initializers read from `initialValues` when present, else fall back to existing defaults.
- Caller derives `initialValues` from the current block when `mode.kind === "replace"` — the block's array of sets is collapsed to a single `(sets count, durationMinutes, breakMinutes)` tuple by using the **first set's** duration/break (existing form already only configures one shared duration/break for all sets at add time, so this is symmetric).

> **Note on lossy collapse:** If a block has heterogeneous sets (e.g., set 1 = 5 min, set 2 = 10 min), the config form can only represent uniform sets. Submitting Replace will rewrite all sets to the form's uniform value. This matches the form's existing semantic for Add. If the user wants to preserve heterogeneous sets, they should cancel out of the config form — the per-set stepper UI in the block card is the path for fine-grained editing.

### Backend

**No changes.** Replace is a client-side state mutation. The existing `PUT /api/routines/[id]` (in `src/app/api/routines/[id]/route.ts`) already accepts the full `{ name, blocks: [{ habitId, sortOrder, notes, sets }] }` payload and is invoked by the existing routine-level Save button via `useUpdateRoutine`.

## Data flow

```
User clicks ⋯ → Replace habit on block B
  └─ setMode({ kind: "replace", clientId: B.clientId, habitName: B.habitName,
               view: { type: "list" } })

User picks habit H from the list
  └─ setMode(prev => ({ ...prev, view: { type: "config", habitId: H.id, habitName: H.name } }))
     HabitBlockConfigForm renders with initialValues derived from B

User submits config form with payload P
  └─ replaceBlock(B.clientId, P)
     setMode({ kind: "closed" })

User clicks routine-level Save
  └─ PUT /api/routines/[id] with full builder payload (existing flow)
```

## Edge cases

- **Dismiss mid-flow** (close picker or back out of config form): `mode → closed`, block unchanged.
- **Pick the same habit**: allowed. Acts as a config-only edit if the user changes values; otherwise a no-op on submit. No special handling.
- **Pick a habit already used in another block**: allowed. Matches today's Add behavior (no dedup check exists).
- **Block with heterogeneous sets**: see lossy-collapse note above.
- **Routine in active session**: out of scope. The edit page mutates the routine definition; active sessions work from a session snapshot taken at start time.

## Testing

Unit tests on `useRoutineBuilder`:

- `replaceBlock` swaps `habitId` / `habitName` / `notes` / `sets`, preserves `clientId` and array index, flips `isDirty` to true.
- New set `clientId`s are generated (not reused from the previous block's sets).

Integration tests on `RoutineBuilder`:

- Open ⋯ menu on a block → click "Replace habit" → picker opens with title `Replace "<habitName>"`.
- Pick a different habit → config form opens prefilled with the block's sets count, first set's duration/break, and notes.
- Submit → block updates in place (same position), habit name visible in card, builder marked dirty.
- Cancel paths (close picker, back from config form, escape, backdrop click) all leave the block unchanged.
- **No state leak**: Open Replace on a block with non-default sets/notes → cancel → click "Add Habits" → pick any habit → assert config form shows defaults (1 set, 5 min, 0 break, blank notes), not values from the canceled Replace.
- ⋯ menu items have correct disabled state (Move up disabled on first block, Move down disabled on last).

Visual/behavioral spot checks:

- Tap targets on ⋯ button meet existing block-card sizing (matches `icon-sm`).
- DropdownMenu closes on item activation.
- Delete item still routes through the existing `AlertDialog`.
