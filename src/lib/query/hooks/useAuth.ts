/**
 * Auth mutations.
 *
 * The store owns the session (token + identity snapshot); these wrap its
 * actions so screens get the usual `isPending` / `error` handling, and so the
 * query cache is reset at the right moments.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { LoginPayload, RegisterPayload } from '../../api/types/auth';
import { useAuthStore, type SessionUser } from '../../store/useAuthStore';
import { useCartStore } from '../../store/useCartStore';
import { useInstantOrderStore } from '../../store/useInstantOrderStore';
import { clearPrivateQueries } from '../session';

export function useLogin(options?: { onSuccess?: (user: SessionUser) => void }) {
  const queryClient = useQueryClient();
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: async (user) => {
      // Any *private* entry cached before sign-in belongs to no one, or to the
      // previous account — start the session without it. The public catalogue
      // stays: it is the same bytes for every visitor, and dropping it would
      // make signing in look like the app reloading from scratch.
      await clearPrivateQueries(queryClient);
      options?.onSuccess?.(user);
    },
  });
}

export function useRegister(options?: { onSuccess?: (user: SessionUser) => void }) {
  const queryClient = useQueryClient();
  const register = useAuthStore((s) => s.register);

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: async (user) => {
      await clearPrivateQueries(queryClient);
      options?.onSuccess?.(user);
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
