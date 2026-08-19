import Svg, { Circle, Path, Ellipse, Rect } from 'react-native-svg';

type Props = { width?: number; height?: number };

/**
 * Abstract food delivery scooter illustration
 * Used in the Home hero banner
 */
export default function BannerIllustration({ width = 130, height = 100 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 130 100" fill="none">
      {/* Delivery bag */}
      <Rect x="40" y="20" width="50" height="40" rx="8" fill="#fff" fillOpacity={0.25} />
      <Rect x="50" y="12" width="30" height="12" rx="4" fill="#fff" fillOpacity={0.3} />
      {/* Bag stripes */}
      <Path d="M48 35H82M48 44H82" stroke="#fff" strokeOpacity={0.4} strokeWidth={2} strokeLinecap="round" />
      {/* Scooter body */}
      <Path
        d="M20 72 Q30 55 55 60 L75 60 Q90 58 95 72"
        stroke="#fff"
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        strokeOpacity={0.4}
      />
      {/* Wheels */}
      <Circle cx="30" cy="76" r="10" fill="#fff" fillOpacity={0.2} stroke="#fff" strokeWidth={2.5} strokeOpacity={0.4} />
      <Circle cx="90" cy="76" r="10" fill="#fff" fillOpacity={0.2} stroke="#fff" strokeWidth={2.5} strokeOpacity={0.4} />
      <Circle cx="30" cy="76" r="4" fill="#fff" fillOpacity={0.35} />
      <Circle cx="90" cy="76" r="4" fill="#fff" fillOpacity={0.35} />
      {/* Speed lines */}
      <Path d="M6 58H18M4 64H14M8 70H16" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeOpacity={0.3} />
    </Svg>
  );
}