import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';

import { LoginPrompt } from '@/components/shared/LoginPrompt';
import { useAuthPromptStore } from '@/lib/store';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

/** No garbage-collection timers, so Jest can exit as soon as the tests end. */
const testQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });

describe('LoginPrompt', () => {
  beforeEach(() => {
    useAuthPromptStore.setState({ open: false, reason: null, pendingAction: null });
  });

  it('renders the fields and the footer "Sign in" button once prompted', async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <LoginPrompt />
      </QueryClientProvider>,
    );

    // Closed: nothing is presented.
    expect(screen.queryByText('Sign in to continue')).toBeNull();

    await act(async () => {
      useAuthPromptStore.getState().prompt('to place this order');
    });

    expect(await screen.findByText('Sign in to continue')).toBeTruthy();
    expect(screen.getByText('You need an account to place this order.')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('dismisses when closed from the store', async () => {
    await render(
      <QueryClientProvider client={testQueryClient()}>
        <LoginPrompt />
      </QueryClientProvider>,
    );

    await act(async () => {
      useAuthPromptStore.getState().prompt();
    });
    expect(await screen.findByText('Sign in to continue')).toBeTruthy();

    await act(async () => {
      useAuthPromptStore.getState().close();
    });
    expect(screen.queryByText('Sign in to continue')).toBeNull();
  });
});
