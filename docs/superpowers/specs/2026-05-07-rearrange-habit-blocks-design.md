# Rearrange habit blocks in Routine Builder — Design

GitHub issue: [#60](https://github.com/tomcorey26/LogBro/issues/60)

## Goal

Let users reorder habit blocks inside the Routine Builder (create + edit modes) via drag-and-drop, with up/down arrow buttons as a keyboard-friendly fallback. Mirror the Hevy/Strong "collapse-on-drag" pattern: when a drag starts, every card collapses to a compact row so the list is short and easy to drop into.

## Scope

In:
- Drag-to-reorder via a grip handle on each block.
- Auto-collapse to compact rows (habit name only) while a drag is in progress; expand on drop.
- Up/down arrow buttons on each card for one-tap reorder + keyboard support.
- Order persisted on Save, like every other builder edit (no auto-save).

Out:
- Reordering habits on the Dashboard (separate concern).
- Reordering inside an active routine session.
- Custom keyboard drag-and-drop (arrow buttons cover keyboard users).

## Current state

`src/components/RoutineBuilder.tsx` renders `blocks.map((b) => <motion.div><RoutineBlockCard /></motion.div>)` inside `AnimatePresence`. The hook `src/hooks/use-routine-builder.ts` already has `moveBlock(fromIndex, toIndex)` (lines 160–168) but it is not destructured/exposed by `RoutineBuilder` and there is no UI for it. `toPayload()` already encodes block order as `sortOrder: i` (line 175), and the `routineBlocks` table has a `sortOrder` column — persistence is wired end-to-end.

## Approach

Use `framer-motion`'s `Reorder.Group` + `Reorder.Item` (already a dependency, no new package). Use `useDragControls()` so only the grip handle starts a drag — this keeps taps inside the card (notes input, set steppers) from initiating a drag.

### State

Add to `RoutineBuilder.tsx`:
- `const [isReordering, setIsReordering] = useState(false);`
- Set `true` from `Reorder.Item`'s `onDragStart`, `false` from `onDragEnd`.

Add to `use-routine-builder.ts`:
- `reorderBlocks(newBlocks: BuilderBlock[])` — replaces `blocks` and flips `isDirty`. Used as `Reorder.Group`'s `onReorder`.
- Expose existing `moveBlock(fromIndex, toIndex)` in the returned object — used by up/down buttons.

### `RoutineBuilder.tsx`

Replace the existing block list:

```tsx
<Reorder.Group axis="y" values={blocks} onReorder={reorderBlocks}>
  {blocks.map((block, i) => {
    const dragControls = useDragControls();
    return (
      <Reorder.Item
        key={block.clientId}
        value={block}
        dragListener={false}
        dragControls={dragControls}
        onDragStart={() => setIsReordering(true)}
        onDragEnd={() => setIsReordering(false)}
        layout
      >
        <RoutineBlockCard
          block={block}
          mode="editable"
          dragControls={dragControls}
          isCompact={isReordering}
          onMoveUp={i > 0 ? () => moveBlock(i, i - 1) : undefined}
          onMoveDown={i < blocks.length - 1 ? () => moveBlock(i, i + 1) : undefined}
          /* existing handlers */
        />
      </Reorder.Item>
    );
  })}
</Reorder.Group>
```

(`useDragControls()` is a hook and cannot be called inside `.map()`. Wrap each `Reorder.Item` in a small `ReorderableBlock` component — see [implementation notes](#implementation-notes) below.)

### `RoutineBlockCard.tsx`

Editable mode adds props:

```ts
type EditableProps = {
  // ...existing
  dragControls?: DragControls;
  isCompact?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};
```

Header layout (editable, expanded):

```
[ Grip ] [ Habit Name                ] [ Up ] [ Down ] [ Trash ]
```

Header layout (editable, compact / dragging):

```
[ Grip ] [ Habit Name                                              ]
```

- Grip: `GripVertical` (lucide-react). `cursor-grab` / `cursor-grabbing`. `touch-action: none`. `onPointerDown={(e) => dragControls?.start(e)}`. `aria-label="Reorder block"`.
- Up / Down: `ChevronUp` / `ChevronDown` icon-sm buttons. Disabled when corresponding callback is `undefined`. `aria-label="Move block up"` / `"Move block down"`.
- When `isCompact === true`: render only the header row. Skip the notes input, set rows, and "Add a Set" button. The card body uses framer-motion's `layout` prop so the height shrinks/grows smoothly.

### Hook (`use-routine-builder.ts`)

```ts
function reorderBlocks(newBlocks: BuilderBlock[]) {
  setBlocks(newBlocks);
  setIsDirty(true);
}

// add reorderBlocks + moveBlock to the returned object
```

`toPayload()` is unchanged.

## Implementation notes

- `useDragControls()` per item: each `Reorder.Item` needs its own `DragControls`. Cleanest pattern is a small wrapper component:

```tsx
function ReorderableBlock({ block, index, total, ...rest }) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      key={block.clientId}
      value={block}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={rest.onDragStart}
      onDragEnd={rest.onDragEnd}
      layout
    >
      <RoutineBlockCard
        block={block}
        mode="editable"
        dragControls={dragControls}
        {/* ...rest */}
      />
    </Reorder.Item>
  );
}
```

- The existing `motion.div` `AnimatePresence` enter/exit animation for adding/removing blocks is preserved by `Reorder.Item`'s built-in layout animation; we lose the explicit `initial/animate/exit` height transition, but `layout` plus `Reorder.Item`'s default presence behavior covers it. If add/remove animation regresses noticeably, wrap children in `AnimatePresence` inside the group.
- Discard during drag: existing `isDirty` dialog catches it — no new code.
- `Reorder.Group` auto-handles touch + mouse + pointer events.

## Tests

Unit (`src/hooks/use-routine-builder.test.ts`):
- `reorderBlocks(newBlocks)` updates blocks and flips `isDirty`.
- `moveBlock` (already tested) — keep existing tests.
- `toPayload()` after reorder yields `sortOrder: 0,1,2,...` matching new order.

Component (`src/components/RoutineBlockCard.test.tsx`, new or existing file):
- When `isCompact={true}`, the notes input, set rows, and "Add a Set" button are not rendered.
- When `isCompact={false}`, the full card renders.
- Up button disabled when `onMoveUp` is undefined; Down button disabled when `onMoveDown` is undefined.
- Clicking Up/Down calls the callback.

E2E (`e2e/routines/`):
- Edit an existing routine. Use the **Down arrow button** (not drag — drag-and-drop is flaky in Playwright) to move block 0 below block 1. Save. Reload. Assert order matches.
- Optional smoke test that drag fires: programmatic `mouse.down/move/up` on the grip handle, verify `isReordering` UI state appears (compact rows visible), then mouse up. This is a "does it wire up" test rather than a precise reorder test.

## Files touched

- `src/hooks/use-routine-builder.ts` — add `reorderBlocks`, expose `moveBlock`.
- `src/hooks/use-routine-builder.test.ts` — tests for the above.
- `src/components/RoutineBuilder.tsx` — `Reorder.Group`/`Reorder.Item` wrapper, `isReordering` state, `ReorderableBlock` helper.
- `src/components/RoutineBlockCard.tsx` — drag handle, up/down buttons, `isCompact` rendering.
- `src/components/RoutineBlockCard.test.tsx` — new or extended tests.
- `e2e/routines/*.spec.ts` — happy-path reorder test.

## Risk / open questions

- **framer-motion `Reorder` + `useDragControls` + `layout` prop interactions**: the combination is documented but the compact-on-drag pattern needs a quick prototype. If the height animation conflicts with the drag transform, fall back to a simpler "compact mode toggle button" approach (already considered as alternative #2 during brainstorming).
- **Keyboard accessibility for drag itself**: out of scope for v1. Up/down arrow buttons cover keyboard users for reorder; the grip handle is purely a pointer affordance.

## Branching

- Branch off latest `main` (the user mentioned "master" but the repo's main branch is `main`).
- Branch name suggestion: `routines/rearrange-blocks` or `issue/60-rearrange-blocks`.
