import { ColorValue } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function MenuIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <Circle cx="12" cy="7" r="4" fill={c} />
          <Path
            d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          {/* Small indicator dot */}
          <Circle cx="18" cy="6" r="2.5" fill="#ff2b85" stroke="#fff" strokeWidth={1} />
        </>
      ) : (
        <>
          <Circle cx="12" cy="7" r="4" stroke={c} strokeWidth={1.8} />
          <Path
            d="M4 20C4 16.686 7.582 14 12 14C16.418 14 20 16.686 20 20"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}