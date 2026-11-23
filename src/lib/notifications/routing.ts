/**
 * What a customer push means for the app: which caches go stale, and which
 * screen a tap opens. Pure, so it's tested without a device.
 *
 *   order.status    { order_id, status }     → order + list + tracking; tap → orders/[id]
 *   delivery.status { delivery_id, status }  → delivery + list + tracking; tap → deliveries/[id]
 *
 * `status` is informational only and never changes the routing: for orders a
 * delivery_status or the kitchen's `preparing` / `ready_for_pickup`; for
 * deliveries `rider_assigned`, `out_for_delivery`, `next_stop`, `delivered`,
 * `failed_attempt`. An unknown status is still a valid push.
 *
 * Any other `type` (or a malformed one) is ignored: the API may add types
 * this build doesn't know.
 */
import type { QueryClient } from '@tanstack/react-query';

import type { AppNotification } from '../api/types/notification';
import type { PushData } from '../api/types/tracking';
import { queryKeys } from '../query/keys';

const isId = (value: unknown): value is string | number =>
  (typeof value === 'string' && /^\d+$/.test(value)) ||
  (typeof value === 'number' && Number.isInteger(value) && value > 0);

/** FCM data values arrive as strings; tolerate numbers too. */
export function parsePushData(data: unknown): PushData | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const status = typeof d.status === 'string' ? d.status : undefined;

  if (d.type === 'order.status' && isId(d.order_id)) {
    return { type: 'order.status', order_id: String(d.order_id), status };
  }
  if (d.type === 'delivery.status' && isId(d.delivery_id)) {
    return { type: 'delivery.status', delivery_id: String(d.delivery_id), status };
  }
  return null;
}

/**
 * A push that carries no title or body is a silent sync signal (the API never
 * stores those in the inbox either): refresh, but don't ring or show it.
 */
export function isSilentPush(content: { title?: string | null; body?: string | null }): boolean {
  return !content.title && !content.body;
}

/** The inbox and the bell's count — every visible push adds a row. */
export function invalidateInbox(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
}

/**
 * An inbox row as the push it was, so a tap on it does what a tap on the push
 * did. Keyed on the ids rather than only `type`: an older row, or a type this
 * build doesn't know, still opens the order or meal it names.
 */
export function pushDataForNotification(notification: AppNotification): PushData | null {
  const status = notification.status ?? undefined;
  if (notification.type === 'delivery.status' && notification.delivery_id) {
    return { type: 'delivery.status', delivery_id: String(notification.delivery_id), status };
  }
  if (notification.order_id) {
    return { type: 'order.status', order_id: String(notification.order_id), status };
  }
  if (notification.delivery_id) {
    return { type: 'delivery.status', delivery_id: String(notification.delivery_id), status };
  }
  return null;
}

/** "Refetch now" — the push is the server telling us something moved. */
export function invalidateForPush(queryClient: QueryClient, data: PushData): void {
  if (data.type === 'order.status') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(data.order_id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.tracking(data.order_id) });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.menu.detail(data.delivery_id) });
  // The day-by-day list (`['menu', 'deliveries', filters]`) — every filter.
  void queryClient.invalidateQueries({ queryKey: ['menu', 'deliveries'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.menu.tracking(data.delivery_id) });
}

export type PushRoute =
  | { pathname: '/orders/[id]'; params: { id: string } }
  | { pathname: '/deliveries/[id]'; params: { id: string } };

export function routeForPush(data: PushData): PushRoute {
  return data.type === 'order.status'
    ? { pathname: '/orders/[id]', params: { id: data.order_id } }
    : { pathname: '/deliveries/[id]', params: { id: data.delivery_id } };
}
