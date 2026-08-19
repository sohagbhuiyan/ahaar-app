/**
 * Day swap — exchanging a day's item for another in the plan's menu set.
 *
 * The mutation is optimistic because a swap is a direct manipulation: the user
 * taps a dish and expects the card to change under their finger, not after a
 * round-trip. Every server rule is still authoritative — the optimistic write
 * is reverted on any error and the truth is re-fetched on settle.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as swapApi from '../../api/endpoints/swap';
import type { Delivery } from '../../api/types/subscription';
import type { SwapInput, SwapOptions } from '../../api/types/swap';
import { queryKeys } from '../keys';

/**
 * What may be swapped on this delivery.
 *
 * `refetchOnMount: 'always'` for the same reason as the delivery itself:
 * `before_cutoff` and each option's remaining quota both go stale with the
 * clock, and offering an option the server will reject is worse than a brief
 * spinner.
 */
export function useSwapOptions(deliveryId: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.swap.options(deliveryId ?? ''),
    queryFn: () => swapApi.getSwapOptions(deliveryId!),
    enabled: deliveryId !== undefined && deliveryId !== '',
    staleTime: 15 * 1000,
    refetchOnMount: 'always',
  });
}

interface SwapContext {
  previousDelivery?: Delivery;
  previousOptions?: SwapOptions;
}

/**
 * Apply swaps to one delivery.
 *
 * On success the quota, the delivery and the swap options are all invalidated:
 * a swap releases one item's weekly slot and consumes another's, so the meters
 * elsewhere in the app are wrong until they refetch.
 */
export function useApplySwaps(deliveryId: number, subscriptionId?: number) {
  const queryClient = useQueryClient();
  const deliveryKey = queryKeys.menu.detail(deliveryId);
  const optionsKey = queryKeys.swap.options(deliveryId);

  return useMutation({
    mutationFn: (swaps: SwapInput[]) =>
      swapApi.applySwaps(deliveryId, { swaps }),

    onMutate: async (swaps): Promise<SwapContext> => {
      // Stop any in-flight refetch from landing on top of the optimistic write.
      await queryClient.cancelQueries({ queryKey: deliveryKey });
      await queryClient.cancelQueries({ queryKey: optionsKey });

      const previousDelivery = queryClient.getQueryData<Delivery>(deliveryKey);
      const previousOptions = queryClient.getQueryData<SwapOptions>(optionsKey);

      // Show the new item in place immediately.
      if (previousDelivery?.items) {
        const byCategory = new Map(swaps.map((s) => [s.category_id, s.to_menu_item_id]));
        const nameFor = (menuItemId: number) =>
          previousOptions?.categories
            .flatMap((c) => c.options)
            .find((o) => o.menu_item_id === menuItemId)?.name;

        queryClient.setQueryData<Delivery>(deliveryKey, {
          ...previousDelivery,
          is_customized: true,
          items: previousDelivery.items.map((item) => {
            // Only non-addon items participate in a category swap.
            const target = item.is_addon ? undefined : byCategory.get(item.category_id);
            if (target === undefined) return item;

            return {
              ...item,
              is_default: false,
              source: 'customization' as const,
              menu_item: {
                id: target,
                name: nameFor(target) ?? item.menu_item?.name ?? '',
                slug: item.menu_item?.slug ?? '',
              },
            };
          }),
        });
      }

      // Move the selection highlight in the options list too.
      if (previousOptions) {
        const byCategory = new Map(swaps.map((s) => [s.category_id, s.to_menu_item_id]));

        queryClient.setQueryData<SwapOptions>(optionsKey, {
          ...previousOptions,
          categories: previousOptions.categories.map((category) => {
            const target = byCategory.get(category.category_id);
            if (target === undefined) return category;

            return {
              ...category,
              current_item_id: target,
              options: category.options.map((option) => ({
                ...option,
                is_current: option.menu_item_id === target,
              })),
            };
          }),
        });
      }

      return { previousDelivery, previousOptions };
    },

    onError: (_error, _swaps, context) => {
      // A 422 here is a real conflict — exhausted quota, or the cutoff passed
      // mid-interaction. Put the previous state back rather than leaving the
      // UI showing a swap that never happened.
      if (context?.previousDelivery) {
        queryClient.setQueryData(deliveryKey, context.previousDelivery);
      }
      if (context?.previousOptions) {
        queryClient.setQueryData(optionsKey, context.previousOptions);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: deliveryKey });
      queryClient.invalidateQueries({ queryKey: optionsKey });
      // The whole day list shows each day's items.
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });

      if (subscriptionId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.quota.bySubscription(subscriptionId),
        });
      }
    },
  });
}

/** Restore the plan's defaults for a day. Paid extras on it are kept. */
export function useRevertSwaps(deliveryId: number, subscriptionId?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => swapApi.revertSwaps(deliveryId),

    onSuccess: (delivery) => {
      // The response is the updated delivery — seed it rather than refetch.
      queryClient.setQueryData(queryKeys.menu.detail(deliveryId), delivery);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.swap.options(deliveryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.all() });

      if (subscriptionId !== undefined) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.quota.bySubscription(subscriptionId),
        });
      }
    },
  });
}
