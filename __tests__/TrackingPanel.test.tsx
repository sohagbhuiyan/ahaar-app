import { render, screen } from '@testing-library/react-native';

import { TrackingPanel } from '@/components/shared/TrackingPanel';
import { normalizeTracking } from '@/lib/api/endpoints/tracking';
import type { Tracking } from '@/lib/api/types/tracking';

function live(overrides: Record<string, unknown> = {}): Tracking {
  return normalizeTracking({
    subject: 'order',
    id: 42,
    status: 'on_the_way',
    order_status: 'dispatched',
    is_live: true,
    is_final: false,
    timeline: [
      { status: 'placed', at: '2026-11-22T10:00:00+00:00' },
      { status: 'confirmed', at: '2026-11-22T10:01:00+00:00' },
      { status: 'on_the_way', at: '2026-11-22T10:30:00+00:00' },
    ],
    rider: { name: 'Tariq', phone: '+966500000000', vehicle_type: 'bike', vehicle_model: 'Honda', plate: '•••234' },
    rider_location: { lat: 24.71, lng: 46.67, is_stale: false },
    pickup: { lat: 24.7, lng: 46.6, label: 'Olaya kitchen' },
    destination: { lat: 24.72, lng: 46.68, label: 'Home' },
    route: {
      towards: 'destination',
      polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
      distance_m: 2400,
      duration_s: 600,
      eta: new Date(Date.now() + 9.5 * 60_000).toISOString(),
      source: 'google',
    },
    stops_before: null,
    poll_seconds: 10,
    ...overrides,
  });
}

describe('TrackingPanel', () => {
  it('shows the live status, ETA, rider, map and timeline', async () => {
    await render(<TrackingPanel tracking={live()} isLoading={false} isError={false} />);

    expect(screen.getAllByText('On the way to you').length).toBeGreaterThan(0);
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Arriving in 10 min')).toBeTruthy();
    expect(screen.getByText('Tariq')).toBeTruthy();
    expect(screen.getByText(/Plate •••234/)).toBeTruthy();
    expect(screen.getByText('Call')).toBeTruthy();
    // Timeline, oldest first.
    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.getByText('Order confirmed')).toBeTruthy();
    // Map with the decoded route and three pins.
    expect(screen.getByTestId('map-polyline').props.coordinates).toHaveLength(3);
    expect(screen.getAllByTestId('map-marker')).toHaveLength(3);
  });

  it('hides the call button without a phone and the rider pin without a location', async () => {
    await render(
      <TrackingPanel
        tracking={live({
          is_live: false,
          status: 'accepted',
          rider: { name: 'Tariq', phone: null, vehicle_type: 'bike' },
          rider_location: null,
          route: null,
        })}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.queryByText('Call')).toBeNull();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByTestId('map-polyline')).toBeNull();
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2);
  });

  it('tells a car-route customer how many stops are ahead', async () => {
    await render(
      <TrackingPanel
        tracking={live({
          subject: 'delivery',
          status: 'out_for_delivery',
          is_live: false,
          rider: { name: 'Sami', vehicle_type: 'car' },
          rider_location: null,
          route: null,
          stops_before: 2,
        })}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText('2 stops before you')).toBeTruthy();
    expect(screen.getByText('Your driver')).toBeTruthy();
  });

  it('says "you\'re next" when no stops are ahead', async () => {
    await render(
      <TrackingPanel
        tracking={live({ subject: 'delivery', status: 'out_for_delivery', stops_before: 0 })}
        isLoading={false}
        isError={false}
      />,
    );
    // Once in the stops line; the timeline has no `next_stop` step here.
    expect(screen.getByText("You're the next stop")).toBeTruthy();
  });

  it('drops the map once the delivery is final', async () => {
    await render(
      <TrackingPanel
        tracking={live({ status: 'delivered', is_final: true, is_live: false, poll_seconds: null })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.queryByTestId('map-view')).toBeNull();
    expect(screen.queryByText(/Arriving/)).toBeNull();
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
  });

  it('shows the kitchen chip before pickup, and not after', async () => {
    const { rerender } = await render(
      <TrackingPanel
        tracking={live({ status: 'accepted', order_status: 'confirmed', is_live: false, prep_status: 'preparing' })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByTestId('tracking-kitchen')).toBeTruthy();
    expect(screen.getByText('Kitchen is preparing')).toBeTruthy();

    await rerender(
      <TrackingPanel
        tracking={live({ status: 'on_the_way', prep_status: 'ready' })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.queryByTestId('tracking-kitchen')).toBeNull();
  });

  it('says "In the car" for a loaded box and hides staff-only timeline steps', async () => {
    await render(
      <TrackingPanel
        tracking={live({
          subject: 'delivery',
          status: 'packed',
          order_status: null,
          is_live: false,
          is_loaded: true,
          rider_location: null,
          route: null,
          timeline: [
            { status: 'packed', at: '2026-11-22T09:00:00+00:00' },
            { status: 'label_reprinted', at: '2026-11-22T09:05:00+00:00' },
            { status: 'moved', at: '2026-11-22T09:06:00+00:00' },
            { status: 'loaded', at: '2026-11-22T09:10:00+00:00' },
          ],
        })}
        isLoading={false}
        isError={false}
      />,
    );
    expect(screen.getByText('In the car')).toBeTruthy();
    expect(screen.getByText('Loaded into the car')).toBeTruthy();
    // Unknown statuses render as the generic "Update"; staff steps must not render at all.
    expect(screen.queryByText('Update')).toBeNull();
  });

  it('shows a skeleton while loading and one quiet line on error', async () => {
    const { rerender } = await render(
      <TrackingPanel tracking={undefined} isLoading isError={false} />,
    );
    expect(screen.getByTestId('tracking-loading')).toBeTruthy();

    await rerender(<TrackingPanel tracking={undefined} isLoading={false} isError />);
    expect(screen.getByText("Live tracking isn't available right now.")).toBeTruthy();
  });
});
