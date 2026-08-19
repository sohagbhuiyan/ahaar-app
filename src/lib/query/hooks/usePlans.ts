/**
 * Subscription plans — public catalogue.
 *
 * Plans change rarely, so these get a long `staleTime`: re-fetching the plan
 * list on every mount would spend a request to almost always get the same
 * bytes back. A foreground refetch (via `focusManager`) still catches an
 * admin's price change within one app switch.
 */
import { useQuery } from '@tanstack/react-query';

import * as plansApi from '../../api/endpoints/plans';
import type { DeliverySlot, Plan } from '../../api/types/catalog';
import { queryKeys } from '../keys';

/** Ten minutes — catalogue data, not order state. */
const CATALOGUE_STALE_MS = 10 * 60 * 1000;

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans.list(),
    queryFn: plansApi.getPlans,
    staleTime: CATALOGUE_STALE_MS,
  });
}

export function usePlan(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.plans.detail(id ?? ''),
    queryFn: () => plansApi.getPlan(id!),
    enabled: id !== undefined && id !== '',
    staleTime: CATALOGUE_STALE_MS,
  });
}

/**
 * The plan to promote on Home and in the plans list.
 *
 * The API has no `is_popular` flag, so this picks the 7-day plan when one
 * exists and otherwise the middle card — matching the web app's
 * `getFeaturedPlanId`. Kept as a `select` so the choice lives in one place
 * rather than being re-derived in each screen.
 */
export function useFeaturedPlanId() {
  return useQuery({
    queryKey: queryKeys.plans.list(),
    queryFn: plansApi.getPlans,
    staleTime: CATALOGUE_STALE_MS,
    select: (plans: Plan[]): number | null => {
      if (plans.length === 0) return null;
      const weekly = plans.find((p) => p.duration_days === 7);
      if (weekly) return weekly.id;
      return plans[Math.floor(plans.length / 2)].id;
    },
  });
}

/**
 * Delivery slots. Needed by checkout to pick a slot and to floor the earliest
 * possible start date from `cutoff_hours`.
 */
export function useDeliverySlots() {
  return useQuery({
    queryKey: queryKeys.deliverySlots.list(),
    queryFn: plansApi.getDeliverySlots,
    staleTime: CATALOGUE_STALE_MS,
  });
}

/** Slots keyed by id, for rendering a slot name next to a delivery. */
export function useDeliverySlotMap() {
  return useQuery({
    queryKey: queryKeys.deliverySlots.list(),
    queryFn: plansApi.getDeliverySlots,
    staleTime: CATALOGUE_STALE_MS,
    select: (slots: DeliverySlot[]) => new Map(slots.map((s) => [s.id, s])),
  });
}
