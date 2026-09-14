/**
 * OpenStreetMap, asked directly from the app — only when the Ahaar API has no
 * `/geo` endpoints (a backend deployed before them) or can't be reached, so
 * choosing a location on the map never waits on a backend release.
 *
 * Places are normalised exactly like the backend's `GeoService`, so a pin reads
 * the same whichever path answered. Nominatim's public server allows about one
 * request a second — fine as a fallback, not as the main path.
 */
import type { GeoPlace, PlaceSuggestion } from '../api/types/geo';
import { composeAddress } from './address';
import {
  COUNTRIES,
  SUPPORTED_COUNTRIES,
  canonicalCity,
  cleanDistrict,
  composeStreetLine,
  countryRules,
  detectCountry,
  isSupportedCountry,
  normalizeBuilding,
  normalizeNumber,
  toLatinDigits,
} from './countries';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'AhaarApp/1.0 (+https://ahaar.store)';

/** Raw address parts, whichever geocoder produced them. */
export interface GeoComponents {
  street_number?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  place_id?: string | null;
  name?: string | null;
}

export interface NominatimResult {
  osm_type?: string;
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: Record<string, string | undefined>;
}

const round7 = (value: number) => Math.round(value * 1e7) / 1e7;

/** Components → the one place shape every client reads. Mirrors `GeoService::toPlace`. */
export function toGeoPlace(components: GeoComponents, lat: number, lng: number): GeoPlace {
  const country = components.country_code?.trim().toUpperCase() || detectCountry(lat, lng) || '';
  const rules = country in COUNTRIES ? countryRules(country) : null;

  const number = toLatinDigits(components.street_number ?? '').trim();
  const street = components.street?.trim() ?? '';
  const building =
    rules && number && rules.buildingPattern.test(normalizeBuilding(country, number))
      ? normalizeBuilding(country, number)
      : null;

  // A Saudi house number that isn't a 4-digit National Address building
  // number still belongs at the head of the street line.
  const line1 = !street
    ? (components.name?.trim() ?? '')
    : building
      ? composeStreetLine(country, building, street)
      : `${number} ${street}`.trim();

  const city = canonicalCity(components.city ?? components.region);
  let area = cleanDistrict(components.district);
  if (area && canonicalCity(area).toLocaleLowerCase() === city.toLocaleLowerCase()) area = null;

  const postalDigits = normalizeNumber(components.postal_code);
  const postal = rules && rules.postalPattern.test(postalDigits) ? postalDigits : null;

  return {
    place_id: components.place_id ?? null,
    country_code: country || null,
    country_name: rules?.name ?? null,
    supported: isSupportedCountry(country),
    name: components.name?.trim() || null,
    building_number: building,
    street: street || null,
    line1,
    area,
    city: city || null,
    region: components.region?.trim() || null,
    postal_code: postal,
    formatted: composeAddress({ line1, area, city, postal_code: postal }),
    lat: round7(lat),
    lng: round7(lng),
  };
}

function osmPlaceId(result: NominatimResult): string | null {
  return result.osm_type && result.osm_id != null
    ? `osm:${result.osm_type.charAt(0).toUpperCase()}${result.osm_id}`
    : null;
}

/** Nominatim's address fields → components. Mirrors `NominatimGeoProvider::fromResult`. */
export function nominatimComponents(result: NominatimResult): GeoComponents {
  const a = result.address ?? {};
  return {
    street_number: a.house_number ?? null,
    street: a.road ?? a.pedestrian ?? a.footway ?? null,
    district: a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null,
    region: a.state ?? null,
    postal_code: a.postcode ?? null,
    country_code: a.country_code ? a.country_code.toUpperCase() : null,
    place_id: osmPlaceId(result),
    name: result.name?.trim() || null,
  };
}

/** Hand-built query: React Native's URLSearchParams is incomplete. */
function toQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

async function nominatim<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${NOMINATIM_URL}/${path}?${toQuery({ format: 'jsonv2', ...params })}`, {
    signal,
    // Nominatim's usage policy asks apps to identify themselves.
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`OpenStreetMap answered ${response.status}`);
  return (await response.json()) as T;
}

interface Options {
  lang?: string;
  signal?: AbortSignal;
}

/** What is at a pin. Always answers — the pin stands even when the lookup fails. */
export async function fallbackReverse(
  lat: number,
  lng: number,
  { lang = 'en', signal }: Options = {},
): Promise<GeoPlace> {
  let result: NominatimResult | null = null;
  try {
    result = await nominatim<NominatimResult>(
      'reverse',
      { lat: String(lat), lon: String(lng), addressdetails: '1', zoom: '18', 'accept-language': lang },
      signal,
    );
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  return toGeoPlace(result?.address ? nominatimComponents(result) : {}, lat, lng);
}

/** Places in the served countries, preferring those near `lat`/`lng`. */
export async function fallbackSearch(
  query: string,
  { lat, lng, lang = 'en', signal }: Options & { lat?: number | null; lng?: number | null } = {},
): Promise<PlaceSuggestion[]> {
  const params: Record<string, string> = {
    q: query,
    addressdetails: '1',
    limit: '8',
    'accept-language': lang,
    countrycodes: SUPPORTED_COUNTRIES.join(',').toLowerCase(),
  };
  if (lat != null && lng != null) {
    params.viewbox = [lng - 0.5, lat + 0.5, lng + 0.5, lat - 0.5].join(',');
  }

  const results = await nominatim<NominatimResult[]>('search', params, signal);
  return (Array.isArray(results) ? results : [])
    .filter((result) => osmPlaceId(result) && result.lat && result.lon)
    .map((result) => {
      const parts = (result.display_name ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      const name = result.name?.trim() ?? '';
      const title = name || parts.shift() || '';
      if (name && parts[0] === name) parts.shift();
      return {
        place_id: osmPlaceId(result) as string,
        title,
        subtitle: parts.length ? parts.join(', ') : null,
        lat: Number(result.lat),
        lng: Number(result.lon),
      };
    });
}

/** The place an OpenStreetMap search result points to. */
export async function fallbackPlace(
  placeId: string,
  { lang = 'en', signal }: Options = {},
): Promise<GeoPlace> {
  const match = /^osm:([NWR])(\d+)$/.exec(placeId);
  if (!match) throw new Error('Not an OpenStreetMap place');

  const results = await nominatim<NominatimResult[]>(
    'lookup',
    { osm_ids: `${match[1]}${match[2]}`, addressdetails: '1', 'accept-language': lang },
    signal,
  );
  const first = Array.isArray(results) ? results[0] : undefined;
  if (!first?.lat || !first.lon) throw new Error('Place not found');
  return toGeoPlace(nominatimComponents(first), Number(first.lat), Number(first.lon));
}
