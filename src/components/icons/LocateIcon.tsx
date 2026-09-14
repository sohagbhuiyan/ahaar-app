import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number };

/** Crosshair — "use my current location". */
export default function LocateIcon({ color, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={7} stroke={c} strokeWidth={1.8} />
      <Circle cx={12} cy={12} r={2.5} fill={c} />
      <Path
        d="M12 2V5M12 19V22M2 12H5M19 12H22"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
