import Svg, { Rect, Circle, Path, Ellipse } from 'react-native-svg';

type Props = { width?: number; height?: number };

/**
 * Three stacked meal containers illustration for the Plans screen
 */
export default function PlanIllustration({ width = 200, height = 120 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 120" fill="none">
      {/* Shadow */}
      <Ellipse cx="100" cy="112" rx="60" ry="6" fill="#ff2b85" fillOpacity={0.08} />

      {/* Container 3 (back) */}
      <Rect x="55" y="50" width="90" height="52" rx="10" fill="#ffdcec" />
      <Rect x="50" y="44" width="100" height="14" rx="7" fill="#ffadcc" />

      {/* Container 2 (mid) */}
      <Rect x="45" y="28" width="110" height="38" rx="10" fill="#ff85b3" fillOpacity={0.6} />
      <Rect x="40" y="22" width="120" height="14" rx="7" fill="#ff6aab" fillOpacity={0.7} />

      {/* Container 1 (front) */}
      <Rect x="35" y="8" width="130" height="36" rx="10" fill="#ff2b85" />
      <Rect x="30" y="2" width="140" height="14" rx="7" fill="#d4006b" />

      {/* Fork & spoon */}
      <Path d="M168 20 L168 55" stroke="#ff2b85" strokeWidth={3} strokeLinecap="round" />
      <Path d="M164 20 Q164 30 168 33 Q172 30 172 20" stroke="#ff2b85" strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M178 20 Q180 28 178 55" stroke="#ff2b85" strokeWidth={3} strokeLinecap="round" fill="none" />
      <Circle cx="178" cy="18" r="4" fill="#ff2b85" />

      {/* Checkmark on top lid */}
      <Path d="M87 9 L95 16 L113 4" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}