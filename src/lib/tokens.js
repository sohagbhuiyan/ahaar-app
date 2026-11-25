/**
 * AHAAR design tokens — the single source of truth for colour in this app.
 *
 * Written as CommonJS on purpose: `tailwind.config.js` requires it at build
 * time, and TypeScript imports it through `theme.ts` (Expo's tsconfig sets
 * `allowJs` + `esModuleInterop`). One file, two consumers, no drift.
 *
 * Palette: AHAAR ui-design.md §2 (shared with the website's `--ahaar-*` CSS
 * variables in `ahaar/src/app/globals.css`). The brand ramp is anchored at
 * 500 = Primary #EA580C; 400 = Secondary #F97316; 300 = Accent #FDBA74;
 * 200 = Border #FED7AA; 50 = Background #FFF7ED. Orange marks actions and
 * selected states — screens stay warm off-white with white cards.
 *
 * Contrast: white on brand-500 is ~3.6:1 — fine for bold/large button labels,
 * not for small body copy. Small orange text on white uses brand-700.
 */

const brand = {
  50: '#fff7ed', // Background
  100: '#ffedd5',
  200: '#fed7aa', // Border
  300: '#fdba74', // Accent
  400: '#f97316', // Secondary
  500: '#ea580c', // Primary   ← anchor
  600: '#d9480f',
  700: '#c2410c', // pressed / small orange text on white
  800: '#9a3412',
  900: '#7c2d12',
};

/**
 * Secondary accent (kept as a named group for components that alternate two
 * accents, e.g. plan cards).
 */
const accent = {
  orange: '#f97316',
  orangeDark: '#ea580c',
  orangeSoft: '#fff1e6',
  soft: '#fdba74',
};

const surface = {
  DEFAULT: '#ffffff', // Surface — cards, sheets, panels
  secondary: '#ffedd5', // tinted cards / selected chips
  muted: '#fff7ed', // Background — warm screen background
  cream: '#ffffff', // plan cards
};

const text = {
  primary: '#1f1f1f', // Text
  secondary: '#6b5e55',
  muted: '#8c7f75',
  inverse: '#ffffff',
};

const border = {
  DEFAULT: '#fed7aa', // Border
  strong: '#eadbcd',
  cream: '#fed7aa', // plan cards
};

/** Semantic status colours (ui-design.md §2) — never the brand orange. */
const status = {
  success: '#16a34a', // Online / Success
  successSoft: '#f0fdf4',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  danger: '#dc2626', // Error
  dangerSoft: '#fef2f2',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  disabled: '#94a3b8', // Offline / Disabled
};

module.exports = { brand, surface, text, border, status, accent };
