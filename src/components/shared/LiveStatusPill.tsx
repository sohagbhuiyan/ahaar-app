import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { TrackingStatus } from '@/lib/api/types/tracking';
import { trackingStatusLabel } from '@/lib/tracking/status';
import { cn } from '@/lib/utils';

/**
 * "● On the way to you" — the delivery step of an order that's in flight,
 * for list rows. The dot says "this is live"; the words come from the same
 * labels as the tracking timeline.
 */
export function LiveStatusPill({ status, className }: { status: TrackingStatus; className?: string }) {
  // Subscribes to language changes; the label itself comes from i18n directly.
  useTranslation();
  return (
    <View
      className={cn('flex-row items-center gap-1.5 self-start rounded-xl bg-brand-50 px-2.5 py-1', className)}
      testID="live-status-pill"
    >
      <View className="h-2 w-2 rounded-full bg-brand-500" />
      <Text className="text-xs font-bold text-brand-700">{trackingStatusLabel(status)}</Text>
    </View>
  );
}
