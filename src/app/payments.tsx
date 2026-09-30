import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner, ScreenHeader } from '@/components/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadMore,
  Separator,
  SkeletonCard,
} from '@/components/ui';
import {
  isAwaitingCash,
  isPayable,
  openCheckout,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/payments';
import { useIsSignedIn, usePayments } from '@/lib/query/hooks';
import { useAuthPromptStore } from '@/lib/store';
import { formatMoney, formatShortDate } from '@/lib/utils';


/**
 * Payment history — every charge on this account.
 *
 * `PaymentResource` deliberately does not say what each payment was *for*: the
 * `payable` relation is polymorphic and is not exposed on the customer
 * resource. So this screen answers "what have I been charged?" and leaves "what
 * did I buy?" to the order and subscription screens, rather than inventing a
 * link the API can't back up.
 *
 * The one thing it does act on is an outstanding payment: `pending` with a
 * `checkout_url` is a charge the customer can still complete, and that is the
 * whole reason to open this screen.
 */
export default function PaymentsScreen() {
  const router = useRouter();
  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const {
    data: payments,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePayments();

  if (!signedIn) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScreenHeader title="Payments" />
        <EmptyState
          title="Sign in to see your payments"
          description="Charges, refunds and anything still outstanding."
          actionLabel="Sign in"
          onAction={() => promptLogin('to see your payments')}
          className="flex-1 justify-center"
        />
      </SafeAreaView>
    );
  }

  // Only card payments the customer can still complete. A cash payment is
  // `pending` too, but it is settled at the door — listing it as "outstanding"
  // would invite them to pay for it twice.
  const outstanding = (payments ?? []).filter((p) => isPayable(p));
  const awaitingCash = (payments ?? []).filter((p) => isAwaitingCash(p));

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScreenHeader title="Payments" />
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
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="Charges for your orders and plans will show up here."
            actionLabel="Browse the menu"
            onAction={() => router.push('/(tabs)/foods')}
          />
        ) : (
          <>
            {outstanding.length > 0 ? (
              <Card className="mb-4 border-warning">
                <View className="p-5">
                  <Text className="text-sm font-bold text-text-primary">
                    {outstanding.length} payment
                    {outstanding.length > 1 ? 's' : ''} outstanding
                  </Text>
                  <Text className="mt-1 text-xs text-text-secondary">
                    Nothing is confirmed until these go through.
                  </Text>
                  <Button
                    label={`Pay ${formatMoney(
                      outstanding.reduce((sum, p) => sum + p.amount, 0),
                    )}`}
                    className="mt-4"
                    onPress={() => openCheckout(outstanding[0].checkout_url!)}
                  />
                </View>
              </Card>
            ) : null}

            {awaitingCash.length > 0 ? (
              <Card className="mb-4 border-brand-500">
                <View className="p-5">
                  <Text className="text-sm font-bold text-text-primary">
                    {awaitingCash.length} cash{' '}
                    {awaitingCash.length === 1 ? 'payment' : 'payments'} on the way
                  </Text>
                  <Text className="mt-1 text-xs text-text-secondary">
                    Pay{' '}
                    {formatMoney(awaitingCash.reduce((sum, p) => sum + p.amount, 0))}{' '}
                    in cash when your {awaitingCash.length === 1 ? 'order arrives' : 'orders arrive'}.
                    Nothing to do here.
                  </Text>
                </View>
              </Card>
            ) : null}

            <Card>
              <View className="p-5">
                {payments.map((payment, index) => (
                  <View key={payment.id}>
                    {index > 0 ? <Separator className="my-3" /> : null}

                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-bold text-text-primary">
                          {formatMoney(payment.amount)}
                        </Text>
                        <Text className="mt-0.5 text-xs text-text-muted">
                          #{payment.id} ·{' '}
                          {formatShortDate(
                            (payment.paid_at ?? payment.created_at).slice(0, 10),
                          )}{' '}
                          · {paymentMethodLabel(payment)}
                        </Text>
                      </View>

                      <Badge
                        label={paymentStatusLabel(payment)}
                        variant={paymentStatusTone(payment)}
                      />
                    </View>

                    {isPayable(payment) ? (
                      <Button
                        label="Pay now"
                        size="sm"
                        fullWidth={false}
                        className="mt-2 self-start"
                        onPress={() => openCheckout(payment.checkout_url)}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            </Card>

            <LoadMore
              hasMore={hasNextPage}
              loading={isFetchingNextPage}
              onPress={() => fetchNextPage()}
              label="Load older payments"
              className="px-0"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
