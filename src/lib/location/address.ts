/**
 * Pure address helpers — no React, no native modules, so they are shared by the
 * normalisers, the location hooks and tests alike.
 *
 * An address is written its own country's way (see `./countries`): a Saudi
 * National Address, or a Bangladeshi address for testing. Location in this app
 * is an *address*, never a pricing or catalogue input: menus, plans, packages
 * and prices are the same wherever the customer is.
 */
import type { GeoPlace, LocationSource } from '../api/types/geo';
import {
  DEFAULT_COUNTRY,
  canonicalCity,
  cleanDistrict,
  composeStreetLine,
  countryRules,
  detectCountry,
  normalizeBuilding,
  normalizeNumber,
} from './countries';

/** The address fields a human reads, whatever carries them. */
export interface AddressParts {
  label?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  postal_code?: string | null;
  additional_number?: string | null;
}

/**
 * An address that has not been saved yet — chosen on the map, from GPS or a
 * search, or typed. `line1` and `city` may still be empty while the customer
 * reviews it; `isCompleteDraft` says when it can be saved.
 */
export interface AddressDraft {
  label: string | null;
  /** The street line — "8228 King Fahd Rd" / "House 12, Road 5". */
  line1: string;
  /** Apartment, flat, floor. */
  line2: string | null;
  /** District (الحي) in Saudi Arabia, area / thana in Bangladesh. */
  area: string | null;
  city: string;
  /** Province / division — "Riyadh Province", "Dhaka Division". */
  region: string | null;
  postal_code: string | null;
  /** ISO alpha-2 of the pin — detected, never assumed. */
  country: string | null;
  /** Saudi building number (4 digits) or Bangladeshi house / holding number. */
  building_number: string | null;
  /** Saudi National Address additional number — four digits. */
  additional_number: string | null;
  /** Saudi National Address short address — "RRRD2929". */
  short_address: string | null;
  lat: number | null;
  lng: number | null;
  /** How it was chosen — shown to the admin next to the pin. */
  location_source: LocationSource | null;
  instructions: string | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * The subset of `expo-location`'s `LocationGeocodedAddress` read here — the
 * device's own geocoder, used when the Ahaar API can't be reached. Declared
 * locally so these helpers stay importable without the native module.
 */
export interface GeocodedAddress {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  isoCountryCode?: string | null;
}

export const EMPTY_DRAFT: AddressDraft = {
  label: null,
  line1: '',
  line2: null,
  area: null,
  city: '',
  region: null,
  postal_code: null,
  country: DEFAULT_COUNTRY,
  building_number: null,
  additional_number: null,
  short_address: null,
  lat: null,
  lng: null,
  location_source: null,
  instructions: null,
};

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** A district named like its city ("Jeddah, Jeddah") says nothing twice. */
const sameAsCity = (area: string | null | undefined, city: string | null | undefined) =>
  canonicalCity(area).toLocaleLowerCase() === canonicalCity(city).toLocaleLowerCase();

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (clean(a) ?? '').toLocaleLowerCase() === (clean(b) ?? '').toLocaleLowerCase();

/**
 * The one-line address — street line, unit, district, then the city followed
 * by its postal code (and in Saudi Arabia the additional number):
 * "8228 King Fahd Rd, Flat 4, Al Olaya, Riyadh 12211-2121" /
 * "House 12, Road 5, Dhanmondi, Dhaka 1209".
 * Mirrors the backend's `AddressSnapshot::format`, for payloads that lack it.
 */
export function composeAddress(parts: AddressParts): string {
  const postal = clean(parts.postal_code);
  const additional = postal ? clean(parts.additional_number) : null;
  const code = postal ? (additional ? `${postal}-${additional}` : postal) : null;
  const locality = [clean(parts.city), code].filter(Boolean).join(' ');
  const area = sameAsCity(parts.area, parts.city) ? null : clean(parts.area);

  return [clean(parts.line1), clean(parts.line2), area, locality || null]
    .filter(Boolean)
    .join(', ');
}

/** "Al Olaya, Riyadh" — short enough for a header; the street when that's all there is. */
export function shortLocation(parts: AddressParts): string {
  const area = sameAsCity(parts.area, parts.city) ? null : clean(parts.area);
  const short = [area, clean(parts.city)].filter(Boolean).join(', ');
  return short || clean(parts.line1) || '';
}

/** "Home · Al Olaya, Riyadh", or just the short location when unlabelled. */
export function locationTitle(parts: AddressParts): string {
  const short = shortLocation(parts);
  const label = clean(parts.label);
  if (!label) return short;
  return short ? `${label} · ${short}` : label;
}

/** Whether a draft carries what `StoreAddressRequest` requires. */
export function isCompleteDraft(draft: AddressDraft | null | undefined): draft is AddressDraft {
  return Boolean(draft && clean(draft.line1) && clean(draft.city));
}

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * A draft from the device's own reverse geocoder — the fallback when the Ahaar
 * API can't be reached.
 *
 * Lookups differ by platform — Android often has `name` but no `street`, iOS
 * the reverse, and for a Saudi address `name` is frequently just the building
 * number — so every field falls back rather than assuming one shape. The
 * country comes from the lookup, or from the coordinates.
 */
export function draftFromGeocode(
  coords: Coordinates,
  geo: GeocodedAddress | null | undefined,
): AddressDraft {
  const iso = clean(geo?.isoCountryCode)?.toUpperCase();
  const country =
    (iso && iso.length === 2 ? iso : null) ??
    detectCountry(coords.latitude, coords.longitude) ??
    DEFAULT_COUNTRY;
  const rules = countryRules(country);

  const rawName = clean(geo?.name);
  const nameNumber =
    rawName && /^\d{1,6}$/.test(normalizeNumber(rawName)) ? normalizeNumber(rawName) : '';
  const number = normalizeNumber(geo?.streetNumber) || nameNumber;
  const street = clean(geo?.street);
  const building = number && rules.buildingPattern.test(normalizeBuilding(country, number)) ? number : null;

  const city = canonicalCity(clean(geo?.city) ?? clean(geo?.subregion) ?? clean(geo?.region));
  const district = cleanDistrict(geo?.district ?? geo?.subregion);
  const postal = normalizeNumber(geo?.postalCode);

  return {
    ...EMPTY_DRAFT,
    // A street to hang the number on, or the place's name, or nothing — a bare
    // building number is not a street line.
    line1: street
      ? building
        ? composeStreetLine(country, building, street)
        : [number || null, street].filter(Boolean).join(' ')
      : nameNumber
        ? ''
        : (rawName ?? ''),
    building_number: building,
    area: district && !sameAsCity(district, city) ? district : null,
    city,
    region: clean(geo?.region),
    postal_code: rules.postalPattern.test(postal) ? postal : null,
    country,
    lat: roundCoord(coords.latitude),
    lng: roundCoord(coords.longitude),
  };
}

/** A place from the Ahaar API — already normalised server-side — as a draft. */
export function draftFromPlace(place: GeoPlace, source: LocationSource): AddressDraft {
  return {
    ...EMPTY_DRAFT,
    line1: place.line1 ?? '',
    area: place.area,
    city: place.city ?? '',
    region: place.region,
    postal_code: place.postal_code,
    country: place.country_code ?? detectCountry(place.lat, place.lng) ?? DEFAULT_COUNTRY,
    building_number: place.building_number,
    lat: roundCoord(place.lat),
    lng: roundCoord(place.lng),
    location_source: source,
  };
}

/** The API stores `decimal(10,7)`; more digits than that is noise. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

/** How close a saved address has to be to count as "the same place". */
export const SAME_PLACE_METERS = 40;

interface Matchable {
  line1: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * A saved address that is already this place: within `SAME_PLACE_METERS` when
 * both are pinned, or the same street line and city otherwise. Picking the
 * existing one instead of saving a copy keeps the address book from filling
 * with duplicates every time the customer taps "Use my current location" at
 * home.
 */
export function findSamePlace<T extends Matchable>(
  addresses: readonly T[],
  draft: Pick<AddressDraft, 'line1' | 'city' | 'lat' | 'lng'>,
): T | undefined {
  if (draft.lat !== null && draft.lng !== null) {
    const here = { latitude: draft.lat, longitude: draft.lng };
    const near = addresses.find(
      (a) =>
        a.lat !== null &&
        a.lng !== null &&
        distanceMeters(here, { latitude: a.lat, longitude: a.lng }) <= SAME_PLACE_METERS,
    );
    if (near) return near;
  }

  if (!clean(draft.line1) || !clean(draft.city)) return undefined;
  return addresses.find((a) => same(a.line1, draft.line1) && same(a.city, draft.city));
}
