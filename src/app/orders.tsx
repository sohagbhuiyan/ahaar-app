import { useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, OrderCard, ScreenHeader } from '@/components/shared';
import { Button, EmptyState, ErrorState, LoadMore, SkeletonCard } from '@/components/ui';
import type { Order, OrderStatus } from '@/lib/api/types/order';
import { isPayable, openCheckout } from '@/lib/payments';
import { useDeliverySlotMap, useFilteredOrders, useIsSignedIn } from '@/lib/query/hooks';

/** `undefined` = every order. Mirrors `OrderFilters.status`. */
const FILTERS: { label: string; value: OrderStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Unpaid', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

/**
 * Order history — every extra, guest and instant order.
 *
 * Subscriptions are not here: they are a different resource (`/subscriptions`)
 * with their own screen. What this list is *for* is the one-off spend, and the
 * job it most has to do is surface an order the customer started and never
 * paid for — hence "Pay now" inline rather than one tap deeper.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();

  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);

  // Narrowed client-side: `GET /orders` accepts no filter params, so the
  // whole history is one cached query and switching chips costs nothing.
  const {
    orders,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFilteredOrders({ status });

  const { data: slotById } = useDeliverySlotMap();

  const openOrder = (order: Order) =>
    router.push({ pathname: '/orders/[id]', params: { id: String(order.id) } });

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Your orders" />
        <EmptyState
          title="Sign in to see your orders"
          description="Your one-off orders and their payment status live here."
          actionLabel="Browse the menu"
          onAction={() => router.replace('/(tabs)/foods')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <ScreenHeader title="Your orders" />
      <OfflineBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
        // Without this the chip row expands to fill the column and pushes the
        // list off-screen.
        style={{ flexGrow: 0 }}
      >
        {FILTERS.map((filter) => (
          <Button
            key={filter.label}
            label={filter.label}
            size="sm"
            fullWidth={false}
            variant={status === filter.value ? 'primary' : 'outline'}
            onPress={() => setStatus(filter.value)}
          />
        ))}
      </ScrollView>

      <View className="flex-1">
        {isLoading ? (
          <View className="gap-3 px-5">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState
            error={error}
            onRetry={refetch}
            retrying={isFetching}
            className="flex-1 justify-center"
          />
        ) : (
          <FlashList
            data={orders}
            keyExtractor={(order) => String(order.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            ItemSeparatorComponent={() => <View className="h-3" />}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
            }
            ListEmptyComponent={
              <EmptyState
                title={status ? 'Nothing here' : 'No orders yet'}
                description={
                  status
                    ? 'No orders with that status.'
                    : 'Dishes you order outside a plan will show up here.'
                }
                actionLabel="Browse the menu"
                onAction={() => router.push('/(tabs)/foods')}
              />
            }
            ListFooterComponent={
              <LoadMore
                hasMore={hasNextPage}
                loading={isFetchingNextPage}
                onPress={() => fetchNextPage()}
                label="Load older orders"
                className="px-0"
              />
            }
            renderItem={({ item }) => (
              <OrderCard
                order={item}
                slotName={slotById?.get(item.slot_id)?.name}
                onPress={openOrder}
                action={
                  isPayable(item.payment) ? (
                    <Button
                      label="Pay now"
                      size="sm"
                      fullWidth={false}
                      onPress={() => openCheckout(item.payment!.checkout_url!)}
                    />
                  ) : null
                }
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
