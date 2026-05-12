# Replace Habit in Routine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Replace habit" action to each block in the edit-routine page so the user can swap which habit a block points to, with the current configuration (sets, durations, breaks, notes) prefilled into the same flow used for adding habits.

**Architecture:** Pure client-side state mutation on the existing `useRoutineBuilder` builder state — no API changes. A single `PickerMode` discriminated union in `RoutineBuilder` owns whether the picker is closed, in add mode, or in replace mode (with target `clientId`), so dialog close always resets to a clean state and the next "Add Habits" never inherits stale prefill. The action lives behind a per-block overflow menu (⋯) that replaces today's inline move-up/move-down/delete icons.

**Tech Stack:** Next.js 16 (App Router), React 19, radix-ui (DropdownMenu primitive), Vitest + React Testing Library, Tailwind, framer-motion (already wired for reorder).

**Spec:** `docs/superpowers/specs/2026-05-12-replace-habit-in-routine-design.md`

---

## File Structure

**Modify:**
- `src/hooks/use-routine-builder.ts` — add `replaceBlock` method.
- `src/hooks/use-routine-builder.test.ts` — add tests for `replaceBlock`.
- `src/components/HabitPicker.tsx` — accept optional `title` prop.
- `src/components/HabitBlockConfigForm.tsx` — accept optional `initialValues` and `submitLabel` props.
- `src/components/RoutineBlockCard.tsx` — replace inline action icons with overflow `DropdownMenu`. Add `onReplace` prop.
- `src/components/RoutineBlockCard.test.tsx` — update existing button-by-name tests to drive through the dropdown menu; add Replace menu item test.
- `src/components/RoutineBuilder.tsx` — replace `pickerOpen` + `pickerView` with single `PickerMode` state; wire Replace flow.

**Create:**
- `src/components/ui/dropdown-menu.tsx` — shadcn-style wrapper around `radix-ui`'s DropdownMenu primitive (matches existing `alert-dialog.tsx` / `dialog.tsx` patterns).
- `src/components/RoutineBuilder.test.tsx` — new integration tests covering Replace flow + the no-state-leak scenario.

---

## Task 1: Add `replaceBlock` to `useRoutineBuilder`

**Files:**
- Modify: `src/hooks/use-routine-builder.ts`
- Test: `src/hooks/use-routine-builder.test.ts`

- [ ] **Step 1: Write the failing tests**

Add at the end of `src/hooks/use-routine-builder.test.ts`, before the closing `});` of the outer `describe`:

```ts
  describe("replaceBlock", () => {
    it("swaps habitId/habitName/notes/sets in place and marks dirty", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: "Scales",
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        })
      );
      const originalClientId = result.current.blocks[0].clientId;

      act(() =>
        result.current.replaceBlock(originalClientId, {
          habitId: 2,
          habitName: "Reading",
          notes: "Chapter 3",
          sets: [
            { durationSeconds: 900, breakSeconds: 0 },
            { durationSeconds: 900, breakSeconds: 0 },
          ],
        })
      );

      expect(result.current.blocks).toHaveLength(1);
      expect(result.current.blocks[0].clientId).toBe(originalClientId);
      expect(result.current.blocks[0].habitId).toBe(2);
      expect(result.current.blocks[0].habitName).toBe("Reading");
      expect(result.current.blocks[0].notes).toBe("Chapter 3");
      expect(result.current.blocks[0].sets).toHaveLength(2);
      expect(result.current.blocks[0].sets[0].durationSeconds).toBe(900);
      expect(result.current.isDirty).toBe(true);
    });

    it("preserves block position when other blocks exist", () => {
      const { result } = createHook();
      act(() => {
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 2, habitName: "Reading", notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        });
      });
      act(() => {
        result.current.addBlock({
          habitId: 3, habitName: "Pushups", notes: null,
          sets: [{ durationSeconds: 60, breakSeconds: 30 }],
        });
      });

      const middleClientId = result.current.blocks[1].clientId;
      act(() =>
        result.current.replaceBlock(middleClientId, {
          habitId: 9,
          habitName: "Meditation",
          notes: null,
          sets: [{ durationSeconds: 600, breakSeconds: 0 }],
        })
      );

      expect(result.current.blocks.map((b) => b.habitName)).toEqual([
        "Guitar",
        "Meditation",
        "Pushups",
      ]);
      expect(result.current.blocks[1].clientId).toBe(middleClientId);
    });

    it("generates fresh clientIds for the new sets", () => {
      const { result } = createHook();
      act(() =>
        result.current.addBlock({
          habitId: 1, habitName: "Guitar", notes: null,
          sets: [
            { durationSeconds: 1500, breakSeconds: 300 },
            { durationSeconds: 1500, breakSeconds: 300 },
          ],
        })
      );
      const oldSetClientIds = result.current.blocks[0].sets.map((s) => s.clientId);

      act(() =>
        result.current.replaceBlock(result.current.blocks[0].clientId, {
          habitId: 2,
          habitName: "Reading",
          notes: null,
          sets: [{ durationSeconds: 900, breakSeconds: 0 }],
        })
      );

      const newSetClientIds = result.current.blocks[0].sets.map((s) => s.clientId);
      for (const id of newSetClientIds) {
        expect(oldSetClientIds).not.toContain(id);
      }
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/use-routine-builder.test.ts`
Expected: 3 new tests FAIL with `result.current.replaceBlock is not a function`.

