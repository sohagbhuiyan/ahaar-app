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

/** GET /deliveries/{id} — includes `items` and the `before_cutoff` gate. */
export async function getDelivery(id: number | string): Promise<Delivery> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/deliveries/${id}`);
  return normalizeDelivery(unwrap(data));
}
