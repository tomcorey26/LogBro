"use client";

import { Card } from "@/components/ui/card";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  Pause,
  NotebookPen,
  Plus,
  MinusCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Stepper } from "@/components/ui/stepper";
import type { BuilderBlock, RoutineSessionSet } from "@/lib/types";
import { ActiveRoutineSetRow, type SetRowState } from "./ActiveRoutineSetRow";

type ReadonlyProps = {
  block: BuilderBlock;
  mode: "readonly";
};

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
};

type ActiveRow = {
  set: RoutineSessionSet;
  state: SetRowState;
  displayTime: string;
  progressPct?: number;
  onStart: () => void;
  onEnd: () => void;
  onSkipBreak: () => void;
  onPatch: (patch: {
    plannedDurationSeconds?: number;
    plannedBreakSeconds?: number;
    actualDurationSeconds?: number;
  }) => void;
};

type ActiveProps = {
  mode: "active";
  habitName: string;
  notes: string | null;
  rows: ActiveRow[];
};

type Props = ReadonlyProps | EditableProps | ActiveProps;

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function RoutineBlockCard(props: Props) {
  if (props.mode === "active") {
    return (
      <Card className="overflow-hidden pb-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h3 className="text-base font-semibold">{props.habitName}</h3>
        </div>
        {props.notes && (
          <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
            <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs text-foreground">{props.notes}</span>
          </div>
        )}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wide mb-0.5 px-1">
            <span>Set</span>
            <span>Duration</span>
            <span>Break</span>
            <span />
          </div>
          {props.rows.map((row, i) => (
            <ActiveRoutineSetRow
              key={row.set.id}
              setNumber={i + 1}
              {...row}
            />
          ))}
        </div>
      </Card>
    );
  }

  const { block, mode } = props;
  const isEditable = mode === "editable";
  const maxSets = block.sets.length >= 10;

  return (
    <Card className="overflow-hidden pb-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-base font-semibold">
          {block.habitName}
        </h3>
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

      {/* Notes banner (readonly) */}
      {block.notes && !isEditable && (
        <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-foreground">{block.notes}</span>
        </div>
      )}

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
                    <span />
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
    </Card>
  );
}