- [ ] **Step 3: Add `replaceBlock` implementation**

In `src/hooks/use-routine-builder.ts`, add the function inside the hook body (alongside `removeBlock`):

```ts
  function replaceBlock(
    clientId: string,
    input: { habitId: number; habitName: string; notes: string | null; sets: RoutineSet[] }
  ) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.clientId === clientId
          ? {
              ...b,
              habitId: input.habitId,
              habitName: input.habitName,
              notes: input.notes,
              sets: input.sets.map((s) => ({ ...s, clientId: generateId() })),
            }
          : b
      )
    );
    setIsDirty(true);
  }
```

Add `replaceBlock` to the returned object at the bottom of the hook:

```ts
  return {
    routineId,
    name,
    blocks,
    isDirty,
    markClean,
    setName,
    addBlock,
    removeBlock,
    replaceBlock,
    updateBlockNotes,
    addSet,
    removeSet,
    updateSetDuration,
    updateSetBreak,
    moveBlock,
    reorderBlocks,
    toPayload,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/use-routine-builder.test.ts`
Expected: All tests (existing + 3 new) PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-routine-builder.ts src/hooks/use-routine-builder.test.ts
git commit -m "feat(routines): add replaceBlock to routine builder"
```

---

## Task 2: Add `dropdown-menu` UI primitive

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`

This wraps `radix-ui`'s `DropdownMenu` primitive in the same style as the existing `alert-dialog.tsx` / `dialog.tsx` wrappers. It is consumed by Task 3.

- [ ] **Step 1: Create the primitive file**

Create `src/components/ui/dropdown-menu.tsx`:

```tsx
"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPortal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-md",
          className
        )}
        {...props}
      />
    </DropdownMenuPortal>
  )
}

function DropdownMenuItem({
  className,
  variant = "default",
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
```

(Re-exports `Check`/`ChevronRight`/`Circle` from `lucide-react` are imported but unused here — they appear in fuller shadcn variants. Safe to drop; eslint will warn. To keep the file clean, **delete the `Check, ChevronRight, Circle` import** before saving.)

> **Note:** This component is consumed in Task 3. There is no standalone unit test for it — it is a thin wrapper over a battle-tested primitive. Coverage is provided by the `RoutineBlockCard` tests in Task 3.

- [ ] **Step 2: Verify it compiles (typecheck via build OR vitest)**

Run: `npx vitest run --reporter=verbose --no-coverage 2>&1 | head -5`
Expected: No TS errors from `src/components/ui/dropdown-menu.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx
git commit -m "feat(ui): add dropdown-menu primitive"
```

---

## Task 3: Refactor `RoutineBlockCard` header to use overflow menu

**Files:**
- Modify: `src/components/RoutineBlockCard.tsx`
- Test: `src/components/RoutineBlockCard.test.tsx`

The existing inline icons (`ChevronUp`, `ChevronDown`, `Trash2`) collapse into a single `MoreHorizontal` button that opens a `DropdownMenu` with **Move up · Move down · Replace habit · Delete**. Delete still routes through the existing destructive `AlertDialog`.

- [ ] **Step 1: Rewrite the existing tests + add Replace test**

