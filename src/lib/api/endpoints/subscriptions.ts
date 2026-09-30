/**
 * Subscriptions — create, read, pause/resume.
 *
 * `POST /subscriptions` is the checkout call. It creates the subscription in
 * `pending`, initiates a payment, and returns them together. Note the response
 * is **double-wrapped**: `{ data: { subscription: {...} } }`. Activation (and
 * therefore delivery generation) happens when the payment succeeds, not here.
 *
 * A subscription covers **every meal its plan serves** — there is no slot to
 * send. The covered meals come back as `slots`, read from the plan's weekly
 * menu server-side and frozen at purchase.
 */
import { apiClient, unwrap } from '../client';
import {
  normalizePaginated,
  normalizeQuota,
  normalizeSubscription,
} from '../normalize';
import type { ApiEnvelope, PageParams, Paginated } from '../types/common';
import type {
  CreateSubscriptionPayload,
  PauseSubscriptionPayload,
  Subscription,
  SubscriptionQuota,
} from '../types/subscription';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: Paginated<Subscription>['meta'] };

/** GET /subscriptions — paginated, newest first. */
export async function getSubscriptions(
  params: PageParams = {},
): Promise<Paginated<Subscription>> {
  const { data } = await apiClient.get<PaginatedBody>('/subscriptions', {
    params: { page: params.page },
  });
  return normalizePaginated(data, normalizeSubscription);
}

/** 20 pages x 20 rows — far past any real customer, and a hard stop. */
const MAX_SUBSCRIPTION_PAGES = 20;

/**
 * Every subscription the customer has ever had.
 *
 * `GET /subscriptions` pages at 20, newest first, and both consumers need the
 * whole set to be right. The subscriptions screen lists them with no way to
 * ask for more, and `useCurrentSubscription` picks "the one that matters now"
 * by ranking *all* of them — active first, then by start date. Given only page
 * 1, a customer with twenty newer cancelled plans would have their live plan
 * fall off the end, and Home would confidently show the wrong one.
 *
 * Same shape as `getAllDeliveries` in `./menu.ts`: the set is small and
 * bounded, nobody ever wanted a page, so the paging is resolved here.
 */
export async function getAllSubscriptions(): Promise<Subscription[]> {
  const first = await getSubscriptions();
  const all = [...first.data];

  // A guard, not an expectation: `last_page` is the server's own count, and a
  // malformed one must not turn a list into an unbounded request loop.
  const lastPage = Math.min(first.meta.last_page ?? 1, MAX_SUBSCRIPTION_PAGES);

  for (let page = 2; page <= lastPage; page++) {
    const next = await getSubscriptions({ page });
    all.push(...next.data);
    if (next.data.length === 0) break;
  }

  return all;
}

/** GET /subscriptions/{id} */
export async function getSubscription(
  id: number | string,
): Promise<Subscription> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/subscriptions/${id}`);
  return normalizeSubscription(unwrap(data));
}

/**
 * POST /subscriptions
 *
 * Send an `Idempotency-Key` so a retried checkout cannot create two
 * subscriptions and two payments — the backend honours the header when
 * initiating payment.
 */
export async function createSubscription(
  payload: CreateSubscriptionPayload,
  idempotencyKey?: string,
): Promise<Subscription> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    '/subscriptions',
    payload,
    idempotencyKey
      ? { headers: { 'Idempotency-Key': idempotencyKey } }
      : undefined,
  );
  const body = unwrap(data);
  // `SubscriptionController::store` nests one level deeper than every read
  // does. Tolerate the flat shape so a backend that stops nesting still works.
  return normalizeSubscription((body.subscription as Raw | undefined) ?? body);
}

/**
 * GET /subscriptions/{id}/quota
 *
 * The customer's entitlement quota, one row per (menu item × week). Not kitchen
 * capacity — the API does not expose that yet.
 */
export async function getQuota(
  subscriptionId: number | string,
): Promise<SubscriptionQuota[]> {
  const { data } = await apiClient.get<ApiEnvelope<Raw[]>>(
    `/subscriptions/${subscriptionId}/quota`,
  );
  return unwrap(data).map(normalizeQuota);
}

/**
 * POST /subscriptions/{id}/pause
 *
 * Each paused date releases that day's quota and appends a compensating
 * delivery one day past the current end date, so the customer never loses a
 * meal. Fails with 422 past a day's cutoff.
 */
export async function pauseSubscription(
  id: number | string,
  payload: PauseSubscriptionPayload,
): Promise<Subscription> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/subscriptions/${id}/pause`,
    payload,
  );
  return normalizeSubscription(unwrap(data));
}

/**
 * DELETE /subscriptions/{id}/pause/{date}
 *
 * Undoes one paused date: drops the appended extension day and restores the
 * original day's default items.
 */
export async function resumeSubscription(
  id: number | string,
  date: string,
): Promise<Subscription> {
  const { data } = await apiClient.delete<ApiEnvelope<Raw>>(
    `/subscriptions/${id}/pause/${date}`,
  );
  return normalizeSubscription(unwrap(data));
}
