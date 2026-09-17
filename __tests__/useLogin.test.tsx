import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { setAuthToken } from '@/lib/api/client';
import { login as loginRequest } from '@/lib/api/endpoints/auth';
import { getAddresses, getProfile } from '@/lib/api/endpoints/profile';
import type { User } from '@/lib/api/types/auth';
import type { Address } from '@/lib/api/types/catalog';
import { useAddresses, useLogin, useProfile } from '@/lib/query/hooks';
import { useAuthStore, useLocationStore } from '@/lib/store';

jest.mock('@/lib/api/endpoints/auth', () => ({
  ...jest.requireActual('@/lib/api/endpoints/auth'),
  login: jest.fn(),
}));
jest.mock('@/lib/api/endpoints/profile', () => ({
  ...jest.requireActual('@/lib/api/endpoints/profile'),
  getProfile: jest.fn(),
  getAddresses: jest.fn(),
}));

/** Records whether a session already existed each time the private cache was cleared. */
const tokenAtClear: (string | null)[] = [];
jest.mock('@/lib/query/session', () => {
  const actual = jest.requireActual('@/lib/query/session');
  return {
    ...actual,
    clearPrivateQueries: jest.fn(async (client: unknown) => {
      const { useAuthStore: store } = jest.requireActual('@/lib/store/useAuthStore');
      tokenAtClear.push(store.getState().token);
      return actual.clearPrivateQueries(client);
    }),
  };
});

const mockLogin = loginRequest as jest.MockedFunction<typeof loginRequest>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockGetAddresses = getAddresses as jest.MockedFunction<typeof getAddresses>;

const user = {
  id: 7,
  name: 'Aziz Karim',
  email: 'aziz@example.com',
  phone: null,
  phone_verified: false,
  email_verified: true,
  locale: null,
  dietary_preferences: null,
  default_address_id: 3,
  default_slot_id: null,
  status: 'active',
  roles: ['customer'],
} as unknown as User;

const home = { id: 3, label: 'Home', is_default: true, formatted: 'Olaya St, Riyadh' } as Address;

/** A signed-out screen that reads private data, like the Account tab does. */
function Harness() {
  const login = useLogin();
  const { data: profile } = useProfile();
  const { data: addresses } = useAddresses();

  return (
    <>
      <Text>{profile ? `profile:${profile.name}` : 'no-profile'}</Text>
      <Text>{addresses ? `addresses:${addresses.length}` : 'no-addresses'}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => login.mutate({ email: user.email, password: 'secret-password' })}
      >
        <Text>Log in</Text>
      </Pressable>
    </>
  );
}

describe('useLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenAtClear.length = 0;
    setAuthToken(null);
    useAuthStore.setState({ token: null, user: null, hasHydrated: true });
    useLocationStore.setState({ hasPromptedLocation: true });
    mockLogin.mockResolvedValue({ user, token: 'token-123' });
    mockGetProfile.mockResolvedValue({ ...user, default_address: { ...home } });
    mockGetAddresses.mockResolvedValue([home]);
  });

  it('loads private data on its own once signed in — no refresh needed', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
    });

    await render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );

    expect(screen.getByText('no-profile')).toBeTruthy();
    expect(mockGetAddresses).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    });

    // Seeded from the login response straight away…
    expect(await screen.findByText('profile:Aziz Karim')).toBeTruthy();
    // …and the reads that started when the token landed were not cancelled
    // by the cache reset — they complete and render.
    expect(await screen.findByText('addresses:1')).toBeTruthy();
    expect(mockGetProfile).toHaveBeenCalled();

    // A new session may be asked for a delivery location again.
    expect(useLocationStore.getState().hasPromptedLocation).toBe(false);
  });

  it('clears the previous private cache before the token exists, never after', async () => {
    // On a device the token re-renders every private query into fetching
    // before a later clear could run, and removing those queries cancels
    // their fetches silently — the Account tab then sat on skeletons until a
    // pull-to-refresh. Jest defers that render, so the race itself can't be
    // reproduced here; the ordering that prevents it can be pinned instead.
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } },
    });

    await render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    });
    await waitFor(() => expect(useAuthStore.getState().token).toBe('token-123'));

    expect(tokenAtClear).toEqual([null]);
  });
});
