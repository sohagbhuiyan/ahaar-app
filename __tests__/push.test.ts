import { Platform as OuterPlatform } from 'react-native';

jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  // Read through a global: each isolated registry re-runs this factory.
  isRunningInExpoGo: () => Boolean((globalThis as { __expoGo?: boolean }).__expoGo),
  requireOptionalNativeModule: jest.fn(() => ({})),
}));

type PushModule = typeof import('@/lib/notifications/push');
type ClientModule = typeof import('@/lib/api/client');
type NotificationsMock = typeof import('../jest/expo-notifications-mock');

interface Loaded {
  push: PushModule;
  Notifications: NotificationsMock;
  client: ClientModule;
  post: jest.SpyInstance;
  del: jest.SpyInstance;
}

/**
 * Load the module fresh on a given platform: availability is read at import.
 * The API client comes from the same fresh registry, signed in.
 */
function loadPush(os: 'android' | 'ios', { granted = true } = {}): Loaded {
  let loaded!: Omit<Loaded, 'post' | 'del'>;
  // Both registries: the module reads `Platform.OS` lazily, after isolation ends too.
  Object.defineProperty(OuterPlatform, 'OS', { configurable: true, get: () => os });
  jest.isolateModules(() => {
    // This registry's own react-native: the module under test reads it.
    const { Platform } = require('react-native');
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
    loaded = {
      push: require('@/lib/notifications/push'),
      Notifications: null as unknown as NotificationsMock,
      client: require('@/lib/api/client'),
    };
  });
  // The instance the module itself loads (lazily, from its own registry).
  if (loaded.push.notificationsAvailable) {
    loaded.Notifications = loaded.push.notifications() as unknown as NotificationsMock;
  } else {
    loaded.Notifications = require('expo-notifications');
  }

  loaded.client.setAuthToken('session-token');
  loaded.Notifications.getPermissionsAsync.mockResolvedValue(
    granted
      ? { granted: true, canAskAgain: true, status: 'granted' }
      : { granted: false, canAskAgain: true, status: 'undetermined' },
  );
  const post = jest.spyOn(loaded.client.apiClient, 'post').mockResolvedValue({ data: {} });
  const del = jest.spyOn(loaded.client.apiClient, 'delete').mockResolvedValue({ data: {} });
  return { ...loaded, post, del };
}

const ORIGINAL_OS = Object.getOwnPropertyDescriptor(OuterPlatform, 'OS')!;

describe('push registration', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => Object.defineProperty(OuterPlatform, 'OS', ORIGINAL_OS));

  it('registers the FCM token on Android once permission is granted', async () => {
    const { push, Notifications, post } = loadPush('android');

    await expect(push.registerForPush()).resolves.toBe(true);
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'ahaar-updates',
      expect.objectContaining({ importance: Notifications.AndroidImportance.HIGH }),
    );
    expect(post).toHaveBeenCalledWith('/device-tokens', {
      token: 'mock-fcm-token-0123456789',
      platform: 'android',
      app: 'customer',
    });
  });

  it('never prompts or registers without permission', async () => {
    const { push, Notifications, post } = loadPush('android', { granted: false });
    await expect(push.registerForPush()).resolves.toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('skips iOS (APNs tokens are not FCM tokens)', async () => {
    const { push, post } = loadPush('ios');
    expect(push.pushRegistrationSupported).toBe(false);
    await expect(push.registerForPush()).resolves.toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('unregisters best-effort, without re-entering the 401 handler', async () => {
    const { push, del } = loadPush('android');
    await push.registerForPush();

    del.mockRejectedValueOnce(new Error('offline'));
    await expect(push.unregisterFromPush()).resolves.toBeUndefined();
    expect(del).toHaveBeenCalledWith(
      '/device-tokens',
      expect.objectContaining({
        data: { token: 'mock-fcm-token-0123456789' },
        skipUnauthorizedHandler: true,
      }),
    );
    expect(push.getRegisteredPushToken()).toBeNull();
  });

  it('skips the network on the revoked-session path (no bearer token left)', async () => {
    const { push, client, del } = loadPush('android');
    await push.registerForPush();

    client.setAuthToken(null);
    await push.unregisterFromPush();
    expect(del).not.toHaveBeenCalled();
    expect(push.getRegisteredPushToken()).toBeNull();
  });

  it('is a no-op in Expo Go on Android', () => {
    (globalThis as { __expoGo?: boolean }).__expoGo = true;
    const { push } = loadPush('android');
    delete (globalThis as { __expoGo?: boolean }).__expoGo;
    expect(push.notificationsAvailable).toBe(false);
    expect(push.pushRegistrationSupported).toBe(false);
  });
});

describe('notification channels (v2)', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => Object.defineProperty(OuterPlatform, 'OS', ORIGINAL_OS));

  it('creates ahaar-updates and ahaar-new-orders with their sounds, as the contract says', async () => {
    const { push, Notifications } = loadPush('android');
    await push.ensureNotificationChannels();

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'ahaar-updates',
      expect.objectContaining({
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'order_update.wav',
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        lightColor: '#ea580c',
      }),
    );
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'ahaar-new-orders',
      expect.objectContaining({
        importance: Notifications.AndroidImportance.MAX,
        sound: 'new_order.wav',
        vibrationPattern: [0, 400, 250, 400, 250, 600],
        bypassDnd: false,
      }),
    );
  });

  it('deletes the v1 ahaar-deliveries channel only when it exists', async () => {
    const { push, Notifications } = loadPush('android');
    await push.ensureNotificationChannels();
    expect(Notifications.deleteNotificationChannelAsync).not.toHaveBeenCalled();

    (Notifications.getNotificationChannelsAsync as jest.Mock).mockResolvedValueOnce([
      { id: 'ahaar-deliveries' },
    ]);
    await push.ensureNotificationChannels();
    expect(Notifications.deleteNotificationChannelAsync).toHaveBeenCalledWith('ahaar-deliveries');
  });

  it('creates no channels on iOS', async () => {
    const { push, Notifications } = loadPush('ios');
    await push.ensureNotificationChannels();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('sets the app badge, never below zero', async () => {
    const { push, Notifications } = loadPush('android');
    await push.setAppBadgeCount(-3);
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
    await push.setAppBadgeCount(4);
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(4);
  });
});
