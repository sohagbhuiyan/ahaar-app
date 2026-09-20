import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * The AHAAR logo, cropped to its artwork.
 *
 * `ahaar2.png` (the app icon and splash art) carries wide transparent margins
 * so it sits well on a splash screen; at header size those margins would shrink
 * the wordmark to an unreadable smudge. This crop is the same artwork with the
 * margins removed, so a given `height` is all logo.
 */
const LOGO = require('@/assets/images/brand/ahaar-logo.png');

/** ahaar-logo.png is 378 × 245. */
const ASPECT_RATIO = 378 / 245;

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
