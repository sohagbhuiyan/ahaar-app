import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { WebView } from 'react-native-webview';

import type { Tracking } from '@/lib/api/types/tracking';
import { colors } from '@/lib/theme';
import { mapPoints, routeLine } from '@/lib/tracking/status';
import type { LatLng } from '@/lib/tracking/polyline';
import { cn } from '@/lib/utils';

import { MapBoundary, MapUnavailable, USES_NATIVE_MAP } from './PickerMap';

interface Props {
  tracking: Tracking;
  className?: string;
}

/** Edge padding when fitting every pin into view. */
const FIT_PADDING = { top: 56, right: 48, bottom: 48, left: 48 };

/**
 * The delivery on a map: the kitchen, the customer's address, the rider
 * (only while the server shares their position) and the route between.
 *
 * Same split as the location picker's `PickerMap`: native Google/Apple when
 * the build can draw it, Leaflet + OpenStreetMap in a WebView when Android has
 * no Maps key — so a keyless build still shows a real map, not grey tiles.
 */
export function TrackingMap({ tracking, className }: Props) {
  const { t } = useTranslation();
  const line = useMemo(() => routeLine(tracking), [tracking]);
  const points = useMemo(() => mapPoints(tracking), [tracking]);
  const stale = tracking.rider_location?.is_stale ?? false;

  if (points.length === 0) return null;

  return (
    <View
      accessible
      accessibilityLabel={t('tracking.map.a11y')}
      className={cn('h-60 overflow-hidden rounded-3xl bg-surface-muted', className)}
    >
      <MapBoundary>
        {USES_NATIVE_MAP ? (
          <NativeTrackingMap tracking={tracking} line={line} points={points} />
        ) : (
          <WebTrackingMap tracking={tracking} line={line} />
        )}
      </MapBoundary>

      {stale ? (
        <View className="absolute start-3 top-3 rounded-full bg-warning-soft px-3 py-1">
          <Text className="text-[11px] font-semibold text-warning">{t('tracking.map.stale')}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Native ───────────────────────────────────────────────────────────────────

function NativeTrackingMap({
  tracking,
  line,
  points,
}: {
  tracking: Tracking;
  line: LatLng[];
  points: LatLng[];
}) {
  const { t } = useTranslation();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const hasRider = tracking.rider_location !== null;
  // Re-fit only when the *set* of pins changes (the rider appears or leaves),
  // not on every poll — the customer may have panned to look at something.
  const fitKey = `${points.length}:${hasRider}`;
  const lastFit = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    const all = [...points, ...line];
    if (all.length === 1) {
      map.current?.animateToRegion(
        { ...all[0], latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400,
      );
    } else {
      map.current?.fitToCoordinates(all, { edgePadding: FIT_PADDING, animated: true });
    }
  }, [ready, fitKey, points, line]);

  const first = points[0];

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={{ ...first, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
      onMapReady={() => setReady(true)}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {line.length >= 2 ? (
        <Polyline
          coordinates={line}
          strokeColor={colors.brand[500]}
          strokeWidth={4}
          lineDashPattern={tracking.route?.polyline ? undefined : [8, 6]}
        />
      ) : null}

      {tracking.pickup ? (
        <Marker
          coordinate={{ latitude: tracking.pickup.lat, longitude: tracking.pickup.lng }}
          title={t('tracking.map.kitchen')}
          description={tracking.pickup.label ?? undefined}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <Pin glyph="🍳" tone="kitchen" />
        </Marker>
      ) : null}

      {tracking.destination ? (
        <Marker
          coordinate={{ latitude: tracking.destination.lat, longitude: tracking.destination.lng }}
          title={t('tracking.map.home')}
          description={tracking.destination.label ?? undefined}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <Pin glyph="🏠" tone="home" />
        </Marker>
      ) : null}

      {tracking.rider_location ? (
        <Marker
          coordinate={{
            latitude: tracking.rider_location.lat,
            longitude: tracking.rider_location.lng,
          }}
          title={tracking.rider?.name ?? t('tracking.map.rider')}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <Pin glyph={tracking.rider?.vehicle_type === 'car' ? '🚗' : '🛵'} tone="rider" />
        </Marker>
      ) : null}
    </MapView>
  );
}

function Pin({ glyph, tone }: { glyph: string; tone: 'kitchen' | 'home' | 'rider' }) {
  return (
    <View
      className={cn(
        'h-9 w-9 items-center justify-center rounded-full border-2 border-white',
        tone === 'rider' ? 'bg-brand-500' : tone === 'home' ? 'bg-text-primary' : 'bg-surface',
      )}
      style={styles.pinShadow}
    >
      <Text style={{ fontSize: 16 }}>{glyph}</Text>
    </View>
  );
}

// ── OpenStreetMap fallback ───────────────────────────────────────────────────

interface WebMapState {
  rider: [number, number] | null;
  riderGlyph: string;
  pickup: [number, number] | null;
  destination: [number, number] | null;
  line: [number, number][];
  dashed: boolean;
  labels: { kitchen: string; home: string; rider: string };
}

function webState(tracking: Tracking, line: LatLng[], labels: WebMapState['labels']): WebMapState {
  const pair = (p: { lat: number; lng: number } | null): [number, number] | null =>
    p ? [p.lat, p.lng] : null;
  return {
    rider: pair(tracking.rider_location),
    riderGlyph: tracking.rider?.vehicle_type === 'car' ? '🚗' : '🛵',
    pickup: pair(tracking.pickup),
    destination: pair(tracking.destination),
    line: line.map((p) => [p.latitude, p.longitude]),
    dashed: !tracking.route?.polyline,
    labels,
  };
}

/**
 * Leaflet with CARTO's OpenStreetMap tiles, as in `PickerMap`. Built once;
 * each poll pushes the new state in through `ahaarUpdate` so the page (and
 * the customer's pan/zoom) survives.
 */
function leafletHtml(initial: WebMapState): string {
  const brand = colors.brand[500];
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
html,body,#map{height:100%;margin:0;padding:0;background:#eceef1}
.leaflet-control-attribution{font-size:9px}
.pin{width:32px;height:32px;border-radius:16px;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.pin.rider{background:${brand}}.pin.home{background:#1a1a2e}.pin.kitchen{background:#fff}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  function post(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if (!window.L) { post({ type: 'error' }); return; }
  var map = L.map('map', { zoomControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 20, attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);
  function icon(cls, glyph) { return L.divIcon({ className: '', html: '<div class="pin ' + cls + '">' + glyph + '</div>', iconSize: [32, 32], iconAnchor: [16, 16] }); }
  var layers = { rider: null, pickup: null, destination: null, line: null };
  var fitKey = null;
  function place(name, at, cls, glyph, title) {
    if (!at) { if (layers[name]) { map.removeLayer(layers[name]); layers[name] = null; } return; }
    if (layers[name]) layers[name].setLatLng(at);
    else layers[name] = L.marker(at, { icon: icon(cls, glyph), title: title }).addTo(map);
  }
  window.ahaarUpdate = function (s) {
    place('pickup', s.pickup, 'kitchen', '🍳', s.labels.kitchen);
    place('destination', s.destination, 'home', '🏠', s.labels.home);
    place('rider', s.rider, 'rider', s.riderGlyph, s.labels.rider);
    if (layers.line) { map.removeLayer(layers.line); layers.line = null; }
    if (s.line.length >= 2) layers.line = L.polyline(s.line, { color: '${brand}', weight: 4, dashArray: s.dashed ? '8 6' : null }).addTo(map);
    var pts = [s.rider, s.pickup, s.destination].filter(Boolean).concat(s.line);
    var key = [s.rider ? 1 : 0, s.pickup ? 1 : 0, s.destination ? 1 : 0].join('');
    if (pts.length && key !== fitKey) {
      fitKey = key;
      if (pts.length === 1) map.setView(pts[0], 15); else map.fitBounds(pts, { padding: [40, 40] });
    }
  };
  window.ahaarUpdate(${JSON.stringify(initial)});
})();
</script>
</body>
</html>`;
}

function WebTrackingMap({ tracking, line }: { tracking: Tracking; line: LatLng[] }) {
  const { t } = useTranslation();
  const web = useRef<WebView>(null);
  const [failed, setFailed] = useState(false);
  const labels = useMemo(
    () => ({
      kitchen: t('tracking.map.kitchen'),
      home: t('tracking.map.home'),
      rider: t('tracking.map.rider'),
    }),
    [t],
  );
  const state = useMemo(() => webState(tracking, line, labels), [tracking, line, labels]);
  // Built once: a new string would reload the page and lose the map.
  const [html] = useState(() => leafletHtml(state));
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    web.current?.injectJavaScript(
      `window.ahaarUpdate && window.ahaarUpdate(${JSON.stringify(state)}); true;`,
    );
  }, [state]);

  if (failed) return <MapUnavailable />;

  return (
    <WebView
      ref={web}
      style={StyleSheet.absoluteFill}
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://ahaar.store' }}
      onMessage={(event) => {
        if (event.nativeEvent.data.includes('"error"')) setFailed(true);
      }}
      onError={() => setFailed(true)}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
    />
  );
}

const styles = StyleSheet.create({
  pinShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
