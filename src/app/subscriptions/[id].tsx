import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  DeliveryAddressBlock,
  OfflineBanner,
  QuotaMeterList,
  ScreenHeader,
} from '@/components/shared';
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
  const { t } = useTranslation();
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

  const pause = usePauseSubscription(subscription?.id ?? 0);
  const resume = useResumeSubscription(subscription?.id ?? 0);

  const [pendingPause, setPendingPause] = useState<Delivery | null>(null);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('account.subscription.title')} />
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
        <ScreenHeader title={t('account.subscription.title')} />
        <ErrorState
          error={error}
          onRetry={refetch}
          retrying={isFetching}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const meals = subscription.slots;
  const awaitingPayment = isPayable(subscription.payment);
  // `weekForDate` mirrors the backend's `QuotaService::weekFor()`, which counts
  // forward from the start date and so returns 0 or less for a plan that hasn't
  // begun — a subscription bought today starts tomorrow at the earliest. Week 1
  // is the honest answer there: it is the allowance the customer will get first.
  const currentWeek = Math.max(1, weekForDate(subscription.start_date, today));
  const hasStarted = today >= subscription.start_date;

  // Ten *days*, not ten deliveries: with three meals a day the raw slice would
  // show barely three days of the run.
  const upcomingDates = [
    ...new Set(
      (deliveries ?? [])
        .filter((d) => d.delivery_date >= today)
        .map((d) => d.delivery_date),
    ),
  ]
    .sort()
    .slice(0, 10);

  // Every date the plan covers, so the preview above can be honest about how
  // much of it it is actually showing.
  const totalDays = new Set((deliveries ?? []).map((d) => d.delivery_date)).size;

  // `end_date` moves later each time a day is paused; `original_end_date` is
  // where it started. Showing both is the only way the extension is legible.
  const extendedDays = daysBetween(
    subscription.original_end_date,
    subscription.end_date,
  );

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={subscription.plan?.name ?? t('account.subscriptionNumber', { id: subscription.id })}
        subtitle={`\u2068#${subscription.id}\u2069${meals.length > 0 ? ` · ${meals.map((m) => m.name).join(', ')}` : ''}`}
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
                {t('account.subscription.paymentNotFinished')}
              </Text>
              <Text className="mt-1 text-xs text-text-secondary">
                {t('account.subscription.paymentNotFinishedBody')}
              </Text>
              <Button
                label={t('account.subscription.completePayment')}
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
                  {subscription.plan?.name ?? t('account.deliveries.yourPlan')}
                </Text>
                {subscription.plan ? (
                  <Text className="mt-0.5 text-xs text-text-muted">
                    {meals.length > 1
                      ? t('account.subscription.mealsADayFor', {
                          meals: t('account.deliveries.mealsPerDay', { count: meals.length }),
                          days: t('common.units.day', { count: subscription.plan.duration_days }),
                        })
                      : t('account.subscription.everyMealFor', {
                          days: t('common.units.day', { count: subscription.plan.duration_days }),
                        })}
                  </Text>
                ) : null}
              </View>

              <Badge
                label={t(`common.status.${subscription.status}`, { defaultValue: subscription.status })}
                variant={STATUS_VARIANT[subscription.status] ?? 'muted'}
                className="capitalize"
              />
            </View>

            <Separator className="my-4" />

            {meals.length === 0 ? (
              <Row label={t('account.subscription.meals')} value="—" />
            ) : (
              meals.map((meal) => (
                <Row
                  key={meal.id}
                  label={meal.name}
                  value={slotWindow(meal)}
                />
              ))
            )}
            <Row label={t('account.subscription.starts')} value={formatLongDate(subscription.start_date)} />
            <Row
              label={t('account.subscription.ends')}
              value={
                extendedDays > 0
                  ? t('account.subscription.endsExtended', {
                      date: formatLongDate(subscription.end_date),
                      extra: t('common.units.day', { count: extendedDays }),
                    })
                  : formatLongDate(subscription.end_date)
              }
            />
            {extendedDays > 0 ? (
              <Row
                label={t('account.subscription.originallyEnded')}
                value={formatLongDate(subscription.original_end_date)}
              />
            ) : null}
            {subscription.activated_at ? (
              <Row
                label={t('account.subscription.activated')}
                value={formatLongDate(subscription.activated_at.slice(0, 10))}
              />
            ) : null}

            <DeliveryAddressBlock
              address={subscription.delivery_address}
              className="mt-3"
            />

            <Separator className="my-4" />

            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-text-primary">{t('account.paid')}</Text>
              <Text className="text-xl font-bold text-brand-500">
                {formatMoney(subscription.price_paid)}
              </Text>
            </View>

            {subscription.payment ? (
              <View className="mt-3 gap-1">
                <Row
                  label={t('account.subscription.paymentStatus')}
                  value={t(`common.status.${subscription.payment.status}`, {
                    defaultValue: subscription.payment.status,
                  })}
                />
                <Row label={t('account.subscription.method')} value={subscription.payment.gateway} />
                {subscription.payment.paid_at ? (
                  <Row
                    label={t('account.subscription.paidOn')}
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
            {hasStarted
              ? t('account.subscription.thisWeekAllowance')
              : t('account.subscription.firstWeekAllowance')}
          </Text>
          <Text className="mb-3 text-xs text-text-muted">
            {hasStarted
              ? t('account.subscription.allowanceHint', { week: currentWeek })
              : t('account.subscription.allowanceNotStarted', {
                  date: formatLongDate(subscription.start_date),
                })}
          </Text>

          {quotaLoading ? (
            <SkeletonText lines={4} />
          ) : !quotas || quotas.length === 0 ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  {t('account.subscription.noLimits')}
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
          <Text className="mb-1 text-lg font-bold text-text-primary">
            {t('account.subscription.comingUp')}
          </Text>
          <Text className="mb-3 text-xs text-text-muted">
            {upcomingDates.length > 0
              ? t('account.subscription.comingUpHint', {
                  count: upcomingDates.length,
                  total: totalDays,
                })
              : t('account.subscription.skipHint')}
          </Text>

          {deliveriesLoading ? (
            <SkeletonText lines={5} />
          ) : upcomingDates.length === 0 ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  {t('account.subscription.noUpcoming')}
                </Text>
              </View>
            </Card>
          ) : (
            <View className="gap-2">
              {upcomingDates.map((date) => {
                // A day is every meal on it, in time order. Skipping is a
                // decision about the day, not about one of its meals — the API
                // pauses them together — so the row is the day.
                const dayMeals = (deliveries ?? [])
                  .filter((d) => d.delivery_date === date)
                  .sort((a, b) =>
                    (a.slot?.start_time ?? '99:99').localeCompare(
                      b.slot?.start_time ?? '99:99',
                    ),
                  );

                const paused = dayMeals.every((d) => d.status === 'paused');
                const swapped = dayMeals.some((d) => d.is_customized);
                // Pause needs every meal still open: the API refuses the whole
                // day if any one of them has closed.
                const canPause = dayMeals.every((d) => d.before_cutoff);
                const anchor = dayMeals[0];
                const busy = pendingPause?.delivery_date === date;

                return (
                  <View
                    key={date}
                    className="rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('account.subscription.openDay', { date: formatShortDate(date) })}
                      onPress={() => router.push('/deliveries')}
                      className="flex-row items-start justify-between gap-3 active:opacity-80"
                    >
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-text-primary">
                          {formatShortDate(date)}
                        </Text>

                        {dayMeals.map((meal) => (
                          <Text
                            key={meal.id}
                            numberOfLines={1}
                            className="mt-0.5 text-xs text-text-muted"
                          >
                            <Text className="font-semibold">
                              {t('account.subscription.mealLabel', { name: meal.slot?.name ?? t('account.meal') })}{' '}
                            </Text>
                            {(meal.items ?? [])
                              .filter((i) => !i.is_addon)
                              .map((i) => i.menu_item?.name)
                              .filter(Boolean)
                              .join(' · ') || t('account.menuTbc')}
                          </Text>
                        ))}
                      </View>

                      {paused ? (
                        <Badge label={t('common.status.skipped')} variant="muted" />
                      ) : swapped ? (
                        <Badge label={t('account.swapped')} variant="brand" />
                      ) : null}
                    </Pressable>

                    {/* Only offered while every meal that day is still open —
                        the API refuses otherwise, and a button that always
                        422s is worse than no button. */}
                    {paused || canPause ? (
                      <Button
                        label={paused ? t('account.subscription.unskipDay') : t('account.subscription.skipDay')}
                        variant="ghost"
                        size="sm"
                        fullWidth={false}
                        className="mt-1 self-start"
                        loading={(paused ? resume.isPending : pause.isPending) && busy}
                        onPress={() => {
                          if (!anchor) return;
                          if (paused) {
                            setPendingPause(anchor);
                            resume.mutate(date, {
                              onSuccess: () => {
                                setPendingPause(null);
                                toast.success(t('account.subscription.dayRestored'));
                              },
                              onError: (e) => {
                                setPendingPause(null);
                                toast.error(
                                  isApiError(e)
                                    ? e.message
                                    : t('account.subscription.restoreFailed'),
                                );
                              },
                            });
                          } else {
                            setPendingPause(anchor);
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

        <View className="mt-6 gap-2">
          <Button
            label={t('account.subscription.viewSchedule')}
            onPress={() =>
              router.push({
                pathname: '/schedule',
                params: { subscription: String(subscription.id) },
              })
            }
          />
          <Button
            label={t('account.schedule.changeMeal')}
            variant="outline"
            onPress={() => router.push('/deliveries')}
          />
        </View>
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
                toast.success(t('account.subscription.daySkipped'));
              },
              onError: (e) => {
                setPendingPause(null);
                toast.error(isApiError(e) ? e.message : t('account.subscription.skipFailed'));
              },
            },
          );
        }}
        title={t('account.subscription.skipTitle')}
        description={
          pendingPause
            ? t('account.subscription.skipBody', { date: formatShortDate(pendingPause.delivery_date) })
            : undefined
        }
        confirmLabel={t('account.subscription.skipConfirm')}
        cancelLabel={t('account.subscription.skipCancel')}
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
