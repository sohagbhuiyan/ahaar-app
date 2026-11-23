/**
 * Live tracking — `GET /orders/{id}/tracking` and `GET /deliveries/{id}/tracking`.
 *
 * Mirrors `App\Services\Delivery\Tracking` (see the backend's
 * `docs/delivery-api.md`, "Tracking payload"). The server enforces every
 * privacy rule: the rider's position and phone only appear while the delivery
 * is live, and the plate arrives already masked ("•••234").
 */

/**
 * Every step a timeline row (or the payload's `status`) can carry.
 *
 * Instant orders: `placed`, `confirmed`, then the delivery leg
 * (`searching_rider` → `assigned` → `accepted` → `heading_to_pickup` →
 * `picked_up` → `on_the_way` → `delivered`, or `failed` / `cancelled`).
 * A pending order reads `awaiting_payment`. The kitchen runs in parallel
 * (`prep_status`) and adds the timeline steps `preparing` / `ready_for_pickup`.
 *
 * Subscription meals: `scheduled` → `locked` → `packed` → `out_for_delivery`
 * → `delivered` | `failed_attempt`, plus the event-only `rider_assigned`,
 * `loaded`, `next_stop`, `rescheduled`, and `paused` / `skipped` / `returned`.
 * Route housekeeping (`moved`, `removed_from_run`, `label_reprinted`,
 * `reordered`) is staff-only: `customerTimeline` drops it.
 *
 * Widened to `string`: a step the app doesn't know yet still renders (with a
 * generic label) instead of breaking the screen.
 */
export type TrackingStatus =
  | 'placed'
  | 'confirmed'
  | 'awaiting_payment'
  | 'searching_rider'
  | 'assigned'
  | 'accepted'
  | 'heading_to_pickup'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'dispatched'
  | 'pending'
  | 'scheduled'
  | 'locked'
  | 'packed'
  | 'rider_assigned'
  | 'out_for_delivery'
  | 'loaded'
  | 'next_stop'
  | 'rescheduled'
  | 'failed_attempt'
  | 'returned'
  | 'paused'
  | 'skipped'
  | (string & {});

export interface TrackingTimelineStep {
  status: TrackingStatus;
  /** ISO-8601; null when the server has no timestamp for the step. */
  at: string | null;
  note: string | null;
}

export interface TrackingRider {
  /** First name only for customers. */
  name: string | null;
  /** Only while the delivery is live; otherwise null. */
  phone: string | null;
  vehicle_type: 'bike' | 'car' | (string & {}) | null;
  vehicle_model: string | null;
  /** Already masked by the server, e.g. "•••234". */
  plate: string | null;
}

export interface TrackingRiderLocation {
  lat: number;
  lng: number;
  updated_at: string | null;
  /** The rider's last fix is older than the server's freshness window. */
  is_stale: boolean;
}

export interface TrackingPoint {
  lat: number;
  lng: number;
  label: string | null;
}

export interface TrackingRoute {
  towards: 'pickup' | 'destination';
  /** Google encoded polyline; null → draw a straight line rider → target. */
  polyline: string | null;
  distance_m: number | null;
  duration_s: number | null;
  /** ISO-8601 arrival estimate at `towards`. */
  eta: string | null;
  source: 'google' | 'estimate' | (string & {});
}

export interface Tracking {
  subject: 'order' | 'delivery';
  id: number;
  status: TrackingStatus;
  /** The order's money/lifecycle status; null for subscription deliveries. */
  order_status: string | null;
  /** The rider is moving and visible to this customer. */
  is_live: boolean;
  is_final: boolean;
  /** Orders only: the kitchen side (`null → preparing → ready`); never blocks the rider. */
  prep_status?: 'preparing' | 'ready' | null;
  /** Deliveries only: the box has been scanned into the driver's car. */
  is_loaded?: boolean;
  /** Oldest first. */
  timeline: TrackingTimelineStep[];
  rider: TrackingRider | null;
  rider_location: TrackingRiderLocation | null;
  /** The kitchen (branch). */
  pickup: TrackingPoint | null;
  /** The customer's address. */
  destination: TrackingPoint | null;
  route: TrackingRoute | null;
  /** Car routes: stops still ahead of this one. */
  stops_before: number | null;
  failed_reason: string | null;
  /** Poll at this interval while set; stop when null. */
  poll_seconds: number | null;
}

/** `data` block of a customer push (FCM data values are always strings). */
export type PushData =
  | { type: 'order.status'; order_id: string; status?: string }
  | { type: 'delivery.status'; delivery_id: string; status?: string };
