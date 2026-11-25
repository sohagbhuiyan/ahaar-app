import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { Button, Card } from '@/components/ui';
import type { Plan } from '@/lib/api/types/catalog';
import i18n from '@/lib/i18n';
import { colors } from '@/lib/theme';
import { cn, formatMoney } from '@/lib/utils';

import { FoodImage } from './FoodImage';

interface Props {
  plan: Plan;
  /** Visually promotes this plan (brand ring + glow). */
  featured?: boolean;
  /** The lowest price per day on offer. Ignored when `featured`. */
  bestValue?: boolean;
  /**
   * How much cheaper per day this plan is than the dearest one, in whole
   * percent. Computed by the list from real prices; omit to show nothing.
   */
  savingsPercent?: number | null;
  selected?: boolean;
  /** "Choose plan" — straight into checkout with this plan. */
  onSelect?: (plan: Plan) => void;
  /** Tapping the card (and the CTA, when there is no `onSelect`): the plan's detail. */
  onPress?: (plan: Plan) => void;
  className?: string;
}

/**
 * Marketing label for a duration. Unknown lengths fall back to a day count —
 * durations are open-ended (7, 15, 25, 30…), not a fixed set, so this must
 * never render blank. Used by the duration filter chips.
 */
export function durationLabel(days: number): string {
  const known: Record<number, string> = {
    7: 'catalog.duration.weekly',
    14: 'catalog.duration.biWeekly',
    15: 'catalog.duration.biWeekly',
    30: 'catalog.duration.monthly',
  };
  // Called during render by components subscribed via `useTranslation`.
  return known[days] ? i18n.t(known[days]) : i18n.t('catalog.duration.days', { count: days });
}

/**
 * Primary (brand #EA580C) for the recommended plan, secondary (#F97316) for the
 * rest — one orange family, the featured card set apart by its ring and glow.
 */
const ACCENTS = {
  primary: { solid: 'bg-brand-500 active:bg-brand-700', stroke: colors.brand[500] },
  secondary: { solid: 'bg-brand-500 active:bg-brand-700', stroke: colors.brand[400] },
} as const;

/**
 * The one plan card — Home's plans section and the Plans tab both render it.
 * Same design as the website's `PlanCard` (the AHAAR subscription-plans
 * reference): the plan's food image across the top, whole (`contain`), with
 * the duration badge on its top-start corner; then name, the admin-managed
 * short description, a hairline, the SAR price and a full-width
 * "Choose plan →".
 *
 * Corner badges use `start`/`end`, which React Native mirrors under RTL, so
 * Arabic needs no per-direction styles.
 */
function PlanCardComponent({
  plan,
  featured = false,
  bestValue = false,
  savingsPercent,
  selected = false,
  onSelect,
  onPress,
  className,
}: Props) {
  const { t } = useTranslation();
  const accentKey = featured ? 'primary' : 'secondary';
  const accent = ACCENTS[accentKey];
  const perDay = plan.duration_days > 0 ? plan.price / plan.duration_days : 0;
  const ribbon = featured
    ? t('catalog.plan.mostPopular')
    : bestValue
      ? t('catalog.plan.bestValue')
      : null;

  const choose = onSelect ?? onPress;
  const ctaLabel = selected ? t('catalog.plan.selected') : t('catalog.plan.choose');

  return (
    <Card
      elevated={featured || selected}
      onPress={onPress ? () => onPress(plan) : undefined}
      accessibilityLabel={t('catalog.plan.a11y', {
        name: plan.name,
        days: t('common.units.day', { count: plan.duration_days }),
        price: formatMoney(plan.price),
      })}
      testID={`plan-card-${plan.id}`}
      className={cn(
        'bg-surface border-border-cream',
        featured && 'border-2 border-brand-400',
        selected && 'border-2 border-brand-500',
        className,
      )}
    >
      <View className="p-3" testID={`plan-card-${plan.id}-accent-${accentKey}`}>
        {/* Warm image panel: the plated meal shown whole on a soft warm tint. */}
        <View className="overflow-hidden rounded-2xl bg-brand-50">
          <FoodImage
            uri={plan.image_url}
            contentFit="contain"
            glyphSize="lg"
            testID={`plan-card-${plan.id}-photo`}
            className="w-full"
            style={{ aspectRatio: 16 / 10 }}
          />

          <View
            className={cn('flex-row items-center gap-1.5 rounded-full px-3 py-1.5', accent.solid)}
            style={{ position: 'absolute', top: 10, start: 10 }}
          >
            <CalendarGlyph />
            <Text className="text-[13px] font-bold text-text-inverse">
              {t('catalog.duration.days', { count: plan.duration_days })}
            </Text>
          </View>

          {ribbon ? (
            <View
              className="rounded-full bg-white/95 px-2.5 py-1"
              style={{ position: 'absolute', top: 10, end: 10 }}
            >
              <Text className="text-[11px] font-bold text-brand-700">{ribbon}</Text>
            </View>
          ) : (
            <View style={{ position: 'absolute', top: 8, end: 10 }} pointerEvents="none">
              <Sparkle color={accent.stroke} />
            </View>
          )}
        </View>

        <View className="px-1.5 pb-1">
        <Text className="mt-3.5 text-xl font-bold text-text-primary">{plan.name}</Text>

        {plan.short_description ? (
          <Text
            numberOfLines={2}
            className="mt-1 text-[15px] leading-5 text-text-secondary"
            testID={`plan-card-${plan.id}-description`}
          >
            {plan.short_description}
          </Text>
        ) : null}

        <View className="mt-3.5 flex-row items-end justify-between gap-3">
          <Text className="text-2xl font-extrabold text-text-primary">{formatMoney(plan.price)}</Text>
          {savingsPercent && savingsPercent > 0 ? (
            <View className="mb-1 rounded-full bg-success-soft px-2.5 py-0.5">
              <Text className="text-[11px] font-bold text-success">
                {t('catalog.plan.savePercent', { percent: savingsPercent })}
              </Text>
            </View>
          ) : perDay > 0 ? (
            // Per-day is the number people actually compare plans on.
            <Text className="mb-1 text-xs text-text-muted">
              {t('catalog.plan.perDay', { price: formatMoney(perDay) })}
            </Text>
          ) : null}
        </View>

        {choose ? (
          <Button
            label={ctaLabel}
            variant={selected ? 'secondary' : 'primary'}
            className={cn('mt-3.5 h-[52px] rounded-full', !selected && accent.solid)}
            textClassName="text-base"
            accessibilityLabel={`${ctaLabel}: ${plan.name}`}
            right={selected ? undefined : <Arrow />}
            onPress={() => choose(plan)}
            testID={`plan-card-${plan.id}-cta`}
          />
        ) : null}
        </View>
      </View>
    </Card>
  );
}

/** "→", pointing the reading direction's way. */
function Arrow() {
  return (
    <View style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12h14M13 6l6 6-6 6"
          stroke={colors.text.inverse}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function CalendarGlyph() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={3} stroke={colors.text.inverse} strokeWidth={2.2} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={colors.text.inverse} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

/** The little "freshness" strokes on the image's top-end corner. Decorative. */
function Sparkle({ color }: { color: string }) {
  return (
    <View style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}>
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
        <Path d="M9 3.5 7.5 9M20 9.5 14 12" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export const PlanCard = memo(PlanCardComponent);
