/**
 * Auth mutations.
 *
 * The store owns the session (token + identity snapshot); these wrap its
 * actions so screens get the usual `isPending` / `error` handling, and so the
 * query cache is reset at the right moments.
 *
 * ── Order matters on sign-in ────────────────────────────────────────────────
 * Private queries are cleared *before* the token is stored, never after. The
 * moment the token lands, every mounted private query (`/me`, subscriptions,
 * orders, payments) flips to `enabled` and starts fetching. Clearing after that
 * point removed those in-flight queries from the cache, which cancels their
 * fetches silently: the screens stayed on their skeletons with nothing left to
 * wake them, and the Account tab only filled in after a pull-to-refresh.
 * Cleared first, the observers simply attach to fresh queries when the token
 * re-renders them.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { LoginPayload, RegisterPayload, User } from '../../api/types/auth';
import { requestGoogleIdToken } from '../../auth/google';
import { useAuthStore } from '../../store/useAuthStore';
import { useCartStore } from '../../store/useCartStore';
import { useInstantOrderStore } from '../../store/useInstantOrderStore';
import { useLocationStore } from '../../store/useLocationStore';
import { queryKeys } from '../keys';
import { clearPrivateQueries } from '../session';

/**
 * Everything a brand-new session needs once the token exists.
 *
 * The auth response carries the same `UserResource` as `GET /me`, so the
 * profile renders immediately instead of waiting on a second round-trip. It is
 * still invalidated: the login payload omits `default_address`, which only
 * `/me` loads, and the fresh read fills it in behind the seeded copy.
 */
function beginSession(queryClient: QueryClient, user: User) {
  queryClient.setQueryData(queryKeys.profile.me(), user);
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });

  // A new session is asked for a delivery location again if it has none —
  // the address is what every order and plan delivers to.
  useLocationStore.getState().resetLocationPrompt();
}

export function useLogin(options?: { onSuccess?: (user: User) => void }) {
  const queryClient = useQueryClient();
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      // Any *private* entry cached before sign-in belongs to no one, or to the
      // previous account — start the session without it. The public catalogue
      // stays: it is the same bytes for every visitor, and dropping it would
      // make signing in look like the app reloading from scratch.
      //
      // Not awaited. The eviction itself is synchronous and has happened by
      // the time this returns; only the disk write is left, and that goes
      // through the persister's 1s throttle — awaiting it held the sign-in
      // request back by up to a second after any recent cache write.
      void clearPrivateQueries(queryClient);
      return login(payload);
    },
    onSuccess: (user) => {
      beginSession(queryClient, user);
      options?.onSuccess?.(user);
    },
  });
}

export function useRegister(options?: { onSuccess?: (user: User) => void }) {
  const queryClient = useQueryClient();
  const register = useAuthStore((s) => s.register);

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      // Evicted synchronously, before the token; the disk write isn't awaited
      // for the same reason as sign-in.
      void clearPrivateQueries(queryClient);
      return register(payload);
    },
    onSuccess: (user) => {
      beginSession(queryClient, user);
      options?.onSuccess?.(user);
    },
  });
}

/**
 * "Continue with Google", for signing in and signing up alike: the API creates
 * the account when there isn't one, and connects Google to an existing account
 * with the same email when there is.
 *
 * Resolves with `null` when the customer backs out of Google's picker. That is
 * not an error, so `onSuccess` only fires for a real sign-in.
 */
export function useGoogleLogin(options?: {
  onSuccess?: (user: User, isNewUser: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);

  return useMutation({
    mutationFn: async () => {
      // Google's picker first: backing out of it must not wipe anything.
      const idToken = await requestGoogleIdToken();
      if (!idToken) return null;

      // Same ordering rule as `useLogin`: evict private queries before the token.
      void clearPrivateQueries(queryClient);
      return loginWithGoogle(idToken);
    },
    onSuccess: (result) => {
      if (!result) return;
      beginSession(queryClient, result.user);
      options?.onSuccess?.(result.user, result.isNewUser);
    },
  });
}

/**
 * Sign out.
 *
 * Drops every private query (in memory and on disk) plus both drafts — a
 * subscription or basket assembled by one account must not greet the next
 * person to open the app. The public catalogue survives, so signing out lands
 * on a browsable app rather than a blank one.
 *
 * Clearing *after* the token is gone is safe here, unlike sign-in: with no
 * token every private query is disabled, so there is no fetch to cancel.
 *
 * `onSettled`, not `onSuccess`: the store's `logout` swallows a failed
 * `POST /auth/logout` on purpose, and a network error must not strand the user
 * inside a signed-in shell.
 */
export function useLogout(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clear);
  const clearBasket = useInstantOrderStore((s) => s.clear);

  return useMutation({
    mutationFn: () => logout(),
    onSettled: async () => {
      clearCart();
      clearBasket();
      await clearPrivateQueries(queryClient);
      options?.onSuccess?.();
    },
  });
}
