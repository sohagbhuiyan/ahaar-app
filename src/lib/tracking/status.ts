/**
 * Reading a tracking payload for display: labels, tones, ETA and the line to
 * draw on the map. Pure functions, so they're tested without a screen.
 */
import type { BadgeVariant } from '@/components/ui';

import type { Order } from '../api/types/order';
import type { Tracking, TrackingStatus } from '../api/types/tracking';
import i18n from '../i18n';
import { decodePolyline, type LatLng } from './polyline';

/** Every status the contract can send, so a missing translation shows up in review. */
export const KNOWN_TRACKING_STATUSES = [
  'placed',
  'confirmed',
  'awaiting_payment',
  'pending',
  'searching_rider',
  'assigned',
  'accepted',
  'heading_to_pickup',
  'preparing',
  'ready_for_pickup',
  'picked_up',
  'on_the_way',
  'dispatched',
  'delivered',
  'failed',
  'cancelled',
  'scheduled',
  'locked',
  'packed',
  'rider_assigned',
  'loaded',
  'out_for_delivery',
  'next_stop',
  'rescheduled',
  'failed_attempt',
  'returned',
  'paused',
  'skipped',
] as const;

const KNOWN = new Set<string>(KNOWN_TRACKING_STATUSES);

/**
 * Route housekeeping the backend records on a delivery's timeline for staff.
 * A customer never sees these (same list as the web app).
 */
export const STAFF_ONLY_TIMELINE_STEPS: readonly string[] = [
  'moved',
  'removed_from_run',
  'label_reprinted',
  'reordered',
];

const STAFF_ONLY = new Set<string>(STAFF_ONLY_TIMELINE_STEPS);

/** The timeline as the customer sees it: staff-only steps dropped, order kept. */
export function customerTimeline<T extends { status: TrackingStatus }>(steps: readonly T[]): T[] {
  return steps.filter((step) => !STAFF_ONLY.has(step.status));
}

/** An instant order's delivery leg before the rider has collected the food. */
const BEFORE_PICKUP = new Set<string>(['searching_rider', 'assigned', 'accepted', 'heading_to_pickup']);
/** The rider has the food (or it's over): the kitchen has nothing left to say. */
const AFTER_PICKUP = new Set<string>([
  'picked_up',
  'on_the_way',
  'dispatched',
  'delivered',
  'failed',
  'cancelled',
]);

export type KitchenStep = 'preparing' | 'ready' | 'loaded';

/**
 * The kitchen-side chip beside the status (mirrors the web's `kitchenStep`):
 *  - instant order not yet picked up → `prep_status` ("Kitchen is preparing" /
 *    "Packed, waiting for the rider");
 *  - subscription box still `packed` but scanned into the car → `loaded`
 *    ("In the car").
 * Null otherwise, and always null after pickup or once final.
 */
export function kitchenStep(
  tracking: Pick<Tracking, 'subject' | 'status' | 'order_status' | 'is_final' | 'prep_status' | 'is_loaded'>,
): KitchenStep | null {
  if (tracking.is_final) return null;
  if (tracking.subject === 'order') {
    if (!tracking.prep_status) return null;
    if (AFTER_PICKUP.has(tracking.status)) return null;
    const beforePickup =
      BEFORE_PICKUP.has(tracking.status) ||
      tracking.status === 'confirmed' ||
      tracking.order_status === 'confirmed';
    return beforePickup ? tracking.prep_status : null;
  }
  return tracking.is_loaded === true && tracking.status === 'packed' ? 'loaded' : null;
}

/** Localized label for any status; unknown ones read as a generic "Update". */
export function trackingStatusLabel(status: TrackingStatus | null | undefined): string {
  if (status && KNOWN.has(status)) return i18n.t(`tracking.status.${status}`);
  return i18n.t('tracking.status.unknown');
}

/** One-line explanation under the hero headline, or null. */
export function trackingStatusHint(status: TrackingStatus | null | undefined): string | null {
  if (!status || !KNOWN.has(status)) return null;
  const key = `tracking.hint.${status}`;
  return i18n.exists(key) ? i18n.t(key) : null;
}

export function trackingStatusTone(status: TrackingStatus | null | undefined): BadgeVariant {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'failed':
    case 'failed_attempt':
    case 'cancelled':
    case 'returned':
      return 'danger';
    case 'awaiting_payment':
    case 'pending':
    case 'paused':
    case 'skipped':
      return 'warning';
    case 'scheduled':
      return 'muted';
    default:
      return 'brand';
  }
}

/** Minutes until `route.eta` (or `duration_s` without one), rounded up; null when unknown. */
export function etaMinutes(route: Tracking['route'], now: number = Date.now()): number | null {
  if (!route) return null;
  if (route.eta) {
    const at = Date.parse(route.eta);
    if (Number.isFinite(at)) return Math.max(0, Math.ceil((at - now) / 60_000));
  }
  if (route.duration_s !== null && route.duration_s >= 0) return Math.ceil(route.duration_s / 60);
  return null;
}

/**
 * The hero's ETA line: "Arriving in 7 min", "Reaches the kitchen in 3 min",
 * "Arriving any minute". Null when there's no route to time.
 */
export function etaLabel(route: Tracking['route'], now: number = Date.now()): string | null {
  const minutes = etaMinutes(route, now);
  if (minutes === null || !route) return null;
  if (route.towards === 'pickup') {
    return i18n.t('tracking.eta.toKitchen', { count: Math.max(1, minutes) });
  }
  if (minutes <= 1) return i18n.t('tracking.eta.soon');
  return i18n.t('tracking.eta.minutes', { count: minutes });
}

/** The line to draw: the decoded route, else a straight rider → target line. */
export function routeLine(tracking: Tracking): LatLng[] {
  const { route, rider_location: rider } = tracking;
  if (!rider) return [];

  const decoded = decodePolyline(route?.polyline);
  if (decoded.length >= 2) return decoded;

  const target =
    route?.towards === 'pickup'
      ? tracking.pickup
      : (tracking.destination ?? (route ? null : tracking.pickup));
  if (!target) return [];
  return [
    { latitude: rider.lat, longitude: rider.lng },
    { latitude: target.lat, longitude: target.lng },
  ];
}

/** Every point the map should fit in view. */
export function mapPoints(tracking: Tracking): LatLng[] {
  const points: LatLng[] = [];
  for (const p of [tracking.rider_location, tracking.pickup, tracking.destination]) {
    if (p) points.push({ latitude: p.lat, longitude: p.lng });
  }
  return points;
}

/** The map is worth drawing: at least one place to show. */
export const hasMap = (tracking: Tracking) => mapPoints(tracking).length > 0;

const FINAL_DELIVERY = new Set(['delivered', 'failed', 'cancelled']);

/**
 * An instant order whose delivery leg is under way — the orders list shows a
 * live pill for these and the detail screen shows tracking.
 */
export function isOrderInFlight(order: Pick<Order, 'delivery_status' | 'status'>): boolean {
  return (
    order.delivery_status !== null &&
    !FINAL_DELIVERY.has(order.delivery_status) &&
    order.status !== 'cancelled' &&
    order.status !== 'delivered'
  );
}

/** The order has a delivery leg to show at all (in flight or finished). */
export function orderHasTracking(order: Pick<Order, 'type' | 'delivery_status' | 'status'>): boolean {
  return order.type === 'instant' && (order.delivery_status !== null || order.status === 'pending');
}
