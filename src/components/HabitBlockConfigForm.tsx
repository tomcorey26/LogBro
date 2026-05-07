"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";

type HabitBlockConfigFormProps = {
  habitName: string;
  onAdd: (config: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  }) => void;
  onBack: () => void;
};

export function HabitBlockConfigForm({
  habitName,
  onAdd,
  onBack,
}: HabitBlockConfigFormProps) {
  const [sets, setSets] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      sets,
      durationMinutes,
      breakMinutes,
      notes: notes.trim() || null,
    });
  }

  const isValid = sets >= 1 && sets <= 10 && durationMinutes >= 1 && durationMinutes <= 120 && breakMinutes >= 0 && breakMinutes <= 60;

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <Button variant="ghost" size="icon-sm" type="button" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <DialogTitle>{habitName}</DialogTitle>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <div>
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <textarea
            id="notes"
            placeholder="Any specific topics or resources to focus on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Number of Sets *</Label>
            <Stepper
              value={sets}
              min={1}
              max={10}
              onChange={setSets}
              suffix="sets"
              aria-label="Number of Sets"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Duration *</Label>
            <Stepper
              value={durationMinutes}
              min={1}
              max={120}
              onChange={setDurationMinutes}
              aria-label="Duration in minutes"
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <Label className="text-xs">Break</Label>
            <Stepper
              value={breakMinutes}
              min={0}
              max={60}
              onChange={setBreakMinutes}
              aria-label="Break in minutes"
            />
          </div>
        </div>
      </DialogBody>

      <DialogFooter className="justify-end">
        <Button type="button" variant="ghost" onClick={onBack}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid}>
          Add to Routine
        </Button>
      </DialogFooter>
    </form>
  );
}
