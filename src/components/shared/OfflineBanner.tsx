import { Text, View } from 'react-native';

import { useIsOffline, useNetworkStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
}

/**
 * "You're offline" strip.
 *
 * Shown only once connectivity is *known* to be lost — `useIsOffline` treats
 * the pre-first-event `null` as online, so this never flashes during startup.
 *
 * The wording matters: the app stays usable offline because the query cache is
 * persisted, so this says data may be stale rather than implying the screen is
 * broken.
 */
export function OfflineBanner({ className }: Props) {
  const offline = useIsOffline();
  const lastSyncedAt = useNetworkStore((s) => s.lastSyncedAt);

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      className={cn('bg-warning-soft px-5 py-2.5', className)}
    >
      <Text className="text-center text-xs font-semibold text-warning">
        You&apos;re offline — showing saved data
        {lastSyncedAt ? ` from ${formatSince(lastSyncedAt)}` : ''}
      </Text>
    </View>
  );
}

/** Coarse relative time; precision beyond "a while ago" isn't useful here. */
function formatSince(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
