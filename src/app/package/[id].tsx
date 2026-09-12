import { useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { MediaGallery, OfflineBanner, ScreenHeader } from '@/components/shared';
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
import { usePackage } from '@/lib/query/hooks';
import { FOOD_BLURHASH } from '@/lib/constants/images';
import { MAX_LINE_QUANTITY, useInstantOrderStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';

/**
 * One meal box, in full: what is in it, what it costs, and what the same dishes
 * would cost separately.
 *
 * Public — no session needed to read any of it. Adding to the basket is local,
 * and the sign-in ask waits until the order screen, where money changes hands.
 */
export default function PackageDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: pkg, isLoading, isError, error, refetch } = usePackage(id);
  const addPackage = useInstantOrderStore((s) => s.addPackage);

  const [qty, setQty] = useState(1);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Meal box" />
        <View className="gap-4 p-5">
          <Skeleton className="h-40 w-full" />
          <SkeletonText lines={5} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !pkg) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Meal box" />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const alaCarte = pkg.a_la_carte_price ?? 0;
  const saving = alaCarte > pkg.price ? alaCarte - pkg.price : 0;
  const contents = pkg.items ?? [];

  const addToOrder = () => {
    addPackage(
      {
        package_id: pkg.id,
        name: pkg.name,
        unit_price: pkg.price,
        image_url: pkg.image_url,
        item_count: contents.length,
      },
      qty,
    );
    toast.success(`${pkg.name} added to your order`);
    router.push('/order');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={pkg.name} subtitle={`${contents.length} items`} />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Edge to edge like the cover it replaces; a real gallery gets a
            little more height, since the pictures are the point of it. */}
        <MediaGallery
          images={pkg.gallery}
          video={pkg.video}
          label={pkg.name}
          className="h-56"
          thumbnailsInset={20}
          fallback={
            <View className="h-48 w-full bg-surface-muted">
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
                  <Text className="text-5xl">🍱</Text>
                </View>
              )}
            </View>
          }
        />

        <View className="px-5 pt-5">
          <View className="flex-row items-end gap-2">
            <Text className="text-3xl font-bold text-text-primary">
              {formatMoney(pkg.price)}
            </Text>
            {saving > 0 ? (
              <>
                <Text className="mb-1 text-sm text-text-muted line-through">
                  {formatMoney(alaCarte)}
                </Text>
                <Badge label={`Save ${formatMoney(saving)}`} variant="paid" className="mb-1" />
              </>
            ) : null}
          </View>

          {pkg.description ? (
            <Text className="mt-3 text-sm leading-5 text-text-secondary">
              {pkg.description}
            </Text>
          ) : null}
        </View>

        {/* What's inside */}
        {contents.length > 0 ? (
          <View className="mt-6 px-5">
            <Text className="mb-3 text-lg font-bold text-text-primary">
              What&apos;s inside
            </Text>

            <Card>
              <View className="p-5">
                {contents.map((item, index) => (
                  <View key={item.menu_item_id}>
                    {index > 0 ? <Separator className="my-3" /> : null}
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 overflow-hidden rounded-xl bg-surface-muted">
                        {item.image_url ? (
                          <Image
                            source={{ uri: item.image_url }}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            style={{ width: '100%', height: '100%' }}
                          />
                        ) : null}
                      </View>
                      <Text className="flex-1 text-sm text-text-primary">{item.name}</Text>
                      {item.quantity > 1 ? (
                        <Text className="text-sm font-bold text-brand-500">
                          ×{item.quantity}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Text className="mt-2 text-xs text-text-muted">
              Everything above arrives together as one box. Boxes are bought on the
              day — they are not part of a subscription and cannot be swapped.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Purchase bar */}
      <View className="border-t border-border px-5 pb-6 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text-secondary">Boxes</Text>
          <Stepper
            value={qty}
            min={1}
            max={MAX_LINE_QUANTITY}
            label={`${pkg.name} quantity`}
            onChange={setQty}
          />
        </View>

        <Button
          label={`Add to order · ${formatMoney(pkg.price * qty)}`}
          size="lg"
          onPress={addToOrder}
        />
      </View>
    </SafeAreaView>
  );
}
