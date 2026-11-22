import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { getOrderTracking } from '@/lib/api/endpoints/tracking';
import { normalizeTracking } from '@/lib/api/endpoints/tracking';
import { useOrderTracking } from '@/lib/query/hooks';
import { useAuthStore } from '@/lib/store';

jest.mock('@/lib/api/endpoints/tracking', () => ({
  ...jest.requireActual('@/lib/api/endpoints/tracking'),
  getOrderTracking: jest.fn(),
}));

const mockGet = getOrderTracking as jest.MockedFunction<typeof getOrderTracking>;

function payload(poll: number | null) {
  return normalizeTracking({
    subject: 'order',
    id: 7,
    status: 'on_the_way',
    is_live: true,
    timeline: [],
    poll_seconds: poll,
  });
}

function Probe({ focused, enabled = true }: { focused: boolean; enabled?: boolean }) {
  const { data } = useOrderTracking(7, { focused, enabled });
  return <Text>{data ? `status:${data.status}` : 'none'}</Text>;
}

describe('useOrderTracking', () => {
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

  const wrap = (ui: React.ReactElement) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;

  it('polls at poll_seconds while the screen is focused', async () => {
    mockGet.mockResolvedValue(payload(10));
    await render(wrap(<Probe focused />));

    await waitFor(() => expect(screen.getByText('status:on_the_way')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it('does not poll while the screen is not focused', async () => {
    mockGet.mockResolvedValue(payload(10));
    await render(wrap(<Probe focused={false} />));

    await waitFor(() => expect(screen.getByText('status:on_the_way')).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(35_000);
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('stops polling once the server sends poll_seconds: null', async () => {
    mockGet.mockResolvedValue(payload(null));
    await render(wrap(<Probe focused />));

    await waitFor(() => expect(screen.getByText('status:on_the_way')).toBeTruthy());
    await act(async () => {
      jest.advanceTimersByTime(35_000);
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('does not read at all when disabled or signed out', async () => {
    mockGet.mockResolvedValue(payload(10));
    await render(wrap(<Probe focused enabled={false} />));
    expect(screen.getByText('none')).toBeTruthy();

    useAuthStore.setState({ token: null });
    await render(wrap(<Probe focused />));
    expect(mockGet).not.toHaveBeenCalled();
  });
});
