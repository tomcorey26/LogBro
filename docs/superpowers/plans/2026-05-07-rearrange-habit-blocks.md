# Rearrange Habit Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reorder + up/down arrow buttons for habit blocks in the Routine Builder, with Hevy/Strong-style auto-collapse to compact rows while dragging.

**Architecture:** Use `framer-motion`'s `Reorder.Group` + `Reorder.Item` (already a dependency). Each block sits in a small `ReorderableBlock` wrapper that owns a `useDragControls()` instance so the drag is initiated only by a `GripVertical` handle (not the whole card). A parent-level `isReordering` boolean flips on drag start / off on drag end and is passed to every card as `isCompact` — when true, the card collapses to a header-only row via framer-motion's `layout` prop.

**Tech Stack:** Next.js 16, React 19, framer-motion 12, vitest, @testing-library/react, Playwright. Existing files: `src/hooks/use-routine-builder.ts`, `src/components/RoutineBuilder.tsx`, `src/components/RoutineBlockCard.tsx`.

---

## File Structure

**Modified:**
- `src/hooks/use-routine-builder.ts` — add `reorderBlocks(newBlocks)`. `moveBlock` is already exposed.
- `src/hooks/use-routine-builder.test.ts` — add tests for `reorderBlocks` + `toPayload` after reorder.
- `src/components/RoutineBlockCard.tsx` — accept `dragControls`, `isCompact`, `onMoveUp`, `onMoveDown`; render grip handle + up/down buttons; collapse body when `isCompact`.
- `src/components/RoutineBuilder.tsx` — wrap blocks in `Reorder.Group`; introduce `ReorderableBlock` helper; track `isReordering`; wire move callbacks.

**Created:**
- `src/components/RoutineBlockCard.test.tsx` — component tests for handle, up/down, compact mode.
- `e2e/routine-edit-reorder.spec.ts` — happy-path reorder via up/down button (drag is too flaky).

---

## Task 1: Add `reorderBlocks` to the hook

**Files:**
- Modify: `src/hooks/use-routine-builder.ts`
- Test: `src/hooks/use-routine-builder.test.ts`

- [ ] **Step 1: Add the failing test**

Append this block inside `describe("useRoutineBuilder", () => { ... })`, after the existing `describe("moveBlock", ...)` block, before `describe("toPayload", ...)`:

```ts
  describe("reorderBlocks", () => {
    it("replaces blocks with the supplied order and marks dirty", () => {
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
        const [a, b] = result.current.blocks;
        result.current.reorderBlocks([b, a]);
      });
      expect(result.current.blocks[0].habitName).toBe("Reading");
      expect(result.current.blocks[1].habitName).toBe("Guitar");
      expect(result.current.isDirty).toBe(true);
    });

    it("toPayload returns sortOrder matching the new order after reorder", () => {
      const { result } = createHook();
      act(() => result.current.setName("Morning"));
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
        const [a, b] = result.current.blocks;
        result.current.reorderBlocks([b, a]);
      });
      const payload = result.current.toPayload();
      expect(payload.blocks.map((x) => ({ habitId: x.habitId, sortOrder: x.sortOrder }))).toEqual([
        { habitId: 2, sortOrder: 0 },
        { habitId: 1, sortOrder: 1 },
      ]);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- src/hooks/use-routine-builder.test.ts
```

Expected: FAIL — `result.current.reorderBlocks is not a function`.

- [ ] **Step 3: Implement `reorderBlocks` and expose it**

In `src/hooks/use-routine-builder.ts`, add the function next to `moveBlock` (around line 168):

```ts
  function reorderBlocks(newBlocks: BuilderBlock[]) {
    setBlocks(newBlocks);
    setIsDirty(true);
  }
```

Then add it to the returned object (the `return { ... }` near the bottom, after `moveBlock,`):

```ts
    moveBlock,
    reorderBlocks,
    toPayload,
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- src/hooks/use-routine-builder.test.ts
```

