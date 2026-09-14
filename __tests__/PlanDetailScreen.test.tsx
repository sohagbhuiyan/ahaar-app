import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import PlanDetailScreen from '@/app/plan/[id]';
import { getPlan } from '@/lib/api/endpoints/plans';
import type { MenuItem, Plan, PlanScheduleItem } from '@/lib/api/types/catalog';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn(),
    canGoBack: () => true,
  }),
}));
jest.mock('@/lib/api/endpoints/plans');

const mockGetPlan = getPlan as jest.MockedFunction<typeof getPlan>;

const dish = (id: number, name: string, imageUrl: string | null): MenuItem => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  description: null,
  image_url: imageUrl,
  base_price: 6,
  dietary_tags: [],
  allergens: [],
  is_addon: false,
});

const line = (
  id: number,
  menuItem: MenuItem,
  overrides: Partial<PlanScheduleItem> = {},
): PlanScheduleItem => ({
  id,
  menu_item_id: menuItem.id,
  menu_item: menuItem,
  quantity: 1,
  entry_type: 'included',
  is_addon: false,
  ...overrides,
});

const breakfast = {
  id: 1,
  name: 'Breakfast',
  slug: 'breakfast',
  start_time: '07:00',
  end_time: '09:00',
  cutoff_hours: 10,
};

/** One weekday, one meal: two included dishes (one unphotographed) and an add-on. */
const plan: Plan = {
  id: 1,
  name: 'Full Board',
  slug: 'full-board',
  description: null,
  image_url: 'https://cdn.test/full-board.jpg',
  duration_days: 7,
  price: 700,
  currency: 'SAR',
  slots: [breakfast],
  schedule: [
    {
      day_number: 1,
      day_name: 'Monday',
      slots: [
        {
          slot_id: 1,
          slot: breakfast,
          items: [
            line(11, dish(101, 'Roti', 'https://cdn.test/roti.jpg'), { quantity: 2 }),
            line(12, dish(102, 'Egg Fry', null)),
          ],
          addons: [
            line(13, dish(103, 'Paratha', 'https://cdn.test/paratha.jpg'), {
              entry_type: 'optional_addon',
            }),
          ],
        },
      ],
    },
  ],
  quotas: [],
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlanDetailScreen />
    </QueryClientProvider>,
  );
}

describe('Plan detail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows every dish and add-on with its picture, or the food glyph without one', async () => {
    mockGetPlan.mockResolvedValue(plan);
    await renderScreen();

    expect(await screen.findByText('Egg Fry')).toBeTruthy();

    expect(screen.getByTestId('plan-hero')).toBeTruthy();
    expect(screen.getByTestId('plan-dish-image-11')).toBeTruthy();
    expect(screen.getByTestId('plan-dish-image-12-fallback')).toBeTruthy();
    expect(screen.getByTestId('plan-dish-image-13')).toBeTruthy();
    // One image per line — two included dishes and the add-on.
    expect(screen.getAllByTestId(/^plan-dish-image-/)).toHaveLength(3);
  });

  it('opens a dish from the week', async () => {
    mockGetPlan.mockResolvedValue(plan);
    await renderScreen();

    const eggFry = await screen.findByRole('button', { name: 'Egg Fry' });
    await act(async () => {
      fireEvent.press(eggFry);
    });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/food/[id]',
      params: { id: '102' },
    });
  });

  it('says a plan was taken off the menu rather than offering a retry', async () => {
    mockGetPlan.mockRejectedValue({ message: 'Not Found', status: 404, code: 'not_found' });
    await renderScreen();

    expect(await screen.findByText('This plan is no longer available')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Browse plans' }));
    });

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/plans');
  });
});
