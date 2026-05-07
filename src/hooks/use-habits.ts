import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Habit } from '@/lib/types';

export function useHabits(initialData?: Habit[]) {
  return useSuspenseQuery({
    queryKey: queryKeys.habits.all,
    queryFn: () => api<{ habits: Habit[] }>('/api/habits'),
    select: (data) => data.habits,
    ...(initialData ? { initialData: { habits: initialData } } : {}),
  });
}

export function useAddHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api('/api/habits', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (habitId: number) =>
      api(`/api/habits/${habitId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { habitId: number; targetDurationSeconds?: number; startTime?: string }) =>
      api('/api/timer/start', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.habits.all }),
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ durationSeconds: number; habitId: number }>('/api/timer/stop', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
