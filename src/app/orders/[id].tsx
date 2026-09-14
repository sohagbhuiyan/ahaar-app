import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  DeliveryAddressBlock,
  FoodImage,
  OfflineBanner,
  ScreenHeader,
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
import type { OrderStatus, PaymentStatus } from '@/lib/api/types/order';
import { isPayable, openCheckout } from '@/lib/payments';
import { useCancelOrder, useDeliverySlotMap, useOrder } from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { formatLongDate, formatMoney } from '@/lib/utils';

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  delivered: 'success',
  cancelled: 'danger',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Awaiting payment',
  succeeded: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

const TYPE_LABEL: Record<string, string> = {
  instant: 'One-off order',
  extra: 'Extra items',
  guest: 'Guest portions',
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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isFetching, isError, error, refetch } = useOrder(id);
  const { data: slotById } = useDeliverySlotMap();
  const cancelOrder = useCancelOrder();

  const [confirmCancel, setConfirmCancel] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Order" />
        <View className="gap-4 p-5">
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Order" />
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

  // The API refuses a cancel past the delivery's cutoff and on anything already
  // finished; offering the button only in the states it can succeed in keeps a
  // predictable 422 out of the customer's way.
  const cancellable = order.status === 'pending' || order.status === 'confirmed';

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={`Order #${order.id}`}
        subtitle={TYPE_LABEL[order.type] ?? 'Order'}
      />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        {/* Status */}
        <Card>
          <View className="p-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase text-text-muted">
                  Delivery
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
                label={order.status}
                variant={STATUS_VARIANT[order.status] ?? 'muted'}
                className="capitalize"
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

        {/* Items */}
        {order.items && order.items.length > 0 ? (
          <Card className="mt-4">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">Items</Text>

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
                          {item.quantity} ×{' '}
                          {formatMoney(item.unit_price)}
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
              label="Subtotal"
              value={formatMoney(order.subtotal)}
            />
            <Row
              label="Tax included"
              value={formatMoney(order.tax_amount)}
            />
            <Separator className="my-3" />
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-primary">Total</Text>
              <Text className="text-xl font-bold text-brand-500">
                {formatMoney(order.total_amount)}
              </Text>
            </View>

            {order.payment ? (
              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-sm text-text-secondary">Payment</Text>
                <Badge
                  label={PAYMENT_LABEL[order.payment.status] ?? order.payment.status}
                  variant={
                    order.payment.status === 'succeeded'
                      ? 'success'
                      : order.payment.status === 'failed'
                        ? 'danger'
                        : 'warning'
                  }
                />
              </View>
            ) : null}
          </View>
        </Card>

        <View className="mt-6 gap-3">
          {payable ? (
            <Button
              label="Pay now"
              size="lg"
              onPress={() => openCheckout(order.payment!.checkout_url!)}
            />
          ) : null}

          {payable ? (
            <Button
              label="I've paid — refresh"
              variant="outline"
              loading={isFetching}
              onPress={() => refetch()}
            />
          ) : null}

          {cancellable ? (
            <Button
              label="Cancel this order"
              variant="ghost"
              onPress={() => setConfirmCancel(true)}
            />
          ) : null}

          <Button
            label="Back to orders"
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
                toast.success('Order cancelled');
              },
              onError: (e) => {
                setConfirmCancel(false);
                toast.error(
                  isApiError(e) ? e.message : 'That order could not be cancelled',
                );
              },
            },
          )
        }
        title="Cancel this order?"
        description="Anything already paid is refunded by our team. Orders past their delivery cutoff can no longer be cancelled."
        confirmLabel="Cancel order"
        cancelLabel="Keep it"
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
