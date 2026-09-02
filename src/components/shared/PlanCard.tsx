import { memo } from 'react';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { Badge, Button, Card } from '@/components/ui';
import type { Plan } from '@/lib/api/types/catalog';
import { cn, formatMoney } from '@/lib/utils';
import { FOOD_BLURHASH } from '@/lib/constants/images';

interface Props {
  plan: Plan;
  /** Visually promotes this plan. */
  featured?: boolean;
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
function durationLabel(days: number): string {
  const known: Record<number, string> = {
    3: '3 Days',
    7: 'Weekly',
    14: 'Bi-Weekly',
    15: 'Bi-Weekly',
    30: 'Monthly',
  };
  return known[days] ?? `${days} Days`;
}

function PlanCardComponent({
  plan,
  featured = false,
  selected = false,
  onSelect,
  onPress,
  className,
}: Props) {
  const perDay = plan.duration_days > 0 ? plan.price / plan.duration_days : 0;

  return (
    <Card
      elevated={featured || selected}
      onPress={onPress ? () => onPress(plan) : undefined}
      className={cn(selected && 'border-brand-500', className)}
    >
      {plan.image_url ? (
        <Image
          source={{ uri: plan.image_url }}
          placeholder={{ blurhash: FOOD_BLURHASH }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          style={{ width: '100%', height: 128 }}
          accessibilityLabel={plan.name}
        />
      ) : null}

      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold text-text-primary">{plan.name}</Text>
            <Text className="mt-0.5 text-xs font-semibold text-text-muted">
              {plan.duration_days} days
            </Text>
          </View>

          <Badge
            label={featured ? 'Most popular' : durationLabel(plan.duration_days)}
            variant={featured ? 'paid' : 'muted'}
          />
        </View>

        <View className="mt-4 flex-row items-end">
          <Text className="text-3xl font-bold text-text-primary">
            {formatMoney(plan.price)}
          </Text>
          <Text className="mb-1 ml-1.5 text-sm text-text-muted">
            {/* Per-day is the number people actually compare plans on. */}
            {formatMoney(perDay)}/day
          </Text>
        </View>

        {/* Which meals the plan covers. `slots` is `whenLoaded` on the
            resource — undefined means the API wasn't asked, so render nothing
            rather than implying the plan covers no meals. */}
        {plan.slots && plan.slots.length > 0 ? (
          <View className="mt-3 flex-row flex-wrap gap-1.5">
            {plan.slots.map((slot) => (
              <Badge key={slot.id} label={slot.name} variant="muted" />
            ))}
          </View>
        ) : null}

        {plan.description ? (
          <Text numberOfLines={3} className="mt-3 text-sm text-text-secondary">
            {plan.description}
          </Text>
        ) : null}

        {onSelect ? (
          <Button
            label={selected ? 'Selected' : `Choose ${plan.name}`}
            variant={selected ? 'secondary' : 'primary'}
            onPress={() => onSelect(plan)}
            className="mt-5"
          />
        ) : null}
      </View>
    </Card>
  );
}

export const PlanCard = memo(PlanCardComponent);
