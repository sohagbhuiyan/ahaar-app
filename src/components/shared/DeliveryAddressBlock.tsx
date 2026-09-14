import { Text, View } from 'react-native';

import type { DeliveryAddress } from '@/lib/api/types/catalog';
import { cn } from '@/lib/utils';

interface Props {
  /** The order's frozen `delivery_address`. Renders nothing when absent. */
  address: DeliveryAddress | null | undefined;
  title?: string;
  className?: string;
}

/**
 * Where an order or subscription is delivered, as it was when it was placed.
 *
 * Reads the snapshot, never the live address book: moving house or editing an
 * address later must not rewrite where a past order went. Older orders placed
 * before snapshots existed carry none, and simply don't show the block.
 */
export function DeliveryAddressBlock({ address, title = 'Delivering to', className }: Props) {
  if (!address) return null;

  return (
    <View
      testID="delivery-address"
      className={cn('rounded-2xl bg-surface-muted px-4 py-3', className)}
    >
      <Text className="text-xs font-bold uppercase text-text-muted">{title}</Text>
      {address.label ? (
        <Text className="mt-0.5 text-sm font-semibold text-text-primary">{address.label}</Text>
      ) : null}
      <Text className="mt-0.5 text-sm text-text-secondary">{address.formatted}</Text>
      {address.instructions ? (
        <Text className="mt-1 text-xs italic text-text-muted">{address.instructions}</Text>
      ) : null}
    </View>
  );
}
