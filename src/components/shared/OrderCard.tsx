import { memo } from 'react';
import { Text, View } from 'react-native';

import { Badge, Card, type BadgeVariant } from '@/components/ui';
import type { Order, OrderStatus, PaymentStatus } from '@/lib/api/types/order';
import { formatMoney, formatShortDate } from '@/lib/utils';

interface Props {
  order: Order;
  /** Slot name, resolved by the caller from the shared slot map. */
  slotName?: string;
  onPress?: (order: Order) => void;
  /** Trailing action — "Pay now", usually. */
  action?: React.ReactNode;
}

/** What each order type is, in the customer's words rather than the API's. */
const TYPE_LABEL: Record<Order['type'], string> = {
  instant: 'One-off order',
  extra: 'Extra items',
  guest: 'Guest portions',
};

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  delivered: 'success',
  cancelled: 'danger',
};

const PAYMENT_VARIANT: Record<PaymentStatus, BadgeVariant> = {
  pending: 'warning',
  succeeded: 'success',
  failed: 'danger',
  refunded: 'muted',
  partially_refunded: 'muted',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Payment due',
  succeeded: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

/**
 * One row in the order history.
 *
 * Payment status is shown next to order status rather than folded into it: an
 * order can sit at `pending` because the customer never finished checkout, and
 * "Payment due" is the only label that tells them there is something to do.
 */
function OrderCardComponent({ order, slotName, onPress, action }: Props) {
  const itemCount = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Card onPress={onPress ? () => onPress(order) : undefined}>
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-bold text-text-primary">
              {TYPE_LABEL[order.type] ?? 'Order'} · #{order.id}
            </Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              {formatShortDate(order.delivery_date)}
              {slotName ? ` · ${slotName}` : ''}
              {order.type === 'guest' && order.guests_count
                ? ` · ${order.guests_count} guest${order.guests_count > 1 ? 's' : ''}`
                : ''}
            </Text>
          </View>

          <Badge
            label={order.status}
            variant={STATUS_VARIANT[order.status] ?? 'muted'}
            className="capitalize"
          />
        </View>

        {itemCount > 0 ? (
          <Text numberOfLines={2} className="mt-2 text-xs text-text-secondary">
            {(order.items ?? [])
              .map((i) => `${i.quantity}× ${i.menu_item?.name ?? `Item #${i.menu_item_id}`}`)
              .join(', ')}
          </Text>
        ) : null}

        <View className="mt-3 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-brand-500">
              {formatMoney(order.total_amount)}
            </Text>
            {order.payment ? (
              <Badge
                label={PAYMENT_LABEL[order.payment.status] ?? order.payment.status}
                variant={PAYMENT_VARIANT[order.payment.status] ?? 'muted'}
              />
            ) : null}
          </View>

          {action}
        </View>
      </View>
    </Card>
  );
}

export const OrderCard = memo(OrderCardComponent);
