import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ExtraOrderSheet,
  FoodImage,
  GuestOrderSheet,
  MealSwapSheet,
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
  Skeleton,
  SkeletonText,
} from '@/components/ui';
import type { Delivery, DeliveryItem } from '@/lib/api/types/subscription';
import {
  useCurrentSubscription,
  useDeliveriesOnDate,
  useIsSignedIn,
  useSubscriptionDeliveries,
} from '@/lib/query/hooks';
import { useAuthPromptStore, useUIStore } from '@/lib/store';
import { formatLongDate, todayISO } from '@/lib/utils';

/**
 * Deliveries — the subscriber's day-by-day schedule.
 *
 * A subscription covers every meal its plan serves, so a day is up to three
 * cards — breakfast, lunch and dinner — in time-of-day order, each with its own
 * cutoff. That plurality is the point: it is what makes "move tonight's fish
 * onto today's lunch" a move between two plates the customer already owns.
 *
 * Days run from the subscription's own `start_date`, not from Monday — a plan
 * beginning on a Thursday shows Thu, Fri, Sat… Each date is served from that
 * date's own weekday menu, so a 30-day plan cycles the same week four times.
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

  const { data: meals } = useDeliveriesOnDate(subscription?.id, selectedDate);

  // Land on today when it's part of the plan, otherwise the first day.
  useEffect(() => {
    if (!deliveries || deliveries.length === 0) return;
    const stillValid = deliveries.some((d) => d.delivery_date === selectedDate);
    if (stillValid) return;

    const today = todayISO();
    const match = deliveries.find((d) => d.delivery_date >= today) ?? deliveries[0];
    setSelectedDate(match.delivery_date);
  }, [deliveries, selectedDate, setSelectedDate]);

  /** The meal a sheet is currently open for — sheets are per meal, not per day. */
  const [swapFor, setSwapFor] = useState<Delivery | null>(null);
  const [extraFor, setExtraFor] = useState<Delivery | null>(null);
  const [guestFor, setGuestFor] = useState<Delivery | null>(null);

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

  const mealNames = subscription.slots.map((s) => s.name).join(' · ');

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader
        title="Deliveries"
        right={
          <Button
            label="Full plan"
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

      <View className="px-5 pb-3 pt-4">
        <Text className="text-sm text-text-secondary">
          {subscription.plan?.name ?? 'Your plan'} · {formatLongDate(subscription.start_date)} →{' '}
          {formatLongDate(subscription.end_date)}
        </Text>
        {mealNames ? (
          <Text className="mt-0.5 text-xs text-text-muted">{mealNames}, every day</Text>
        ) : null}
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
            {selectedDate ? (
              <Text className="mb-3 text-base font-bold text-text-primary">
                {formatLongDate(selectedDate)}
              </Text>
            ) : null}

            <View className="gap-4">
              {meals.length === 0 ? (
                <Card>
                  <View className="p-5">
                    <Text className="text-sm text-text-secondary">
                      Nothing scheduled for this day.
                    </Text>
                  </View>
                </Card>
              ) : (
                meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    delivery={meal}
                    onSwap={() => setSwapFor(meal)}
                    onOrderExtra={() => setExtraFor(meal)}
                    onOrderGuest={() => setGuestFor(meal)}
                  />
                ))
              )}
            </View>
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
        </>
      )}
    </SafeAreaView>
  );
}

// ── One meal ─────────────────────────────────────────────────────────────────

interface MealCardProps {
  delivery: Delivery;
  onSwap: () => void;
  onOrderExtra: () => void;
  onOrderGuest: () => void;
}

function MealCard({ delivery, onSwap, onOrderExtra, onOrderGuest }: MealCardProps) {
  const items = delivery.items ?? [];
  const meals = items.filter((i) => !i.is_addon);
  const extras = items.filter((i) => i.is_addon);

  // The server has already folded cutoff, lock and category rules into
  // `can_swap`, so this is a read rather than a re-derivation.
  const canSwapSomething = items.some((i) => i.can_swap);

  return (
    <Card>
      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              {delivery.slot?.name ?? 'Meal'}
            </Text>
            <Text className="mt-0.5 text-xs capitalize text-text-muted">
              {delivery.slot?.start_time ? `${delivery.slot.start_time} · ` : ''}
              {delivery.status}
            </Text>
          </View>

          {delivery.is_customized ? <Badge label="Swapped" variant="brand" /> : null}
        </View>

        {/* The cutoff is the single gate on every change to this meal. */}
        {!delivery.before_cutoff ? (
          <View className="mt-3 rounded-2xl bg-surface-muted px-4 py-3">
            <Text className="text-xs text-text-secondary">
              This meal is locked — its cutoff has passed, so the kitchen is
              already preparing it.
            </Text>
          </View>
        ) : null}

        <View className="mt-4 gap-2">
          {meals.length === 0 ? (
            <Text className="text-sm text-text-muted">Nothing scheduled.</Text>
          ) : (
            meals.map((item) => <ItemRow key={item.id} item={item} />)
          )}
        </View>

        {extras.length > 0 ? (
          <View className="mt-4 gap-2">
            <Text className="text-sm font-bold text-text-primary">Extras</Text>
            {extras.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {delivery.before_cutoff ? (
          <View className="mt-4 gap-2">
            <Button
              label="Swap a dish"
              size="sm"
              disabled={!canSwapSomething}
              onPress={onSwap}
            />
            <Button
              label="Order something extra"
              variant="secondary"
              size="sm"
              onPress={onOrderExtra}
            />
            <Button
              label="Add guest portions"
              variant="outline"
              size="sm"
              onPress={onOrderGuest}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function ItemRow({ item }: { item: DeliveryItem }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface-muted py-2 pl-2 pr-4">
      <FoodImage
        uri={item.menu_item?.image_url}
        glyphSize="sm"
        className="h-12 w-12 rounded-xl"
      />

      <View className="flex-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-sm font-semibold text-text-primary">
            {item.quantity > 1 ? `${item.quantity} × ` : ''}
            {item.menu_item?.name ?? `Item #${item.id}`}
          </Text>

          {item.package ? (
            <Badge label={item.package.name} variant="muted" />
          ) : item.is_free_addon ? (
            <Badge label="Free" variant="free" />
          ) : item.source === 'extra' || item.source === 'guest' ? (
            <Badge label="Paid" variant="paid" />
          ) : item.swap_locked ? (
            <Badge label="Settled" variant="muted" />
          ) : null}
        </View>

        {item.was_swapped && item.swapped_from ? (
          <Text className="mt-1 text-[11px] text-brand-500">
            swapped from {item.swapped_from}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
