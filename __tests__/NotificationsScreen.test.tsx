import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NotificationsScreen from '@/app/notifications';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeNotification,
} from '@/lib/api/endpoints/notifications';
import type { AppNotification, NotificationPage } from '@/lib/api/types/notification';
import { pushDataForNotification } from '@/lib/notifications/routing';
import { PRIVATE_QUERY_ROOTS, queryKeys } from '@/lib/query/keys';
import { useAuthStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
}));

jest.mock('@/lib/api/endpoints/notifications', () => ({
  ...jest.requireActual('@/lib/api/endpoints/notifications'),
  getNotifications: jest.fn(),
  markNotificationRead: jest.fn(async () => undefined),
  markAllNotificationsRead: jest.fn(async () => undefined),
}));

const mockList = getNotifications as jest.MockedFunction<typeof getNotifications>;
const mockRead = markNotificationRead as jest.MockedFunction<typeof markNotificationRead>;
const mockReadAll = markAllNotificationsRead as jest.MockedFunction<typeof markAllNotificationsRead>;

const recent = new Date(Date.now() - 5 * 60_000).toISOString();

function row(overrides: Partial<AppNotification>): AppNotification {
  return {
    id: 'n1',
    type: 'order.status',
    title: 'Your order is on the way',
    body: 'Tariq picked it up.',
    order_id: 12,
    delivery_id: null,
    run_id: null,
    status: 'picked_up',
    read_at: null,
    created_at: recent,
    ...overrides,
  };
}

function page(data: AppNotification[], current = 1, last = 1): NotificationPage {
  return {
    data,
    meta: { current_page: current, last_page: last, per_page: 20, total: data.length },
    unread_count: data.filter((n) => n.read_at === null).length,
  };
}

describe('notifications screen', () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ token: 'test-token' });
  });

  afterEach(() => client.clear());

  const show = () =>
    render(
      <QueryClientProvider client={client}>
        <NotificationsScreen />
      </QueryClientProvider>,
    );

  it('lists notifications with title, body, relative time and unread styling', async () => {
    mockList.mockResolvedValue(
      page([
        row({}),
        row({
          id: 'n2',
          type: 'delivery.status',
          title: 'Lunch delivered',
          body: null,
          order_id: null,
          delivery_id: 5,
          read_at: recent,
        }),
      ]),
    );
    await show();

    await waitFor(() => expect(screen.getByText('Your order is on the way')).toBeTruthy());
    expect(screen.getByText('Tariq picked it up.')).toBeTruthy();
    expect(screen.getByText('Lunch delivered')).toBeTruthy();
    expect(screen.getAllByText('5m ago')).toHaveLength(2);
    // One unread row, one dot; an icon per type.
    expect(screen.getAllByTestId('notification-unread-dot')).toHaveLength(1);
    expect(screen.getByTestId('notification-icon-order.status')).toBeTruthy();
    expect(screen.getByTestId('notification-icon-delivery.status')).toBeTruthy();
    expect(screen.getByTestId('mark-all-read')).toBeTruthy();
  });

  it('marks a row read and opens what it is about, like a push tap', async () => {
    mockList.mockResolvedValue(page([row({})]));
    await show();

    await waitFor(() => expect(screen.getByTestId('notification-n1')).toBeTruthy());
    // What the server returns on the refetch that settles the mutation.
    mockList.mockResolvedValue(page([row({ read_at: recent })]));
    fireEvent.press(screen.getByTestId('notification-n1'));

    await waitFor(() => expect(mockRead).toHaveBeenCalledWith('n1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/orders/[id]', params: { id: '12' } });
    await waitFor(() => expect(screen.queryByTestId('notification-unread-dot')).toBeNull());
  });

  it('does not re-mark a row that is already read', async () => {
    mockList.mockResolvedValue(
      page([row({ id: 'n3', type: 'delivery.status', order_id: null, delivery_id: 8, read_at: recent })]),
    );
    await show();

    await waitFor(() => expect(screen.getByTestId('notification-n3')).toBeTruthy());
    fireEvent.press(screen.getByTestId('notification-n3'));
    expect(mockRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/deliveries/[id]', params: { id: '8' } });
  });

  it('marks everything read at once', async () => {
    mockList.mockResolvedValue(page([row({}), row({ id: 'n2', order_id: 13 })]));
    await show();

    await waitFor(() => expect(screen.getAllByTestId('notification-unread-dot')).toHaveLength(2));
    // The server agrees on the refetch that follows.
    mockList.mockResolvedValue(page([row({ read_at: recent }), row({ id: 'n2', order_id: 13, read_at: recent })]));
    fireEvent.press(screen.getByTestId('mark-all-read'));

    await waitFor(() => expect(mockReadAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryAllByTestId('notification-unread-dot')).toHaveLength(0));
    expect(screen.queryByTestId('mark-all-read')).toBeNull();
  });

  it('loads the next page at the end of the list', async () => {
    mockList.mockImplementation(async ({ page: n } = {}) =>
      n === 2 ? page([row({ id: 'old', title: 'Older update' })], 2, 2) : page([row({})], 1, 2),
    );
    await show();

    await waitFor(() => expect(screen.getByTestId('notifications-list')).toBeTruthy());
    fireEvent(screen.getByTestId('notifications-list'), 'onEndReached');
    await waitFor(() => expect(screen.getByText('Older update')).toBeTruthy());
    expect(mockList).toHaveBeenLastCalledWith({ page: 2 });
  });

  it('shows an empty state', async () => {
    mockList.mockResolvedValue(page([]));
    await show();
    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeTruthy());
    expect(screen.queryByTestId('mark-all-read')).toBeNull();
  });

  it('asks a guest to sign in instead of loading', async () => {
    useAuthStore.setState({ token: null });
    await show();
    expect(screen.getByText('Sign in to see your notifications')).toBeTruthy();
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe('notification data', () => {
  it('normalizes a raw inbox row', () => {
    expect(
      normalizeNotification({
        id: 'abc',
        type: 'order.status',
        title: 'Hi',
        body: '',
        order_id: '12',
        delivery_id: null,
        read_at: null,
        created_at: '2030-01-01T10:00:00+03:00',
      }),
    ).toMatchObject({ id: 'abc', order_id: 12, delivery_id: null, body: null, read_at: null });
  });

  it('maps a row to the push it was', () => {
    expect(pushDataForNotification(row({}))).toEqual({
      type: 'order.status',
      order_id: '12',
      status: 'picked_up',
    });
    expect(
      pushDataForNotification(row({ type: 'something.new', order_id: null, delivery_id: 4, status: null })),
    ).toEqual({ type: 'delivery.status', delivery_id: '4', status: undefined });
    expect(pushDataForNotification(row({ type: 'run.assigned', order_id: null }))).toBeNull();
  });

  it('keeps the inbox under a private root, so sign-out clears it', () => {
    expect(PRIVATE_QUERY_ROOTS).toContainEqual(queryKeys.notifications.all());
  });
});
