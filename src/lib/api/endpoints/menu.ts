/**
 * Menu — the subscriber's day-by-day deliveries.
 *
 * The Menu tab is *not* a catalogue: it is the customer's own schedule, one
 * `DailyDelivery` row per calendar day of their subscription, each already
 * populated with the items for that date's weekday menu.
 *
 * There is no `GET /menu/{planId}/{date}` endpoint — the day-wise view is
 * assembled from `GET /deliveries`, which the caller can filter by date range.
 */
import { apiClient, unwrap } from '../client';
import { normalizeDelivery, normalizePaginated } from '../normalize';
import type { ApiEnvelope, Paginated } from '../types/common';
import type { Delivery, DeliveryFilters } from '../types/subscription';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: Paginated<Delivery>['meta'] };

/**
 * GET /deliveries — the signed-in customer's deliveries, in date order.
 *
 * NOTE: `subscription_id` is **not** a parameter this endpoint understands.
 * `DeliveryController::index` scopes to the caller's own subscriptions and then
 * filters only on `from`, `to` and `status`, so sending a subscription id was
 * silently ignored and returned every delivery across every subscription the
 * customer has ever had. Narrowing to one subscription happens client-side in
 * `useSubscriptionDeliveries`; move it back here if the controller learns to
 * filter.
 */
export async function getDeliveries(
  filters: Omit<DeliveryFilters, 'subscription_id'> = {},
): Promise<Paginated<Delivery>> {
  const { data } = await apiClient.get<PaginatedBody>('/deliveries', {
    params: {
      from: filters.from,
      to: filters.to,
      status: filters.status,
      page: filters.page,
    },
  });
  return normalizePaginated(data, normalizeDelivery);
}

/**
 * Every delivery the customer has, across all pages.
 *
 * `GET /deliveries` pages at 50 rows and scopes to *all* of the caller's
 * subscriptions at once. A subscriber on a full-board plan spends three rows a
 * day, so one page is barely a fortnight — and a customer with a previous plan
 * still running spends the page's budget on that one first. Page 1 alone left
 * a 30-day plan rendering as six days, which is not a schedule.
 *
 * The whole run is small and bounded (a 30-day full-board plan is 90 rows, two
 * pages), it is the only shape the day tabs and the schedule can be built from,
 * and no caller ever wanted a page — so the paging is resolved here rather than
 * leaking `fetchNextPage` into every screen that needs a complete answer.
 */
export async function getAllDeliveries(
  filters: Omit<DeliveryFilters, 'subscription_id' | 'page'> = {},
): Promise<Delivery[]> {
  const first = await getDeliveries(filters);
  const all = [...first.data];

  // A guard, not an expectation: `last_page` is the server's own count, and a
  // malformed one must not turn a list into an unbounded request loop.
  const lastPage = Math.min(first.meta.last_page ?? 1, MAX_DELIVERY_PAGES);

  for (let page = 2; page <= lastPage; page++) {
    const next = await getDeliveries({ ...filters, page });
    all.push(...next.data);
    if (next.data.length === 0) break;
  }

  return all;
}

/** 20 pages × 50 rows — far past any real plan, and a hard stop if paging breaks. */
const MAX_DELIVERY_PAGES = 20;

/** GET /deliveries/{id} — includes `items` and the `before_cutoff` gate. */
export async function getDelivery(id: number | string): Promise<Delivery> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/deliveries/${id}`);
  return normalizeDelivery(unwrap(data));
}
