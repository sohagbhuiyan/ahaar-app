/* global jest */
/**
 * `expo-location` without the native module. Defaults describe a device that
 * has not been asked yet and then says no — a test that needs a position
 * overrides the relevant function with `mockResolvedValueOnce`.
 */
const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

module.exports = {
  Accuracy,
  LocationAccuracy: Accuracy,
  getForegroundPermissionsAsync: jest.fn(async () => ({
    granted: false,
    status: 'undetermined',
    canAskAgain: true,
    expires: 'never',
  })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    granted: false,
    status: 'denied',
    canAskAgain: true,
    expires: 'never',
  })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  enableNetworkProviderAsync: jest.fn(async () => undefined),
  getCurrentPositionAsync: jest.fn(async () => {
    throw new Error('Location unavailable');
  }),
  getLastKnownPositionAsync: jest.fn(async () => null),
  reverseGeocodeAsync: jest.fn(async () => []),
};
