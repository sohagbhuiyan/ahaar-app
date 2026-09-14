/**
 * Maps and addresses — public, so a signed-out visitor can choose where their
 * food goes. The Google key lives on the server; the app talks to the Ahaar API.
 *
 * When the API has no `/geo` endpoints yet (404) or can't be reached, the same
 * questions go to OpenStreetMap directly (`../../location/geoFallback`),
 * normalised the same way — picking a location must not wait on a backend
 * deploy.
 */
import {
  fallbackPlace,
  fallbackReverse,
  fallbackSearch,
} from '../../location/geoFallback';
import { apiClient, unwrap } from '../client';
import { isApiError, type ApiEnvelope } from '../types/common';
import type { GeoConfig, GeoPlace, PlaceSuggestion } from '../types/geo';

interface LookupOptions {
  lang?: string;
  signal?: AbortSignal;
}

/** Flipped when the API answers 404 for `/geo` — an older backend — so later lookups skip the doomed request. */
let apiHasGeo = true;

/** Whether a failed API call is worth answering from OpenStreetMap instead. */
function shouldFallBack(error: unknown, signal?: AbortSignal, routeMissing = true): boolean {
  if (signal?.aborted) return false;
  if (!isApiError(error)) return true;
  if (error.status === 404 && routeMissing) {
    apiHasGeo = false;
    return true;
  }
  // 0 = offline or timed out.
  return error.status === 0 || error.status >= 500;
}

/** GET /geo/config */
export async function getGeoConfig(): Promise<GeoConfig> {
  const { data } = await apiClient.get<ApiEnvelope<GeoConfig>>('/geo/config');
  return unwrap(data);
}

/** GET /geo/reverse — what is at a pin. Answers even when the street is unknown. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  { lang = 'en', signal }: LookupOptions = {},
): Promise<GeoPlace> {
  if (apiHasGeo) {
    try {
      const { data } = await apiClient.get<ApiEnvelope<GeoPlace>>('/geo/reverse', {
        params: { lat, lng, lang },
        signal,
        timeout: 10_000,
      });
      return unwrap(data);
    } catch (error) {
      if (!shouldFallBack(error, signal)) throw error;
    }
  }
  return fallbackReverse(lat, lng, { lang, signal });
}

/** GET /geo/search — addresses and places in the served countries, nearest first. */
export async function searchPlaces(
  query: string,
  {
    lat,
    lng,
    session,
    lang = 'en',
    signal,
  }: LookupOptions & { lat?: number | null; lng?: number | null; session?: string } = {},
): Promise<PlaceSuggestion[]> {
  if (apiHasGeo) {
    try {
      const { data } = await apiClient.get<ApiEnvelope<PlaceSuggestion[]>>('/geo/search', {
        params: {
          q: query,
          lang,
          session,
          ...(lat != null && lng != null ? { lat, lng } : {}),
        },
        signal,
        timeout: 10_000,
      });
      return unwrap(data) ?? [];
    } catch (error) {
      if (!shouldFallBack(error, signal)) throw error;
    }
  }
  return fallbackSearch(query, { lat, lng, lang, signal });
}

/** GET /geo/places/{id} — the pin a search result points to. */
export async function getPlace(
  placeId: string,
  { session, lang = 'en', signal }: LookupOptions & { session?: string } = {},
): Promise<GeoPlace> {
  if (apiHasGeo) {
    try {
      const { data } = await apiClient.get<ApiEnvelope<GeoPlace>>(
        `/geo/places/${encodeURIComponent(placeId)}`,
        { params: { lang, session }, signal, timeout: 10_000 },
      );
      return unwrap(data);
    } catch (error) {
      // A 404 here can simply mean "no such place", so it doesn't mark the API as lacking /geo.
      const osmNotFound = placeId.startsWith('osm:') && isApiError(error) && error.status === 404;
      if (!shouldFallBack(error, signal, false) && !osmNotFound) throw error;
    }
  }
  return fallbackPlace(placeId, { lang, signal });
}

/** Test seam — forget that the API was found without `/geo`. */
export function resetGeoApiForTests(): void {
  apiHasGeo = true;
}
