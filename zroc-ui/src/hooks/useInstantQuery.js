// src/hooks/useInstantQuery.js
import { useQuery } from '@tanstack/react-query';
import { instantQuery } from '@/api/prometheus';

export function useInstantQuery(promql, {
  refreshMs = 30_000,
  enabled   = true,
  select,
} = {}) {
  return useQuery({
    queryKey:    ['instant', promql],
    queryFn:     () => instantQuery(promql),
    refetchInterval: refreshMs,
    enabled:     enabled && !!promql,
    select,
    staleTime:   refreshMs / 2,
  });
}
