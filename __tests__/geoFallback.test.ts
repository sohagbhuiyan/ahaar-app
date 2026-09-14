import * as geo from '@/lib/api/endpoints/geo';
import { fallbackSearch, nominatimComponents, toGeoPlace } from '@/lib/location/geoFallback';
import { apiClient } from '@/lib/api/client';

const DHANMONDI = {
  osm_type: 'way',
  osm_id: 298284563,
  lat: '23.7465',
  lon: '90.3760',
  name: 'Corsa De Carena',
  display_name: 'Corsa De Carena, 57, Road 8A, Modhubazar, Dhaka, 1207, Bangladesh',
  address: {
    house_number: '57',
    road: 'Road 8A',
    neighbourhood: 'Modhubazar',
    city: 'Dhaka',
    state: 'Dhaka Division',
    postcode: '1207',
    country_code: 'bd',
  },
};

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('OpenStreetMap fallback', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    geo.resetGeoApiForTests();
    jest.restoreAllMocks();
  });

  it('writes a Bangladeshi pin exactly as the backend would', () => {
    expect(toGeoPlace(nominatimComponents(DHANMONDI), 23.7465, 90.376)).toMatchObject({
      place_id: 'osm:W298284563',
      country_code: 'BD',
      supported: true,
      line1: 'House 57, Road 8A',
      area: 'Modhubazar',
      city: 'Dhaka',
      postal_code: '1207',
      formatted: 'House 57, Road 8A, Modhubazar, Dhaka 1207',
    });
  });

  it('flags a country Ahaar doesn’t serve, and reads the country from the pin when there is no lookup', () => {
    expect(toGeoPlace({ city: 'Dubai', country_code: 'ae' }, 25.2048, 55.2708)).toMatchObject({
      country_code: 'AE',
      supported: false,
    });
    expect(toGeoPlace({}, 21.5433, 39.1728)).toMatchObject({ country_code: 'SA', supported: true, line1: '' });
  });

  it('searches within the served countries, identifying the app', async () => {
    const fetch = jest.fn(async () => jsonResponse([DHANMONDI]));
    globalThis.fetch = fetch as unknown as typeof globalThis.fetch;

    const results = await fallbackSearch('road 8a', { lat: 23.75, lng: 90.37 });

    expect(results[0]).toMatchObject({ place_id: 'osm:W298284563', title: 'Corsa De Carena', lat: 23.7465 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('countrycodes=sa%2Cbd');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Ahaar/);
  });

  it('answers from OpenStreetMap when the API has no /geo endpoints, and stops asking the API', async () => {
    const get = jest
      .spyOn(apiClient, 'get')
      .mockRejectedValue({ status: 404, code: 'not_found', message: 'Not found' });
    globalThis.fetch = jest.fn(async () => jsonResponse(DHANMONDI)) as unknown as typeof globalThis.fetch;

    const first = await geo.reverseGeocode(23.7465, 90.376);
    const second = await geo.reverseGeocode(23.7466, 90.3761);

    expect(first).toMatchObject({ country_code: 'BD', line1: 'House 57, Road 8A' });
    expect(second.city).toBe('Dhaka');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
