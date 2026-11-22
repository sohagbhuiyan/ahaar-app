/* global jest */
/**
 * `react-native-maps` without the native map. Plain Views stand in, exposing
 * the imperative camera methods the location picker and tracking map call.
 */
const React = require('react');
const { View } = require('react-native');

const MapView = React.forwardRef(function MapView(props, ref) {
  React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn(), fitToCoordinates: jest.fn() }));
  return React.createElement(View, { testID: 'map-view', ...props });
});

function Polyline(props) {
  return React.createElement(View, { testID: 'map-polyline', ...props });
}

function Marker(props) {
  return React.createElement(View, { testID: 'map-marker', ...props });
}

module.exports = {
  __esModule: true,
  default: MapView,
  PROVIDER_GOOGLE: 'google',
  Marker,
  Polyline,
};
