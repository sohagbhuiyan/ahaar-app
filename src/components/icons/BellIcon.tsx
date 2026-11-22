import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number };

export default function BellIcon({ color, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5Z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
