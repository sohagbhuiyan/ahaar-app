/**
 * Meal swapping — exchanging one scheduled dish for another the customer
 * already owns.
 *
 * A swap is a **transposition**: today's lunch beef and tonight's dinner fish
 * trade places, so lunch serves fish and dinner serves beef. Nothing enters the
 * subscription from outside it, which is why the endpoint takes two *positions*
 * (`daily_delivery_items` ids) rather than a menu item — the same dish can sit
 * on several plates that week, and it matters which one moves.
 *
 * That shape is also why the call is scoped to the **subscription**, not to a
 * delivery: the two plates may sit on different days and different meals.
 *
 * Every rule is server-side and must not be re-derived on the client:
 *   - `before_cutoff` decides whether a meal may change at all
 *   - only the returned `positions` are swappable
 *   - only a target with `eligible: true` is a legal partner
 *   - each position gets exactly one exchange, then it is settled for good
 *
 * There is deliberately no revert. A swap moves two plates at once, so undoing
 * one of them would leave the other holding a duplicate — the backend dropped
 * the endpoint rather than let that state exist.
 */
import { apiClient, unwrap } from '../client';
import {
  normalizeDelivery,
  normalizeMealSwapEntry,
  normalizeSubscriptionSchedule,
  normalizeSwapOptions,
  normalizeSwapPosition,
} from '../normalize';
import type { ApiEnvelope } from '../types/common';
import type { Delivery } from '../types/subscription';
import type {
  ApplySwapPayload,
  DeliverySwapOptions,
  MealSwapEntry,
  SubscriptionSchedule,
  SwapPosition,
} from '../types/swap';

type Raw = Record<string, unknown>;

/**
 * GET /subscriptions/{id}/schedule
 *
 * The whole plan as bought: every day, every meal, every dish, and whether each
 * dish can still be moved. `week` narrows it to one quota week — which is also
 * the horizon a swap may reach.
 *
 * This reads the customer's *deliveries*, not the plan's weekly template. After
 * a swap the two differ, and the deliveries are what the kitchen will cook.
 */
export async function getSubscriptionSchedule(
  subscriptionId: number | string,
  week?: number,
): Promise<SubscriptionSchedule> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(
    `/subscriptions/${subscriptionId}/schedule`,
    week ? { params: { week } } : undefined,
  );
  return normalizeSubscriptionSchedule(unwrap(data));
}

/** GET /deliveries/{id}/swap-options — every position on one meal, with targets. */
export async function getSwapOptions(
  deliveryId: number | string,
): Promise<DeliverySwapOptions> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(
    `/deliveries/${deliveryId}/swap-options`,
  );
  return normalizeSwapOptions(unwrap(data));
}

/** GET /delivery-items/{id}/swap-targets — one dish, when the UI drills in. */
export async function getSwapTargets(
  itemId: number | string,
): Promise<SwapPosition> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(
    `/delivery-items/${itemId}/swap-targets`,
  );
  return normalizeSwapPosition(unwrap(data));
}

/**
 * POST /subscriptions/{id}/swaps
 *
 * Returns **both** affected deliveries, already updated, so the caller can seed
 * the cache for each end of the exchange rather than refetching twice. A 422
 * carries a machine-readable `reason` alongside the sentence — see
 * `SwapBlockedReason`.
 */
export async function applyMealSwap(
  subscriptionId: number | string,
  payload: ApplySwapPayload,
): Promise<{ swap_id: number; deliveries: Delivery[] }> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/subscriptions/${subscriptionId}/swaps`,
    payload,
  );
  const body = unwrap(data);
  return {
    swap_id: body.swap_id as number,
    deliveries: ((body.deliveries as Raw[] | undefined) ?? []).map(normalizeDelivery),
  };
}

/** GET /subscriptions/{id}/swaps — the customer's own exchange history. */
export async function getSwapHistory(
  subscriptionId: number | string,
): Promise<MealSwapEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<Raw[]>>(
    `/subscriptions/${subscriptionId}/swaps`,
  );
  return unwrap(data).map(normalizeMealSwapEntry);
}
