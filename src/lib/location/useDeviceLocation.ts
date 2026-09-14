/**
 * The device's position, turned into an address draft — asked for, never forced.
 *
 * Every way this can fail is a state the UI can explain, not an exception:
 *
 *   denied        the customer said no. `canAskAgain` says whether asking again
 *                 will show the system prompt, or only Settings can change it.
 *   services_off  location is switched off for the whole phone.
 *   unavailable   permission and services are fine, but no fix arrived in time
 *                 (indoors, flight mode) and no recent position was cached.
 *   outside_area  a fix arrived, in a country Ahaar doesn't deliver to. The
 *                 draft is still attached, so the map can open there and let
 *                 the customer move the pin somewhere served.
 *
 * The country is read from the fix — Saudi Arabia, or Bangladesh while testing
 * — never assumed. A position whose street can't be looked up still resolves:
 * the coordinates are kept and `needsTyping` tells the form to ask for the rest.
 */
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { isCompleteDraft, type AddressDraft } from './address';
import { lookupPlace } from './lookup';

export type DeviceLocationStatus =
  | 'idle'
  | 'requesting'
  | 'locating'
  | 'resolved'
  | 'denied'
  | 'services_off'
  | 'unavailable'
  | 'outside_area';

export interface DeviceLocationState {
  status: DeviceLocationStatus;
  /** Set once `resolved`, and on `outside_area`. */
  draft: AddressDraft | null;
  /** Metres, as the OS reported the fix. */
  accuracy: number | null;
  /** Resolved, but the street/city couldn't be filled in automatically. */
  needsTyping: boolean;
  /** Only meaningful when `denied`. */
  canAskAgain: boolean;
  /** Customer-safe explanation for any state that needs one. */
  message: string | null;
}

/** A cold GPS fix indoors can take a while; past this, fall back. */
export const LOCATE_TIMEOUT_MS = 15_000;
/** A cached position younger than this is still "where you are". */
export const LAST_KNOWN_MAX_AGE_MS = 10 * 60_000;

const IDLE: DeviceLocationState = {
  status: 'idle',
  draft: null,
  accuracy: null,
  needsTyping: false,
  canAskAgain: true,
  message: null,
};

/** A fresh fix, or the last known one when a fresh one fails or takes too long. */
async function findPosition(timeoutMs: number): Promise<Location.LocationObject | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timedOut,
    ]);
    if (fix) return fix;
  } catch {
    // No fix — the cached position below is the fallback.
  } finally {
    clearTimeout(timer);
  }

  try {
    return await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  } catch {
    return null;
  }
}

export function useDeviceLocation({ timeoutMs = LOCATE_TIMEOUT_MS }: { timeoutMs?: number } = {}) {
  const [state, setState] = useState<DeviceLocationState>(IDLE);

  // Each attempt gets an id; a result from a superseded attempt (or one that
  // lands after unmount) is dropped rather than overwriting the newer state.
  const attempt = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attempt.current += 1;
    };
  }, []);

  /**
   * Resolves with the final state, or `null` when the attempt was cancelled
   * (reset, a newer attempt, or the screen went away).
   */
  const locate = useCallback(async (): Promise<DeviceLocationState | null> => {
    const id = ++attempt.current;
    const commit = (next: DeviceLocationState) => {
      if (!mounted.current || id !== attempt.current) return null;
      setState(next);
      return next;
    };

    commit({ ...IDLE, status: 'requesting' });

    try {
      let permission = await Location.getForegroundPermissionsAsync();
      // Only prompt when the OS will actually show a prompt; otherwise the
      // call just returns "denied" again and the customer sees nothing happen.
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) {
        return commit({
          ...IDLE,
          status: 'denied',
          canAskAgain: permission.canAskAgain,
          message: permission.canAskAgain
            ? 'Location access wasn’t allowed.'
            : 'Location access is turned off for Ahaar in your phone’s settings.',
        });
      }

      // Treat "can't tell" as on: the position request below reports the
      // real failure if it isn't.
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        return commit({
          ...IDLE,
          status: 'services_off',
          message: 'Location is switched off on your phone.',
        });
      }

      if (commit({ ...IDLE, status: 'locating' }) === null) return null;

      const fix = await findPosition(timeoutMs);
      if (!fix) {
        return commit({
          ...IDLE,
          status: 'unavailable',
          message: 'We couldn’t find your position just now.',
        });
      }

      const place = await lookupPlace(
        { latitude: fix.coords.latitude, longitude: fix.coords.longitude },
        'gps',
      );
      const accuracy = fix.coords.accuracy ?? null;

      if (!place.supported) {
        return commit({
          ...IDLE,
          status: 'outside_area',
          draft: place.draft,
          accuracy,
          needsTyping: !isCompleteDraft(place.draft),
          message: 'Ahaar doesn’t deliver where you are yet — we serve Saudi Arabia.',
        });
      }

      return commit({
        ...IDLE,
        status: 'resolved',
        draft: place.draft,
        accuracy,
        needsTyping: !isCompleteDraft(place.draft),
        message: place.found
          ? null
          : 'We found your position but couldn’t look up the street — please add your address.',
      });
    } catch {
      return commit({
        ...IDLE,
        status: 'unavailable',
        message: 'Something went wrong while finding your location.',
      });
    }
  }, [timeoutMs]);

  /** Back to idle, cancelling any attempt in flight. */
  const reset = useCallback(() => {
    attempt.current += 1;
    setState(IDLE);
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);

  /**
   * Android can switch location on from a system dialog; iOS only from
   * Settings. Resolves `true` when it is now on and worth locating again.
   */
  const enableServices = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        await Location.enableNetworkProviderAsync();
        return true;
      } catch {
        return false;
      }
    }
    Linking.openSettings().catch(() => undefined);
    return false;
  }, []);

  return { ...state, locate, reset, openSettings, enableServices };
}

export type DeviceLocation = ReturnType<typeof useDeviceLocation>;
