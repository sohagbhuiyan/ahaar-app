/**
 * The notification inbox (the bell). Shared by every signed-in role on the API.
 *
 *   GET  /notifications?per_page=20&page=n  → { data, meta: { …, unread_count } }
 *   GET  /notifications/unread-count        → { data: { unread_count } }
 *   POST /notifications/{id}/read           → { data: notification }
 *   POST /notifications/read-all            → { data: { unread_count: 0 } }
 *
 * Contract: the backend's `docs/delivery-api.md`, "Shared".
 */
import { apiClient, unwrap } from '../client';
import { normalizePaginated } from '../normalize';
import type { ApiEnvelope, PageParams, PaginationMeta } from '../types/common';
import type { AppNotification, NotificationPage } from '../types/notification';

type Raw = Record<string, unknown>;
type PageBody = { data?: Raw[]; meta?: PaginationMeta & { unread_count?: unknown } };

export const NOTIFICATIONS_PER_PAGE = 20;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

function id(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isInteger(n) && n > 0
    ? n
    : null;
}

function count(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function normalizeNotification(raw: Raw): AppNotification {
  return {
    id: String(raw.id ?? ''),
    type: str(raw.type),
    title: str(raw.title),
    body: str(raw.body),
    order_id: id(raw.order_id),
    delivery_id: id(raw.delivery_id),
    run_id: id(raw.run_id),
    status: str(raw.status),
    read_at: str(raw.read_at),
    created_at: str(raw.created_at),
  };
}

/** GET /notifications — newest first. */
export async function getNotifications(params: PageParams = {}): Promise<NotificationPage> {
  const { data } = await apiClient.get<PageBody>('/notifications', {
    params: { page: params.page, per_page: NOTIFICATIONS_PER_PAGE },
  });
  const page = normalizePaginated(data, normalizeNotification);
  return { ...page, unread_count: count(data?.meta?.unread_count) };
}

/** GET /notifications/unread-count */
export async function getUnreadNotificationCount(): Promise<number> {
  const { data } = await apiClient.get<ApiEnvelope<Raw> | Raw>('/notifications/unread-count');
  // `ok()` wraps in `{ data }`; tolerate a bare body too.
  const body = (data && typeof data === 'object' && 'data' in data
    ? unwrap(data as ApiEnvelope<Raw>)
    : data) as Raw | null;
  return count(body?.unread_count);
}

/** POST /notifications/{id}/read */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiClient.post(`/notifications/${notificationId}/read`);
}

/** POST /notifications/read-all */
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post('/notifications/read-all');
}
