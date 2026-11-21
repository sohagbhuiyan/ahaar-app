/**
 * Display text for a country's address rules, in the app language.
 *
 * `countries.ts` stays pure and English (it mirrors the backend and the web);
 * these read the same fields through i18n at render time, falling back to the
 * English rule text for anything a locale file lacks.
 */
import i18n from '@/lib/i18n';

import { countryRules, type CountryRules } from './countries';

export type CountryLabels = CountryRules['labels'];
export type CountryMessageField = keyof CountryRules['messages'];

/** "Saudi Arabia" / "المملكة العربية السعودية". */
export function countryName(code: string | null | undefined): string {
  const rules = countryRules(code);
  return i18n.t(`location.countries.${rules.code}.name`, { defaultValue: rules.name });
}

/** The form labels and hints for a country's address fields. */
export function countryLabels(code: string | null | undefined): CountryLabels {
  const rules = countryRules(code);
  const out = {} as CountryLabels;
  for (const key of Object.keys(rules.labels) as (keyof CountryLabels)[]) {
    out[key] = i18n.t(`location.countries.${rules.code}.labels.${key}`, {
      defaultValue: rules.labels[key],
    });
  }
  return out;
}

/** The i18n key of a country's validation message — translated where the error is shown. */
export function countryMessageKey(code: string | null | undefined, field: CountryMessageField): string {
  return `location.countries.${countryRules(code).code}.messages.${field}`;
}
