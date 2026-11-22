import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components/ui';
import { markNotificationRead } from '@/lib/api/endpoints/notifications';
import type { PushData } from '@/lib/api/types/tracking';
import { useUnreadNotificationCount } from '@/lib/query/hooks/useNotifications';
import {
  ensureNotificationChannels,
  getPushPermission,
  notifications,
  notificationsAvailable,
  onPushTokenRefresh,
  pushRegistrationSupported,
  registerForPush,
  requestPushPermission,
  setAppBadgeCount,
} from '@/lib/notifications/push';
import {
  invalidateForPush,
  invalidateInbox,
  isSilentPush,
  parsePushData,
  routeForPush,
} from '@/lib/notifications/routing';
import { useAuthHydrated, useAuthStore } from '@/lib/store';
import { useNeedsOnboarding } from '@/lib/store/useOnboardingStore';

/** When the customer last said "Not now" to the explanation. */
export const SOFT_PROMPT_KEY = 'ahaar.push.softPromptDismissedAt';
/** Ask again after a week of "Not now", never sooner. */
const SOFT_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Not the moment the app opens (that's the splash and the home screen
 * loading) and not mid-sign-in: a few seconds into a signed-in session.
 */
const SOFT_PROMPT_DELAY_MS = 6_000;

/**
 * Push notifications for the customer app. Mounted once in the root layout.
 *
 *  - Registers the device's FCM token with the API whenever a session starts
 *    (sign-in or cold start) and whenever FCM rotates it — only once the
 *    customer has allowed notifications.
 *  - Asks for that permission through an in-app explanation first, a few
 *    seconds into a signed-in session; the system dialog only follows a "yes".
 *  - Creates the Android channels (sound, heads-up importance) on every start.
 *  - A push that arrives in the foreground shows the same system banner and
 *    sound as in the background, and refreshes the order/meal it's about plus
 *    the bell's inbox. No in-app toast on top: the banner already says it and
 *    is tappable, so a toast would announce every update twice.
 *  - Tapping a notification (also from a cold start) opens that order or meal.
 *  - Keeps the app icon's badge equal to the inbox's unread count.
 *
 * Renders nothing in a build without the native module (Expo Go, web).
 */
export function PushNotifications() {
  if (!notificationsAvailable) return null;
  return <PushNotificationsInner />;
}

/**
 * Foreground presentation: every visible push looks and sounds the same as in
 * the background (heads-up banner, the channel's sound, badge). A silent push
 * (no title or body) only refreshes data. On Android `shouldPlaySound: false`
 * would also suppress the heads-up, so the two always go together.
 */
let handlerInstalled = false;
function installForegroundHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  notifications().setNotificationHandler({
    handleNotification: async (notification) => {
      const show = !isSilentPush(notification.request.content);
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: show,
      };
    },
  });
}

function PushNotificationsInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useAuthHydrated();
  const authToken = useAuthStore((s) => s.token);
  const signedIn = authToken !== null;
  const needsOnboarding = useNeedsOnboarding();
  const navigationReady = Boolean(useRootNavigationState()?.key);

  const [softPromptOpen, setSoftPromptOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  /** Notification ids already acted on, so a cold-start tap isn't handled twice. */
  const handled = useRef(new Set<string>());
  /** A tap that arrived before the app could navigate. */
  const [pendingRoute, setPendingRoute] = useState<PushData | null>(null);

  useEffect(installForegroundHandler, []);

  // Channels before the first push can arrive; re-run on a language change so
  // their names in system Settings follow the app's language.
  const language = i18n.language;
  useEffect(() => {
    void ensureNotificationChannels();
  }, [language]);

  // The app icon badge mirrors the inbox. Signed out the count is 0, which
  // also clears a badge left over from the previous session.
  const { count: unreadCount } = useUnreadNotificationCount();
  useEffect(() => {
    if (!hydrated) return;
    void setAppBadgeCount(unreadCount);
  }, [hydrated, unreadCount]);

  const openFor = useCallback(
    (data: PushData) => {
      invalidateForPush(queryClient, data);
      invalidateInbox(queryClient);
      router.push(routeForPush(data));
    },
    [queryClient, router],
  );

  const onTap = useCallback(
    (response: { notification: { request: { identifier: string; content: { data?: unknown } } } }) => {
      const id = response.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      // The push carries its inbox row id: opening it counts as reading it.
      const raw = response.notification.request.content.data as { notification_id?: unknown } | undefined;
      if (typeof raw?.notification_id === 'string' && raw.notification_id) {
        markNotificationRead(raw.notification_id).catch(() => undefined);
      }
      const data = parsePushData(response.notification.request.content.data);
      if (data) setPendingRoute(data);
    },
    [],
  );

  // ── Receiving and tapping ──────────────────────────────────────────────────
  useEffect(() => {
    const Notifications = notifications();

    // The system banner (see the handler) is the announcement; this only
    // brings the data behind it up to date.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      if (!isSilentPush(content)) invalidateInbox(queryClient);
      const data = parsePushData(content.data);
      if (data) invalidateForPush(queryClient, data);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener(onTap);

    // Cold start: the tap that launched the app.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        onTap(response);
        return Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    return () => {
      received.remove();
      tapped.remove();
    };
  }, [queryClient, onTap]);

  // Navigate once the router is mounted and the session is known. Signed out,
  // the order screens would only ask to sign in, so the tap is dropped.
  // Each tap is a new object, so remembering the last one consumed is enough.
  const consumed = useRef<PushData | null>(null);
  useEffect(() => {
    if (!pendingRoute || consumed.current === pendingRoute) return;
    if (!navigationReady || !hydrated || needsOnboarding) return;
    consumed.current = pendingRoute;
    if (signedIn) openFor(pendingRoute);
  }, [pendingRoute, navigationReady, hydrated, needsOnboarding, signedIn, openFor]);

  // ── Registration ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pushRegistrationSupported || !hydrated || !authToken || needsOnboarding) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const permission = await getPushPermission();
      if (cancelled) return;

      if (permission === 'granted') {
        await registerForPush();
        return;
      }
      if (permission !== 'undetermined') return;

      const dismissedAt = Number(await AsyncStorage.getItem(SOFT_PROMPT_KEY).catch(() => null));
      if (cancelled || (dismissedAt && Date.now() - dismissedAt < SOFT_PROMPT_COOLDOWN_MS)) return;
      timer = setTimeout(() => {
        if (!cancelled) setSoftPromptOpen(true);
      }, SOFT_PROMPT_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // Keyed on the token: a new session (another account) registers afresh.
  }, [hydrated, authToken, needsOnboarding]);

  // FCM rotated the token: tell the API, if anyone is signed in.
  useEffect(
    () =>
      onPushTokenRefresh((token) => {
        if (useAuthStore.getState().token) void registerForPush(token);
      }),
    [],
  );

  const allow = async () => {
    setRequesting(true);
    const granted = await requestPushPermission();
    setRequesting(false);
    setSoftPromptOpen(false);
    if (granted) await registerForPush();
  };

  const later = () => {
    setSoftPromptOpen(false);
    void AsyncStorage.setItem(SOFT_PROMPT_KEY, String(Date.now())).catch(() => undefined);
  };

  return (
    <Dialog
      open={softPromptOpen && signedIn}
      onClose={later}
      title={t('tracking.push.softTitle')}
      description={t('tracking.push.softBody')}
      footer={
        <View className="gap-2">
          <Button label={t('tracking.push.softAllow')} onPress={allow} loading={requesting} />
          <Button
            label={t('tracking.push.softLater')}
            variant="ghost"
            onPress={later}
            disabled={requesting}
          />
        </View>
      }
    >
      <View className="mt-3 items-center">
        <Text style={{ fontSize: 40 }}>🛵</Text>
      </View>
    </Dialog>
  );
}
