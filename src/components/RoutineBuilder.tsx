"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RoutineStickyHeader } from "@/components/RoutineStickyHeader";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { HabitPicker } from "@/components/HabitPicker";
import { HabitBlockConfigForm } from "@/components/HabitBlockConfigForm";
import { useHabits, useAddHabit } from "@/hooks/use-habits";
import { useCreateRoutine, useUpdateRoutine, useDeleteRoutine } from "@/hooks/use-routines";
import { useHaptics } from "@/hooks/use-haptics";
import { useNavigationGuard, type NavigationAttempt } from "@/hooks/use-navigation-guard";
import type { RoutineBuilderState } from "@/hooks/use-routine-builder";
import type { Habit, BuilderBlock } from "@/lib/types";

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

type RoutineBuilderProps = {
  mode: "create" | "edit";
  initialHabits?: Habit[];
  builder: RoutineBuilderState;
};

export function RoutineBuilder({ mode, initialHabits, builder }: RoutineBuilderProps) {
  const router = useRouter();
  const { trigger } = useHaptics();
  const { data: habits } = useHabits(initialHabits);
  const addHabit = useAddHabit();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();

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

  const [pickerMode, setPickerMode] = useState<PickerMode>({ kind: "closed" });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);

  useNavigationGuard({
    shouldGuard: isDirty,
    onAttempt: (_attempt: NavigationAttempt, proceed) => {
      setPendingNavigate(() => proceed);
      setShowDiscardDialog(true);
    },
  });

  const isSaving = createRoutine.isPending || updateRoutine.isPending;
  const canSave = name.trim().length > 0 && blocks.length > 0;

  let totalSeconds = 0;
  for (const block of blocks) {
    for (const s of block.sets) {
      totalSeconds += s.durationSeconds + s.breakSeconds;
    }
  }
  const totalMinutes = Math.round(totalSeconds / 60);

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

  function handleCancelDiscard() {
    setShowDiscardDialog(false);
    setPendingNavigate(null);
  }

  async function handleDelete() {
    if (!routineId) return;
    try {
      await deleteRoutine.mutateAsync(routineId);
      toast.success("Routine deleted");
      trigger("success");
      router.push("/routines");
    } catch {
      toast.error("Failed to delete routine");
    }
  }

  async function handleSave() {
    if (!canSave) return;
    try {
      const payload = toPayload();
      if (mode === "create") {
        await createRoutine.mutateAsync(payload);
        toast.success("Routine created");
      } else {
        await updateRoutine.mutateAsync({ id: routineId!, ...payload });
        toast.success("Routine updated");
      }
      trigger("success");
      // Mark builder as clean so beforeunload and discard dialog don't trigger
      builder.markClean();
      router.replace("/routines");
    } catch {
      toast.error("Failed to save routine");
    }
  }

  function handleOpenPicker() {
    setPickerMode({ kind: "add", view: { type: "list" } });
  }

  function handleOpenReplace(block: BuilderBlock) {
    setPickerMode({
      kind: "replace",
      clientId: block.clientId,
      habitName: block.habitName,
      view: { type: "list" },
    });
  }

  function handleSelectHabit(habit: { id: number; name: string }) {
    setPickerMode((current) => {
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
    if (pickerMode.kind === "closed" || pickerMode.view.type !== "config") return;
    const payload = {
      habitId: pickerMode.view.habitId,
      habitName: pickerMode.view.habitName,
      notes: config.notes,
      sets: Array.from({ length: config.sets }, () => ({
        durationSeconds: config.durationMinutes * 60,
        breakSeconds: config.breakMinutes * 60,
      })),
    };
    if (pickerMode.kind === "add") {
      addBlock(payload);
    } else {
      replaceBlock(pickerMode.clientId, payload);
    }
    trigger("success");
    setPickerMode({ kind: "closed" });
  }

  function handleClosePicker(open: boolean) {
    if (!open) setPickerMode({ kind: "closed" });
  }

  function handleBackFromConfig() {
    setPickerMode((current) => {
      if (current.kind === "closed") return current;
      return { ...current, view: { type: "list" } };
    });
  }

  async function handleCreateHabit(habitName: string) {
    await addHabit.mutateAsync(habitName);
  }

  return (
    <div className="relative flex flex-col flex-1 -mt-0.5 md:-mt-6">
      <RoutineStickyHeader
        totalMinutes={totalMinutes}
        habitCount={blocks.length}
        onBack={handleDiscard}
        onDiscard={handleDiscard}
        onSave={handleSave}
        onDelete={mode === "edit" ? () => setShowDeleteDialog(true) : undefined}
        isSaving={isSaving}
        canSave={canSave}
        isDirty={isDirty}
        mode={mode}
      />

      <div className="flex-1 py-4 space-y-4">
        {/* Routine name */}
        <Input
          placeholder="Untitled Routine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="text-2xl md:text-2xl font-bold h-14 rounded-none border-0 border-b-2 border-border shadow-none px-0 focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground/40"
        />

        {/* Habit blocks */}
        <Reorder.Group
          as="div"
          axis="y"
          values={blocks}
          onReorder={reorderBlocks}
          className="flex flex-col gap-4"
        >
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
        </Reorder.Group>

        {/* Add habits button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleOpenPicker}
          disabled={blocks.length >= 20}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Habits
        </Button>
      </div>

      {/* Habit picker dialog */}
      <Dialog open={pickerMode.kind !== "closed"} onOpenChange={handleClosePicker}>
        <DialogContent>
          {pickerMode.kind !== "closed" && pickerMode.view.type === "list" ? (
            <HabitPicker
              habits={habits}
              onSelectHabit={handleSelectHabit}
              onCreateHabit={handleCreateHabit}
              title={
                pickerMode.kind === "replace"
                  ? `Replace "${pickerMode.habitName}"`
                  : "Select Habit"
              }
            />
          ) : pickerMode.kind !== "closed" && pickerMode.view.type === "config" ? (
            <HabitBlockConfigForm
              key={`${pickerMode.kind}-${pickerMode.view.habitId}`}
              habitName={pickerMode.view.habitName}
              onAdd={handleSubmitConfig}
              onBack={handleBackFromConfig}
              initialValues={
                pickerMode.kind === "replace"
                  ? deriveInitialValuesFromBlock(blocks, pickerMode.clientId)
                  : undefined
              }
              submitLabel={pickerMode.kind === "replace" ? "Replace" : "Add to Routine"}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={(open) => { if (!open) handleCancelDiscard(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave now, they will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{name || "this routine"}&rdquo; and all its data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
        {...handlers}
      />
    </Reorder.Item>
  );
}
