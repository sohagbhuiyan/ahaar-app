/* global jest */
/**
 * `expo-video` for Jest. `useVideoPlayer` is a spy, so a test can assert that
 * a player was — or was not — created, and for which source.
 *
 * The player is an event emitter as far as `useEvent` (from `expo`) is
 * concerned, so status subscriptions mount and unmount cleanly.
 */
const React = require('react');
const { View } = require('react-native');

module.exports = {
  useVideoPlayer: jest.fn((source, setup) => {
    const player = {
      status: 'readyToPlay',
      playing: false,
      muted: false,
      loop: false,
      play: jest.fn(),
      pause: jest.fn(),
      release: jest.fn(),
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    };
    if (setup) setup(player);
    return player;
  }),
  VideoView: (props) =>
    React.createElement(View, {
      testID: 'video-view',
      accessibilityLabel: props.accessibilityLabel,
    }),
};
