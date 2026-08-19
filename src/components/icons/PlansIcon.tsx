import { ColorValue } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function PlansIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <Rect x="3" y="4" width="18" height="17" rx="3" fill={c} />
          <Path
            d="M8 2V5M16 2V5M3 9H21"
            stroke="#fff"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M7 13H12M7 16.5H10"
            stroke="#fff"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="3"
            stroke={c}
            strokeWidth={1.8}
          />
          <Path
            d="M8 2V5M16 2V5M3 9H21"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M7 13H12M7 16.5H10"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}