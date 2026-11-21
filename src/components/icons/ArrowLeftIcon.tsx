import { ColorValue, I18nManager } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = {
  color: ColorValue;
  size?: number;
  /**
   * Mirror in RTL (default). A "back" arrow points toward the reading start,
   * which is right in Arabic. Pass `false` only for a physical direction.
   */
  flipInRtl?: boolean;
};

export default function ArrowLeftIcon({ color, size = 20, flipInRtl = true }: Props) {
  const c = color as string;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ scaleX: flipInRtl && I18nManager.isRTL ? -1 : 1 }] }}
    >
      <Path
        d="M19 12H5M11 6L5 12L11 18"
        stroke={c}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
