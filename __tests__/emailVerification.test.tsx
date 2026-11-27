import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import VerifyEmailScreen from '@/app/(auth)/verify-email';
import { setAuthToken } from '@/lib/api/client';
import {
  emailVerificationChallengeFrom,
  resendEmailCode,
  verifyEmail,
} from '@/lib/api/endpoints/auth';
import { getProfile } from '@/lib/api/endpoints/profile';
import type { User } from '@/lib/api/types/auth';
import type { ApiError } from '@/lib/api/types/common';
import { useAuthStore, useLocationStore } from '@/lib/store';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/api/endpoints/auth', () => ({
  ...jest.requireActual('@/lib/api/endpoints/auth'),
  verifyEmail: jest.fn(),
  resendEmailCode: jest.fn(),
}));
jest.mock('@/lib/api/endpoints/profile', () => ({
  ...jest.requireActual('@/lib/api/endpoints/profile'),
  getProfile: jest.fn(),
}));

const mockVerify = verifyEmail as jest.MockedFunction<typeof verifyEmail>;
const mockResend = resendEmailCode as jest.MockedFunction<typeof resendEmailCode>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

const user = {
  id: 9,
  name: 'Sara Ali',
  email: 'sara@example.com',
  phone: null,
  email_verified: true,
  status: 'active',
  roles: ['customer'],
  profile_complete: false,
} as unknown as User;

function apiError(status: number, body: Record<string, unknown>): ApiError {
  return {
    status,
    message: (body.message as string) ?? 'error',
    code: status === 422 ? 'validation' : status === 429 ? 'rate_limited' : 'forbidden',
    details: body,
  };
}

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <VerifyEmailScreen />
    </QueryClientProvider>,
  );
}

async function typeCode(code: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('verify-email-code'), code);
  });
}

describe('emailVerificationChallengeFrom', () => {
  it('reads the challenge off a 403 email_unverified sign-in refusal', () => {
    const challenge = emailVerificationChallengeFrom(
      apiError(403, {
        code: 'email_unverified',
        data: { verification_required: true, email: 'a@b.co', otp_sent: true, expires_in: 300, resend_available_in: 42 },
      }),
    );
    expect(challenge).toEqual({
      verification_required: true,
      email: 'a@b.co',
      otp_sent: true,
      expires_in: 300,
      resend_available_in: 42,
    });
  });

  it('ignores every other error', () => {
    expect(emailVerificationChallengeFrom(apiError(422, { errors: { email: ['bad'] } }))).toBeNull();
    expect(emailVerificationChallengeFrom(apiError(403, { code: 'profile_incomplete' }))).toBeNull();
    expect(emailVerificationChallengeFrom(new Error('x'))).toBeNull();
  });
});

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    setAuthToken(null);
    useAuthStore.setState({ token: null, user: null, hasHydrated: true });
    useLocationStore.setState({ hasPromptedLocation: true });
    mockParams = { email: 'sara@example.com', resend: '60', expires: '300', sent: '1' };
    mockGetProfile.mockResolvedValue(user);
  });

  it('shows the email and signs in like login once the 6 digits are entered', async () => {
    mockVerify.mockResolvedValue({ user, token: 'tok-verified' });
    await renderScreen();

    expect(screen.getByTestId('verify-email-address')).toHaveTextContent('sara@example.com');

    // Pasted with a space: only the digits count, and a full code submits.
    await typeCode('123 456');

    await waitFor(() => expect(useAuthStore.getState().token).toBe('tok-verified'));
    expect(mockVerify).toHaveBeenCalledWith({ email: 'sara@example.com', code: '123456' });
    expect(useAuthStore.getState().user).toMatchObject({ id: 9, email: 'sara@example.com' });
    // Same `beginSession` as login.
    expect(useLocationStore.getState().hasPromptedLocation).toBe(false);
  });

  it('says how many attempts are left after a wrong code', async () => {
    mockVerify.mockRejectedValue(
      apiError(422, { code: 'otp_invalid', attempts_remaining: 3, message: 'Wrong code' }),
    );
    await renderScreen();
    await typeCode('000000');

    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(/3 attempts left/);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it.each([
    ['otp_expired', /expired/i],
    ['otp_attempts_exceeded', /Too many wrong attempts/],
  ])('asks for a new code on %s', async (code, text) => {
    mockVerify.mockRejectedValue(apiError(422, { code }));
    await renderScreen();
    await typeCode('111111');

    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(text);
  });

  it('counts down before a resend, then resends and restarts the clock', async () => {
    jest.useFakeTimers();
    mockParams = { ...mockParams, resend: '2' };
    mockResend.mockResolvedValue({ expires_in: 300, resend_available_in: 60 });
    await renderScreen();

    expect(screen.getByTestId('verify-email-resend')).toHaveTextContent(/in 0:02/);
    await fireEvent.press(screen.getByTestId('verify-email-resend'));
    expect(mockResend).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(screen.getByTestId('verify-email-resend')).toHaveTextContent('Send a new code');

    await act(async () => {
      fireEvent.press(screen.getByTestId('verify-email-resend'));
    });
    expect(mockResend).toHaveBeenCalledWith('sara@example.com');
    await waitFor(() =>
      expect(screen.getByTestId('verify-email-resend')).toHaveTextContent(/in 1:00/),
    );
  });

  it('seeds the countdown from retry_after when resending is throttled', async () => {
    jest.useFakeTimers();
    mockParams = { ...mockParams, resend: '0' };
    mockResend.mockRejectedValue(apiError(429, { code: 'otp_resend_throttled', retry_after: 90 }));
    await renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('verify-email-resend'));
    });

    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(/wait/i);
    expect(screen.getByTestId('verify-email-resend')).toHaveTextContent(/in 1:30/);
  });

  it('explains a failed delivery', async () => {
    mockParams = { ...mockParams, resend: '0' };
    mockResend.mockRejectedValue({
      status: 503,
      code: 'server',
      message: 'Something went wrong',
    } satisfies ApiError);
    await renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId('verify-email-resend'));
    });

    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(/couldn't send the email/);
  });

  it('goes back to change the email', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Use a different email'));
    expect(mockBack).toHaveBeenCalled();
  });
});
