"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";
import { formatTime } from "@/lib/format";
import { useHaptics } from "@/hooks/use-haptics";
import { useTimerStore } from "@/stores/timer-store";
import type { Habit } from "@/lib/types";

export function HabitCard({
  habit,
  onStart,
  onDelete,
  onLog,
  onTimerClick,
  disabled,
}: {
  habit: Habit;
  onStart: (habitId: number) => void;
  onDelete: (habitId: number) => void;
  onLog?: (habitId: number) => void;
  onTimerClick?: () => void;
  disabled?: boolean;
}) {
  const { trigger } = useHaptics();
  const isTimerActive = !!habit.activeTimer;

  if (isTimerActive) {
    return (
      <ActiveTimerCard
        habit={habit}
        onClick={() => {
          trigger("light");
          onTimerClick?.();
        }}
      />
    );
  }

  return (
    <Card className="transition-all">
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Row 1: name + delete */}
        <div className="flex items-center justify-between min-w-0">
          <h3 className="font-semibold text-lg truncate min-w-0">
            {habit.name}
          </h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Delete habit"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="break-words line-clamp-2">
                  Delete &quot;{habit.name}&quot;?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the habit and all its time data. This cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    trigger("error");
                    onDelete(habit.id);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Stats */}
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-primary">
              {formatTime(habit.todaySeconds)}
            </span>{" "}
            today
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">
              {formatTime(habit.totalSeconds)}
            </span>{" "}
            lifetime
            {habit.streak > 1 && <span> · 🔥 {habit.streak}d streak</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => {
              trigger("medium");
              onStart(habit.id);
            }}
            className="flex-1"
            disabled={disabled}
          >
            Start
          </Button>
          {onLog && (
            <Button
              variant="outline"
              onClick={() => {
                trigger("light");
                onLog(habit.id);
              }}
              className="flex-1"
            >
              Log
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActiveTimerCard({
  habit,
  onClick,
}: {
  habit: Habit;
  onClick: () => void;
}) {
  const activeTimer = habit.activeTimer!;
  const isCountdown = activeTimer.targetDurationSeconds !== null;
  const displayTime = useTimerStore((s) => s.displayTime);
  const isTimesUp = useTimerStore((s) => s.isTimesUp);

  return (
    <Card
      className="transition-all border-primary cursor-pointer hover:bg-accent/50"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-lg truncate min-w-0">
          {habit.name}
        </h3>

        <p className="text-3xl font-mono font-light tracking-tight text-primary">
          {displayTime}
        </p>

        <div className="flex items-center gap-2">
          {isTimesUp ? (
            <span className="text-sm font-semibold text-primary">
              Time&apos;s up!
            </span>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {isCountdown ? "Counting down..." : "Recording..."}
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
