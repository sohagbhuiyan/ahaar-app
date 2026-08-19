/**
 * Payments — the customer's own charge history.
 *
 * A `Payment` is attached to whatever it paid for (a subscription or an order)
 * via a polymorphic `payable`, but the API does not expose that relation on the
 * customer resource: `PaymentResource` returns the amount, gateway, status and
 * `checkout_url` only. So this list answers "what have I been charged?" and the
 * order/subscription screens answer "what did I buy?" — the two are joined by
 * the customer reading them, not by an id.
 *
 * Both endpoints sit behind `auth:sanctum` + `role:customer`.
 */
import { apiClient, unwrap } from '../client';
import { normalizePaginated, normalizePayment } from '../normalize';
import type { ApiEnvelope, PageParams, Paginated } from '../types/common';
import type { Payment } from '../types/order';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: Paginated<Payment>['meta'] };

/** GET /payments — newest first, 20 per page. */
export async function getPayments(
  params: PageParams = {},
): Promise<Paginated<Payment>> {
  const { data } = await apiClient.get<PaginatedBody>('/payments', {
    params: { page: params.page },
  });
  return normalizePaginated(data, normalizePayment);
}

/** GET /payments/{id} */
export async function getPayment(id: number | string): Promise<Payment> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/payments/${id}`);
  return normalizePayment(unwrap(data));
}
