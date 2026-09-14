import Constants from 'expo-constants';
import { Component, forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface MapCenter {
  latitude: number;
  longitude: number;
}

export interface PickerMapHandle {
  /** Centre the map here, at street level. */
  moveTo: (latitude: number, longitude: number) => void;
}

interface Props {
  initialCenter: MapCenter;
  initialZoom: number;
  showsUserLocation?: boolean;
  onMoveStart: () => void;
  /** Fires once when the map is ready, then every time it comes to rest. */
  onMoveEnd: (center: MapCenter, zoom: number) => void;
}

/** Street level — close enough to put the pin on one building. */
export const STREET_ZOOM = 17;

/**
 * Whether the native map can draw. iOS always can (Apple Maps needs no key);
 * Android's Google map needs a Maps SDK key baked into the build — without one
 * it renders grey, so the OpenStreetMap map is used instead. `app.config.ts`
 * sets the flag from the same variable that supplies the key.
 */
const googleMapsInBuild = Boolean(
  (Constants.expoConfig?.extra as { googleMapsAndroid?: boolean } | undefined)?.googleMapsAndroid,
);
export const USES_NATIVE_MAP = Platform.OS === 'ios' || googleMapsInBuild;

/**
 * The map under the location picker's fixed centre pin. Native (Google on
 * Android, Apple on iOS) when it can draw, OpenStreetMap in a WebView when it
 * can't — both drag, pinch and tap the same way, and neither needs GPS.
 */
export const PickerMap = forwardRef<PickerMapHandle, Props>(function PickerMap(props, ref) {
  return (
    <MapBoundary>
      {USES_NATIVE_MAP ? <NativePickerMap {...props} ref={ref} /> : <WebPickerMap {...props} ref={ref} />}
    </MapBoundary>
  );
});

const zoomToDelta = (zoom: number) => 360 / 2 ** zoom;
const deltaToZoom = (delta: number) => Math.log2(360 / delta);

const NativePickerMap = forwardRef<PickerMapHandle, Props>(function NativePickerMap(
  { initialCenter, initialZoom, showsUserLocation, onMoveStart, onMoveEnd },
  ref,
) {
  const map = useRef<MapView>(null);
  const moving = useRef(false);
  const [initialRegion] = useState<Region>(() => ({
    ...initialCenter,
    latitudeDelta: zoomToDelta(initialZoom),
    longitudeDelta: zoomToDelta(initialZoom),
  }));

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (latitude, longitude) =>
        map.current?.animateToRegion(
          { latitude, longitude, latitudeDelta: zoomToDelta(STREET_ZOOM), longitudeDelta: zoomToDelta(STREET_ZOOM) },
          450,
        ),
    }),
    [],
  );

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion}
      onMapReady={() => onMoveEnd(initialCenter, initialZoom)}
      onRegionChange={() => {
        if (moving.current) return;
        moving.current = true;
        onMoveStart();
      }}
      onRegionChangeComplete={(region) => {
        moving.current = false;
        onMoveEnd(
          { latitude: region.latitude, longitude: region.longitude },
          deltaToZoom(region.longitudeDelta),
        );
      }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    />
  );
});

/** Leaflet with CARTO's OpenStreetMap tiles — keyless. Posts its moves back to React Native. */
function leafletHtml(center: MapCenter, zoom: number): string {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;padding:0;background:#eceef1}.leaflet-control-attribution{font-size:9px}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  function post(message) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  if (!window.L) { post({ type: 'error' }); return; }
  var map = L.map('map', { zoomControl: false }).setView([${Number(center.latitude)}, ${Number(center.longitude)}], ${Number(zoom)});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);
  function rested() { var c = map.getCenter(); post({ type: 'moveend', lat: c.lat, lng: c.lng, zoom: map.getZoom() }); }
  map.on('movestart', function () { post({ type: 'movestart' }); });
  map.on('moveend', rested);
  map.on('click', function (event) { map.panTo(event.latlng); });
  window.ahaarMoveTo = function (lat, lng) { map.setView([lat, lng], Math.max(map.getZoom(), ${STREET_ZOOM})); };
  rested();
})();
</script>
</body>
</html>`;
}

const WebPickerMap = forwardRef<PickerMapHandle, Props>(function WebPickerMap(
  { initialCenter, initialZoom, onMoveStart, onMoveEnd },
  ref,
) {
  const web = useRef<WebView>(null);
  // Built once: a new string would reload the page and lose the map.
  const [html] = useState(() => leafletHtml(initialCenter, initialZoom));
  const [failed, setFailed] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      moveTo: (latitude, longitude) =>
        web.current?.injectJavaScript(
          `window.ahaarMoveTo && window.ahaarMoveTo(${Number(latitude)}, ${Number(longitude)}); true;`,
        ),
    }),
    [],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    let message: { type?: string; lat?: number; lng?: number; zoom?: number };
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (message.type === 'movestart') onMoveStart();
    else if (message.type === 'moveend' && message.lat != null && message.lng != null) {
      onMoveEnd({ latitude: message.lat, longitude: message.lng }, message.zoom ?? initialZoom);
    } else if (message.type === 'error') setFailed(true);
  };

  if (failed) return <MapUnavailable />;

  return (
    <WebView
      ref={web}
      style={StyleSheet.absoluteFill}
      originWhitelist={['*']}
      // A real origin, so the tile servers see a referrer.
      source={{ html, baseUrl: 'https://ahaar.store' }}
      onMessage={onMessage}
      onError={() => setFailed(true)}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
    />
  );
});

function MapUnavailable() {
  return (
    <View style={StyleSheet.absoluteFill} className="items-center justify-center bg-surface-muted px-8">
      <Text className="text-center text-sm font-semibold text-text-primary">The map couldn’t load</Text>
      <Text className="mt-1 text-center text-xs text-text-muted">
        Check your connection. You can still search for your address or use your current location.
      </Text>
    </View>
  );
}

/**
 * A build without the map's native code (an older development build) throws
 * when the map renders; this keeps the picker usable — search and GPS still
 * place the pin.
 */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MapUnavailable /> : this.props.children;
  }
}
