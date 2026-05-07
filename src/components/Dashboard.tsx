"use client";

import { useState, useEffect } from "react";
import { useHaptics } from "@/hooks/use-haptics";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutList, LayoutGrid, Trash2 } from "lucide-react";
import { HabitCard } from "@/components/HabitCard";
import { HabitToolbar } from "@/components/HabitToolbar";
import { HabitList } from "@/components/HabitList";
import { StartTimerModal } from "@/components/StartTimerModal";
import { TimerView } from "@/components/TimerView";
import { EmojiBubbles } from "@/components/EmojiBubbles";
import { LogSessionModal } from "@/components/LogSessionModal";
import { PressableButton } from "@/components/ui/pressable-button";
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
import {
  useHabits,
  useAddHabit,
  useDeleteHabit,
  useStartTimer,
  useStopTimer,
} from "@/hooks/use-habits";
import { useActiveRoutine } from "@/hooks/use-active-routine";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useTimerStore } from "@/stores/timer-store";
import { ApiError } from "@/lib/api";
import { formatTime, getElapsedSeconds } from "@/lib/format";
import { getRandomCongratsMessage } from "@/lib/congrats-messages";
import type { Habit } from "@/lib/types";

function playFanfare() {
  try {
    const audio = new Audio("/fanfare.mp3");
    audio.play().catch(() => {});
  } catch {}
}

const staggerItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

function SuccessScreen({ durationSeconds }: { durationSeconds: number }) {
  const { trigger } = useHaptics();
  const dismissSuccess = useTimerStore((s) => s.dismissSuccess);
  const [message] = useState(() => getRandomCongratsMessage());

  useEffect(() => {
    playFanfare();
    trigger("buzz");
    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("🎉 Session Complete", {
          body: `Your ${formatTime(durationSeconds)} session was recorded`,
        });
      } catch {}
    }
  }, [trigger, durationSeconds]);

  return (
    <div className="relative flex-1 flex flex-col">
      <EmojiBubbles />
      <motion.div
        className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10"
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.15, delayChildren: 0.1 }}
      >
        <motion.p
          className="text-6xl mb-6"
          variants={{
            hidden: { opacity: 0, scale: 0.3 },
            visible: { opacity: 1, scale: 1 },
          }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
        >
          &#127942;
        </motion.p>
        <motion.h1
          className="text-2xl font-bold mb-3"
          variants={staggerItem}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          Session Complete!
        </motion.h1>
        <motion.p
          className="text-lg text-muted-foreground mb-6 max-w-xs"
          variants={staggerItem}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {message}
        </motion.p>
        <motion.p
          className="text-4xl font-mono font-light tracking-tight mb-10"
          variants={staggerItem}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {formatTime(durationSeconds)}
        </motion.p>
        <motion.div
          variants={staggerItem}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <PressableButton
            size="lg"
            onClick={() => {
              trigger("light");
              dismissSuccess();
            }}
            className="px-12 py-6 text-lg"
          >
            Back to Habits
          </PressableButton>
        </motion.div>
      </motion.div>
    </div>
  );
}

type ViewMode = "list" | "grid";

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  return (localStorage.getItem("habits-view-mode") as ViewMode) ?? "list";
}

