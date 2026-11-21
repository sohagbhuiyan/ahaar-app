import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { DeliverySlot } from '@/lib/api/types/catalog';
import { slotWindow } from '@/lib/slots';
import { cn } from '@/lib/utils';

interface Props {
  /** Every meal the plan's weekly menu serves — all of them are included. */
  slots: DeliverySlot[];
  durationDays: number;
  className?: string;
}

/**
 * The meals a plan includes.
 *
 * This states rather than asks. A plan's flat price buys every meal its weekly
 * menu defines — breakfast *and* lunch *and* dinner where the admin laid all
 * three out — so there is nothing to choose, and the covered meals are read off
 * the plan at purchase rather than picked.
 *
 * Saying so plainly at checkout matters twice over: it is what the customer is
 * paying for, and it is the precondition for swapping later. Moving tonight's
 * fish onto today's lunch only works because both plates belong to them.
 */
export function PlanMealsIncluded({ slots, durationDays, className }: Props) {
  const { t } = useTranslation();
  if (slots.length === 0) {
    return (
      <Text className={cn('text-sm text-text-secondary', className)}>
        {t('catalog.planMeals.none')}
      </Text>
    );
  }

  const perDay = slots.length;
  const total = perDay * durationDays;

  return (
    <View className={cn('gap-2', className)}>
      {slots.map((slot) => (
        <View
          key={slot.id}
          className="flex-row items-center justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3"
        >
          <Text className="text-sm font-semibold text-text-primary">{slot.name}</Text>
          <Text className="text-xs text-text-muted">{slotWindow(slot)}</Text>
        </View>
      ))}

      <Text className="mt-1 text-xs text-text-muted">
        {perDay === 1
          ? t('catalog.planMeals.single', {
              deliveries: t('catalog.units.delivery', { count: total }),
              days: t('common.units.day', { count: durationDays }),
            })
          : t('catalog.planMeals.multiple', {
              perDay: t('catalog.units.mealsPerDay', { count: perDay }),
              days: t('common.units.day', { count: durationDays }),
              deliveries: t('catalog.units.delivery', { count: total }),
            })}
      </Text>
    </View>
  );
}
