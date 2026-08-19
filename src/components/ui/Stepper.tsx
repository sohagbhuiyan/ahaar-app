import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Compact variant for list rows; the default suits a detail screen. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** Announced by screen readers, e.g. "Beef Curry quantity". */
  label?: string;
  className?: string;
}

const BOX = { sm: 'h-7 w-7', md: 'h-9 w-9' };
const GLYPH = { sm: 'text-sm', md: 'text-base' };
const VALUE = { sm: 'text-sm w-6', md: 'text-base w-8' };

/**
 * Quantity control.
 *
 * The decrement stays enabled at `min` so it can *remove* the line — a stepper
 * that dead-ends at 1 leaves no way to undo an accidental tap without hunting
 * for a separate delete. Callers treat `min - 1` as removal.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  disabled = false,
  label,
  className,
}: Props) {
  const atMax = value >= max;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      className={cn('flex-row items-center gap-1', className)}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        disabled={disabled}
        onPress={() => onChange(value - 1)}
        className={cn(
          'items-center justify-center rounded-full bg-surface-muted active:opacity-70',
          BOX[size],
          disabled && 'opacity-40',
        )}
      >
        <Text className={cn('font-bold text-text-primary', GLYPH[size])}>−</Text>
      </Pressable>

      <Text
        className={cn(
          'text-center font-bold text-text-primary tabular-nums',
          VALUE[size],
        )}
      >
        {value}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        disabled={disabled || atMax}
        onPress={() => onChange(value + 1)}
        className={cn(
          'items-center justify-center rounded-full bg-brand-500 active:opacity-80',
          BOX[size],
          (disabled || atMax) && 'opacity-40',
        )}
      >
        <Text className={cn('font-bold text-text-inverse', GLYPH[size])}>+</Text>
      </Pressable>
    </View>
  );
}
