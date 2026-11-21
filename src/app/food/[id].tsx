import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { FoodImage, MediaGallery, ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Separator,
  Skeleton,
  SkeletonText,
  Stepper,
} from '@/components/ui';
import { isNotFound } from '@/lib/api/types/common';
import { allergenLabelKey, dietTagLabelKey, humanise } from '@/lib/constants/diet';
import { useFood } from '@/lib/query/hooks';
import { useInstantOrderStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';


/**
 * A single catalogue item.
 *
 * Public — `GET /menu-items/{id}` needs no session, and neither does adding to
 * the basket, which is local state. The account question is asked once, at
 * checkout, by `/order`.
 */
export default function FoodDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    toast.success(t('catalog.addedToast', { name: item.name }));
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
        {isNotFound(error) ? (
          <EmptyState
            title={t('catalog.food.notFoundTitle')}
            description={t('catalog.food.notFoundDescription')}
            actionLabel={t('catalog.food.browseMenu')}
            onAction={() => router.replace('/(tabs)/foods')}
            className="flex-1 justify-center"
          />
        ) : (
          <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
        )}
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
        {/* Pictures and video when the admin added them; otherwise the single
            cover exactly as before. */}
        <MediaGallery
          images={item.gallery}
          video={item.video}
          label={item.name}
          className="h-56 rounded-3xl"
          fallback={
            <FoodImage
              uri={item.image_url}
              label={item.name}
              glyphSize="lg"
              className="h-56 w-full rounded-3xl"
            />
          }
        />

        <View className="mt-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-text-primary">{item.name}</Text>
            {item.category ? (
              <Text className="mt-0.5 text-sm text-text-muted">
                {item.category.name}
              </Text>
            ) : null}
          </View>

          {item.is_addon ? <Badge label={t('catalog.food.addon')} variant="brand" /> : null}
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
                  <Text className="text-sm font-bold text-text-primary">
                    {t('catalog.food.dietary')}
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {item.dietary_tags.map((tag) => (
                      <Badge
                        key={tag}
                        label={t(dietTagLabelKey(tag), { defaultValue: humanise(tag) })}
                        variant="free"
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {item.dietary_tags.length > 0 && item.allergens.length > 0 ? (
                <Separator className="my-4" />
              ) : null}

              {item.allergens.length > 0 ? (
                <>
                  <Text className="text-sm font-bold text-text-primary">
                    {t('catalog.food.allergens')}
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {item.allergens.map((allergen) => (
                      <Badge
                        key={allergen}
                        label={t(allergenLabelKey(allergen), { defaultValue: humanise(allergen) })}
                        variant="warning"
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Text className="mt-5 text-xs text-text-muted">
          {t('catalog.food.oneOffHint')}
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
                label={t('catalog.quantityOf', { name: item.name })}
                onChange={(next) => setQuantity(item.id, next)}
              />
            </View>

            <Button
              label={t('catalog.goToBasket')}
              size="lg"
              className="flex-1"
              fullWidth={false}
              onPress={() => router.push('/order')}
            />
          </View>
        ) : (
          <Button label={t('catalog.addToBasket')} size="lg" onPress={add} />
        )}
      </View>
    </SafeAreaView>
  );
}
