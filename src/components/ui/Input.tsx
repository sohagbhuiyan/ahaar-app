import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props extends TextInputProps {
  label?: string;
  /** Validation message. Its presence also drives the error styling. */
  error?: string;
  hint?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  containerClassName?: string;
  className?: string;
}

/**
 * Text field with label, hint and error slot.
 *
 * `forwardRef` so React Hook Form (and "next field" focus chains) can drive
 * focus imperatively.
 */
export const Input = forwardRef<TextInput, Props>(function Input(
  {
    label,
    error,
    hint,
    left,
    right,
    containerClassName,
    className,
    editable = true,
    ...rest
  },
  ref,
) {
  const hasError = Boolean(error);

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? (
        <Text className="text-sm font-semibold text-text-primary">{label}</Text>
      ) : null}

      <View
        className={cn(
          'flex-row items-center gap-2 rounded-2xl border bg-surface px-4',
          hasError ? 'border-danger' : 'border-border',
          !editable && 'bg-surface-muted opacity-70',
        )}
      >
        {left}

        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={colors.text.muted}
          accessibilityLabel={label}
          // RN needs the invalid flag explicitly; there's no :invalid here.
          accessibilityState={{ disabled: !editable }}
          className={cn(
            'flex-1 py-3.5 text-base text-text-primary',
            className,
          )}
          {...rest}
        />

        {right}
      </View>

      {error ? (
        <Text className="text-xs font-medium text-danger">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-text-muted">{hint}</Text>
      ) : null}
    </View>
  );
});
