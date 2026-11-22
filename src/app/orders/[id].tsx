import { useEffect, useRef, useState } from 'react';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  DeliveryAddressBlock,
  FoodImage,
  OfflineBanner,
  ScreenHeader,
  TrackingPanel,
} from '@/components/shared';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  ErrorState,
  Separator,
  SkeletonText,
  type BadgeVariant,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { OrderStatus } from '@/lib/api/types/order';
import {
  isAwaitingCash,
  isPayable,
  openCheckout,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/payments';
import {
  useCancelOrder,
  useDeliverySlotMap,
  useOrder,
  useOrderTracking,
} from '@/lib/query/hooks';
import { orderHasTracking } from '@/lib/tracking/status';
import { slotWindow } from '@/lib/slots';
import { formatLongDate, formatMoney } from '@/lib/utils';

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  dispatched: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};


const TYPE_LABEL: Record<string, string> = {
  instant: 'ordering.orderType.instant',
  extra: 'ordering.orderType.extra',
  guest: 'ordering.orderType.guest',
};

/**
 * One order: what was bought, what it costs, and what still has to happen.
 *
 * Re-read on every mount (`refetchOnMount: 'always'` in `useOrder`) because the
 * customer arrives here straight from a gateway checkout, and the whole point
 * of the screen is to answer "did that go through?" — a cached `pending` from
 * ninety seconds ago would answer it wrong.
 */
