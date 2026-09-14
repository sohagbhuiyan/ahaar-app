import * as Location from 'expo-location';
import { act, renderHook } from '@testing-library/react-native';

import * as geoApi from '@/lib/api/endpoints/geo';
import { useDeviceLocation, type DeviceLocationState } from '@/lib/location/useDeviceLocation';

// The Ahaar API answers first; by default it is unreachable, so the device's
// own geocoder is what these tests exercise unless one says otherwise.
jest.mock('@/lib/api/endpoints/geo', () => ({
  reverseGeocode: jest.fn(() => Promise.reject(new Error('offline'))),
}));
const geo = geoApi as jest.Mocked<typeof geoApi>;

const mocked = Location as jest.Mocked<typeof Location>;

const permission = (granted: boolean, canAskAgain = true) =>
  ({
    granted,
    canAskAgain,
    status: granted ? 'granted' : 'denied',
    expires: 'never',
  }) as Location.LocationPermissionResponse;

const fix = (latitude: number, longitude: number): Location.LocationObject => ({
  coords: {
    latitude,
    longitude,
    altitude: null,
    accuracy: 12,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
});

const geocoded = (fields: Partial<Location.LocationGeocodedAddress>) =>
  ({
    city: null,
    district: null,
    streetNumber: null,
    street: null,
    region: null,
    subregion: null,
    country: null,
    postalCode: null,
    name: null,
    isoCountryCode: null,
    timezone: null,
    formattedAddress: null,
    ...fields,
  }) as Location.LocationGeocodedAddress;

async function locateWith(options?: { timeoutMs?: number }) {
  const hook = await renderHook(() => useDeviceLocation(options));
  let outcome: DeviceLocationState | null = null;
  await act(async () => {
    outcome = await hook.result.current.locate();
  });
  return { hook, outcome: outcome as DeviceLocationState | null };
}

describe('useDeviceLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks when the system will show a prompt, and reports a refusal', async () => {
    // Defaults: not yet asked, then "Don't allow".
    const { hook } = await locateWith();

    expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe('denied');
    expect(hook.result.current.canAskAgain).toBe(true);
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('does not re-prompt once only Settings can change the answer', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(false, false));

    const { hook } = await locateWith();

    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(hook.result.current.status).toBe('denied');
    expect(hook.result.current.canAskAgain).toBe(false);
  });

  it('says so when location is switched off for the whole phone', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.hasServicesEnabledAsync.mockResolvedValueOnce(false);

    const { hook } = await locateWith();

    expect(hook.result.current.status).toBe('services_off');
    expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('falls back to the last known position when a fresh fix takes too long', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
    mocked.getLastKnownPositionAsync.mockResolvedValueOnce(fix(24.69, 46.685));
    mocked.reverseGeocodeAsync.mockResolvedValueOnce([
      geocoded({
        streetNumber: '12',
        street: 'King Fahd Rd',
        district: 'Al Olaya',
        city: 'Riyadh',
        isoCountryCode: 'SA',
      }),
    ]);

    const { hook, outcome } = await locateWith({ timeoutMs: 10 });

    expect(outcome?.status).toBe('resolved');
    expect(hook.result.current.needsTyping).toBe(false);
    expect(hook.result.current.draft).toMatchObject({
      line1: '12 King Fahd Rd',
      area: 'Al Olaya',
      city: 'Riyadh',
      country: 'SA',
      lat: 24.69,
      lng: 46.685,
    });
  });

  it('keeps the position when the street lookup fails, and asks for the rest', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.getCurrentPositionAsync.mockResolvedValueOnce(fix(21.5433, 39.1728));
    mocked.reverseGeocodeAsync.mockRejectedValueOnce(new Error('Geocoder unavailable'));

    const { hook } = await locateWith();

    expect(hook.result.current.status).toBe('resolved');
    expect(hook.result.current.needsTyping).toBe(true);
    expect(hook.result.current.draft).toMatchObject({ line1: '', lat: 21.5433, lng: 39.1728 });
    expect(hook.result.current.message).toMatch(/add your address/);
  });

  it('uses the Ahaar API’s answer when it has one, marked as a GPS pick', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.getCurrentPositionAsync.mockResolvedValueOnce(fix(24.6948, 46.6853));
    geo.reverseGeocode.mockResolvedValueOnce({
      place_id: 'ChIJ', country_code: 'SA', country_name: 'Saudi Arabia', supported: true, name: null,
      building_number: '8228', street: 'King Fahd Road', line1: '8228 King Fahd Road', area: 'Al Olaya',
      city: 'Riyadh', region: 'Riyadh Province', postal_code: '12211',
      formatted: '8228 King Fahd Road, Al Olaya, Riyadh 12211', lat: 24.6948, lng: 46.6853,
    });

    const { hook } = await locateWith();

    expect(hook.result.current.status).toBe('resolved');
    expect(hook.result.current.draft).toMatchObject({
      line1: '8228 King Fahd Road',
      country: 'SA',
      region: 'Riyadh Province',
      location_source: 'gps',
    });
    expect(mocked.reverseGeocodeAsync).not.toHaveBeenCalled();
  });

  it('accepts a Bangladeshi position for testing, written the Bangladeshi way', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.getCurrentPositionAsync.mockResolvedValueOnce(fix(23.7465, 90.376));
    mocked.reverseGeocodeAsync.mockResolvedValueOnce([
      geocoded({ streetNumber: '12', street: 'Road 5', district: 'Dhanmondi', city: 'Dhaka', postalCode: '1209', isoCountryCode: 'BD' }),
    ]);

    const { outcome } = await locateWith();

    expect(outcome?.status).toBe('resolved');
    expect(outcome?.draft).toMatchObject({ country: 'BD', line1: 'House 12, Road 5', postal_code: '1209' });
  });

  it('turns away a position in a country Ahaar doesn’t serve, keeping the pin', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    mocked.getCurrentPositionAsync.mockResolvedValueOnce(fix(25.2048, 55.2708));
    mocked.reverseGeocodeAsync.mockResolvedValueOnce([
      geocoded({ street: 'Sheikh Zayed Rd', city: 'Dubai', isoCountryCode: 'AE' }),
    ]);

    const { hook, outcome } = await locateWith();

    expect(outcome?.status).toBe('outside_area');
    expect(hook.result.current.message).toMatch(/we serve Saudi Arabia/);
    expect(hook.result.current.draft).toMatchObject({ country: 'AE', lat: 25.2048 });
  });

  it('reports no position when there is neither a fix nor a cached one', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce(permission(true));
    // Defaults: the fresh fix throws, and nothing is cached.

    const { hook } = await locateWith();

    expect(hook.result.current.status).toBe('unavailable');
    expect(hook.result.current.draft).toBeNull();
  });
});
