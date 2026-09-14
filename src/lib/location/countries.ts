/**
 * Where Ahaar delivers, and how an address is written there.
 *
 * Saudi Arabia is the market. Its addresses are Saudi Post National Addresses:
 * a 4-digit building number, street, district (الحي), city, 5-digit postal
 * code, 4-digit additional number and an 8-character short address —
 * "8228 King Fahd Rd, Al Olaya, Riyadh 12211-2121".
 *
 * Bangladesh is supported for development and testing: house / holding
 * number, road, area, city and a 4-digit postcode —
 * "House 12, Road 5, Dhanmondi, Dhaka 1209".
 *
 * The country is never assumed: it comes from the pin — the geocoder's answer,
 * or `detectCountry` when there isn't one. Whether a country is still accepted
 * is the backend's call (`LOCATION_SUPPORTED_COUNTRIES`), so switching
 * Bangladesh off at launch needs no release.
 *
 * Pure: no React, no native modules. Mirrors the backend's
 * `App\Support\AddressFormat` and the website's `src/lib/countries.ts`.
 */
import type { LocationSource } from '../api/types/geo';

export type { LocationSource };

export type CountryCode = 'SA' | 'BD';

export interface CountryRules {
  code: CountryCode;
  name: string;
  flag: string;
  /** Where a map opens when there is nothing better to centre on. */
  center: { latitude: number; longitude: number };
  bounds: { south: number; north: number; west: number; east: number };
  /** Saudi National Address codes: additional number and short address. */
  nationalAddress: boolean;
  buildingPattern: RegExp;
  postalPattern: RegExp;
  labels: {
    city: string;
    cityHint: string;
    area: string;
    areaHint: string;
    street: string;
    streetHint: string;
    building: string;
    buildingHint: string;
    unit: string;
    postal: string;
    postalHint: string;
  };
  messages: { area: string; street: string; building: string; postal: string };
}

export const COUNTRIES: Record<CountryCode, CountryRules> = {
  SA: {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    center: { latitude: 24.7136, longitude: 46.6753 },
    bounds: { south: 16.3, north: 32.2, west: 34.4, east: 55.7 },
    nationalAddress: true,
    buildingPattern: /^\d{4}$/,
    postalPattern: /^\d{5}$/,
    labels: {
      city: 'City',
      cityHint: 'e.g. Riyadh, Jeddah, Dammam',
      area: 'District',
      areaHint: 'الحي — e.g. Al Olaya',
      street: 'Street name',
      streetHint: 'e.g. King Fahd Road',
      building: 'Building no.',
      buildingHint: '4 digits',
      unit: 'Apartment, floor',
      postal: 'Postal code',
      postalHint: '5 digits',
    },
    messages: {
      area: 'District is required',
      street: 'Street name is required',
      building: 'Building number is 4 digits',
      postal: 'Postal code is 5 digits',
    },
  },
  BD: {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    center: { latitude: 23.8103, longitude: 90.4125 },
    bounds: { south: 20.5, north: 26.7, west: 88.0, east: 92.7 },
    nationalAddress: false,
    // Latin and Bengali letters and digits, "/" and "-": "12", "12/A", "৪৫-বি".
    buildingPattern: /^[0-9A-Za-zঀ-৿/\- ]{1,20}$/,
    postalPattern: /^\d{4}$/,
    labels: {
      city: 'City',
      cityHint: 'e.g. Dhaka, Chattogram',
      area: 'Area / Thana',
      areaHint: 'e.g. Dhanmondi',
      street: 'Road / street',
      streetHint: 'e.g. Road 5',
      building: 'House / holding no.',
      buildingHint: 'e.g. 12 or 12/A',
      unit: 'Flat, floor',
      postal: 'Postcode',
      postalHint: '4 digits',
    },
    messages: {
      area: 'Area is required',
      street: 'Road is required',
      building: 'Use letters, digits, / and -',
      postal: 'Postcode is 4 digits',
    },
  },
};

/** Countries the app offers. The backend has the final say on which it accepts. */
export const SUPPORTED_COUNTRIES: readonly CountryCode[] = ['SA', 'BD'];

export const DEFAULT_COUNTRY: CountryCode = 'SA';

