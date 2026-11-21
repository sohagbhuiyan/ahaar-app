import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Badge, Button, Card } from '@/components/ui';
import type { Plan } from '@/lib/api/types/catalog';
import i18n from '@/lib/i18n';
import { slotWindow } from '@/lib/slots';
import { colors } from '@/lib/theme';
import { cn, formatMoney } from '@/lib/utils';

import { FoodImage } from './FoodImage';

interface Props {
  plan: Plan;
  /** Visually promotes this plan. */
  featured?: boolean;
  /** The lowest price per day on offer. Ignored when `featured`. */
  bestValue?: boolean;
  /**
   * How much cheaper per day this plan is than the dearest one, in whole
   * percent. Computed by the list from real prices; omit to show nothing.
   */
  savingsPercent?: number | null;
  selected?: boolean;
  onSelect?: (plan: Plan) => void;
  onPress?: (plan: Plan) => void;
  className?: string;
}

/**
 * Marketing label for a duration. Unknown lengths fall back to a day count —
 * durations are open-ended (7, 15, 25, 30…), not a fixed set, so this must
 * never render blank.
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
 * What every subscription includes. Each line is a promise the product
 * already keeps (see the FAQ in `constants/marketing.ts`), not plan data the
 * API lacks — so it is the same on every card. i18n keys.
 */
const INCLUDED = [
  'catalog.plan.included.fresh',
  'catalog.plan.included.swap',
  'catalog.plan.included.skip',
] as const;

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
  const perDay = plan.duration_days > 0 ? plan.price / plan.duration_days : 0;
  // `slots` is `whenLoaded` on the resource: absent means the API wasn't
  // asked, NOT "covers no meals" — so the counts below stay hidden then.
  const mealsPerDay = plan.slots?.length ?? 0;
  const totalMeals = mealsPerDay * plan.duration_days;
  const ribbon = featured
    ? t('catalog.plan.mostPopular')
    : bestValue
      ? t('catalog.plan.bestValue')
      : null;

  return (
    <Card
      elevated={featured || selected}
      onPress={onPress ? () => onPress(plan) : undefined}
      accessibilityLabel={t('catalog.plan.a11y', {
        name: plan.name,
        days: t('common.units.day', { count: plan.duration_days }),
        price: formatMoney(plan.price),
      })}
      className={cn(featured && 'border-brand-200', selected && 'border-brand-500', className)}
    >
      {/* Always drawn — a plan without a photo gets the food glyph, so the
          cards in the list keep one height and none looks half-loaded. */}
      <View>
        <FoodImage uri={plan.image_url} label={plan.name} glyphSize="lg" className="h-40 w-full" />

        {ribbon ? (
          <View className="absolute left-3 top-3 rounded-full bg-brand-500 px-3 py-1">
            <Text className="text-[11px] font-bold uppercase tracking-wide text-text-inverse">
              {ribbon}
            </Text>
          </View>
        ) : null}

        <View className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1">
          <Text className="text-xs font-bold text-text-primary">
            {durationLabel(plan.duration_days)}
          </Text>
        </View>
      </View>

      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-text-primary">{plan.name}</Text>
            <Text className="mt-0.5 text-xs font-semibold text-text-muted">
              {t('common.units.day', { count: plan.duration_days })}
              {mealsPerDay > 0
                ? ` · ${t('catalog.units.mealsPerDay', { count: mealsPerDay })}`
                : ''}
            </Text>
          </View>

          {savingsPercent && savingsPercent > 0 ? (
            <Badge label={t('catalog.plan.savePercent', { percent: savingsPercent })} variant="success" />
          ) : null}
        </View>

        <View className="mt-4 flex-row items-end">
          <Text className="text-3xl font-bold text-text-primary">
            {formatMoney(plan.price)}
          </Text>
          <Text className="mb-1 ml-1.5 text-sm text-text-muted">
            {/* Per-day is the number people actually compare plans on. */}
            {t('catalog.plan.perDay', { price: formatMoney(perDay) })}
          </Text>
        </View>

        {/* At a glance: what the price buys. */}
        <View className="mt-4 flex-row rounded-2xl bg-surface-muted">
          <Stat
            value={String(plan.duration_days)}
            label={t('catalog.plan.stat.days', { count: plan.duration_days })}
          />
          <Stat
            value={mealsPerDay > 0 ? String(mealsPerDay) : '—'}
            label={t('catalog.plan.stat.mealsPerDay', { count: mealsPerDay })}
          />
          <Stat
            value={mealsPerDay > 0 ? String(totalMeals) : '—'}
            label={t('catalog.plan.stat.totalMeals', { count: totalMeals })}
            last
          />
        </View>

        {/* Which meals the plan covers, with their delivery windows. */}
        {plan.slots && plan.slots.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {plan.slots.map((slot) => (
              <Badge
                key={slot.id}
                label={[slot.name, slotWindow(slot)].filter(Boolean).join(' · ')}
                variant="brand"
              />
            ))}
          </View>
        ) : null}

        {plan.description ? (
          <Text numberOfLines={3} className="mt-3 text-sm leading-5 text-text-secondary">
            {plan.description}
          </Text>
        ) : null}

        <View className="mt-4 gap-2">
          {INCLUDED.map((line) => (
            <View key={line} className="flex-row items-center gap-2">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-success-soft">
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6 9 17l-5-5"
                    stroke={colors.status.success}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text className="flex-1 text-xs text-text-secondary">{t(line)}</Text>
            </View>
          ))}
        </View>

        {onSelect ? (
          <View className="mt-5 flex-row gap-2">
            {onPress ? (
              <Button
                label={t('catalog.plan.viewMenu')}
                variant="outline"
                fullWidth={false}
                className="flex-1"
                onPress={() => onPress(plan)}
              />
            ) : null}
            <Button
              label={selected ? t('catalog.plan.selected') : t('catalog.plan.choose')}
              variant={selected ? 'secondary' : 'primary'}
              fullWidth={false}
              className="flex-1"
              onPress={() => onSelect(plan)}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function Stat({ value, label, last = false }: { value: string; label: string; last?: boolean }) {
  return (
    <View className={cn('flex-1 items-center py-2.5', !last && 'border-r border-border')}>
      <Text className="text-base font-bold text-text-primary">{value}</Text>
      <Text className="mt-0.5 text-[11px] text-text-muted">{label}</Text>
    </View>
  );
}

export const PlanCard = memo(PlanCardComponent);
