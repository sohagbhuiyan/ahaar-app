import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import BrandDecor from '@/components/illustrations/BrandDecor';
import {
  KitchenVideosRail,
  OfflineBanner,
  PlanCard,
  PromoCarousel,
  PromoCodeStrip,
} from '@/components/shared';
import { durationLabel } from '@/components/shared/PlanCard';
import { Button, Card, EmptyState, ErrorState, SkeletonCard } from '@/components/ui';
import type { Plan } from '@/lib/api/types/catalog';
import { FAQS, HOW_IT_WORKS } from '@/lib/constants/marketing';
import {
  FALLBACK_HOME_LAYOUT,
  useFeaturedPlanId,
  useHomeLayout,
  usePlans,
} from '@/lib/query/hooks';
import { useCartStore } from '@/lib/store';
import { shadows } from '@/lib/theme';
import { cn, formatMoney } from '@/lib/utils';

/** Promises every subscription keeps — the same claims the FAQ makes. */
const VALUE_PROPS = ['Chef-cooked daily', 'Swap any dish', 'Skip a day, keep the meal'] as const;

/** The two questions people ask before subscribing: skipping, and changing dishes. */
const PLAN_FAQS = FAQS.slice(1, 3);

const perDayOf = (plan: Plan) => (plan.duration_days > 0 ? plan.price / plan.duration_days : 0);

/**
 * Value signals derived from the real prices — nothing invented.
 *
 * "Best value" is the lowest price per day; "Save N%" is how much cheaper per
 * day a plan is than the dearest one. With fewer than two priced plans there is
 * nothing to compare, so neither appears.
 */
function planInsights(plans: Plan[]) {
  const priced = plans.filter((p) => perDayOf(p) > 0);
  if (priced.length < 2) {
    return { bestValueId: null as number | null, savings: new Map<number, number>() };
  }

  const dearest = Math.max(...priced.map(perDayOf));
  const cheapest = priced.reduce((best, p) => (perDayOf(p) < perDayOf(best) ? p : best));

  const savings = new Map<number, number>();
  for (const plan of priced) {
    const percent = Math.round((1 - perDayOf(plan) / dearest) * 100);
    // Under 5% is rounding noise, not a saving worth a badge.
    if (percent >= 5) savings.set(plan.id, percent);
  }

  return {
    bestValueId: perDayOf(cheapest) < dearest ? cheapest.id : null,
    savings,
  };
}

/**
 * Plan selection.
 *
 * Durations come from the API (7, 15, 25, 30…) rather than a hardcoded
 * weekly/monthly toggle — the backend allows any length, so the filter chips
 * are built from what exists.
 *
 * Around the cards, everything a first-time subscriber needs to decide: the
 * admin's current offers, a side-by-side comparison, how a subscription works,
 * the kitchen itself on video, and the two questions people always ask. A
 * route to single dishes closes the page for anyone not ready to commit.
 *
 * Two routes out of a card, and the distinction matters: "View menu" opens the
 * plan detail, where the whole week and its quotas are readable before
 * committing; "Choose plan" is the shortcut for someone who already knows, and
 * goes straight to checkout. Neither needs an account — the sign-in ask waits
 * until checkout.
 */