/** Time zones that give a country away — used only to open a map near the customer, never to decide an address. */
const TIME_ZONE_COUNTRIES: Record<string, CountryCode> = {
  'Asia/Riyadh': 'SA',
  'Asia/Dhaka': 'BD',
};

/** The served country the phone's clock is set to, when it is one — no permission needed. */
export function guessCountryFromTimeZone(): CountryCode | null {
  try {
    return TIME_ZONE_COUNTRIES[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
  } catch {
    return null;
  }
}

export const ADDITIONAL_NUMBER_PATTERN = /^\d{4}$/;
export const SHORT_ADDRESS_PATTERN = /^[A-Z]{4}\d{4}$/;

export function isSupportedCountry(code: string | null | undefined): code is CountryCode {
  return Boolean(code && (SUPPORTED_COUNTRIES as readonly string[]).includes(code.toUpperCase()));
}

/** The rules for a country — Saudi Arabia's for anything the app doesn't know. */
export function countryRules(code: string | null | undefined): CountryRules {
  const upper = code?.toUpperCase();
  return upper && upper in COUNTRIES ? COUNTRIES[upper as CountryCode] : COUNTRIES[DEFAULT_COUNTRY];
}

/** The known country whose box holds the point. */
export function detectCountry(lat: number, lng: number): CountryCode | null {
  for (const rules of Object.values(COUNTRIES)) {
    const { south, north, west, east } = rules.bounds;
    if (lat >= south && lat <= north && lng >= west && lng <= east) return rules.code;
  }
  return null;
}

/**
 * Whether a place can be delivered to: the geocoder's country when it named
 * one, the boxes when only coordinates are known, and `true` with nothing to
 * judge by (a typed address — the form only offers served countries).
 */
export function isInServiceArea(place: {
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}): boolean {
  const country = place.country?.trim();
  if (country) return isSupportedCountry(country);
  if (place.lat != null && place.lng != null) return detectCountry(place.lat, place.lng) !== null;
  return true;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const BENGALI = '০১২৩৪৫৬৭৮৯';

/**
 * "١٢٢١١" / "১২০৯" → Latin digits. An Arabic or Bengali keyboard, and a
 * geocoder answering in those languages, hand back their own digits.
 */
export function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹০-৯]/g, (ch) => {
    for (const set of [ARABIC_INDIC, PERSIAN, BENGALI]) {
      const index = set.indexOf(ch);
      if (index >= 0) return String(index);
    }
    return ch;
  });
}

/** A code as typed — digits made Latin, spaces and dashes dropped. */
export function normalizeNumber(value: string | null | undefined): string {
  return toLatinDigits(value ?? '').replace(/[\s-]/g, '');
}

/** "rrrd 2929" → "RRRD2929". */
export function normalizeShortAddress(value: string | null | undefined): string {
  return normalizeNumber(value).toUpperCase();
}

/** A Saudi building number is digits only; a Bangladeshi house number may be "12/A". */
export function normalizeBuilding(country: string | null | undefined, value: string | null | undefined): string {
  if (countryRules(country).nationalAddress) return normalizeNumber(value);
  return toLatinDigits(value ?? '').replace(/\s+/g, ' ').trim();
}

/** "حي العليا" → "العليا", "Al Olaya Dist." → "Al Olaya", "Dhanmondi Thana" → "Dhanmondi". */
export function cleanDistrict(value: string | null | undefined): string | null {
  const bare = (value ?? '')
    .trim()
    .replace(/^حي\s+/, '')
    .replace(/^(district|dist\.?)\s+/i, '')
    .replace(/\s+(district|dist\.?|thana)$/i, '')
    .trim();
  return bare || null;
}

