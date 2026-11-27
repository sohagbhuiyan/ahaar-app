import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthGate } from '@/components/shared/AuthGate';
import { resetProfileCompletionPrompt } from '@/components/shared/ProfileCompletionPrompt';
import { apiClient, setAuthToken } from '@/lib/api/client';
import { getProfile } from '@/lib/api/endpoints/profile';
import type { User } from '@/lib/api/types/auth';
import { useAuthStore } from '@/lib/store';

const mockPush = jest.fn();
const mockDismissTo = jest.fn();
let mockSegments: string[] = ['(tabs)'];
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, dismissTo: mockDismissTo }),
  useSegments: () => mockSegments,
}));

jest.mock('@/lib/api/endpoints/profile', () => ({
  ...jest.requireActual('@/lib/api/endpoints/profile'),
  getProfile: jest.fn(),
}));
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

const incomplete = {
  id: 4,
  name: 'New Customer',
  email: 'new@example.com',
  status: 'active',
  profile_complete: false,
  profile_missing: ['phone', 'address'],
} as unknown as User;

async function renderGate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const view = await render(
    <QueryClientProvider client={client}>
      <AuthGate>
        <Text>app</Text>
      </AuthGate>
    </QueryClientProvider>,
  );
  return { client, view };
}

describe('AuthGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetProfileCompletionPrompt();
    mockSegments = ['(tabs)'];
    setAuthToken('tok');
    useAuthStore.setState({ token: 'tok', user: null, hasHydrated: true });
    mockGetProfile.mockResolvedValue(incomplete);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('suggests completing the profile instead of forcing it, once per launch', async () => {
    const { view } = await renderGate();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // No forced redirect…
    expect(mockPush).not.toHaveBeenCalled();
    // …just the suggestion, which "Later" dismisses.
    expect(screen.getByText('Complete your profile')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-prompt-later'));
    });
    expect(screen.queryByText('Complete your profile')).toBeNull();

    // Not again in the same launch.
    await view.unmount();
    await renderGate();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Complete your profile')).toBeNull();
  });

  it('"Complete now" opens the complete-profile screen', async () => {
    await renderGate();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('profile-prompt-complete'));
    });
    expect(mockPush).toHaveBeenCalledWith('/complete-profile');
  });

  it('stays quiet on the setup and auth screens', async () => {
    mockSegments = ['complete-profile'];
    await renderGate();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Complete your profile')).toBeNull();
  });

  it('moves a signed-in customer off the auth screens', async () => {
    mockSegments = ['(auth)', 'verify-email'];
    await renderGate();
    expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)');
  });

  it('sends a purchase refused with 403 profile_incomplete to complete-profile', async () => {
    await renderGate();

    // Drive the real response interceptor with a refused checkout.
    const adapter = jest.fn(async (config) => {
      const error = Object.assign(new Error('forbidden'), {
        config,
        isAxiosError: true,
        response: {
          status: 403,
          data: { message: 'Complete your profile first.', code: 'profile_incomplete' },
          headers: {},
          config,
        },
      });
      throw error;
    });

    await act(async () => {
      await apiClient.post('/cart/checkout', {}, { adapter }).catch(() => undefined);
    });

    expect(mockPush).toHaveBeenCalledWith('/complete-profile');
  });
});
