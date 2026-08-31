/**
 * Meal swapping — exchanging one scheduled dish for another the customer
 * already owns.
 *
 * Deliberately **not** optimistic, unlike the substitution flow it replaces.
 * A swap moves two plates at once, and the second one is usually off-screen —
 * on another day, or another meal. Painting a guess for a plate the customer
 * cannot see, then rolling it back on a 422, is worse than a brief spinner on
 * the one they are looking at. The server hands back both updated deliveries,
 * so the truth arrives in the same round-trip anyway.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as swapApi from '../../api/endpoints/swap';
import { isApiError } from '../../api/types/common';
import type { ApplySwapPayload, SwapBlockedReason } from '../../api/types/swap';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

/**
 * The whole plan, day by day and meal by meal. Pass a week to fetch just that
 * one — a week is also the horizon a swap may reach.
 */
export function useSubscriptionSchedule(
  subscriptionId: string | number | undefined,
  week?: number,
) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.schedule.bySubscription(subscriptionId ?? '', week),
    queryFn: () => swapApi.getSubscriptionSchedule(subscriptionId!, week),
    enabled: signedIn && subscriptionId !== undefined && subscriptionId !== '',
    staleTime: 30 * 1000,
  });
}

/**
 * What may be swapped on this meal, and where each dish could go.
 *
 * `refetchOnMount: 'always'` because the answer goes stale with the clock:
 * `before_cutoff` on either end can lapse between screens, and offering a
 * target the server will refuse is worse than a brief spinner.
 */
export function useSwapOptions(deliveryId: string | number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.swap.options(deliveryId ?? ''),
    queryFn: () => swapApi.getSwapOptions(deliveryId!),
    enabled: signedIn && deliveryId !== undefined && deliveryId !== '',
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
  });
}

/** One dish's targets, when the UI drills into a single line. */
export function useSwapTargets(itemId: number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.swap.targets(itemId ?? ''),
    queryFn: () => swapApi.getSwapTargets(itemId!),
    enabled: signedIn && itemId !== undefined,
    staleTime: 15 * 1000,
  });
}

/** The customer's own exchange history for a subscription. */
export function useSwapHistory(subscriptionId: string | number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.swap.history(subscriptionId ?? ''),
    queryFn: () => swapApi.getSwapHistory(subscriptionId!),
    enabled: signedIn && subscriptionId !== undefined && subscriptionId !== '',
    staleTime: 60 * 1000,
  });
}

/**
 * Exchange two plates.
 *
 * Both settle afterwards — neither can be swapped again — so everything that
 * could be showing either of them is refreshed. The response carries both
 * deliveries, so each is seeded straight into its own cache entry before the
 * broader invalidation lands; the screen the customer is on updates without
 * waiting for a refetch.
 *
 * Quota is deliberately *not* invalidated: both ends of an exchange sit in the
 * same week, so the week still contains the same dishes the same number of
 * times and the meters cannot have moved.
 */
export function useApplyMealSwap(subscriptionId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ApplySwapPayload) =>
      swapApi.applyMealSwap(subscriptionId!, payload),

    onSuccess: ({ deliveries }) => {
      for (const delivery of deliveries) {
        queryClient.setQueryData(queryKeys.menu.detail(delivery.id), delivery);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.swap.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.schedule.all() });
    },
  });
}

/**
 * The server's refusal, as something renderable.
 *
 * A 422 from the swap endpoint carries both a sentence and a stable `reason`
 * code. Anything else is a transport failure and gets a generic line rather
 * than leaking an axios message into the UI.
 */
export function swapError(error: unknown): {
  message: string;
  reason: SwapBlockedReason | null;
} {
  if (isApiError(error)) {
    const reason = (error as { reason?: SwapBlockedReason }).reason ?? null;
    return { message: error.message, reason };
  }

  return { message: 'We could not swap those meals. Please try again.', reason: null };
}
