import { ColorValue } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

export default function FoodsIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          {/* Bowl filled */}
          <Path
            d="M4 11C4 11 4 17 12 17C20 17 20 11 20 11H4Z"
            fill={c}
          />
          <Ellipse cx="12" cy="11" rx="8" ry="2.5" fill={c} />
          <Path
            d="M12 17V20M9 20H15"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          {/* Steam */}
          <Path
            d="M9 7C9 7 9.5 5.5 9 4M12 7C12 7 12.5 5.5 12 4M15 7C15 7 15.5 5.5 15 4"
            stroke={c}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <Path
            d="M4 11C4 11 4 17 12 17C20 17 20 11 20 11H4Z"
            stroke={c}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Ellipse
            cx="12"
            cy="11"
            rx="8"
            ry="2.5"
            stroke={c}
            strokeWidth={1.8}
            fill="none"
          />
          <Path
            d="M12 17V20M9 20H15"
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Path
            d="M9 7C9 7 9.5 5.5 9 4M12 7C12 7 12.5 5.5 12 4M15 7C15 7 15.5 5.5 15 4"
            stroke={c}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}