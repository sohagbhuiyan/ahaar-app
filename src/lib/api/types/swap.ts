/**
 * Day-swap (customization) shapes.
 *
 * `GET /deliveries/{id}/swap-options` returns everything the swap UI needs,
 * already filtered server-side by the customer's dietary preferences and by
 * `categories.is_swappable`. The client must not re-derive any of these rules:
 * `before_cutoff` gates editing, `categories` are the only swappable ones,
 * `options` are the only legal targets, and each option's `quota` decides
 * whether it can be selected.
 *
 * Mirrors `CustomizationController::options()` +
 * `CustomizationService::swapOptionsFor()`.
 */

/** Remaining entitlement for one option. `null` means the item is unlimited. */
export interface SwapOptionQuota {
  remaining: number;
}

export interface SwapOption {
  menu_item_id: number;
  name: string;
  slug: string;
  /** Parsed from the API's decimal string. */
  base_price: number;
  dietary_tags: string[];
  allergens: string[];
  /** True for the item currently on the delivery in this category. */
  is_current: boolean;
  /** `null` = not quota-controlled, i.e. always available. */
  quota: SwapOptionQuota | null;
}

export interface SwapCategory {
  category_id: number;
  category_name: string;
  /** `null` when the delivery has no non-addon item in this category. */
  current_item_id: number | null;
  options: SwapOption[];
}

export interface SwapOptions {
  delivery_id: number;
  /** The only source of truth for whether this delivery may still change. */
  before_cutoff: boolean;
  cutoff_at: string;
  categories: SwapCategory[];
}

/** One swap: replace whatever fills `category_id` with `to_menu_item_id`. */
export interface SwapInput {
  category_id: number;
  to_menu_item_id: number;
}

/** POST /deliveries/{id}/customize */
export interface ApplySwapsPayload {
  swaps: SwapInput[];
}
