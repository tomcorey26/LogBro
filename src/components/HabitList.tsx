"use client";

import type { Habit } from "@/lib/types";

type HabitListProps = {
  habits: Habit[];
  renderAction?: (habit: Habit) => React.ReactNode;
  renderDetail?: (habit: Habit) => React.ReactNode;
  onSelectHabit?: (habit: { id: number; name: string }) => void;
};

export function HabitList({
  habits,
  renderAction,
  renderDetail,
  onSelectHabit,
}: HabitListProps) {
  const sorted = [...habits].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex-1 overflow-auto">
      {sorted.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">
          No habits match your search.
        </p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((habit, index) => (
            <div
              key={habit.id}
              data-tour={index === 0 ? "habits-first-card" : undefined}
              className="flex items-center gap-3 px-3 py-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
            >
              <button
                type="button"
                onClick={() =>
                  onSelectHabit?.({ id: habit.id, name: habit.name })
                }
                className={`text-left flex-1 min-w-0 ${onSelectHabit ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className="text-sm font-semibold text-foreground block truncate">
                  {habit.name}
                </span>
                {renderDetail?.(habit)}
              </button>
              {renderAction && (
                <div className="shrink-0">
                  {renderAction(habit)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
