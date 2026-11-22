import { QueryClient } from '@tanstack/react-query';

import { normalizeTracking } from '@/lib/api/endpoints/tracking';
import type { Tracking } from '@/lib/api/types/tracking';
import { invalidateForPush, parsePushData, routeForPush } from '@/lib/notifications/routing';
import { trackingRefetchInterval } from '@/lib/query/hooks/useTracking';
import { queryKeys } from '@/lib/query/keys';
import {
  etaLabel,
  etaMinutes,
  isOrderInFlight,
  KNOWN_TRACKING_STATUSES,
  orderHasTracking,
  routeLine,
  trackingStatusLabel,
} from '@/lib/tracking/status';
import ar from '@/lib/i18n/locales/ar/tracking.json';
import bn from '@/lib/i18n/locales/bn/tracking.json';
import en from '@/lib/i18n/locales/en/tracking.json';

function trackingFixture(overrides: Partial<Tracking> = {}): Tracking {
  return normalizeTracking({
    subject: 'order',
    id: 42,
    status: 'on_the_way',
    order_status: 'dispatched',
    is_live: true,
    is_final: false,
    timeline: [
      { status: 'placed', at: '2026-11-22T10:00:00+00:00', note: null },
      { status: 'picked_up', at: '2026-11-22T10:30:00+00:00', note: null },
    ],
    rider: { id: null, name: 'Tariq', phone: '+966500000000', vehicle_type: 'bike', vehicle_model: 'Honda', plate: '•••234' },
    rider_location: { lat: 24.71, lng: 46.67, updated_at: '2026-11-22T10:31:00+00:00', is_stale: false },
    pickup: { lat: 24.7, lng: 46.6, label: 'Olaya kitchen' },
    destination: { lat: 24.72, lng: 46.68, label: 'Home' },
    route: { towards: 'destination', polyline: null, distance_m: 2400, duration_s: 420, eta: null, source: 'estimate' },
    stops_before: null,
    failed_reason: null,
    poll_seconds: 10,
    ...overrides,
  } as Record<string, unknown>);
}

describe('normalizeTracking', () => {
  it('coerces decimal strings and drops junk', () => {
    const t = normalizeTracking({
      subject: 'delivery',
      id: '7',
      status: 'out_for_delivery',
      timeline: [{ status: 'scheduled', at: null }, { nope: true }],
      rider_location: { lat: '24.5', lng: '46.1', is_stale: 1 },
      pickup: { lat: null, lng: 46 },
      poll_seconds: 0,
    });
    expect(t.subject).toBe('delivery');
    expect(t.id).toBe(7);
    expect(t.timeline).toEqual([{ status: 'scheduled', at: null, note: null }]);
    expect(t.rider_location).toEqual({ lat: 24.5, lng: 46.1, updated_at: null, is_stale: true });
    expect(t.pickup).toBeNull();
    expect(t.poll_seconds).toBeNull();
    expect(t.rider).toBeNull();
  });
});

describe('trackingRefetchInterval', () => {
  it('polls at poll_seconds only while visible', () => {
    const live = trackingFixture({ poll_seconds: 10 });
    expect(trackingRefetchInterval(live, true)).toBe(10_000);
    expect(trackingRefetchInterval(live, false)).toBe(false);
  });

  it('stops when the server sends null, or before the first read', () => {
    expect(trackingRefetchInterval(trackingFixture({ poll_seconds: null }), true)).toBe(false);
    expect(trackingRefetchInterval(undefined, true)).toBe(false);
  });
});

describe('ETA', () => {
  const now = Date.parse('2026-11-22T10:00:00Z');

  it('prefers route.eta, falls back to duration_s', () => {
    const route = trackingFixture().route!;
    expect(etaMinutes({ ...route, eta: '2026-11-22T10:06:30Z' }, now)).toBe(7);
    expect(etaMinutes({ ...route, eta: null, duration_s: 420 }, now)).toBe(7);
    expect(etaMinutes(null, now)).toBeNull();
  });

  it('words it for the customer', () => {
    const route = trackingFixture().route!;
    expect(etaLabel({ ...route, eta: '2026-11-22T10:07:00Z' }, now)).toBe('Arriving in 7 min');
    expect(etaLabel({ ...route, eta: '2026-11-22T10:00:30Z' }, now)).toBe('Arriving any minute');
    expect(etaLabel({ ...route, towards: 'pickup', eta: '2026-11-22T10:03:00Z' }, now)).toBe(
      'Reaches the kitchen in 3 min',
    );
  });
});

