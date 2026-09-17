import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface Props extends Omit<PressableProps, 'style'> {
  /** Sizing, spacing and shape. Applied to the animated outer view. */
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** Classes for the inner press target, when it needs its own layout. */
  contentClassName?: string;
  /** How far the surface sinks while held. */
  pressedScale?: number;
}

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

/**
 * A press target that sinks slightly under the thumb and springs back.
 *
 * The tactile cue a flat opacity change doesn't give: a card that responds to
 * the press reads as a physical thing, which is most of what makes a list feel
 * native rather than web-like. Runs on the UI thread, so it keeps up while JS
 * is busy navigating. Honours the system "reduce motion" setting.
 *
 * The scale lives on an outer `Animated.View` and the press on an inner
 * `Pressable`, because NativeWind styles Reanimated's own views but not an
 * animated `Pressable` — so layout classes go on the outside.
 */
export function PressableScale({
  className,
  style,
  contentClassName,
  pressedScale = 0.97,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  // `get`/`set` rather than `.value`: the React Compiler treats a hook's return
  // as immutable and rejects assigning to its properties.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View className={className} style={[style, animatedStyle]}>
      <Pressable
        {...rest}
        className={contentClassName}
        onPressIn={(event) => {
          if (!reduceMotion) scale.set(withSpring(pressedScale, SPRING));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withSpring(1, SPRING));
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
