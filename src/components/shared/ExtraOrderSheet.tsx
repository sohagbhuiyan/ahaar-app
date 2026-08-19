import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';

import {
  Badge,
  Button,
  EmptyState,
  InlineError,
  Sheet,
  SkeletonText,
  Stepper,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { Order } from '@/lib/api/types/order';
import { isPayable, openCheckout } from '@/lib/payments';
import {
  useAddonCatalogue,
  useCreateExtraOrder,
  useCreateGuestOrder,
} from '@/lib/query/hooks';
import { cn, formatMoney } from '@/lib/utils';

interface ExtraProps {
  open: boolean;
  onClose: () => void;
  deliveryId: number;
  /** False once the day's cutoff has passed — the API refuses either order. */
  beforeCutoff: boolean;
  /** Fires with the created order, for navigating to it. */
  onPlaced?: (order: Order) => void;
}

/**
 * Add paid extras to a day that is already scheduled.
 *
 * `POST /orders/extra` attaches items to an existing `DailyDelivery`, which is
 * why this is a sheet over the day rather than a screen of its own: the date,
 * slot and address are all the delivery's already, and the only decision left
 * is what to add.
 *
 * The catalogue shown is `addons_only` — items the kitchen offers as extras.
 * The endpoint would accept any menu item, but offering the whole menu here
 * would blur the line with the instant-order flow, which is where a customer
 * goes to buy a full meal outside their plan.
 */
export function ExtraOrderSheet({
  open,
  onClose,
  deliveryId,
  beforeCutoff,
  onPlaced,
}: ExtraProps) {
  const { data: addons, isLoading } = useAddonCatalogue();
  const createExtra = useCreateExtraOrder();

  /** menu_item_id → quantity. Only non-zero entries are sent. */
  const [picked, setPicked] = useState<Record<number, number>>({});

  /**
   * Clear on the way out rather than in an effect watching `open`.
   *
   * Reopening must start clean — a leftover selection from a dismissed sheet
   * would silently re-charge for something the customer backed out of — but
   * doing that in an effect means a setState during render-commit, which
   * cascades an extra render on every close. The dismiss *is* the event, so
   * handle it here; the scrim, the hardware back button and the cancel path all
   * come through this one function.
   */
  const handleClose = () => {
    setPicked({});
    createExtra.reset();
    onClose();
  };

  const lines = useMemo(
    () =>
      Object.entries(picked)
        .map(([id, quantity]) => ({ menu_item_id: Number(id), quantity }))
        .filter((l) => l.quantity > 0),
    [picked],
  );

  const total = useMemo(() => {
    const byId = new Map((addons ?? []).map((a) => [a.id, a.base_price]));
    return lines.reduce(
      (sum, l) => sum + (byId.get(l.menu_item_id) ?? 0) * l.quantity,
      0,
    );
  }, [lines, addons]);

  /**
   * One key per (delivery, exact selection). A retry after a dropped response
   * hits the same key and cannot double-charge; changing the selection is
   * legitimately a different order.
   */
  const idempotencyKey = `extra-${deliveryId}-${lines
    .map((l) => `${l.menu_item_id}x${l.quantity}`)
    .sort()
    .join('.')}`;

  const submit = () => {
    if (lines.length === 0 || !beforeCutoff) return;

    createExtra.mutate(
      { payload: { daily_delivery_id: deliveryId, items: lines }, idempotencyKey },
      {
        onSuccess: async (order) => {
          setPicked({});
          onClose();
          toast.success('Extras added to your day');
          if (isPayable(order.payment)) {
            await openCheckout(order.payment.checkout_url);
          }
          onPlaced?.(order);
        },
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : 'Those extras could not be added'),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Order something extra"
      description="Added to this day's delivery and charged separately."
      footer={
        <Button
          label={
            lines.length > 0
              ? `Add · ${formatMoney(total)}`
              : 'Add extras'
          }
          size="lg"
          loading={createExtra.isPending}
          disabled={lines.length === 0 || !beforeCutoff}
          onPress={submit}
        />
      }
    >
      {!beforeCutoff ? (
        <View className="mb-4 rounded-2xl bg-warning-soft px-4 py-3">
          <Text className="text-xs text-warning">
            This day has passed its cutoff, so nothing more can be added to it.
          </Text>
        </View>
      ) : null}

      {createExtra.isError ? (
        <InlineError error={createExtra.error} className="mb-4" />
      ) : null}

      {isLoading ? (
        <SkeletonText lines={6} />
      ) : !addons || addons.length === 0 ? (
        <EmptyState
          title="No extras available"
          description="The kitchen isn't offering add-ons right now."
        />
      ) : (
        <View className="gap-3 pb-2">
          {addons.map((addon) => {
            const quantity = picked[addon.id] ?? 0;

            return (
              <View
                key={addon.id}
                className={cn(
                  'flex-row items-center gap-3 rounded-2xl border p-3',
                  quantity > 0 ? 'border-brand-500 bg-brand-50' : 'border-border',
                )}
              >
                <View className="h-12 w-12 overflow-hidden rounded-xl bg-surface-muted">
                  {addon.image_url ? (
                    <Image
                      source={{ uri: addon.image_url }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>

                <View className="flex-1">
                  <Text numberOfLines={1} className="text-sm font-bold text-text-primary">
                    {addon.name}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-brand-500">
                    {formatMoney(addon.base_price)}
                  </Text>
                </View>

                {quantity > 0 ? (
                  <Stepper
                    size="sm"
                    value={quantity}
                    min={1}
                    label={`${addon.name} quantity`}
                    disabled={!beforeCutoff}
                    onChange={(next) =>
                      setPicked((prev) => {
                        if (next <= 0) {
                          const { [addon.id]: _removed, ...rest } = prev;
                          return rest;
                        }
                        return { ...prev, [addon.id]: next };
                      })
                    }
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${addon.name}`}
                    disabled={!beforeCutoff}
                    onPress={() => setPicked((prev) => ({ ...prev, [addon.id]: 1 }))}
                    className={cn(
                      'rounded-xl bg-surface-muted px-3 py-2 active:opacity-70',
                      !beforeCutoff && 'opacity-40',
                    )}
                  >
                    <Text className="text-xs font-bold text-text-primary">Add</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}

interface GuestProps {
  open: boolean;
  onClose: () => void;
  deliveryId: number;
  beforeCutoff: boolean;
  onPlaced?: (order: Order) => void;
}

/**
 * Extra portions of the same day's meal, for people eating with the customer.
 *
 * `POST /orders/guest` copies the delivery's own items ×N rather than taking a
 * item list — so there is exactly one thing to choose here. The API caps N at
 * 10 (`guests_count` → `min:1,max:10`).
 */
export function GuestOrderSheet({
  open,
  onClose,
  deliveryId,
  beforeCutoff,
  onPlaced,
}: GuestProps) {
  const [guests, setGuests] = useState(1);
  const createGuest = useCreateGuestOrder();

  /** Reset on dismissal, not in an effect — see `ExtraOrderSheet`. */
  const handleClose = () => {
    setGuests(1);
    createGuest.reset();
    onClose();
  };

  const submit = () => {
    if (!beforeCutoff) return;

    createGuest.mutate(
      {
        payload: { daily_delivery_id: deliveryId, guests_count: guests },
        idempotencyKey: `guest-${deliveryId}-${guests}`,
      },
      {
        onSuccess: async (order) => {
          onClose();
          toast.success(`${guests} guest portion${guests > 1 ? 's' : ''} added`);
          if (isPayable(order.payment)) {
            await openCheckout(order.payment.checkout_url);
          }
          onPlaced?.(order);
        },
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : 'Guest portions could not be added'),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Eating with someone?"
      description="We'll send extra portions of the same meal for this day."
      footer={
        <Button
          label={`Add ${guests} portion${guests > 1 ? 's' : ''}`}
          size="lg"
          loading={createGuest.isPending}
          disabled={!beforeCutoff}
          onPress={submit}
        />
      }
    >
      {!beforeCutoff ? (
        <View className="mb-4 rounded-2xl bg-warning-soft px-4 py-3">
          <Text className="text-xs text-warning">
            This day has passed its cutoff, so guest portions can no longer be added.
          </Text>
        </View>
      ) : null}

      {createGuest.isError ? (
        <InlineError error={createGuest.error} className="mb-4" />
      ) : null}

      <View className="flex-row items-center justify-between rounded-2xl border border-border px-4 py-4">
        <View className="flex-1">
          <Text className="text-sm font-bold text-text-primary">Guests</Text>
          <Text className="mt-0.5 text-xs text-text-muted">
            Up to 10. Charged at the meal&apos;s normal price.
          </Text>
        </View>

        <Stepper
          value={guests}
          min={1}
          max={10}
          label="Number of guests"
          disabled={!beforeCutoff}
          onChange={(next) => setGuests(Math.max(1, Math.min(10, next)))}
        />
      </View>

      <Badge
        label="Charged separately from your plan"
        variant="muted"
        className="mt-4"
      />
    </Sheet>
  );
}
