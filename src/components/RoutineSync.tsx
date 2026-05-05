'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useActiveRoutine, useCompleteSet, useCompleteBreak } from '@/hooks/use-active-routine';
import { useRoutineSessionStore } from '@/stores/routine-session-store';
import { computeReplayForward } from '@/lib/routine-session';
import { formatRemaining } from '@/lib/format';

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch {}
}

export function RoutineSync() {
  const { data: session } = useActiveRoutine();
  const completeSet = useCompleteSet();
  const completeBreak = useCompleteBreak();
  const advancingRef = useRef(false);

  // Hydrate store on each fetch.
  useEffect(() => {
    useRoutineSessionStore.getState().hydrate(session ?? null);
  }, [session]);

  const activeTimer = session?.activeTimer ?? null;

  // Replay-forward / natural-completion driver
  useEffect(() => {
    if (!activeTimer) return;
    const timer = activeTimer;
    let cancelled = false;
    async function tick() {
      if (cancelled || advancingRef.current) return;
      const action = computeReplayForward(timer, new Date());
      if (action.action === 'stable') return;
      advancingRef.current = true;
      try {
        if (action.action === 'complete-set') {
          // Use the timer's intended end (start + target) instead of letting the server
          // fall back to new Date(), which would bake network latency into the duration.
          const endedAt = new Date(
            new Date(timer.startTime).getTime() +
              timer.targetDurationSeconds * 1000,
          ).toISOString();
          await completeSet.mutateAsync({ setRowId: action.setRowId, endedEarlyAt: endedAt });
          sendBrowserNotification('Set complete', 'Break starting');
        } else {
          await completeBreak.mutateAsync();
          sendBrowserNotification('Break complete', 'Ready for next set');
        }
      } catch {
        toast.error('Could not advance routine');
      } finally {
        advancingRef.current = false;
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeTimer, completeSet, completeBreak]);

  // Display-time tick
  useEffect(() => {
    if (!activeTimer) {
      useRoutineSessionStore.getState().setDisplayTime('00:00:00');
      return;
    }
    const { startTime, targetDurationSeconds } = activeTimer;
    function tick() {
      useRoutineSessionStore.getState().setDisplayTime(
        formatRemaining(startTime, targetDurationSeconds),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  return null;
}
