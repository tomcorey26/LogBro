"use client";

import { useState, useEffect } from "react";
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
import type { RoutineBuilderState } from "@/hooks/use-routine-builder";
import type { Habit, BuilderBlock } from "@/lib/types";

type PickerView =
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };

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
    updateBlockNotes,
    addSet,
    removeSet,
    updateSetDuration,
    updateSetBreak,
    moveBlock,
    reorderBlocks,
    toPayload,
  } = builder;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<PickerView>({ type: "list" });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const isSaving = createRoutine.isPending || updateRoutine.isPending;
  const canSave = name.trim().length > 0 && blocks.length > 0;

  let totalSeconds = 0;
  for (const block of blocks) {
    for (const s of block.sets) {
      totalSeconds += s.durationSeconds + s.breakSeconds;
    }
  }
  const totalMinutes = Math.round(totalSeconds / 60);

  // beforeunload handler
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function handleDiscard() {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      router.push("/routines");
    }
  }

  function handleConfirmDiscard() {
    setShowDiscardDialog(false);
    router.push("/routines");
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

  function handleSelectHabit(habit: { id: number; name: string }) {
    setPickerView({ type: "config", habitId: habit.id, habitName: habit.name });
  }

  function handleAddBlock(config: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  }) {
    if (pickerView.type !== "config") return;
    addBlock({
      habitId: pickerView.habitId,
      habitName: pickerView.habitName,
      notes: config.notes,
      sets: Array.from({ length: config.sets }, () => ({
        durationSeconds: config.durationMinutes * 60,
        breakSeconds: config.breakMinutes * 60,
      })),
    });
    trigger("success");
    setPickerOpen(false);
  }

  function handleOpenPicker() {
    setPickerView({ type: "list" });
    setPickerOpen(true);
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
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          {pickerView.type === "list" ? (
            <HabitPicker
              habits={habits}
              onSelectHabit={handleSelectHabit}
              onCreateHabit={handleCreateHabit}
            />
          ) : (
            <HabitBlockConfigForm
              habitName={pickerView.habitName}
              onAdd={handleAddBlock}
              onBack={() => setPickerView({ type: "list" })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Discard confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDiscard}
            >
              Discard
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
      as="div"
      value={block}
      dragListener={false}
      dragControls={dragControls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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
