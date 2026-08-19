import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { OfflineBanner, QuotaMeterList, ScreenHeader } from '@/components/shared';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  ErrorState,
  Separator,
  Skeleton,
  SkeletonText,
  type BadgeVariant,
} from '@/components/ui';
import { weekForDate } from '@/lib/api/endpoints/quota';
import { isApiError } from '@/lib/api/types/common';
import type { Delivery, SubscriptionStatus } from '@/lib/api/types/subscription';
import { isPayable, openCheckout } from '@/lib/payments';
import {
  useDeliverySlotMap,
  usePauseSubscription,
  useQuota,
  useResumeSubscription,
  useSubscription,
  useSubscriptionDeliveries,
} from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { formatLongDate, formatMoney, formatShortDate, todayISO } from '@/lib/utils';

const STATUS_VARIANT: Record<SubscriptionStatus, BadgeVariant> = {
  active: 'success',
  paused: 'warning',
  pending: 'warning',
  completed: 'muted',
  cancelled: 'danger',
};

/**
 * One subscription order, in full.
 *
 * Everything the API knows about this purchase, in the order a customer asks
 * about it: what it is and whether it's live, what it cost and whether that
 * settled, what allowance is left this week, and which days are coming.
 *
 * Pausing lives here rather than on a delivery, because of what it does to the
 * *whole* subscription: each paused date releases its quota and appends a
 * compensating day past `end_date`, so the plan gets longer. That is a decision
 * about the subscription, not about one day's food.
 */
