/**
 * Jest — component and hook tests, on the jest-expo preset so Expo's native
 * modules resolve to its own mocks.
 *
 * `transformIgnorePatterns` is Expo's documented list plus the libraries this
 * app ships as untranspiled source: the bottom sheet, FlashList, NativeWind,
 * sonner-native.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop|@gorhom/.*|@shopify/flash-list|sonner-native))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
