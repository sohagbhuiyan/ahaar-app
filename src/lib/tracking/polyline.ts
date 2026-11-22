/**
 * Google's Encoded Polyline Algorithm Format, decoded.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * The tracking payload's `route.polyline` is a Directions API overview
 * polyline at the default precision (5 decimal places). Malformed input yields
 * the points decoded so far rather than throwing — a half-drawn route beats a
 * crashed tracking screen.
 */
export interface LatLng {
  latitude: number;
  longitude: number;
}

export function decodePolyline(encoded: string | null | undefined, precision = 5): LatLng[] {
  if (!encoded) return [];

  const factor = 10 ** precision;
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  /** One signed varint, or null when the string ends mid-value. */
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push({ latitude: lat / factor, longitude: lng / factor });
  }

  return points;
}
