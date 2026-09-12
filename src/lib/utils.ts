/**
 * Shared formatting and class-name helpers.
 *
 * `cn` matches the web app's utility of the same name so components port
 * across with no rewriting.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, with later Tailwind utilities winning over earlier
 * conflicting ones. NativeWind resolves a `className` string through the same
 * Tailwind rules, so conflict resolution matters here exactly as it does on web
 * (`"p-4"` + `"p-2"` must end up `p-2`, not both).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** The only currency this app displays. See `formatMoney`. */
export const CURRENCY_CODE = 'SAR';

/**
 * Format money for display. Always Saudi Riyal.
 *
 * ── Why no `style: 'currency'` ──────────────────────────────────────────────
 * That is what emits a *symbol* — €, $, or ﷼ — chosen by the runtime from the
 * currency code and the device locale. Building the string here instead
 * guarantees the literal prefix "SAR" on every device, which is what the
 * storefront is specified to show, and makes it impossible for a symbol to
 * reappear because some payload said "EUR".
 *
 * ── Why the API's `currency` field is ignored ───────────────────────────────
 * The backend's `config('payments.currency')` is EUR, so every payload says
 * `"currency":"EUR"`. Ahaar sells in Saudi Arabia and both the web app and this
 * one present SAR, so display is pinned to SAR and the payload's value is kept
 * only as data (see `FALLBACK_CURRENCY` in `api/normalize.ts`). Note this means
 * the displayed currency and the *charged* currency disagree until the backend
 * config is changed — a backend concern, not a formatting one.
 *
 * Digits: whole amounts render as `SAR 50`, fractional ones keep both decimals
 * (`SAR 4.50`), so a price is never silently rounded away.
 *
 * The locale is pinned to `en-US` rather than the device's: an Arabic locale
 * would otherwise render Arabic-Indic digits (٥٠) beside a Latin "SAR".
 */
export function formatMoney(amount: number | string | null | undefined): string {
  const parsed = typeof amount === 'string' ? Number.parseFloat(amount) : (amount ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;

  // A tolerance, not `% 1 !== 0` — 4.5 * 3 is 13.500000000000002 in binary
  // floating point, and that must still render as "SAR 13.50".
  const fractionDigits = Math.abs(safe % 1) > 0.005 ? 2 : 0;

  let formatted: string;
  try {
    formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(safe);
  } catch {
    // A runtime without full ICU still has to produce something sane.
    formatted = safe.toFixed(fractionDigits);
  }

  return `${CURRENCY_CODE} ${formatted}`;
}

/** "Mon, 14 Aug" — the compact form used on delivery cards and day tabs. */
export function formatShortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return isoDate;
  }
}

/** "14 August 2026" — for detail screens and summaries. */
export function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  try {
    return new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch {
    return isoDate;
  }
}

/** A `Date` as YYYY-MM-DD in the device's timezone. */
export function toISODate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/**
 * Today (or `offsetDays` from it) as YYYY-MM-DD, in local time.
 *
 * Deliberately not `toISOString()`, which is UTC and lands on the wrong day
 * either side of midnight for anyone ahead of or behind it.
 */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

/**
 * ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday.
 *
 * This is the `day_number` the backend serves that date's menu from. Parsed at
 * UTC midnight so the answer never shifts with the device's timezone.
 */
export function isoWeekdayForDate(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 1;
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

/** Whether a YYYY-MM-DD date is today, in the device's timezone. */
export function isToday(isoDate: string): boolean {
  return isoDate === todayISO();
}

/**
 * "Just now", "5m ago", "3h ago", "2d ago", then a short date — for comment
 * timestamps, where how recent something is matters more than the exact time.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const minutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatShortDate(toISODate(date));
}
