import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { I18nManager, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import BrandDecor from '@/components/illustrations/BrandDecor';
import {
  DeliveryCalendar,
  ExtraOrderSheet,
  FoodImage,
  GuestOrderSheet,
  LiveStatusPill,
  MealSwapSheet,
  OfflineBanner,
  ScreenHeader,
} from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import type { Delivery, DeliveryItem, Subscription } from '@/lib/api/types/subscription';
import {
  buildDeliveryWeeks,
  dayOfMonth,
  defaultDeliveryDate,
  formatCutoff,
  formatDayHeading,
  formatDayMonth,
  groupDeliveriesByDate,
  mealTone,
  slotPeriod,
  weekdayShort,
  type MealTone,
  type SlotPeriod,
} from '@/lib/deliveries';
import {
  useCurrentSubscription,
  useIsSignedIn,
  useSubscriptionDeliveries,
} from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { useAuthPromptStore, useUIStore } from '@/lib/store';
import { colors, shadows } from '@/lib/theme';
import { cn, todayISO } from '@/lib/utils';

/**
 * Deliveries — the subscriber's plan, day by day and meal by meal.
 *
 * Reads top to bottom as Date → Slot → Meal: the plan at a glance, a calendar
 * of plan weeks to pick a day from, then that day as a timeline of its meals —
 * breakfast, lunch, dinner — each with its dishes, its cutoff and what can
 * still be changed. The whole page scrolls as one, calendar included, so no
 * part of it is pinned while the rest slides underneath.
 *
 * Days run from the subscription's own `start_date`, not from Monday — a plan
 * beginning on a Thursday shows Thu, Fri, Sat… Each date is served from that
 * date's own weekday menu, so a 30-day plan cycles the same week four times.
 */
export default function DeliveriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);
  const { data: subscription, isLoading: subLoading } = useCurrentSubscription();

  const {
    data: deliveries,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSubscriptionDeliveries(subscription?.id);

  const storedDate = useUIStore((s) => s.selectedDeliveryDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDeliveryDate);

  const byDate = useMemo(() => groupDeliveriesByDate(deliveries ?? []), [deliveries]);
  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const weeks = useMemo(
    () => buildDeliveryWeeks(byDate, subscription?.start_date),
    [byDate, subscription?.start_date],
  );

  const today = todayISO();
  // A remembered date that is no longer part of this plan (another plan, or
  // none picked yet) opens on today — or the nearest plan day — instead.
  const selectedDate =
    storedDate && byDate.has(storedDate) ? storedDate : defaultDeliveryDate(dates, today);
  const meals = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const selectedIndex = selectedDate ? dates.indexOf(selectedDate) : -1;

  /** The meal a sheet is currently open for — sheets are per meal, not per day. */
  const [swapFor, setSwapFor] = useState<Delivery | null>(null);
  const [extraFor, setExtraFor] = useState<Delivery | null>(null);
  const [guestFor, setGuestFor] = useState<Delivery | null>(null);

  if (subLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('account.deliveries.title')} />
        <View className="gap-4 px-5 pt-4">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <SkeletonText lines={4} />
        </View>
      </SafeAreaView>
    );
  }

  if (!subscription) {
    // Signed out is not the same as "no plan": one is an invitation to sign in,
    // the other to subscribe. Telling a visitor they have no active plan when
    // the app has never asked who they are reads as a bug.
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('account.deliveries.title')} />
        <EmptyState
          title={signedIn ? t('account.deliveries.noPlanTitle') : t('account.deliveries.signedOutTitle')}
          description={
            signedIn
              ? t('account.deliveries.noPlanBody')
              : t('account.deliveries.signedOutBody')
          }
          actionLabel={signedIn ? t('account.deliveries.browsePlans') : t('common.actions.signIn')}
          onAction={
            signedIn
              ? () => router.push('/(tabs)/plans')
              : () => promptLogin(t('account.authReason.seeMenu'))
          }
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title={t('account.deliveries.title')}
        subtitle={subscription.plan?.name}
        right={
          <Button
            label={t('account.deliveries.fullPlan')}
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() =>
              router.push({
                pathname: '/schedule',
                params: { subscription: String(subscription.id) },
              })
            }
          />
        }
      />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        <PlanOverview subscription={subscription} dates={dates} today={today} />

        {isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : dates.length === 0 ? (
          <EmptyState
            title={t('account.deliveries.emptyTitle')}
            description={t('account.deliveries.emptyBody')}
            actionLabel={t('account.deliveries.refresh')}
            onAction={refetch}
          />
        ) : (
          <>
            <Text className="mx-5 mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-text-muted">
              {t('account.deliveries.pickDay')}
            </Text>
            <DeliveryCalendar weeks={weeks} value={selectedDate} onChange={setSelectedDate} />

            {selectedDate ? (
              // Keyed by date: a new day fades in rather than its dishes
              // swapping in place under the customer's eye.
              <DayTimeline
                key={selectedDate}
                date={selectedDate}
                today={today}
                meals={meals}
                onSwap={setSwapFor}
                onOrderExtra={setExtraFor}
                onOrderGuest={setGuestFor}
              />
            ) : null}

            <DayNavigator
              previous={selectedIndex > 0 ? dates[selectedIndex - 1] : null}
              next={
                selectedIndex >= 0 && selectedIndex < dates.length - 1
                  ? dates[selectedIndex + 1]
                  : null
              }
              onChange={setSelectedDate}
            />
          </>
        )}
      </ScrollView>

      {swapFor ? (
        <MealSwapSheet
          open
          onClose={() => setSwapFor(null)}
          deliveryId={swapFor.id}
          subscriptionId={subscription.id}
        />
      ) : null}

      {extraFor ? (
        <ExtraOrderSheet
          open
          onClose={() => setExtraFor(null)}
          deliveryId={extraFor.id}
          beforeCutoff={extraFor.before_cutoff}
          onPlaced={(order) =>
            router.push({
              pathname: '/orders/[id]',
              params: { id: String(order.id) },
            })
          }
        />
      ) : null}

      {guestFor ? (
        <GuestOrderSheet
          open
          onClose={() => setGuestFor(null)}
          deliveryId={guestFor.id}
          beforeCutoff={guestFor.before_cutoff}
          onPlaced={(order) =>
            router.push({
              pathname: '/orders/[id]',
              params: { id: String(order.id) },
            })
          }
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── The plan at a glance ─────────────────────────────────────────────────────

function PlanOverview({
  subscription,
  dates,
  today,
}: {
  subscription: Subscription;
  dates: string[];
  today: string;
}) {
  const { t } = useTranslation();
  const planDays = dates.length;
  const daysReached = dates.filter((date) => date <= today).length;
  const progress = planDays > 0 ? daysReached / planDays : 0;
  const mealsPerDay = subscription.slots.length;

  const progressLabel =
    planDays === 0
      ? t('account.deliveries.waitingFirstDay')
      : daysReached === 0
        ? t('account.deliveries.startsOn', { date: formatDayMonth(dates[0]) })
        : daysReached >= planDays && today > dates[planDays - 1]
          ? t('account.deliveries.allDaysComplete', { count: planDays })
          : t('account.deliveries.dayOf', { day: daysReached, total: planDays });

  return (
    <View
      className="mx-5 mt-4 overflow-hidden rounded-3xl bg-brand-500 p-5"
      style={shadows.brand}
    >
      <BrandDecor />

      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            {t('account.deliveries.yourPlan')}
          </Text>
          <Text numberOfLines={1} className="mt-1 text-xl font-bold text-text-inverse">
            {subscription.plan?.name ?? t('account.deliveries.mealPlan')}
          </Text>
          <Text className="mt-0.5 text-xs text-white/85">
            {t('account.dateRange', {
              from: formatDayMonth(subscription.start_date),
              to: formatDayMonth(subscription.end_date),
            })}
          </Text>
        </View>
        <View className="rounded-full bg-white/20 px-3 py-1">
          <Text className="text-xs font-bold text-text-inverse">
            {t(`common.status.${subscription.status}`, { defaultValue: subscription.status })}
          </Text>
        </View>
      </View>

      <View className="mt-5 flex-row items-end justify-between gap-3">
        <Text className="text-sm font-bold text-text-inverse">{progressLabel}</Text>
        {mealsPerDay > 0 ? (
          <Text className="text-xs text-white/85">
            {t('account.deliveries.mealsPerDay', { count: mealsPerDay })}
          </Text>
        ) : null}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={progressLabel}
        className="mt-2 h-2 overflow-hidden rounded-full bg-white/25"
      >
        <View
          className="h-2 rounded-full bg-white"
          style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }}
        />
      </View>
    </View>
  );
}

