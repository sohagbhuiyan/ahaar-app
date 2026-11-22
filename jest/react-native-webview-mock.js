/* global jest */
/** `react-native-webview` without its native module: a View that accepts the ref calls. */
const React = require('react');
const { View } = require('react-native');

const WebView = React.forwardRef(function WebView(props, ref) {
  React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn(), reload: jest.fn() }));
  return React.createElement(View, { testID: 'web-view', style: props.style });
});

module.exports = { __esModule: true, default: WebView, WebView };
