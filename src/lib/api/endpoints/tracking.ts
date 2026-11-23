/**
 * Live tracking and push registration.
 *
 *   GET    /orders/{id}/tracking      instant orders (bike riders)
 *   GET    /deliveries/{id}/tracking  subscription meals (car routes)
 *   POST   /device-tokens             register this device's FCM token
 *   DELETE /device-tokens             unregister it (sign-out, best effort)
 *
 * Shape: the backend's `docs/delivery-api.md`, "Tracking payload".
 */
import { apiClient, unwrap } from '../client';
import type { ApiEnvelope } from '../types/common';
import type {
  Tracking,
  TrackingPoint,
  TrackingRider,
  TrackingRiderLocation,
  TrackingRoute,
  TrackingTimelineStep,
} from '../types/tracking';

type Raw = Record<string, unknown>;

/** A finite number, or null. Coordinates may arrive as decimal strings. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

function point(raw: unknown): TrackingPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const lat = num(r.lat);
  const lng = num(r.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng, label: str(r.label) };
}

function riderLocation(raw: unknown): TrackingRiderLocation | null {
  const p = point(raw);
  if (!p) return null;
  const r = raw as Raw;
  return { lat: p.lat, lng: p.lng, updated_at: str(r.updated_at), is_stale: Boolean(r.is_stale) };
}

function rider(raw: unknown): TrackingRider | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  return {
    name: str(r.name),
    phone: str(r.phone),
    vehicle_type: str(r.vehicle_type),
    vehicle_model: str(r.vehicle_model),
    plate: str(r.plate),
  };
}

function route(raw: unknown): TrackingRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  return {
    towards: r.towards === 'pickup' ? 'pickup' : 'destination',
    polyline: str(r.polyline),
    distance_m: num(r.distance_m),
    duration_s: num(r.duration_s),
    eta: str(r.eta),
    source: (str(r.source) ?? 'estimate') as TrackingRoute['source'],
  };
}

export function normalizeTracking(raw: Raw): Tracking {
  const timeline = Array.isArray(raw.timeline) ? (raw.timeline as Raw[]) : [];
  const poll = num(raw.poll_seconds);
  return {
    subject: raw.subject === 'delivery' ? 'delivery' : 'order',
    id: Number(raw.id),
    status: (str(raw.status) ?? 'placed') as Tracking['status'],
    order_status: str(raw.order_status),
    is_live: Boolean(raw.is_live),
    is_final: Boolean(raw.is_final),
    prep_status: raw.prep_status === 'preparing' || raw.prep_status === 'ready' ? raw.prep_status : null,
    is_loaded: raw.is_loaded === true || raw.is_loaded === 1,
    timeline: timeline
      .filter((step) => typeof step?.status === 'string')
      .map(
        (step): TrackingTimelineStep => ({
          status: step.status as string,
          at: str(step.at),
          note: str(step.note),
        }),
      ),
    rider: rider(raw.rider),
    rider_location: riderLocation(raw.rider_location),
    pickup: point(raw.pickup),
    destination: point(raw.destination),
    route: route(raw.route),
    stops_before: num(raw.stops_before),
    failed_reason: str(raw.failed_reason),
    // A zero or negative interval would be a hot loop, not a poll.
    poll_seconds: poll !== null && poll > 0 ? poll : null,
  };
}

export async function getOrderTracking(id: number | string): Promise<Tracking> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/orders/${id}/tracking`);
  return normalizeTracking(unwrap(data));
}

export async function getDeliveryTracking(id: number | string): Promise<Tracking> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/deliveries/${id}/tracking`);
  return normalizeTracking(unwrap(data));
}

export interface DeviceTokenPayload {
  token: string;
  platform: 'android' | 'ios';
  app: 'customer';
}

/** POST /device-tokens → 201. Ties the token to the current session. */
export async function registerDeviceToken(payload: DeviceTokenPayload): Promise<void> {
  await apiClient.post('/device-tokens', payload);
}

/**
 * DELETE /device-tokens `{ token }` → 204.
 *
 * Only ever called while a session is ending, so a 401 here (the session was
 * already revoked) must not trigger the global sign-out handler again. Short
 * timeout: sign-out must not wait on it.
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiClient.delete('/device-tokens', {
    data: { token },
    timeout: 5_000,
    skipUnauthorizedHandler: true,
  });
}
