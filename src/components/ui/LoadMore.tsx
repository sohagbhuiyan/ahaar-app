import { View } from 'react-native';

import { Button } from './Button';
import { cn } from '@/lib/utils';

interface Props {
  /** Whether the server reported another page. Renders nothing when false. */
  hasMore: boolean;
  /** The next page is in flight — shows the spinner and blocks repeat presses. */
  loading: boolean;
  onPress: () => void;
  /** Overrides the default "Load more" wording. */
  label?: string;
  className?: string;
}

/**
 * The footer that pages a list forward.
 *
 * Deliberately a button rather than an `onEndReached` handler. Auto-paging on
 * scroll fires from a velocity guess, so a fast flick could queue several pages
 * at once and a slow one could stall at the bottom with no way to ask for more;
 * neither is visible to the customer, and on a metered connection neither is
 * something they agreed to. A press is one page, exactly when it was asked for.
 *
 * Returns `null` on the last page so the list simply ends — an exhausted list
 * needs no footer, and a disabled button at the bottom reads as a fault.
 */
export function LoadMore({ hasMore, loading, onPress, label = 'Load more', className }: Props) {
  if (!hasMore) return null;

  return (
    <View className={cn('px-5 py-6', className)}>
      <Button
        label={loading ? 'Loading…' : label}
        variant="outline"
        loading={loading}
        onPress={onPress}
      />
    </View>
  );
}
