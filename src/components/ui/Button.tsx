import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';

import { colors } from '@/lib/theme';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  /** Rendered before the label — an icon, usually. */
  left?: React.ReactNode;
  right?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
}

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 active:bg-brand-600',
  secondary: 'bg-brand-50 active:bg-brand-100',
  outline: 'bg-transparent border border-border active:bg-surface-muted',
  ghost: 'bg-transparent active:bg-surface-muted',
  destructive: 'bg-danger active:opacity-90',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-text-inverse',
  secondary: 'text-brand-700',
  outline: 'text-text-primary',
  ghost: 'text-brand-500',
  destructive: 'text-text-inverse',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 rounded-xl',
  md: 'h-12 px-5 rounded-2xl',
  lg: 'h-14 px-6 rounded-2xl',
};

const LABEL_SIZE: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
};

/** Spinner colour has to match the label, which varies by variant. */
const SPINNER: Record<ButtonVariant, string> = {
  primary: colors.text.inverse,
  secondary: colors.brand[700],
  outline: colors.text.primary,
  ghost: colors.brand[500],
  destructive: colors.text.inverse,
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  left,
  right,
  fullWidth = true,
  disabled,
  className,
  textClassName,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center gap-2',
        SIZE[size],
        CONTAINER[variant],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER[variant]} />
      ) : (
        left
      )}

      <Text
        numberOfLines={1}
        className={cn('font-bold', LABEL_SIZE[size], LABEL[variant], textClassName)}
      >
        {label}
      </Text>

      {!loading && right ? <View>{right}</View> : null}
    </Pressable>
  );
}
