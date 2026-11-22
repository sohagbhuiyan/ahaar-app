/**
 * Live tracking of an instant order or a subscription meal.
 *
 * The server says how often to poll (`poll_seconds`) and when to stop (null).
 * On top of that the app only polls while someone can see the result: the
 * screen is focused (the caller passes `focused`, from expo-router's
 * `useIsFocused` — these hooks stay router-free) AND the app is in the
 * foreground. A push
 * (`order.status` / `delivery.status`) invalidates the query, so a status
 * change lands at once even between polls — see `lib/notifications`.
 */
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import * as trackingApi from '../../api/endpoints/tracking';
import type { Tracking } from '../../api/types/tracking';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

/**
 * The refetch interval for a tracking payload: `poll_seconds` in ms while the
 * server asks for polling and the viewer can see it, otherwise `false`.
 */
export function trackingRefetchInterval(
  data: Tracking | undefined,
  visible: boolean,
): number | false {
  if (!visible || !data?.poll_seconds) return false;
  return data.poll_seconds * 1000;
}

/** The app is in the foreground. */
export function useAppActive(): boolean {
  // Anything but `background` counts: Android reports `unknown` until the first
  // change event, and iOS's brief `inactive` (Control Centre) is still on screen.
  const [active, setActive] = useState(AppState.currentState !== 'background');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) =>
      setActive(state !== 'background'),
    );
    return () => subscription.remove();
  }, []);

  return active;
}

export interface TrackingOptions {
  /** Read at all. Default true. */
  enabled?: boolean;
  /** The screen showing it is focused. Default true. */
  focused?: boolean;
}

function useTracking(
  queryKey: readonly unknown[],
  queryFn: () => Promise<Tracking>,
  enabled: boolean,
  focused: boolean,
) {
  const signedIn = useIsSignedIn();
  const appActive = useAppActive();
  const visible = focused && appActive;

  return useQuery({
    queryKey,
    queryFn,
    enabled: signedIn && enabled,
    // Short: a rider moves. The interval does the steady work; this only
    // decides whether coming back to the screen re-reads at once.
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
    refetchInterval: (query) => trackingRefetchInterval(query.state.data, visible),
    refetchIntervalInBackground: false,
    // A tracking 404/403 is the server saying "nothing to track here"; don't
    // hammer it with retries.
    retry: 1,
  });
}

/** `GET /orders/{id}/tracking` */
export function useOrderTracking(id: string | number | undefined, options: TrackingOptions = {}) {
  const valid = id !== undefined && id !== '';
  return useTracking(
    queryKeys.orders.tracking(id ?? ''),
    () => trackingApi.getOrderTracking(id!),
    valid && (options.enabled ?? true),
    options.focused ?? true,
  );
}

/** `GET /deliveries/{id}/tracking` */
export function useDeliveryTracking(id: string | number | undefined, options: TrackingOptions = {}) {
  const valid = id !== undefined && id !== '';
  return useTracking(
    queryKeys.menu.tracking(id ?? ''),
    () => trackingApi.getDeliveryTracking(id!),
    valid && (options.enabled ?? true),
    options.focused ?? true,
  );
}
