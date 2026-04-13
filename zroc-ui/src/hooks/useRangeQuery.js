// src/hooks/useRangeQuery.js
import { useQuery } from '@tanstack/react-query';
import { rangeQuery } from '@/api/prometheus';

const WINDOW_SECONDS = {
  '1h':  3600,
  '6h':  21600,
  '24h': 86400,
  '7d':  604800,
  '30d': 2592000,
};

const STEP_FOR_WINDOW = {
  '1h':  '30s',
  '6h':  '120s',
  '24h': '300s',
  '7d':  '900s',
  '30d': '3600s',
};

export function useRangeQuery(promql, {
  window    = '6h',
  refreshMs = 60_000,
  enabled   = true,
  select,
} = {}) {
  const windowSec = WINDOW_SECONDS[window] ?? 21600;
  const step      = STEP_FOR_WINDOW[window] ?? '120s';

  return useQuery({
    queryKey:    ['range', promql, window],
    queryFn:     () => {
      const end   = Math.floor(Date.now() / 1000);
      const start = end - windowSec;
      return rangeQuery(promql, start, end, step);
    },
    refetchInterval: refreshMs,
    enabled:     enabled && !!promql,
    select,
    staleTime:   refreshMs / 2,
  });
}
