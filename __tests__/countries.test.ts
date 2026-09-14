import {
  canonicalCity,
  cleanDistrict,
  composeStreetLine,
  countryRules,
  detectCountry,
  isInServiceArea,
  normalizeBuilding,
  normalizeNumber,
  normalizeShortAddress,
  splitStreetLine,
  toLatinDigits,
} from '@/lib/location/countries';

describe('country rules', () => {
  it('reads Arabic-Indic, Persian and Bengali digits as Latin ones', () => {
    expect(toLatinDigits('١٢٢١١')).toBe('12211');
    expect(toLatinDigits('۸۲۲۸ King Fahd')).toBe('8228 King Fahd');
    expect(toLatinDigits('১২০৯')).toBe('1209');
    expect(normalizeNumber(' ٨٢ ٢٨ ')).toBe('8228');
    expect(normalizeShortAddress('rrrd ٢٩٢٩')).toBe('RRRD2929');
  });

  it('detects the country from the pin, and serves Saudi Arabia and Bangladesh only', () => {
    expect(detectCountry(24.7136, 46.6753)).toBe('SA'); // Riyadh
    expect(detectCountry(23.8103, 90.4125)).toBe('BD'); // Dhaka
    expect(detectCountry(51.5072, -0.1276)).toBeNull(); // London

    expect(isInServiceArea({ country: 'sa' })).toBe(true);
    expect(isInServiceArea({ country: 'BD' })).toBe(true);
    // Dubai sits inside Saudi Arabia's generous box; the lookup's country wins.
    expect(isInServiceArea({ country: 'AE', lat: 25.2048, lng: 55.2708 })).toBe(false);
    expect(isInServiceArea({ lat: 21.5433, lng: 39.1728 })).toBe(true); // Jeddah, no country
    expect(isInServiceArea({ lat: 51.5072, lng: -0.1276 })).toBe(false);
    expect(isInServiceArea({})).toBe(true);
  });

  it('knows each country’s address shape', () => {
    expect(countryRules('SA').postalPattern.test('12211')).toBe(true);
    expect(countryRules('BD').postalPattern.test('1209')).toBe(true);
    expect(countryRules('BD').postalPattern.test('12211')).toBe(false);
    expect(countryRules('BD').buildingPattern.test('12/A')).toBe(true);
    expect(countryRules('SA').buildingPattern.test('12/A')).toBe(false);
    // Anything unknown is treated the Saudi way.
    expect(countryRules('AE').code).toBe('SA');
  });

  it('strips the decoration lookups put on a district', () => {
    expect(cleanDistrict('حي العليا')).toBe('العليا');
    expect(cleanDistrict('Al Olaya Dist.')).toBe('Al Olaya');
    expect(cleanDistrict('Dhanmondi Thana')).toBe('Dhanmondi');
    expect(cleanDistrict('   ')).toBeNull();
  });

  it('gives each city one spelling, in both countries', () => {
    expect(canonicalCity('Ar Riyad')).toBe('Riyadh');
    expect(canonicalCity('Riyadh Province')).toBe('Riyadh');
    expect(canonicalCity('الرياض')).toBe('Riyadh');
    expect(canonicalCity('mecca')).toBe('Makkah');
    expect(canonicalCity('Chittagong')).toBe('Chattogram');
    expect(canonicalCity('ঢাকা')).toBe('Dhaka');
    expect(canonicalCity('Dhaka Division')).toBe('Dhaka');
    expect(canonicalCity('Unaizah')).toBe('Unaizah');
  });

  it('writes and reads the street line each country’s way', () => {
    expect(composeStreetLine('SA', '٨٢٢٨', ' King Fahd Rd ')).toBe('8228 King Fahd Rd');
    expect(composeStreetLine('BD', '12/A', 'Road 5')).toBe('House 12/A, Road 5');
    expect(composeStreetLine('BD', '', 'Road 5')).toBe('Road 5');
    expect(normalizeBuilding('BD', ' ১২/A ')).toBe('12/A');

    expect(splitStreetLine('SA', '8228 King Fahd Rd', null)).toEqual({
      building_number: '8228',
      street: 'King Fahd Rd',
    });
    expect(splitStreetLine('SA', '12 Tahlia St', null)).toEqual({ building_number: '', street: '12 Tahlia St' });
    expect(splitStreetLine('BD', 'House 12/A, Road 5', null)).toEqual({
      building_number: '12/A',
      street: 'Road 5',
    });
    expect(splitStreetLine('BD', 'Road 5', '7')).toEqual({ building_number: '7', street: 'Road 5' });
  });
});
