/**
 * Image placeholders.
 *
 * A blurhash is not free-form: its first character encodes the component grid,
 * which fixes the exact string length the rest must have. `expo-image` checks
 * that and **throws** a `ValidationError` when it doesn't match, which is not a
 * broken thumbnail — it is an unhandled render error that takes the whole
 * screen down through the error boundary.
 *
 * The promo carousel shipped a 24-character hash behind an `L` prefix, which
 * demands 28, so Home crashed for anyone whose CMS had a banner with an image.
 * Both values live here now so the constraint is stated once and every screen
 * shares a checked value rather than a copy-pasted literal.
 *
 * Length rule, for anyone adding one: with `flag` = base83 value of the first
 * character, `numY = ⌊flag / 9⌋ + 1`, `numX = flag % 9 + 1`, and the string must
 * be exactly `4 + 2 · numX · numY` characters. `L` is 21 → 4×3 components → 28.
 */

/** Warm neutral, 4×3 components — dishes, plans and other portrait-ish art. */
export const FOOD_BLURHASH = 'L4O|b2~qRj%M?bofofj[00WBt7WB';

/** Flat light wash for wide banner art, where detail would only distract. */
export const BANNER_BLURHASH = 'L3B|WA00~q00~q00~q00~q00~q00';
