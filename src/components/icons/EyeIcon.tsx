import { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number; /** Draws the slashed "hidden" eye. */ off?: boolean };

export default function EyeIcon({ color, size = 20, off = false }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12C4.3 7.9 7.9 5.5 12 5.5C16.1 5.5 19.7 7.9 21.5 12C19.7 16.1 16.1 18.5 12 18.5C7.9 18.5 4.3 16.1 2.5 12Z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={1.8} />
      {off ? (
        <Path d="M4 4L20 20" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}
