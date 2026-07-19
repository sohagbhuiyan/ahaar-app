import { ColorValue } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function PlansIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3" y="4" width="18" height="17" rx="3"
        stroke={c} strokeWidth={1.8}
        fill={filled ? c : 'none'} fillOpacity={filled ? 0.15 : 0}
      />
      <Path d="M3 9H21" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M8 2V5M16 2V5" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M7 13H11M7 17H14" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}