"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { HabitToolbar } from "@/components/HabitToolbar";
import { HabitList } from "@/components/HabitList";
import type { Habit } from "@/lib/types";

type HabitPickerProps = {
  habits: Habit[];
  onSelectHabit: (habit: { id: number; name: string }) => void;
  onCreateHabit: (name: string) => Promise<void>;
};

export function HabitPicker({
  habits,
  onSelectHabit,
  onCreateHabit,
}: HabitPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = habits.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <DialogHeader className="justify-between">
        <DialogTitle>Select Habit</DialogTitle>
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
      </DialogHeader>
      <DialogBody>
        <HabitToolbar
          habits={habits}
          search={search}
          onSearchChange={setSearch}
          onCreateHabit={onCreateHabit}
        />
        <HabitList habits={filtered} onSelectHabit={onSelectHabit} />
      </DialogBody>
    </>
  );
}
