import { Pressable, Text, View } from 'react-native';

import { Badge, Button } from '@/components/ui';
import type { Address } from '@/lib/api/types/catalog';
import { composeAddress } from '@/lib/location/address';
import { cn } from '@/lib/utils';

interface Props {
  addresses: Address[];
  value: number | null;
  onChange: (addressId: number) => void;
  /** Opens the address form. Omit to hide the "add" affordance. */
  onAdd?: () => void;
  className?: string;
}

/** One-line summary — enough to tell two saved addresses apart. */
export function formatAddress(address: Address): string {
  return address.formatted || composeAddress(address);
}

/**
 * Delivery-address chooser.
 *
 * `address_id` is `nullable` on every order and subscription payload, so an
 * empty list is not a blocker — the backend falls back to the customer's
 * default, and orders without one are still accepted. The empty state
 * therefore invites rather than demands.
 */
export function AddressPicker({
  addresses,
  value,
  onChange,
  onAdd,
  className,
}: Props) {
  if (addresses.length === 0) {
    return (
      <View className={cn('rounded-2xl bg-surface-muted px-4 py-4', className)}>
        <Text className="text-sm text-text-secondary">
          No saved address yet. We&apos;ll use the one on your account if you
          have one.
        </Text>
        {onAdd ? (
          <Button
            label="Add an address"
            variant="secondary"
            size="sm"
            fullWidth={false}
            className="mt-3"
            onPress={onAdd}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View className={cn('gap-2', className)}>
      {addresses.map((address) => {
        const selected = address.id === value;

        return (
          <Pressable
            key={address.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(address.id)}
            className={cn(
              'rounded-2xl border px-4 py-3',
              selected ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
            )}
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold text-text-primary">
                {address.label ?? address.line1}
              </Text>
              {address.is_default ? <Badge label="Default" variant="muted" /> : null}
            </View>
            <Text numberOfLines={2} className="mt-0.5 text-xs text-text-muted">
              {formatAddress(address)}
            </Text>
          </Pressable>
        );
      })}

      {onAdd ? (
        <Button
          label="Add another address"
          variant="ghost"
          size="sm"
          fullWidth={false}
          className="self-start"
          onPress={onAdd}
        />
      ) : null}
    </View>
  );
}
