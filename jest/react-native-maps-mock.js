/* global jest */
/**
 * `react-native-maps` without the native map. A plain View stands in, exposing
 * the imperative camera method the location picker calls.
 */
const React = require('react');
const { View } = require('react-native');

const MapView = React.forwardRef(function MapView(props, ref) {
  React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() }));
  return React.createElement(View, { testID: 'map-view', ...props });
});

module.exports = {
  __esModule: true,
  default: MapView,
  PROVIDER_GOOGLE: 'google',
  Marker: View,
};
