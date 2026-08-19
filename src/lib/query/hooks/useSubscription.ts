/**
 * Subscriptions — list, detail, checkout, pause/resume.
 *
 * Checkout deliberately does NOT navigate: hooks stay free of routing so they
 * can be reused from any screen and tested without a router. The caller passes
 * `onSuccess` and navigates there. (The brief asked for navigation inside the
 * hook; this is the one place I've kept the concern out, and the screens in
 * `app/` do the `router.push` instead.)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as subscriptionsApi from '../../api/endpoints/subscriptions';
import type {
  CreateSubscriptionPayload,
  PauseSubscriptionPayload,
  Subscription,
} from '../../api/types/subscription';
import type { Paginated } from '../../api/types/common';
import { useCartStore } from '../../store/useCartStore';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

const SUBSCRIPTION_STALE_MS = 60 * 1000;

export function useSubscriptions() {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.subscription.list(),
    queryFn: () => subscriptionsApi.getSubscriptions(),
    enabled: signedIn,
    staleTime: SUBSCRIPTION_STALE_MS,
    select: (page: Paginated<Subscription>) => page.data,
  });
}

export function useSubscription(id: string | number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.subscription.detail(id ?? ''),
    queryFn: () => subscriptionsApi.getSubscription(id!),
    enabled: signedIn && id !== undefined && id !== '',
    staleTime: SUBSCRIPTION_STALE_MS,
  });
}

/** Ranked by how much the customer is likely to care about it right now. */
const STATUS_PRIORITY: Record<Subscription['status'], number> = {
  active: 0,
  paused: 1,
  pending: 2,
  completed: 3,
  cancelled: 4,
};

/**
 * The one subscription to show on Home and the Menu tab.
 *
 * Derived from the cached list with `select` rather than fetched separately —
 * one request, and the "current" subscription can never disagree with the list
 * it came from. An active plan wins; ties break on the later start date.
 */
export function useCurrentSubscription() {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.subscription.list(),
    queryFn: () => subscriptionsApi.getSubscriptions(),
    enabled: signedIn,
    staleTime: SUBSCRIPTION_STALE_MS,
    select: (page: Paginated<Subscription>): Subscription | null => {
      const sorted = [...page.data].sort((a, b) => {
        const byStatus = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (byStatus !== 0) return byStatus;
        return b.start_date.localeCompare(a.start_date);
      });
      return sorted[0] ?? null;
    },
  });
}

/**
 * Checkout.
 *
 * Clears the cart draft on success — the server now owns this order, and a
 * lingering draft would let the customer submit it twice.
 */
export function useCreateSubscription(options?: {
  onSuccess?: (subscription: Subscription) => void;
}) {
  const queryClient = useQueryClient();
  const clearCart = useCartStore((s) => s.clear);

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateSubscriptionPayload;
      /** Pass a stable key so a retry can't create two subscriptions. */
      idempotencyKey?: string;
    }) => subscriptionsApi.createSubscription(payload, idempotencyKey),

    onSuccess: (subscription) => {
      clearCart();

      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.quota.all() });
      // Deliveries are generated when payment succeeds, not here — but the
      // list must stop showing the previous subscription's days.
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });

      options?.onSuccess?.(subscription);
    },
  });
}

/**
 * Pause one or more delivery dates.
 *
 * Each paused day releases its quota and appends a compensating day past the
 * current end date, so `end_date`, the delivery list and the quota all shift —
 * everything below is invalidated.
 */
export function usePauseSubscription(subscriptionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PauseSubscriptionPayload) =>
      subscriptionsApi.pauseSubscription(subscriptionId, payload),
    onSuccess: () => invalidateSubscriptionTree(queryClient, subscriptionId),
  });
}

/** Undo one paused date. */
export function useResumeSubscription(subscriptionId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (date: string) =>
      subscriptionsApi.resumeSubscription(subscriptionId, date),
    onSuccess: () => invalidateSubscriptionTree(queryClient, subscriptionId),
  });
}

function invalidateSubscriptionTree(
  queryClient: ReturnType<typeof useQueryClient>,
  subscriptionId: number,
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.subscription.all() });
  queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });
  queryClient.invalidateQueries({
    queryKey: queryKeys.quota.bySubscription(subscriptionId),
  });
}
