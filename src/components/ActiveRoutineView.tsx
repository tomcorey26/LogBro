'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import {
  useDiscardRoutineSession, useFinishRoutineSession, useStartSet,
  useCompleteSet, usePatchSet, useSkipBreak,
} from '@/hooks/use-active-routine';
import { RoutineBlockCard } from '@/components/RoutineBlockCard';
import { DiscardRoutineDialog } from '@/components/DiscardRoutineDialog';
import { NoSetsCompletedDialog } from '@/components/NoSetsCompletedDialog';
import { RoutineSessionSummary } from '@/components/RoutineSessionSummary';
import { Spinner } from '@/components/Spinner';
import { useHaptics } from '@/hooks/use-haptics';
import { ApiError } from '@/lib/api';
import { computeSetRowState } from '@/lib/routine-session';
import type { RoutineSessionSet } from '@/lib/types';

export function ActiveRoutineView() {
  const router = useRouter();
  const { trigger } = useHaptics();
  const session = useRoutineSessionStore((s) => s.session);
  const summary = useRoutineSessionStore((s) => s.summary);
  const setSummary = useRoutineSessionStore((s) => s.setSummary);
  const reset = useRoutineSessionStore((s) => s.reset);
  const displayTime = useRoutineSessionStore((s) => s.displayTime);

  const discard = useDiscardRoutineSession();
  const finish = useFinishRoutineSession();
  const startSet = useStartSet();
  const completeSet = useCompleteSet();
  const patchSet = usePatchSet();
  const skipBreak = useSkipBreak();

  const [discardOpen, setDiscardOpen] = useState(false);
  const [noCompletedOpen, setNoCompletedOpen] = useState(false);

  if (summary) {
    return (
      <>
        <RoutineSessionSummary
          summary={summary}
          onDiscard={() => setDiscardOpen(true)}
          onBack={() => setSummary(null)}
          onSaved={() => {
            setSummary(null);
            reset();
            router.push('/routines');
          }}
        />
        <DiscardRoutineDialog open={discardOpen} onOpenChange={setDiscardOpen} onConfirm={handleDiscard} />
      </>
    );
  }

  if (!session) return <Spinner />;

  const blocks = groupSetsByBlock(session.sets);
  const activeTimer = session.activeTimer;

  function rowState(set: RoutineSessionSet) {
    return computeSetRowState(set, activeTimer);
  }

  function activeTimerProgressPct(): number | undefined {
    if (!activeTimer) return undefined;
    const elapsed = (Date.now() - new Date(activeTimer.startTime).getTime()) / 1000;
    const pct = 1 - elapsed / activeTimer.targetDurationSeconds;
    return Math.max(0, Math.min(1, pct));
  }

  async function handleFinish() {
    try {
      const data = await finish.mutateAsync();
      setSummary(data.summary);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setNoCompletedOpen(true);
      else toast.error('Could not finish routine');
    }
  }

  async function handleDiscard() {
    trigger('error');
    setDiscardOpen(false);
    setNoCompletedOpen(false);
    try {
      await discard.mutateAsync();
    } catch {
      toast.error('Could not discard routine');
      return;
    }
    setSummary(null);
    reset();
    router.push('/routines');
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="sticky -top-0.5 md:-top-6 z-10 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="min-w-0">
          {(() => {
            const phase = activeTimer?.phase;
            const statusLabel =
              phase === 'set' ? 'Active' : phase === 'break' ? 'Resting' : 'Idle';
            const dotClass =
              phase === 'set'
                ? 'bg-primary animate-pulse'
                : phase === 'break'
                  ? 'bg-info animate-pulse'
                  : 'bg-muted-foreground/60';
            return (
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                  {statusLabel}
                </span>
              </div>
            );
          })()}
          <h2 className="text-lg font-semibold mt-0.5 truncate">{session.routineNameSnapshot}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(true)}>Discard</Button>
          <Button size="sm" onClick={handleFinish}>Finish</Button>
        </div>
      </div>

      <div className="flex-1 py-4 space-y-3">
        {blocks.map((block, i) => (
          <RoutineBlockCard
            key={i}
            mode="active"
            habitName={block.sets[0].habitNameSnapshot}
            notes={block.sets[0].notesSnapshot}
            rows={block.sets.map((set) => {
              const state = rowState(set);
              return {
                set,
                state,
                displayTime,
                progressPct:
                  state === 'running' || state === 'break-running'
                    ? activeTimerProgressPct()
                    : undefined,
                onStart: () => startSet.mutate(set.id),
                onEnd: () => completeSet.mutate({ setRowId: set.id }),
                onSkipBreak: () => skipBreak.mutate(),
                onPatch: (patch) => patchSet.mutate({ setRowId: set.id, patch }),
              };
            })}
          />
        ))}
      </div>

      <DiscardRoutineDialog open={discardOpen} onOpenChange={setDiscardOpen} onConfirm={handleDiscard} />
      <NoSetsCompletedDialog open={noCompletedOpen} onOpenChange={setNoCompletedOpen} onDiscard={handleDiscard} />
    </div>
  );
}

function groupSetsByBlock(sets: RoutineSessionSet[]) {
  const map = new Map<number, RoutineSessionSet[]>();
  for (const s of sets) {
    const list = map.get(s.blockIndex) ?? [];
    list.push(s);
    map.set(s.blockIndex, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([, set]) => ({ sets: set.sort((x, y) => x.setIndex - y.setIndex) }));
}