export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = todayISO();

  const {
    data: subscription,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSubscription(id);

  const { data: quotas, isLoading: quotaLoading } = useQuota(subscription?.id);
  const { data: deliveries, isLoading: deliveriesLoading } = useSubscriptionDeliveries(
    subscription?.id,
  );
  const { data: slotById } = useDeliverySlotMap();

  const pause = usePauseSubscription(subscription?.id ?? 0);
  const resume = useResumeSubscription(subscription?.id ?? 0);

  const [pendingPause, setPendingPause] = useState<Delivery | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Subscription" />
        <View className="gap-4 p-5">
          <Skeleton className="h-40 w-full" />
          <SkeletonText lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !subscription) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Subscription" />
        <ErrorState
          error={error}
          onRetry={refetch}
          retrying={isFetching}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const slot = slotById?.get(subscription.slot_id);
  const awaitingPayment = isPayable(subscription.payment);
  const currentWeek = weekForDate(subscription.start_date, today);
  const upcoming = (deliveries ?? []).filter((d) => d.delivery_date >= today).slice(0, 10);

  // `end_date` moves later each time a day is paused; `original_end_date` is
  // where it started. Showing both is the only way the extension is legible.
  const extendedDays = daysBetween(
    subscription.original_end_date,
    subscription.end_date,
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={subscription.plan?.name ?? `Subscription #${subscription.id}`}
        subtitle={`#${subscription.id}${slot ? ` · ${slot.name}` : ''}`}
      />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        {/* Nothing is generated until the payment settles, so an unpaid
            subscription looks identical to a broken one unless we say so. */}
        {awaitingPayment ? (
          <Card className="mb-4 border-warning">
            <View className="p-5">
              <Text className="text-sm font-bold text-text-primary">
                Payment not finished
              </Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Your deliveries are scheduled once the payment goes through.
              </Text>
              <Button
                label="Complete payment"
                className="mt-4"
                onPress={() => openCheckout(subscription.payment!.checkout_url!)}
              />
            </View>
          </Card>
        ) : null}

        {/* ── The order itself ────────────────────────────────────────────── */}
        <Card>
          <View className="p-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-lg font-bold text-text-primary">
                  {subscription.plan?.name ?? 'Your plan'}
                </Text>
                {subscription.plan ? (
                  <Text className="mt-0.5 text-xs text-text-muted">
                    One meal a day for {subscription.plan.duration_days} days
                  </Text>
                ) : null}
              </View>

              <Badge
                label={subscription.status}
                variant={STATUS_VARIANT[subscription.status] ?? 'muted'}
                className="capitalize"
              />
            </View>

            <Separator className="my-4" />

            <Row label="Meal" value={slot ? `${slot.name} · ${slotWindow(slot)}` : '—'} />
            <Row label="Starts" value={formatLongDate(subscription.start_date)} />
            <Row
              label="Ends"
              value={
                extendedDays > 0
                  ? `${formatLongDate(subscription.end_date)} (+${extendedDays}d)`
                  : formatLongDate(subscription.end_date)
              }
            />
            {extendedDays > 0 ? (
              <Row
                label="Originally ended"
                value={formatLongDate(subscription.original_end_date)}
              />
            ) : null}
            {subscription.activated_at ? (
              <Row
                label="Activated"
                value={formatLongDate(subscription.activated_at.slice(0, 10))}
              />
            ) : null}

            <Separator className="my-4" />

            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-primary">Paid</Text>
              <Text className="text-xl font-bold text-brand-500">
                {formatMoney(subscription.price_paid)}
              </Text>
            </View>

            {subscription.payment ? (
              <View className="mt-3 gap-1">
                <Row label="Payment status" value={subscription.payment.status} />
                <Row label="Method" value={subscription.payment.gateway} />
                {subscription.payment.paid_at ? (
                  <Row
                    label="Paid on"
                    value={formatLongDate(subscription.payment.paid_at.slice(0, 10))}
                  />
                ) : null}
              </View>
            ) : null}

            {subscription.status === 'cancelled' && subscription.cancellation_reason ? (
              <View className="mt-3 rounded-2xl bg-danger-soft px-4 py-3">
                <Text className="text-xs text-danger">
                  {subscription.cancellation_reason}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        {/* ── This week's allowance ───────────────────────────────────────── */}
        <View className="mt-6">
          <Text className="mb-1 text-lg font-bold text-text-primary">
            This week&apos;s allowance
          </Text>
          <Text className="mb-3 text-xs text-text-muted">
            Week {currentWeek} of your plan — how many times you can still have
            each dish.
          </Text>

          {quotaLoading ? (
            <SkeletonText lines={4} />
          ) : !quotas || quotas.length === 0 ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  No per-item limits on this plan.
                </Text>
              </View>
            </Card>
          ) : (
            <Card>
              <View className="p-5">
                <QuotaMeterList quotas={quotas} weekNumber={currentWeek} />
              </View>
            </Card>
          )}
        </View>

        {/* ── Upcoming days ───────────────────────────────────────────────── */}
        <View className="mt-6">
          <Text className="mb-1 text-lg font-bold text-text-primary">Coming up</Text>
          <Text className="mb-3 text-xs text-text-muted">
            Skipping a day frees its allowance and extends your plan by a day.
          </Text>

          {deliveriesLoading ? (
            <SkeletonText lines={5} />
          ) : upcoming.length === 0 ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  No upcoming deliveries.
                </Text>
              </View>
            </Card>
          ) : (
            <View className="gap-2">
              {upcoming.map((delivery) => {
                const paused = delivery.status === 'paused';

                return (
                  <View
                    key={delivery.id}
                    className="rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${formatShortDate(delivery.delivery_date)}`}
                      onPress={() => router.push('/deliveries')}
                      className="flex-row items-center justify-between gap-3 active:opacity-80"
                    >
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-text-primary">
                          {formatShortDate(delivery.delivery_date)}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className="mt-0.5 text-xs text-text-muted"
                        >
                          {(delivery.items ?? [])
                            .filter((i) => !i.is_addon)
                            .map((i) => i.menu_item?.name)
                            .filter(Boolean)
                            .join(' · ') || 'Menu to be confirmed'}
                        </Text>
                      </View>

                      {paused ? (
                        <Badge label="Skipped" variant="muted" />
                      ) : delivery.is_customized ? (
                        <Badge label="Swapped" variant="brand" />
                      ) : delivery.status !== 'scheduled' ? (
                        <Badge
                          label={delivery.status}
                          variant="muted"
                          className="capitalize"
                        />
                      ) : null}
                    </Pressable>

                    {/* Only offered before the cutoff — the API refuses after,
                        and a button that always 422s is worse than no button. */}
                    {delivery.before_cutoff ? (
                      <Button
                        label={paused ? 'Un-skip this day' : 'Skip this day'}
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        className="mt-1 self-start"
                        loading={
                          (paused ? resume.isPending : pause.isPending) &&
                          pendingPause?.id === delivery.id
                        }
                        onPress={() => {
                          if (paused) {
                            setPendingPause(delivery);
                            resume.mutate(delivery.delivery_date, {
                              onSuccess: () => {
                                setPendingPause(null);
                                toast.success('Day restored');
                              },
                              onError: (e) => {
                                setPendingPause(null);
                                toast.error(
                                  isApiError(e)
                                    ? e.message
                                    : 'Could not restore that day',
                                );
                              },
                            });
                          } else {
                            setPendingPause(delivery);
                          }
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <Button
          label="View full schedule"
          variant="outline"
          className="mt-6"
          onPress={() => router.push('/deliveries')}
        />
      </ScrollView>

      <AlertDialog
        open={pendingPause !== null && pendingPause.status !== 'paused'}
        onClose={() => setPendingPause(null)}
        onConfirm={() => {
          if (!pendingPause) return;
          pause.mutate(
            { dates: [pendingPause.delivery_date] },
            {
              onSuccess: () => {
                setPendingPause(null);
                toast.success('Day skipped — your plan now runs a day longer');
              },
              onError: (e) => {
                setPendingPause(null);
                toast.error(isApiError(e) ? e.message : 'Could not skip that day');
              },
            },
          );
        }}
        title="Skip this day?"
        description={
          pendingPause
            ? `No delivery on ${formatShortDate(pendingPause.delivery_date)}. Its allowance is released and your plan is extended by one day, so you lose nothing.`
            : undefined
        }
        confirmLabel="Skip it"
        cancelLabel="Keep it"
        loading={pause.isPending}
      />
    </SafeAreaView>
  );
}

/** Whole days from `from` to `to`, floored at 0. Both are YYYY-MM-DD. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <Text className="text-sm text-text-secondary">{label}</Text>
      <Text
        numberOfLines={1}
        className="flex-1 text-right text-sm font-semibold capitalize text-text-primary"
      >
        {value}
      </Text>
    </View>
  );
}
