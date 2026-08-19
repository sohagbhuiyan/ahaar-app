/**
 * Day swap — exchanging one day's item for another within the plan's menu set.
 *
 * Every rule is server-side and must not be re-derived on the client:
 *   - `before_cutoff` decides whether the delivery may change at all
 *   - only the returned `categories` are swappable
 *   - only the returned `options` are legal targets
 *   - an option with `quota !== null && quota.remaining <= 0` is unselectable
 *
 * The swap itself is atomic on the backend: the outgoing item's quota slot is
 * released and the incoming item's is consumed inside one transaction, so a
 * 422 here means a genuine conflict (exhausted quota, past cutoff), not a
 * client mistake to retry blindly.
 */
import { apiClient, unwrap } from '../client';
import { normalizeDelivery, normalizeSwapOptions } from '../normalize';
import type { ApiEnvelope } from '../types/common';
import type { Delivery } from '../types/subscription';
import type { ApplySwapsPayload, SwapOptions } from '../types/swap';

type Raw = Record<string, unknown>;

/** GET /deliveries/{id}/swap-options */
export async function getSwapOptions(
  deliveryId: number | string,
): Promise<SwapOptions> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(
    `/deliveries/${deliveryId}/swap-options`,
  );
  return normalizeSwapOptions(unwrap(data));
}

/**
 * POST /deliveries/{id}/customize
 *
 * Applies one or more `{ category_id, to_menu_item_id }` swaps and returns the
 * updated delivery. All-or-nothing: the backend pre-validates every swap
 * before writing any of them.
 */
export async function applySwaps(
  deliveryId: number | string,
  payload: ApplySwapsPayload,
): Promise<Delivery> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/deliveries/${deliveryId}/customize`,
    payload,
  );
  return normalizeDelivery(unwrap(data));
}

/**
 * DELETE /deliveries/{id}/customize
 *
 * Restores the plan's defaults for that day. Items attached to a paid order
 * (extras, guest portions) are kept — the customer paid for those separately.
 */
export async function revertSwaps(
  deliveryId: number | string,
): Promise<Delivery> {
  const { data } = await apiClient.delete<ApiEnvelope<Raw>>(
    `/deliveries/${deliveryId}/customize`,
  );
  return normalizeDelivery(unwrap(data));
}
