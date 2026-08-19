import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Separator,
  Skeleton,
  SkeletonText,
  Stepper,
} from '@/components/ui';
import { useFood } from '@/lib/query/hooks';
import { useInstantOrderStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';

const BLURHASH = 'L4O|b2~qRj%M?bofofj[00WBt7WB';

/**
 * A single catalogue item.
 *
 * Public — `GET /menu-items/{id}` needs no session, and neither does adding to
 * the basket, which is local state. The account question is asked once, at
 * checkout, by `/order`.
 */
export default function FoodDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading, isError, error, refetch } = useFood(id);

  const lines = useInstantOrderStore((s) => s.lines);
  const addLine = useInstantOrderStore((s) => s.add);
  const setQuantity = useInstantOrderStore((s) => s.setQuantity);

  const quantity = item
    ? (lines.find((l) => l.menu_item_id === item.id)?.quantity ?? 0)
    : 0;

  const add = () => {
    if (!item) return;
    addLine({
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.base_price,
      image_url: item.image_url,
    });
    toast.success(`${item.name} added`);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader />
        <View className="gap-4 px-5">
          <Skeleton className="h-56 w-full" />
          <SkeletonText lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !item) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={item.name} subtitle={item.category?.name} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="h-56 w-full overflow-hidden rounded-3xl bg-surface-muted">
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              placeholder={{ blurhash: BLURHASH }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityLabel={item.name}
            />
          ) : null}
        </View>

        <View className="mt-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-text-primary">{item.name}</Text>
            {item.category ? (
              <Text className="mt-0.5 text-sm text-text-muted">
                {item.category.name}
              </Text>
            ) : null}
          </View>

          {item.is_addon ? <Badge label="Add-on" variant="brand" /> : null}
        </View>

        <Text className="mt-3 text-xl font-bold text-brand-500">
          {formatMoney(item.base_price)}
        </Text>

        {item.description ? (
          <Text className="mt-3 text-sm leading-5 text-text-secondary">
            {item.description}
          </Text>
        ) : null}

        {item.dietary_tags.length > 0 || item.allergens.length > 0 ? (
          <Card className="mt-5">
            <View className="p-5">
              {item.dietary_tags.length > 0 ? (
                <>
                  <Text className="text-sm font-bold text-text-primary">Dietary</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {item.dietary_tags.map((tag) => (
                      <Badge key={tag} label={tag.replace(/_/g, ' ')} variant="free" />
                    ))}
                  </View>
                </>
              ) : null}

              {item.dietary_tags.length > 0 && item.allergens.length > 0 ? (
                <Separator className="my-4" />
              ) : null}

              {item.allergens.length > 0 ? (
                <>
                  <Text className="text-sm font-bold text-text-primary">Allergens</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {item.allergens.map((allergen) => (
                      <Badge key={allergen} label={allergen} variant="warning" />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Text className="mt-5 text-xs text-text-muted">
          Order this on its own for any day whose meal time is still open — no
          subscription needed.
        </Text>
      </ScrollView>

      {/* Sticky action bar: the decision this screen exists to support. */}
      <View className="border-t border-border px-5 pb-6 pt-4">
        {quantity > 0 ? (
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-3 rounded-2xl border border-border px-4 py-2">
              <Stepper
                value={quantity}
                min={1}
                label={`${item.name} quantity`}
                onChange={(next) => setQuantity(item.id, next)}
              />
            </View>

            <Button
              label="Go to basket"
              size="lg"
              className="flex-1"
              fullWidth={false}
              onPress={() => router.push('/order')}
            />
          </View>
        ) : (
          <Button label="Add to basket" size="lg" onPress={add} />
        )}
      </View>
    </SafeAreaView>
  );
}
