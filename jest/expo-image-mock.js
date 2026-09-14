/**
 * `expo-image` for Jest: a plain view carrying the props a test can query by.
 *
 * `onError` rides along so a test can fire a failed load
 * (`fireEvent(image, 'error')`) and check what the screen falls back to.
 */
const React = require('react');
const { View } = require('react-native');

module.exports = {
  Image: (props) =>
    React.createElement(View, {
      testID: props.testID,
      accessibilityLabel: props.accessibilityLabel,
      onError: props.onError,
    }),
};
