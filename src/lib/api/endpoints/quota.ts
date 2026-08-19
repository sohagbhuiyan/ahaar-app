/**
 * Quota.
 *
 * Two different things are called "quota" in this product; only the first is
 * exposed by the API today.
 *
 *  1. **Entitlement quota** (implemented) — per subscription, per menu item,
 *     per week: "how many times may *I* have fish this week". Backed by
 *     `subscription_quotas`, served by `GET /subscriptions/{id}/quota`.
 *
 *  2. **Kitchen capacity** (NOT implemented) — per menu item, per calendar
 *     date: "the kitchen can make 100 fish curries on the 14th". This is the
 *     `daily_item_quotas` table from Priority 2 of the backend work. Until it
 *     ships there is no sold-out signal for extra/instant orders, and the only
 *     availability the client can show is the per-option `quota.remaining`
 *     embedded in the swap-options response.
 *
 * The re-export below keeps the domain's entry point here, next to the
 * explanation, rather than making callers reach into `subscriptions.ts`.
 */
import { getQuota } from './subscriptions';
import type { SubscriptionQuota } from '../types/subscription';

export { getQuota };

/**
 * Remaining entitlement for one item in one week, or `null` when the item is
 * not quota-controlled (which the backend treats as unlimited).
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

/**
 * The 1-based week a date falls into for a subscription — days 1-7 from
 * `start_date` are week 1, 8-14 week 2, and so on.
 *
 * Mirrors `QuotaService::weekFor()`. Both dates are read at UTC midnight so the
 * answer cannot shift with the device's timezone.
 */
export function weekForDate(startDate: string, deliveryDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const target = Date.parse(`${deliveryDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(target)) return 1;

  const dayMs = 24 * 60 * 60 * 1000;
  const offsetDays = Math.floor((target - start) / dayMs);
  return Math.floor(offsetDays / 7) + 1;
}
