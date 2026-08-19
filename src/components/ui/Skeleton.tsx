import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * Shimmer placeholder for first-load states.
 *
 * Skeletons rather than spinners on list screens: they reserve the right
 * amount of space, so content doesn't jump when it lands, and they read as
 * "this is nearly here" instead of "something is happening somewhere".
 *
 * Animated on the UI thread via Reanimated, so it keeps moving smoothly even
 * while JS is busy parsing the response that will replace it.
 */
export function Skeleton({ className }: Props) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1, // forever
      true, // reverse each cycle
    );

    return () => cancelAnimation(opacity);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={style}
      className={cn('rounded-2xl bg-surface-muted', className)}
    />
  );
}

/** Stacked lines approximating a paragraph. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <View className={cn('gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          // Last line short, like real wrapped text.
          className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </View>
  );
}

/** Matches the footprint of a `FoodCard` so the swap is visually stable. */
export function SkeletonCard({ className }: Props) {
  return (
    <View
      className={cn(
        'rounded-3xl bg-surface border border-border p-4 gap-3',
        className,
      )}
    >
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </View>
  );
}
