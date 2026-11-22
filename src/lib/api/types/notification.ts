/**
 * The in-app inbox behind the bell — `GET /notifications`.
 *
 * The same messages that went out as pushes (silent ones excepted), so nothing
 * is lost when a push is dismissed or never arrives. Shape: the backend's
 * `NotificationController::present()`.
 */
import type { Paginated } from './common';

export interface AppNotification {
  /** A UUID (Laravel database notification). */
  id: string;
  /** The push `type` (`order.status`, `delivery.status`, …); null on odd rows. */
  type: string | null;
  title: string | null;
  body: string | null;
  order_id: number | null;
  delivery_id: number | null;
  run_id: number | null;
  /** The push's `status` (or `reason`). */
  status: string | null;
  /** ISO-8601; null while unread. */
  read_at: string | null;
  created_at: string | null;
}

/** One page of the inbox, plus the account-wide unread count. */
export interface NotificationPage extends Paginated<AppNotification> {
  unread_count: number;
}
