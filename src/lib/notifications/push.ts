/**
 * Push notifications (FCM) — registration with the Ahaar API.
 *
 * The API sends FCM messages straight to the device token
 * (`getDevicePushTokenAsync`), not through Expo's push service, so this
 * registers the raw token: `POST /device-tokens { token, platform, app }`.
 * The server ties it to the current Sanctum session and drops it when that
 * session signs out or is revoked; `DELETE /device-tokens` on sign-out is a
 * courtesy on top.
 *
 * Android only for now. On iOS `getDevicePushTokenAsync` returns an APNs
 * token, which the API's FCM sender can't address — registering it would only
 * produce failed sends. iOS needs either the Firebase iOS SDK (FCM token) or an
 * APNs sender on the API first.
 *
 * Needs a build that contains the native module. Expo Go on Android removed
 * remote push in SDK 53 (the library *throws* there), and an older development
 * build has no module at all — in both cases everything here is a no-op and
 * the app runs normally, the same approach as `lib/auth/google.ts`.
 */
import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { getAuthToken } from '../api/client';
import { registerDeviceToken, unregisterDeviceToken } from '../api/endpoints/tracking';
import i18n from '../i18n';

type NotificationsLib = typeof import('expo-notifications');

/** The Android channel the API addresses (`docs/delivery-api.md`). */
export const DELIVERY_CHANNEL_ID = 'ahaar-deliveries';

/** This binary can show and receive notifications at all. */
export const notificationsAvailable =
  Platform.OS !== 'web' &&
  !(Platform.OS === 'android' && isRunningInExpoGo()) &&
  requireOptionalNativeModule('ExpoPushTokenManager') != null;

/** This binary can register for remote push with the API (see the header). */
export const pushRegistrationSupported = notificationsAvailable && Platform.OS === 'android';

let lib: NotificationsLib | null = null;

/** Loaded on first use, and only when the native half exists. */
export function notifications(): NotificationsLib {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  lib ??= require('expo-notifications') as NotificationsLib;
  return lib;
}

export type PushPermission = 'granted' | 'undetermined' | 'denied';

/**
 * Android 13+ shows no permission dialog until a channel exists, so this runs
 * before any permission request or token read.
 */
export async function ensureDeliveryChannel(): Promise<void> {
  if (!notificationsAvailable || Platform.OS !== 'android') return;
  const Notifications = notifications();
  await Notifications.setNotificationChannelAsync(DELIVERY_CHANNEL_ID, {
    name: i18n.t('tracking.push.channelName'),
    description: i18n.t('tracking.push.channelDescription'),
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: '#ff2b85',
  }).catch(() => null);
}

/**
 * `undetermined` = we may still ask (the system dialog will appear);
 * `denied` = the OS won't show it again, only Settings can change it.
 */
export async function getPushPermission(): Promise<PushPermission> {
  if (!pushRegistrationSupported) return 'denied';
  try {
    const status = await notifications().getPermissionsAsync();
    if (status.granted) return 'granted';
    return status.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Show the system dialog. Call only after the in-app explanation. */
export async function requestPushPermission(): Promise<boolean> {
  if (!pushRegistrationSupported) return false;
  await ensureDeliveryChannel();
  try {
    const status = await notifications().requestPermissionsAsync();
    return status.granted;
  } catch {
    return false;
  }
}

/** The token this device last registered with the API, for sign-out. */
let registeredToken: string | null = null;

export function getRegisteredPushToken(): string | null {
  return registeredToken;
}

/**
 * Send this device's FCM token to the API. Safe to call repeatedly (on every
 * start, after sign-in, on token refresh): the API upserts by token.
 *
 * Does nothing without permission — it never prompts. Resolves `true` when a
 * token was registered. Never throws.
 */
export async function registerForPush(token?: string): Promise<boolean> {
  if (!pushRegistrationSupported || !getAuthToken()) return false;
  if ((await getPushPermission()) !== 'granted') return false;

  try {
    await ensureDeliveryChannel();
    const deviceToken = token ?? String((await notifications().getDevicePushTokenAsync()).data);
    if (!deviceToken) return false;
    await registerDeviceToken({ token: deviceToken, platform: 'android', app: 'customer' });
    registeredToken = deviceToken;
    return true;
  } catch (error) {
    // No Google Play services, FCM unreachable, or the API said no. Pushes
    // are an extra — tracking still polls — so the app carries on.
    if (__DEV__) console.warn('[push] registration failed', error);
    return false;
  }
}

/**
 * Best-effort `DELETE /device-tokens` before a session ends. Skipped when
 * there is no bearer token left to send it with (the 401 path): the API has
 * already dropped tokens tied to a revoked session, and an unauthenticated
 * call could only 401 again.
 */
export async function unregisterFromPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token || !getAuthToken()) return;
  await unregisterDeviceToken(token).catch(() => undefined);
}

/** Re-register whenever FCM rotates the token. Returns the unsubscribe. */
export function onPushTokenRefresh(listener: (token: string) => void): () => void {
  if (!pushRegistrationSupported) return () => undefined;
  const subscription = notifications().addPushTokenListener((devicePushToken) => {
    const token = String(devicePushToken.data ?? '');
    if (token) listener(token);
  });
  return () => subscription.remove();
}
