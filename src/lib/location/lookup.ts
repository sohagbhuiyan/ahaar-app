/**
 * "What is at this pin?" — one answer for GPS, the map and search.
 *
 * The Ahaar API answers first: it holds the Google key and writes the address
 * its country's way, exactly as the website and admin see it. When the API
 * can't be reached, or knows only the country, the device's own geocoder fills
 * in what it can. Either way the pin itself is never thrown away.
 */
import * as Location from 'expo-location';

import { reverseGeocode } from '../api/endpoints/geo';
import type { GeoPlace, LocationSource } from '../api/types/geo';
import {
  composeAddress,
  draftFromGeocode,
  draftFromPlace,
  type AddressDraft,
  type Coordinates,
} from './address';
import { countryRules, detectCountry, isInServiceArea, isSupportedCountry } from './countries';

export interface PlaceLookup {
  draft: AddressDraft;
  /** Whether Ahaar delivers here. */
  supported: boolean;
  /** ISO alpha-2 of the pin, when known. */
  country: string | null;
  countryName: string | null;
  /** A street or a city was found — otherwise the customer types the rest. */
  found: boolean;
  formatted: string;
}

/** A place the API already resolved — a search pick — as a lookup. */
export function lookupFromPlace(place: GeoPlace, source: LocationSource): PlaceLookup {
  const draft = draftFromPlace(place, source);
  return {
    draft,
    supported: place.supported,
    country: place.country_code,
    countryName: place.country_name ?? (isSupportedCountry(place.country_code) ? countryRules(place.country_code).name : null),
    found: Boolean(place.line1 || place.city),
    formatted: place.formatted || composeAddress(draft),
  };
}

export async function lookupPlace(
  coords: Coordinates,
  source: LocationSource,
  { signal }: { signal?: AbortSignal } = {},
): Promise<PlaceLookup> {
  let api: GeoPlace | null = null;
  try {
    api = await reverseGeocode(coords.latitude, coords.longitude, { signal });
    if (api.line1 || api.city) return lookupFromPlace(api, source);
  } catch {
    // Offline, or the API is down — the device geocoder below still knows a lot.
  }
  if (signal?.aborted) throw new Error('aborted');

  let geocoded: Location.LocationGeocodedAddress | null = null;
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    geocoded = results[0] ?? null;
  } catch {
    geocoded = null;
  }

  // Nothing better from the device: keep the API's answer, country and all.
  if (!geocoded && api) return lookupFromPlace(api, source);

  const draft = { ...draftFromGeocode(coords, geocoded), location_source: source };
  const iso = geocoded?.isoCountryCode?.toUpperCase() ?? null;
  const country = iso ?? detectCountry(coords.latitude, coords.longitude);

  return {
    draft,
    supported: isInServiceArea({ country: iso, lat: coords.latitude, lng: coords.longitude }),
    country,
    countryName: isSupportedCountry(country) ? countryRules(country).name : null,
    found: Boolean(geocoded),
    formatted: composeAddress(draft),
  };
}

/** A UUID v4 grouping one search with the result it ends in — Google bills them as one. */
export function newSearchSession(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const random = (Math.random() * 16) | 0;
    return (ch === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
