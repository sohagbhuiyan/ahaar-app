import { fireEvent, render, screen } from '@testing-library/react-native';

import DeliveriesScreen from '@/app/deliveries';
import { DeliveryCalendar } from '@/components/shared/DeliveryCalendar';
import type { Delivery, Subscription } from '@/lib/api/types/subscription';
import {
  addDays,
  buildDeliveryWeeks,
  defaultDeliveryDate,
  groupDeliveriesByDate,
  slotPeriod,
} from '@/lib/deliveries';
import { useUIStore } from '@/lib/store';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));

/** A plan meal. Far in the future, so "today" never lands inside the plan. */
function meal(
  id: number,
  date: string,
  dish: string,
  slot: { name: string; start: string } = { name: 'Lunch', start: '12:00:00' },
  overrides: Partial<Delivery> = {},
): Delivery {
  return {
    id,
    subscription_id: 9,
    delivery_date: date,
    slot_id: id,
    slot: {
      id,
      name: slot.name,
      slug: slot.name.toLowerCase(),
      start_time: slot.start,
      end_time: '14:00:00',
      cutoff_hours: 10,
    },
    delivery_address: null,
    status: 'scheduled',
    is_customized: false,
    cutoff_at: `${date}T02:00:00Z`,
    before_cutoff: true,
    items: [
      {
        id: id * 10,
        menu_item_id: id,
        menu_item: { id, name: dish, slug: dish.toLowerCase(), image_url: null },
        category_id: 1,
        quantity: 1,
        is_addon: false,
        is_free_addon: false,
        is_default: true,
        source: 'plan',
        package: null,
        swap_locked: false,
        swap_locked_at: null,
        was_swapped: false,
        swapped_from: null,
        can_swap: true,
        swap_blocked_reason: null,
        swap_blocked_message: null,
      },
    ],
    ...overrides,
  };
}

// 3 January 2030 is a Thursday.
const mockDeliveries: Delivery[] = [
  meal(1, '2030-01-03', 'Chicken Biryani'),
  meal(2, '2030-01-04', 'Grilled Fish'),
  meal(3, '2030-01-04', 'Masala Omelette', { name: 'Breakfast', start: '07:00:00' }),
];

const mockSubscription = {
  id: 9,
  plan: { name: 'Full Board' },
  slots: [],
  status: 'active',
  start_date: '2030-01-03',
  end_date: '2030-01-04',
} as unknown as Subscription;

jest.mock('@/lib/query/hooks', () => ({
  ...jest.requireActual('@/lib/query/hooks'),
  useIsSignedIn: () => true,
  useCurrentSubscription: () => ({ data: mockSubscription, isLoading: false }),
  useSubscriptionDeliveries: () => ({
    data: mockDeliveries,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('delivery calendar maths', () => {
  const tenDays = Array.from({ length: 10 }, (_, i) =>
    meal(i + 1, addDays('2030-01-03', i), `Dish ${i + 1}`),
  );

  it('lays the plan out in full weeks from its start date', () => {
    const weeks = buildDeliveryWeeks(groupDeliveriesByDate(tenDays), '2030-01-03');

    expect(weeks).toHaveLength(2);
    expect(weeks.map((w) => [w.from, w.to])).toEqual([
      ['2030-01-03', '2030-01-09'],
      ['2030-01-10', '2030-01-16'],
    ]);
    expect(weeks.every((w) => w.days.length === 7)).toBe(true);
    // Day 10 of the plan is the third day of week 2; the fourth is past the end.
    expect(weeks[1].days[2]).toMatchObject({ date: '2030-01-12', inPlan: true });
    expect(weeks[1].days[3]).toMatchObject({ date: '2030-01-13', inPlan: false });
  });

  it('orders a day by time, breakfast first', () => {
    const day = groupDeliveriesByDate(mockDeliveries).get('2030-01-04') ?? [];
    expect(day.map((d) => d.slot?.name)).toEqual(['Breakfast', 'Lunch']);
  });

  it('opens on today, else the next plan day, else the last', () => {
    const dates = ['2030-01-03', '2030-01-04', '2030-01-05'];
    expect(defaultDeliveryDate(dates, '2030-01-04')).toBe('2030-01-04');
    expect(defaultDeliveryDate(dates, '2029-12-01')).toBe('2030-01-03');
    expect(defaultDeliveryDate(dates, '2031-01-01')).toBe('2030-01-05');
    expect(defaultDeliveryDate([], '2030-01-01')).toBeNull();
  });

  it('names the time of day from the slot, falling back to its start time', () => {
    expect(slotPeriod({ id: 1, name: 'Breakfast', slug: 'b', start_time: '', end_time: '', cutoff_hours: 0 })).toBe('morning');
    expect(slotPeriod({ id: 2, name: 'Meal 2', slug: 'm2', start_time: '13:00:00', end_time: '', cutoff_hours: 0 })).toBe('midday');
    expect(slotPeriod({ id: 3, name: 'Meal 3', slug: 'm3', start_time: '19:30:00', end_time: '', cutoff_hours: 0 })).toBe('evening');
  });
});

describe('DeliveryCalendar', () => {
  const tenDays = Array.from({ length: 10 }, (_, i) =>
    meal(i + 1, addDays('2030-01-03', i), `Dish ${i + 1}`),
  );
  const weeks = buildDeliveryWeeks(groupDeliveriesByDate(tenDays), '2030-01-03');

  it('selects a plan day, dims days outside the plan, and pages between weeks', async () => {
    const onChange = jest.fn();
    await render(<DeliveryCalendar weeks={weeks} value="2030-01-03" onChange={onChange} />);

    expect(screen.getByText('Week 1 of 2')).toBeTruthy();

    // Seven days per week, two weeks.
    const days = screen.getAllByRole('button', { name: /meals?|no delivery/ });
    expect(days).toHaveLength(14);

    // Ten days span two Fridays (4th and 11th); week 1's renders first.
    const [firstFriday] = screen.getAllByRole('button', { name: /^Friday.*1 meal/ });
    await fireEvent.press(firstFriday);
    expect(onChange).toHaveBeenCalledWith('2030-01-04');

    // 13 January is past the plan's last day: shown, but not selectable.
    const outside = days.find((d) => d.props.accessibilityLabel.includes('no delivery'));
    expect(outside?.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText('Week 2 of 2')).toBeTruthy();
  });
});

describe('Deliveries screen', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedDeliveryDate: null });
  });

  it('shows the chosen day’s meals, slot by slot, and switches when another day is picked', async () => {
    await render(<DeliveriesScreen />);

    // Opens on the first plan day.
    expect(screen.getByText('Chicken Biryani')).toBeTruthy();
    expect(screen.queryByText('Grilled Fish')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /^Friday.*2 meals/ }));

    expect(screen.getByText('Masala Omelette')).toBeTruthy();
    expect(screen.getByText('Grilled Fish')).toBeTruthy();
    expect(screen.queryByText('Chicken Biryani')).toBeNull();
    // Breakfast is listed before lunch.
    const slots = screen.getAllByText(/^(Breakfast|Lunch)$/).map((node) => node.props.children);
    expect(slots).toEqual(['Breakfast', 'Lunch']);
  });

  it('steps to the neighbouring plan day from the bottom of the page', async () => {
    await render(<DeliveriesScreen />);

    await fireEvent.press(screen.getByRole('button', { name: /^Next day/ }));

    expect(screen.getByText('Grilled Fish')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Previous day/ })).toBeTruthy();
  });
});
