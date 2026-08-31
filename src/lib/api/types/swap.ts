/**
 * Meal swapping.
 *
 * A swap is a **transposition**, never a substitution: today's lunch beef and
 * tonight's dinner fish trade places, so lunch serves fish and dinner serves
 * beef. Nothing enters the subscription from outside it — the only things on
 * offer are the other plates the customer has already paid for.
 *
 * That is why a target is a **position** (a `daily_delivery_items.id`) rather
 * than a menu item: the same dish can sit on several plates that week, and it
 * matters which one moves.
 *
 * Every rule is decided server-side. The client must not re-derive whether
 * something can be swapped from dates, cutoffs or lock flags of its own.
 *
 * Mirrors `MealSwapController` + `MealSwapService`.
 */
import type { DeliverySlot } from './catalog';

/** Why the server refused, as a stable code the UI can branch on. */
export type SwapBlockedReason =
  | 'past_cutoff'
  | 'already_swapped'
  | 'category_not_swappable'
  | 'paid_extra'
  | 'different_week'
  | 'different_category'
  | 'addon_mismatch'
  | 'same_dish'
  | 'same_position'
  | 'not_scheduled'
  | 'outside_subscription';

/** One plate the selected dish may move to. */
export interface SwapTarget {
  /** The position that would receive this dish — what you send as `to_item_id`. */
  item_id: number;
  delivery_id: number;
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number | null;
  slot_name: string | null;
  menu_item_id: number;
  name: string | null;
  image_url: string | null;
  quantity: number;
  /**
   * Ineligible targets are still returned, so the UI can grey them out with a
   * reason rather than hiding them — "already swapped" is far less confusing
   * shown than silently absent.
   */
  eligible: boolean;
  reason: SwapBlockedReason | null;
  message: string | null;
}

/** One dish on the plate, with everywhere it could go. */
export interface SwapPosition {
  item_id: number;
  delivery_id: number;
  menu_item_id: number;
  name: string | null;
  category_id: number;
  category_name: string | null;
  quantity: number;
  is_addon: boolean;
  /** The quota week both ends of a swap must share. */
  week_number: number;
  can_swap: boolean;
  blocked_reason: SwapBlockedReason | null;
  blocked_message: string | null;
  targets: SwapTarget[];
}

/** GET /deliveries/{id}/swap-options */
export interface DeliverySwapOptions {
  delivery_id: number;
  /** YYYY-MM-DD */
  delivery_date: string;
  /** The only source of truth for whether this meal may still change. */
  before_cutoff: boolean;
  cutoff_at: string | null;
  /** Empty when nothing on this meal is swappable. */
  positions: SwapPosition[];
}

/** POST /subscriptions/{id}/swaps — exchange two plates. */
export interface ApplySwapPayload {
  from_item_id: number;
  to_item_id: number;
}

// ── The plan schedule ────────────────────────────────────────────────────────

/** A dish on a scheduled plate, as the plan view renders it. */
export interface SchedulePlate {
  id: number;
  menu_item_id: number;
  name: string | null;
  slug: string | null;
  image_url: string | null;
  category_id: number;
  category_name: string | null;
  quantity: number;
  is_addon: boolean;
  /** An add-on that came with the plan rather than being bought. */
  is_free_addon: boolean;
  source: string;
  package: { id: number; name: string } | null;
  was_swapped: boolean;
  /** What the plan originally scheduled here, when it was swapped away. */
  original_name: string | null;
  can_swap: boolean;
  swap_blocked_reason: SwapBlockedReason | null;
  swap_blocked_message: string | null;
}

/** One meal on one day. */
export interface ScheduleMeal {
  delivery_id: number;
  slot: Pick<DeliverySlot, 'id' | 'name' | 'slug'> & {
    start_time: string | null;
    end_time: string | null;
  };
  status: string;
  cutoff_at: string | null;
  before_cutoff: boolean;
  is_customized: boolean;
  items: SchedulePlate[];
}

export interface ScheduleDay {
  /** YYYY-MM-DD */
  date: string;
  /** ISO weekday, 1 = Monday. */
  day_number: number;
  day_name: string;
  week_number: number;
  meals: ScheduleMeal[];
}

export interface ScheduleWeek {
  week_number: number;
  starts_on: string;
  ends_on: string;
  days: ScheduleDay[];
}

/** GET /subscriptions/{id}/schedule — the whole plan as bought. */
export interface SubscriptionSchedule {
  subscription_id: number;
  start_date: string;
  end_date: string;
  weeks: ScheduleWeek[];
}

/** One entry of the customer's own swap history. */
export interface MealSwapEntry {
  id: number;
  week_number: number;
  category: string | null;
  swapped_at: string;
  moved: { dish: string | null; from: string | null; to: string | null };
  in_exchange_for: { dish: string | null; from: string | null; to: string | null };
}
