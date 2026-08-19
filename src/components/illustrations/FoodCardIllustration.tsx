import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

type Props = { width?: number; height?: number };

/**
 * Stylised burger / food bowl SVG used as card image placeholder
 */
export default function FoodCardIllustration({ width = 72, height = 72 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 72 72" fill="none">
      {/* Plate shadow */}
      <Ellipse cx="36" cy="62" rx="22" ry="5" fill="#ff2b85" fillOpacity={0.08} />

      {/* Bun bottom */}
      <Ellipse cx="36" cy="52" rx="20" ry="7" fill="#f9a825" />

      {/* Lettuce */}
      <Path
        d="M16 46 Q20 40 26 43 Q30 38 36 41 Q42 38 46 43 Q52 40 56 46"
        fill="#66bb6a"
        stroke="#66bb6a"
        strokeWidth={0}
      />

      {/* Patty */}
      <Ellipse cx="36" cy="40" rx="19" ry="6" fill="#8d4e1a" />

      {/* Cheese */}
      <Path
        d="M17 37 Q22 32 28 35 Q33 31 36 34 Q39 31 44 35 Q50 32 55 37"
        fill="#ffca28"
      />

      {/* Tomato layer */}
      <Ellipse cx="36" cy="32" rx="17" ry="5" fill="#ef5350" fillOpacity={0.85} />

      {/* Bun top */}
      <Path
        d="M16 30 Q16 12 36 12 Q56 12 56 30 Z"
        fill="#f9a825"
      />
      {/* Bun gloss */}
      <Ellipse cx="32" cy="20" rx="7" ry="4" fill="#fff" fillOpacity={0.2} />

      {/* Sesame seeds */}
      <Ellipse cx="36" cy="16" rx="2.5" ry="1.2" fill="#fff" fillOpacity={0.5} />
      <Ellipse cx="28" cy="20" rx="2" ry="1"   fill="#fff" fillOpacity={0.5} />
      <Ellipse cx="44" cy="20" rx="2" ry="1"   fill="#fff" fillOpacity={0.5} />
    </Svg>
  );
}