import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function FoodsIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11C4 11 4 17 12 17C20 17 20 11 20 11H4Z"
        stroke={c} strokeWidth={1.8} strokeLinejoin="round"
        fill={filled ? c : 'none'} fillOpacity={filled ? 0.18 : 0}
      />
      <Path
        d="M8 8C8 8 8.5 6.5 8 5M12 8C12 8 12.5 6.5 12 5M16 8C16 8 16.5 6.5 16 5"
        stroke={c} strokeWidth={1.6} strokeLinecap="round"
      />
      <Path d="M6 17H18" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 17L9 19M15 17L15 19" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}