/**
 * Menu — the subscriber's day-by-day deliveries.
 *
 * Not a catalogue: these are the customer's own scheduled days, each already
 * built from that calendar date's weekday menu. Shorter `staleTime` than the
 * catalogue because a delivery can be swapped, paused or locked at its cutoff,
 * and a stale copy would offer actions the server will reject.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import * as menuApi from '../../api/endpoints/menu';
import type { Delivery, DeliveryFilters } from '../../api/types/subscription';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

const DELIVERY_STALE_MS = 30 * 1000;

/**
 * Every delivery the customer has, sorted by date.
 *
 * Complete on purpose. This was an `useInfiniteQuery` that nothing ever paged:
 * no screen called `fetchNextPage`, so the app only ever held page 1 — 50 rows
 * shared across every subscription the customer owns. A 30-day full-board plan
 * spends three rows a day, so a customer with a second plan still running saw
 * their new one render as **six days**. Every consumer below (the day tabs,
 * "coming up", the schedule) needs the whole run to be correct, so the paging
 * is resolved in `getAllDeliveries` and this is a plain query again.
 */
export function useDeliveries(filters: Omit<DeliveryFilters, 'page'> = {}) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.menu.deliveries(filters),
    queryFn: () => menuApi.getAllDeliveries(filters),
    // `/deliveries` is behind auth:sanctum — a signed-out visitor browsing the
    // Menu tab would otherwise fire a request that can only 401.
    enabled: signedIn,
    staleTime: DELIVERY_STALE_MS,
    // Ascending by date — the day tabs and the schedule both read
    // chronologically, whatever order the API paged them in.
    select: (items: Delivery[]) =>
      [...items].sort((a, b) => a.delivery_date.localeCompare(b.delivery_date)),
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
 * Today's meals, for the Home screen highlight.
 *
 * Plural on purpose: a subscription covers every meal its plan serves, so
 * "today" is up to three deliveries — breakfast, lunch and dinner — not one.
 * They are ordered by time of day so Home reads down the day.
 *
 * `delivery` is the next one still open, or the first if the day has closed:
 * that is the one a customer arriving at Home can still act on, and it keeps
 * the single-delivery callers working.
 *
 * Derived from the already-cached list rather than a separate request, so Home
 * and Menu can never disagree about what is being delivered today.
 */
export function useTodaysDelivery(
  subscriptionId: number | undefined,
  todayIso: string,
) {
  const query = useSubscriptionDeliveries(subscriptionId);

  const deliveries = useMemo(
    () => sortByTimeOfDay((query.data ?? []).filter((d) => d.delivery_date === todayIso)),
    [query.data, todayIso],
  );

  const delivery = deliveries.find((d) => d.before_cutoff) ?? deliveries[0] ?? null;

  return { ...query, deliveries, delivery };
}

/**
 * Every meal on one date, in time-of-day order.
 *
 * The order matters and cannot be taken from the id: the catalogue happens to
 * create lunch before breakfast, so sorting by `slot_id` would print the day
 * out of sequence.
 */
export function useDeliveriesOnDate(
  subscriptionId: number | undefined,
  dateIso: string | null,
) {
  const query = useSubscriptionDeliveries(subscriptionId);

  const data = useMemo(() => {
    if (!query.data || !dateIso) return [];
    return sortByTimeOfDay(query.data.filter((d) => d.delivery_date === dateIso));
  }, [query.data, dateIso]);

  return { ...query, data };
}

/** Chronological within a day. Deliveries without a slot sort last. */
function sortByTimeOfDay(deliveries: Delivery[]): Delivery[] {
  return [...deliveries].sort((a, b) =>
    (a.slot?.start_time ?? '99:99').localeCompare(b.slot?.start_time ?? '99:99'),
  );
}

/**
 * The distinct calendar dates a subscription delivers on.
 *
 * The day selector is per *date*, not per delivery — with three meals a day the
 * raw list would otherwise render three tabs for Monday.
 */
export function useDeliveryDates(subscriptionId: number | undefined): string[] {
  const query = useSubscriptionDeliveries(subscriptionId);

  return useMemo(() => {
    const seen = new Set<string>();
    for (const delivery of query.data ?? []) seen.add(delivery.delivery_date);
    return [...seen].sort();
  }, [query.data]);
}
