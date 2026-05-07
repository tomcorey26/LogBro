import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { HistoryListItem } from '@/lib/types';

type HistoryFilters = { habitId?: string; range?: string; viewMode: string };

export function useHistory(filters: HistoryFilters, initialData?: { history: HistoryListItem[]; totalSeconds: number }) {
  // Only use initialData for the default (unfiltered) query to avoid stale data on filter changes
  const isDefaultFilter = !filters.habitId && filters.range === 'all';
  return useQuery({
    queryKey: queryKeys.history.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.habitId) params.set('habitId', filters.habitId);
      if (filters.viewMode === 'list' && filters.range && filters.range !== 'all') {
        params.set('range', filters.range);
      }
      return api<{ history: HistoryListItem[]; totalSeconds: number }>(`/api/history?${params}`);
    },
    ...(initialData && isDefaultFilter ? { initialData } : {}),
  });
}

export function useDeleteHistoryEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) =>
      api(`/api/history/${entryId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}

export function useLogHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { habitId: number; date: string; durationMinutes: number }) =>
      api('/api/history', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.history.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all });
    },
  });
}
