import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import {
  ExtraOrderSheet,
  GuestOrderSheet,
  MenuDayTabs,
  OfflineBanner,
  ScreenHeader,
} from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  InlineError,
  Sheet,
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import { isApiError } from '@/lib/api/types/common';
import type { SwapOption } from '@/lib/api/types/swap';
import {
  useApplySwaps,
  useCurrentSubscription,
  useIsSignedIn,
  useRevertSwaps,
  useSubscriptionDeliveries,
  useSwapOptions,
} from '@/lib/query/hooks';
import { useAuthPromptStore, useUIStore } from '@/lib/store';
import { cn, formatLongDate, todayISO } from '@/lib/utils';

/**
 * Deliveries — the subscriber's day-by-day schedule.
 *
 * Days run from the subscription's own `start_date`, not from Monday — a plan
 * beginning on a Thursday shows Thu, Fri, Sat… Each date is served from that
 * date's own weekday menu, so a 30-day plan cycles the same week four times.
 *
 * Reached from the Menu tab, which is the account hub. Mirrors the web
 * dashboard's own "Deliveries" section rather than being a tab of its own, so
 * the two apps present the same set of places to go.
 */
export default function DeliveriesScreen() {
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

  const selectedDate = useUIStore((s) => s.selectedDeliveryDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDeliveryDate);

  // Land on today when it's part of the plan, otherwise the first day.
  useEffect(() => {
    if (!deliveries || deliveries.length === 0) return;
    const stillValid = deliveries.some((d) => d.delivery_date === selectedDate);
    if (stillValid) return;

    const today = todayISO();
    const match = deliveries.find((d) => d.delivery_date >= today) ?? deliveries[0];
    setSelectedDate(match.delivery_date);
  }, [deliveries, selectedDate, setSelectedDate]);

  const delivery = useMemo(
    () => deliveries?.find((d) => d.delivery_date === selectedDate) ?? null,
    [deliveries, selectedDate],
  );

  const [swapOpen, setSwapOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  if (subLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Deliveries" />
        <View className="gap-4 px-5 pt-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-16 w-full" />
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
      <ScreenHeader title="Deliveries" />
        <EmptyState
          title={signedIn ? 'No active plan' : 'Your menu lives here'}
          description={
            signedIn
              ? 'Subscribe to a meal plan to see your day-by-day menu.'
              : 'Sign in to see the meals scheduled for each day of your plan.'
          }
          actionLabel={signedIn ? 'Browse plans' : 'Sign in'}
          onAction={
            signedIn
              ? () => router.push('/(tabs)/plans')
              : () => promptLogin('to see your menu')
          }
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Deliveries" />
      <OfflineBanner />

      <View className="px-5 pb-3 pt-4">
        <Text className="text-sm text-text-secondary">
          {subscription.plan?.name ?? 'Your plan'} · {formatLongDate(subscription.start_date)} →{' '}
          {formatLongDate(subscription.end_date)}
        </Text>
      </View>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
      ) : !deliveries || deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries scheduled"
          description="Your days appear here once your payment is confirmed."
          actionLabel="Refresh"
          onAction={refetch}
        />
      ) : (
        <>
          <MenuDayTabs
            deliveries={deliveries}
            value={selectedDate}
            onChange={setSelectedDate}
            className="pb-4"
          />

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
            }
          >
            {delivery ? (
              <DayDetail
                deliveryId={delivery.id}
                subscriptionId={subscription.id}
                date={delivery.delivery_date}
                status={delivery.status}
                beforeCutoff={delivery.before_cutoff}
                isCustomized={delivery.is_customized}
                items={delivery.items ?? []}
                onOpenSwap={() => setSwapOpen(true)}
                onOrderExtra={() => setExtraOpen(true)}
                onOrderGuest={() => setGuestOpen(true)}
              />
            ) : null}
          </ScrollView>

          {delivery ? (
            <>
              <SwapSheet
                open={swapOpen}
                onClose={() => setSwapOpen(false)}
                deliveryId={delivery.id}
                subscriptionId={subscription.id}
              />

              <ExtraOrderSheet
                open={extraOpen}
                onClose={() => setExtraOpen(false)}
                deliveryId={delivery.id}
                beforeCutoff={delivery.before_cutoff}
                onPlaced={(order) =>
                  router.push({
                    pathname: '/orders/[id]',
                    params: { id: String(order.id) },
                  })
                }
              />

              <GuestOrderSheet
                open={guestOpen}
                onClose={() => setGuestOpen(false)}
                deliveryId={delivery.id}
                beforeCutoff={delivery.before_cutoff}
                onPlaced={(order) =>
                  router.push({
                    pathname: '/orders/[id]',
                    params: { id: String(order.id) },
                  })
                }
              />
            </>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

// ── One day ──────────────────────────────────────────────────────────────────

interface DayDetailProps {
  deliveryId: number;
  subscriptionId: number;
  date: string;
  status: string;
  beforeCutoff: boolean;
  isCustomized: boolean;
  items: { id: number; menu_item?: { name: string }; is_addon: boolean; source: string }[];
  onOpenSwap: () => void;
  onOrderExtra: () => void;
  onOrderGuest: () => void;
}

function DayDetail({
  deliveryId,
  subscriptionId,
  date,
  status,
  beforeCutoff,
  isCustomized,
  items,
  onOpenSwap,
  onOrderExtra,
  onOrderGuest,
}: DayDetailProps) {
  const revert = useRevertSwaps(deliveryId, subscriptionId);

  const meals = items.filter((i) => !i.is_addon);
  const extras = items.filter((i) => i.is_addon);

  return (
    <View className="gap-4">
      <Card>
        <View className="p-5">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                {formatLongDate(date)}
              </Text>
              <Text className="mt-0.5 text-xs capitalize text-text-muted">{status}</Text>
            </View>

            {isCustomized ? <Badge label="Customised" variant="brand" /> : null}
          </View>

          {/* The cutoff is the single gate on every change to this day. */}
          {!beforeCutoff ? (
            <View className="mt-3 rounded-2xl bg-surface-muted px-4 py-3">
              <Text className="text-xs text-text-secondary">
                This day is locked — its cutoff has passed, so it can no longer be changed.
              </Text>
            </View>
          ) : null}

          <View className="mt-4 gap-2">
            <Text className="text-sm font-bold text-text-primary">Included</Text>
            {meals.length === 0 ? (
              <Text className="text-sm text-text-muted">Nothing scheduled.</Text>
            ) : (
              meals.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-2xl bg-surface-muted px-4 py-3"
                >
                  <Text className="flex-1 text-sm font-semibold text-text-primary">
                    {item.menu_item?.name ?? `Item #${item.id}`}
                  </Text>
                  {item.source === 'customization' ? (
                    <Badge label="Swapped" variant="brand" />
                  ) : null}
                </View>
              ))
            )}
          </View>

          {extras.length > 0 ? (
            <View className="mt-4 gap-2">
              <Text className="text-sm font-bold text-text-primary">Extras</Text>
              {extras.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center justify-between rounded-2xl bg-surface-muted px-4 py-3"
                >
                  <Text className="flex-1 text-sm font-semibold text-text-primary">
                    {item.menu_item?.name ?? `Item #${item.id}`}
                  </Text>
                  <Badge
                    label={item.source === 'plan' ? 'Included' : 'Paid'}
                    variant={item.source === 'plan' ? 'free' : 'paid'}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Card>

      <View className="gap-3">
        <Button label="Swap a dish" onPress={onOpenSwap} disabled={!beforeCutoff} />

        {isCustomized ? (
          <Button
            label="Reset to plan default"
            variant="outline"
            loading={revert.isPending}
            disabled={!beforeCutoff}
            onPress={() =>
              revert.mutate(undefined, {
                onSuccess: () => toast.success('Restored your plan’s default'),
                onError: (e) =>
                  toast.error(isApiError(e) ? e.message : 'Could not reset this day'),
              })
            }
          />
        ) : null}

        <Button
          label="Order something extra"
          variant="secondary"
          disabled={!beforeCutoff}
          onPress={onOrderExtra}
        />

        <Button
          label="Add guest portions"
          variant="outline"
          disabled={!beforeCutoff}
          onPress={onOrderGuest}
        />
      </View>
    </View>
  );
}

// ── Swap ─────────────────────────────────────────────────────────────────────

function SwapSheet({
  open,
  onClose,
  deliveryId,
  subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  deliveryId: number;
  subscriptionId: number;
}) {
  const { data: options, isLoading, isError, error, refetch } = useSwapOptions(deliveryId);
  const applySwaps = useApplySwaps(deliveryId, subscriptionId);

  /** category_id → chosen menu_item_id, only when it differs from current. */
  const [picked, setPicked] = useState<Record<number, number>>({});

  const locked = options ? !options.before_cutoff : false;

  const changed = (options?.categories ?? []).filter((c) => {
    const choice = picked[c.category_id] ?? c.current_item_id;
    return choice !== c.current_item_id;
  });

  /** Quota-tracked and empty. `null` quota means unlimited, not exhausted. */
  const isExhausted = (option: SwapOption) =>
    !option.is_current && option.quota !== null && option.quota.remaining <= 0;

  const onSave = () => {
    if (changed.length === 0) return;

    applySwaps.mutate(
      changed.map((c) => ({
        category_id: c.category_id,
        to_menu_item_id: picked[c.category_id] ?? c.current_item_id!,
      })),
      {
        onSuccess: () => {
          setPicked({});
          onClose();
          toast.success('Your swap is saved');
        },
        onError: (e) =>
          toast.error(isApiError(e) ? e.message : 'That swap could not be applied'),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Swap a dish"
      description="Choose a different item in any category below."
      footer={
        <Button
          label={changed.length > 0 ? `Save ${changed.length} change(s)` : 'Save'}
          loading={applySwaps.isPending}
          disabled={changed.length === 0 || locked}
          onPress={onSave}
        />
      }
    >
      {isLoading ? (
        <SkeletonText lines={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !options || options.categories.length === 0 ? (
        <EmptyState
          title="Nothing to swap"
          description="This day has no swappable categories."
        />
      ) : (
        <View className="gap-6 pb-2">
          {applySwaps.isError ? <InlineError error={applySwaps.error} /> : null}

          {options.categories.map((category) => {
            const choice = picked[category.category_id] ?? category.current_item_id;

            return (
              <View key={category.category_id} className="gap-2">
                <Text className="text-sm font-bold text-text-primary">
                  {category.category_name}
                </Text>

                {category.options.map((option) => {
                  const selected = option.menu_item_id === choice;
                  const exhausted = isExhausted(option);

                  return (
                    <Button
                      key={option.menu_item_id}
                      label={
                        option.quota
                          ? `${option.name} · ${option.quota.remaining} left`
                          : option.name
                      }
                      variant={selected ? 'primary' : 'outline'}
                      // Exhausted options stay visible but unselectable, so the
                      // customer can see the dish exists and why it's blocked.
                      disabled={exhausted || locked}
                      className={cn(exhausted && 'opacity-50')}
                      onPress={() =>
                        setPicked((prev) => ({
                          ...prev,
                          [category.category_id]: option.menu_item_id,
                        }))
                      }
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </Sheet>
  );
}
