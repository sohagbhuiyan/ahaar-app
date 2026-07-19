import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function HomeIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <Path
          d="M3 9.5L12 2L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          fill={c}
        />
      ) : (
        <Path
          d="M3 9.5L12 2L21 9.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V9.5Z"
          stroke={c}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}