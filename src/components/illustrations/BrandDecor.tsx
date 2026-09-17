import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/**
 * Soft translucent circles for the brand-coloured hero panels.
 *
 * Gives a flat pink block depth without an image or a gradient dependency.
 * Absolutely positioned and non-interactive — drop it in as the first child of
 * any `overflow-hidden` brand surface.
 */
export default function BrandDecor() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMaxYMin slice">
        <Circle cx={370} cy={10} r={110} fill="#ffffff" fillOpacity={0.1} />
        <Circle cx={300} cy={232} r={72} fill="#ffffff" fillOpacity={0.07} />
        <Circle cx={-6} cy={206} r={52} fill="#ffffff" fillOpacity={0.06} />
      </Svg>
    </View>
  );
}
