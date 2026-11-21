/**
 * Languages the app speaks. Mirrors the website (`ahaar/src/i18n/config.ts`)
 * and the API (`SetApiLocale::SUPPORTED_LOCALES`): codes, the English
 * fallback and the RTL set must stay identical across all three.
 */
export const LOCALES = ['en', 'bn', 'ar'] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';
export const RTL_LOCALES: readonly AppLocale[] = ['ar'];

export const LOCALE_META: Record<
  AppLocale,
  { native: string; english: string; rtl: boolean; intl: string }
> = {
  en: { native: 'English', english: 'English', rtl: false, intl: 'en-GB' },
  bn: { native: 'বাংলা', english: 'Bangla', rtl: false, intl: 'bn-BD' },
  ar: { native: 'العربية', english: 'Arabic', rtl: true, intl: 'ar-SA' },
};

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale as AppLocale);
}
