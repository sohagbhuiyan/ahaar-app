import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { Badge, Card, type BadgeVariant } from '@/components/ui';
import type { Order, OrderStatus } from '@/lib/api/types/order';
import { paymentStatusLabel, paymentStatusTone } from '@/lib/payments';
import { isOrderInFlight } from '@/lib/tracking/status';
import { formatMoney, formatShortDate } from '@/lib/utils';

import { LiveStatusPill } from './LiveStatusPill';

interface Props {
  order: Order;
  /** Slot name, resolved by the caller from the shared slot map. */
  slotName?: string;
  onPress?: (order: Order) => void;
  /** Trailing action — "Pay now", usually. */
  action?: React.ReactNode;
}

/** What each order type is, in the customer's words rather than the API's (translation keys). */
const TYPE_LABEL: Record<Order['type'], string> = {
  instant: 'ordering.orderType.instant',
  extra: 'ordering.orderType.extra',
  guest: 'ordering.orderType.guest',
};

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending: 'warning',
  confirmed: 'success',
  dispatched: 'brand',
  delivered: 'success',
  cancelled: 'danger',
};

/**
 * One row in the order history.
 *
 * Payment status is shown next to order status rather than folded into it: an
 * order can sit at `pending` because the customer never finished checkout, and
 * the payment label is the only thing that tells them there is something to do
 * — or, for a cash order, that there deliberately isn't. Both the wording and
 * the tone come from `lib/payments` so every screen says the same thing.
 */
function OrderCardComponent({ order, slotName, onPress, action }: Props) {
  const { t } = useTranslation();
  const itemCount = (order.items ?? []).reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Card onPress={onPress ? () => onPress(order) : undefined}>
      <View className="p-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-bold text-text-primary">
              {t(TYPE_LABEL[order.type] ?? 'ordering.orderType.order')} · #{order.id}
            </Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              {formatShortDate(order.delivery_date)}
              {slotName ? ` · ${slotName}` : ''}
              {order.type === 'guest' && order.guests_count
                ? ` · ${t('ordering.guests', { count: order.guests_count })}`
                : ''}
            </Text>
          </View>

          <Badge
            label={t(`common.status.${order.status}`, { defaultValue: order.status })}
            variant={STATUS_VARIANT[order.status] ?? 'muted'}
          />
        </View>

        {/* Where the food is, for an order a rider is working on — the one
            thing worth reading in the list while it's in flight. */}
        {isOrderInFlight(order) && order.delivery_status ? (
          <LiveStatusPill status={order.delivery_status} className="mt-2" />
        ) : null}

        {itemCount > 0 ? (
          <Text numberOfLines={2} className="mt-2 text-xs text-text-secondary">
            {(order.items ?? [])
              .map((i) => t('ordering.itemQty', { qty: i.quantity, name: i.name }))
              .join(t('ordering.listSeparator'))}
          </Text>
        ) : null}

        <View className="mt-3 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-bold text-brand-500">
              {formatMoney(order.total_amount)}
            </Text>
            {order.payment ? (
              <Badge
                label={paymentStatusLabel(order.payment)}
                variant={paymentStatusTone(order.payment)}
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
