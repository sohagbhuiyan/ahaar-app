import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const offline = useIsOffline();
  const lastSyncedAt = useNetworkStore((s) => s.lastSyncedAt);

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      className={cn('bg-warning-soft px-5 py-2.5', className)}
    >
      <Text className="text-center text-xs font-semibold text-warning">
        {lastSyncedAt
          ? t('ui.offline.withTime', { since: formatSince(lastSyncedAt, t) })
          : t('ui.offline.message')}
      </Text>
    </View>
  );
}

/** Coarse relative time; precision beyond "a while ago" isn't useful here. */
function formatSince(timestamp: number, t: TFunction): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60_000);

  if (minutes < 1) return t('ui.offline.justNow');
  if (minutes < 60) return t('ui.offline.minutesAgo', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('ui.offline.hoursAgo', { count: hours });

  const days = Math.floor(hours / 24);
  return t('ui.offline.daysAgo', { count: days });
}
