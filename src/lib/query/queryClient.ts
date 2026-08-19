/**
 * The QueryClient and its production defaults.
 *
 * Offline-first shape: `gcTime` is deliberately far longer than `staleTime`.
 * `staleTime` (1 min) decides when a *refetch* is triggered; `gcTime` (24 h)
 * decides how long the data survives in cache — and therefore how much is
 * available instantly on a cold start after `persister.ts` rehydrates it. A
 * short gcTime would evict everything before the app reopened, defeating
 * persistence entirely.
 */
import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '../api/types/common';

/**
 * Typed `meta` for queries. Declaration-merging into TanStack's `Register`
 * means `query.meta.persist` is type-checked at every call site instead of
 * being `unknown`.
 */
export interface AhaarQueryMeta extends Record<string, unknown> {
  /**
   * Set `false` to keep a query out of the on-disk cache. Use for anything
   * short-lived or sensitive that should never survive an app kill.
   */
  persist?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AhaarQueryMeta;
    mutationMeta: AhaarQueryMeta;
  }
}

/** 24 hours, in ms — the cache lifetime and the persisted `maxAge`. */
export const CACHE_LIFETIME_MS = 1000 * 60 * 60 * 24;

/**
 * Retry policy.
 *
 * A 4xx is a definitive answer — the request was malformed, unauthorised, or
 * hit a business rule (`422 Delivery is past cutoff`). Retrying cannot change
 * the outcome, and retrying a 429 actively makes rate limiting worse. Only
 * transport failures (`status: 0` — offline, DNS, timeout) and 5xx are worth
 * a second attempt.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;

  if (isApiError(error)) {
    if (error.status >= 400 && error.status < 500) return false;
    return true;
  }

  // Unrecognised error shape — allow the retry budget rather than swallow a
  // possibly-transient failure.
  return true;
}

/** Exponential backoff, capped so a slow network never stalls a screen. */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 15_000);
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: CACHE_LIFETIME_MS,
        retry: shouldRetry,
        retryDelay,
        // The device came back online — anything stale should catch up.
        refetchOnReconnect: true,
        // Baseline. Hooks that must be fresh at the moment of use (quota,
        // swap options) override this with 'always'.
        refetchOnMount: true,
        // AppState 'active' drives this via focusManager (see deviceSync.ts).
        // It is what makes "admin changes the menu → user reopens the app →
        // sees it" work without any push infrastructure.
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Mutations are not idempotent unless the endpoint takes an
        // Idempotency-Key. Retrying a checkout could double-charge.
        retry: false,
      },
    },
  });
}
