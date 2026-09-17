import { Text, View, type ViewProps } from 'react-native';

import { shadows } from '@/lib/theme';
import { cn } from '@/lib/utils';

import { PressableScale } from './PressableScale';

interface CardProps extends ViewProps {
  /** Adds the brand-tinted elevation used for the highlighted plan. */
  elevated?: boolean;
  /** Makes the whole card a press target. */
  onPress?: () => void;
  className?: string;
}

/**
 * Surface container.
 *
 * Shadows are the one thing that can't be a `className`: React Native needs
 * `shadow*` on iOS and `elevation` on Android, so they come from the shared
 * `shadows` tokens rather than an ad-hoc inline object.
 *
 * A pressable card sinks slightly under the thumb (`PressableScale`) instead
 * of just dimming, so tapping into a dish, plan or video feels physical.
 */
export function Card({
  elevated = false,
  onPress,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = cn(
    'rounded-3xl bg-surface border border-border overflow-hidden',
    className,
  );
  const style = elevated ? shadows.cardRaised : shadows.card;

  if (onPress) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={rest.accessibilityLabel}
        testID={rest.testID}
        onPress={onPress}
        className={classes}
        style={style}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View className={classes} style={style} {...rest}>
      {children}
    </View>
  );
}

export function CardHeader({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={cn('px-5 pt-5 pb-3', className)} {...rest}>
      {children}
    </View>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Text className={cn('text-lg font-bold text-text-primary', className)}>
      {children}
    </Text>
  );
}

export function CardDescription({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Text className={cn('text-sm text-text-secondary mt-0.5', className)}>
      {children}
    </Text>
  );
}

export function CardContent({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={cn('px-5 pb-5', className)} {...rest}>
      {children}
    </View>
  );
}

export function CardFooter({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View className={cn('px-5 pb-5 pt-2 flex-row items-center gap-3', className)} {...rest}>
      {children}
    </View>
  );
}
