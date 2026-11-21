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
 * Translation keys for the display labels. The values above are what the API
 * stores; translate at render time so the label follows the app language:
 * `t(dietTagLabelKey(tag), { defaultValue: humanise(tag) })`.
 */
export function dietTagLabelKey(tag: string): string {
  return `profile.diet.tags.${tag}`;
}

export function allergenLabelKey(allergen: string): string {
  return `profile.diet.allergens.${allergen}`;
}

/**
 * Locales accepted across AHAAR ecosystem: English (en), Bangla (bn), Arabic (ar).
 * Labels are endonyms (each language in its own script), so they are never
 * translated.
 */
export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
  { value: 'ar', label: 'العربية' },
] as const;
