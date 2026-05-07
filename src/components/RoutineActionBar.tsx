'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trophy, Play, SkipForward, Square } from 'lucide-react';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { useFinishRoutineSession, useStartSet, useSkipBreak, useCompleteSet } from '@/hooks/use-active-routine';
import { useHaptics } from '@/hooks/use-haptics';
import { PressableButton } from '@/components/ui/pressable-button';
import { ApiError } from '@/lib/api';

export function RoutineActionBar() {
  const router = useRouter();
  const { trigger } = useHaptics();
  const session = useRoutineSessionStore((s) => s.session);
  const setSummary = useRoutineSessionStore((s) => s.setSummary);
  const displayTime = useRoutineSessionStore((s) => s.displayTime);
  const mode = useRoutineSessionStore((s) => s.mode);
  const finish = useFinishRoutineSession();
  const startSet = useStartSet();
  const skipBreak = useSkipBreak();
  const completeSet = useCompleteSet();

  if (mode !== 'active' || !session) return null;

  const totalSets = session.sets.length;
  const activeTimer = session.activeTimer;
  const allComplete =
    !activeTimer && totalSets > 0 && session.sets.every((s) => s.completedAt);

  function navigateToActive() {
    if (session?.routineId) router.push(`/routines/${session.routineId}/active`);
  }

  function handleNavigate() {
    trigger('light');
    navigateToActive();
  }

  function handleNavigateKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNavigate();
    }
  }

  async function handleFinish(e: React.MouseEvent) {
    e.stopPropagation();
    trigger('medium');
    try {
      const data = await finish.mutateAsync();
      setSummary(data.summary);
      navigateToActive();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        navigateToActive();
        return;
      }
      toast.error('Could not finish routine');
    }
  }

  if (allComplete) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleNavigate}
        onKeyDown={handleNavigateKey}
        className="w-full px-4 py-3 bg-success/15 border-t border-success/40 flex items-center justify-between hover:bg-success/20 transition-colors cursor-pointer"
        aria-label="Open completed routine"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-4 w-4 text-success shrink-0" />
          <div className="flex flex-col items-start min-w-0">
            <span className="font-semibold text-sm text-success">
              Routine complete
            </span>
            <span className="text-xs text-muted-foreground">
              {totalSets} {totalSets === 1 ? 'set' : 'sets'} done
            </span>
          </div>
        </div>
        <PressableButton
          size="sm"
          onClick={handleFinish}
          disabled={finish.isPending}
          className="bg-success hover:bg-success/90 text-success-foreground shadow-[0_5px_0_0_color-mix(in_srgb,var(--color-success)_70%,black)] active:shadow-none active:translate-y-1.25"
        >
          {finish.isPending ? 'Finishing...' : 'Finish'}
        </PressableButton>
      </div>
    );
  }

  const currentSetIndex = (() => {
    // During break, activeTimer.routineSessionSetId points to the just-completed
    // set. Show the next upcoming set instead so "Resting" reads as "what's next."
    if (activeTimer?.phase === 'break') {
      const nextIdle = session.sets.findIndex((s) => !s.completedAt);
      if (nextIdle >= 0) return nextIdle;
      // Last set's break has no successor; fall through to the timer's set.
    }
    if (activeTimer) {
      const idx = session.sets.findIndex((s) => s.id === activeTimer.routineSessionSetId);
      return idx >= 0 ? idx : 0;
    }
    const nextIdle = session.sets.findIndex((s) => !s.completedAt);
    return nextIdle >= 0 ? nextIdle : totalSets - 1;
  })();
  const currentSet = session.sets[currentSetIndex];
  const isIdle = !activeTimer;
  const isBreakRunning = activeTimer?.phase === 'break';
  const isSetRunning = activeTimer?.phase === 'set';

  function handleStartSet(e: React.MouseEvent) {
    e.stopPropagation();
    if (!currentSet) return;
    trigger('medium');
    startSet.mutate(currentSet.id);
  }

  function handleSkipBreak(e: React.MouseEvent) {
    e.stopPropagation();
    trigger('light');
    skipBreak.mutate();
  }

  function handleEndSet(e: React.MouseEvent) {
    e.stopPropagation();
    if (!activeTimer) return;
    trigger('buzz');
    completeSet.mutate({ setRowId: activeTimer.routineSessionSetId });
  }

  let phaseLabel: string;
  if (activeTimer?.phase === 'set') phaseLabel = 'Recording';
  else if (activeTimer?.phase === 'break') phaseLabel = 'Resting';
  else phaseLabel = `Ready for set ${currentSetIndex + 1}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={handleNavigateKey}
      className="w-full px-4 py-3 bg-primary/10 border-t border-primary/30 flex items-center justify-between hover:bg-primary/15 transition-colors cursor-pointer"
      aria-label="Open active routine"
    >
      <div className="flex flex-col items-start min-w-0">
        <span className="font-semibold text-sm truncate max-w-[60vw]">
          {currentSet?.habitNameSnapshot ?? session.routineNameSnapshot} — Set {currentSetIndex + 1} of {totalSets}
        </span>
        <span className="text-xs text-muted-foreground">{phaseLabel}</span>
      </div>
      {isIdle ? (
        <PressableButton
          size="icon-sm"
          onClick={handleStartSet}
          disabled={startSet.isPending}
          aria-label={`Start set ${currentSetIndex + 1}`}
        >
          <Play className="h-3.5 w-3.5" />
        </PressableButton>
      ) : isBreakRunning ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-info font-semibold">{displayTime}</span>
          <PressableButton
            size="icon-sm"
            onClick={handleSkipBreak}
            disabled={skipBreak.isPending}
            aria-label="Skip break"
            className="bg-info hover:bg-info/90 text-info-foreground shadow-[0_5px_0_0_color-mix(in_srgb,var(--color-info)_70%,black)] active:shadow-none active:translate-y-1.25"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </PressableButton>
        </div>
      ) : isSetRunning ? (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-primary font-semibold">{displayTime}</span>
          <PressableButton
            size="icon-sm"
            variant="destructive"
            onClick={handleEndSet}
            disabled={completeSet.isPending}
            aria-label="End set"
          >
            <Square className="h-3.5 w-3.5" />
          </PressableButton>
        </div>
      ) : (
        <span className="font-mono text-sm">{displayTime}</span>
      )}
    </div>
  );
}
