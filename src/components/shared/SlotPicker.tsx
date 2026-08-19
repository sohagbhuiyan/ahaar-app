import { Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import type { SlotAvailability } from '@/lib/slots';
import { slotWindow } from '@/lib/slots';
import { cn } from '@/lib/utils';

interface Props {
  options: SlotAvailability[];
  value: number | null;
  onChange: (slotId: number) => void;
  className?: string;
}

/**
 * Meal-slot chooser for one already-chosen date.
 *
 * Closed slots are rendered, disabled, with the reason attached rather than
 * filtered out — "Dinner · closed 20:31" tells the customer to come back
 * tomorrow, whereas a dinner that simply isn't in the list reads as a slot the
 * kitchen doesn't serve at all.
 */
export function SlotPicker({ options, value, onChange, className }: Props) {
  return (
    <View className={cn('gap-2', className)}>
      {options.map(({ slot, isBookable, hint }) => {
        const selected = slot.id === value;

        return (
          <Pressable
            key={slot.id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !isBookable }}
            accessibilityLabel={`${slot.name}, ${hint}`}
            disabled={!isBookable}
            onPress={() => onChange(slot.id)}
            className={cn(
              'flex-row items-center justify-between rounded-2xl border px-4 py-3',
              selected ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
              !isBookable && 'opacity-50',
            )}
          >
            <View className="flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                {slot.name}
              </Text>
              <Text className="mt-0.5 text-xs text-text-muted">
                {slotWindow(slot)}
              </Text>
            </View>

            <Badge
              label={hint}
              variant={isBookable ? (selected ? 'brand' : 'muted') : 'danger'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
