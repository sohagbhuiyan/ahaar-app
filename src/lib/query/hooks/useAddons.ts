/**
 * Add-ons — paid path live, free/opt-in path stubbed.
 *
 * The free add-on API does not exist yet (no `menu_items.is_free`, no
 * `weekday_addons`, no `delivery_addons`). Rather than have every screen
 * try/catch, `addonsApiAvailable` lets the UI decide once and simply not offer
 * the free flow.
 *
 * The paid path — `POST /orders/extra` — works today and is what the picker
 * uses for everything.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as addonsApi from '../../api/endpoints/addons';
import { isAddonsApiAvailable } from '../../api/endpoints/addons';
import type { OrderLineInput } from '../../api/types/order';
import { queryKeys } from '../keys';

/**
 * Whether the free/opt-in add-on API exists.
 *
 * Currently always false. When Priority 4 ships, flip
 * `ADDONS_API_AVAILABLE` in `api/endpoints/addons.ts` and the UI follows.
 */
export function useAddonsApiAvailable(): boolean {
  return isAddonsApiAvailable();
}

/**
 * Add paid extras to a delivery.
 *
 * Not optimistic: this creates a payable order, and showing an item as added
 * before the server confirms would misrepresent what the customer owes. The
 * delivery is invalidated on settle — the items only attach once the payment
 * succeeds, so the list may legitimately not change immediately.
 */
export function useAddPaidAddons(deliveryId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      items,
      gateway,
    }: {
      items: OrderLineInput[];
      gateway?: 'test' | 'mollie' | 'stripe';
    }) => addonsApi.addPaidAddons(deliveryId, items, gateway),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.detail(deliveryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
    },
  });
}

/**
 * Free add-on opt-in. STUBBED — the mutation function throws
 * `AddonsNotAvailableError` until the backend ships.
 *
 * Wired up now so screens can be built against the final shape; gate any UI
 * that calls it behind `useAddonsApiAvailable()`.
 */
export function useAddFreeAddon(deliveryId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (menuItemId: number) =>
      addonsApi.addFreeAddon(deliveryId, { menu_item_id: menuItemId }),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addons.byDelivery(deliveryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.detail(deliveryId) });
    },
  });
}

/** Remove an opted-in add-on. STUBBED — see `useAddFreeAddon`. */
export function useRemoveAddon(deliveryId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (menuItemId: number) => addonsApi.removeAddon(deliveryId, menuItemId),

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.addons.byDelivery(deliveryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.menu.detail(deliveryId) });
    },
  });
}
