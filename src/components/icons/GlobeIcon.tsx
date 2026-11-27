import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number };

export default function GlobeIcon({ color, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={c} strokeWidth={1.8} />
      <Path d="M3 12h18" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
