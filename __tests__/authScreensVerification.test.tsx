import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LoginScreen from '@/app/(auth)/login';
import RegisterScreen from '@/app/(auth)/register';
import { setAuthToken } from '@/lib/api/client';
import { login, register } from '@/lib/api/endpoints/auth';
import type { ApiError } from '@/lib/api/types/common';
import { useAuthStore } from '@/lib/store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  Link: ({ children }: { children: React.ReactNode }) => {
    const { createElement } = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return createElement(Text, null, children);
  },
}));

jest.mock('@/lib/api/endpoints/auth', () => ({
  ...jest.requireActual('@/lib/api/endpoints/auth'),
  login: jest.fn(),
  register: jest.fn(),
}));

const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRegister = register as jest.MockedFunction<typeof register>;

async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const verifyRoute = (email: string, resend: string) => ({
  pathname: '/(auth)/verify-email',
  params: { email, resend, expires: '300', sent: '1' },
});

describe('auth screens → verify-email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthToken(null);
    useAuthStore.setState({ token: null, user: null, hasHydrated: true });
  });

  it('register goes on to the code screen without signing in', async () => {
    mockRegister.mockResolvedValue({
      verification_required: true,
      email: 'new@example.com',
      otp_sent: true,
      expires_in: 300,
      resend_available_in: 60,
    });
    await renderWithClient(<RegisterScreen />);

    await fireEvent.changeText(screen.getByLabelText('Full name'), 'New Person');
    await fireEvent.changeText(screen.getByLabelText('Email'), 'new@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'secret-pass');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'secret-pass');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(verifyRoute('new@example.com', '60')));
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('an unverified sign-in (403 email_unverified) goes to the code screen', async () => {
    const refusal: ApiError = {
      status: 403,
      code: 'forbidden',
      message: 'Verify your email first.',
      details: {
        code: 'email_unverified',
        data: {
          verification_required: true,
          email: 'old@example.com',
          otp_sent: true,
          expires_in: 300,
          resend_available_in: 35,
        },
      },
    };
    mockLogin.mockRejectedValue(refusal);
    await renderWithClient(<LoginScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'old@example.com');
    await fireEvent.changeText(screen.getByLabelText('Password'), 'right-password');
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(verifyRoute('old@example.com', '35')));
    // Not shown as an error — it is a step, not a failure.
    expect(screen.queryByText('Verify your email first.')).toBeNull();
  });
});
