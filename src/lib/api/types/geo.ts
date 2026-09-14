/**
 * `App\Http\Controllers\Api\Customer\GeoController` — maps and addresses.
 *
 * Every place comes back already written its own country's way (Saudi
 * National Address, or a Bangladeshi test address) — the same shape the
 * website and the admin panel read.
 */

/** How the customer chose a place — stored with the address for the admin. */
export type LocationSource = 'gps' | 'map' | 'search' | 'manual';

export interface GeoPlace {
  place_id: string | null;
  /** ISO alpha-2 as the geocoder named it — may be a country Ahaar doesn't serve. */
  country_code: string | null;
  country_name: string | null;
  /** Whether an address can be saved here. */
  supported: boolean;
  /** A place's own name — "Kingdom Centre" — when it has one. */
  name: string | null;
  building_number: string | null;
  street: string | null;
  /** "8228 King Fahd Rd" / "House 12, Road 5"; empty when the street is unknown. */
  line1: string;
  area: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  formatted: string;
  lat: number;
  lng: number;
}

export interface PlaceSuggestion {
  place_id: string;
  title: string;
  subtitle: string | null;
  /** Present when the provider already knows the pin (OpenStreetMap). */
  lat: number | null;
  lng: number | null;
}

export interface GeoCountry {
  code: string;
  name: string;
  center: { lat: number; lng: number };
  national_address: boolean;
}

export interface GeoConfig {
  default_country: string;
  countries: GeoCountry[];
  provider: 'google' | 'openstreetmap';
}
