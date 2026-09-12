/* global jest */
/**
 * Test-wide stand-ins for native modules. Anything a single test needs to
 * control (the router, an endpoint) is mocked in that test instead.
 *
 * Mocks that render live in `./jest/*` and are required lazily: NativeWind's
 * Babel plugin rewrites element creation to use an import, and a `jest.mock`
 * factory may not reference anything from outside itself.
 */
require('react-native-gesture-handler/jestSetup');

// Reanimated 4 runs on react-native-worklets, whose native module has to be
// mocked before Reanimated's own mock can load.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// Resolves (to "nothing stored") rather than returning undefined, so the auth
// store's rehydration settles instead of throwing mid-test.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('@gorhom/bottom-sheet', () => require('./jest/bottom-sheet-mock'));
jest.mock('expo-image', () => require('./jest/expo-image-mock'));
jest.mock('expo-video', () => require('./jest/expo-video-mock'));

// FlashList measures natively before it renders a row; FlatList renders its
// first rows straight away, which is what a test needs.
jest.mock('@shopify/flash-list', () => ({ FlashList: require('react-native').FlatList }));

jest.mock('sonner-native', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
  Toaster: () => null,
}));
