import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { playSetCompleteChime, playBreakCompleteChime } from '@/lib/sounds';
import type { ActiveRoutineSession, RoutineSessionSummary } from '@/lib/types';

type ActiveResp = { session: ActiveRoutineSession | null };
type SessionResp = { session: ActiveRoutineSession };
type SummaryResp = { summary: RoutineSessionSummary };

export function useActiveRoutine() {
  return useQuery({
    queryKey: queryKeys.routineSession.active,
    queryFn: () => api<ActiveResp>('/api/routines/active'),
    select: (d) => d.session,
    staleTime: Infinity,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: queryKeys.routineSession.active });
}

export function useStartRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routineId: number) =>
      api<SessionResp>(`/api/routines/${routineId}/start`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDiscardRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ discarded: boolean }>('/api/routines/active/discard', { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useFinishRoutineSession() {
  return useMutation({
    mutationFn: () =>
      api<SummaryResp>('/api/routines/active/finish', { method: 'POST' }),
  });
}

export function useSaveRoutineSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ sessionId: number }>('/api/routines/active/save', { method: 'POST' }),
    onSuccess: () => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: queryKeys.history.all });
      qc.invalidateQueries({ queryKey: queryKeys.habits.all });
      qc.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}

export function useStartSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (setRowId: number) =>
      api<SessionResp>(`/api/routines/active/sets/${setRowId}/start`, { method: 'POST' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useCompleteSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { setRowId: number; endedEarlyAt?: string }) =>
      api<SessionResp>(`/api/routines/active/sets/${vars.setRowId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ endedEarlyAt: vars.endedEarlyAt }),
      }),
    onSuccess: () => {
      playSetCompleteChime();
      invalidate(qc);
    },
  });
}

export function usePatchSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      setRowId: number;
      patch: { plannedDurationSeconds?: number; plannedBreakSeconds?: number; actualDurationSeconds?: number };
    }) =>
      api<SessionResp>(`/api/routines/active/sets/${vars.setRowId}`, {
        method: 'PATCH',
        body: JSON.stringify(vars.patch),
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useSkipBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SessionResp>('/api/routines/active/break/skip', { method: 'POST' }),
    onSuccess: () => {
      playBreakCompleteChime();
      invalidate(qc);
    },
  });
}

export function useCompleteBreak() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<SessionResp>('/api/routines/active/break/complete', { method: 'POST' }),
    onSuccess: () => {
      playBreakCompleteChime();
      invalidate(qc);
    },
  });
}
