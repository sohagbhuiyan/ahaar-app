/**
 * Payment history.
 *
 * Short `staleTime` and an always-on remount refetch: a payment's `status`
 * flips server-side when the gateway settles or a webhook lands, and this is
 * the screen a customer opens precisely to find out whether that has happened
 * yet. A cached "pending" would answer the question wrong.
 */
import { useInfiniteQuery } from '@tanstack/react-query';

import * as paymentsApi from '../../api/endpoints/payments';
import type { Paginated } from '../../api/types/common';
import type { Payment } from '../../api/types/order';
import { queryKeys } from '../keys';
import { useIsSignedIn } from './useIsSignedIn';

function nextPage(last: Paginated<Payment>): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

export function usePayments() {
  const signedIn = useIsSignedIn();

  return useInfiniteQuery({
    queryKey: queryKeys.payments.list(),
    queryFn: ({ pageParam }) => paymentsApi.getPayments({ page: pageParam }),
    enabled: signedIn,
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
    select: (data) => data.pages.flatMap((page) => page.data),
  });
}
