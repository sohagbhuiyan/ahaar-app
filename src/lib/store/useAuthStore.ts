/**
 * Session state: the Sanctum token and a minimal identity snapshot.
 *
 * ── What lives where ────────────────────────────────────────────────────────
 * The **token** is written as a raw string to SecureStore under
 * `AUTH_TOKEN_KEY` — the same key `api/client.ts` falls back to when a request
 * fires before this store has hydrated. One canonical location, two readers.
 *
 * The **identity snapshot** (id/name/email/roles) is persisted separately, also
 * in SecureStore, so route guards and the profile header can render
 * synchronously on cold start instead of waiting on a network round-trip. It is
 * deliberately minimal: SecureStore values above ~2 KB are unreliable on
 * Android, and the full `User` — with dietary preferences and a nested address —
 * is server state that belongs to TanStack Query (`GET /me`), not here.
 *
 * That split is the rule from the brief: Zustand owns session/client state,
 * TanStack Query owns server state.
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { AUTH_TOKEN_KEY, setAuthToken } from '../api/client';
import * as authApi from '../api/endpoints/auth';
import type { LoginPayload, RegisterPayload, User, UserRole } from '../api/types/auth';

/** SecureStore key for the identity snapshot. Distinct from the token's key. */
const SESSION_KEY = 'ahaar.auth.session';

/** Just enough to render a header and gate a route before `/me` resolves. */
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  roles: UserRole[];
}

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles ?? [],
  };
}

/** zustand `persist` adapter backed by SecureStore (encrypted at rest). */
const secureStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      // A failed write must not crash sign-in; the session simply won't
      // survive an app kill.
    }
  },
  removeItem: async (name) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      /* nothing to clean up */
    }
  },
};

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  /** False until persisted state has been read back. Gate routing on this. */
  hasHydrated: boolean;

  login: (payload: LoginPayload) => Promise<SessionUser>;
  register: (payload: RegisterPayload) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** Replace the identity snapshot after a profile update or `/me` refetch. */
  syncUser: (user: User) => void;
  /** Drop local session without calling the API — used by the 401 handler. */
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hasHydrated: false,

      login: async (payload) => {
        const { user, token } = await authApi.login(payload);
        const session = toSessionUser(user);

        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token).catch(() => undefined);
        setAuthToken(token);
        set({ token, user: session });

        return session;
      },

      register: async (payload) => {
        const { user, token } = await authApi.register(payload);
        const session = toSessionUser(user);

        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token).catch(() => undefined);
        setAuthToken(token);
        set({ token, user: session });

        return session;
      },

      logout: async () => {
        // Revoke server-side first, but never let a failure strand the user in
        // a signed-in shell — local state is cleared either way.
        await authApi.logout().catch(() => undefined);
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => undefined);
        setAuthToken(null);
        set({ token: null, user: null });
      },

      syncUser: (user) => set({ user: toSessionUser(user) }),

      clearSession: async () => {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => undefined);
        setAuthToken(null);
        set({ token: null, user: null });
      },
    }),
    {
      name: SESSION_KEY,
      storage: createJSONStorage(() => secureStorage),
      // Only the identity snapshot goes through `persist`. The token is written
      // to its own SecureStore key so `api/client.ts` can read it directly.
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => async (state) => {
        // Restore the token from its canonical key and push it into the axios
        // client, so the first request after launch is already authenticated.
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY).catch(() => null);
        setAuthToken(token);
        useAuthStore.setState({ token, hasHydrated: true });

        // A stored identity with no token is a broken session (token revoked,
        // or SecureStore cleared). Drop the orphan rather than render as
        // signed-in and 401 on the first request.
        if (!token && state?.user) {
          useAuthStore.setState({ user: null });
        }
      },
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.token !== null);
}

export function useCurrentUser(): SessionUser | null {
  return useAuthStore((s) => s.user);
}

export function useAuthHydrated(): boolean {
  return useAuthStore((s) => s.hasHydrated);
}