export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isFetching, isError, error, refetch } = useOrder(id);
  const { data: slotById } = useDeliverySlotMap();
  const cancelOrder = useCancelOrder();

  // Instant orders only: extra and guest orders ride along with a subscription
  // meal, whose own screen tracks it.
  const trackable = order ? orderHasTracking(order) : false;
  const focused = useIsFocused();
  const tracking = useOrderTracking(id, { enabled: trackable, focused });

  // The tracking poll sees a step change before this screen's order does
  // (picked up → `dispatched`, delivered, cancelled). Re-read the order then,
  // so `can_cancel` and the status badge follow without a pull-to-refresh.
  // Once per change of the tracked status, so a lagging read can't loop.
  const trackedOrderStatus = tracking.data?.order_status;
  const orderStatus = order?.status;
  const handledStatus = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!trackedOrderStatus || !orderStatus || handledStatus.current === trackedOrderStatus) return;
    handledStatus.current = trackedOrderStatus;
    if (trackedOrderStatus !== orderStatus) void refetch();
  }, [trackedOrderStatus, orderStatus, refetch]);

  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('ordering.orderType.order')} />
        <View className="gap-4 p-5">
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('ordering.orderType.order')} />
        <ErrorState
          error={error}
          onRetry={refetch}
          retrying={isFetching}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const slot = slotById?.get(order.slot_id);
  const payable = isPayable(order.payment);

  // Server-decided: false once the rider has the food, or the order is
  // finished. A race (picked up while the dialog is open) still answers 422
  // `already_dispatched`, handled below.
  const cancellable = order.can_cancel;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={t('ordering.orderDetail.title', { id: order.id })}
        subtitle={t(TYPE_LABEL[order.type] ?? 'ordering.orderType.order')}
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
              if (trackable) void tracking.refetch();
            }}
          />
        }
      >
        {/* Status */}
        <Card>
          <View className="p-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase text-text-muted">
                  {t('ordering.delivery')}
                </Text>
                <Text className="mt-0.5 text-base font-bold text-text-primary">
                  {formatLongDate(order.delivery_date)}
                </Text>
                {slot ? (
                  <Text className="mt-0.5 text-xs text-text-muted">
                    {slot.name} · {slotWindow(slot)}
                  </Text>
                ) : null}
              </View>

              <Badge
                label={t(`common.status.${order.status}`, { defaultValue: order.status })}
                variant={STATUS_VARIANT[order.status] ?? 'muted'}
              />
            </View>


            {order.status === 'cancelled' && order.cancellation_reason ? (
              <View className="mt-3 rounded-2xl bg-danger-soft px-4 py-3">
                <Text className="text-xs text-danger">
                  {order.cancellation_reason}
                </Text>
              </View>
            ) : null}

            <DeliveryAddressBlock address={order.delivery_address} className="mt-3" />
          </View>
        </Card>

        {trackable ? (
          <TrackingPanel
            tracking={tracking.data}
            isLoading={tracking.isLoading}
            isError={tracking.isError}
            className="mt-4"
          />
        ) : null}

        {/* Items */}
        {order.items && order.items.length > 0 ? (
          <Card className="mt-4">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">{t('ordering.items')}</Text>

              <View className="mt-3">
                {order.items.map((item, index) => (
                  <View key={item.id}>
                    {index > 0 ? <Separator className="my-3" /> : null}
                    <View className="flex-row items-center justify-between gap-3">
                      <FoodImage
                        uri={
                          item.kind === 'package'
                            ? item.package?.image_url
                            : item.menu_item?.image_url
                        }
                        glyph={item.kind === 'package' ? '🍱' : undefined}
                        glyphSize="sm"
                        className="h-12 w-12 rounded-xl"
                      />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-text-primary">
                          {item.name}
                        </Text>
                        <Text className="mt-0.5 text-xs text-text-muted">
                          {t('ordering.unitPrice', {
                            qty: item.quantity,
                            price: formatMoney(item.unit_price),
                          })}
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold text-text-primary">
                        {formatMoney(item.subtotal)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        ) : null}

        {/* Money */}
        <Card className="mt-4">
          <View className="p-5">
            <Row
              label={t('ordering.subtotal')}
              value={formatMoney(order.subtotal)}
            />
            <Row
              label={t('ordering.taxIncluded')}
              value={formatMoney(order.tax_amount)}
            />
            <Separator className="my-3" />
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-primary">{t('ordering.total')}</Text>
              <Text className="text-xl font-bold text-brand-500">
                {formatMoney(order.total_amount)}
              </Text>
            </View>

            {order.payment ? (
              <>
                <View className="mt-4 flex-row items-center justify-between">
                  <Text className="text-sm text-text-secondary">{t('ordering.payment')}</Text>
                  <Badge
                    label={paymentStatusLabel(order.payment)}
                    variant={paymentStatusTone(order.payment)}
                  />
                </View>

                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-sm text-text-secondary">{t('ordering.method')}</Text>
                  <Text className="text-sm font-semibold text-text-primary">
                    {paymentMethodLabel(order.payment)}
                  </Text>
                </View>

                {/* The order is already confirmed and being cooked, so the one
                    thing left to say is what the customer has to do at the
                    door. Without it, "Pay on delivery" is a status and not an
                    instruction. */}
                {isAwaitingCash(order.payment) ? (
                  <View className="mt-4 rounded-2xl bg-brand-50 px-4 py-3">
                    <Text className="text-xs leading-5 text-brand-700">
                      {t('ordering.orderDetail.cashReady', { amount: formatMoney(order.total_amount) })}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </Card>

        <View className="mt-6 gap-3">
          {payable ? (
            <Button
              label={t('ordering.payNow')}
              size="lg"
              onPress={() => openCheckout(order.payment!.checkout_url!)}
            />
          ) : null}

          {payable ? (
            <Button
              label={t('ordering.paidRefresh')}
              variant="outline"
              loading={isFetching}
              onPress={() => refetch()}
            />
          ) : null}

          {cancellable ? (
            <Button
              label={t('ordering.orderDetail.cancel')}
              variant="ghost"
              onPress={() => setConfirmCancel(true)}
            />
          ) : null}

          <Button
            label={t('ordering.orderDetail.backToOrders')}
            variant="ghost"
            onPress={() => router.replace('/orders')}
          />
        </View>
      </ScrollView>

      <AlertDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() =>
          cancelOrder.mutate(
            { id: order.id },
            {
              onSuccess: () => {
                setConfirmCancel(false);
                toast.success(t('ordering.orderDetail.cancelled'));
              },
              onError: (e) => {
                setConfirmCancel(false);
                if (isApiError(e) && e.reason === 'already_dispatched') {
                  // The rider picked it up while the customer was deciding.
                  // Say so in our words, and bring the screen up to date so
                  // the button goes away.
                  toast.error(t('tracking.cancel.alreadyDispatched'));
                  void refetch();
                  void tracking.refetch();
                  return;
                }
                toast.error(
                  isApiError(e) ? e.message : t('ordering.orderDetail.cancelFailed'),
                );
              },
            },
          )
        }
        title={t('ordering.orderDetail.cancelTitle')}
        description={t('ordering.orderDetail.cancelBody')}
        confirmLabel={t('ordering.orderDetail.cancelConfirm')}
        cancelLabel={t('ordering.orderDetail.keep')}
        destructive
        loading={cancelOrder.isPending}
      />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text className="text-sm font-semibold text-text-primary">{value}</Text>
    </View>
  );
}
