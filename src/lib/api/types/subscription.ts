/**
 * Subscriptions, their day-by-day deliveries, and entitlement quota.
 *
 * Mirrors `SubscriptionResource`, `DailyDeliveryResource`,
 * `DailyDeliveryItemResource` and `SubscriptionQuotaResource`.
 */
import type { DeliveryAddress, DeliverySlot, Plan } from './catalog';
import type { Payment } from './order';
import type { SwapBlockedReason } from './swap';

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

/** `App\Http\Resources\Customer\SubscriptionResource` */
export interface Subscription {
  id: number;
  /** Only present when eager-loaded (show/store do; index does too). */
  plan?: Plan;
  address_id: number | null;
  /** Where it is delivered, frozen at purchase. Null on older subscriptions. */
  delivery_address: DeliveryAddress | null;
  /**
   * Every meal this subscription delivers each day, in time-of-day order.
   *
   * The plan's flat price buys the whole board its weekly menu defines, so this
   * is a list, not a choice — and it is frozen at purchase, so a plan gaining a
   * breakfast next month does not widen what an existing subscriber paid for.
   * It is also what makes swapping possible: moving tonight's fish onto today's
   * lunch needs both plates to belong to the same subscription.
   */
  slots: DeliverySlot[];
  status: SubscriptionStatus;
  /** YYYY-MM-DD */
  start_date: string;
  /** YYYY-MM-DD — moves later each time a day is paused. */
  end_date: string;
  /** YYYY-MM-DD — the end date before any pauses. */
  original_end_date: string;
  price_paid: number;
  activated_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  payment?: Payment;
}

export type DeliveryStatus =
  | 'scheduled'
  | 'locked'
  | 'delivered'
  | 'paused'
  | 'skipped';

/** Where an item on a delivery came from. */
export type DeliveryItemSource = 'plan' | 'customization' | 'extra' | 'guest';

/** `App\Http\Resources\Customer\DailyDeliveryItemResource` */
export interface DeliveryItem {
  id: number;
  menu_item_id: number | null;
  menu_item?: { id: number; name: string; slug: string; image_url: string | null };
  category_id: number;
  /** `is_swappable: false` categories are fixed parts of the meal. */
  category?: { id: number; name: string; is_swappable: boolean };
  quantity: number;
  is_addon: boolean;
  /** An add-on that came with the plan, as opposed to one bought as an extra. */
  is_free_addon: boolean;
  is_default: boolean;
  source: DeliveryItemSource;
  /** Set when this line was materialised from a bundle the customer bought. */
  package?: { id: number; name: string } | null;

  /**
   * Swap state — all server-decided.
   *
   * A position gets exactly one exchange and is then settled for good, which is
   * what `swap_locked` records. `can_swap` already folds in the cutoff, the lock
   * and whether the category is swappable at all, so the UI must never re-derive
   * it from dates or flags of its own.
   */
  swap_locked: boolean;
  swap_locked_at: string | null;
  was_swapped: boolean;
  /** What the plan originally scheduled here, once it has been swapped away. */
  swapped_from: string | null;
  can_swap: boolean;
  swap_blocked_reason: SwapBlockedReason | null;
  swap_blocked_message: string | null;
}

/**
 * `App\Http\Resources\Customer\DailyDeliveryResource`
 *
 * One row per **meal** per calendar day. A subscription covering breakfast,
 * lunch and dinner has three of these per date — which is what makes moving
 * tonight's fish onto today's lunch a move between two plates the customer
 * already owns.
 */
export interface Delivery {
  id: number;
  subscription_id: number;
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number;
  /** Eager-loaded on every customer read, so the meal can be named. */
  slot?: DeliverySlot;
  /** Copied from the subscription when the day was generated. */
  delivery_address: DeliveryAddress | null;
  status: DeliveryStatus;
  is_customized: boolean;
  /** ISO-8601 timestamp after which nothing on this delivery may change. */
  cutoff_at: string;
  /** Server-computed; the only source of truth for "can I still edit this?". */
  before_cutoff: boolean;
  items?: DeliveryItem[];
}

/**
 * `App\Http\Resources\Customer\SubscriptionQuotaResource`
 *
 * The customer's *entitlement* quota — how many times they may receive a given
 * item in a given week of their subscription. Distinct from kitchen capacity
 * (per item, per calendar date), which the API does not expose yet.
 *
 * A meal swap never moves these numbers: both ends of an exchange sit in the
 * same week, so the week still contains the same dishes the same number of
 * times. Only pauses, extras and the plan's own defaults touch them.
 */
export interface SubscriptionQuota {
  menu_item_id: number;
  menu_item?: { id: number; name: string; slug: string };
  /** 1-based week from the subscription's start_date (days 1-7 → week 1). */
  week_number: number;
  allowed: number;
  consumed: number;
  remaining: number;
}

/**
 * POST /subscriptions
 *
 * There is no meal to choose: the subscription covers every one its plan
 * serves, read from the plan's weekly menu server-side.
 */
export interface CreateSubscriptionPayload {
  plan_id: number;
  address_id?: number | null;
  /** YYYY-MM-DD — must be tomorrow or later. */
  start_date: string;
  /** Defaults server-side to `payments.default`; 'test' during development. */
  gateway?: 'test' | 'mollie' | 'stripe';
}

/** POST /subscriptions/{id}/pause */
export interface PauseSubscriptionPayload {
  /** YYYY-MM-DD dates to skip; each appends a compensating day at the end. */
  dates: string[];
}

/** Query params for `GET /deliveries`. */
export interface DeliveryFilters {
  subscription_id?: number;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
  slot_id?: number;
  status?: DeliveryStatus;
  page?: number;
}
