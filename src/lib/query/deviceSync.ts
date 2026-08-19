/**
 * Wires TanStack Query's `focusManager` and `onlineManager` to React Native.
 *
 * Neither works out of the box on RN: `focusManager` listens for browser
 * window focus, and `onlineManager` for `navigator.onLine`. Without this
 * module `refetchOnWindowFocus` and `refetchOnReconnect` are dead options.
 *
 * Mounted once, from `QueryProvider`.
 */
import { useEffect } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';

import { useNetworkStore } from '../store/useNetworkStore';

/**
 * A device is "online" when it has a connection AND the internet is reachable.
 *
 * `isInternetReachable` is `null` while NetInfo is still probing. Treating that
 * as offline would pause fetches during startup on a perfectly good
 * connection, so only an explicit `false` counts as unreachable.
 */
function isOnline(state: NetInfoState): boolean {
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

/**
 * Foreground → focus. This is the mechanism behind "the admin changed the menu,
 * the customer reopens the app, and sees it" — no push infrastructure needed.
 * Stale queries refetch on foreground; fresh ones don't, so it stays cheap.
 */
export function useAppStateFocusSync(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (status: AppStateStatus) => {
        // On web the browser's own focus handling is correct already.
        if (Platform.OS === 'web') return;
        focusManager.setFocused(status === 'active');
      },
    );

    return () => subscription.remove();
  }, []);
}

/**
 * NetInfo → `onlineManager` (which gates fetching) and → `useNetworkStore`
 * (which drives the offline banner). One subscription feeds both, so the two
 * can never disagree.
 */
export function useOnlineManagerSync(): void {
  useEffect(() => {
    const setOnline = useNetworkStore.getState().setOnline;

    // `setEventListener` hands us a setter and expects an unsubscribe back.
    const unsubscribe = onlineManager.setEventListener((setQueryOnline) =>
      NetInfo.addEventListener((state) => {
        const online = isOnline(state);
        setQueryOnline(online);
        setOnline(online);
      }),
    );

    // NetInfo only emits on *change*, so seed the initial value explicitly —
    // otherwise a device that never changes state stays at `null` forever.
    void NetInfo.fetch().then((state) => {
      const online = isOnline(state);
      onlineManager.setOnline(online);
      setOnline(online);
    });

    return unsubscribe;
  }, []);
}

/** Convenience: both syncs, for the provider to call once. */
export function useReactQueryDeviceSync(): void {
  useAppStateFocusSync();
  useOnlineManagerSync();
}