Replace the contents of `src/components/RoutineBlockCard.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { DragControls } from 'framer-motion';
import { RoutineBlockCard } from './RoutineBlockCard';
import type { BuilderBlock } from '@/lib/types';

const baseBlock: BuilderBlock = {
  clientId: 'c1',
  habitId: 1,
  habitName: 'Guitar',
  notes: null,
  sets: [{ clientId: 's1', durationSeconds: 60, breakSeconds: 0 }],
};

const noopHandlers = {
  onRemoveBlock: () => {},
  onAddSet: () => {},
  onRemoveSet: () => {},
  onUpdateDuration: () => {},
  onUpdateBreak: () => {},
  onUpdateNotes: () => {},
  onReplace: () => {},
};

function fakeDragControls(): DragControls {
  return { start: vi.fn() } as unknown as DragControls;
}

describe('RoutineBlockCard editable', () => {
  it('renders a reorder handle when dragControls is provided', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        dragControls={fakeDragControls()}
        {...noopHandlers}
      />
    );
    expect(screen.getByRole('button', { name: /reorder block/i })).toBeInTheDocument();
  });

  it('does not render a reorder handle when dragControls is omitted', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.queryByRole('button', { name: /reorder block/i })).not.toBeInTheDocument();
  });

  it('renders the block actions overflow trigger', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /block actions/i })).toBeInTheDocument();
  });

  it('Move up menu item is enabled and calls onMoveUp when onMoveUp provided', async () => {
    const user = userEvent.setup();
    const onMoveUp = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveUp={onMoveUp}
        {...noopHandlers}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move up/i });
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('Move up menu item is disabled when onMoveUp is missing', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move up/i });
    expect(item).toHaveAttribute('data-disabled');
  });

  it('Move down menu item is enabled and calls onMoveDown when onMoveDown provided', async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveDown={onMoveDown}
        {...noopHandlers}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move down/i });
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('Move down menu item is disabled when onMoveDown is missing', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    const item = await screen.findByRole('menuitem', { name: /move down/i });
    expect(item).toHaveAttribute('data-disabled');
  });

  it('Replace habit menu item calls onReplace', async () => {
    const user = userEvent.setup();
    const onReplace = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        {...noopHandlers}
        onReplace={onReplace}
      />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it('Delete menu item opens the destructive confirmation dialog', async () => {
    const user = userEvent.setup();
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^delete$/i }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/remove block\?/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RoutineBlockCard.test.tsx`
Expected: Tests for the overflow trigger / menu items FAIL (no such elements yet). Existing "reorder handle" tests should still pass.

- [ ] **Step 3: Refactor `RoutineBlockCard.tsx` header**

In `src/components/RoutineBlockCard.tsx`:

1. Update the `EditableProps` type to add `onReplace`:

```ts
type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (
    clientId: string,
    setIndex: number,
    durationSeconds: number,
  ) => void;
  onUpdateBreak: (
    clientId: string,
    setIndex: number,
    breakSeconds: number,
  ) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  onReplace: () => void;
  dragControls?: DragControls;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};
```

2. Update imports — remove `ChevronUp`, `ChevronDown` from the icons row, add `MoreHorizontal` and `Repeat2`, and import the new dropdown primitives:

```tsx
import {
  Trash2,
  Pause,
  NotebookPen,
  Plus,
  MinusCircle,
  GripVertical,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Repeat2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

3. Add local state at the top of `RoutineBlockCard` for the delete confirmation (since the `AlertDialogTrigger` pattern can't be inside a `DropdownMenuItem` cleanly — the menu would close and unmount the trigger). Use a controlled `AlertDialog`:

At the top of the file, add `useState` to the existing react import (or add the import if absent):

```ts
import { useState } from "react";
```

Inside the function, before `const { block, mode } = props;`:

```tsx
const [deleteOpen, setDeleteOpen] = useState(false);
```

> The inner `AlertDialogTrigger` used by the per-set "remove last set" confirmation (around the `MinusCircle` button) is unchanged — keep `AlertDialogTrigger` in the imports.

4. Replace the entire header action `<div>` block (the section currently containing the `ChevronUp`/`ChevronDown`/`Trash2` buttons, lines ~147–195) with:

```tsx
        {isEditable && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Block actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!onMoveUp}
                  onSelect={() => onMoveUp?.()}
                >
                  <ArrowUp className="h-4 w-4" />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!onMoveDown}
                  onSelect={() => onMoveDown?.()}
                >
                  <ArrowDown className="h-4 w-4" />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => (props as EditableProps).onReplace()}
                >
                  <Repeat2 className="h-4 w-4" />
                  Replace habit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove block?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove &ldquo;{block.habitName}&rdquo; and all its
                    sets from the routine.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      (props as EditableProps).onRemoveBlock(block.clientId)
                    }
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
```

(Keep the `AlertDialogTrigger` import — the per-set remove dialog inside the set row still uses it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RoutineBlockCard.test.tsx`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBlockCard.tsx src/components/RoutineBlockCard.test.tsx
git commit -m "feat(routines): collapse block actions into overflow menu, add Replace habit"
```

---

## Task 4: `HabitPicker` accepts optional `title`

**Files:**
- Modify: `src/components/HabitPicker.tsx`

- [ ] **Step 1: Update `HabitPicker.tsx`**

Replace the `HabitPickerProps` type and the `DialogTitle` line:

```tsx
type HabitPickerProps = {
  habits: Habit[];
  onSelectHabit: (habit: { id: number; name: string }) => void;
  onCreateHabit: (name: string) => Promise<void>;
  title?: string;
};

