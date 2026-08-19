/**
 * Entitlement quota.
 *
 * Freshness matters more here than anywhere else: a customer checks their
 * remaining allowance immediately before swapping or adding, and a stale
 * "2 left" that is really 0 turns into a 422 they can't explain. Hence a short
 * `staleTime` and `refetchOnMount: 'always'` — always re-verify at the moment
 * of use.
 */
import { useQuery } from '@tanstack/react-query';

import * as subscriptionsApi from '../../api/endpoints/subscriptions';
import { weekForDate } from '../../api/endpoints/quota';
import type { SubscriptionQuota } from '../../api/types/subscription';
import { queryKeys } from '../keys';

/** Deliberately short — see the note above. */
const QUOTA_STALE_MS = 15 * 1000;

export function useQuota(subscriptionId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.quota.bySubscription(subscriptionId ?? ''),
    queryFn: () => subscriptionsApi.getQuota(subscriptionId!),
    enabled: subscriptionId !== undefined && subscriptionId !== '',
    staleTime: QUOTA_STALE_MS,
    refetchOnMount: 'always',
  });
}

/**
 * Quota rows for the week a given delivery date falls in.
 *
 * Weeks run from the subscription's own `start_date` (days 1-7 → week 1), not
 * the calendar week, so the same weekday in a 30-day plan lands in a different
 * bucket each time round.
 */
export function useQuotaForDate(
  subscriptionId: string | number | undefined,
  startDate: string | undefined,
  deliveryDate: string | undefined,
) {
  const query = useQuota(subscriptionId);

  const weekNumber =
    startDate && deliveryDate ? weekForDate(startDate, deliveryDate) : null;

  const rows: SubscriptionQuota[] =
    weekNumber === null
      ? []
      : (query.data ?? []).filter((q) => q.week_number === weekNumber);

  return { ...query, weekNumber, rows };
}

/**
 * Remaining allowance for one item in one week.
 *
 * `null` means the item has no quota row at all, which the backend treats as
 * unlimited — distinct from 0, which means exhausted. Callers must not collapse
 * the two.
 */
export function remainingFor(
  quotas: SubscriptionQuota[],
  menuItemId: number,
  weekNumber: number,
): number | null {
  const row = quotas.find(
    (q) => q.menu_item_id === menuItemId && q.week_number === weekNumber,
  );
  return row ? Math.max(0, row.remaining) : null;
}
