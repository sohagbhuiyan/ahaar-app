/**
 * The dietary vocabulary the API accepts.
 *
 * `UpdateDietaryPreferencesRequest` validates every tag with
 * `Rule::in(config('diet.tags'))` and every allergen with
 * `Rule::in(config('diet.allergens'))`, so anything not listed here is a
 * guaranteed 422. Mirrored verbatim from `ahaar-backend/config/diet.php` —
 * when that file gains a value, add it here too.
 */
export const DIETARY_TAGS = [
  'halal',
  'vegetarian',
  'vegan',
  'gluten_free',
  'dairy_free',
  'low_carb',
  'high_protein',
  'spicy',
] as const;

export const ALLERGENS = [
  'gluten',
  'dairy',
  'eggs',
  'fish',
  'shellfish',
  'peanuts',
  'tree_nuts',
  'soy',
  'sesame',
  'mustard',
  'celery',
  'sulphites',
] as const;

export type DietaryTag = (typeof DIETARY_TAGS)[number];
export type Allergen = (typeof ALLERGENS)[number];

/** `"gluten_free"` → `"Gluten free"`. The API stores snake_case. */
export function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Locales `UpdateProfileRequest` accepts (`in:nl,en,ar`).
 *
 * Note this is the *account* locale the backend stores, not the app's display
 * language — the mobile app is English-only for now, and sending the value
 * keeps emails and invoices in the customer's language.
 */
export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'ar', label: 'العربية' },
] as const;