/** Canonical city → other spellings lookups and customers use. */
const CITY_ALIASES: Record<string, readonly string[]> = {
  // Saudi Arabia
  Riyadh: ['ar riyad', 'al riyadh', 'riyad', 'الرياض'],
  Jeddah: ['jiddah', 'jidda', 'jedda', 'جدة', 'جده'],
  Makkah: ['mecca', 'makka', 'makkah al mukarramah', 'مكة', 'مكه', 'مكة المكرمة'],
  Madinah: ['medina', 'madina', 'al madinah', 'al madinah al munawwarah', 'المدينة', 'المدينة المنورة'],
  Dammam: ['ad dammam', 'al dammam', 'الدمام'],
  'Al Khobar': ['khobar', 'al khubar', 'الخبر'],
  Dhahran: ['az zahran', 'الظهران'],
  Taif: ['at taif', 'al taif', 'الطائف'],
  Tabuk: ['تبوك'],
  Buraydah: ['buraidah', 'buraida', 'بريدة'],
  'Khamis Mushait': ['khamis mushayt', 'خميس مشيط'],
  Abha: ['أبها', 'ابها'],
  "Ha'il": ['hail', 'حائل'],
  Najran: ['نجران'],
  Jazan: ['jizan', 'gizan', 'جازان', 'جيزان'],
  Jubail: ['al jubail', 'الجبيل'],
  Yanbu: ['ينبع'],
  'Al Ahsa': ['al hasa', 'hasa', 'الأحساء', 'الاحساء'],
  Hofuf: ['al hofuf', 'al hufuf', 'hufuf', 'الهفوف'],
  Qatif: ['al qatif', 'القطيف'],
  'Al Kharj': ['kharj', 'الخرج'],
  // Bangladesh
  Dhaka: ['dacca', 'ঢাকা'],
  Chattogram: ['chittagong', 'চট্টগ্রাম'],
  Sylhet: ['সিলেট'],
  Khulna: ['খুলনা'],
  Rajshahi: ['রাজশাহী'],
  Barishal: ['barisal', 'বরিশাল'],
  Rangpur: ['রংপুর'],
  Mymensingh: ['ময়মনসিংহ'],
  Gazipur: ['গাজীপুর'],
  Narayanganj: ['নারায়ণগঞ্জ'],
  Cumilla: ['comilla', 'কুমিল্লা'],
};

function cityKey(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[ً-ْ]/g, '') // Arabic diacritics
    .replace(/^منطقة\s+/, '') // "منطقة الرياض" — the region, not the city
    .replace(/\s+(province|region|governorate|city|division|district|বিভাগ|জেলা)$/i, '')
    .replace(/[-_'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CITY_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(CITY_ALIASES)) {
  for (const name of [canonical, ...aliases]) CITY_LOOKUP.set(cityKey(name), canonical);
}

/**
 * One spelling per city — "Ar Riyad", "Riyadh Province" and "الرياض" are all
 * "Riyadh", "Chittagong" is "Chattogram" — so deliveries group by city however
 * the address was entered. A city not in the list is kept as given.
 */
export function canonicalCity(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return CITY_LOOKUP.get(cityKey(trimmed)) ?? trimmed;
}

/** "8228 King Fahd Rd" in Saudi Arabia, "House 12, Road 5" in Bangladesh. */
export function composeStreetLine(
  country: string | null | undefined,
  building: string | null | undefined,
  street: string | null | undefined,
): string {
  const number = normalizeBuilding(country, building);
  const road = street?.trim() ?? '';
  const bangladesh = country?.toUpperCase() === 'BD';

  if (!number) return road;
  if (!road) return bangladesh ? `House ${number}` : number;
  return bangladesh ? `House ${number}, ${road}` : `${number} ${road}`;
}

/**
 * The reverse, for editing: the building number and the street. Uses the
 * stored `building_number` when there is one, and otherwise reads it off the
 * line — addresses saved before the field existed.
 */
export function splitStreetLine(
  country: string | null | undefined,
  line1: string | null | undefined,
  buildingNumber: string | null | undefined,
): { building_number: string; street: string } {
  const line = toLatinDigits(line1 ?? '').trim();
  const known = normalizeBuilding(country, buildingNumber);

  if (country?.toUpperCase() === 'BD') {
    const match = /^House\s+([^,]+?)(?:,\s*(.*))?$/i.exec(line);
    if (match) return { building_number: known || match[1].trim(), street: (match[2] ?? '').trim() };
    return { building_number: known, street: line };
  }

  if (known) {
    if (line === known) return { building_number: known, street: '' };
    return {
      building_number: known,
      street: line.startsWith(`${known} `) ? line.slice(known.length + 1).trim() : line,
    };
  }

  const match = /^(\d{4})\s+(.+)$/.exec(line);
  return match
    ? { building_number: match[1], street: match[2].trim() }
    : { building_number: '', street: line };
}