Expected: PASS — all `reorderBlocks` tests green; existing tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-routine-builder.ts src/hooks/use-routine-builder.test.ts
git commit -m "feat(routines): add reorderBlocks to routine builder hook"
```

---

## Task 2: Drag handle on `RoutineBlockCard`

Add the `GripVertical` handle that triggers a drag via `dragControls.start(e)`. No reorder logic in the card itself — it just exposes the visual affordance and pointerdown wiring.

**Files:**
- Modify: `src/components/RoutineBlockCard.tsx`
- Create: `src/components/RoutineBlockCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/RoutineBlockCard.test.tsx` with:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: FAIL — handle button not found / type error on `dragControls` prop.

- [ ] **Step 3: Add `dragControls` prop and grip handle**

In `src/components/RoutineBlockCard.tsx`:

3a. Add the import at the top:

```tsx
import { GripVertical } from "lucide-react";
import type { DragControls } from "framer-motion";
```

(Append `GripVertical` to the existing `lucide-react` import, and add the new `framer-motion` type import.)

3b. Extend `EditableProps`:

```ts
type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  dragControls?: DragControls;
};
```

3c. Pull `dragControls` into the local block:

Right after `const { block, mode } = props;` (around line 114), add:

```ts
  const dragControls = isEditable ? (props as EditableProps).dragControls : undefined;
