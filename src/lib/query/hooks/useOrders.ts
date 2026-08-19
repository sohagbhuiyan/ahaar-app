/**
 * Orders — extras, guest portions, and instant (out-of-subscription) orders.
 *
 * None of these are optimistic: each creates a payable order, and showing one
 * as placed before the server confirms would misstate what the customer owes.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as ordersApi from '../../api/endpoints/orders';
import type {
  CreateExtraOrderPayload,
  CreateGuestOrderPayload,
  CreateInstantOrderPayload,
  Order,
  OrderFilters,
} from '../../api/types/order';
import type { Paginated } from '../../api/types/common';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

function nextPage(last: Paginated<Order>): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

/**
 * Every order, paged.
 *
 * Takes no filters on purpose: `GET /orders` accepts none (see
 * `endpoints/orders.ts`), so one cache entry holds the whole history and
 * switching filter in the UI costs no request at all.
 */
export function useOrders() {
  const signedIn = useIsSignedIn();

  return useInfiniteQuery({
    queryKey: queryKeys.orders.list(),
    queryFn: ({ pageParam }) => ordersApi.getOrders({ page: pageParam }),
    enabled: signedIn,
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: 30 * 1000,
    select: (data) => data.pages.flatMap((page) => page.data),
  });
}

/**
 * The order list narrowed by status and/or type.
 *
 * Filtered here rather than on the server because the endpoint ignores both
 * params. The honest consequence is that it only narrows what has been paged
 * in — so `hasNextPage` is surfaced unchanged and the screen keeps offering
 * "load more" even when the current page has no matches.
 */
export function useFilteredOrders(filters: Omit<OrderFilters, 'page'> = {}) {
  const query = useOrders();
  const { status, type } = filters;

  const orders = (query.data ?? []).filter(
    (order) =>
      (status === undefined || order.status === status) &&
      (type === undefined || order.type === type),
  );

  return { ...query, orders };
}

export function useOrder(id: string | number | undefined) {
  const signedIn = useIsSignedIn();

  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: () => ordersApi.getOrder(id!),
    enabled: signedIn && id !== undefined && id !== '',
    // An order's `payment.status` flips server-side when the gateway settles,
    // so the detail screen must not serve a minutes-old "pending".
    staleTime: 10 * 1000,
    refetchOnMount: 'always',
  });
}

/** Extras attach to an existing delivery and must beat its cutoff. */
export function useCreateExtraOrder(options?: { onSuccess?: (order: Order) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateExtraOrderPayload;
      idempotencyKey?: string;
    }) => ordersApi.createExtraOrder(payload, idempotencyKey),

    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      if (order.daily_delivery_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.detail(order.daily_delivery_id),
        });
      }
      options?.onSuccess?.(order);
    },
  });
}

/** Guest portions mirror the delivery's own items, ×`guests_count` (1-10). */
export function useCreateGuestOrder(options?: { onSuccess?: (order: Order) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateGuestOrderPayload;
      idempotencyKey?: string;
    }) => ordersApi.createGuestOrder(payload, idempotencyKey),

    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      if (order.daily_delivery_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.detail(order.daily_delivery_id),
        });
      }
      options?.onSuccess?.(order);
    },
  });
}

/**
 * Instant order — standalone, no subscription needed.
 *
 * This is the out-of-subscription path: anyone can order for a date and slot
 * whose cutoff hasn't passed, whether or not they have a plan.
 */
export function useCreateInstantOrder(options?: { onSuccess?: (order: Order) => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateInstantOrderPayload;
      idempotencyKey?: string;
    }) => ordersApi.createInstantOrder(payload, idempotencyKey),

    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      options?.onSuccess?.(order);
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      ordersApi.cancelOrder(id, reason),

    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      // Cancelling pulls the order's materialised items off the delivery.
      if (order.daily_delivery_id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.menu.detail(order.daily_delivery_id),
        });
      }
    },
  });
}
