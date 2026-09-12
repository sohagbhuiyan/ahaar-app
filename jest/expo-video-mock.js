/* global jest */
/**
 * `expo-video` for Jest. `useVideoPlayer` is a spy, so a test can assert that
 * a player was — or was not — created, and for which source.
 */
const React = require('react');
const { View } = require('react-native');

module.exports = {
  useVideoPlayer: jest.fn((source, setup) => {
    const player = { play: jest.fn(), pause: jest.fn(), release: jest.fn() };
    if (setup) setup(player);
    return player;
  }),
  VideoView: (props) =>
    React.createElement(View, {
      testID: 'video-view',
      accessibilityLabel: props.accessibilityLabel,
    }),
};
