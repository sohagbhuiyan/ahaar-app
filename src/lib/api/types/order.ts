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

/** `App\Http\Resources\Customer\OrderItemResource` */
export interface OrderItem {
  id: number;
  menu_item_id: number;
  menu_item?: { id: number; name: string; slug: string };
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

/** POST /orders/extra — attaches to an existing delivery, before its cutoff. */
export interface CreateExtraOrderPayload {
  daily_delivery_id: number;
  items: OrderLineInput[];
  gateway?: 'test' | 'mollie' | 'stripe';
}

/** POST /orders/guest — mirrors the delivery's items ×`guests_count` (1-10). */
export interface CreateGuestOrderPayload {
  daily_delivery_id: number;
  guests_count: number;
  gateway?: 'test' | 'mollie' | 'stripe';
}

/** POST /orders/instant — standalone; its own date, slot and address. */
export interface CreateInstantOrderPayload {
  /** YYYY-MM-DD */
  delivery_date: string;
  slot_id: number;
  address_id?: number | null;
  items: OrderLineInput[];
  gateway?: 'test' | 'mollie' | 'stripe';
}

export interface OrderFilters {
  type?: OrderType;
  status?: OrderStatus;
  page?: number;
}
