import { memo } from 'react';
import { Text, View } from 'react-native';

import { Badge, Card, type BadgeVariant } from '@/components/ui';
import type { ScheduleDay, ScheduleMeal, SchedulePlate } from '@/lib/api/types/swap';
import { slotWindow } from '@/lib/slots';
import { cn, formatLongDate, isToday, todayISO } from '@/lib/utils';

import { FoodImage } from './FoodImage';

interface Props {
  day: ScheduleDay;
  /** Opens the day in the actionable Deliveries screen. Omit for read-only. */
  onOpen?: (date: string) => void;
  className?: string;
}

/**
 * One calendar day of a subscription, with every meal on it.
 *
 * The day — not the meal — is the unit a customer thinks in ("what am I eating
 * on Thursday?"), so the card leads with the date and nests its meals inside.
 * A full-board subscriber gets three meal blocks here; a lunch-only plan gets
 * one, and the card looks the same either way.
 *
 * Past days stay visible rather than being trimmed away. A schedule that starts
 * at today reads as though the earlier days never happened, and the customer
 * loses the only record of what they were served.
 */
function ScheduleDayCardComponent({ day, onOpen, className }: Props) {
  const today = todayISO();
  const isPast = day.date < today;
  const isCurrent = isToday(day.date);

  const body = (
    <View className="p-5">
      {/* ── Date header ─────────────────────────────────────────────────── */}
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className={cn(
                'text-base font-bold',
                isCurrent ? 'text-brand-500' : 'text-text-primary',
              )}
            >
              {isCurrent ? 'Today' : day.day_name}
            </Text>
            {isCurrent ? <Badge label="Today" variant="brand" /> : null}
          </View>
          <Text className="mt-0.5 text-xs text-text-muted">
            {formatLongDate(day.date)}
          </Text>
        </View>

        <Text className="text-xs font-semibold text-text-muted">
          {day.meals.length} {day.meals.length === 1 ? 'meal' : 'meals'}
        </Text>
      </View>

      {/* ── Meals ───────────────────────────────────────────────────────── */}
      <View className="mt-4 gap-3">
        {day.meals.length === 0 ? (
          <Text className="text-sm text-text-muted">Nothing scheduled.</Text>
        ) : (
          day.meals.map((meal) => <MealBlock key={meal.delivery_id} meal={meal} />)
        )}
      </View>
    </View>
  );

  return (
    <Card
      onPress={onOpen ? () => onOpen(day.date) : undefined}
      className={cn(
        isCurrent && 'border-brand-500',
        // Dimmed, not hidden: a delivered day is still part of the plan the
        // customer paid for, it just isn't the one they can act on.
        isPast && 'opacity-70',
        className,
      )}
    >
      {body}
    </Card>
  );
}

// ── One meal ─────────────────────────────────────────────────────────────────

function MealBlock({ meal }: { meal: ScheduleMeal }) {
  const dishes = meal.items.filter((item) => !item.is_addon);
  const addons = meal.items.filter((item) => item.is_addon);

  return (
    <View className="rounded-2xl bg-surface-muted p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Text className="text-sm font-bold text-text-primary">
            {meal.slot.name ?? 'Meal'}
          </Text>
          {slotWindow(meal.slot) ? (
            <Text className="text-[11px] text-text-muted">
              {slotWindow(meal.slot)}
            </Text>
          ) : null}
        </View>

        <Badge {...statusPill(meal)} />
      </View>

      <View className="mt-2.5 gap-1.5">
        {dishes.length === 0 ? (
          <Text className="text-xs text-text-muted">Menu to be confirmed.</Text>
        ) : (
          dishes.map((dish) => <DishLine key={dish.id} dish={dish} />)
        )}
      </View>

      {addons.length > 0 ? (
        <View className="mt-3 border-t border-border pt-2.5">
          <Text className="text-[11px] font-bold uppercase text-text-muted">
            Extras
          </Text>
          <View className="mt-1.5 gap-1.5">
            {addons.map((addon) => (
              <DishLine key={addon.id} dish={addon} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The meal's state as one pill.
 *
 * `before_cutoff` is the server's own gate on whether anything may still
 * change, so it is read rather than re-derived from `cutoff_at` and the clock —
 * a locally-computed "open" that the API then refuses is worse than no pill.
 */
function statusPill(meal: ScheduleMeal): { label: string; variant: BadgeVariant } {
  if (meal.status === 'paused' || meal.status === 'skipped') {
    return { label: 'Skipped', variant: 'muted' };
  }
  if (meal.status === 'delivered') return { label: 'Delivered', variant: 'success' };
  if (meal.is_customized) return { label: 'Swapped', variant: 'brand' };
  if (!meal.before_cutoff) return { label: 'Locked', variant: 'muted' };
  return { label: 'Open', variant: 'success' };
}

// ── One dish ─────────────────────────────────────────────────────────────────

function DishLine({ dish }: { dish: SchedulePlate }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <FoodImage uri={dish.image_url} glyphSize="sm" className="h-9 w-9 rounded-lg" />

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text numberOfLines={1} className="flex-1 text-sm text-text-primary">
            {dish.name ?? `Item #${dish.menu_item_id}`}
            {dish.quantity > 1 ? (
              <Text className="font-bold"> ×{dish.quantity}</Text>
            ) : null}
          </Text>

          {dish.package ? (
            <Badge label={dish.package.name} variant="muted" />
          ) : dish.is_free_addon ? (
            <Badge label="Free" variant="free" />
          ) : dish.source === 'extra' || dish.source === 'guest' ? (
            <Badge label="Paid" variant="paid" />
          ) : null}
        </View>

        {/* Where the dish came from, when it isn't where the plan put it. */}
        {dish.was_swapped && dish.original_name ? (
          <Text className="mt-0.5 text-[11px] text-brand-500">
            swapped in for {dish.original_name}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const ScheduleDayCard = memo(ScheduleDayCardComponent);
