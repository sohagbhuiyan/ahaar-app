import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function HomeIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <Path
            d="M3 10.182L12 3L21 10.182V20C21 20.552 20.552 21 20 21H15.5V15.5H8.5V21H4C3.448 21 3 20.552 3 20V10.182Z"
            fill={c}
          />
          {/* Door */}
          <Path
            d="M9.5 21V16.5H14.5V21"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <Path
          d="M3 10.182L12 3L21 10.182V20C21 20.552 20.552 21 20 21H15.5V15.5H8.5V21H4C3.448 21 3 20.552 3 20V10.182Z"
          stroke={c}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill="none"
        />
      )}
    </Svg>
  );
}