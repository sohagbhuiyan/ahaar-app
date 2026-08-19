import { useMemo } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodCard, OfflineBanner } from '@/components/shared';
import { Button, EmptyState, ErrorState, Input, SkeletonCard, Stepper } from '@/components/ui';
import type { MenuItem } from '@/lib/api/types/catalog';
import { useFilteredFoods, useFoodCategories } from '@/lib/query/hooks';
import { useFilterStore, useHasActiveFilters, useInstantOrderStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { cn, formatMoney } from '@/lib/utils';

/**
 * The public catalogue.
 *
 * Browsable without an account — `GET /menu-items` is an unauthenticated read,
 * and adding to the basket is local. Authentication is only demanded at
 * checkout, by `/order`.
 *
 * ── Layout note ─────────────────────────────────────────────────────────────
 * Everything above the rows (title, search, category chips) is the list's
 * `ListHeaderComponent` rather than a sibling of it. As siblings they competed
 * with the list for vertical space in the column, and the horizontal chip
 * `ScrollView` in particular has no intrinsic height to shrink to — which is
 * what left the catalogue rendering into zero height on some devices. Inside
 * the header they are laid out by the list, scroll away as the customer reads,
 * and can't squeeze the rows out of existence.
 */
export default function FoodsScreen() {
  const router = useRouter();

  const searchTerm = useFilterStore((s) => s.searchTerm);
  const setSearchTerm = useFilterStore((s) => s.setSearchTerm);
  const categorySlug = useFilterStore((s) => s.categorySlug);
  const setCategory = useFilterStore((s) => s.setCategory);
  const addonsOnly = useFilterStore((s) => s.addonsOnly);
  const setAddonsOnly = useFilterStore((s) => s.setAddonsOnly);
  const reset = useFilterStore((s) => s.reset);
  const hasFilters = useHasActiveFilters();

  const lines = useInstantOrderStore((s) => s.lines);
  const addLine = useInstantOrderStore((s) => s.add);
  const setQuantity = useInstantOrderStore((s) => s.setQuantity);

  const {
    items,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFilteredFoods();

  // Derived from the unfiltered catalogue, so picking one category never hides
  // the others — see `useFoodCategories`.
  const categories = useFoodCategories();

  const quantityFor = (menuItemId: number) =>
    lines.find((l) => l.menu_item_id === menuItemId)?.quantity ?? 0;

  const openItem = (item: MenuItem) => router.push(`/food/${item.id}`);

  const add = (item: MenuItem) =>
    addLine({
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.base_price,
      image_url: item.image_url,
    });

  const listHeader = (
    <View className="pb-1">
      <View className="pb-3 pt-2">
        <Text className="text-2xl font-bold text-text-primary">Foods</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Everything on the Ahaar menu — order any of it for a day that suits you
        </Text>
      </View>

      <Input
        placeholder="Search dishes"
        value={searchTerm}
        onChangeText={setSearchTerm}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        containerClassName="pb-3"
      />

      {/* Negative margin cancels the list's horizontal padding so the chip row
          bleeds to the screen edge and reads as scrollable. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        style={{ marginHorizontal: -20 }}
        className="pb-3"
      >
        <Chip label="All" active={!addonsOnly && !categorySlug} onPress={reset} />
        {categories.map(({ slug, name }) => (
          <Chip
            key={slug}
            label={name}
            active={categorySlug === slug}
            onPress={() => setCategory(slug)}
          />
        ))}
        <Chip
          label="Add-ons"
          active={addonsOnly}
          onPress={() => setAddonsOnly(!addonsOnly)}
        />
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <OfflineBanner />

      <View className="flex-1">
        {isLoading ? (
          <View className="gap-3 px-5 pt-6">
            <SkeletonCard />
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
            data={items}
            keyExtractor={(item) => String(item.id)}
            // FlashList v2 measures rows itself — `estimatedItemSize` was removed
            // in 2.0 and passing it is now a type error.
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
            ListHeaderComponent={listHeader}
            ItemSeparatorComponent={() => <View className="h-3" />}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
            }
            // Page in ahead of the end so the spinner rarely becomes visible.
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }}
            ListEmptyComponent={
              <EmptyState
                title={hasFilters ? 'No matches' : 'Nothing on the menu yet'}
                description={
                  searchTerm
                    ? `Nothing matches “${searchTerm}”.`
                    : hasFilters
                      ? 'Try a different category.'
                      : 'Check back soon for new dishes.'
                }
                actionLabel={hasFilters ? 'Clear filters' : undefined}
                onAction={hasFilters ? reset : undefined}
              />
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-6">
                  <ActivityIndicator color={colors.brand[500]} />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const quantity = quantityFor(item.id);

              return (
                <FoodCard
                  item={item}
                  onPress={openItem}
                  layout="row"
                  action={
                    quantity > 0 ? (
                      <Stepper
                        size="sm"
                        value={quantity}
                        min={1}
                        label={`${item.name} quantity`}
                        onChange={(next) => setQuantity(item.id, next)}
                      />
                    ) : (
                      <Button
                        label="Add"
                        size="sm"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() => add(item)}
                      />
                    )
                  }
                />
              );
            }}
          />
        )}
      </View>

      <BasketBar onPress={() => router.push('/order')} />
    </SafeAreaView>
  );
}

/**
 * Floating basket summary.
 *
 * Sits above the tab bar and only appears once something is in it, so the
 * catalogue is uncluttered until there is an order to complete.
 */
function BasketBar({ onPress }: { onPress: () => void }) {
  const lines = useInstantOrderStore((s) => s.lines);

  const { count, total } = useMemo(
    () => ({
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      total: lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
    }),
    [lines],
  );

  if (count === 0) return null;

  return (
    <View className="absolute inset-x-4 bottom-[76px]">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View basket, ${count} items, ${formatMoney(total)}`}
        onPress={onPress}
        className="flex-row items-center justify-between rounded-2xl bg-brand-500 px-5 py-3.5 active:opacity-90"
        style={{
          shadowColor: colors.brand[500],
          shadowOpacity: 0.3,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View className="flex-row items-center gap-2">
          <View className="h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5">
            <Text className="text-xs font-bold text-text-inverse">{count}</Text>
          </View>
          <Text className="text-sm font-bold text-text-inverse">View basket</Text>
        </View>

        <Text className="text-sm font-bold text-text-inverse">
          {formatMoney(total)}
        </Text>
      </Pressable>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      className={cn(
        'rounded-2xl px-4 py-2',
        active ? 'bg-brand-500' : 'bg-surface-muted',
      )}
    >
      <Text
        className={cn(
          'text-sm font-bold capitalize',
          active ? 'text-text-inverse' : 'text-text-secondary',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
