/**
 * Menu — the subscriber's day-by-day deliveries.
 *
 * Not a catalogue: these are the customer's own scheduled days, each already
 * built from that calendar date's weekday menu. Shorter `staleTime` than the
 * catalogue because a delivery can be swapped, paused or locked at its cutoff,
 * and a stale copy would offer actions the server will reject.
 */
import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import * as menuApi from '../../api/endpoints/menu';
import type { Paginated } from '../../api/types/common';
import type { Delivery, DeliveryFilters } from '../../api/types/subscription';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

const DELIVERY_STALE_MS = 30 * 1000;

function nextPage(last: Paginated<Delivery>): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

/** Paged deliveries, flattened and sorted by date. */
export function useDeliveries(filters: DeliveryFilters = {}) {
  const signedIn = useIsSignedIn();

  return useInfiniteQuery({
    queryKey: queryKeys.menu.deliveries(filters),
    queryFn: ({ pageParam }) => menuApi.getDeliveries({ ...filters, page: pageParam }),
    // `/deliveries` is behind auth:sanctum — a signed-out visitor browsing the
    // Menu tab would otherwise fire a request that can only 401.
    enabled: signedIn,
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: DELIVERY_STALE_MS,
    select: (data) => {
      const items = data.pages.flatMap((page) => page.data);
      // Ascending by date — the day tabs and the schedule both read
      // chronologically, whatever order the API paged them in.
      return items.sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
    },
  });
}

/**
 * One delivery, with its items.
 *
 * `refetchOnMount: 'always'` because `before_cutoff` is time-sensitive: a
 * cached `true` from ten minutes ago could offer a swap the server now
 * refuses.
 */
export function useDelivery(id: string | number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.menu.detail(id ?? ''),
    queryFn: () => menuApi.getDelivery(id!),
    enabled: signedIn && id !== undefined && id !== '',
    staleTime: DELIVERY_STALE_MS,
    refetchOnMount: 'always',
  });
}

/**
 * The deliveries of one subscription.
 *
 * Filtered here, not by the API: `GET /deliveries` ignores a subscription id
 * (see `endpoints/menu.ts`) and returns every delivery the customer has. Left
 * unfiltered, a customer on their second plan would see both plans' days
 * interleaved on one calendar.
 *
 * One cached query backs every subscription, so switching between them costs
 * no request at all.
 */
export function useSubscriptionDeliveries(subscriptionId: number | undefined) {
  const query = useDeliveries();

  const data = useMemo(() => {
    if (!query.data) return undefined;
    if (subscriptionId === undefined) return query.data;
    return query.data.filter((d) => d.subscription_id === subscriptionId);
  }, [query.data, subscriptionId]);

  return { ...query, data };
}

/**
 * Today's delivery, for the Home screen highlight.
 *
 * Derived from the already-cached list rather than a separate request, so Home
 * and Menu can never disagree about what is being delivered today.
 */
export function useTodaysDelivery(
  subscriptionId: number | undefined,
  todayIso: string,
) {
  const query = useSubscriptionDeliveries(subscriptionId);
  const delivery =
    query.data?.find((d) => d.delivery_date === todayIso) ?? null;

  return { ...query, delivery };
}
