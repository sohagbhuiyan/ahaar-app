import { Image } from 'expo-image';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { CategoryTile } from '@/lib/query/hooks';
import { FOOD_BLURHASH } from '@/lib/constants/images';

interface Props {
  categories: CategoryTile[];
  /** Opens the Foods tab filtered to this category. */
  onSelect: (slug: string) => void;
}

/**
 * "Explore by category" — the admin's own categories, each opening the Foods
 * tab filtered to it.
 *
 * The tiles are data, from `useCategoryTiles`, so they always match what
 * `/admin/catalog/categories` actually contains. The website's version of this
 * section used to render six invented slugs against stock photos and led
 * everywhere to an empty list; keeping both storefronts on the same derived
 * list is what stops that happening again on either one.
 *
 * Horizontal rather than a grid: it sits between the customer's own day and the
 * dish rail on Home, and a six-tile grid there pushes the catalogue off-screen.
 */
export function CategoryRail({ categories, onSelect }: Props) {
  if (categories.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
      style={{ flexGrow: 0 }}
    >
      {categories.map((category) => (
        <Pressable
          key={category.slug}
          accessibilityRole="button"
          accessibilityLabel={`${category.name}, ${category.itemCount} ${
            category.itemCount === 1 ? 'dish' : 'dishes'
          }`}
          onPress={() => onSelect(category.slug)}
          className="w-28 overflow-hidden rounded-2xl border border-border bg-surface active:opacity-80"
        >
          <View className="h-20 w-full bg-surface-muted">
            {category.imageUrl ? (
              <Image
                source={{ uri: category.imageUrl }}
                placeholder={{ blurhash: FOOD_BLURHASH }}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              // A category with no photographed dish still gets a tile — an
              // empty-looking gap reads as a loading failure.
              <View className="h-full w-full items-center justify-center bg-brand-50">
                <Text className="text-2xl font-bold text-brand-300">
                  {category.name.charAt(0)}
                </Text>
              </View>
            )}
          </View>

          <View className="p-2.5">
            <Text numberOfLines={1} className="text-xs font-bold text-text-primary">
              {category.name}
            </Text>
            <Text className="mt-0.5 text-[11px] text-text-muted">
              {category.itemCount} {category.itemCount === 1 ? 'dish' : 'dishes'}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
