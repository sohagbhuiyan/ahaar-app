import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function PinIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21C12 21 5 14.9 5 9.6C5 5.9 8.1 3 12 3C15.9 3 19 5.9 19 9.6C19 14.9 12 21 12 21Z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill={filled ? c : 'none'}
      />
      <Circle cx={12} cy={9.6} r={2.4} fill={filled ? '#fff' : 'none'} stroke={filled ? '#fff' : c} strokeWidth={1.6} />
    </Svg>
  );
}
