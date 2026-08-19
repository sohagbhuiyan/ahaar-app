import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn, isToday, toISODate } from '@/lib/utils';

interface Props {
  /** YYYY-MM-DD, or null before a choice is made. */
  value: string | null;
  onChange: (date: string) => void;
  /** Earliest selectable day (YYYY-MM-DD). Days before it are not rendered. */
  from: string;
  /** How many days to offer, starting at `from`. */
  days?: number;
  /** Marks a day unselectable — every slot for it has passed its cutoff. */
  isDisabled?: (date: string) => boolean;
  className?: string;
}

/**
 * Horizontal date picker.
 *
 * A native date modal is the wrong shape here: ordering happens within the next
 * week or two, and the customer's real question is "which of the next few days
 * is still open?" — which a strip answers at a glance and a calendar buries
 * behind a tap. Disabled days stay visible for the same reason: seeing that
 * tomorrow is closed is information, hiding it is a mystery.
 */
export function DayStrip({
  value,
  onChange,
  from,
  days = 14,
  isDisabled,
  className,
}: Props) {
  const dates = useMemo(() => {
    const out: string[] = [];
    // Parsed without a `Z` so the walk stays in the device's timezone and
    // can't skip or repeat a day either side of midnight.
    const probe = new Date(`${from}T00:00:00`);
    if (Number.isNaN(probe.getTime())) return out;

    for (let i = 0; i < days; i++) {
      out.push(toISODate(probe));
      probe.setDate(probe.getDate() + 1);
    }
    return out;
  }, [from, days]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      className={className}
    >
      {dates.map((date) => {
        const selected = date === value;
        const disabled = isDisabled?.(date) ?? false;
        const parsed = new Date(`${date}T00:00:00`);

        return (
          <Pressable
            key={date}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={formatAccessible(parsed)}
            disabled={disabled}
            onPress={() => onChange(date)}
            className={cn(
              'w-16 items-center rounded-2xl border py-2.5',
              selected
                ? 'border-brand-500 bg-brand-500'
                : 'border-border bg-surface',
              disabled && 'opacity-35',
            )}
          >
            <Text
              className={cn(
                'text-[11px] font-semibold uppercase',
                selected ? 'text-text-inverse' : 'text-text-muted',
              )}
            >
              {isToday(date) ? 'Today' : weekday(parsed)}
            </Text>
            <Text
              className={cn(
                'mt-0.5 text-lg font-bold',
                selected ? 'text-text-inverse' : 'text-text-primary',
              )}
            >
              {parsed.getDate()}
            </Text>
            <Text
              className={cn(
                'text-[10px]',
                selected ? 'text-text-inverse/80' : 'text-text-muted',
              )}
            >
              {month(parsed)}
            </Text>
          </Pressable>
        );
      })}

      {/* Trailing spacer so the last chip clears the screen edge. */}
      <View className="w-2" />
    </ScrollView>
  );
}

function weekday(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  } catch {
    return '';
  }
}

function month(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date);
  } catch {
    return '';
  }
}

function formatAccessible(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  } catch {
    return date.toDateString();
  }
}