export function HabitPicker({
  habits,
  onSelectHabit,
  onCreateHabit,
  title = "Select Habit",
}: HabitPickerProps) {
  // ... unchanged ...
  return (
    <>
      <DialogHeader className="justify-between">
        <DialogTitle>{title}</DialogTitle>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
      </DialogHeader>
      {/* ... rest unchanged ... */}
    </>
  );
}
```

- [ ] **Step 2: Verify no breakage**

Run: `npx vitest run`
Expected: All tests still pass. (No test specifically exercises `HabitPicker` today; existing call sites omit the new prop so default applies.)

- [ ] **Step 3: Commit**

```bash
git add src/components/HabitPicker.tsx
git commit -m "feat(routines): allow custom title on HabitPicker"
```

---

## Task 5: `HabitBlockConfigForm` accepts `initialValues` and `submitLabel`

**Files:**
- Modify: `src/components/HabitBlockConfigForm.tsx`

- [ ] **Step 1: Update props, defaults, and submit button**

Replace the full contents of `src/components/HabitBlockConfigForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";

type HabitBlockConfigFormProps = {
  habitName: string;
  onAdd: (config: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  }) => void;
  onBack: () => void;
  initialValues?: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  };
  submitLabel?: string;
};

export function HabitBlockConfigForm({
  habitName,
  onAdd,
  onBack,
  initialValues,
  submitLabel = "Add to Routine",
}: HabitBlockConfigFormProps) {
  const [sets, setSets] = useState(initialValues?.sets ?? 3);
  const [durationMinutes, setDurationMinutes] = useState(
    initialValues?.durationMinutes ?? 25
  );
  const [breakMinutes, setBreakMinutes] = useState(
    initialValues?.breakMinutes ?? 5
  );
  const [notes, setNotes] = useState(initialValues?.notes ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      sets,
      durationMinutes,
      breakMinutes,
      notes: notes.trim() || null,
    });
  }

  const isValid =
    sets >= 1 &&
    sets <= 10 &&
    durationMinutes >= 1 &&
    durationMinutes <= 120 &&
    breakMinutes >= 0 &&
    breakMinutes <= 60;

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <Button variant="ghost" size="icon-sm" type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DialogTitle>{habitName}</DialogTitle>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <div>
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <textarea
            id="notes"
            placeholder="Any specific topics or resources to focus on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Number of Sets *</Label>
            <Stepper
              value={sets}
              min={1}
              max={10}
              onChange={setSets}
              suffix="sets"
              aria-label="Number of Sets"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Duration *</Label>
            <Stepper
              value={durationMinutes}
              min={1}
              max={120}
              onChange={setDurationMinutes}
              aria-label="Duration in minutes"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Break</Label>
            <Stepper
              value={breakMinutes}
              min={0}
              max={60}
              onChange={setBreakMinutes}
              aria-label="Break in minutes"
            />
          </div>
        </div>
      </DialogBody>

      <DialogFooter className="justify-end">
        <Button type="button" variant="ghost" onClick={onBack}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
```

- [ ] **Step 2: Verify no breakage**

Run: `npx vitest run`
Expected: All tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/HabitBlockConfigForm.tsx
git commit -m "feat(routines): allow prefill and custom submit label on habit block config form"
```

---

## Task 6: Wire Replace flow into `RoutineBuilder` via `PickerMode`

**Files:**
- Modify: `src/components/RoutineBuilder.tsx`
- Test: `src/components/RoutineBuilder.test.tsx`

