/**
 * Cache lifecycle across a session change.
 *
 * Signing in, signing out and a revoked token all need the same thing: the
 * previous customer's data must not survive, and the public catalogue must.
 * Doing that in one place stops the two paths drifting — an earlier version
 * called `queryClient.clear()` on a 401, which also threw away the plans and
 * menu items the customer was reading and left them on a blank screen.
 */
import { dehydrate, type QueryClient } from '@tanstack/react-query';

import { PRIVATE_QUERY_ROOTS } from './keys';
import { persistOptions } from './persister';

/**
 * Evict everything owned by the signed-in customer, then write the trimmed
 * cache to disk immediately.
 *
 * The eager re-persist matters: the persister batches writes on a 1s throttle,
 * so without it a customer could sign out and have the app killed before their
 * orders left AsyncStorage.
 */
export async function clearPrivateQueries(queryClient: QueryClient): Promise<void> {
  for (const root of PRIVATE_QUERY_ROOTS) {
    queryClient.removeQueries({ queryKey: root });
  }

  try {
    // `persistClient` is typed `Promisable<void>` — awaiting covers both the
    // sync and async persisters.
    await persistOptions.persister.persistClient({
      buster: persistOptions.buster ?? '',
      timestamp: Date.now(),
      clientState: dehydrate(queryClient, persistOptions.dehydrateOptions),
    });
  } catch {
    // A failed write leaves stale private data on disk, which the next launch
    // discards anyway once `/me` 401s. Not worth crashing sign-out over.
  }
}
