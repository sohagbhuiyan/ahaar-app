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
  PlanMealsIncluded,
  ScreenHeader,
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
import { planSlotAsDeliverySlot, slotAvailabilityFor } from '@/lib/slots';
import { useAuthPromptStore, useCartStore, useCartIsStale } from '@/lib/store';
import { formatLongDate, formatMoney, todayISO } from '@/lib/utils';

const LOOKAHEAD_DAYS = 14;

/**
 * Subscription checkout.
 *
 * A subscription buys **every meal the plan serves**, not one: the plan's flat
 * price covers the whole board its weekly menu defines, so the covered meals are
 * read off the plan server-side and there is nothing here to pick. What the page
 * collects is where and from when.
 *
 * The start date is floored at the first day on which *every* covered meal is
 * still open — the subscription delivers all of them from day one, so the
 * strictest cutoff wins, not the loosest.
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
  const addressId = useCartStore((s) => s.addressId);
  const startDate = useCartStore((s) => s.startDate);
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
   */
  const planSlots = useMemo(() => {
    const byId = new Map((catalogue ?? []).map((s) => [s.id, s]));
    if (!planDetail?.slots || planDetail.slots.length === 0) return [];
    return planDetail.slots.map((s) => byId.get(s.id) ?? planSlotAsDeliverySlot(s));
  }, [planDetail, catalogue]);

  /**
   * A start date is only valid when **every** covered meal is still open on it.
   *
   * `useCallback`, not a `useMemo` returning a closure — the React Compiler
   * cannot preserve memoisation across the latter and bails out of optimising
   * the whole component.
   */
  const isDayDisabled = useCallback(
    (date: string) => {
      if (planSlots.length === 0) return false;
      return slotAvailabilityFor(planSlots, date).some((o) => !o.isBookable);
    },
    [planSlots],
  );

  // Land on the earliest legal start; re-run when the plan's meals load.
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
    () => (plan ? `sub-${plan.id}-${startDate}-${plan.capturedAt}` : undefined),
    [plan, startDate],
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

  const mealsKnown = planSlots.length > 0;
  const canSubmit =
    mealsKnown && startDate !== null && !createSubscription.isPending;

  const submit = () => {
    if (!canSubmit || !startDate) return;
    setSubmitError(null);

    createSubscription.mutate(
      {
        payload: {
          plan_id: plan.id,
          address_id: effectiveAddressId,
          start_date: startDate,
          // No meal to send: the subscription covers every one the plan serves.
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
                {planSlots.length > 1
                  ? `${planSlots.length} meals a day for ${plan.duration_days} days`
                  : `Every meal in this plan, daily for ${plan.duration_days} days`}
              </Text>

              <Separator className="my-4" />

              <Row
                label="Starts"
                value={startDate ? formatLongDate(startDate) : 'Choosing…'}
              />
              <Row
                label="Meals"
                value={
                  mealsKnown
                    ? planSlots.map((s) => s.name).join(' · ')
                    : 'Loading…'
                }
              />
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

        {/* What's included */}
        <View className="mt-6 px-5">
          <Text className="mb-1 text-sm font-bold text-text-primary">
            Meals included
          </Text>
          <Text className="mb-3 text-xs text-text-muted">
            Every one of these is delivered daily for the whole plan.
          </Text>

          {planDetail ? (
            <PlanMealsIncluded slots={planSlots} durationDays={plan.duration_days} />
          ) : (
            <Text className="text-sm text-text-secondary">Loading meals…</Text>
          )}
        </View>

        {/* Start date */}
        <View className="mt-6">
          <Text className="mb-1 px-5 text-sm font-bold text-text-primary">
            Start date
          </Text>
          <Text className="mb-3 px-5 text-xs text-text-muted">
            Deliveries begin on this day. A day is unavailable once any of your
            meals has closed for it.
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