export function Dashboard({
  initialHabits,
}: {
  initialHabits: Habit[];
}) {
  const { data: habits } = useHabits(initialHabits);
  const { data: flags } = useFeatureFlags();
  const { data: activeRoutine } = useActiveRoutine();
  const routineActive = !!activeRoutine;
  const { trigger } = useHaptics();
  const [switchConfirmHabitId, setSwitchConfirmHabitId] = useState<
    number | null
  >(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
  const [deleteConfirmHabitId, setDeleteConfirmHabitId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const [search, setSearch] = useState("");

  const filteredHabits = habits.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem("habits-view-mode", mode);
  }

  const addHabit = useAddHabit();
  const deleteHabit = useDeleteHabit();
  const startTimerApi = useStartTimer();
  const stopTimerApi = useStopTimer();

  const view = useTimerStore((s) => s.view);
  const activeTimer = useTimerStore((s) => s.activeTimer);
  const openConfig = useTimerStore((s) => s.openConfig);
  const closeConfig = useTimerStore((s) => s.closeConfig);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);

  function handleStartClick(habitId: number) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (activeTimer && activeTimer.habitId !== habitId) {
      setSwitchConfirmHabitId(habitId);
      return;
    }
    openConfig(habitId, habit.name);
  }

  function handleStartConfirm(targetDurationSeconds?: number) {
    if (view.type !== "timer_config") return;
    const { habitId, habitName } = view;

    trigger("medium");
    startTimer({ habitId, habitName, targetDurationSeconds });

    startTimerApi.mutate(
      {
        habitId,
        targetDurationSeconds,
      },
      {
        onError: () => {
          useTimerStore.getState().resetTimer();
          toast.error("Failed to start timer");
        },
      },
    );
  }

  function handleStop() {
    trigger("buzz");
    stopTimerApi.mutate(undefined, {
      onSuccess: (data) => {
        stopTimer(data.durationSeconds);
      },
      onError: (error) => {
        // 404 means the timer was already stopped (e.g., server auto-stopped
        // an expired countdown before the client could). Treat as success.
        if (error instanceof ApiError && error.status === 404) {
          useTimerStore.getState().resetTimer();
          return;
        }
        toast.error("Failed to stop timer");
      },
    });
  }

  function handleDelete(habitId: number) {
    deleteHabit.mutate(habitId);
  }

  async function handleAdd(name: string) {
    await addHabit.mutateAsync(name);
  }

  function handleLogClick(habitId: number) {
    setLoggingHabitId(habitId);
  }

  function handleLogSave() {
    setLoggingHabitId(null);
  }

  const switchConfirmHabit = habits.find((h) => h.id === switchConfirmHabitId);
  const deleteConfirmHabit = habits.find((h) => h.id === deleteConfirmHabitId);
  const loggingHabit = habits.find((h) => h.id === loggingHabitId);

  // ── Timer Config View ──
  if (view.type === "timer_config") {
    return (
      <StartTimerModal
        habitName={view.habitName}
        onStart={handleStartConfirm}
        onCancel={closeConfig}
      />
    );
  }

  // ── Active Timer View ──
  if (view.type === "active_timer" && activeTimer) {
    const habit = habits.find((h) => h.id === activeTimer.habitId);
    return (
      <TimerView
        habitName={activeTimer.habitName}
        targetDurationSeconds={activeTimer.targetDurationSeconds}
        todaySeconds={habit?.todaySeconds ?? 0}
        streak={habit?.streak ?? 0}
        onStop={handleStop}
        onBack={() => useTimerStore.getState().showHabits()}
      />
    );
  }

  // ── Success View ──
  if (view.type === "success") {
    return <SuccessScreen durationSeconds={view.durationSeconds} />;
  }

  // ── Habits List View (default) ──
  return (
    <>
      <AlertDialog
        open={!!switchConfirmHabit}
        onOpenChange={(open) => {
          if (!open) setSwitchConfirmHabitId(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch timer?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              You have a timer running for{" "}
              <span className="font-semibold">{activeTimer?.habitName}</span>
              {activeTimer && (
                <> ({formatTime(getElapsedSeconds(activeTimer.startTime))})</>
              )}
              . Switching will save this session and start a new one for{" "}
              <span className="font-semibold">{switchConfirmHabit?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              onClick={() => {
                if (switchConfirmHabitId !== null) {
                  const savedHabitName = activeTimer?.habitName;
                  const savedHabitId = switchConfirmHabitId;
                  setSwitchConfirmHabitId(null);

                  stopTimerApi.mutate(undefined, {
                    onSuccess: (data) => {
                      useTimerStore.getState().resetTimer();
                      toast.success(
                        `${savedHabitName} session saved (${formatTime(data.durationSeconds)})`,
                      );
                      const habit = habits.find((h) => h.id === savedHabitId);
                      if (habit) {
                        openConfig(savedHabitId, habit.name);
                      }
                    },
                    onError: (error) => {
                      if (error instanceof ApiError && error.status === 404) {
                        useTimerStore.getState().resetTimer();
                        const habit = habits.find((h) => h.id === savedHabitId);
                        if (habit) {
                          openConfig(savedHabitId, habit.name);
                        }
                        return;
                      }
                      toast.error("Failed to stop timer");
                    },
                  });
                }
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteConfirmHabit}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmHabitId(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete habit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteConfirmHabit?.name}&rdquo;
              and all its recorded sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteConfirmHabitId !== null) {
                  handleDelete(deleteConfirmHabitId);
                  setDeleteConfirmHabitId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {flags?.logSession && loggingHabit && (
        <LogSessionModal
          habitId={loggingHabit.id}
          habitName={loggingHabit.name}
          onSave={handleLogSave}
          onCancel={() => setLoggingHabitId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <PageHeader title="Habits" />
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => handleViewModeChange("list")}
            aria-label="List view"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => handleViewModeChange("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <HabitToolbar
        habits={habits}
        search={search}
        onSearchChange={setSearch}
        onCreateHabit={handleAdd}
      />

      {routineActive && (
        <div className="mb-3 rounded-md bg-primary/10 border border-primary/30 px-4 py-2 text-sm">
          Routine in progress — finish or discard it to start individual timers.
        </div>
      )}

      {viewMode === "list" ? (
        <HabitList
          habits={filteredHabits}
          renderDetail={(habit) => (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-primary font-mono">
                {formatTime(habit.todaySeconds)} today
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(habit.totalSeconds)} total
              </span>
              {habit.streak > 1 && (
                <span className="text-xs text-muted-foreground">
                  · 🔥 {habit.streak}d streak
                </span>
              )}
            </div>
          )}
          renderAction={(habit) => (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleStartClick(habit.id)}
                disabled={routineActive}
              >
                Start
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setDeleteConfirmHabitId(habit.id)}
                aria-label={`Delete ${habit.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        />
      ) : (
        <>
          {filteredHabits.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {habits.length === 0
                  ? "Start by adding your first habit"
                  : "No habits match your search."}
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence initial={false}>
                  {filteredHabits.map((habit) => (
                    <motion.div
                      key={habit.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <HabitCard
                        habit={habit}
                        onStart={handleStartClick}
                        onDelete={handleDelete}
                        onLog={flags?.logSession ? handleLogClick : undefined}
                        onTimerClick={() =>
                          useTimerStore.getState().showActiveTimer()
                        }
                        disabled={routineActive}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
