"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
import { useRoutines, useDeleteRoutine } from "@/hooks/use-routines";
import { useActiveRoutine } from "@/hooks/use-active-routine";
import { useHaptics } from "@/hooks/use-haptics";
import type { Routine } from "@/lib/types";

const MAX_VISIBLE_BLOCKS = 3;

function getBlockOpacity(setCount: number): string {
  if (setCount <= 1) return "bg-primary/10";
  if (setCount <= 2) return "bg-primary/20";
  if (setCount <= 3) return "bg-primary/30";
  if (setCount <= 4) return "bg-primary/40";
  return "bg-primary/50";
}

type RoutineCardProps = { routine: Routine; isActive?: boolean };

function RoutineCard({ routine, isActive = false }: RoutineCardProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteRoutine = useDeleteRoutine();
  const { trigger } = useHaptics();

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc +
      block.sets.reduce(
        (s, set) => s + set.durationSeconds + set.breakSeconds,
        0,
      ),
    0,
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  async function handleDelete() {
    try {
      await deleteRoutine.mutateAsync(routine.id);
      trigger("success");
      toast.success("Routine deleted");
    } catch {
      toast.error("Failed to delete routine");
    }
  }

  const cardHref = isActive ? `/routines/${routine.id}/active` : `/routines/${routine.id}`;

  return (
    <>
      <Link href={cardHref} className="block h-full">
        <Card className="p-5 h-full flex flex-col hover:shadow-md active:scale-[0.98] transition-all cursor-pointer relative group">
          {/* Action icons */}
          <div className="absolute top-3 right-3 flex items-center gap-1">
            {isActive ? (
              <span className="text-[10px] uppercase tracking-wide bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                Continue
              </span>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit routine"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/routines/${routine.id}/edit`);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete routine"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>

        <p className="text-sm font-semibold text-foreground mb-4">
          {routine.name}
        </p>
        <div className="space-y-3">
          {routine.blocks.slice(0, MAX_VISIBLE_BLOCKS).map((block, i) => (
            <div
              key={block.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${getBlockOpacity(block.sets.length)}`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {block.habitName}
                </span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {block.sets.length} {block.sets.length === 1 ? "set" : "sets"}
              </span>
            </div>
          ))}
          {routine.blocks.length > MAX_VISIBLE_BLOCKS && (
            <p className="text-xs text-muted-foreground text-center">
              +{routine.blocks.length - MAX_VISIBLE_BLOCKS} more
            </p>
          )}
        </div>
        <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-mono font-semibold text-foreground">
            {timeDisplay}
          </span>
        </div>
      </Card>
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{routine.name}&rdquo;. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function RoutinesView({
  initialRoutines,
}: {
  initialRoutines?: Routine[];
}) {
  const { data: routines } = useRoutines(initialRoutines);
  const { data: active } = useActiveRoutine();

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Routines" />
        <Link href="/routines/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Routine
          </Button>
        </Link>
      </div>
      {active && (
        <div className="mb-4 rounded-md bg-primary/10 border border-primary/30 px-4 py-3 flex items-center justify-between">
          <span className="text-sm">
            Routine in progress: <strong>{active.routineNameSnapshot}</strong>
          </span>
          {active.routineId && (
            <Link href={`/routines/${active.routineId}/active`}>
              <Button size="sm">Continue</Button>
            </Link>
          )}
        </div>
      )}
      {routines.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No routines yet. Create your first practice routine.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              isActive={active?.routineId === routine.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
