import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * The AHAAR logo, cropped to its artwork.
 *
 * The "A" mark plus the "AHAAR · FOOD CATERING" wordmark on transparency,
 * trimmed tight to the artwork (no margins), so a given `height` is all logo.
 * Re-run `node scripts/build-splash-plate.js` whenever this file changes.
 */
const LOGO = require('@/assets/images/brand/ahaar-logo.png');

/** Pixel size of ahaar-logo.png — the file is all artwork, no margin. */
export const LOGO_SIZE = { width: 890, height: 369 } as const;
const ASPECT_RATIO = LOGO_SIZE.width / LOGO_SIZE.height;

interface Props {
  /** Rendered height in points; the width follows the artwork's proportions. */
  height?: number;
  style?: StyleProp<ImageStyle>;
  /** Fired once the artwork has drawn — the splash hands over on this. */
  onLoadEnd?: () => void;
}

/**
 * One component for every place the brand appears — the Home header, sign-in,
 * registration — so its size and proportions stay consistent across the app.
 */
export function AhaarLogo({ height = 40, style, onLoadEnd }: Props) {
  return (
    <Image
      source={LOGO}
      accessibilityRole="image"
      accessibilityLabel="Ahaar"
      resizeMode="contain"
      fadeDuration={0}
      onLoadEnd={onLoadEnd}
      style={[{ height, width: Math.round(height * ASPECT_RATIO) }, style]}
    />
  );
}
