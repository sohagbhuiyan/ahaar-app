/**
 * Orders and payments.
 *
 * "Extra order" covers everything bought outside the subscription's included
 * meals — it is always payable. Three kinds exist, all through `/orders`:
 *   - `extra`   → items added onto an existing subscription delivery
 *   - `guest`   → the delivery's own items ×N guest portions
 *   - `instant` → standalone, no subscription (walk-in / one-off)
 *
 * Mirrors `OrderResource`, `OrderItemResource` and `PaymentResource`.
 */
import type { PackageLineInput } from './package';

export type OrderType = 'extra' | 'guest' | 'instant';

export type OrderStatus = 'pending' | 'confirmed' | 'cancelled' | 'delivered';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

/** `App\Http\Resources\Customer\PaymentResource` */
export interface Payment {
  id: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: string;
  /** Hand the user here while `status === 'pending'`. */
  checkout_url: string | null;
  paid_at: string | null;
  created_at: string;
}

/**
 * `App\Http\Resources\Customer\OrderItemResource`
 *
 * A line is either a dish or a bundle, never both — `kind` says which, so no
 * caller has to null-check two ids to print one label. A bundle stays whole
 * here so its price is charged once; it is only exploded into component dishes
 * on the delivery the kitchen packs.
 */
export interface OrderItem {
  id: number;
  kind: 'item' | 'package';
  /** What to print on the line, whichever kind it is. */
  name: string;
  menu_item_id: number | null;
  menu_item?: { id: number; name: string; slug: string; image_url: string | null };
  package_id: number | null;
  package?: { id: number; name: string; slug: string; image_url: string | null };
  quantity: number;
  unit_price: number;
  /** VAT percentage, e.g. 9.00. */
  tax_rate: number;
  subtotal: number;
}

/** `App\Http\Resources\Customer\OrderResource` */
export interface Order {
  id: number;
  type: OrderType;
  subscription_id: number | null;
  daily_delivery_id: number | null;
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number;
  address_id: number | null;
  subtotal: number;
  tax_amount: number;
  /** Prices are stored tax-inclusive; `tax_amount` is the extracted VAT. */
  total_amount: number;
  currency: string;
  status: OrderStatus;
  guests_count: number | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items?: OrderItem[];
  payment?: Payment;
  created_at: string;
}

/** A line on any order-creation payload. */
export interface OrderLineInput {
  menu_item_id: number;
  /** 1-20, enforced server-side. */
  quantity: number;
}

/**
 * POST /orders/extra — attaches to an existing delivery, before its cutoff.
 *
 * A basket holds two kinds of line and needs at least one of either: single
 * dishes (`items`) and bundles (`packages`). Neither is required on its own,
 * which is why both are optional here and the API rejects an empty basket.
 */
export interface CreateExtraOrderPayload {
  daily_delivery_id: number;
  items?: OrderLineInput[];
  packages?: PackageLineInput[];
  gateway?: 'test' | 'mollie' | 'stripe';
}

/** POST /orders/guest — mirrors the delivery's items ×`guests_count` (1-10). */
export interface CreateGuestOrderPayload {
  daily_delivery_id: number;
  guests_count: number;
  gateway?: 'test' | 'mollie' | 'stripe';
}

/**
 * POST /orders/instant — standalone; its own date, slot and address.
 * Takes dishes, bundles, or both; at least one line of either kind.
 */
export interface CreateInstantOrderPayload {
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number;
  address_id?: number | null;
  items?: OrderLineInput[];
  packages?: PackageLineInput[];
  gateway?: 'test' | 'mollie' | 'stripe';
}

export interface OrderFilters {
  type?: OrderType;
  status?: OrderStatus;
  page?: number;
}
