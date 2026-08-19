import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BannerIllustration from '@/components/illustrations/BannerIllustration';
import {
  FoodCard,
  OfflineBanner,
  PlanCard,
  PromoCarousel,
  SubscriptionSummaryCard,
} from '@/components/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  SkeletonCard,
} from '@/components/ui';
import {
  FALLBACK_HOME_LAYOUT,
  useCurrentSubscription,
  useFeaturedPlanId,
  useFoods,
  useHomeLayout,
  useIsSignedIn,
  usePlans,
  useProfile,
  useTodaysDelivery,
} from '@/lib/query/hooks';
import { useAuthPromptStore, useCurrentUser } from '@/lib/store';
import { cmsText, openCmsLink, resolveCmsLink } from '@/lib/cms';
import { formatLongDate, todayISO } from '@/lib/utils';

/**
 * Home.
 *
 * Several independent queries run in parallel — each renders as it lands, so a
 * slow one never blocks the rest of the screen. Today's delivery is derived
 * from the cached delivery list rather than fetched separately, so Home and the
 * Menu tab can't disagree about what is arriving today.
 *
 * Readable signed out. The subscription-shaped parts simply don't render
 * without a session (their queries are disabled), and what remains is the
 * public catalogue plus an invitation — no wall, no redirect.
 *
 * ── What the admin panel controls ───────────────────────────────────────────
 * The promo carousel, the copy above the two catalogue rails, how many cards
 * each shows, whether they appear at all, and the closing call-to-action card
 * all come from `GET /home?platform=app` — the same source the website reads.
 * Everything session-shaped (the greeting, today's delivery, the subscription
 * summary) is deliberately *not* CMS-driven: it is this customer's own state,
 * not marketing.
 *
 * The CMS is additive, never load-bearing: `FALLBACK_HOME_LAYOUT` keeps both
 * rails on when the read is in flight or fails, so an API problem costs the
 * promos, not the shop.
 */