Replace the loose `pickerOpen` + `pickerView` state with a single discriminated union `PickerMode` and wire the Replace flow end-to-end. Both opening paths (Add Habits, Replace habit) now flow through one piece of state, and every dialog close resets it to `{ kind: "closed" }`, structurally preventing prefill from leaking between Add and Replace flows.

- [ ] **Step 1: Write integration tests**

Create `src/components/RoutineBuilder.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRoutineBuilder } from '@/hooks/use-routine-builder';
import { RoutineBuilder } from './RoutineBuilder';
import type { Habit, Routine } from '@/lib/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));
vi.mock('@/hooks/use-navigation-guard', () => ({
  useNavigationGuard: () => {},
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/hooks/use-habits', () => ({
  useHabits: (initial: Habit[]) => ({ data: initial }),
  useAddHabit: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/use-routines', () => ({
  useCreateRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRoutine: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function renderWithQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const HABITS: Habit[] = [
  { id: 1, name: 'Guitar', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 2, name: 'Reading', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 3, name: 'Pushups', todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
];

const ROUTINE: Routine = {
  id: 7,
  name: 'Evening',
  blocks: [
    {
      id: 100,
      habitId: 1,
      habitName: 'Guitar',
      sortOrder: 0,
      notes: 'Scales',
      sets: [
        { durationSeconds: 480, breakSeconds: 60 },
        { durationSeconds: 480, breakSeconds: 60 },
      ],
    },
  ],
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

function Harness({ routine = ROUTINE }: { routine?: Routine }) {
  const builder = useRoutineBuilder('edit', routine);
  return (
    <RoutineBuilder mode="edit" initialHabits={HABITS} builder={builder} />
  );
}

describe('RoutineBuilder — Replace habit flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Replace habit opens the picker with the replace title', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));

    expect(
      await screen.findByRole('heading', { name: /^replace "guitar"$/i })
    ).toBeInTheDocument();
  });

  it('picking a habit opens the config form prefilled with current block values', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));

    expect(await screen.findByRole('heading', { name: /^reading$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toHaveValue('Scales');
    const setsInput = screen.getByLabelText(/number of sets/i) as HTMLInputElement;
    expect(setsInput.value).toBe('2');
    const durationInput = screen.getByLabelText(/duration in minutes/i) as HTMLInputElement;
    expect(durationInput.value).toBe('8');
    const breakInput = screen.getByLabelText(/break in minutes/i) as HTMLInputElement;
    expect(breakInput.value).toBe('1');
    expect(screen.getByRole('button', { name: /^replace$/i })).toBeInTheDocument();
  });

  it('submitting Replace swaps the block in place', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    await user.click(await screen.findByRole('button', { name: /^replace$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /^reading$/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 3, name: /reading/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /guitar/i })).not.toBeInTheDocument();
  });

  it('cancelling Replace from the config form leaves the block unchanged', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('heading', { level: 3, name: /guitar/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: /reading/i })).not.toBeInTheDocument();
  });

  it('no state leak: Replace prefill does not bleed into next Add flow', async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    // Start Replace, walk into the prefilled form, then cancel.
    await user.click(screen.getByRole('button', { name: /block actions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /replace habit/i }));
    await user.click(await screen.findByRole('button', { name: /^reading$/i }));
    await user.click(await screen.findByRole('button', { name: /^cancel$/i }));

    // Now open Add Habits and pick a habit.
    await user.click(screen.getByRole('button', { name: /add habits/i }));
    await user.click(await screen.findByRole('button', { name: /^pushups$/i }));

    // Form should show defaults, not the leaked Replace values.
    const setsInput = screen.getByLabelText(/number of sets/i) as HTMLInputElement;
    expect(setsInput.value).toBe('3'); // default
    const durationInput = screen.getByLabelText(/duration in minutes/i) as HTMLInputElement;
    expect(durationInput.value).toBe('25'); // default
    const breakInput = screen.getByLabelText(/break in minutes/i) as HTMLInputElement;
    expect(breakInput.value).toBe('5'); // default
    expect(screen.getByLabelText(/notes/i)).toHaveValue(''); // default
    expect(screen.getByRole('button', { name: /add to routine/i })).toBeInTheDocument();
  });
});
```

