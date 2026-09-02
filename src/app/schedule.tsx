import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, ScheduleDayCard, ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonText,
  Tabs,
  type TabItem,
} from '@/components/ui';
import type { ScheduleDay } from '@/lib/api/types/swap';
import {
  useCurrentSubscription,
  useIsSignedIn,
  useSubscription,
  useSubscriptionSchedule,
} from '@/lib/query/hooks';
import { useAuthHydrated, useAuthPromptStore } from '@/lib/store';
import { formatShortDate, isToday, todayISO } from '@/lib/utils';

/**
 * My Plan — the complete food schedule, every day of the subscription.
 *
 * This is the mobile counterpart of the website's "My Plan" page, and it reads
 * the same endpoint: `GET /subscriptions/{id}/schedule`, which returns the whole
 * run already grouped into quota weeks. One request holds all 30 days, so
 * switching weeks costs nothing.
 *
 * Deliberately *not* built from `GET /deliveries`. That endpoint pages at 50
 * rows across every subscription the customer owns, which is what left this app
 * showing six days of a thirty-day plan; the schedule endpoint is scoped to one
 * subscription and complete by construction.
 *
 * Read-only by design. Changing a meal — swapping a dish, adding an extra,
 * skipping a day — has cutoff rules that belong on the Deliveries screen, which
 * a day card opens on the correct date.
 */
