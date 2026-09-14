import { normalizeAddress, normalizeDeliveryAddress } from '@/lib/api/normalize';
import {
  EMPTY_DRAFT,
  composeAddress,
  distanceMeters,
  draftFromGeocode,
  draftFromPlace,
  findSamePlace,
  isCompleteDraft,
  locationTitle,
  shortLocation,
} from '@/lib/location/address';

const OLAYA = { latitude: 24.69, longitude: 46.685 };

describe('address helpers', () => {
  it('composes the one-line address, skipping empty parts and an area that repeats the city', () => {
    expect(
      composeAddress({
        line1: '12 King Fahd Rd',
        line2: '',
        area: 'Al Olaya',
        postal_code: '12211',
        city: 'Riyadh',
      }),
    ).toBe('12 King Fahd Rd, Al Olaya, Riyadh 12211');

    expect(composeAddress({ line1: 'Tahlia St', area: 'Jeddah', city: 'Jeddah' })).toBe(
      'Tahlia St, Jeddah',
    );
  });

  it('titles a location for the Home header', () => {
    expect(shortLocation({ line1: '12 King Fahd Rd', area: 'Al Olaya', city: 'Riyadh' })).toBe(
      'Al Olaya, Riyadh',
    );
    expect(locationTitle({ label: 'Home', area: 'Al Olaya', city: 'Riyadh' })).toBe(
      'Home · Al Olaya, Riyadh',
    );
    // Nothing but a street: the street is still better than a blank header.
    expect(shortLocation({ line1: '12 King Fahd Rd' })).toBe('12 King Fahd Rd');
  });

  it('builds a draft from an iOS-style lookup', () => {
    const draft = draftFromGeocode(OLAYA, {
      streetNumber: '12',
      street: 'King Fahd Rd',
      district: 'Al Olaya',
      city: 'Riyadh',
      postalCode: '12211',
      isoCountryCode: 'sa',
    });

    expect(draft).toMatchObject({
      line1: '12 King Fahd Rd',
      area: 'Al Olaya',
      city: 'Riyadh',
      postal_code: '12211',
      country: 'SA',
      lat: 24.69,
      lng: 46.685,
    });
    expect(isCompleteDraft(draft)).toBe(true);
  });

  it('falls back to `name` and `subregion` the way Android lookups need', () => {
    const draft = draftFromGeocode(OLAYA, {
      name: 'Kingdom Centre',
      subregion: 'Riyadh',
      city: null,
      postalCode: null,
    });

    expect(draft.line1).toBe('Kingdom Centre');
    expect(draft.city).toBe('Riyadh');
    // The subregion became the city, so it must not also appear as the area.
    expect(draft.area).toBeNull();
    expect(draft.postal_code).toBeNull();
  });

  it('keeps the coordinates even when nothing could be looked up', () => {
    const draft = draftFromGeocode(OLAYA, null);

    expect(draft.lat).toBe(24.69);
    expect(isCompleteDraft(draft)).toBe(false);
  });

  it('writes the full National Address line the way Saudi Post prints it', () => {
    expect(
      composeAddress({
        line1: '8228 King Fahd Rd',
        line2: 'Flat 4',
        area: 'Al Olaya',
        city: 'Riyadh',
        postal_code: '12211',
        additional_number: '2121',
      }),
    ).toBe('8228 King Fahd Rd, Flat 4, Al Olaya, Riyadh 12211-2121');

    // An additional number means nothing without the postal code it extends.
    expect(
      composeAddress({ line1: '8228 King Fahd Rd', city: 'Riyadh', additional_number: '2121' }),
    ).toBe('8228 King Fahd Rd, Riyadh');
  });

  it('cleans a lookup answered in Arabic into a National Address draft', () => {
    const draft = draftFromGeocode(OLAYA, {
      name: '٨٢٢٨',
      streetNumber: '٨٢٢٨',
      street: 'طريق الملك فهد',
      district: 'حي العليا',
      city: 'الرياض',
      postalCode: '١٢٢١١',
      isoCountryCode: 'SA',
    });

    expect(draft).toMatchObject({
      line1: '8228 طريق الملك فهد',
      building_number: '8228',
      area: 'العليا',
      city: 'Riyadh',
      postal_code: '12211',
      country: 'SA',
    });
  });

  it('leaves the street to type when Android only knows the building number, and drops a foreign postcode', () => {
    const draft = draftFromGeocode(OLAYA, { name: '8228', city: 'Riyadh', postalCode: '1207' });

    expect(draft.line1).toBe('');
    expect(draft.building_number).toBe('8228');
    expect(draft.postal_code).toBeNull();
    expect(isCompleteDraft(draft)).toBe(false);
  });

  it('writes a Bangladeshi test address its own way, the country read from the lookup', () => {
    const draft = draftFromGeocode(
      { latitude: 23.7465, longitude: 90.376 },
      { streetNumber: '১২', street: 'Road 5', district: 'Dhanmondi Thana', city: 'ঢাকা', region: 'Dhaka Division', postalCode: '1209', isoCountryCode: 'BD' },
    );

    expect(draft).toMatchObject({
      country: 'BD',
      line1: 'House 12, Road 5',
      building_number: '12',
      area: 'Dhanmondi',
      city: 'Dhaka',
      region: 'Dhaka Division',
      postal_code: '1209',
    });
    expect(composeAddress(draft)).toBe('House 12, Road 5, Dhanmondi, Dhaka 1209');
  });

  it('reads the country from the coordinates when the lookup has none', () => {
    expect(draftFromGeocode({ latitude: 23.81, longitude: 90.41 }, null).country).toBe('BD');
    expect(draftFromGeocode(OLAYA, null).country).toBe('SA');
  });

  it('takes a place from the API as a draft, remembering how it was chosen', () => {
    const draft = draftFromPlace(
      {
        place_id: 'ChIJ', country_code: 'SA', country_name: 'Saudi Arabia', supported: true, name: null,
        building_number: '8228', street: 'King Fahd Road', line1: '8228 King Fahd Road', area: 'Al Olaya',
        city: 'Riyadh', region: 'Riyadh Province', postal_code: '12211',
        formatted: '8228 King Fahd Road, Al Olaya, Riyadh 12211', lat: 24.6948123456, lng: 46.6853,
      },
      'search',
    );

    expect(draft).toMatchObject({
      line1: '8228 King Fahd Road',
      building_number: '8228',
      region: 'Riyadh Province',
      country: 'SA',
      location_source: 'search',
      lat: 24.6948123,
    });
  });

  it('measures distance in metres', () => {
    // 0.001° of latitude is ~111 m everywhere.
    const d = distanceMeters(OLAYA, { latitude: 24.691, longitude: 46.685 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(117);
  });

  it('recognises an address already saved for the same place', () => {
    const saved = [
      { id: 1, line1: 'Tahlia St 4', city: 'Jeddah', lat: null, lng: null },
      { id: 2, line1: 'King Fahd Rd 12', city: 'Riyadh', lat: 24.69, lng: 46.685 },
    ];

    // ~15 m from the pinned one, even though the lookup spelt the street differently.
    expect(
      findSamePlace(saved, { ...EMPTY_DRAFT, line1: '12 King Fahd Road', city: 'Riyadh', lat: 24.69012, lng: 46.68505 }),
    ).toMatchObject({ id: 2 });

    // No pin: the same street and city, case aside.
    expect(
      findSamePlace(saved, { ...EMPTY_DRAFT, line1: 'tahlia st 4', city: 'JEDDAH' }),
    ).toMatchObject({ id: 1 });

    // A kilometre away is somewhere else.
    expect(
      findSamePlace(saved, { ...EMPTY_DRAFT, line1: 'Olaya St', city: 'Riyadh', lat: 24.699, lng: 46.685 }),
    ).toBeUndefined();
  });
});

describe('address normalisers', () => {
  it('composes `formatted` when an older API leaves it out', () => {
    const address = normalizeAddress({
      id: 3,
      line1: '12 King Fahd Rd',
      city: 'Riyadh',
      area: 'Al Olaya',
      postal_code: null,
      lat: '24.6900000',
      lng: '46.6850000',
      is_default: 1,
    });

    expect(address.formatted).toBe('12 King Fahd Rd, Al Olaya, Riyadh');
    expect(address.lat).toBe(24.69);
    expect(address.is_default).toBe(true);
  });

  it('reads a frozen delivery address, and null when there is none', () => {
    expect(normalizeDeliveryAddress(null)).toBeNull();
    expect(
      normalizeDeliveryAddress({
        address_id: 9,
        line1: 'Tahlia St 4',
        city: 'Jeddah',
        formatted: 'Tahlia St 4, Jeddah',
      }),
    ).toMatchObject({ address_id: 9, formatted: 'Tahlia St 4, Jeddah', lat: null });
  });
});
