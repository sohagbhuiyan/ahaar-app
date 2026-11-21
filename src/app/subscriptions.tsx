import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SkeletonCard,
  type BadgeVariant,
} from '@/components/ui';
import type { Subscription, SubscriptionStatus } from '@/lib/api/types/subscription';
import { isPayable } from '@/lib/payments';
import { useIsSignedIn, useSubscriptions } from '@/lib/query/hooks';
import { useAuthPromptStore } from '@/lib/store';
import { formatMoney, formatShortDate } from '@/lib/utils';

const STATUS_VARIANT: Record<SubscriptionStatus, BadgeVariant> = {
  active: 'success',
  paused: 'warning',
  pending: 'warning',
  completed: 'muted',
  cancelled: 'danger',
};

/**
 * Subscription orders — every plan this customer has bought.
 *
 * The web dashboard's "Subscription" section shows the current one; this shows
 * all of them, because a customer who has renewed twice has three of these and
 * needs to be able to open the one they mean. Tapping a row opens its full
 * detail (`/subscriptions/[id]`).
 *
 * `GET /subscriptions` already returns them newest-first with the plan and the
 * payment eager-loaded, so a row can be rendered without a second request.
 */
export default function SubscriptionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const {
    data: subscriptions,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useSubscriptions();


  const open = (subscription: Subscription) =>
    router.push({
      pathname: '/subscriptions/[id]',
      params: { id: String(subscription.id) },
    });

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title={t('account.subscriptions.title')} />
        <EmptyState
          title={t('account.subscriptions.signedOutTitle')}
          description={t('account.subscriptions.signedOutBody')}
          actionLabel={t('common.actions.signIn')}
          onAction={() => promptLogin(t('account.authReason.seeSubscriptions'))}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title={t('account.subscriptions.title')} />
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
        }
      >
        {isLoading ? (
          <View className="gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
        ) : !subscriptions || subscriptions.length === 0 ? (
          <EmptyState
            title={t('account.subscriptions.emptyTitle')}
            description={t('account.subscriptions.emptyBody')}
            actionLabel={t('account.deliveries.browsePlans')}
            onAction={() => router.push('/(tabs)/plans')}
          />
        ) : (
          <View className="gap-3">
            {subscriptions.map((subscription) => {
              // Every meal the plan serves, not one — the row names them all,
              // because "30-day Full Board" alone does not say what arrives.
              const meals = subscription.slots.map((s) => s.name).join(', ');
              const awaitingPayment = isPayable(subscription.payment);

              return (
                <Card key={subscription.id} onPress={() => open(subscription)}>
                  <View className="p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-text-primary">
                          {subscription.plan?.name ?? t('account.planNumber', { id: subscription.id })}
                        </Text>
                        <Text className="mt-0.5 text-xs text-text-muted">
                          {'\u2068'}#{subscription.id}{'\u2069'}
                          {meals ? ` · ${meals}` : ''}
                          {subscription.plan
                            ? ` · ${t('common.units.day', { count: subscription.plan.duration_days })}`
                            : ''}
                        </Text>
                      </View>

                      <Badge
                        label={t(`common.status.${subscription.status}`, { defaultValue: subscription.status })}
                        variant={STATUS_VARIANT[subscription.status] ?? 'muted'}
                        className="capitalize"
                      />
                    </View>

                    <Text className="mt-2 text-xs text-text-secondary">
                      {t('account.dateRange', {
                        from: formatShortDate(subscription.start_date),
                        to: formatShortDate(subscription.end_date),
                      })}
                    </Text>

                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <Text className="text-base font-bold text-brand-500">
                        {formatMoney(subscription.price_paid)}
                      </Text>

                      {awaitingPayment ? (
                        <Badge label={t('account.subscriptions.paymentDue')} variant="warning" />
                      ) : subscription.payment?.status === 'succeeded' ? (
                        <Badge label={t('common.status.paid')} variant="success" />
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}

            <Button
              label={t('account.deliveries.browsePlans')}
              variant="outline"
              className="mt-2"
              onPress={() => router.push('/(tabs)/plans')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
