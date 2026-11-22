import { decodePolyline } from '@/lib/tracking/polyline';

describe('decodePolyline', () => {
  it("decodes Google's reference example", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('decodes Riyadh-area coordinates (positive lat/lng)', () => {
    // Encoded from (24.7136, 46.6753) → (24.7200, 46.6800).
    const points = decodePolyline('_{yuCsg{{G_g@k\\');
    expect(points).toHaveLength(2);
    expect(points[0].latitude).toBeCloseTo(24.7136, 4);
    expect(points[0].longitude).toBeCloseTo(46.6753, 4);
    expect(points[1].latitude).toBeCloseTo(24.72, 4);
    expect(points[1].longitude).toBeCloseTo(46.68, 4);
  });

  it('returns nothing for null, undefined and empty input', () => {
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline(undefined)).toEqual([]);
    expect(decodePolyline('')).toEqual([]);
  });

  it('keeps the points decoded before a truncated value instead of throwing', () => {
    const full = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const truncated = full.slice(0, full.length - 2);
    expect(decodePolyline(truncated)).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
    ]);
  });

  it('stops at characters outside the encoding alphabet', () => {
    expect(decodePolyline('_p~iF~ps|U\u0001\u0001')).toEqual([{ latitude: 38.5, longitude: -120.2 }]);
  });
});
