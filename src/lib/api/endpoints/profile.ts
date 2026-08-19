/**
 * Profile — the signed-in customer's own record and addresses.
 *
 * All of these sit behind `auth:sanctum` + `role:customer`.
 */
import { apiClient, unwrap } from '../client';
import { normalizeAddress, normalizeList } from '../normalize';
import { normalizeUser } from './auth';
import type { ApiEnvelope } from '../types/common';
import type {
  UpdateDietaryPayload,
  UpdateProfilePayload,
  User,
} from '../types/auth';
import type { Address } from '../types/catalog';

type Raw = Record<string, unknown>;

/** GET /me */
export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>('/me');
  return normalizeUser(unwrap(data));
}

/** PATCH /me */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<User> {
  const { data } = await apiClient.patch<ApiEnvelope<Raw>>('/me', payload);
  return normalizeUser(unwrap(data));
}

/**
 * PATCH /me/dietary-preferences
 *
 * These drive server-side filtering of swap options — an allergen listed here
 * removes matching items from every swap list.
 */
export async function updateDietaryPreferences(
  payload: UpdateDietaryPayload,
): Promise<User> {
  const { data } = await apiClient.patch<ApiEnvelope<Raw>>(
    '/me/dietary-preferences',
    payload,
  );
  return normalizeUser(unwrap(data));
}

// ── Addresses ────────────────────────────────────────────────────────────────

/** GET /addresses */
export async function getAddresses(): Promise<Address[]> {
  const { data } = await apiClient.get<ApiEnvelope<Raw[]>>('/addresses');
  return normalizeList(unwrap(data), normalizeAddress);
}

export type AddressInput = Omit<Address, 'id' | 'is_default'> & {
  is_default?: boolean;
};

/** POST /addresses */
export async function createAddress(
  payload: Partial<AddressInput>,
): Promise<Address> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/addresses', payload);
  return normalizeAddress(unwrap(data));
}

/** PATCH /addresses/{id} */
export async function updateAddress(
  id: number,
  payload: Partial<AddressInput>,
): Promise<Address> {
  const { data } = await apiClient.patch<ApiEnvelope<Raw>>(
    `/addresses/${id}`,
    payload,
  );
  return normalizeAddress(unwrap(data));
}

/** DELETE /addresses/{id} — 204, no body. */
export async function deleteAddress(id: number): Promise<void> {
  await apiClient.delete(`/addresses/${id}`);
}

/** POST /addresses/{id}/set-default */
export async function setDefaultAddress(id: number): Promise<Address> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/addresses/${id}/set-default`,
  );
  return normalizeAddress(unwrap(data));
}
