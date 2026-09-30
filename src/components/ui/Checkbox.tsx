import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/utils';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The line the customer reads. Also the accessibility label. */
  label: string;
  /** Optional second line explaining what ticking it actually does. */
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A labelled tick box.
 *
 * The whole row is the target, not just the 24px square — a box that small is
 * a miss waiting to happen on a phone, and a customer who taps the words and
 * gets nothing concludes the control is broken rather than that they aimed
 * badly.
 *
 * Reported to screen readers as a `checkbox` with its checked state, so it is
 * announced as something switchable rather than as two unrelated bits of text.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  className,
}: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={cn(
        'flex-row items-start gap-3 rounded-2xl border p-4',
        checked ? 'border-brand-500 bg-brand-50' : 'border-border bg-surface',
        disabled && 'opacity-50',
        className,
      )}
    >
      <View
        className={cn(
          'mt-0.5 h-6 w-6 items-center justify-center rounded-lg border-2',
          checked ? 'border-brand-500 bg-brand-500' : 'border-border-strong bg-surface',
        )}
      >
        {/* A glyph rather than an icon component: this is the only tick in the
            app, and it must stay centred at any font scale. */}
        {checked ? (
          <Text className="text-xs font-bold leading-none text-text-inverse">✓</Text>
        ) : null}
      </View>

      <View className="flex-1">
        <Text
          className={cn(
            'text-sm font-bold',
            checked ? 'text-brand-700' : 'text-text-primary',
          )}
        >
          {label}
        </Text>

        {description ? (
          <Text className="mt-1 text-xs leading-5 text-text-secondary">
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
