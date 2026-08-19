/**
 * Profile and addresses.
 *
 * `GET /me` is the source of truth for the user. `useAuthStore` keeps only a
 * small identity snapshot for synchronous rendering, and is re-synced from
 * here whenever the server's copy changes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as profileApi from '../../api/endpoints/profile';
import type {
  UpdateDietaryPayload,
  UpdateProfilePayload,
  User,
} from '../../api/types/auth';
import { useAuthStore } from '../../store/useAuthStore';
import { queryKeys } from '../keys';

export function useProfile() {
  const isAuthenticated = useAuthStore((s) => s.token !== null);

  return useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: profileApi.getProfile,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const syncUser = useAuthStore((s) => s.syncUser);

  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileApi.updateProfile(payload),
    onSuccess: (user: User) => {
      // Seed rather than invalidate — the response IS the updated user.
      queryClient.setQueryData(queryKeys.profile.me(), user);
      syncUser(user);
    },
  });
}

/**
 * Dietary preferences.
 *
 * These are applied server-side when building swap options — an allergen
 * listed here removes matching items from every swap list — so the swap cache
 * is invalidated too, or the customer would keep being offered a dish they
 * just excluded.
 */
export function useUpdateDietaryPreferences() {
  const queryClient = useQueryClient();
  const syncUser = useAuthStore((s) => s.syncUser);

  return useMutation({
    mutationFn: (payload: UpdateDietaryPayload) =>
      profileApi.updateDietaryPreferences(payload),
    onSuccess: (user: User) => {
      queryClient.setQueryData(queryKeys.profile.me(), user);
      syncUser(user);
      queryClient.invalidateQueries({ queryKey: queryKeys.swap.all() });
    },
  });
}

// ── Addresses ────────────────────────────────────────────────────────────────

export function useAddresses() {
  const isAuthenticated = useAuthStore((s) => s.token !== null);

  return useQuery({
    queryKey: queryKeys.profile.addresses(),
    queryFn: profileApi.getAddresses,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileApi.createAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Parameters<typeof profileApi.updateAddress>[1];
    }) => profileApi.updateAddress(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileApi.deleteAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
    },
  });
}

/**
 * Setting a default flips `is_default` on the previous default too, so the
 * whole list is invalidated rather than patched.
 */
export function useSetDefaultAddress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profileApi.setDefaultAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.addresses() });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
    },
  });
}
