import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/menu';
import { LoginPrompt } from '@/components/shared/LoginPrompt';
import { useAuthPromptStore } from '@/lib/store';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
  useFocusEffect: jest.fn(),
}));

// The tab shows the admin's banners and the kitchen's videos; both are public
// reads, answered here with nothing so no request leaves the test.
jest.mock('@/lib/api/endpoints/home', () => ({
  getHomeContent: jest.fn(async () => ({ sections: [] })),
}));
jest.mock('@/lib/api/endpoints/media', () => ({
  getMediaVideos: jest.fn(async () => ({
    data: [],
    meta: { current_page: 1, per_page: 12, total: 0, last_page: 1 },
  })),
}));

const press = (name: string) =>
  act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });

/** The tab as a signed-out customer sees it, with the app's sign-in sheet. */
function renderSignedOut() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountScreen />
      <LoginPrompt />
    </QueryClientProvider>,
  );
}

describe('Account tab, signed out', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockNavigate.mockClear();
    useAuthPromptStore.setState({ open: false, reason: null, pendingAction: null });
  });

  it('opens the sign-in sheet on every press of "Sign in"', async () => {
    await renderSignedOut();

    await press('Sign in');
    expect(screen.getByText('Sign in to continue')).toBeTruthy();
    expect(
      screen.getByText('You need an account to see your orders, plan and payments.'),
    ).toBeTruthy();

    // Swiped away, then asked for again straight after.
    await press('Drag sheet closed');
    expect(screen.queryByText('Sign in to continue')).toBeNull();

    await press('Sign in');
    expect(screen.getByText('Sign in to continue')).toBeTruthy();
  });

  it('lands on Home once signing in from this tab succeeds', async () => {
    await renderSignedOut();

    await press('Sign in');
    expect(useAuthPromptStore.getState().pendingAction).not.toBeNull();

    // What `LoginPrompt` does with a successful sign-in.
    await act(async () => {
      useAuthPromptStore.getState().resolve();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('sends a new customer to registration', async () => {
    await renderSignedOut();

    await press('Create an account');

    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');
  });
});
