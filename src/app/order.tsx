import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  AddressFormSheet,
  AddressPicker,
  DayStrip,
  formatAddress,
  OfflineBanner,
  ScreenHeader,
  SlotPicker,
} from '@/components/shared';
import {
  Button,
  Card,
  EmptyState,
  InlineError,
  Separator,
  Stepper,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { Order } from '@/lib/api/types/order';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { isPayable, openCheckout } from '@/lib/payments';
import {
  useAddresses,
  useCreateInstantOrder,
  useDeliverySlots,
  useIsSignedIn,
} from '@/lib/query/hooks';
import { slotAvailabilityFor, firstBookableSlotId } from '@/lib/slots';
import { useAuthPromptStore, useInstantOrderStore } from '@/lib/store';
import { formatLongDate, formatMoney, todayISO } from '@/lib/utils';

/** How far ahead the day strip offers. Beyond this, cutoffs are meaningless. */
const LOOKAHEAD_DAYS = 14;

/**
 * Instant-order checkout — the walk-in path.
 *
 * `POST /orders/instant` needs no subscription: anyone with an account can
 * order any menu item for any date whose slot cutoff hasn't passed. That is
 * exactly why the login prompt lives on the submit button and nowhere earlier —
 * a visitor can browse, fill a basket and configure the whole delivery before
 * being asked who they are, and `useRequireAuth` replays the submit once they
 * say.
 *
 * The order is created `pending` with a payment attached; nothing is confirmed
 * until the gateway's checkout page is completed, so this hands off to it
 * immediately rather than claiming success.
 */
export default function InstantOrderScreen() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const lines = useInstantOrderStore((s) => s.lines);
  const setQuantity = useInstantOrderStore((s) => s.setQuantity);
  const deliveryDate = useInstantOrderStore((s) => s.deliveryDate);
  const setDeliveryDate = useInstantOrderStore((s) => s.setDeliveryDate);
  const slotId = useInstantOrderStore((s) => s.slotId);
  const setSlot = useInstantOrderStore((s) => s.setSlot);
  const addressId = useInstantOrderStore((s) => s.addressId);
  const setAddress = useInstantOrderStore((s) => s.setAddress);
  const clearBasket = useInstantOrderStore((s) => s.clear);

  const { data: slots } = useDeliverySlots();
  // Only readable with a session. Signed out the picker simply shows its empty
  // state, and the order falls back to the account's default address on submit.
  const { data: addresses } = useAddresses();

  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  // `after_or_equal:today` on `CreateInstantOrderRequest` — today counts, as
  // long as some slot for it is still open.
  const earliest = todayISO();

  /**
   * Re-evaluated on every render rather than memoised on a timer: cutoffs lapse
   * while the screen is open, and the cost is a handful of date comparisons.
   */
  const slotOptions = useMemo(
    () => (deliveryDate ? slotAvailabilityFor(slots ?? [], deliveryDate) : []),
    [slots, deliveryDate],
  );
  const hasBookableSlot = slotOptions.some((o) => o.isBookable);

  /**
   * A day with no still-open slot can't be ordered for — grey it out.
   *
   * `useCallback`, not a `useMemo` returning a closure — the React Compiler
   * cannot preserve memoisation across the latter and bails out of optimising
   * the whole component.
   */
  const isDayDisabled = useCallback(
    (date: string) => {
      const list = slots ?? [];
      if (list.length === 0) return false;
      return !slotAvailabilityFor(list, date).some((o) => o.isBookable);
    },
    [slots],
  );

  // Default the day to the first one that has anything open.
  useEffect(() => {
    if (deliveryDate || !slots || slots.length === 0) return;

    const probe = new Date(`${earliest}T00:00:00`);
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
      const date = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
      if (slotAvailabilityFor(slots, date).some((o) => o.isBookable)) {
        setDeliveryDate(date);
        return;
      }
      probe.setDate(probe.getDate() + 1);
    }
    setDeliveryDate(earliest);
  }, [slots, deliveryDate, earliest, setDeliveryDate]);

  // Keep the slot honest: a stored choice can lapse past its cutoff while the
  // screen sits open, or stop existing when the date changes.
  useEffect(() => {
    if (slotOptions.length === 0) return;
    const current = slotOptions.find((o) => o.slot.id === slotId);
    if (current?.isBookable) return;
    setSlot(firstBookableSlotId(slotOptions));
  }, [slotOptions, slotId, setSlot]);

  const effectiveAddressId =
    addressId ??
    addresses?.find((a) => a.is_default)?.id ??
    addresses?.[0]?.id ??
    null;

  const total = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  /**
   * Stable for a given basket + delivery, so a retry after a dropped response
   * can't create a second order and a second charge. Changing anything about
   * the order legitimately makes it a different order.
   */
  const idempotencyKey = useMemo(() => {
    const signature = lines
      .map((l) => `${l.menu_item_id}x${l.quantity}`)
      .sort()
      .join('.');
    return `instant-${deliveryDate}-${slotId}-${effectiveAddressId ?? 'default'}-${signature}`;
  }, [lines, deliveryDate, slotId, effectiveAddressId]);

  const createOrder = useCreateInstantOrder();

  const goToOrder = (order: Order) =>
    router.replace({ pathname: '/orders/[id]', params: { id: String(order.id) } });

  const submit = () => {
    if (!deliveryDate || slotId === null || lines.length === 0) return;
    setSubmitError(null);

    createOrder.mutate(
      {
        payload: {
          delivery_date: deliveryDate,
          slot_id: slotId,
          address_id: effectiveAddressId,
          items: lines.map((l) => ({
            menu_item_id: l.menu_item_id,
            quantity: l.quantity,
          })),
        },
        idempotencyKey,
      },
      {
        onSuccess: async (order) => {
          // The server now owns this order; a lingering basket would let the
          // customer submit the same thing again.
          clearBasket();
          toast.success(`Order #${order.id} placed`);

          if (isPayable(order.payment)) {
            await openCheckout(order.payment.checkout_url);
          }
          goToOrder(order);
        },
        onError: (error) => {
          setSubmitError(error);
          toast.error(
            isApiError(error) ? error.message : 'That order could not be placed',
          );
        },
      },
    );
  };

  const canSubmit =
    lines.length > 0 &&
    deliveryDate !== null &&
    slotId !== null &&
    hasBookableSlot &&
    !createOrder.isPending;

  if (lines.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Your order" variant="close" />
        <EmptyState
          title="Your basket is empty"
          description="Add a dish from the menu and pick a day for it."
          actionLabel="Browse the menu"
          onAction={() => router.replace('/(tabs)/foods')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Your order" subtitle="One-off delivery" variant="close" />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {submitError ? (
          <InlineError error={submitError} className="mx-5 mb-4" />
        ) : null}

        {/* Items */}
        <View className="px-5">
          <Card>
            <View className="p-4">
              {lines.map((line, index) => (
                <View key={line.menu_item_id}>
                  {index > 0 ? <Separator className="my-3" /> : null}

                  <View className="flex-row items-center gap-3">
                    <View className="h-14 w-14 overflow-hidden rounded-2xl bg-surface-muted">
                      {line.image_url ? (
                        <Image
                          source={{ uri: line.image_url }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : null}
                    </View>

                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="text-sm font-bold text-text-primary"
                      >
                        {line.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-text-muted">
                        {formatMoney(line.unit_price)} each
                      </Text>
                    </View>

                    <Stepper
                      size="sm"
                      value={line.quantity}
                      min={1}
                      label={`${line.name} quantity`}
                      onChange={(next) => setQuantity(line.menu_item_id, next)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Day */}
        <View className="mt-6">
          <StepLabel n={1} label="Delivery day" className="px-5" />
          <DayStrip
            value={deliveryDate}
            onChange={setDeliveryDate}
            from={earliest}
            days={LOOKAHEAD_DAYS}
            isDisabled={isDayDisabled}
          />
        </View>

        {/* Slot */}
        <View className="mt-6 px-5">
          <StepLabel n={2} label="Meal time" />

          {slotOptions.length === 0 ? (
            <Text className="text-sm text-text-secondary">Loading meal times…</Text>
          ) : !hasBookableSlot ? (
            <View className="rounded-2xl bg-warning-soft px-4 py-3">
              <Text className="text-xs text-warning">
                Every meal time for {formatLongDate(deliveryDate ?? '')} has closed.
                Pick a later day.
              </Text>
            </View>
          ) : (
            <SlotPicker options={slotOptions} value={slotId} onChange={setSlot} />
          )}
        </View>

        {/* Address */}
        <View className="mt-6 px-5">
          <StepLabel n={3} label="Delivery address" />
          <AddressPicker
            addresses={addresses ?? []}
            value={effectiveAddressId}
            onChange={setAddress}
            onAdd={() =>
              requireAuth(() => setAddressFormOpen(true), 'to save an address')
            }
          />
        </View>

        {/* Total */}
        <View className="mt-6 px-5">
          <Card>
            <View className="p-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-text-primary">Total</Text>
                <Text className="text-xl font-bold text-brand-500">
                  {formatMoney(total)}
                </Text>
              </View>
              <Separator className="my-3" />

              <View className="gap-1">
                <SummaryRow
                  label="Arriving"
                  value={
                    deliveryDate
                      ? formatLongDate(deliveryDate)
                      : 'Pick a day above'
                  }
                />
                <SummaryRow
                  label="Meal time"
                  value={
                    slotOptions.find((o) => o.slot.id === slotId)?.slot.name ??
                    'Pick a meal time'
                  }
                />
                <SummaryRow
                  label="Delivering to"
                  value={
                    addresses?.find((a) => a.id === effectiveAddressId)
                      ? formatAddress(
                          addresses.find((a) => a.id === effectiveAddressId)!,
                        )
                      : 'Your default address'
                  }
                />
              </View>

              <Text className="mt-3 text-xs text-text-muted">
                Prices include tax. The final amount is confirmed by the server
                when the order is created.
              </Text>
            </View>
          </Card>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={clearBasket}
          className="mt-5 self-center px-5 py-2"
        >
          <Text className="text-sm font-semibold text-text-muted">Empty basket</Text>
        </Pressable>
      </ScrollView>

      <View className="border-t border-border px-5 pb-6 pt-4">
        {/*
          Signed out, this opens the sign-in sheet and stops there rather than
          replaying the submit. Posting immediately after sign-in would race the
          `/addresses` fetch that has only just been enabled, and land an order
          with `address_id: null` — which the backend accepts, quietly falling
          back to a default address a brand-new account does not have. One extra
          tap is a fair price for an order that knows where it is going.
        */}
        <Button
          label={
            signedIn
              ? `Place order · ${formatMoney(total)}`
              : 'Sign in to place this order'
          }
          size="lg"
          loading={createOrder.isPending}
          disabled={signedIn ? !canSubmit : lines.length === 0}
          onPress={
            signedIn ? submit : () => promptLogin('to place this order')
          }
        />
      </View>

      <AddressFormSheet
        open={addressFormOpen}
        onClose={() => setAddressFormOpen(false)}
        onSaved={(saved) => setAddress(saved.id)}
      />
    </SafeAreaView>
  );
}

/** A numbered step heading — the screen is a sequence, so it should look like one. */
function StepLabel({
  n,
  label,
  className,
}: {
  n: number;
  label: string;
  className?: string;
}) {
  return (
    <View className={`mb-3 flex-row items-center gap-2 ${className ?? ''}`}>
      <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-50">
        <Text className="text-[10px] font-bold text-brand-700">{n}</Text>
      </View>
      <Text className="text-sm font-bold text-text-primary">{label}</Text>
    </View>
  );
}

/** One line of the pre-payment recap. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <Text className="text-xs text-text-secondary">{label}</Text>
      <Text
        numberOfLines={1}
        className="flex-1 text-right text-xs font-semibold text-text-primary"
      >
        {value}
      </Text>
    </View>
  );
}
