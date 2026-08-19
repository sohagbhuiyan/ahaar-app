/**
 * Add-ons — PARTIALLY STUBBED.
 *
 * Working today (paid path):
 *   `addPaidAddons()` → `POST /orders/extra`. Any catalogue item can be added
 *   to a delivery before its cutoff; it becomes a separate payable order and is
 *   never counted against the subscription's included meals.
 *
 * Stubbed (free / opt-in path), pending Priority 4 of the backend work:
 *   `getDeliveryAddons()`, `addFreeAddon()`, `removeAddon()` throw
 *   `AddonsNotAvailableError`. Nothing about "free" is expressible server-side
 *   yet — there is no `menu_items.is_free`, no `weekday_addons` table defining
 *   what is offerable per weekday/slot, and no `delivery_addons` table to
 *   record an opt-in.
 *
 * Callers should treat `AddonsNotAvailableError` as "show the paid flow only".
 * `isAddonsApiAvailable()` exists so the UI can make that call once rather
 * than try/catching per interaction.
 */
import { apiClient, unwrap } from '../client';
import { normalizeOrder } from '../normalize';
import {
  AddonsNotAvailableError,
  type AddFreeAddonPayload,
  type DeliveryAddon,
} from '../types/addons';
import type { ApiEnvelope } from '../types/common';
import type { Order, OrderLineInput } from '../types/order';

type Raw = Record<string, unknown>;

/**
 * Whether the free/opt-in add-on API exists yet. Flip to `true` — and delete
 * the throwing bodies below — when Priority 4 ships.
 */
export const ADDONS_API_AVAILABLE = false;

export function isAddonsApiAvailable(): boolean {
  return ADDONS_API_AVAILABLE;
}

// ── Working: paid add-ons via the extra-order path ───────────────────────────

/**
 * POST /orders/extra
 *
 * Attaches paid items to an existing subscription delivery. Fails with 422
 * past the delivery's cutoff. The resulting order starts `pending` and its
 * items only appear on the delivery once its payment succeeds.
 */
export async function addPaidAddons(
  deliveryId: number,
  items: OrderLineInput[],
  gateway?: 'test' | 'mollie' | 'stripe',
): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/orders/extra', {
    daily_delivery_id: deliveryId,
    items,
    gateway,
  });
  return normalizeOrder(unwrap(data));
}

// ── Stubbed: the free / opt-in add-on API ────────────────────────────────────

/** PLANNED — `GET /deliveries/{id}/addons`. */
export async function getDeliveryAddons(
  _deliveryId: number | string,
): Promise<DeliveryAddon[]> {
  throw new AddonsNotAvailableError('GET /deliveries/{id}/addons');
}

/** PLANNED — `POST /deliveries/{id}/addons`. Free items only. */
export async function addFreeAddon(
  _deliveryId: number | string,
  _payload: AddFreeAddonPayload,
): Promise<DeliveryAddon[]> {
  throw new AddonsNotAvailableError('POST /deliveries/{id}/addons');
}

/** PLANNED — `DELETE /deliveries/{id}/addons/{menuItemId}`. */
export async function removeAddon(
  _deliveryId: number | string,
  _menuItemId: number,
): Promise<DeliveryAddon[]> {
  throw new AddonsNotAvailableError('DELETE /deliveries/{id}/addons/{menuItemId}');
}

/**
 * PLANNED — removing a *default* add-on (`plan_menus.is_default_addon`) from
 * one delivery. Today defaults are re-seeded on every revert and cannot be
 * opted out of at all, so there is nothing to call.
 */
export async function removeDefaultAddon(
  _deliveryId: number | string,
  _menuItemId: number,
): Promise<DeliveryAddon[]> {
  throw new AddonsNotAvailableError('DELETE /deliveries/{id}/default-addons/{menuItemId}');
}
