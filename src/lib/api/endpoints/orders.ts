/**
 * Orders — everything bought outside the subscription's included meals.
 *
 * All three kinds are always payable, and all three are tracked separately from
 * the subscription's own meals: their items land on the delivery carrying an
 * `order_id`, which is what keeps them out of the entitlement-quota accounting.
 *
 *   extra   → items added onto an existing subscription delivery
 *   guest   → that delivery's items ×N guest portions
 *   instant → standalone; its own date, slot and address, no subscription
 *
 * `instant` is the walk-in / out-of-subscription path: a customer with no
 * active subscription can still order, as long as the chosen slot's cutoff
 * has not passed.
 */
import { apiClient, unwrap } from '../client';
import { normalizeOrder, normalizePaginated } from '../normalize';
import type { ApiEnvelope, Paginated } from '../types/common';
import type {
  CreateExtraOrderPayload,
  CreateGuestOrderPayload,
  CreateInstantOrderPayload,
  Order,
  OrderFilters,
} from '../types/order';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: Paginated<Order>['meta'] };

/**
 * The three creation endpoints all answer through `OrderController::withPayment`,
 * which nests the resource one level deeper than every read does:
 *
 *   read:   { data: { id, … } }
 *   create: { data: { order: { id, … } } }
 *
 * Unwrapping only the envelope would hand `normalizeOrder` the `{ order: … }`
 * wrapper, producing an order with `id: undefined` and no `payment` — i.e. a
 * checkout that silently can't be paid. Tolerates the flat shape too, so a
 * backend that stops nesting doesn't break the client.
 */
function unwrapOrder(body: ApiEnvelope<Raw>): Raw {
  const data = unwrap(body);
  const nested = data.order as Raw | undefined;
  return nested ?? data;
}

/**
 * GET /orders — the customer's own orders, newest first, 20 per page.
 *
 * NOTE: `type` and `status` are **not** server-side filters.
 * `OrderController::index` is an unconditional
 * `$request->user()->orders()->orderByDesc('id')->paginate(20)`, so sending
 * either param is silently ignored and returns the unfiltered list. Only `page`
 * does anything here; narrowing by status happens client-side in
 * `useFilteredOrders`, which is honest about only filtering what has been paged
 * in. Move it back here the moment the controller learns to filter.
 */
export async function getOrders(
  params: Pick<OrderFilters, 'page'> = {},
): Promise<Paginated<Order>> {
  const { data } = await apiClient.get<PaginatedBody>('/orders', {
    params: { page: params.page },
  });
  return normalizePaginated(data, normalizeOrder);
}

/** GET /orders/{id} */
export async function getOrder(id: number | string): Promise<Order> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/orders/${id}`);
  return normalizeOrder(unwrap(data));
}

/**
 * POST /orders/extra
 *
 * Rate-limited by `throttle:payments`. Pass an `Idempotency-Key` so a retry
 * cannot double-charge.
 */
export async function createExtraOrder(
  payload: CreateExtraOrderPayload,
  idempotencyKey?: string,
): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    '/orders/extra',
    payload,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
  );
  return normalizeOrder(unwrapOrder(data));
}

/** POST /orders/guest — `guests_count` must be 1-10. */
export async function createGuestOrder(
  payload: CreateGuestOrderPayload,
  idempotencyKey?: string,
): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    '/orders/guest',
    payload,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
  );
  return normalizeOrder(unwrapOrder(data));
}

/**
 * POST /orders/instant
 *
 * Standalone order, no subscription required. Fails with 422 once the chosen
 * slot's cutoff for that date has passed.
 */
export async function createInstantOrder(
  payload: CreateInstantOrderPayload,
  idempotencyKey?: string,
): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    '/orders/instant',
    payload,
    idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
  );
  return normalizeOrder(unwrapOrder(data));
}

/** POST /orders/{id}/cancel */
export async function cancelOrder(
  id: number | string,
  reason?: string,
): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/orders/${id}/cancel`,
    reason ? { reason } : {},
  );
  return normalizeOrder(unwrap(data));
}
