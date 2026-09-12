import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import AccountScreen from '@/app/(tabs)/menu';
import { LoginPrompt } from '@/components/shared/LoginPrompt';
import { useAuthPromptStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

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

  it('sends a new customer to registration', async () => {
    await renderSignedOut();

    await press('Create an account');

    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');
  });
});
