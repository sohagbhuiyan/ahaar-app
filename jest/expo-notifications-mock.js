/* global jest */
/**
 * `expo-notifications` without the native module: permissions read as
 * undetermined, the device token is fixed, and every listener hands back a
 * removable subscription. Tests that need a different answer override the
 * individual `jest.fn`s.
 */
const subscription = () => ({ remove: jest.fn() });

module.exports = {
  AndroidImportance: { MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4, MAX: 5 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true, status: 'undetermined' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  getDevicePushTokenAsync: jest.fn(async () => ({ type: 'android', data: 'mock-fcm-token-0123456789' })),
  addPushTokenListener: jest.fn(subscription),
  addNotificationReceivedListener: jest.fn(subscription),
  addNotificationResponseReceivedListener: jest.fn(subscription),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  clearLastNotificationResponseAsync: jest.fn(async () => undefined),
};
