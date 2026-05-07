"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import type { Habit } from "@/lib/types";

type HabitToolbarProps = {
  habits: Habit[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreateHabit: (name: string) => Promise<void>;
};

export function HabitToolbar({
  habits,
  search,
  onSearchChange,
  onCreateHabit,
}: HabitToolbarProps) {
  const [newHabitName, setNewHabitName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isDuplicate = habits.some(
    (h) => h.name.toLowerCase() === newHabitName.trim().toLowerCase()
  );

  async function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim() || isDuplicate) return;
    setError("");
    setCreating(true);
    try {
      await onCreateHabit(newHabitName.trim());
      setNewHabitName("");
    } catch {
      setError("Failed to create habit");
    }
    setCreating(false);
  }

  return (
    <div>
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search habits..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <form
        onSubmit={handleCreateHabit}
        className="mb-3 flex gap-2"
        data-tour="habits-add-form"
      >
        <Input
          placeholder="Create new habit..."
          value={newHabitName}
          onChange={(e) => {
            setNewHabitName(e.target.value);
            setError("");
          }}
          className="h-8 text-sm flex-1"
          maxLength={30}
        />
        <Button
          type="submit"
          size="sm"
          disabled={creating || !newHabitName.trim() || isDuplicate}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      {isDuplicate && newHabitName.trim() && (
        <p className="text-xs text-destructive mb-2">
          A habit with this name already exists
        </p>
      )}
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
    </div>
  );
}