> **Note on selectors:** `HabitList` (the existing component used by `HabitPicker`) renders each habit as a button with the habit name. If your implementation differs and that selector returns no matches, adjust the `getByRole('button', { name: /^reading$/i })` queries to whatever role/name `HabitList` uses. Also, `Stepper` is expected to render an `input` (or similar) that responds to `getByLabelText`; if it uses a different element, adjust accordingly. These selectors mirror what the component already exposes — confirm by running the tests after the implementation step.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RoutineBuilder.test.tsx`
Expected: Tests FAIL because (a) `block actions` button does not exist until Task 3 lands (already landed if you followed in order — should fail on later assertions about "Replace …" title since the wiring isn't there yet).

- [ ] **Step 3: Refactor `RoutineBuilder.tsx` to use `PickerMode`**

Make three edits in `src/components/RoutineBuilder.tsx`:

**a) Replace the `PickerView` type and `pickerOpen` / `pickerView` state.**

Replace lines around:

```ts
type PickerView =
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };
```

with:

```ts
type PickerView =
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };

type PickerMode =
  | { kind: "closed" }
  | { kind: "add"; view: PickerView }
  | {
      kind: "replace";
      clientId: string;
      habitName: string;
      view: PickerView;
    };
```

Inside the component, replace:

```ts
const [pickerOpen, setPickerOpen] = useState(false);
const [pickerView, setPickerView] = useState<PickerView>({ type: "list" });
```

with:

```ts
const [mode_, setMode] = useState<PickerMode>({ kind: "closed" });
```

(Local name `mode_` to avoid shadowing the existing `mode` prop. If `mode` prop is unused locally at this point, you may also alias the prop to `builderMode` and use `mode` for the state. The plan uses `mode_` to be explicit and minimize ripple.)

Also pull in the `replaceBlock` method from the builder destructure:

```ts
const {
  routineId,
  name,
  blocks,
  isDirty,
  setName,
  addBlock,
  removeBlock,
  replaceBlock,
  updateBlockNotes,
  addSet,
  removeSet,
  updateSetDuration,
  updateSetBreak,
  moveBlock,
  reorderBlocks,
  toPayload,
} = builder;
```

**b) Replace the handlers `handleOpenPicker`, `handleSelectHabit`, `handleAddBlock` and add `handleOpenReplace`.**

```tsx
function handleOpenPicker() {
  setMode({ kind: "add", view: { type: "list" } });
}

function handleOpenReplace(block: BuilderBlock) {
  setMode({
    kind: "replace",
    clientId: block.clientId,
    habitName: block.habitName,
    view: { type: "list" },
  });
}

function handleSelectHabit(habit: { id: number; name: string }) {
  setMode((current) => {
    if (current.kind === "closed") return current;
    return {
      ...current,
      view: { type: "config", habitId: habit.id, habitName: habit.name },
    };
  });
}

function handleSubmitConfig(config: {
  sets: number;
  durationMinutes: number;
  breakMinutes: number;
  notes: string | null;
}) {
  if (mode_.kind === "closed" || mode_.view.type !== "config") return;
  const payload = {
    habitId: mode_.view.habitId,
    habitName: mode_.view.habitName,
    notes: config.notes,
    sets: Array.from({ length: config.sets }, () => ({
      durationSeconds: config.durationMinutes * 60,
      breakSeconds: config.breakMinutes * 60,
    })),
  };
  if (mode_.kind === "add") {
    addBlock(payload);
  } else {
    replaceBlock(mode_.clientId, payload);
  }
  trigger("success");
  setMode({ kind: "closed" });
}

function handleClosePicker(open: boolean) {
  if (!open) setMode({ kind: "closed" });
}

function handleBackFromConfig() {
  setMode((current) => {
    if (current.kind === "closed") return current;
    return { ...current, view: { type: "list" } };
  });
}
```

**c) Replace the JSX for the `Dialog` and update the `ReorderableBlock` wiring.**

Replace the existing `<Dialog>` block:

```tsx
<Dialog open={mode_.kind !== "closed"} onOpenChange={handleClosePicker}>
  <DialogContent>
    {mode_.kind !== "closed" && mode_.view.type === "list" ? (
      <HabitPicker
        habits={habits}
        onSelectHabit={handleSelectHabit}
        onCreateHabit={handleCreateHabit}
        title={
          mode_.kind === "replace"
            ? `Replace "${mode_.habitName}"`
            : "Select Habit"
        }
      />
    ) : mode_.kind !== "closed" && mode_.view.type === "config" ? (
      <HabitBlockConfigForm
        key={`${mode_.kind}-${mode_.view.habitId}`}
        habitName={mode_.view.habitName}
        onAdd={handleSubmitConfig}
        onBack={handleBackFromConfig}
        initialValues={
          mode_.kind === "replace"
            ? deriveInitialValuesFromBlock(blocks, mode_.clientId)
            : undefined
        }
        submitLabel={mode_.kind === "replace" ? "Replace" : "Add to Routine"}
      />
    ) : null}
  </DialogContent>
