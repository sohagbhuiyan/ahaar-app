import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DeliveryAddressBlock,
  FoodImage,
  OfflineBanner,
  ScreenHeader,
  TrackingPanel,
} from '@/components/shared';
import { Badge, Button, Card, EmptyState, ErrorState, SkeletonText } from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import { formatDayHeading } from '@/lib/deliveries';
import { useDelivery, useDeliveryTracking } from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { trackingStatusLabel, trackingStatusTone } from '@/lib/tracking/status';

/**
 * One subscription meal: where it is (status, the car route, the driver) and
 * what's in it. Opened from the Deliveries screen's "Track" and from a
 * `delivery.status` push.
 *
 * Tracking is always read — its timeline is useful for any meal — but only
 * polled while the server sends `poll_seconds` (the car is on the road), and
 * only while this screen is in view.
 */
export default function DeliveryDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const delivery = useDelivery(id);
  const tracking = useDeliveryTracking(id, { focused: useIsFocused() });

  const { data, isLoading, isFetching, isError, error, refetch } = delivery;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('tracking.delivery.title')} />
        <View className="gap-4 p-5">
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    const notFound = isApiError(error) && (error.status === 404 || error.status === 403);
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('tracking.delivery.title')} />
        {notFound ? (
          <EmptyState
            title={t('tracking.delivery.notFoundTitle')}
            description={t('tracking.delivery.notFoundBody')}
            actionLabel={t('tracking.delivery.backToPlan')}
            onAction={() => router.replace('/deliveries')}
            className="flex-1 justify-center"
          />
        ) : (
          <ErrorState
            error={error}
            onRetry={refetch}
            retrying={isFetching}
            className="flex-1 justify-center"
          />
        )}
      </SafeAreaView>
    );
  }

  const status = tracking.data?.status ?? data.status;
  const dishes = (data.items ?? []).filter((item) => !item.is_addon);
  const extras = (data.items ?? []).filter((item) => item.is_addon);

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={data.slot?.name ?? t('tracking.delivery.title')}
        subtitle={formatDayHeading(data.delivery_date)}
      />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => {
              void refetch();
              void tracking.refetch();
            }}
          />
        }
      >
        <Card>
          <View className="p-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase text-text-muted">
                  {t('ordering.delivery')}
                </Text>
                <Text className="mt-0.5 text-base font-bold text-text-primary">
                  {formatDayHeading(data.delivery_date)}
                </Text>
                {data.slot ? (
                  <Text className="mt-0.5 text-xs text-text-muted">
                    {data.slot.name} · {slotWindow(data.slot)}
                  </Text>
                ) : null}
              </View>
              <Badge label={trackingStatusLabel(status)} variant={trackingStatusTone(status)} />
            </View>
            <DeliveryAddressBlock address={data.delivery_address} className="mt-3" />
          </View>
        </Card>

        <TrackingPanel
          tracking={tracking.data}
          isLoading={tracking.isLoading}
          isError={tracking.isError}
          className="mt-4"
        />

        {dishes.length + extras.length > 0 ? (
          <Card className="mt-4">
            <View className="gap-2 p-5">
              <Text className="mb-1 text-sm font-bold text-text-primary">
                {t('tracking.delivery.items')}
              </Text>
              {[...dishes, ...extras].map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center gap-3 rounded-2xl bg-surface-muted py-2 pe-3 ps-2"
                >
                  <FoodImage
                    uri={item.menu_item?.image_url}
                    glyphSize="sm"
                    className="h-12 w-12 rounded-xl"
                  />
                  <Text numberOfLines={2} className="flex-1 text-sm font-semibold text-text-primary">
                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                    {item.menu_item?.name ?? t('account.itemFallback', { id: item.id })}
                  </Text>
                  {item.is_addon ? <Badge label={t('account.extras')} variant="muted" /> : null}
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <View className="mt-6">
          <Button
            label={t('tracking.delivery.backToPlan')}
            variant="ghost"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/deliveries'))}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