// ── One day ──────────────────────────────────────────────────────────────────

function DayTimeline({
  date,
  today,
  meals,
  onSwap,
  onOrderExtra,
  onOrderGuest,
}: {
  date: string;
  today: string;
  meals: Delivery[];
  onSwap: (meal: Delivery) => void;
  onOrderExtra: (meal: Delivery) => void;
  onOrderGuest: (meal: Delivery) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const tones = meals.map(mealTone);
  const editable = tones.filter((tone) => tone === 'open').length;
  const summary =
    meals.length === 0
      ? t('account.deliveries.nothingScheduled')
      : [
          t('common.units.meal', { count: meals.length }),
          editable > 0
            ? t('account.deliveries.stillEditable', { count: editable })
            : tones.every((tone) => tone === 'delivered')
              ? t('account.deliveries.allDelivered')
              : tones.every((tone) => tone === 'off')
                ? t('account.deliveries.daySkipped')
                : t('account.deliveries.lockedForChanges'),
        ].join(' · ');

  return (
    <Animated.View entering={FadeIn.duration(280)} className="mx-5 mt-6">
      <View className="mb-4">
        {date === today ? (
          <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
            {t('common.time.today')}
          </Text>
        ) : null}
        <Text accessibilityRole="header" className="text-lg font-bold text-text-primary">
          {formatDayHeading(date)}
        </Text>
        <Text className="mt-0.5 text-xs text-text-muted">{summary}</Text>
      </View>

      {meals.length === 0 ? (
        <Card>
          <View className="p-5">
            <Text className="text-sm text-text-secondary">{t('account.deliveries.nothingThisDay')}</Text>
          </View>
        </Card>
      ) : (
        meals.map((meal, index) => (
          <MealSlot
            key={meal.id}
            delivery={meal}
            last={index === meals.length - 1}
            onSwap={() => onSwap(meal)}
            onOrderExtra={() => onOrderExtra(meal)}
            onOrderGuest={() => onOrderGuest(meal)}
            onTrack={() =>
              router.push({ pathname: '/deliveries/[id]', params: { id: String(meal.id) } })
            }
          />
        ))
      )}
    </Animated.View>
  );
}

/** Label keys, resolved at render so they follow the app language. */
const TONE_BADGE: Record<MealTone, { labelKey: string; variant: 'success' | 'muted' | 'warning' | 'brand' }> = {
  open: { labelKey: 'account.calendar.legendEditable', variant: 'success' },
  locked: { labelKey: 'common.status.locked', variant: 'muted' },
  delivered: { labelKey: 'common.status.delivered', variant: 'success' },
  off: { labelKey: 'common.status.skipped', variant: 'warning' },
};

/** One meal of the day: the timeline marker, then its card. */
function MealSlot({
  delivery,
  last,
  onSwap,
  onOrderExtra,
  onOrderGuest,
  onTrack,
}: {
  delivery: Delivery;
  last: boolean;
  onSwap: () => void;
  onOrderExtra: () => void;
  onOrderGuest: () => void;
  onTrack: () => void;
}) {
  const { t } = useTranslation();
  const tone = mealTone(delivery);
  const items = delivery.items ?? [];
  const dishes = items.filter((i) => !i.is_addon);
  const extras = items.filter((i) => i.is_addon);
  // The server has already folded cutoff, lock and category rules into
  // `can_swap`, so this is a read rather than a re-derivation.
  const canSwapSomething = items.some((i) => i.can_swap);

  const slotName = delivery.slot?.name ?? t('account.meal');
  const window = delivery.slot ? slotWindow(delivery.slot) : '';
  const cutoff = formatCutoff(delivery.cutoff_at);
  const badge =
    tone === 'off' && delivery.status === 'paused'
      ? { label: t('common.status.paused'), variant: 'warning' as const }
      : { label: t(TONE_BADGE[tone].labelKey), variant: TONE_BADGE[tone].variant };

  return (
    <View className="flex-row gap-3">
      {/* The rail: an icon for the time of day, joined to the next meal. */}
      <View className="w-11 items-center">
        <View
          className={cn(
            'h-11 w-11 items-center justify-center rounded-2xl',
            tone === 'off' ? 'bg-surface-muted' : 'bg-brand-50',
          )}
        >
          <SlotIcon
            period={slotPeriod(delivery.slot)}
            color={tone === 'off' ? colors.text.muted : colors.brand[500]}
          />
        </View>
        {!last ? <View className="my-1.5 w-0.5 flex-1 rounded-full bg-border" /> : null}
      </View>

      <View className={cn('flex-1', !last && 'pb-5')}>
        <Card className={cn(tone === 'off' && 'opacity-80')}>
          <View className="p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-bold text-text-primary">{slotName}</Text>
                {window ? (
                  <Text className="mt-0.5 text-xs font-semibold text-text-muted">
                    {t('account.deliveries.deliveredWindow', { window })}
                  </Text>
                ) : null}
              </View>
              <View className="items-end gap-1.5">
                <Badge label={badge.label} variant={badge.variant} />
                {delivery.is_customized ? <Badge label={t('account.swapped')} variant="brand" /> : null}
              </View>
            </View>

            {/* The cutoff is the single gate on every change to this meal. */}
            <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-surface-muted px-3 py-2">
              <ClockIcon color={tone === 'open' ? colors.brand[500] : colors.text.muted} />
              <Text className="flex-1 text-xs text-text-secondary">
                {tone === 'open'
                  ? cutoff
                    ? t('account.deliveries.openUntil', { time: cutoff })
                    : t('account.deliveries.openForChanges')
                  : tone === 'locked'
                    ? t('account.deliveries.lockedNote')
                    : tone === 'delivered'
                      ? t('account.deliveries.deliveredNote')
                      : delivery.status === 'paused'
                        ? t('account.deliveries.pausedNote')
                        : t('account.deliveries.skippedNote')}
              </Text>
            </View>

            <View className="mt-3 gap-2">
              {dishes.length === 0 ? (
                <Text className="text-sm text-text-muted">{t('account.deliveries.noDishes')}</Text>
              ) : (
                dishes.map((item) => <ItemRow key={item.id} item={item} />)
              )}
            </View>

            {extras.length > 0 ? (
              <View className="mt-3 gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  {t('account.extras')}
                </Text>
                {extras.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </View>
            ) : null}

            {delivery.before_cutoff ? (
              <View className="mt-4 flex-row gap-2">
                <Button
                  label={t('account.deliveries.swap')}
                  accessibilityLabel={t('account.deliveries.swapA11y', { slot: slotName })}
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  disabled={!canSwapSomething}
                  onPress={onSwap}
                />
                <Button
                  label={t('account.deliveries.addExtra')}
                  accessibilityLabel={t('account.deliveries.addExtraA11y', { slot: slotName })}
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={onOrderExtra}
                />
                <Button
                  label={t('account.deliveries.guests')}
                  accessibilityLabel={t('account.deliveries.guestsA11y', { slot: slotName })}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={onOrderGuest}
                />
              </View>
            ) : null}

            {/* Once the kitchen has it, the meal has a journey worth
                following — live while the car is on the road. */}
            {isTrackableMeal(delivery) ? (
              <View className="mt-4 flex-row items-center gap-2">
                {delivery.is_trackable ? <LiveStatusPill status={delivery.status} /> : null}
                <Button
                  label={t('tracking.track')}
                  accessibilityLabel={t('tracking.trackA11y', { slot: slotName })}
                  size="sm"
                  variant={delivery.is_trackable ? 'primary' : 'outline'}
                  fullWidth={false}
                  className="ms-auto"
                  onPress={onTrack}
                />
              </View>
            ) : null}
          </View>
        </Card>
      </View>
    </View>
  );
}

/** Statuses past the kitchen's cutoff, where tracking has something to say. */
const TRACKABLE_MEAL = new Set<Delivery['status']>([
  'locked',
  'packed',
  'out_for_delivery',
  'delivered',
  'failed_attempt',
  'returned',
]);

function isTrackableMeal(delivery: Delivery): boolean {
  return delivery.is_trackable || TRACKABLE_MEAL.has(delivery.status);
}

function ItemRow({ item }: { item: DeliveryItem }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-muted py-2 pl-2 pr-3">
      <FoodImage
        uri={item.menu_item?.image_url}
        glyphSize="sm"
        className="h-12 w-12 rounded-xl"
      />

      <View className="flex-1">
        <Text numberOfLines={2} className="text-sm font-semibold text-text-primary">
          {item.quantity > 1 ? `${item.quantity} × ` : ''}
          {item.menu_item?.name ?? t('account.itemFallback', { id: item.id })}
        </Text>

        {item.was_swapped && item.swapped_from ? (
          <Text className="mt-0.5 text-[11px] text-brand-500">
            {t('account.deliveries.swappedFrom', { name: item.swapped_from })}
          </Text>
        ) : null}
      </View>

      {item.package ? (
        <Badge label={item.package.name} variant="muted" />
      ) : item.is_free_addon ? (
        <Badge label={t('account.free')} variant="free" />
      ) : item.source === 'extra' || item.source === 'guest' ? (
        <Badge label={t('account.paid')} variant="paid" />
      ) : item.swap_locked ? (
        <Badge label={t('account.deliveries.settled')} variant="muted" />
      ) : null}
    </View>
  );
}

/** Previous / next plan day, so the next meal is a tap away from the bottom. */
function DayNavigator({
  previous,
  next,
  onChange,
}: {
  previous: string | null;
  next: string | null;
  onChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  if (!previous && !next) return null;
  // The previous button sits at the start edge, so its chevron points there.
  const back = I18nManager.isRTL ? '›' : '‹';
  const forward = I18nManager.isRTL ? '‹' : '›';

  return (
    <View className="mx-5 mt-4 flex-row gap-3">
      {previous ? (
        <DayNavButton
          accessibilityLabel={t('account.deliveries.previousDay', { date: formatDayHeading(previous) })}
          label={`${back}  ${weekdayShort(previous)} ${dayOfMonth(previous)}`}
          onPress={() => onChange(previous)}
        />
      ) : (
        <View className="flex-1" />
      )}
      {next ? (
        <DayNavButton
          accessibilityLabel={t('account.deliveries.nextDay', { date: formatDayHeading(next) })}
          label={`${weekdayShort(next)} ${dayOfMonth(next)}  ${forward}`}
          onPress={() => onChange(next)}
        />
      ) : (
        <View className="flex-1" />
      )}
    </View>
  );
}

function DayNavButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="flex-1 items-center rounded-2xl border border-border bg-surface py-3 active:bg-surface-muted"
    >
      <Text className="text-sm font-bold text-text-primary">{label}</Text>
    </Pressable>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SlotIcon({ period, color }: { period: SlotPeriod; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {period === 'morning' ? (
        <Path
          d="M12 3v6M5.6 9.6l1.4 1.4M3 17h2M19 17h2M18.4 9.6 17 11M22 21H2M8 6l4-3 4 3M16 17a4 4 0 0 0-8 0"
          {...stroke}
        />
      ) : period === 'midday' ? (
        <>
          <Circle cx={12} cy={12} r={4} {...stroke} />
          <Path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"
            {...stroke}
          />
        </>
      ) : (
        <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" {...stroke} />
      )}
    </Svg>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
