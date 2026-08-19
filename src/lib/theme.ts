/**
 * Typed runtime access to the design tokens.
 *
 * NativeWind `className` is the default way to style in this app — reach for
 * this module only where a colour must be handed to something that isn't a
 * styled element: navigation options (`tabBarActiveTintColor`), SVG icon
 * `color` props, `StatusBar`, shadow colours, and the toast theme.
 *
 * The values themselves live in `tokens.js`, which Tailwind also consumes.
 */
import tokens from './tokens.js';

export const colors = tokens;

export type BrandShade = keyof typeof tokens.brand;

/**
 * Shadows. React Native needs iOS (`shadow*`) and Android (`elevation`) props
 * rather than a single CSS box-shadow, so the web's `--shadow-card` /
 * `--shadow-pink` are expressed here as style objects.
 */
export const shadows = {
  /** --shadow-card: 0 2px 12px rgba(0,0,0,0.06) */
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** --shadow-card-hover: 0 6px 24px rgba(255,43,133,0.12) */
  cardRaised: {
    shadowColor: tokens.brand[500],
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  /** --shadow-pink: 0 4px 24px rgba(255,43,133,0.25) */
  brand: {
    shadowColor: tokens.brand[500],
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

/** Radii mirroring the Tailwind scale, for the few APIs that need numbers. */
export const radius = {
  md: 8,
  lg: 12,
  xl: 14,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/** Tint pair used by the tab bar and any other navigation-level colouring. */
export const navTint = {
  active: tokens.brand[500],
  inactive: tokens.text.muted,
} as const;
