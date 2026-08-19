import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  AddressFormSheet,
  AddressPicker,
  DayStrip,
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
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { Subscription } from '@/lib/api/types/subscription';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { isPayable, openCheckout } from '@/lib/payments';
import {
  useAddresses,
  useCreateSubscription,
  useDeliverySlots,
  useIsSignedIn,
  usePlan,
} from '@/lib/query/hooks';
import {
  planSlotAsDeliverySlot,
  slotAvailabilityFor,
  firstBookableSlotId,
} from '@/lib/slots';
import { useAuthPromptStore, useCartStore, useCartIsStale } from '@/lib/store';
import { formatLongDate, formatMoney, todayISO } from '@/lib/utils';

const LOOKAHEAD_DAYS = 14;

/**
 * Subscription checkout.
 *
 * A subscription buys **one** meal slot for the plan's whole duration — not
 * every meal the plan defines. `CreateSubscriptionRequest` enforces that the
 * chosen `slot_id` is one the plan actually serves ("This plan does not serve
 * that meal"), so the picker is built from `plan.slots` rather than the whole
 * `/delivery-slots` catalogue. That is the difference between a validation
 * error the customer can't interpret and a choice that can't be wrong.
 *
 * Reads the draft from `useCartStore`; the store's `onSuccess` clears it. The
 * API creates the subscription `pending` with a payment attached, so this hands
 * off to the gateway before landing on the subscription screen.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const plan = useCartStore((s) => s.plan);
  const slotId = useCartStore((s) => s.slotId);
  const addressId = useCartStore((s) => s.addressId);
  const startDate = useCartStore((s) => s.startDate);
  const setSlot = useCartStore((s) => s.setSlot);
  const setAddress = useCartStore((s) => s.setAddress);
  const setStartDate = useCartStore((s) => s.setStartDate);

  const isStale = useCartIsStale();

  // The plan detail carries `slots`; the cart snapshot deliberately doesn't.
  const { data: planDetail } = usePlan(plan?.id);
  const { data: catalogue } = useDeliverySlots();
  const { data: addresses } = useAddresses();

  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  /**
   * `after_or_equal:tomorrow` server-side, so today is never valid however
   * early it is. Derived rather than stored, which keeps it correct if the
   * screen is left open past midnight.
   */
  const earliest = todayISO(1);

  /**
   * The meals this plan serves, widened to full slots.
   *
   * `plan.slots` nests only what `PlanSchedule::slot()` emits, and its
   * `cutoff_hours` can be null; the `/delivery-slots` catalogue entry is
   * preferred where it exists because that is where a reliable cutoff lives.
   * With no plan detail yet, fall back to the whole catalogue so the customer
   * is never stuck with nothing to pick.
   */
  const planSlots = useMemo(() => {
    const byId = new Map((catalogue ?? []).map((s) => [s.id, s]));
    if (!planDetail?.slots || planDetail.slots.length === 0) return catalogue ?? [];
    return planDetail.slots.map((s) => byId.get(s.id) ?? planSlotAsDeliverySlot(s));
  }, [planDetail, catalogue]);

  const slotOptions = useMemo(
    () => (startDate ? slotAvailabilityFor(planSlots, startDate) : []),
    [planSlots, startDate],
  );

  /**
   * A start date is only valid if the chosen meal is still open on it.
   *
   * `useCallback`, not a `useMemo` returning a closure — the React Compiler
   * cannot preserve memoisation across the latter and bails out of optimising
   * the whole component.
   */
  const isDayDisabled = useCallback(
    (date: string) => {
      if (planSlots.length === 0) return false;
      const options = slotAvailabilityFor(planSlots, date);
      // Before a meal is chosen, a day counts as open if *any* meal is.
      if (slotId === null) return !options.some((o) => o.isBookable);
      const chosen = options.find((o) => o.slot.id === slotId);
      return chosen ? !chosen.isBookable : false;
    },
    [planSlots, slotId],
  );

  // Land on the earliest legal start; re-run when the meal choice narrows it.
  useEffect(() => {
    if (startDate && startDate >= earliest && !isDayDisabled(startDate)) return;

    const probe = new Date(`${earliest}T00:00:00`);
    for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
      const date = `${probe.getFullYear()}-${String(probe.getMonth() + 1).padStart(2, '0')}-${String(probe.getDate()).padStart(2, '0')}`;
      if (!isDayDisabled(date)) {
        setStartDate(date);
        return;
      }
      probe.setDate(probe.getDate() + 1);
    }
    setStartDate(earliest);
  }, [earliest, startDate, isDayDisabled, setStartDate]);

  // Default the meal to the first one still open on the chosen day.
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

  /**
   * Stable per draft, so a retry after a dropped response can't create a second
   * subscription and a second payment.
   */
  const idempotencyKey = useMemo(
    () =>
      plan
        ? `sub-${plan.id}-${startDate}-${slotId}-${plan.capturedAt}`
        : undefined,
    [plan, startDate, slotId],
  );

  const createSubscription = useCreateSubscription({
    onSuccess: async (subscription: Subscription) => {
      toast.success('Your plan is set up');

      // Deliveries are generated when the payment settles, not here — so send
      // the customer to pay before the subscription screen, which would
      // otherwise show an empty schedule and look broken.
      if (isPayable(subscription.payment)) {
        await openCheckout(subscription.payment.checkout_url);
      }
      router.replace({
        pathname: '/subscriptions/[id]',
        params: { id: String(subscription.id) },
      });
    },
  });

  if (!plan) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Checkout" variant="close" />
        <EmptyState
          title="Nothing selected"
          description="Pick a plan to get started."
          actionLabel="Browse plans"
          onAction={() => router.replace('/(tabs)/plans')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const hasBookableSlot = slotOptions.some((o) => o.isBookable);
  const canSubmit =
    slotId !== null &&
    startDate !== null &&
    hasBookableSlot &&
    !createSubscription.isPending;

  const submit = () => {
    if (!canSubmit || slotId === null || !startDate) return;
    setSubmitError(null);

    createSubscription.mutate(
      {
        payload: {
          plan_id: plan.id,
          slot_id: slotId,
          address_id: effectiveAddressId,
          start_date: startDate,
        },
        idempotencyKey,
      },
      {
        onError: (error) => {
          setSubmitError(error);
          toast.error(isApiError(error) ? error.message : 'Checkout failed');
        },
      },
    );
  };

  const chosenSlot = slotOptions.find((o) => o.slot.id === slotId)?.slot;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Checkout" subtitle={plan.name} variant="close" />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingVertical: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isStale ? (
          <View className="mx-5 mb-4 rounded-2xl bg-warning-soft px-4 py-3">
            <Text className="text-xs text-warning">
              This selection is over a day old — the price will be confirmed by the
              server when you continue.
            </Text>
          </View>
        ) : null}

        {submitError ? (
          <InlineError error={submitError} className="mx-5 mb-4" />
        ) : null}

        <View className="px-5">
          <Card>
            <View className="p-5">
              <Text className="text-lg font-bold text-text-primary">{plan.name}</Text>
              <Text className="mt-0.5 text-sm text-text-secondary">
                One meal a day for {plan.duration_days} days
              </Text>

              <Separator className="my-4" />

              <Row
                label="Starts"
                value={startDate ? formatLongDate(startDate) : 'Choosing…'}
              />
              <Row label="Meal" value={chosenSlot?.name ?? 'Choosing…'} />
              <Row
                label="Delivery to"
                value={
                  addresses?.find((a) => a.id === effectiveAddressId)?.line1 ??
                  'Account default'
                }
              />

              <Separator className="my-4" />

              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-text-primary">Total</Text>
                <Text className="text-xl font-bold text-brand-500">
                  {formatMoney(plan.price)}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-text-muted">
                Charged once. The final total is confirmed at checkout.
              </Text>
            </View>
          </Card>
        </View>

        {/* Meal */}
        <View className="mt-6 px-5">
          <Text className="mb-1 text-sm font-bold text-text-primary">
            Which meal?
          </Text>
          <Text className="mb-3 text-xs text-text-muted">
            Your subscription delivers this meal every day of the plan.
          </Text>

          {slotOptions.length === 0 ? (
            <Text className="text-sm text-text-secondary">Loading meals…</Text>
          ) : (
            <SlotPicker options={slotOptions} value={slotId} onChange={setSlot} />
          )}
        </View>

        {/* Start date */}
        <View className="mt-6">
          <Text className="mb-1 px-5 text-sm font-bold text-text-primary">
            Start date
          </Text>
          <Text className="mb-3 px-5 text-xs text-text-muted">
            Deliveries begin on this day. Days whose cutoff has passed for your
            chosen meal can&apos;t be used.
          </Text>
          <DayStrip
            value={startDate}
            onChange={setStartDate}
            from={earliest}
            days={LOOKAHEAD_DAYS}
            isDisabled={isDayDisabled}
          />
        </View>

        {/* Address */}
        <View className="mt-6 px-5">
          <Text className="mb-3 text-sm font-bold text-text-primary">
            Delivery address
          </Text>
          <AddressPicker
            addresses={addresses ?? []}
            value={effectiveAddressId}
            onChange={setAddress}
            onAdd={() =>
              requireAuth(() => setAddressFormOpen(true), 'to save an address')
            }
          />
        </View>
      </ScrollView>

      <View className="border-t border-border px-5 pb-6 pt-4">
        {/* Signed out this opens the sign-in sheet and stops — see the same
            note in `order.tsx`: submitting straight after sign-in would race
            the `/addresses` fetch and create a subscription with no address. */}
        <Button
          label={
            signedIn
              ? `Subscribe · ${formatMoney(plan.price)}`
              : 'Sign in to start this plan'
          }
          size="lg"
          loading={createSubscription.isPending}
          disabled={signedIn ? !canSubmit : false}
          onPress={signedIn ? submit : () => promptLogin('to start this plan')}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text numberOfLines={1} className="flex-1 text-right text-sm font-semibold text-text-primary">
        {value}
      </Text>
    </View>
  );
}
