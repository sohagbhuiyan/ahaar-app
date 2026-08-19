/**
 * Subscription plans and delivery slots — public, unauthenticated reads.
 *
 * `GET /plans` returns every active plan ordered by `duration_days`, as a bare
 * `{ data: [...] }` with no pagination. Durations are open-ended (7, 15, 25,
 * 30, …) — do not assume a fixed set.
 */
import { apiClient, unwrap } from "../client";
import {
  normalizeDeliverySlot,
  normalizeList,
  normalizePlan,
} from "../normalize";
import type { DeliverySlot, Plan } from "../types/catalog";
import type { ApiEnvelope } from "../types/common";

type Raw = Record<string, unknown>;

/** GET /plans */
export async function getPlans(): Promise<Plan[]> {
  const { data } = await apiClient.get<ApiEnvelope<Raw[]>>("/plans");
  return normalizeList(unwrap(data), normalizePlan);
}

/** GET /plans/{id} — 404s when the plan is inactive. */
export async function getPlan(id: number | string): Promise<Plan> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/plans/${id}`);
  return normalizePlan(unwrap(data));
}

/**
 * GET /delivery-slots — the meal slots (lunch, dinner…) a plan is served in.
 *
 * Each slot carries `cutoff_hours`, which is what makes a delivery lock N hours
 * before `start_time`. The checkout flow uses it to floor the earliest start
 * date.
 */
export async function getDeliverySlots(): Promise<DeliverySlot[]> {
  const { data } = await apiClient.get<ApiEnvelope<Raw[]>>("/delivery-slots");
  return normalizeList(unwrap(data), normalizeDeliverySlot);
}
