import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, PackageCard, ScreenHeader } from '@/components/shared';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import { usePackages } from '@/lib/query/hooks';

/**
 * Every meal box an admin published at `/admin/catalog/packages`.
 *
 * Boxes are bought outright rather than subscribed to, so they get their own
 * screen beside Foods and Plans instead of being folded into either — the same
 * split the website makes with `/packages`.
 *
 * Public: no session needed. Adding to the basket is local, and the sign-in ask
 * waits until the order screen.
 */
export default function PackagesScreen() {
  const router = useRouter();
  const { data: packages, isLoading, isFetching, isError, error, refetch } = usePackages();

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Meal boxes" subtitle="Complete meals at one price" />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        <Text className="mb-4 text-sm text-text-secondary">
          Hand-picked combinations from our kitchen — usually cheaper than ordering
          each dish separately. No subscription needed.
        </Text>

        {isLoading ? (
          <View className="gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : !packages || packages.length === 0 ? (
          <EmptyState
            title="No meal boxes right now"
            description="Our kitchen is putting new boxes together — check back soon."
            actionLabel="Browse dishes"
            onAction={() => router.push('/(tabs)/foods')}
          />
        ) : (
          <View className="gap-4">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onPress={() =>
                  router.push({
                    pathname: '/package/[id]',
                    params: { id: String(pkg.id) },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
