/**
 * On-disk query cache.
 *
 * Cold start renders from this immediately — a previously-visited screen shows
 * real data with no spinner, then quietly refetches if the device is online.
 *
 * What is NOT persisted, and why:
 *   - **Auth token** — lives in SecureStore via `useAuthStore`, never in the
 *     query cache. AsyncStorage is unencrypted.
 *   - **Mutations** — `shouldDehydrateMutation` returns false. A resumed
 *     checkout after an app kill could double-charge; the user re-submits
 *     instead.
 *   - **Anything tagged `meta: { persist: false }`** — for short-lived or
 *     sensitive reads (see `AhaarQueryMeta`).
 *   - **Failed/pending queries** — `defaultShouldDehydrateQuery` keeps only
 *     successful ones, so an error state never rehydrates as if it were data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, type DehydrateOptions } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';

import { CACHE_LIFETIME_MS } from './queryClient';

const STORAGE_KEY = 'ahaar.query-cache';

/**
 * Bump manually when a cached response shape changes in a way that would break
 * older persisted data — e.g. renaming a field the UI reads. Independent of the
 * app version so a contract change can be busted without shipping a release.
 */
const CACHE_SCHEMA_VERSION = 'v1';

/**
 * Cache buster. Any change to this string throws away the whole persisted
 * cache on next launch rather than rehydrating data in an outdated shape.
 *
 * `nativeApplicationVersion` / `nativeBuildVersion` are null in Expo Go, so
 * they fall back to a literal — in that case only the schema version busts,
 * which is fine for development.
 */
export const cacheBuster = [
  CACHE_SCHEMA_VERSION,
  Application.nativeApplicationVersion ?? 'dev',
  Application.nativeBuildVersion ?? '0',
].join('-');

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: STORAGE_KEY,
  // Batch rapid cache writes into one AsyncStorage round-trip.
  throttleTime: 1000,
});

const dehydrateOptions: DehydrateOptions = {
  shouldDehydrateQuery: (query) => {
    if (query.meta?.persist === false) return false;
    return defaultShouldDehydrateQuery(query);
  },
  shouldDehydrateMutation: () => false,
};

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: asyncStoragePersister,
  maxAge: CACHE_LIFETIME_MS,
  buster: cacheBuster,
  dehydrateOptions,
};

/**
 * Wipe the on-disk cache. Called on sign-out so one user's data cannot be
 * rehydrated into another's session on the same device.
 */
export async function clearPersistedCache(): Promise<void> {
  await asyncStoragePersister.removeClient();
}
