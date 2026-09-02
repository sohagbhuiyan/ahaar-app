import { memo } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import type { MenuItem } from '@/lib/api/types/catalog';
import { shadows } from '@/lib/theme';
import { cn, formatMoney } from '@/lib/utils';
import { FOOD_BLURHASH } from '@/lib/constants/images';

interface Props {
  item: MenuItem;
  onPress?: (item: MenuItem) => void;
  /** Trailing control — a quantity stepper or "Add" button. */
  action?: React.ReactNode;
  /** No remaining kitchen capacity for the chosen date. */
  soldOut?: boolean;
  layout?: 'grid' | 'row';
  className?: string;
}

/** Neutral grey placeholder — no flash of brand colour behind every image. */

/**
 * Menu-item card, in a full-width row or a grid tile.
 *
 * `memo`'d because it renders inside FlashList: without it, every parent
 * re-render (a filter change, a refetch) re-renders every visible row.
 */
function FoodCardComponent({
  item,
  onPress,
  action,
  soldOut = false,
  layout = 'row',
  className,
}: Props) {
  const isRow = layout === 'row';

  // `is_free` is undefined until the backend ships the flag — only badge an
  // add-on as free when it's explicitly true, never by inferring from price.
  const freeAddon = item.is_addon && item.is_free === true;

  const content = (
    <>
      <View
        className={cn(
          'overflow-hidden bg-surface-muted',
          isRow ? 'h-20 w-20 rounded-2xl' : 'h-32 w-full rounded-2xl',
        )}
      >
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={200}
            // Both caches: survives scroll-away and app restart.
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={item.name}
          />
        ) : null}

        {soldOut ? (
          <View className="absolute inset-0 items-center justify-center bg-black/45">
            <Text className="text-[11px] font-bold uppercase text-text-inverse">
              Sold out
            </Text>
          </View>
        ) : null}
      </View>

      <View className={cn('flex-1', isRow ? 'ml-3' : 'mt-3')}>
        <View className="flex-row items-start justify-between gap-2">
          <Text
            numberOfLines={isRow ? 1 : 2}
            className="flex-1 text-sm font-bold text-text-primary"
          >
            {item.name}
          </Text>

          {freeAddon ? <Badge label="Free" variant="free" /> : null}
        </View>

        {item.description ? (
          <Text numberOfLines={isRow ? 1 : 2} className="mt-0.5 text-xs text-text-secondary">
            {item.description}
          </Text>
        ) : null}

        {item.dietary_tags.length > 0 ? (
          <View className="mt-1.5 flex-row flex-wrap gap-1">
            {item.dietary_tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                // Backend stores snake_case ("high_protein").
                label={tag.replace(/_/g, ' ')}
                variant="muted"
              />
            ))}
          </View>
        ) : null}

        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-sm font-bold text-brand-500">
            {freeAddon ? 'Free' : formatMoney(item.base_price)}
          </Text>

          {action}
        </View>
      </View>
    </>
  );

  const containerClass = cn(
    'rounded-3xl border border-border bg-surface p-3',
    isRow ? 'flex-row items-center' : 'flex-col',
    soldOut && 'opacity-70',
    className,
  );

  if (!onPress) {
    return (
      <View className={containerClass} style={shadows.card}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={() => onPress(item)}
      className={cn(containerClass, 'active:opacity-90')}
      style={shadows.card}
    >
      {content}
    </Pressable>
  );
}

export const FoodCard = memo(FoodCardComponent);