</Dialog>
```

Add a helper at the bottom of the file (after the `RoutineBuilder` function, before `ReorderableBlock`):

```ts
function deriveInitialValuesFromBlock(
  blocks: BuilderBlock[],
  clientId: string,
): {
  sets: number;
  durationMinutes: number;
  breakMinutes: number;
  notes: string | null;
} | undefined {
  const block = blocks.find((b) => b.clientId === clientId);
  if (!block) return undefined;
  const first = block.sets[0];
  return {
    sets: block.sets.length,
    durationMinutes: Math.round(first.durationSeconds / 60),
    breakMinutes: Math.round(first.breakSeconds / 60),
    notes: block.notes,
  };
}
```

Update the `Reorder.Group`'s map to pass `onReplace` to `ReorderableBlock`:

```tsx
{blocks.map((block, i) => (
  <ReorderableBlock
    key={block.clientId}
    block={block}
    onRemoveBlock={removeBlock}
    onAddSet={addSet}
    onRemoveSet={removeSet}
    onUpdateDuration={updateSetDuration}
    onUpdateBreak={updateSetBreak}
    onUpdateNotes={updateBlockNotes}
    onReplace={() => handleOpenReplace(block)}
    onMoveUp={i > 0 ? () => moveBlock(i, i - 1) : undefined}
    onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, i + 1) : undefined}
  />
))}
```

Extend `ReorderableBlockProps` and the component below the main return:

```ts
type ReorderableBlockProps = {
  block: BuilderBlock;
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  onReplace: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function ReorderableBlock({
  block,
  onMoveUp,
  onMoveDown,
  onReplace,
  ...handlers
}: ReorderableBlockProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      as="div"
      value={block}
      dragListener={false}
      dragControls={dragControls}
      dragElastic={0}
      dragMomentum={false}
    >
      <RoutineBlockCard
        block={block}
        mode="editable"
        dragControls={dragControls}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onReplace={onReplace}
        {...handlers}
      />
    </Reorder.Item>
  );
}
```

Finally, delete the now-unused old `handleAddBlock` function and the old `pickerView` references (the `setPickerView({ type: "list" })` etc.) — search and remove anything still referencing `pickerOpen`, `setPickerOpen`, `pickerView`, `setPickerView`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RoutineBuilder.test.tsx`
Expected: All 5 tests PASS.

If a selector mismatch shows up (e.g., `HabitList` renders habits as something other than `role=button`), inspect the actual DOM with `screen.debug()` and adjust the selector in the test. Do not change the production code to match the test — find the right selector for the existing component.

- [ ] **Step 5: Run the entire test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Run lint and typecheck**

Run: `npx eslint && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Manual smoke test in the browser**

Start dev: `npm run dev`. Open an existing routine in edit mode at `/routines/<id>/edit`. Verify by hand:
1. Each block shows a ⋯ overflow button (and no inline up/down/trash icons).
2. Opening the menu shows **Move up · Move down · Replace habit · Delete**; Move up disabled on first block, Move down disabled on last.
3. Clicking **Replace habit** opens the picker titled `Replace "<habitName>"`.
4. Picking a different habit opens the config form, prefilled with current sets/duration/break/notes; submit button reads **Replace**.
5. Submitting swaps the block in place (same position, no flash).
6. After cancelling Replace, clicking **Add Habits** and picking any habit shows defaults (3 sets, 25 min, 5 min break, blank notes), not leaked values.
7. Hitting Save persists the change (reload page; the swapped habit remains).

- [ ] **Step 8: Commit**

```bash
git add src/components/RoutineBuilder.tsx src/components/RoutineBuilder.test.tsx
git commit -m "feat(routines): wire replace-habit flow with PickerMode state machine"
```

---

## Final verification

- [ ] **All tests pass:** `npx vitest run`
- [ ] **Lint clean:** `npx eslint`
- [ ] **Typecheck clean:** `npx tsc --noEmit`
- [ ] **Build:** `npm run build` (no errors)
