import { memo } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Badge, Button, Card } from '@/components/ui';
import type { FoodPackage } from '@/lib/api/types/package';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { cn, formatMoney } from '@/lib/utils';

interface Props {
  pkg: FoodPackage;
  onPress?: (pkg: FoodPackage) => void;
  /** Adds the box straight to the basket. Omit for a read-only card. */
  onAdd?: (pkg: FoodPackage) => void;
  className?: string;
}

/**
 * One bundle, as a storefront card — the mobile counterpart of the website's
 * `PackageCard`.
 *
 * Leads with what is inside. A bundle's name ("Chicken Meal Box") does not say
 * what arrives, and the saving against the same dishes bought separately is the
 * reason to choose one, so both are on the card rather than a tap away.
 */
function PackageCardComponent({ pkg, onPress, onAdd, className }: Props) {
  const alaCarte = pkg.a_la_carte_price ?? 0;
  // Only a real saving earns a badge. A box sized for several people can
  // legitimately cost more than one portion of each dish.
  const saving = alaCarte > pkg.price ? alaCarte - pkg.price : 0;
  const contents = pkg.items ?? [];

  return (
    <Card onPress={onPress ? () => onPress(pkg) : undefined} className={cn(className)}>
      <View className="h-32 w-full bg-surface-muted">
        {pkg.image_url ? (
          <Image
            source={{ uri: pkg.image_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
            accessibilityLabel={pkg.name}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-brand-50">
            <Text className="text-3xl">🍱</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <Text numberOfLines={1} className="text-base font-bold text-text-primary">
              {pkg.name}
            </Text>
            <Text className="mt-0.5 text-[11px] font-semibold uppercase text-text-muted">
              Meal box · {contents.length} {contents.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {saving > 0 ? (
            <Badge label={`Save ${formatMoney(saving)}`} variant="paid" />
          ) : null}
        </View>

        {contents.length > 0 ? (
          <View className="mt-2.5 gap-1">
            {contents.slice(0, 3).map((item) => (
              <View key={item.menu_item_id} className="flex-row items-center gap-2">
                <View className="h-1 w-1 rounded-full bg-brand-300" />
                <Text numberOfLines={1} className="flex-1 text-xs text-text-secondary">
                  {item.quantity > 1 ? (
                    <Text className="font-bold">{item.quantity}× </Text>
                  ) : null}
                  {item.name}
                </Text>
              </View>
            ))}
            {contents.length > 3 ? (
              <Text className="ml-3 text-xs text-text-muted">
                + {contents.length - 3} more
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="mt-3 flex-row items-end gap-2">
          <Text className="text-xl font-bold text-brand-500">
            {formatMoney(pkg.price)}
          </Text>
          {saving > 0 ? (
            <Text className="mb-0.5 text-xs text-text-muted line-through">
              {formatMoney(alaCarte)}
            </Text>
          ) : null}
        </View>

        {onAdd ? (
          <Button
            label="Add to order"
            size="sm"
            className="mt-3"
            onPress={() => onAdd(pkg)}
          />
        ) : null}
      </View>
    </Card>
  );
}

export const PackageCard = memo(PackageCardComponent);