describe('routeLine', () => {
  it('decodes the polyline when there is one', () => {
    const t = trackingFixture({
      route: { ...trackingFixture().route!, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
    });
    expect(routeLine(t)).toHaveLength(3);
  });

  it('draws a straight rider → target line without one', () => {
    const t = trackingFixture();
    expect(routeLine(t)).toEqual([
      { latitude: 24.71, longitude: 46.67 },
      { latitude: 24.72, longitude: 46.68 },
    ]);
    const toKitchen = trackingFixture({ route: { ...t.route!, towards: 'pickup' } });
    expect(routeLine(toKitchen)[1]).toEqual({ latitude: 24.7, longitude: 46.6 });
  });

  it('draws nothing without a rider position', () => {
    expect(routeLine(trackingFixture({ rider_location: null }))).toEqual([]);
  });
});

describe('order helpers', () => {
  it('knows which orders are in flight', () => {
    expect(isOrderInFlight({ status: 'dispatched', delivery_status: 'on_the_way' })).toBe(true);
    expect(isOrderInFlight({ status: 'confirmed', delivery_status: 'searching_rider' })).toBe(true);
    expect(isOrderInFlight({ status: 'delivered', delivery_status: 'delivered' })).toBe(false);
    expect(isOrderInFlight({ status: 'pending', delivery_status: null })).toBe(false);
  });

  it('tracks instant orders only', () => {
    expect(orderHasTracking({ type: 'instant', status: 'confirmed', delivery_status: 'assigned' })).toBe(true);
    expect(orderHasTracking({ type: 'extra', status: 'confirmed', delivery_status: null })).toBe(false);
  });
});

describe('status labels', () => {
  it('has a label for every contract status in en, bn and ar', () => {
    for (const locale of [en, bn, ar]) {
      for (const status of KNOWN_TRACKING_STATUSES) {
        expect((locale.status as Record<string, string>)[status]).toEqual(expect.any(String));
      }
    }
  });

  it('falls back to a generic label for an unknown status', () => {
    expect(trackingStatusLabel('on_the_way')).toBe('On the way to you');
    expect(trackingStatusLabel('teleported')).toBe('Update');
  });
});

describe('push routing', () => {
  it('parses customer pushes and ignores everything else', () => {
    expect(parsePushData({ type: 'order.status', order_id: '12', status: 'picked_up' })).toEqual({
      type: 'order.status',
      order_id: '12',
      status: 'picked_up',
    });
    expect(parsePushData({ type: 'delivery.status', delivery_id: 5 })).toEqual({
      type: 'delivery.status',
      delivery_id: '5',
      status: undefined,
    });
    expect(parsePushData({ type: 'offer.new', order_id: '1' })).toBeNull();
    expect(parsePushData({ type: 'order.status', order_id: '../x' })).toBeNull();
    expect(parsePushData(undefined)).toBeNull();
  });

  it('opens the right screen', () => {
    expect(routeForPush({ type: 'order.status', order_id: '12' })).toEqual({
      pathname: '/orders/[id]',
      params: { id: '12' },
    });
    expect(routeForPush({ type: 'delivery.status', delivery_id: '5' })).toEqual({
      pathname: '/deliveries/[id]',
      params: { id: '5' },
    });
  });

  it('invalidates the order, the list and its tracking', () => {
    const client = new QueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    invalidateForPush(client, { type: 'order.status', order_id: '12' });
    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([
      queryKeys.orders.detail('12'),
      queryKeys.orders.list(),
      queryKeys.orders.tracking('12'),
    ]);
  });

  it('invalidates the delivery, the deliveries list and its tracking', () => {
    const client = new QueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    invalidateForPush(client, { type: 'delivery.status', delivery_id: '5' });
    const keys = spy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([queryKeys.menu.detail('5'), ['menu', 'deliveries'], queryKeys.menu.tracking('5')]);
  });
});