export default function ScheduleScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);
  // Persist rehydration is async, so `signedIn` is false for a beat on a cold
  // start. Reading it before then greets a signed-in customer with the
  // sign-in prompt on every launch.
  const authHydrated = useAuthHydrated();
  const scrollRef = useRef<ScrollView>(null);

  // Reachable two ways: `/schedule` for whichever subscription is current, and
  // `/schedule?subscription=16` from a specific subscription's detail screen.
  const { subscription: subscriptionParam } = useLocalSearchParams<{
    subscription?: string;
  }>();

  const { data: current, isLoading: currentLoading } = useCurrentSubscription();
  const { data: named } = useSubscription(subscriptionParam);
  const subscription = subscriptionParam ? named : current;

  const {
    data: schedule,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSubscriptionSchedule(subscription?.id);

  const weeks = useMemo(() => schedule?.weeks ?? [], [schedule]);

  /** The week containing today, so the screen opens where the customer is. */
  const todaysWeek = useMemo(() => {
    const today = todayISO();
    const match = weeks.find((week) => week.days.some((day) => day.date === today));
    return match?.week_number ?? weeks[0]?.week_number ?? 1;
  }, [weeks]);

  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const week = openWeek ?? todaysWeek;

  const activeWeek = weeks.find((w) => w.week_number === week) ?? weeks[0];
  const days: ScheduleDay[] = activeWeek?.days ?? [];

  const totals = useMemo(() => countDays(weeks), [weeks]);

  const weekTabs = useMemo<TabItem<number>[]>(
    () =>
      weeks.map((w) => ({
        value: w.week_number,
        label: `Week ${w.week_number}`,
        sublabel: `${formatShortDate(w.starts_on).replace(/^\w+, /, '')} →`,
      })),
    [weeks],
  );

  const jumpToToday = () => {
    setOpenWeek(todaysWeek);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ── Signed out ────────────────────────────────────────────────────────────
  if (authHydrated && !signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="My plan" />
        <EmptyState
          title="Your full schedule lives here"
          description="Sign in to see every day of your plan, meal by meal."
          actionLabel="Sign in"
          onAction={() => promptLogin('to see your schedule')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!authHydrated || currentLoading || (subscription && isLoading)) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="My plan" />
        <View className="gap-4 p-5">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <SkeletonText lines={6} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No plan ───────────────────────────────────────────────────────────────
  if (!subscription) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="My plan" />
        <EmptyState
          title="No active plan"
          description="Subscribe to a meal plan and your full schedule appears here."
          actionLabel="Browse plans"
          onAction={() => router.push('/(tabs)/plans')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  const meals = subscription.slots.map((s) => s.name).join(' · ');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={subscription.plan?.name ?? 'My plan'}
        subtitle={meals ? `${meals}, every day` : `Subscription #${subscription.id}`}
      />
      <OfflineBanner />

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        {isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : weeks.length === 0 ? (
          <EmptyState
            title="Nothing scheduled yet"
            description="Your days appear here once your payment is confirmed."
            actionLabel="Refresh"
            onAction={refetch}
            className="py-16"
          />
        ) : (
          <>
            {/* ── At a glance ─────────────────────────────────────────────── */}
            <View className="px-5 pt-4">
              <Card>
                <View className="p-5">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase text-brand-500">
                        Your schedule
                      </Text>
                      <Text className="mt-0.5 text-lg font-bold text-text-primary">
                        {totals.total} days of meals
                      </Text>
                      <Text className="mt-0.5 text-xs text-text-muted">
                        {formatShortDate(schedule!.start_date)} →{' '}
                        {formatShortDate(schedule!.end_date)}
                      </Text>
                    </View>
                    <Badge
                      label={`${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`}
                      variant="brand"
                    />
                  </View>

                  {/* Progress through the run. `served` counts calendar days
                      behind today, which is what "day 9 of 30" means to a
                      customer — not how many deliveries have been marked. */}
                  <View className="mt-4 gap-1.5">
                    <View className="flex-row items-center justify-between">
                      {/* Before the first delivery there is no "day 1 of 30" to
                          be on — saying so alongside "30 days left" reads as an
                          off-by-one. Count down to the start instead. */}
                      <Text className="text-xs font-semibold text-text-secondary">
                        {totals.served === 0
                          ? `Starts ${formatShortDate(schedule!.start_date)}`
                          : `Day ${totals.served} of ${totals.total}`}
                      </Text>
                      <Text className="text-xs text-text-muted">
                        {totals.remaining} days left
                      </Text>
                    </View>
                    <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <View
                        className="h-full rounded-full bg-brand-500"
                        style={{
                          width: `${
                            totals.total > 0
                              ? Math.min(100, (totals.served / totals.total) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </View>
                  </View>

                  <View className="mt-4 flex-row gap-2">
                    <Button
                      label="Jump to today"
                      variant="secondary"
                      size="sm"
                      fullWidth={false}
                      className="flex-1"
                      onPress={jumpToToday}
                    />
                    <Button
                      label="Change a meal"
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      className="flex-1"
                      onPress={() => router.push('/deliveries')}
                    />
                  </View>
                </View>
              </Card>
            </View>

            {/* ── Week selector ───────────────────────────────────────────── */}
            {weekTabs.length > 1 ? (
              <View className="pt-5">
                <Tabs
                  items={weekTabs}
                  value={week}
                  onChange={setOpenWeek}
                  scrollable
                />
              </View>
            ) : null}

            {/* ── The week ────────────────────────────────────────────────── */}
            <View className="px-5 pt-5">
              <Text className="mb-1 text-lg font-bold text-text-primary">
                {activeWeek
                  ? `Week ${activeWeek.week_number}`
                  : 'Your days'}
              </Text>
              <Text className="mb-4 text-xs text-text-muted">
                {activeWeek
                  ? `${formatShortDate(activeWeek.starts_on)} → ${formatShortDate(activeWeek.ends_on)} · tap a day to change a meal`
                  : ''}
              </Text>

              <View className="gap-3">
                {days.map((day) => (
                  <ScheduleDayCard
                    key={day.date}
                    day={day}
                    onOpen={() => router.push('/deliveries')}
                  />
                ))}
              </View>
            </View>

            {/* A schedule that stops at the last day of a week leaves the
                customer guessing whether that is the end of the plan. */}
            {activeWeek?.week_number === weeks[weeks.length - 1]?.week_number ? (
              <Text className="mt-5 px-5 text-center text-xs text-text-muted">
                That&apos;s the end of your plan — it finishes on{' '}
                {formatShortDate(schedule!.end_date)}.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Days in the run, and how many are behind us.
 *
 * Counted from the schedule itself rather than from `start_date`/`end_date`
 * arithmetic: pausing a day appends a compensating one at the end, so the
 * schedule is the only thing that knows how many days the customer actually
 * has.
 */
function countDays(weeks: { days: ScheduleDay[] }[]): {
  total: number;
  served: number;
  remaining: number;
} {
  const today = todayISO();
  let total = 0;
  let served = 0;

  for (const week of weeks) {
    for (const day of week.days) {
      total += 1;
      if (day.date < today || isToday(day.date)) served += 1;
    }
  }

  return { total, served, remaining: Math.max(0, total - served) };
}