export default function PlansScreen() {
  const router = useRouter();
  const { data: plans, isLoading, isFetching, isError, error, refetch } = usePlans();
  const { data: featuredId } = useFeaturedPlanId();
  const { data: cmsLayout, refetch: refetchHome } = useHomeLayout();
  const layout = cmsLayout ?? FALLBACK_HOME_LAYOUT;

  const selectPlan = useCartStore((s) => s.selectPlan);
  const selectedPlanId = useCartStore((s) => s.plan?.id ?? null);

  const [duration, setDuration] = useState<number | null>(null);

  const durations = useMemo(
    () => [...new Set((plans ?? []).map((p) => p.duration_days))].sort((a, b) => a - b),
    [plans],
  );
  const insights = useMemo(() => planInsights(plans ?? []), [plans]);

  // A filter for a length that has since been unpublished falls back to all.
  const activeDuration = duration !== null && durations.includes(duration) ? duration : null;
  const visiblePlans =
    activeDuration === null
      ? (plans ?? [])
      : (plans ?? []).filter((p) => p.duration_days === activeDuration);

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

  const onRefresh = () => {
    refetch();
    refetchHome();
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
          <RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} />
        }
      >
        <View className="flex-row items-end justify-between gap-3 px-5 pt-4">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-text-primary">Meal Plans</Text>
            <Text className="mt-1 text-sm text-text-secondary">
              Subscribe once, eat well every day
            </Text>
          </View>
          {plans && plans.length > 0 ? (
            <Text className="mb-0.5 text-xs font-semibold text-text-muted">
              {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
            </Text>
          ) : null}
        </View>

        <Animated.View
          entering={FadeInDown.duration(450)}
          className="mx-5 mb-5 mt-4 overflow-hidden rounded-3xl bg-brand-500 px-5 py-6"
          style={shadows.brand}
        >
          <BrandDecor />
          <Text className="text-[11px] font-bold uppercase tracking-widest text-white/80">
            Subscribe &amp; save
          </Text>
          <Text className="mt-1 text-2xl font-bold text-text-inverse">
            Every meal, sorted.
          </Text>
          <Text className="mt-1.5 text-sm leading-5 text-white/90">
            Pick a plan and a start date — we cook fresh each morning and deliver on
            schedule for as long as it runs.
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            {VALUE_PROPS.map((prop) => (
              <View key={prop} className="rounded-full bg-white/20 px-3 py-1.5">
                <Text className="text-xs font-semibold text-text-inverse">✓ {prop}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* The admin's current offers — the same banners Home shows. */}
        <PromoCarousel banners={layout.promoBanners} heading={layout.promoHeading} />
        <PromoCodeStrip
          codes={layout.promoCodes}
          heading={layout.promoCodesContent?.heading}
          subheading={layout.promoCodesContent?.subheading}
          className="mb-5"
        />

        {durations.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
            style={{ flexGrow: 0 }}
            className="mb-4"
          >
            <FilterChip
              label="All plans"
              active={activeDuration === null}
              onPress={() => setDuration(null)}
            />
            {durations.map((days) => {
              // Two lengths can share a name (14 and 15 are both "Bi-Weekly").
              const ambiguous =
                durations.filter((d) => durationLabel(d) === durationLabel(days)).length > 1;
              return (
                <FilterChip
                  key={days}
                  label={ambiguous ? `${days} days` : durationLabel(days)}
                  active={activeDuration === days}
                  onPress={() => setDuration(days)}
                />
              );
            })}
          </ScrollView>
        ) : null}

        {isLoading ? (
          <View className="gap-4 px-5">
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
          <View className="gap-5 px-5">
            {visiblePlans.map((plan, index) => (
              <Animated.View
                key={plan.id}
                entering={FadeInDown.delay(Math.min(index, 4) * 70).duration(400)}
              >
                <PlanCard
                  plan={plan}
                  featured={plan.id === featuredId}
                  bestValue={plan.id === insights.bestValueId}
                  savingsPercent={insights.savings.get(plan.id) ?? null}
                  selected={plan.id === selectedPlanId}
                  onPress={openPlan}
                  onSelect={onSelect}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {plans && plans.length > 1 ? (
          <ComparePlans
            plans={plans}
            bestValueId={insights.bestValueId}
            featuredId={featuredId ?? null}
            onOpen={openPlan}
          />
        ) : null}

        <HowItWorks />

        <KitchenVideosRail
          className="mt-8"
          title="Inside our kitchen"
          subtitle="Watch the meals in your plan being made"
          limit={5}
        />

        <PlanFaq />

        <View className="mt-8 px-5">
          <Card className="bg-surface-secondary">
            <View className="p-5">
              <Text className="text-base font-bold text-text-primary">
                Not ready to subscribe?
              </Text>
              <Text className="mt-1 text-sm leading-5 text-text-secondary">
                Order any dish on its own, for whichever day suits you.
              </Text>
              <Button
                label="Browse dishes"
                variant="outline"
                className="mt-4 bg-surface"
                onPress={() => router.push('/(tabs)/foods')}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({
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
        'rounded-full border px-4 py-2',
        active ? 'border-brand-500 bg-brand-500' : 'border-border bg-surface',
      )}
    >
      <Text
        className={cn('text-sm font-bold', active ? 'text-text-inverse' : 'text-text-secondary')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-bold uppercase tracking-wider text-brand-500">{eyebrow}</Text>
      <Text className="mt-1 text-lg font-bold text-text-primary">{title}</Text>
    </View>
  );
}

/** Every plan in one table: length, price per day and the total. */
function ComparePlans({
  plans,
  bestValueId,
  featuredId,
  onOpen,
}: {
  plans: Plan[];
  bestValueId: number | null;
  featuredId: number | null;
  onOpen: (plan: Plan) => void;
}) {
  return (
    <View className="mt-8 px-5">
      <SectionHeading eyebrow="Side by side" title="Compare plans" />

      <Card>
        <View className="flex-row bg-surface-muted px-4 py-2.5">
          <Text className="flex-1 text-[11px] font-bold uppercase text-text-muted">Plan</Text>
          <Text className="w-12 text-right text-[11px] font-bold uppercase text-text-muted">
            Days
          </Text>
          <Text className="w-20 text-right text-[11px] font-bold uppercase text-text-muted">
            Per day
          </Text>
          <Text className="w-24 text-right text-[11px] font-bold uppercase text-text-muted">
            Total
          </Text>
        </View>

        {plans.map((plan, index) => {
          const tag =
            plan.id === featuredId ? 'Popular' : plan.id === bestValueId ? 'Best value' : null;
          return (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityLabel={`${plan.name}: ${plan.duration_days} days, ${formatMoney(perDayOf(plan))} a day, ${formatMoney(plan.price)} in total`}
              onPress={() => onOpen(plan)}
              className={cn(
                'flex-row items-center px-4 py-3 active:bg-surface-muted',
                index > 0 && 'border-t border-border',
              )}
            >
              <View className="flex-1 pr-2">
                <Text numberOfLines={1} className="text-sm font-bold text-text-primary">
                  {plan.name}
                </Text>
                {tag ? (
                  <Text className="mt-0.5 text-[11px] font-semibold text-brand-500">{tag}</Text>
                ) : null}
              </View>
              <Text className="w-12 text-right text-sm text-text-secondary">
                {plan.duration_days}
              </Text>
              <Text
                className={cn(
                  'w-20 text-right text-sm',
                  plan.id === bestValueId ? 'font-bold text-success' : 'text-text-secondary',
                )}
              >
                {formatMoney(perDayOf(plan))}
              </Text>
              <Text className="w-24 text-right text-sm font-bold text-text-primary">
                {formatMoney(plan.price)}
              </Text>
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

function HowItWorks() {
  return (
    <View className="mt-8 px-5">
      <SectionHeading eyebrow="How it works" title="From plan to plate" />

      <View className="flex-row flex-wrap gap-3">
        {HOW_IT_WORKS.map((step) => (
          <Card key={step.n} className="w-[48%]">
            <View className="p-4">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
                <Text className="text-xs font-bold text-brand-700">{step.n}</Text>
              </View>
              <Text className="mt-3 text-sm font-bold text-text-primary">{step.title}</Text>
              <Text numberOfLines={4} className="mt-1 text-[11px] leading-4 text-text-secondary">
                {step.body}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

function PlanFaq() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <View className="mt-8 px-5">
      <SectionHeading eyebrow="Good to know" title="Before you subscribe" />

      <View className="gap-2">
        {PLAN_FAQS.map((faq, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={faq.q}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              className="rounded-2xl border border-border bg-surface px-4 py-3.5 active:opacity-80"
            >
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm font-bold text-text-primary">{faq.q}</Text>
                <Text className="text-base text-text-muted">{expanded ? '−' : '+'}</Text>
              </View>
              {expanded ? (
                <Text className="mt-2 text-xs leading-5 text-text-secondary">{faq.a}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
