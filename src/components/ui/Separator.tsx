import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';

interface Props {
  orientation?: 'horizontal' | 'vertical';
  /** Optional centred caption, e.g. "or". */
  label?: string;
  className?: string;
}

export function Separator({
  orientation = 'horizontal',
  label,
  className,
}: Props) {
  if (label) {
    return (
      <View className={cn('flex-row items-center gap-3', className)}>
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs font-medium text-text-muted">{label}</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    );
  }

  return (
    <View
      accessibilityRole="none"
      className={cn(
        orientation === 'horizontal' ? 'h-px w-full' : 'w-px self-stretch',
        'bg-border',
        className,
      )}
    />
  );
}
