import { Fragment, useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import BannerIllustration from '@/components/illustrations/BannerIllustration';
import {
  AhaarLogo,
  CartButton,
  CategoryRail,
  ClosingCta,
  DeliveryCoverage,
  FaqSection,
  FoodCard,
  FoodImage,
  HomeHero,
  HowItWorksSection,
  KitchenVideosRail,
  LanguageSwitcher,
  LocationSheet,
  NotificationBell,
  OfflineBanner,
  PackageCard,
  PlanCard,
  PlanTrustStrip,
  PROMO_ASPECT,
  PromoCarousel,
  PromoCodeStrip,
  SubscriptionSummaryCard,
  TestimonialsSection,
  WhyAhaarSection,
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
import type {
  AppSectionType,
  CatalogSectionContent,
  CtaContent,
  FaqContent,
  HeadingContent,
  HeroContent,
  HomeSection,
  PromoContent,
  TestimonialsContent,
} from '@/lib/api/types/home';
import {
  FALLBACK_HOME_LAYOUT,
  useCategoryTiles,
  useCurrentSubscription,
  useFeaturedPlanId,
  useFirstLocationPrompt,
  useFoods,
  useHomeLayout,
  useIsSignedIn,
  useMediaVideos,
  usePackages,
  usePlans,
  useProfile,
  useTodaysDelivery,
} from '@/lib/query/hooks';
import { useAuthPromptStore, useCurrentUser, useFilterStore } from '@/lib/store';
import { cmsHeading, cmsText } from '@/lib/cms';
import { useFormatters } from '@/lib/i18n/format';
import { todayISO } from '@/lib/utils';

/**
 * Where the sections that are not CMS types go. Each rides directly behind the
 * first of its anchors the admin has left on, the same way the website pins its
 * bundles after the featured dishes — so switching one section off never takes
 * an unrelated block down with it.
 */
const MEAL_BOXES_AFTER: AppSectionType[] = ['featured_menu', 'category_showcase', 'plans'];
const COVERAGE_AFTER: AppSectionType[] = ['testimonials', 'why_us', 'how_it_works', 'faq'];

function anchorOf(sections: HomeSection[], candidates: AppSectionType[]): AppSectionType | null {
  return candidates.find((type) => sections.some((s) => s.type === type)) ?? null;
}

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
 * ── Layout ──────────────────────────────────────────────────────────────────
 * Two halves. The top is pinned and is this customer's own day: greeting,
 * today's meals and their subscription. Nothing the admin
 * does can move it, because it is not marketing.
 *
 * Everything below comes from `GET /home?platform=app` — the same admin panel
 * (Content → Layout & Copy, "Mobile app") and the same banners as the website:
 * which sections appear, in what order, and their copy. Seeded order: hero,
 * banners, categories, dishes (meal boxes pinned behind), kitchen videos,
 * plans, then the pitch.
 *
 * The CMS is additive, never load-bearing: `FALLBACK_HOME_LAYOUT` and an older
 * API both yield a complete screen from shipped copy, so an API problem costs
 * the promos, not the shop.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { formatDate } = useFormatters();
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

  // Plural: a subscription covers every meal its plan serves, so "today" is up
  // to three deliveries, in time-of-day order.
  const { deliveries: todaysMeals, isLoading: deliveryLoading } = useTodaysDelivery(
    subscription?.id,
    today,
  );

  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = usePlans();
  const { data: packages, refetch: refetchPackages } = usePackages();
  const categories = useCategoryTiles();
  const setCategory = useFilterStore((s) => s.setCategory);
  const { data: featuredId } = useFeaturedPlanId();
  const { data: foods, refetch: refetchFoods } = useFoods();
  const { refetch: refetchVideos } = useMediaVideos();

  const { data: cmsLayout, refetch: refetchHome } = useHomeLayout();
  const layout = cmsLayout ?? FALLBACK_HOME_LAYOUT;

  // Where the food goes. Managed from the Account tab ("Delivery location");
  // Home only offers it once a session (and after each sign-in) while nothing
  // is set, so a first order is never blocked on finding the setting.
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const openLocationSheet = useCallback(() => setLocationSheetOpen(true), []);
  useFirstLocationPrompt(openLocationSheet);

  const displayName = profile?.name ?? sessionUser?.name ?? '';
  const firstName = displayName.split(' ')[0];

  const onRefresh = () => {
    refetchSub();
    refetchPlans();
    refetchFoods();
    refetchHome();
    refetchPackages();
    refetchVideos();
  };

  /**
   * Open the Foods tab already filtered to a category.
   *
   * The filter store is the same one the Foods screen's chip row drives, so the
   * chip for this category is highlighted on arrival and clearing it there
   * behaves exactly as it would if the customer had tapped it themselves.
   * `setCategory` toggles, so an already-selected category is cleared first —
   * otherwise tapping the tile for the category you are already in would
   * silently clear the filter instead of honouring the tap.
   */
  const openCategory = (slug: string) => {
    if (useFilterStore.getState().categorySlug !== slug) setCategory(slug);
    router.push('/(tabs)/foods');
  };

  const sections = layout.sections;
  const mealBoxesAnchor = anchorOf(sections, MEAL_BOXES_AFTER);
  const coverageAnchor = anchorOf(sections, COVERAGE_AFTER);

  /** Meal boxes — bundles from /admin/catalog/packages, bought outright. */
  const mealBoxes =
    packages && packages.length > 0 ? (
      <View className="mt-6">
        <SectionHeader
          title={t('home.mealBoxes.title')}
          subtitle={t('home.mealBoxes.subtitle')}
          actionLabel={t('common.actions.seeAll')}
          onAction={() => router.push('/packages')}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
          style={{ flexGrow: 0 }}
        >
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              className="w-64"
              onPress={() =>
                router.push({
                  pathname: '/package/[id]',
                  params: { id: String(pkg.id) },
                })
              }
            />
          ))}
        </ScrollView>
      </View>
    ) : null;

  const renderSection = (section: HomeSection) => {
    switch (section.type) {
      case 'hero':
        return <HomeHero content={section.content as HeroContent | null} className="mt-6" />;

      case 'promo_top':
      case 'promo_app':
      case 'promo_mid':
        return (
          <PromoCarousel
            banners={section.banners}
            heading={cmsText((section.content as PromoContent | null)?.heading) || null}
            aspectRatio={PROMO_ASPECT[section.type]}
            className="mt-6"
          />
        );

      case 'promo_codes': {
        const content = section.content as HeadingContent | null;
        return (
          <PromoCodeStrip
            codes={section.codes}
            heading={content?.heading}
            subheading={content?.subheading}
            className="mt-6"
          />
        );
      }

      // Explore by category — the admin's own categories, each opening the
      // Foods tab filtered to it. The coarser choice before the dish rail: pick
      // a craving, then pick a dish.
      case 'category_showcase': {
        if (categories.length === 0) return null;
        const copy = cmsHeading(section.content as HeadingContent | null, {
          title: t('home.categories.title'),
          subtitle: t('home.categories.subtitle'),
        });
        return (
          <View className="mt-6">
            <SectionHeader
              {...copy}
              actionLabel={t('common.actions.seeAll')}
              onAction={() => router.push('/(tabs)/foods')}
            />
            <CategoryRail categories={categories} onSelect={openCategory} />
          </View>
        );
      }

      // Popular dishes — the fastest route to an order.
      case 'featured_menu': {
        const content = section.content as CatalogSectionContent | null;
        const items = (foods?.items ?? []).slice(0, content?.limit ?? 6);
        if (items.length === 0) return null;
        const copy = cmsHeading(content, { title: t('home.popularDishes.title') });
        return (
          <View className="mt-6">
            <SectionHeader
              {...copy}
              actionLabel={t('common.actions.seeAll')}
              onAction={() => router.push('/(tabs)/foods')}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
              style={{ flexGrow: 0 }}
            >
              {items.map((item) => (
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
        );
      }

      // Kitchen videos — two by default; "See all" opens the Media tab. Renders
      // nothing until the kitchen has posted one.
      case 'media_videos': {
        const content = section.content as CatalogSectionContent | null;
        const copy = cmsHeading(content, {
          title: t('home.kitchen.title'),
          subtitle: t('home.kitchen.subtitle'),
        });
        return (
          <KitchenVideosRail
            layout="stack"
            {...copy}
            limit={content?.limit ?? 2}
            className="mt-6"
          />
        );
      }

      case 'plans': {
        const content = section.content as CatalogSectionContent | null;
        const promoted = (plans ?? []).slice(0, content?.limit ?? 2);
        const copy = cmsHeading(content, { title: t('home.popularPlans.title') });
        return (
          <View className="mt-6">
            <SectionHeader
              {...copy}
              actionLabel={t('common.actions.seeAll')}
              onAction={() => router.push('/(tabs)/plans')}
            />

            <View className="gap-4 px-5">
              {plansLoading ? (
                <>
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : promoted.length === 0 ? (
                <EmptyState
                  title={t('home.popularPlans.emptyTitle')}
                  description={t('home.popularPlans.emptyDescription')}
                />
              ) : (
                promoted.map((plan) => (
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

            {promoted.length > 0 ? <PlanTrustStrip className="mt-5 px-5" /> : null}
          </View>
        );
      }

      case 'how_it_works':
        return (
          <HowItWorksSection content={section.content as HeadingContent | null} className="mt-8" />
        );

      case 'why_us':
        return (
          <WhyAhaarSection content={section.content as HeadingContent | null} className="mt-8" />
        );

      case 'testimonials':
        return (
          <TestimonialsSection
            content={section.content as TestimonialsContent | null}
            className="mt-8"
          />
        );

      case 'faq':
        return <FaqSection content={section.content as FaqContent | null} className="mt-8" />;

      case 'cta':
        return <ClosingCta content={section.content as CtaContent | null} className="mt-8" />;

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'left', 'right']}>
      {/* Sticky top bar: outside the ScrollView, flush under the safe area.
          Brand at the start; basket, language and the bell at the end (right,
          or left in Arabic: the row mirrors with RTL). The delivery location
          lives in the Account tab. */}
      <View
        testID="home-header"
        className="h-14 flex-row items-center gap-2 border-b border-border bg-surface pl-4 pr-3"
      >
        <AhaarLogo height={36} />
        <View className="flex-1" />
        <CartButton />
        <LanguageSwitcher />
        <NotificationBell />
      </View>
      <OfflineBanner />

      <ScrollView
        className="flex-1 bg-surface-muted"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={subFetching && !subLoading} onRefresh={onRefresh} />
        }
      >
        {/* Greeting */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="flex-row items-center justify-between px-5 pb-4 pt-4"
        >
          <View className="flex-1">
            <Text className="text-sm text-text-secondary">
              {firstName
                ? t(greetingKeyForNow(), { name: firstName })
                : t('home.greeting.welcome')}
            </Text>
            <Text className="text-2xl font-bold text-text-primary">
              {t('home.greeting.headline')}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={signedIn ? t('home.yourAccount') : t('common.actions.signIn')}
            onPress={() =>
              signedIn
                ? router.push('/profile')
                : promptLogin(t('home.prompt.profile'))
            }
            className="active:opacity-70"
          >
            <Avatar name={displayName} size="md" />
          </Pressable>
        </Animated.View>

        {/* Today */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)} className="px-5">
          {signedIn && (subLoading || deliveryLoading) ? (
            <Skeleton className="h-32 w-full" />
          ) : todaysMeals.length > 0 ? (
            <Card>
              <View className="p-5">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-bold uppercase text-brand-500">
                      {t('common.time.today')}
                    </Text>
                    <Text className="mt-0.5 text-base font-bold text-text-primary">
                      {formatDate(todaysMeals[0].delivery_date, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>

                  {/* One badge for the day: what matters at a glance is whether
                      anything can still be changed, not which meal it was. */}
                  <Badge
                    label={
                      todaysMeals.some((m) => m.before_cutoff)
                        ? t('home.today.canChange')
                        : t('common.status.locked')
                    }
                    variant={
                      todaysMeals.some((m) => m.before_cutoff) ? 'success' : 'muted'
                    }
                  />
                </View>

                {/* Every meal of the day, in time order — a full-board
                    subscriber gets breakfast, lunch and dinner here. */}
                <View className="mt-3 gap-3">
                  {todaysMeals.map((meal) => (
                    <View key={meal.id}>
                      <Text className="text-xs font-semibold uppercase text-text-muted">
                        {meal.slot?.name ?? t('home.today.mealFallback')}
                      </Text>
                      {(meal.items ?? [])
                        .filter((item) => !item.is_addon)
                        .map((item) => (
                          <View key={item.id} className="mt-1.5 flex-row items-center gap-2.5">
                            <FoodImage
                              uri={item.menu_item?.image_url}
                              glyphSize="sm"
                              className="h-8 w-8 rounded-lg"
                            />
                            <Text numberOfLines={1} className="flex-1 text-sm text-text-secondary">
                              {item.menu_item?.name ?? t('home.today.itemFallback', { id: item.id })}
                            </Text>
                          </View>
                        ))}
                    </View>
                  ))}
                </View>

                <View className="mt-4 flex-row gap-2">
                  <Button
                    label={t('home.today.todaysMeals')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    className="flex-1"
                    onPress={() => router.push('/deliveries')}
                  />
                  <Button
                    label={t('home.today.fullSchedule')}
                    variant="outline"
                    size="sm"
                    fullWidth={false}
                    className="flex-1"
                    onPress={() => router.push('/schedule')}
                  />
                </View>
              </View>
            </Card>
          ) : subscription ? (
            <Card>
              <View className="p-5">
                <Text className="text-sm text-text-secondary">
                  {t('home.today.noDelivery')}
                </Text>
                <Button
                  label={t('home.today.seeSchedule')}
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onPress={() => router.push('/schedule')}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <View className="items-center p-5">
                <BannerIllustration width={200} height={100} />
                <Text className="mt-3 text-center text-base font-bold text-text-primary">
                  {signedIn ? t('home.invite.startPlan') : t('home.invite.freshMeals')}
                </Text>
                <Text className="mt-1 text-center text-sm text-text-secondary">
                  {t('home.invite.body')}
                </Text>
                <View className="mt-4 w-full gap-2">
                  <Button
                    label={t('home.invite.browsePlans')}
                    onPress={() => router.push('/(tabs)/plans')}
                  />
                  <Button
                    label={t('home.invite.orderOneOff')}
                    variant="outline"
                    onPress={() => router.push('/(tabs)/foods')}
                  />
                </View>
              </View>
            </Card>
          )}
        </Animated.View>

        {/* Active subscription */}
        {subscription ? (
          <View className="mt-6 px-5">
            <Text className="mb-3 text-lg font-bold text-text-primary">
              {t('home.subscription.title')}
            </Text>
            <SubscriptionSummaryCard subscription={subscription}>
              <View className="flex-row gap-2">
                <Button
                  label={t('home.today.fullSchedule')}
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={() => router.push('/schedule')}
                />
                <Button
                  label={t('common.actions.manage')}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  className="flex-1"
                  onPress={() => router.push('/subscriptions')}
                />
              </View>
            </SubscriptionSummaryCard>
          </View>
        ) : null}

        {/* Everything below follows the admin's app layout. */}
        {sections.map((section) => (
          <Fragment key={section.type}>
            {renderSection(section)}
            {section.type === mealBoxesAnchor ? mealBoxes : null}
            {section.type === coverageAnchor ? <DeliveryCoverage className="mt-8" /> : null}
          </Fragment>
        ))}

        {/* Every anchor switched off: the bundles still have a place. */}
        {mealBoxesAnchor === null ? mealBoxes : null}
      </ScrollView>

      <LocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

/** "Good morning" / "Good afternoon" / "Good evening" key, by the device clock. */
function greetingKeyForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greeting.morning';
  if (hour < 17) return 'home.greeting.afternoon';
  return 'home.greeting.evening';
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  /** Optional CMS label above the title. Empty string renders nothing. */
  eyebrow?: string;
  title: string;
  /** Optional CMS sub-heading. Empty string renders nothing. */
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="mb-3 px-5">
      {eyebrow ? (
        <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">
          {eyebrow}
        </Text>
      ) : null}
      <View className="flex-row items-center justify-between gap-3">
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
