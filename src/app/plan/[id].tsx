import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Separator,
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import type { PlanScheduleDay, PlanScheduleItem } from '@/lib/api/types/catalog';
import { usePlan } from '@/lib/query/hooks';
import { slotWindow } from '@/lib/slots';
import { useCartStore } from '@/lib/store';
import { cn, formatMoney, isoWeekdayForDate, todayISO } from '@/lib/utils';
import { FOOD_BLURHASH } from '@/lib/constants/images';


/**
 * Plan detail — the whole repeating week, before committing to it.
 *
 * `GET /plans/{id}` is the only endpoint that returns `schedule` and `quotas`
 * (the listing loads `slots` alone), so this is the screen that can answer the
 * two questions a subscriber actually has: what arrives on a Tuesday, and how
 * often may I have the fish.
 *
 * Public: no session needed to read any of it. The sign-in ask comes at
 * checkout, which is where money starts changing hands.
 */
export default function PlanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: plan, isLoading, isError, error, refetch } = usePlan(id);
  const selectPlan = useCartStore((s) => s.selectPlan);

  // Open on today's weekday when the plan serves it — the customer's most
  // likely reference point — otherwise the first day it does serve.
  const todayWeekday = isoWeekdayForDate(todayISO());
  const [openDay, setOpenDay] = useState<number | null>(null);

  // Memoised so the empty-array fallback isn't a fresh identity on every
  // render, which would defeat the `activeDay` memo below.
  const schedule = useMemo(() => plan?.schedule ?? [], [plan]);

  const activeDay = useMemo(() => {
    if (schedule.length === 0) return null;
    if (openDay !== null) {
      return schedule.find((d) => d.day_number === openDay) ?? schedule[0];
    }
    return schedule.find((d) => d.day_number === todayWeekday) ?? schedule[0];
  }, [schedule, openDay, todayWeekday]);

  const onSubscribe = () => {
    if (!plan) return;
    selectPlan({
      id: plan.id,
      name: plan.name,
      duration_days: plan.duration_days,
      price: plan.price,
      currency: plan.currency,
    });
    router.push('/checkout');
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Plan" />
        <View className="gap-4 p-5">
          <Skeleton className="h-40 w-full" />
          <SkeletonText lines={5} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !plan) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Plan" />
        <ErrorState error={error} onRetry={refetch} className="flex-1 justify-center" />
      </SafeAreaView>
    );
  }

  const perDay = plan.duration_days > 0 ? plan.price / plan.duration_days : 0;
  // `slots` is `whenLoaded` on the resource: absent means the API wasn't asked,
  // which is not the same as "this plan serves no meals".
  const mealCount = plan.slots?.length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={plan.name} subtitle={`${plan.duration_days} days`} />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {plan.image_url ? (
          <Image
            source={{ uri: plan.image_url }}
            placeholder={{ blurhash: FOOD_BLURHASH }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: 180 }}
            accessibilityLabel={plan.name}
          />
        ) : null}

        <View className="px-5 pt-5">
          <View className="flex-row items-end gap-2">
            <Text className="text-3xl font-bold text-text-primary">
              {formatMoney(plan.price)}
            </Text>
            <Text className="mb-1 text-sm text-text-muted">
              {formatMoney(perDay)}/day
            </Text>
          </View>

          <View className="mt-4 flex-row rounded-2xl border border-border">
            <GlanceStat value={String(plan.duration_days)} label="days" />
            <GlanceStat
              value={mealCount > 0 ? String(mealCount) : '—'}
              label={mealCount === 1 ? 'meal a day' : 'meals a day'}
            />
            <GlanceStat
              value={formatMoney(perDay).replace('SAR ', '')}
              label="per day"
              last
            />
          </View>

          {plan.description ? (
            <Text className="mt-3 text-sm leading-5 text-text-secondary">
              {plan.description}
            </Text>
          ) : null}

          {/* Meals covered. Absent `slots` means the API wasn't asked — say
              nothing rather than claim the plan covers none. */}
          {plan.slots && plan.slots.length > 0 ? (
            <View className="mt-4 flex-row flex-wrap gap-2">
              {plan.slots.map((slot) => (
                <Badge
                  key={slot.id}
                  label={[slot.name, slotWindow(slot)].filter(Boolean).join(' · ')}
                  variant="brand"
                />
              ))}
            </View>
          ) : null}

          <View className="mt-4 rounded-2xl bg-surface-muted px-4 py-3">
            <Text className="text-xs text-text-secondary">
              {mealCount > 1 ? (
                <>
                  One price covers{' '}
                  <Text className="font-bold">all {mealCount} meals</Text> a day,
                  every day for {plan.duration_days} days — and you can trade
                  dishes between them once it starts.
                </>
              ) : (
                <>
                  A subscription covers{' '}
                  <Text className="font-bold">every meal this plan serves</Text>,
                  every day for {plan.duration_days} days.
                </>
              )}
            </Text>
          </View>
        </View>

        {/* The week */}
        {schedule.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-3 px-5 text-lg font-bold text-text-primary">
              What arrives each day
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              style={{ flexGrow: 0 }}
            >
              {schedule.map((day) => {
                const active = day.day_number === activeDay?.day_number;
                return (
                  <Pressable
                    key={day.day_number}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setOpenDay(day.day_number)}
                    className={cn(
                      'rounded-2xl px-4 py-2',
                      active ? 'bg-brand-500' : 'bg-surface-muted',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm font-bold',
                        active ? 'text-text-inverse' : 'text-text-secondary',
                      )}
                    >
                      {day.day_name.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeDay ? <DaySchedule day={activeDay} /> : null}
          </View>
        ) : null}

        {/* Weekly limits */}
        {plan.quotas && plan.quotas.length > 0 ? (
          <View className="mt-6 px-5">
            <Text className="mb-1 text-lg font-bold text-text-primary">
              Weekly limits
            </Text>
            <Text className="mb-3 text-xs text-text-muted">
              How many portions of each dish you may have per week, and how many
              the plan&apos;s own menu already uses.
            </Text>

            <Card>
              <View className="p-5">
                {plan.quotas.map((quota, index) => (
                  <View key={quota.menu_item_id}>
                    {index > 0 ? <Separator className="my-3" /> : null}
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="flex-1 text-sm font-semibold text-text-primary">
                        {quota.menu_item?.name ?? `Item #${quota.menu_item_id}`}
                      </Text>
                      <Text className="text-sm text-text-secondary">
                        {quota.default_count === null
                          ? `${quota.weekly_limit} per week`
                          : `${quota.default_count} of ${quota.weekly_limit} used`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <View className="border-t border-border px-5 pb-6 pt-4">
        <Button
          label={`Subscribe · ${formatMoney(plan.price)}`}
          size="lg"
          onPress={onSubscribe}
        />
      </View>
    </SafeAreaView>
  );
}

/** One weekday: each meal slot, what's included and what may be added. */
function DaySchedule({ day }: { day: PlanScheduleDay }) {
  return (
    <View className="mt-4 gap-3 px-5">
      {day.slots.map((slot) => (
        <Card key={slot.slot_id}>
          <View className="p-5">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-sm font-bold text-text-primary">
                {slot.slot?.name ?? `Meal #${slot.slot_id}`}
              </Text>
              {slot.slot ? (
                <Text className="text-xs text-text-muted">{slotWindow(slot.slot)}</Text>
              ) : null}
            </View>

            <View className="mt-3 gap-2">
              {slot.items.length === 0 ? (
                <Text className="text-sm text-text-muted">Nothing scheduled.</Text>
              ) : (
                slot.items.map((item) => (
                  <ScheduleLine key={item.id} item={item} />
                ))
              )}
            </View>

            {slot.addons.length > 0 ? (
              <>
                <Separator className="my-4" />
                <Text className="text-xs font-bold uppercase text-text-muted">
                  Available to add
                </Text>
                <Text className="mt-1 text-xs text-text-muted">
                  Not delivered unless you ask for it — and it only counts
                  against your quota once you do.
                </Text>
                <View className="mt-2 gap-2">
                  {slot.addons.map((item) => (
                    <ScheduleLine
                      key={item.id}
                      item={item}
                      optional
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

function ScheduleLine({
  item,
  optional = false,
}: {
  item: PlanScheduleItem;
  optional?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-2.5">
      <View className="flex-1 flex-row items-center gap-2">
        <Text numberOfLines={1} className="flex-1 text-sm text-text-primary">
          {item.menu_item?.name ?? `Item #${item.menu_item_id}`}
          {item.quantity > 1 ? (
            <Text className="font-bold"> ×{item.quantity}</Text>
          ) : null}
        </Text>
      </View>

      {optional ? (
        <Text className="text-xs font-semibold text-brand-500">
          {item.menu_item
            ? formatMoney(item.menu_item.base_price)
            : 'Optional'}
        </Text>
      ) : item.is_addon ? (
        <Badge label="Add-on" variant="brand" />
      ) : null}
    </View>
  );
}

/** One cell of the plan's at-a-glance strip. */
function GlanceStat({
  value,
  label,
  last = false,
}: {
  value: string;
  label: string;
  last?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-1 items-center py-3',
        !last && 'border-r border-border',
      )}
    >
      <Text className="text-lg font-bold text-text-primary">{value}</Text>
      <Text className="mt-0.5 text-[11px] text-text-muted">{label}</Text>
    </View>
  );
}
