import { LOCALE_META, type AppLocale } from './config';
import { getActiveLocale, useAppLocale } from '../store/useLanguageStore';

/**
 * Locale-aware formatting. Digits stay Latin (`-u-nu-latn`) in every language:
 * prices, order numbers and times are compared against receipts, SMS and the
 * rider app, which all print Western digits — but month and weekday *names*
 * are localized.
 */
function tag(locale: AppLocale): string {
  return `${LOCALE_META[locale].intl}-u-ca-gregory-nu-latn`;
}

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  // A bare `YYYY-MM-DD` is a calendar day, not UTC midnight — parse it as local
  // so it doesn't slip to the previous day west of Greenwich.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale: AppLocale = getActiveLocale(),
): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(tag(locale), options).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(d);
  }
}

export function formatTime(value: Date | string | number, locale: AppLocale = getActiveLocale()): string {
  return formatDate(value, { hour: 'numeric', minute: '2-digit' }, locale);
}

/** `HH:mm[:ss]` from the API (slot start/end) → localized clock time. */
export function formatClock(hhmm: string | null | undefined, locale: AppLocale = getActiveLocale()): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return formatTime(d, locale);
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: AppLocale = getActiveLocale(),
): string {
  try {
    return new Intl.NumberFormat(tag(locale), options).format(value);
  } catch {
    return String(value);
  }
}

/** Hook form: re-renders when the language changes. */
export function useFormatters() {
  const locale = useAppLocale();
  return {
    locale,
    formatDate: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) => formatDate(v, o, locale),
    formatTime: (v: Date | string | number) => formatTime(v, locale),
    formatClock: (v: string | null | undefined) => formatClock(v, locale),
    formatNumber: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, o, locale),
  };
}
