import { Pressable, Text, View } from 'react-native';

import ChevronDownIcon from '@/components/icons/ChevronDownIcon';
import PinIcon from '@/components/icons/PinIcon';
import { Skeleton } from '@/components/ui';
import { countryRules, isSupportedCountry } from '@/lib/location/countries';
import type { CurrentLocation } from '@/lib/query/hooks/useLocation';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
  location: Pick<CurrentLocation, 'source' | 'title' | 'isLoading'> & { country?: string | null };
  onPress: () => void;
  /**
   * `bar` is the slim sticky strip at the top of Home, flush under the safe
   * area; `card` is the bordered block used inside a screen.
   */
  variant?: 'card' | 'bar';
  className?: string;
}

/**
 * "Deliver to 🇸🇦 Home · Al Olaya, Riyadh".
 *
 * Always tappable, whatever state it is in: loading, unset or set, the answer
 * to "where does my food go?" is one tap from changing.
 */
export function LocationPill({ location, onPress, variant = 'card', className }: Props) {
  const hasLocation = location.source !== null && location.title !== '';
  const flag = hasLocation && isSupportedCountry(location.country) ? countryRules(location.country).flag : null;
  const title = hasLocation ? location.title : 'Set delivery location';

  const accessibilityLabel = location.isLoading
    ? 'Delivery location, loading'
    : hasLocation
      ? `Delivering to ${location.title}. Change location`
      : 'Set delivery location';

  if (variant === 'bar') {
    return (
      <Pressable
        testID="location-pill"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={cn(
          'flex-row items-center gap-2.5 bg-surface px-4 py-2 active:bg-surface-muted',
          className,
        )}
      >
        <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
          <PinIcon color={colors.brand[500]} size={16} filled={hasLocation} />
        </View>

        <View className="flex-1">
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Deliver to
          </Text>
          {location.isLoading ? (
            <View testID="location-pill-loading">
              <Skeleton className="mt-1 h-4 w-44" />
            </View>
          ) : (
            <View className="flex-row items-center gap-1">
              <Text
                numberOfLines={1}
                className={cn(
                  'shrink text-sm font-bold',
                  hasLocation ? 'text-text-primary' : 'text-brand-500',
                )}
              >
                {flag ? `${flag} ` : ''}
                {title}
              </Text>
              <ChevronDownIcon color={colors.text.primary} size={14} />
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID="location-pill"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 active:bg-surface-muted',
        className,
      )}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
        <PinIcon color={colors.brand[500]} size={18} filled={hasLocation} />
      </View>

      <View className="flex-1">
        <Text className="text-xs text-text-muted">Deliver to</Text>
        {location.isLoading ? (
          <View testID="location-pill-loading">
            <Skeleton className="mt-1 h-4 w-40" />
          </View>
        ) : (
          <Text
            numberOfLines={1}
            className={cn('text-sm font-bold', hasLocation ? 'text-text-primary' : 'text-brand-500')}
          >
            {flag ? `${flag} ` : ''}
            {title}
          </Text>
        )}
      </View>

      <Text className="text-xs font-bold text-brand-500">{hasLocation ? 'Change' : 'Set'}</Text>
      <ChevronDownIcon color={colors.text.muted} size={16} />
    </Pressable>
  );
}
