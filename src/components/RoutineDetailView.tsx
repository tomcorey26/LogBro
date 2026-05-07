"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Layers, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { useRoutine } from "@/hooks/use-routines";
import { useActiveRoutine, useStartRoutineSession, useDiscardRoutineSession } from '@/hooks/use-active-routine';
import { StartNewRoutineConflictDialog } from '@/components/StartNewRoutineConflictDialog';
import { ApiError } from '@/lib/api';
import type { Routine } from "@/lib/types";

export function RoutineDetailView({
  routineId,
  initialRoutine,
}: {
  routineId: number;
  initialRoutine?: Routine;
}) {
  const { data: routine } = useRoutine(routineId, initialRoutine);

  const router = useRouter();
  const { data: active } = useActiveRoutine();
  const startSession = useStartRoutineSession();
  const discardSession = useDiscardRoutineSession();
  const [conflictOpen, setConflictOpen] = useState(false);

  async function start() {
    if (active) {
      setConflictOpen(true);
      return;
    }
    try {
      await startSession.mutateAsync(routineId);
      router.push(`/routines/${routineId}/active`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflictOpen(true);
        return;
      }
      toast.error('Could not start routine');
    }
  }

  async function startNewAfterDiscard() {
    try {
      await discardSession.mutateAsync();
      await startSession.mutateAsync(routineId);
    } catch {
      toast.error('Could not start routine');
      return;
    }
    setConflictOpen(false);
    router.push(`/routines/${routineId}/active`);
  }

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc + block.sets.reduce((s, set) => s + set.durationSeconds + set.breakSeconds, 0),
    0
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="flex flex-col flex-1">
      {/* Sticky header */}
      <div className="sticky -top-0.5 md:-top-6 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3">
        <Link href="/routines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Routines
        </Link>
        <h2 className="text-lg font-semibold mt-1">{routine.name}</h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {timeDisplay}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {routine.blocks.length} {routine.blocks.length === 1 ? "habit" : "habits"}
          </span>
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 py-4 space-y-3">
        {routine.blocks.map((block) => (
          <RoutineBlockCard
            key={block.id}
            block={{
              clientId: String(block.id),
              ...block,
              sets: block.sets.map((s, i) => ({ ...s, clientId: `${block.id}-${i}` })),
            }}
            mode="readonly"
          />
        ))}

        {routine.blocks.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            This routine has no habits. Edit it to add some.
          </p>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Button className="w-full" onClick={start} disabled={startSession.isPending}>
          {startSession.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            'Start Routine'
          )}
        </Button>
      </div>

      <StartNewRoutineConflictDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        onResume={() => {
          if (active?.routineId) router.push(`/routines/${active.routineId}/active`);
          setConflictOpen(false);
        }}
        onStartNew={startNewAfterDiscard}
        pending={discardSession.isPending || startSession.isPending}
      />
    </div>
  );
}