```

3d. Render the handle as the first child of the header `<div className="flex items-center justify-between px-4 pt-4 pb-2">` (around line 121).

Replace that header block with:

```tsx
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {dragControls && (
            <button
              type="button"
              aria-label="Reorder block"
              onPointerDown={(e) => dragControls.start(e)}
              className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing -ml-1"
              style={{ touchAction: "none" }}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-base font-semibold truncate">
            {block.habitName}
          </h3>
        </div>
        {isEditable && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Delete block">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
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
        )}
      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBlockCard.tsx src/components/RoutineBlockCard.test.tsx
git commit -m "feat(routines): add drag handle to routine block card"
```

---

## Task 3: Up / Down arrow buttons

Add visible chevron buttons in the header that call `onMoveUp` / `onMoveDown` when provided. Disabled (or hidden) when the corresponding callback is missing — that's how the parent expresses "this block is at the top/bottom."

**Files:**
- Modify: `src/components/RoutineBlockCard.tsx`
- Modify: `src/components/RoutineBlockCard.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/RoutineBlockCard.test.tsx` inside the `describe('RoutineBlockCard editable', ...)`:

```tsx
  it('renders enabled Move up button when onMoveUp provided', async () => {
    const onMoveUp = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveUp={onMoveUp}
        {...noopHandlers}
      />
    );
    const btn = screen.getByRole('button', { name: /move block up/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onMoveUp).toHaveBeenCalled();
  });

  it('renders disabled Move up button when onMoveUp missing', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /move block up/i })).toBeDisabled();
  });

  it('renders enabled Move down button when onMoveDown provided', async () => {
    const onMoveDown = vi.fn();
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        onMoveDown={onMoveDown}
        {...noopHandlers}
      />
    );
    const btn = screen.getByRole('button', { name: /move block down/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onMoveDown).toHaveBeenCalled();
  });

  it('renders disabled Move down button when onMoveDown missing', () => {
    render(
      <RoutineBlockCard block={baseBlock} mode="editable" {...noopHandlers} />
    );
    expect(screen.getByRole('button', { name: /move block down/i })).toBeDisabled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: FAIL — `move block up` / `move block down` buttons not found.

- [ ] **Step 3: Add the buttons**

3a. In `src/components/RoutineBlockCard.tsx`, extend the `lucide-react` import:

```tsx
import {
  Trash2,
  Pause,
  NotebookPen,
  Plus,
  MinusCircle,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
```

3b. Extend `EditableProps`:

```ts
type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  dragControls?: DragControls;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};
```

3c. Pull the new props locally (alongside the `dragControls` line added in Task 2):

```ts
  const dragControls = isEditable ? (props as EditableProps).dragControls : undefined;
  const onMoveUp = isEditable ? (props as EditableProps).onMoveUp : undefined;
  const onMoveDown = isEditable ? (props as EditableProps).onMoveDown : undefined;
```

3d. Insert the two arrow buttons in the header right BEFORE the existing trash `AlertDialog`. Replace the closing of the header (the part starting at `{isEditable && (` for the Trash dialog) with:

```tsx
        {isEditable && (
          <div className="flex items-center gap-0">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move block up"
              disabled={!onMoveUp}
              onClick={() => onMoveUp?.()}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move block down"
              disabled={!onMoveDown}
              onClick={() => onMoveDown?.()}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Delete block">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
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
          </div>
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: PASS — all up/down tests green; previous handle tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBlockCard.tsx src/components/RoutineBlockCard.test.tsx
git commit -m "feat(routines): add up/down move buttons to routine block card"
```

---

## Task 4: Compact (drag) mode rendering

When `isCompact === true`, the card renders only the header row — no notes input, no set rows, no "Add a Set" button. Use framer-motion's `layout` prop on the card so height changes animate smoothly.

**Files:**
- Modify: `src/components/RoutineBlockCard.tsx`
- Modify: `src/components/RoutineBlockCard.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/components/RoutineBlockCard.test.tsx`:

```tsx
  it('hides notes, sets, and Add a Set when isCompact is true', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        isCompact
        {...noopHandlers}
      />
    );
    expect(screen.queryByPlaceholderText(/add notes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^set$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add a set/i })).not.toBeInTheDocument();
    // Header (habit name) still renders
    expect(screen.getByText('Guitar')).toBeInTheDocument();
  });

  it('renders full body when isCompact is false', () => {
    render(
      <RoutineBlockCard
        block={baseBlock}
        mode="editable"
        isCompact={false}
        {...noopHandlers}
      />
    );
    expect(screen.getByPlaceholderText(/add notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add a set/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: FAIL — notes/sets still rendered in compact mode.

- [ ] **Step 3: Add `isCompact` prop and gate the body**

3a. Extend `EditableProps`:

```ts
type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  dragControls?: DragControls;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isCompact?: boolean;
};
```

3b. Pull the new prop locally next to the others (around the existing `dragControls`/`onMoveUp` lines):

```ts
  const isCompact = isEditable ? (props as EditableProps).isCompact ?? false : false;
```

3c. Wrap the editable body sections so they're only rendered when not compact. The body sections to gate: notes input, set rows container, "Add a Set" button.

In the existing JSX (after the header's closing `</div>`), wrap everything from the `{/* Notes input (editable) */}` block through (and including) the `{/* Add set button */}` block in a single conditional. The readonly `{block.notes && !isEditable && ...}` section should remain unconditional.

Replace the current bodies (lines roughly 156–321 in the existing file) with:

```tsx
      {/* Notes banner (readonly) */}
      {block.notes && !isEditable && (
        <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-foreground">{block.notes}</span>
        </div>
      )}

      {!isCompact && (
        <>
          {/* Notes input (editable) */}
          {isEditable && (
            <div className="mx-4 mb-2 relative">
              <NotebookPen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Add notes..."
                value={block.notes ?? ""}
                onChange={(e) =>
                  (props as EditableProps).onUpdateNotes(
                    block.clientId,
                    e.target.value,
                  )
                }
                className="text-xs h-8 bg-primary/5 pl-8"
              />
            </div>
          )}

          {/* Set rows */}
          <div className="px-4 pb-2 overflow-hidden">
            {/* Column headers */}
            <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide mb-0.5 px-1">
              <span>Set</span>
              <span>Duration</span>
              <span>Break</span>
              <span />
            </div>

            <AnimatePresence initial={false}>
              {block.sets.map((s, i) => (
                <motion.div
                  key={s.clientId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {/* Set row */}
                  <div
                    className={`grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center py-1 px-1 rounded ${i % 2 === 1 ? "bg-muted/60" : ""}`}
                  >
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-medium">
                      {i + 1}
                    </span>
                    {isEditable ? (
                      <>
                        <Stepper
                          value={Math.round(s.durationSeconds / 60)}
                          min={1}
                          max={120}
                          onChange={(mins) =>
                            (props as EditableProps).onUpdateDuration(
                              block.clientId,
                              i,
                              mins * 60,
                            )
                          }
                          aria-label={`Set ${i + 1} duration in minutes`}
                        />
                        <Stepper
                          value={Math.round(s.breakSeconds / 60)}
                          min={0}
                          max={60}
                          onChange={(mins) =>
                            (props as EditableProps).onUpdateBreak(
                              block.clientId,
                              i,
                              mins * 60,
                            )
                          }
                          aria-label={`Set ${i + 1} break in minutes`}
                        />
                        {block.sets.length > 1 ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              (props as EditableProps).onRemoveSet(block.clientId, i)
                            }
                            aria-label={`Remove set ${i + 1}`}
                            className="h-6 w-6"
                          >
                            <MinusCircle className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove set ${i + 1}`}
                                className="h-6 w-6"
                              >
                                <MinusCircle className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove block?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Removing the only set will remove the &ldquo;
                                  {block.habitName}&rdquo; block from this routine.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() =>
                                    (props as EditableProps).onRemoveBlock(
                                      block.clientId,
                                    )
                                  }
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-foreground">
                          {formatMinutes(s.durationSeconds)}
                        </span>
                        {s.breakSeconds > 0 ? (
                          <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                            <Pause className="h-3 w-3" />
                            {formatMinutes(s.breakSeconds)} break
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            No break
                          </span>
                        )}
                        <span />
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add set button */}
          {isEditable && (
            <button
              onClick={() => (props as EditableProps).onAddSet(block.clientId)}
              disabled={maxSets}
              className="w-full py-2.5 text-xs text-primary/70 hover:text-primary hover:bg-primary/5 transition-colors border-t border-dashed border-border disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-3 w-3 inline mr-1" />
              Add a Set
            </button>
          )}
        </>
      )}
```

3d. For smooth height animation when toggling compact mode, wrap the gated body in `<motion.div layout="size">`. In the JSX from step 3c, change:

```tsx
{!isCompact && (
  <>
    {/* notes input + set rows + add-set button */}
  </>
)}
```

to:

```tsx
<motion.div layout="size">
  {!isCompact && (
    <>
      {/* notes input + set rows + add-set button */}
    </>
  )}
</motion.div>
```

`motion` is already imported in this file (`import { AnimatePresence, motion } from "framer-motion";`) — no import change needed.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:unit -- src/components/RoutineBlockCard.test.tsx
```

Expected: PASS — all compact-mode tests green; previous tests still green.

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBlockCard.tsx src/components/RoutineBlockCard.test.tsx
git commit -m "feat(routines): add compact mode to routine block card for drag reorder"
```

---

## Task 5: Wire `Reorder.Group` into `RoutineBuilder`

This is the integration task. We:

1. Wrap the blocks list in `Reorder.Group` with `onReorder={reorderBlocks}`.
2. Each block sits in a small `ReorderableBlock` component that owns `useDragControls()`.
3. A parent `isReordering` state flips on `onDragStart` and off on `onDragEnd`.
4. Each card receives `dragControls`, `isCompact`, `onMoveUp`, `onMoveDown`.

**Files:**
- Modify: `src/components/RoutineBuilder.tsx`

- [ ] **Step 1: Update imports**

In `src/components/RoutineBuilder.tsx`, replace the existing framer-motion import:

```tsx
import { AnimatePresence, motion } from "framer-motion";
```

with:

```tsx
import { Reorder, useDragControls } from "framer-motion";
```

Remove unused `AnimatePresence` and `motion` imports.

Also extend the existing types import. Find:

```tsx
import type { Habit } from "@/lib/types";
```

Replace with:

```tsx
import type { Habit, BuilderBlock } from "@/lib/types";
```

- [ ] **Step 2: Destructure new hook members**

Around line 50 in `RoutineBuilder.tsx`, expand the `builder` destructure:

```tsx
  const {
    routineId,
    name,
    blocks,
    isDirty,
    setName,
    addBlock,
    removeBlock,
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

- [ ] **Step 3: Add `isReordering` state**

After the existing `useState` calls (the `pickerOpen`, `pickerView`, `showDiscardDialog`, `showDeleteDialog` block, around line 69), add:

```tsx
  const [isReordering, setIsReordering] = useState(false);
```

- [ ] **Step 4: Add the `ReorderableBlock` helper at module scope**

At the bottom of the file (after the `RoutineBuilder` function), add:

```tsx
type ReorderableBlockProps = {
  block: BuilderBlock;
  isCompact: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

function ReorderableBlock({
  block,
  isCompact,
  onDragStart,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  ...handlers
}: ReorderableBlockProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={block}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      layout
    >
      <RoutineBlockCard
        block={block}
        mode="editable"
        dragControls={dragControls}
        isCompact={isCompact}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        {...handlers}
      />
    </Reorder.Item>
  );
}
```

- [ ] **Step 5: Replace the existing blocks list JSX**

Find the existing blocks list (around lines 195–217 in `RoutineBuilder.tsx`):

```tsx
        {/* Habit blocks */}
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <motion.div
              key={block.clientId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <RoutineBlockCard
                block={block}
                mode="editable"
                onRemoveBlock={removeBlock}
                onAddSet={addSet}
                onRemoveSet={removeSet}
                onUpdateDuration={updateSetDuration}
                onUpdateBreak={updateSetBreak}
                onUpdateNotes={updateBlockNotes}
              />
            </motion.div>
          ))}
        </AnimatePresence>
```

Replace with:

```tsx
        {/* Habit blocks */}
        <Reorder.Group
          axis="y"
          values={blocks}
          onReorder={reorderBlocks}
          className="space-y-4"
        >
          {blocks.map((block, i) => (
            <ReorderableBlock
              key={block.clientId}
              block={block}
              isCompact={isReordering}
              onDragStart={() => setIsReordering(true)}
              onDragEnd={() => setIsReordering(false)}
              onRemoveBlock={removeBlock}
              onAddSet={addSet}
              onRemoveSet={removeSet}
              onUpdateDuration={updateSetDuration}
              onUpdateBreak={updateSetBreak}
              onUpdateNotes={updateBlockNotes}
              onMoveUp={i > 0 ? () => moveBlock(i, i - 1) : undefined}
              onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, i + 1) : undefined}
            />
          ))}
        </Reorder.Group>
```

Note: the surrounding container `<div className="flex-1 py-4 space-y-4">` already provides spacing, but `Reorder.Group` becomes a direct child that holds the blocks; we add `className="space-y-4"` so spacing between items still matches the previous layout.

- [ ] **Step 6: Type-check and run unit tests**

Run:

```bash
npx tsc --noEmit
npm run test:unit
```

Expected: tsc clean. All unit tests pass (the routine-builder hook tests + the new RoutineBlockCard tests).

- [ ] **Step 7: Manually verify in the browser**

Run:

```bash
npm run dev
```

Then in a browser:

1. Log in (test account: `test-mobile@test.com` / `password123`).
2. Create or open a routine with at least 2 blocks at `/routines/new` or `/routines/[id]/edit`.
3. Verify each block has: a grip handle on the left, up/down chevrons + trash on the right.
4. Click the up/down chevrons — blocks reorder. The "Save" button becomes enabled (dirty state).
5. Tap-and-drag the grip handle on a block — every card collapses to a header-only row, the dragged card follows the pointer, releasing drops the card and all cards expand.
6. Save. Reload the page. Order persists.
7. Go to a routine with 1 block — up/down buttons should both be disabled (no reorder possible).

If any of these don't behave correctly, debug before committing.

- [ ] **Step 8: Commit**

```bash
git add src/components/RoutineBuilder.tsx
git commit -m "feat(routines): wire reorder UI in routine builder"
```

---

## Task 6: E2E test for reorder + save round-trip

Use the up/down arrow button (drag-and-drop is too flaky in Playwright across browsers). The button calls `moveBlock` which produces the same `sortOrder` change in `toPayload()`, so this still verifies persistence end-to-end.

**Files:**
- Create: `e2e/routine-edit-reorder.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `e2e/routine-edit-reorder.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the e2e test**

Run:

```bash
npm run test:e2e -- routine-edit-reorder.spec.ts
```

Expected: PASS. (If the dev server isn't already running, Playwright config should start one; check `playwright.config.ts` for `webServer`. Otherwise run `npm run dev` in another terminal first.)

- [ ] **Step 3: Commit**

```bash
git add e2e/routine-edit-reorder.spec.ts
git commit -m "test(e2e): reorder routine blocks persists after save"
```

---

## Final verification

- [ ] **Run the full test suite**

```bash
npm run lint
npm run test:unit
npm run test:e2e
```

Expected: all green.

- [ ] **Final commit (if any cleanup needed)**

If lint surfaces any small issues (unused imports, etc.), fix them and commit:

```bash
git add -p
git commit -m "chore: lint cleanup"
```

---

## Notes for implementer

- **Don't add useCallback/useMemo/memo.** This codebase uses the React Compiler (per repo memory).
- **Don't restructure third-party CSS** if you touch any (per repo memory).
- **Branch is `rearrange-habit-blocks`** off `origin/main` (already created).
- **Don't push** without confirmation (per repo memory).
- The `motion.div layout` wrapper for compact mode is the trickiest piece — if framer-motion fights the height animation, simplify to no `layout` prop and accept an instant snap; the feature still works without smooth height animation.
