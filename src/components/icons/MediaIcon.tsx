import { ColorValue } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = { color: ColorValue; filled?: boolean; size?: number };

/** A screen with a play mark — the Media (kitchen videos) tab. */
export default function MediaIcon({ color, filled = false, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {filled ? (
        <>
          <Rect x="2.5" y="4.5" width="19" height="15" rx="3.5" fill={c} />
          <Path d="M10 9.2v5.6c0 .5.55.8.97.54l4.4-2.8a.64.64 0 0 0 0-1.08l-4.4-2.8A.64.64 0 0 0 10 9.2z" fill="#fff" />
        </>
      ) : (
        <>
          <Rect x="2.5" y="4.5" width="19" height="15" rx="3.5" stroke={c} strokeWidth={1.8} />
          <Path
            d="M10 9.2v5.6c0 .5.55.8.97.54l4.4-2.8a.64.64 0 0 0 0-1.08l-4.4-2.8A.64.64 0 0 0 10 9.2z"
            stroke={c}
            strokeWidth={1.6}
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}
