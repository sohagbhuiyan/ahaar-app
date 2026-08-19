import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanCard, OfflineBanner } from '@/components/shared';
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import PlanIllustration from '@/components/illustrations/PlanIllustration';
import { useFeaturedPlanId, usePlans } from '@/lib/query/hooks';
import { useCartStore } from '@/lib/store';
import type { Plan } from '@/lib/api/types/catalog';

/**
 * Plan selection.
 *
 * Durations come from the API (7, 15, 25, 30…) rather than a hardcoded
 * weekly/monthly toggle — the backend allows any length, so the list simply
 * shows what exists, ordered by duration.
 *
 * Two routes out, and the distinction matters: tapping the card opens the plan
 * detail, where the whole week and its quotas are readable before committing;
 * "Choose" is the shortcut for someone who already knows, and goes straight to
 * checkout. Neither needs an account — the sign-in ask waits until checkout.
 */
export default function PlansScreen() {
  const router = useRouter();
  const { data: plans, isLoading, isFetching, isError, error, refetch } = usePlans();
  const { data: featuredId } = useFeaturedPlanId();

  const selectPlan = useCartStore((s) => s.selectPlan);
  const selectedPlanId = useCartStore((s) => s.plan?.id ?? null);

  const openPlan = (plan: Plan) =>
    router.push({ pathname: '/plan/[id]', params: { id: String(plan.id) } });

  const onSelect = (plan: Plan) => {
    // Snapshot enough to render a total instantly; the server reconfirms it.
    selectPlan({
      id: plan.id,
      name: plan.name,
      duration_days: plan.duration_days,
      price: plan.price,
      currency: plan.currency,
    });
    router.push('/checkout');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          // `isFetching && !isLoading` — a background refetch spins the pull
          // control; only a true first load takes over the screen.
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        <View className="px-5 pb-2 pt-6">
          <Text className="text-2xl font-bold text-text-primary">Meal Plans</Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Subscribe and save — one meal a day, delivered fresh
          </Text>
        </View>

        <View className="my-4 items-center">
          <PlanIllustration width={200} height={120} />
        </View>

        {isLoading ? (
          <View className="gap-4 px-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : !plans || plans.length === 0 ? (
          <EmptyState
            title="No plans available"
            description="Check back soon for new subscription plans."
            actionLabel="Refresh"
            onAction={refetch}
          />
        ) : (
          <View className="gap-4 px-5">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                featured={plan.id === featuredId}
                selected={plan.id === selectedPlanId}
                onPress={openPlan}
                onSelect={onSelect}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
