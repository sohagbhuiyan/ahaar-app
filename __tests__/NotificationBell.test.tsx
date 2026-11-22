import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NotificationBell, badgeLabel } from '@/components/shared/NotificationBell';
import { getUnreadNotificationCount } from '@/lib/api/endpoints/notifications';
import { useUnreadNotificationCount } from '@/lib/query/hooks/useNotifications';
import { useAuthPromptStore, useAuthStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

jest.mock('@/lib/api/endpoints/notifications', () => ({
  ...jest.requireActual('@/lib/api/endpoints/notifications'),
  getUnreadNotificationCount: jest.fn(),
}));

const mockCount = getUnreadNotificationCount as jest.MockedFunction<typeof getUnreadNotificationCount>;

function Probe({ poll }: { poll: boolean }) {
  const { count } = useUnreadNotificationCount({ poll });
  return <Text>{`unread:${count}`}</Text>;
}

describe('notification bell', () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({ token: 'test-token' });
  });

  afterEach(() => {
    client.clear();
    jest.useRealTimers();
  });

  const wrap = (ui: React.ReactElement) => (
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );

  describe('useUnreadNotificationCount', () => {
    it('polls the unread count every 60 s while asked to', async () => {
      mockCount.mockResolvedValue(3);
      await render(wrap(<Probe poll />));

      await waitFor(() => expect(screen.getByText('unread:3')).toBeTruthy());
      expect(mockCount).toHaveBeenCalledTimes(1);

      mockCount.mockResolvedValue(5);
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      await waitFor(() => expect(screen.getByText('unread:5')).toBeTruthy());
      expect(mockCount).toHaveBeenCalledTimes(2);
    });

    it('reads once and does not poll when the bell is out of view', async () => {
      mockCount.mockResolvedValue(2);
      await render(wrap(<Probe poll={false} />));

      await waitFor(() => expect(screen.getByText('unread:2')).toBeTruthy());
      await act(async () => {
        jest.advanceTimersByTime(180_000);
      });
      expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('is 0 and asks nothing while signed out', async () => {
      useAuthStore.setState({ token: null });
      await render(wrap(<Probe poll />));

      expect(screen.getByText('unread:0')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(120_000);
      });
      expect(mockCount).not.toHaveBeenCalled();
    });
  });

  describe('<NotificationBell />', () => {
    it('shows the unread count on a badge and opens the inbox', async () => {
      mockCount.mockResolvedValue(4);
      await render(wrap(<NotificationBell />));

      await waitFor(() => expect(screen.getByTestId('notification-bell-badge')).toBeTruthy());
      expect(screen.getByText('4')).toBeTruthy();
      expect(screen.getByLabelText('Notifications, 4 unread')).toBeTruthy();

      fireEvent.press(screen.getByTestId('notification-bell'));
      expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('has no badge when everything is read', async () => {
      mockCount.mockResolvedValue(0);
      await render(wrap(<NotificationBell />));

      await waitFor(() => expect(mockCount).toHaveBeenCalled());
      expect(screen.queryByTestId('notification-bell-badge')).toBeNull();
      expect(screen.getByLabelText('Notifications')).toBeTruthy();
    });

    it('asks a guest to sign in, then opens the inbox', async () => {
      useAuthStore.setState({ token: null });
      const prompt = jest.fn();
      useAuthPromptStore.setState({ prompt });
      await render(wrap(<NotificationBell />));

      fireEvent.press(screen.getByTestId('notification-bell'));
      expect(mockPush).not.toHaveBeenCalled();
      expect(prompt).toHaveBeenCalledWith('to see your notifications', expect.any(Function));

      // The prompt replays the action once signed in.
      prompt.mock.calls[0][1]();
      expect(mockPush).toHaveBeenCalledWith('/notifications');
    });

    it('caps the badge at 99+', () => {
      expect(badgeLabel(7)).toBe('7');
      expect(badgeLabel(99)).toBe('99');
      expect(badgeLabel(140)).toBe('99+');
    });
  });
});
