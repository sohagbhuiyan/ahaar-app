/**
 * Subscriptions, their day-by-day deliveries, and entitlement quota.
 *
 * Mirrors `SubscriptionResource`, `DailyDeliveryResource`,
 * `DailyDeliveryItemResource` and `SubscriptionQuotaResource`.
 */
import type { Plan } from './catalog';
import type { Payment } from './order';

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
  slot_id: number;
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
  menu_item?: { id: number; name: string; slug: string };
  category_id: number;
  quantity: number;
  is_addon: boolean;
  is_default: boolean;
  source: DeliveryItemSource;
}

/**
 * `App\Http\Resources\Customer\DailyDeliveryResource`
 *
 * One row per calendar day of the subscription. `delivery_date` is the real
 * date; the weekday menu it was built from is that date's ISO weekday.
 */
export interface Delivery {
  id: number;
  subscription_id: number;
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number;
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

/** POST /subscriptions */
export interface CreateSubscriptionPayload {
  plan_id: number;
  slot_id: number;
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
  status?: DeliveryStatus;
  page?: number;
}
