'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useActiveRoutine,
  useCompleteSet,
  useCompleteBreak,
  completeSetMutationKey,
  completeBreakMutationKey,
} from '@/hooks/use-active-routine';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { computeReplayForward } from '@/lib/routine-session';
import { formatRemaining } from '@/lib/format';

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

export function RoutineSync() {
  const queryClient = useQueryClient();
  const { data: session } = useActiveRoutine();
  const { mutateAsync: completeSet } = useCompleteSet();
  const { mutateAsync: completeBreak } = useCompleteBreak();

  // Hydrate store on each fetch.
  useEffect(() => {
    useRoutineSessionStore.getState().hydrate(session ?? null);
  }, [session]);

  const activeTimer = session?.activeTimer ?? null;
  const activeSet = activeTimer
    ? session?.sets.find((s) => s.id === activeTimer.routineSessionSetId) ?? null
    : null;
  const titleLabel =
    activeTimer?.phase === 'break' ? 'Break' : activeSet?.habitNameSnapshot ?? null;

  // Replay-forward / natural-completion driver
  useEffect(() => {
    if (!activeTimer) return;

    const timer = activeTimer;
    let cancelled = false;

    function isAdvancing() {
      return (
        queryClient.isMutating({ mutationKey: completeSetMutationKey }) +
          queryClient.isMutating({ mutationKey: completeBreakMutationKey }) >
        0
      );
    }

    async function tick() {
      console.log('Tick ran')
      if (cancelled || isAdvancing()) return;

      const action = computeReplayForward(timer, new Date());

      if (action.action === 'stable') return;

      try {
        if (action.action === 'complete-set') {
          // Use the timer's intended end (start + target) instead of letting the server
          // fall back to new Date(), which would bake network latency into the duration.
          const endedAt = new Date(
            new Date(timer.startTime).getTime() +
              timer.targetDurationSeconds * 1000,
          ).toISOString();
          await completeSet({ setRowId: action.setRowId, endedEarlyAt: endedAt });
          sendBrowserNotification('Set complete', 'Break starting');
        } else {
          await completeBreak();
          sendBrowserNotification('Break complete', 'Ready for next set');
        }
      } catch {
        toast.error('Could not advance routine');
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeTimer, queryClient, completeSet, completeBreak]);

  // Display-time tick (single source of truth for store + document title)
  useEffect(() => {
    if (!activeTimer) {
      useRoutineSessionStore.getState().setDisplayTime('00:00:00');
      return;
    }
    const { startTime, targetDurationSeconds } = activeTimer;
    const prevTitle = document.title;
    function tick() {
      const time = formatRemaining(startTime, targetDurationSeconds);
      useRoutineSessionStore.getState().setDisplayTime(time);
      if (titleLabel) document.title = `${time} — ${titleLabel}`;
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      document.title = prevTitle;
    };
  }, [activeTimer, titleLabel]);

  return null;
}
