import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number };

export default function SearchIcon({ color, size = 20 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={c} strokeWidth={1.8} />
      <Path d="M16 16L20 20" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
