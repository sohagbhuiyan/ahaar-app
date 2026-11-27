import { ColorValue } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = { color: ColorValue; size?: number };

/** Shopping bag — the basket, same glyph family as the website's header icon. */
export default function BagIcon({ color, size = 24 }: Props) {
  const c = color as string;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 7.5h12l-.9 11.2a1.8 1.8 0 0 1-1.8 1.6H8.7a1.8 1.8 0 0 1-1.8-1.6L6 7.5Z"
        stroke={c}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M9 10V6.5a3 3 0 0 1 6 0V10"
        stroke={c}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
