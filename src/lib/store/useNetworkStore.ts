/**
 * Connectivity state for the UI.
 *
 * Deliberately NOT persisted — connectivity on last launch says nothing about
 * now, and a stale `isOnline: true` would suppress the offline banner at
 * exactly the moment it matters.
 *
 * TanStack Query's own `onlineManager` is the source of truth for *fetching*
 * decisions; this store exists so components can render an offline banner or a
 * "showing saved data" hint. Both are fed by the single NetInfo subscription in
 * `../query/deviceSync.ts` — do not add another listener.
 */
import { create } from 'zustand';

interface NetworkState {
  /** Null until the first NetInfo event arrives (avoids a false offline flash). */
  isOnline: boolean | null;
  /** Epoch ms of the last successful transition to online. */
  lastSyncedAt: number | null;
  setOnline: (isOnline: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: null,
  lastSyncedAt: null,

  setOnline: (isOnline) => {
    const previous = get().isOnline;
    if (previous === isOnline) return;

    set({
      isOnline,
      lastSyncedAt: isOnline ? Date.now() : get().lastSyncedAt,
    });
  },
}));

/**
 * `true` only when we know we're offline. Treats the pre-first-event `null` as
 * online so nothing flashes a banner during startup.
 */
export function useIsOffline(): boolean {
  return useNetworkStore((s) => s.isOnline === false);
}
