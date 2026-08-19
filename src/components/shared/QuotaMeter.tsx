import { Text, View } from 'react-native';

import type { SubscriptionQuota } from '@/lib/api/types/subscription';
import { cn } from '@/lib/utils';

interface Props {
  quota: SubscriptionQuota;
  className?: string;
}

/**
 * One item's remaining entitlement for one week.
 *
 * This is *entitlement* quota — "how many times may I have this dish this
 * week" — not kitchen capacity. The two are different systems and the API
 * doesn't expose kitchen capacity yet; see `lib/api/endpoints/quota.ts`.
 */
export function QuotaMeter({ quota, className }: Props) {
  // An item with no allowance is unlimited rather than "0 of 0" — showing an
  // empty bar there would read as exhausted, the opposite of the truth.
  const unlimited = quota.allowed <= 0;
  const ratio = unlimited ? 0 : Math.min(1, quota.consumed / quota.allowed);
  const exhausted = !unlimited && quota.remaining <= 0;

  const barColour = exhausted
    ? 'bg-danger'
    : ratio >= 0.75
      ? 'bg-warning'
      : 'bg-brand-500';

  return (
    <View className={cn('gap-1.5', className)}>
      <View className="flex-row items-center justify-between">
        <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-text-primary">
          {quota.menu_item?.name ?? `Item #${quota.menu_item_id}`}
        </Text>

        <Text
          className={cn(
            'ml-3 text-xs font-bold',
            exhausted ? 'text-danger' : 'text-text-secondary',
          )}
        >
          {unlimited ? 'Unlimited' : `${quota.remaining} left`}
        </Text>
      </View>

      {!unlimited ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: quota.allowed, now: quota.consumed }}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        >
          <View
            className={cn('h-full rounded-full', barColour)}
            // Percentage widths are a style, not a utility class — Tailwind
            // can't express an arbitrary runtime value here.
            style={{ width: `${ratio * 100}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A week's worth of meters.
 *
 * Sorted most-constrained first so the item a customer is about to be blocked
 * on is the one they see, rather than it sitting below the fold.
 */
export function QuotaMeterList({
  quotas,
  weekNumber,
  className,
}: {
  quotas: SubscriptionQuota[];
  /** Filters to one week. Omit to show every row as given. */
  weekNumber?: number;
  className?: string;
}) {
  const rows = (
    weekNumber === undefined
      ? quotas
      : quotas.filter((q) => q.week_number === weekNumber)
  )
    .slice()
    .sort((a, b) => a.remaining - b.remaining);

  if (rows.length === 0) return null;

  return (
    <View className={cn('gap-4', className)}>
      {rows.map((quota) => (
        <QuotaMeter
          key={`${quota.menu_item_id}-${quota.week_number}`}
          quota={quota}
        />
      ))}
    </View>
  );
}
