import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

type Props = { width?: number; height?: number };

/**
 * Generic avatar illustration for the profile/menu screen
 */
export default function AvatarIllustration({ width = 64, height = 64 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 64 64" fill="none">
      {/* Head */}
      <Circle cx="32" cy="22" r="14" fill="#fff" fillOpacity={0.9} />

      {/* Eyes */}
      <Circle cx="26" cy="21" r="2" fill="#ff2b85" />
      <Circle cx="38" cy="21" r="2" fill="#ff2b85" />

      {/* Smile */}
      <Path
        d="M26 27 Q32 32 38 27"
        stroke="#ff2b85"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />

      {/* Body / shoulders */}
      <Path
        d="M10 60 Q12 46 32 46 Q52 46 54 60"
        fill="#fff"
        fillOpacity={0.75}
      />

      {/* Hair */}
      <Path
        d="M18 18 Q18 8 32 8 Q46 8 46 18 Q44 12 32 12 Q20 12 18 18Z"
        fill="#d4006b"
        fillOpacity={0.7}
      />
    </Svg>
  );
}