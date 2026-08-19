import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { cn } from '@/lib/utils';

interface Props {
  /** Falls back to initials when absent or the load fails. */
  uri?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
};

const TEXT: Record<NonNullable<Props['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

/** "Sohag Ahmed" → "SA"; single word → first letter. */
function initialsOf(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ uri, name, size = 'md', className }: Props) {
  const base = cn(
    'items-center justify-center overflow-hidden rounded-full bg-brand-50',
    SIZE[size],
    className,
  );

  if (uri) {
    return (
      <View className={base}>
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={150}
          // Keeps the initials visible behind a slow-loading remote image
          // instead of flashing an empty circle.
          placeholder={{ blurhash: 'L6PZfSjE.AyE_3t7t7R**0o#DgR4' }}
          style={{ width: '100%', height: '100%' }}
          accessibilityLabel={name ?? 'Avatar'}
        />
      </View>
    );
  }

  return (
    <View className={base} accessibilityLabel={name ?? 'Avatar'}>
      <Text className={cn('font-bold text-brand-700', TEXT[size])}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
