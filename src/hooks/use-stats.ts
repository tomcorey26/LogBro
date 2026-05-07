import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Stats } from "@/server/db/stats";

export function useStats(initialData?: Stats) {
  return useSuspenseQuery({
    queryKey: queryKeys.stats.all,
    queryFn: () => api<{ stats: Stats }>("/api/stats"),
    select: (data) => data.stats,
    ...(initialData ? { initialData: { stats: initialData } } : {}),
  });
}
