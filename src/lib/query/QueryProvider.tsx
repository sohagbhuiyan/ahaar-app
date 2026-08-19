/**
 * App-wide server-state provider.
 *
 * Uses `PersistQueryClientProvider` rather than the plain `QueryClientProvider`
 * so the on-disk cache is restored before children render — a previously
 * visited screen comes back with real data instead of a skeleton.
 *
 * Also the single place the device syncs (AppState / NetInfo) are mounted, and
 * where the API client's 401 handler is registered.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { setUnauthorizedHandler } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';
import { useReactQueryDeviceSync } from './deviceSync';
import { persistOptions } from './persister';
import { makeQueryClient } from './queryClient';
import { clearPrivateQueries } from './session';

interface Props {
  children: ReactNode;
  /**
   * Runs after the cache has been wiped on a 401, for navigation. Wired up in
   * step 6 once the login route exists; until then a rejected token just
   * clears state.
   */
  onUnauthorized?: () => void;
}

export function QueryProvider({ children, onUnauthorized }: Props) {
  // `useState(fn)` — not `useMemo` — so the client is created exactly once and
  // survives Fast Refresh without losing the cache.
  const [queryClient] = useState(makeQueryClient);

  useReactQueryDeviceSync();

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      // The token was revoked or the account deactivated. Drop the session and
      // every response that *belonged to it* — leaving those on the device
      // would let the next person to pick up the phone read them.
      //
      // The public catalogue is deliberately spared. Plans, dishes and slots
      // are unauthenticated reads that any visitor may see, so nothing about
      // them is private, and wiping them would blank the screen the customer
      // is standing on — the classic "my menu vanished" symptom of clearing
      // the whole cache on a background 401.
      //
      // `clearSession` goes through getState() rather than a hook so this
      // effect doesn't re-run whenever the store changes.
      await useAuthStore.getState().clearSession();
      await clearPrivateQueries(queryClient);

      onUnauthorized?.();
    });

    return () => setUnauthorizedHandler(null);
  }, [queryClient, onUnauthorized]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
