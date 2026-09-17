import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { setAuthToken } from '@/lib/api/client';
import { loginWithGoogle, logout } from '@/lib/api/endpoints/auth';
import { getProfile } from '@/lib/api/endpoints/profile';
import type { User } from '@/lib/api/types/auth';
import { requestGoogleIdToken, signOutOfGoogle } from '@/lib/auth/google';
import { queryKeys } from '@/lib/query/keys';
import { useGoogleLogin, useLogout } from '@/lib/query/hooks';
import { useAuthStore, useLocationStore } from '@/lib/store';

jest.mock('@/lib/auth/google', () => ({
  ...jest.requireActual('@/lib/auth/google'),
  requestGoogleIdToken: jest.fn(),
  signOutOfGoogle: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/endpoints/auth', () => ({
  ...jest.requireActual('@/lib/api/endpoints/auth'),
  loginWithGoogle: jest.fn(),
  logout: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/endpoints/profile', () => ({
  ...jest.requireActual('@/lib/api/endpoints/profile'),
  getProfile: jest.fn(),
}));

const mockRequestIdToken = requestGoogleIdToken as jest.MockedFunction<typeof requestGoogleIdToken>;
const mockLoginWithGoogle = loginWithGoogle as jest.MockedFunction<typeof loginWithGoogle>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;

const user = {
  id: 9,
  name: 'Amina Rahman',
  email: 'amina@example.com',
  phone: null,
  phone_verified: false,
  email_verified: true,
  avatar_url: 'https://lh3.googleusercontent.com/a/photo',
  google_linked: true,
  has_password: false,
  locale: null,
  dietary_preferences: null,
  default_address_id: null,
  default_slot_id: null,
  status: 'active',
  roles: ['customer'],
} as unknown as User;

const onSuccess = jest.fn();

function Harness() {
  const google = useGoogleLogin({ onSuccess });
  const signOut = useLogout();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => google.mutate()}>
        <Text>Continue with Google</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => signOut.mutate()}>
        <Text>Sign out</Text>
      </Pressable>
    </>
  );
}

async function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
  });
  await render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  );
  return client;
}

describe('useGoogleLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAuthToken(null);
    useAuthStore.setState({ token: null, user: null, hasHydrated: true });
    useLocationStore.setState({ hasPromptedLocation: true });
    mockGetProfile.mockResolvedValue(user);
    mockLoginWithGoogle.mockResolvedValue({ user, token: 'google-token', isNewUser: true });
  });

  it('sends the Google ID token to the API and starts a session like a password login', async () => {
    mockRequestIdToken.mockResolvedValue('id-token-from-google');
    const client = await renderHarness();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    });

    await waitFor(() => expect(useAuthStore.getState().token).toBe('google-token'));
    expect(mockLoginWithGoogle).toHaveBeenCalledWith('id-token-from-google');
    expect(useAuthStore.getState().user).toEqual({
      id: 9,
      name: 'Amina Rahman',
      email: 'amina@example.com',
      roles: ['customer'],
    });
    expect(client.getQueryData(queryKeys.profile.me())).toMatchObject({ google_linked: true });
    expect(onSuccess).toHaveBeenCalledWith(user, true);
    expect(useLocationStore.getState().hasPromptedLocation).toBe(false);
  });

  it('does nothing at all when the customer backs out of the Google picker', async () => {
    mockRequestIdToken.mockResolvedValue(null);
    await renderHarness();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    });

    await waitFor(() => expect(mockRequestIdToken).toHaveBeenCalled());
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    // A cancelled picker is not a sign-in to reset for.
    expect(useLocationStore.getState().hasPromptedLocation).toBe(true);
  });

  it('forgets the Google session on sign-out, so the next sign-in asks for an account', async () => {
    useAuthStore.setState({ token: 'google-token', user: { id: 9, name: 'Amina', email: 'a@b.c', roles: [] } });
    await renderHarness();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    });

    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(logout).toHaveBeenCalled();
    expect(signOutOfGoogle).toHaveBeenCalled();
  });
});