export default function HomeScreen() {
  const router = useRouter();
  const today = todayISO();

  const signedIn = useIsSignedIn();
  const promptLogin = useAuthPromptStore((s) => s.prompt);

  const sessionUser = useCurrentUser();
  const { data: profile } = useProfile();

  const {
    data: subscription,
    isLoading: subLoading,
    isFetching: subFetching,
    refetch: refetchSub,
  } = useCurrentSubscription();

  const { delivery, isLoading: deliveryLoading } = useTodaysDelivery(
    subscription?.id,
    today,
  );

  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = usePlans();
  const { data: featuredId } = useFeaturedPlanId();
  const { data: foods, refetch: refetchFoods } = useFoods();

  const { data: cmsLayout, refetch: refetchHome } = useHomeLayout();
  const layout = cmsLayout ?? FALLBACK_HOME_LAYOUT;

  const displayName = profile?.name ?? sessionUser?.name ?? '';
  const firstName = displayName.split(' ')[0];

  const onRefresh = () => {
    refetchSub();
    refetchPlans();
    refetchFoods();
    refetchHome();
  };

  const popularFoods = (foods?.items ?? []).slice(
    0,
    layout.featuredMenu.content?.limit ?? 6,
  );
  const promotedPlans = (plans ?? []).slice(0, layout.plans.content?.limit ?? 2);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      <OfflineBanner />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={subFetching && !subLoading} onRefresh={onRefresh} />
        }
      >
        {/* Greeting */}
        <View className="flex-row items-center justify-between px-5 pb-4 pt-6">
          <View className="flex-1">
            <Text className="text-sm text-text-secondary">
              {firstName ? `Hello, ${firstName}` : 'Welcome to Ahaar'}
            </Text>
            <Text className="text-2xl font-bold text-text-primary">
              What&apos;s cooking today?
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={signedIn ? 'Your account' : 'Sign in'}
            onPress={() =>
              signedIn
                ? router.push('/profile')
                : promptLogin('to see your account')
            }
            className="active:opacity-70"
          >
            <Avatar name={displayName} size="md" />
          </Pressable>
        </View>

        {/* Admin-uploaded promos. Above the fold but below the greeting: the
            customer's own day comes first, marketing second. */}
        <PromoCarousel banners={layout.promoBanners} heading={layout.promoHeading} />

        {/* Today */}
        <View className="px-5">
          {signedIn && (subLoading || deliveryLoading) ? (
            <Skeleton className="h-32 w-full" />
          ) : delivery ? (
            <Card>
              <View className="p-5">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-bold uppercase text-brand-500">
                      Today
                    </Text>
                    <Text className="mt-0.5 text-base font-bold text-text-primary">
                      {formatLongDate(delivery.delivery_date)}
                    </Text>
                  </View>

                  <Badge
                    label={delivery.before_cutoff ? 'Can still change' : 'Locked'}
                    variant={delivery.before_cutoff ? 'success' : 'muted'}
                  />
                </View>

                <View className="mt-3 gap-1.5">
                  {(delivery.items ?? [])
                    .filter((item) => !item.is_addon)
                    .map((item) => (
                      <Text key={item.id} className="text-sm text-text-secondary">
                        • {item.menu_item?.name ?? `Item #${item.id}`}
                      </Text>
                    ))}
                </View>

                <Button
                  label="View my menu"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onPress={() => router.push('/deliveries')}
                />
              </View>
            </Card>
          ) : subscription ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  No delivery scheduled for today.
                </Text>
                <Button
                  label="See your schedule"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onPress={() => router.push('/deliveries')}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <View className="items-center p-5">
                <BannerIllustration width={200} height={100} />
                <Text className="mt-3 text-center text-base font-bold text-text-primary">
                  {signedIn ? 'Start a meal plan' : 'Fresh meals, your way'}
                </Text>
                <Text className="mt-1 text-center text-sm text-text-secondary">
                  Subscribe for daily deliveries, or order a single dish whenever
                  you like.
                </Text>
                <View className="mt-4 w-full gap-2">
                  <Button
                    label="Browse plans"
                    onPress={() => router.push('/(tabs)/plans')}
                  />
                  <Button
                    label="Order a one-off"
                    variant="outline"
                    onPress={() => router.push('/(tabs)/foods')}
                  />
                </View>
              </View>
            </Card>
          )}
        </View>

        {/* Active subscription */}
        {subscription ? (
          <View className="mt-6 px-5">
            <Text className="mb-3 text-lg font-bold text-text-primary">
              Your subscription
            </Text>
            <SubscriptionSummaryCard subscription={subscription}>
              <Button
                label="Manage"
                variant="outline"
                size="sm"
                onPress={() => router.push('/subscriptions')}
              />
            </SubscriptionSummaryCard>
          </View>
        ) : null}

        {/* Popular dishes — the fastest route to an order. Headings fall back to
            the built-in copy whenever the admin leaves a field empty. */}
        {layout.featuredMenu.enabled && popularFoods.length > 0 ? (
          <View className="mt-6">
            <SectionHeader
              title={cmsText(layout.featuredMenu.content?.heading, 'Popular dishes')}
              subtitle={cmsText(layout.featuredMenu.content?.subheading)}
              actionLabel="See all"
              onAction={() => router.push('/(tabs)/foods')}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
              style={{ flexGrow: 0 }}
            >
              {popularFoods.map((item) => (
                <FoodCard
                  key={item.id}
                  item={item}
                  layout="grid"
                  className="w-44"
                  onPress={() => router.push(`/food/${item.id}`)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Plans */}
        {layout.plans.enabled ? (
          <View className="mt-6">
            <SectionHeader
              title={cmsText(layout.plans.content?.heading, 'Popular plans')}
              subtitle={cmsText(layout.plans.content?.subheading)}
              actionLabel="See all"
              onAction={() => router.push('/(tabs)/plans')}
            />

            <View className="gap-4 px-5">
              {plansLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : promotedPlans.length === 0 ? (
                <EmptyState title="No plans yet" description="Check back soon." />
              ) : (
                promotedPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    featured={plan.id === featuredId}
                    onPress={() =>
                      router.push({
                        pathname: '/plan/[id]',
                        params: { id: String(plan.id) },
                      })
                    }
                  />
                ))
              )}
            </View>
          </View>
        ) : null}

        {/* Closing call to action — shown only when an admin enabled it. */}
        {layout.cta ? (
          <View className="mt-6 px-5">
            <Card>
              <View className="p-5">
                <Text className="text-base font-bold text-text-primary">
                  {cmsText(layout.cta.heading, 'Ready to eat better?')}
                </Text>
                {layout.cta.subheading ? (
                  <Text className="mt-1 text-sm text-text-secondary">
                    {layout.cta.subheading}
                  </Text>
                ) : null}
                {resolveCmsLink(layout.cta.cta_url ?? '/plans') ? (
                  <Button
                    label={cmsText(layout.cta.cta_label, 'Browse plans')}
                    className="mt-4"
                    onPress={() =>
                      openCmsLink(layout.cta?.cta_url ?? '/plans', router)
                    }
                  />
                ) : null}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  /** Optional CMS sub-heading. Empty string renders nothing. */
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="mb-3 px-5">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-lg font-bold text-text-primary">{title}</Text>
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text className="text-sm font-bold text-brand-500">{actionLabel}</Text>
        </Pressable>
      </View>
      {subtitle ? (
        <Text className="mt-0.5 text-sm text-text-secondary">{subtitle}</Text>
      ) : null}
    </View>
  );
}
