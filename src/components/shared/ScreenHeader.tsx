import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
  title?: string;
  subtitle?: string;
  /** Defaults to `router.back()`. Pass `null` to render no back control. */
  onBack?: (() => void) | null;
  /** Right-hand affordance — a basket count, an edit action. */
  right?: React.ReactNode;
  /** Modal-style close label instead of a chevron. */
  variant?: 'back' | 'close';
  className?: string;
}

/**
 * Screen header for the pushed (non-tab) routes.
 *
 * The stack runs with `headerShown: false` so every screen can own its
 * scrolling and safe-area behaviour, which means each one has to supply its own
 * way back. Before this, several didn't — `/profile` and `/subscription` were
 * reachable with no visible exit on Android, where there is no edge-swipe.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  variant = 'back',
  className,
}: Props) {
  const router = useRouter();

  const handleBack =
    onBack === null
      ? null
      : (onBack ??
        (() => {
          // A deep link can land here with nothing behind it.
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)');
        }));

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 border-b border-border px-5 py-3',
        className,
      )}
    >
      {handleBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={variant === 'close' ? 'Close' : 'Go back'}
          onPress={handleBack}
          // Generous hit area: the glyph itself is well under the 44pt minimum.
          hitSlop={12}
          className="h-9 w-9 items-center justify-center rounded-full bg-surface-muted active:opacity-70"
        >
          {variant === 'close' ? (
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 6 6 18M6 6l12 12"
                stroke={colors.text.primary}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 19l-7-7 7-7"
                stroke={colors.text.primary}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          )}
        </Pressable>
      ) : null}

      <View className="flex-1">
        {title ? (
          <Text numberOfLines={1} className="text-base font-bold text-text-primary">
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} className="text-xs text-text-muted">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}
