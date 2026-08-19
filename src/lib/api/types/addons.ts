/**
 * Add-ons — STUBBED. The backend for this does not exist yet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What exists today
 *   Paid extras only, via `POST /orders/extra` (see `./order.ts`). Any menu
 *   item can be added to a delivery before its cutoff and is always charged.
 *
 * What does NOT exist yet (Priority 4 of the backend work)
 *   - `menu_items.is_free` — the free/paid flag
 *   - `weekday_addons`     — which add-ons are offerable per weekday/slot
 *   - `delivery_addons`    — a customer's opted-in *free* add-ons
 *   - the opt-in / opt-out endpoints
 *
 * The three-category customer model these will support:
 *   1. Default menu items        → "Included"
 *   2. Default add-ons           → "Included — tap to remove"
 *      (`plan_menus.is_default_addon`; today these exist but cannot be removed)
 *   3. Opt-in add-ons            → "Add — Free" / "Add — {price}"
 *
 * The types below encode the intended contract so the UI can be built against
 * it. `../endpoints/addons.ts` throws `AddonsNotAvailableError` for anything
 * that needs a missing endpoint, and the free/paid split degrades to
 * "everything is paid" until the backend lands. Nothing here is speculative
 * about *existing* behaviour — only about the planned shape.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** How an add-on is presented and charged. */
export type AddonKind = 'free' | 'paid';

/**
 * An add-on offered on a given delivery.
 *
 * PLANNED shape — expected from `GET /deliveries/{id}/addons`.
 */
export interface DeliveryAddon {
  menu_item_id: number;
  name: string;
  slug: string;
  image_url: string | null;
  /** 0 when `kind === 'free'`. */
  price: number;
  kind: AddonKind;
  /** Whether the customer has already opted in for this delivery. */
  is_selected: boolean;
  /** Max units per delivery, from `weekday_addons.max_per_delivery`. */
  max_quantity: number;
  /**
   * Remaining kitchen capacity for this item on this delivery date, from the
   * planned `daily_item_quotas`. `null` = uncapped. 0 = show as sold out.
   */
  remaining_capacity: number | null;
}

/** PLANNED — `POST /deliveries/{id}/addons`. Free add-ons only; paid ones go through `/orders/extra`. */
export interface AddFreeAddonPayload {
  menu_item_id: number;
  quantity?: number;
}

/** PLANNED — `DELETE /deliveries/{id}/addons/{menuItemId}`. */
export interface RemoveAddonPayload {
  menu_item_id: number;
}

/**
 * Thrown by every stubbed add-on endpoint. Callers should catch this and fall
 * back to the paid `/orders/extra` path rather than surfacing a crash.
 */
export class AddonsNotAvailableError extends Error {
  readonly code = 'addons_not_implemented' as const;

  constructor(endpoint: string) {
    super(
      `Add-on endpoint "${endpoint}" is not implemented on the backend yet. ` +
        'Use the paid extra-order flow (POST /orders/extra) until Priority 4 ships.',
    );
    this.name = 'AddonsNotAvailableError';
  }
}
