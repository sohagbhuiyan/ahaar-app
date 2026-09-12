/** `expo-image` for Jest: a plain view carrying the props a test can query by. */
const React = require('react');
const { View } = require('react-native');

module.exports = {
  Image: (props) =>
    React.createElement(View, {
      testID: props.testID,
      accessibilityLabel: props.accessibilityLabel,
    }),
};
