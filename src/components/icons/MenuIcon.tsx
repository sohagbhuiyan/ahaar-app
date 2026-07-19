import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function MenuIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12" cy="8" r="3.5"
        stroke={c} strokeWidth={1.8}
        fill={filled ? c : 'none'} fillOpacity={filled ? 0.2 : 0}
      />
      <Path
        d="M5 20C5 17 8.13 15 12 15C15.87 15 19 17 19 20"
        stroke={c} strokeWidth={1.8} strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}