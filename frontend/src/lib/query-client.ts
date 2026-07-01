import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

import {
  playDeleteSound,
  playErrorSound,
  playSuccessSound,
} from '@/hooks/use-sound-feedback';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';

/**
 * Stale times for each data category, mirroring backend Redis cache TTLs.
 * A query whose data is still "fresh" (age < staleTime) will not trigger a
 * background refetch when re-mounted or when the window regains focus.
 *
 * Source: api/app/settings.py CACHE_TTL_* constants.
 */
export const STALE_TIMES = {
  /** Dashboard aggregate stats — backend: CACHE_TTL_DASHBOARD_STATS (60s) */
  DASHBOARD_STATS: 60_000,
  /** Per-account current/future balances — backend: CACHE_TTL_ACCOUNT_BALANCES (30s) */
  ACCOUNT_BALANCES: 30_000,
  /** Credit-card expense breakdown by category — backend: CACHE_TTL_CATEGORY_BREAKDOWN (300s) */
  CATEGORY_BREAKDOWN: 300_000,
  /** Balance forecast — backend: CACHE_TTL_BALANCE_FORECAST (120s) */
  BALANCE_FORECAST: 120_000,
  /** Cash-flow forecast — treated the same as balance forecast */
  CASH_FLOW_FORECAST: 120_000,
  /** General list endpoints (accounts, expenses, revenues, etc.) */
  DEFAULT_LIST: 60_000,
} as const;

// Debounce multiple simultaneous query failures (e.g. full network outage that
// fails all queries at once) into a single toast notification.
let lastErrorShownAt = 0;
const ERROR_DEBOUNCE_MS = 2_000;

/**
 * Global QueryClient used by the entire application.
 *
 * Defaults:
 * - staleTime: 60 s  — matches the most common backend cache TTL
 * - gcTime: 5 min    — inactive cache entries are kept in memory for 5 minutes
 * - retry: 1         — one automatic retry on failure (network errors, 5xx)
 * - refetchOnWindowFocus: true — stale data refetches when the tab regains focus
 *
 * Global error handling: All query failures show a destructive toast via the
 * standalone `toast()` function (safe to call outside React).  Errors within
 * 2 s of each other are collapsed into a single notification.
 *
 * Global sound feedback: since every page's create/update/delete action goes
 * through a `useMutation` backed by this client, playing tones here covers
 * the whole app without wiring sound into each individual page. `delete()`
 * on `BaseService` resolves to `void`, so a nullish mutation result is used
 * to tell a deletion apart from a create/update (which resolve to the record).
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const now = Date.now();
      if (now - lastErrorShownAt > ERROR_DEBOUNCE_MS) {
        lastErrorShownAt = now;
        playErrorSound();
        toast({
          title: 'Erro ao carregar dados',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    },
  }),
  mutationCache: new MutationCache({
    // After any successful mutation (create/update/delete), invalidate all
    // active queries so every view that reads from the database is refreshed.
    onSuccess: (data) => {
      if (data === undefined || data === null) {
        playDeleteSound();
      } else {
        playSuccessSound();
      }
      void queryClient.invalidateQueries();
    },
    onError: () => {
      playErrorSound();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: STALE_TIMES.DEFAULT_LIST,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});
