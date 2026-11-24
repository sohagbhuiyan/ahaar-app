/**
 * The customer's server cart — shared with the website (`/cart`).
 *
 * The app keeps its basket on the device (`useInstantOrderStore`: instant UI,
 * survives being offline) and uses the server cart for what only the server
 * can do: price it, say what is no longer on sale, and check it out as ONE
 * order. `replaceCart` sends the basket and gets the priced cart back;
 * `checkoutCart` then buys exactly that, refusing (409) if a price moved.
 */
import { apiClient, unwrap } from '../client';
import { normalizeOrder } from '../normalize';
import type { ApiEnvelope } from '../types/common';
import type { Order } from '../types/order';

type Raw = Record<string, unknown>;

export interface ServerCartLine {
  id: number;
  kind: 'item' | 'package';
  menu_item_id: number | null;
  package_id: number | null;
  name: string;
  image_url: string | null;
  /** A box's dish count; null for a dish. */
  dish_count: number | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  is_available: boolean;
}

export interface ServerCart {
  items: ServerCartLine[];
  item_count: number;
  subtotal: number;
  delivery_fee: number;
  total: number;
  has_unavailable: boolean;
  /** COD is the only payment; a rider carries at most this. null = no ceiling. */
  cash_limit: number | null;
  /** Too big for one cash-on-delivery order — checkout would refuse it. */
  exceeds_cash_limit: boolean;
}

export interface CartLinesBody {
  items: { menu_item_id: number; quantity: number }[];
  packages: { package_id: number; quantity: number }[];
}

export interface CheckoutCartPayload {
  delivery_date: string;
  slot_id: number;
  address_id: number | null;
  phone?: string;
  notes?: string;
  /** The total the customer was shown; a moved price answers 409. */
  expected_total: number;
  gateway?: string;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

export function normalizeCart(raw: Raw | undefined | null): ServerCart {
  const items = ((raw?.items as Raw[] | undefined) ?? []).map((l) => ({
    id: Number(l.id),
    kind: l.kind === 'package' ? ('package' as const) : ('item' as const),
    menu_item_id: (l.menu_item_id as number | null) ?? null,
    package_id: (l.package_id as number | null) ?? null,
    name: String(l.name ?? ''),
    image_url: (l.image_url as string | null) ?? null,
    dish_count: l.dish_count != null ? Number(l.dish_count) : null,
    unit_price: num(l.unit_price),
    quantity: Number(l.quantity ?? 0),
    line_total: num(l.line_total),
    is_available: Boolean(l.is_available),
  }));
  return {
    items,
    item_count: Number(raw?.item_count ?? 0),
    subtotal: num(raw?.subtotal),
    delivery_fee: num(raw?.delivery_fee),
    total: num(raw?.total),
    has_unavailable: Boolean(raw?.has_unavailable),
    cash_limit: raw?.cash_limit != null ? num(raw.cash_limit) : null,
    exceeds_cash_limit: Boolean(raw?.exceeds_cash_limit),
  };
}

/** GET /cart — the account cart as the server has it (maybe edited on the website). */
export async function getCart(): Promise<ServerCart> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>('/cart');
  return normalizeCart(unwrap(data));
}

/** PUT /cart — make the server cart exactly this basket; returns it priced. */
export async function replaceCart(body: CartLinesBody): Promise<ServerCart> {
  const { data } = await apiClient.put<ApiEnvelope<Raw>>('/cart', body);
  return normalizeCart(unwrap(data));
}

/** POST /cart/merge — fold the device basket into the account cart (sign-in). */
export async function mergeCart(body: CartLinesBody): Promise<ServerCart> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/cart/merge', body);
  return normalizeCart(unwrap(data));
}

/** POST /cart/checkout — the whole cart as ONE order (nested like every create). */
export async function checkoutCart(payload: CheckoutCartPayload, idempotencyKey: string): Promise<Order> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/cart/checkout', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  const body = unwrap(data);
  return normalizeOrder(((body.order as Raw | undefined) ?? body) as Raw);
}
