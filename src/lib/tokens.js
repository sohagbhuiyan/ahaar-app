/**
 * AHAAR design tokens — the single source of truth for colour in this app.
 *
 * Written as CommonJS on purpose: `tailwind.config.js` requires it at build
 * time, and TypeScript imports it through `theme.ts` (Expo's tsconfig sets
 * `allowJs` + `esModuleInterop`). One file, two consumers, no drift.
 *
 * Values are ported verbatim from the web app's `--ahaar-*` CSS variables in
 * `ahaar/src/app/globals.css` so mobile and web render the same brand. The
 * brand ramp is anchored at 500 = `--ahaar-primary`; 50/400/700 are the web's
 * `--ahaar-primary-soft` / `-light` / `-dark` respectively, and the remaining
 * steps interpolate between them.
 */

const brand = {
  50: '#fff0f7', // --ahaar-primary-soft
  100: '#ffdcec',
  200: '#ffbcd9',
  300: '#ff94c1',
  400: '#ff6aab', // --ahaar-primary-light
  500: '#ff2b85', // --ahaar-primary   ← anchor
  600: '#e60d6c',
  700: '#d4006b', // --ahaar-primary-dark
  800: '#a80055',
  900: '#7a003e',
};

const surface = {
  DEFAULT: '#ffffff', // --ahaar-surface
  secondary: '#fff0f7', // --ahaar-primary-soft (tinted cards)
  muted: '#f9f9f9', // --ahaar-surface-2
};

const text = {
  primary: '#1a1a2e', // --ahaar-text
  secondary: '#6b7280', // --ahaar-text-muted
  muted: '#9ca3af',
  inverse: '#ffffff',
};

const border = {
  DEFAULT: '#f0e0ea', // --ahaar-border
  strong: '#e5e7eb',
};

/**
 * Status colours. The web app leans on Tailwind's emerald/amber palette for
 * these (see PlanMenuSection's "all set" / "incomplete" states) plus
 * `--destructive`; the same hexes are pinned here so a "Free" badge or a
 * "Sold out" pill reads identically on both platforms.
 */
const status = {
  success: '#059669',
  successSoft: '#ecfdf5',
  warning: '#d97706',
  warningSoft: '#fffbeb',
  danger: '#ef4444', // --destructive
  dangerSoft: '#fef2f2',
  info: '#2563eb',
  infoSoft: '#eff6ff',
};

module.exports = { brand, surface, text, border, status };
