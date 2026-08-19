import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'brand'
  | 'muted'
  | 'free'
  | 'paid'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

interface Props {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

/**
 * Small status pill.
 *
 * `free` / `paid` are named for their meaning rather than their colour so the
 * add-on UI can't accidentally show a paid item in the free treatment — the
 * distinction the customer most needs to read at a glance.
 */
const CONTAINER: Record<BadgeVariant, string> = {
  brand: 'bg-brand-50',
  muted: 'bg-surface-muted',
  free: 'bg-success-soft',
  paid: 'bg-brand-50',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  outline: 'bg-transparent border border-border',
};

const LABEL: Record<BadgeVariant, string> = {
  brand: 'text-brand-700',
  muted: 'text-text-secondary',
  free: 'text-success',
  paid: 'text-brand-700',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  outline: 'text-text-secondary',
};

export function Badge({ label, variant = 'muted', className }: Props) {
  return (
    <View
      className={cn(
        'self-start rounded-xl px-2.5 py-1',
        CONTAINER[variant],
        className,
      )}
    >
      <Text className={cn('text-xs font-bold', LABEL[variant])}>{label}</Text>
    </View>
  );
}
