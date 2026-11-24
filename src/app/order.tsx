import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  AddressFormSheet,
  AddressPicker,
  CashOnDeliveryCheckbox,
  DayStrip,
  FoodImage,
  formatAddress,
  OfflineBanner,
  ScreenHeader,
  SlotPicker,
} from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  InlineError,
  Input,
  Separator,
  Stepper,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { Order } from '@/lib/api/types/order';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import {
  CASH_GATEWAY,
  isCashAllowedForAmount,
  isPayable,
  openCheckout,
} from '@/lib/payments';
import {
  CART_PRICING_KEY,
  useAddresses,
  useCartPricing,
  useCheckoutCart,
  useDeliverySlots,
  useIsSignedIn,
  useProfile,
} from '@/lib/query/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { slotAvailabilityFor, firstBookableSlotId } from '@/lib/slots';
import { useAuthPromptStore, useInstantOrderStore } from '@/lib/store';
import { formatLongDate, formatMoney, todayISO } from '@/lib/utils';

const newAttemptKey = () => `cart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Same rule as `CheckoutCartRequest::PHONE_PATTERN`. */
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

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
 * The whole basket is bought as ONE order through the account cart
 * (`POST /cart/checkout`). Payment is the API's default gateway (`test` until
 * a live one is wired in; its checkout page opens if it has one), or cash on
 * delivery when ticked: confirmed at once, the rider collects at the door.
 */
export default function InstantOrderScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const lines = useInstantOrderStore((s) => s.lines);
  const setQuantity = useInstantOrderStore((s) => s.setQuantity);
  const packageLines = useInstantOrderStore((s) => s.packageLines);
  const setPackageQuantity = useInstantOrderStore((s) => s.setPackageQuantity);
  const deliveryDate = useInstantOrderStore((s) => s.deliveryDate);
  const setDeliveryDate = useInstantOrderStore((s) => s.setDeliveryDate);
  const slotId = useInstantOrderStore((s) => s.slotId);
  const setSlot = useInstantOrderStore((s) => s.setSlot);
  const addressId = useInstantOrderStore((s) => s.addressId);
  const setAddress = useInstantOrderStore((s) => s.setAddress);
  // After checkout: the server has already emptied the cart.
  const clearBasket = useInstantOrderStore((s) => s.clear);
  // The customer's "Empty basket": the account cart has to follow.
  const emptyBasket = useInstantOrderStore((s) => s.emptyBasket);

  const { data: slots } = useDeliverySlots();
  // Only readable with a session. Signed out the picker simply shows its empty
  // state, and the order falls back to the account's default address on submit.
  const { data: addresses } = useAddresses();

  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  // The server's price for this basket (signed in). It is what checkout will
  // charge, so it is what the screen shows; the local sum is only a fallback
  // for a visitor who has not signed in yet.
  const pricing = useCartPricing(signedIn);
  const priced = pricing.data ?? null;
  const unavailable = useMemo(
    () =>
      new Set(
        (priced?.items ?? [])
          .filter((l) => !l.is_available)
          .map((l) => `${l.kind}:${l.menu_item_id ?? l.package_id}`),
      ),
    [priced],
  );
  // A rider has to be able to call someone: ask only when the account has no phone.
  const needsPhone = signedIn && !!profile && !profile.phone;
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

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

  const localTotal =
    lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0) +
    packageLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);

  const total = priced?.total ?? localTotal;

  // A basket of nothing but boxes is a valid basket — the API needs at least
  // one line across `items` and `packages`, not specifically a dish.
  const isEmpty = lines.length === 0 && packageLines.length === 0;

  // Unticked = the API's default gateway (`test` for now, a real one later);
  // ticked = cash on delivery, the deliberate choice.
  const [payWithCash, setPayWithCash] = useState(false);

  /**
   * Cash, but only while the basket is small enough for a rider to collect.
   * Derived rather than stored, so a basket that grows past the ceiling can't
   * carry a now-invalid choice to submit. The server's flag is the rule; the
   * local constant only covers the moment before the first server price.
   */
  const cashAllowed = priced ? !priced.exceeds_cash_limit : isCashAllowedForAmount(total);
  const useCash = payWithCash && cashAllowed;

  /**
   * One key per attempt, not per basket. Kept across a dropped response (a
   * retry is the same attempt and returns the same order), replaced after any
   * definite answer. Derived from the basket instead, a customer ordering the
   * same thing twice for the same slot got their first order back.
   */
  const attemptKey = useRef(newAttemptKey());

  const createOrder = useCheckoutCart();

  const goToOrder = (order: Order) =>
    router.replace({ pathname: '/orders/[id]', params: { id: String(order.id) } });

  const submit = () => {
    if (!deliveryDate || slotId === null || isEmpty) return;
    setSubmitError(null);

    if (needsPhone && !PHONE_PATTERN.test(phone.trim())) {
      setPhoneError(t('ordering.cart.phoneInvalid'));
      return;
    }
    setPhoneError(null);

    createOrder.mutate(
      {
        // What is bought, and at what price, is the server cart — which
        // `useCartPricing` has just made equal to this basket. The only money
        // sent is the total the customer saw, so a price change is caught (409)
        // instead of charged.
        payload: {
          delivery_date: deliveryDate,
          slot_id: slotId,
          address_id: effectiveAddressId,
          expected_total: total,
          ...(needsPhone ? { phone: phone.trim() } : {}),
          // Omitted unless cash is chosen, so the API uses its default gateway.
          ...(useCash ? { gateway: CASH_GATEWAY } : {}),
        },
        idempotencyKey: attemptKey.current,
      },
      {
        onSuccess: async (order) => {
          // The server now owns this order; a lingering basket would let the
          // customer submit the same thing again.
          clearBasket();
          attemptKey.current = newAttemptKey();

          // A cash order is already confirmed: say so — it is the customer's
          // prompt to have the money ready.
          toast.success(
            useCash
              ? t('ordering.order.confirmedCash', { id: order.id })
              : t('ordering.order.placed', { id: order.id }),
          );

          // `test` settles on the spot; a real gateway leaves a page to pay on.
          if (isPayable(order.payment)) {
            await openCheckout(order.payment.checkout_url);
          }
          goToOrder(order);
        },
        onError: (error) => {
          // No response (offline / timeout), or a twin request still running:
          // the same attempt, so the same key — pressing again cannot buy twice.
          const sameAttempt =
            !isApiError(error) || !error.status || error.reason === 'in_progress';
          if (!sameAttempt) attemptKey.current = newAttemptKey();
          if (
            isApiError(error) &&
            (error.reason === 'price_changed' || error.reason === 'unavailable_items')
          ) {
            // Re-price on screen; the customer confirms the new total.
            void queryClient.invalidateQueries({ queryKey: CART_PRICING_KEY });
          }
          if (isApiError(error) && error.reason === 'cash_limit') {
            setPayWithCash(false);
            void queryClient.invalidateQueries({ queryKey: CART_PRICING_KEY });
          }
          if (isApiError(error) && error.errors?.phone?.[0]) {
            setPhoneError(error.errors.phone[0]);
          }
          setSubmitError(error);
          toast.error(
            isApiError(error) ? error.message : t('ordering.order.failed'),
          );
        },
      },
    );
  };

  const canSubmit =
    !isEmpty &&
    deliveryDate !== null &&
    slotId !== null &&
    hasBookableSlot &&
    // Buy only what the server has priced, and never with dead lines in it.
    !!priced &&
    !pricing.isFetching &&
    !priced.has_unavailable &&
    !createOrder.isPending;

  if (isEmpty) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('ordering.order.title')} variant="close" />
        <EmptyState
          title={t('ordering.order.emptyTitle')}
          description={t('ordering.order.emptyBody')}
          actionLabel={t('ordering.browseMenu')}
          onAction={() => router.replace('/(tabs)/foods')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={t('ordering.order.title')}
        subtitle={t('ordering.order.subtitle')}
        variant="close"
      />
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
        {lines.length > 0 ? (
        <View className="px-5">
          <Card>
            <View className="p-4">
              {lines.map((line, index) => (
                <View key={line.menu_item_id}>
                  {index > 0 ? <Separator className="my-3" /> : null}

                  <View className="flex-row items-center gap-3">
                    <FoodImage
                      uri={line.image_url}
                      className="h-14 w-14 rounded-2xl"
                    />

                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="text-sm font-bold text-text-primary"
                      >
                        {line.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-text-muted">
                        {t('ordering.order.each', { price: formatMoney(line.unit_price) })}
                      </Text>
                      {unavailable.has(`item:${line.menu_item_id}`) ? (
                        <Text
                          testID={`order-line-unavailable-${line.menu_item_id}`}
                          className="mt-0.5 text-xs font-semibold text-danger"
                        >
                          {t('ordering.cart.unavailable')}
                        </Text>
                      ) : null}
                    </View>

                    <Stepper
                      size="sm"
                      value={line.quantity}
                      min={1}
                      label={t('ordering.a11y.quantity', { name: line.name })}
                      onChange={(next) => setQuantity(line.menu_item_id, next)}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
        ) : null}

        {/* Meal boxes */}
        {packageLines.length > 0 ? (
          <View className="mt-4 px-5">
            <Card>
              <View className="p-4">
                {packageLines.map((line, index) => (
                  <View key={line.package_id}>
                    {index > 0 ? <Separator className="my-3" /> : null}

                    <View className="flex-row items-center gap-3">
                      <FoodImage
                        uri={line.image_url}
                        glyph="🍱"
                        className="h-14 w-14 rounded-2xl"
                      />

                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text
                            numberOfLines={1}
                            className="flex-1 text-sm font-bold text-text-primary"
                          >
                            {line.name}
                          </Text>
                          <Badge label={t('ordering.order.box')} variant="brand" />
                        </View>
                        <Text className="mt-0.5 text-xs text-text-muted">
                          {formatMoney(line.unit_price)} ·{' '}
                          {t('common.units.item', { count: line.item_count })}
                        </Text>
                        {unavailable.has(`package:${line.package_id}`) ? (
                          <Text className="mt-0.5 text-xs font-semibold text-danger">
                            {t('ordering.cart.unavailable')}
                          </Text>
                        ) : null}
                      </View>

                      <Stepper
                        size="sm"
                        value={line.quantity}
                        min={1}
                        label={t('ordering.a11y.quantity', { name: line.name })}
                        onChange={(next) => setPackageQuantity(line.package_id, next)}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}

        {/* Day */}
        <View className="mt-6">
          <StepLabel n={1} label={t('ordering.order.deliveryDay')} className="px-5" />
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
          <StepLabel n={2} label={t('ordering.mealTime')} />

          {slotOptions.length === 0 ? (
            <Text className="text-sm text-text-secondary">
              {t('ordering.order.loadingSlots')}
            </Text>
          ) : !hasBookableSlot ? (
            <View className="rounded-2xl bg-warning-soft px-4 py-3">
              <Text className="text-xs text-warning">
                {t('ordering.order.allClosed', { date: formatLongDate(deliveryDate ?? '') })}
              </Text>
            </View>
          ) : (
            <SlotPicker options={slotOptions} value={slotId} onChange={setSlot} />
          )}
        </View>

        {/* Address */}
        <View className="mt-6 px-5">
          <StepLabel n={3} label={t('ordering.deliveryAddress')} />
          <AddressPicker
            addresses={addresses ?? []}
            value={effectiveAddressId}
            onChange={setAddress}
            onAdd={() =>
              requireAuth(() => setAddressFormOpen(true), t('ordering.authReason.saveAddress'))
            }
          />
        </View>

        {needsPhone ? (
          <View className="mt-6 px-5">
            <StepLabel n={4} label={t('ordering.cart.phone')} />
            <Input
              testID="order-phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+966 5x xxx xxxx"
              hint={t('ordering.cart.phoneHint')}
              error={phoneError ?? undefined}
            />
          </View>
        ) : null}

        {/* Payment method */}
        <View className="mt-6 px-5">
          <StepLabel n={needsPhone ? 5 : 4} label={t('ordering.order.howToPay')} />
          <CashOnDeliveryCheckbox
            checked={useCash}
            onChange={setPayWithCash}
            total={total}
          />
        </View>

        {/* Total */}
        <View className="mt-6 px-5">
          <Card>
            <View className="p-5">
              {priced ? (
                <View className="mb-3 gap-1" testID="order-server-totals">
                  <SummaryRow
                    label={t('ordering.cart.subtotal')}
                    value={formatMoney(priced.subtotal)}
                  />
                  <SummaryRow
                    label={t('ordering.cart.delivery')}
                    value={
                      priced.delivery_fee > 0
                        ? formatMoney(priced.delivery_fee)
                        : t('ordering.cart.free')
                    }
                  />
                </View>
              ) : null}
              {priced?.has_unavailable ? (
                <View className="mb-3 rounded-2xl bg-warning-soft px-4 py-3">
                  <Text className="text-xs text-warning">{t('ordering.cart.removeUnavailable')}</Text>
                </View>
              ) : null}
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-text-primary">{t('ordering.total')}</Text>
                <Text className="text-xl font-bold text-brand-500">
                  {formatMoney(total)}
                </Text>
              </View>
              <Separator className="my-3" />

              <View className="gap-1">
                <SummaryRow
                  label={t('ordering.order.arriving')}
                  value={
                    deliveryDate ? formatLongDate(deliveryDate) : t('ordering.order.pickDay')
                  }
                />
                <SummaryRow
                  label={t('ordering.mealTime')}
                  value={
                    slotOptions.find((o) => o.slot.id === slotId)?.slot.name ??
                    t('ordering.order.pickSlot')
                  }
                />
                <SummaryRow
                  label={t('ordering.order.deliveringTo')}
                  value={
                    addresses?.find((a) => a.id === effectiveAddressId)
                      ? formatAddress(
                          addresses.find((a) => a.id === effectiveAddressId)!,
                        )
                      : t('ordering.order.defaultAddress')
                  }
                />
                <SummaryRow
                  label={t('ordering.order.payingBy')}
                  value={useCash ? t('ordering.paymentMethod.cash') : t('ordering.paymentMethod.card')}
                />
              </View>

              <Text className="mt-3 text-xs text-text-muted">
                {useCash
                  ? t('ordering.order.taxNoteCash')
                  : t('ordering.order.taxNoteCard')}
              </Text>
            </View>
          </Card>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={emptyBasket}
          className="mt-5 self-center px-5 py-2"
        >
          <Text className="text-sm font-semibold text-text-muted">
            {t('ordering.order.emptyBasket')}
          </Text>
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
            !signedIn
              ? t('ordering.order.signInToPlace')
              : useCash
                ? t('ordering.order.placeCash', { amount: formatMoney(total) })
                : t('ordering.order.place', { amount: formatMoney(total) })
          }
          size="lg"
          loading={createOrder.isPending}
          disabled={signedIn ? !canSubmit : isEmpty}
          onPress={
            signedIn ? submit : () => promptLogin(t('ordering.authReason.placeOrder'))
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
