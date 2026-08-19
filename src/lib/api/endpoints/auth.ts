/**
 * Auth endpoints — `routes/api_auth.php`.
 *
 * All four are rate-limited by the `throttle:auth` middleware, so a 429 here
 * is expected under retry pressure and surfaces as `code: 'rate_limited'`.
 */
import { apiClient, unwrap } from '../client';
import { normalizeAddress } from '../normalize';
import type {
  AuthResult,
  LoginPayload,
  RegisterPayload,
  User,
} from '../types/auth';
import type { ApiEnvelope } from '../types/common';

type Raw = Record<string, unknown>;

/** Users carry no decimals, so only the nested address needs normalising. */
export function normalizeUser(raw: Raw): User {
  const defaultAddress = raw.default_address as Raw | null | undefined;
  return {
    id: raw.id as number,
    name: raw.name as string,
    email: raw.email as string,
    phone: (raw.phone as string | null) ?? null,
    phone_verified: Boolean(raw.phone_verified),
    email_verified: Boolean(raw.email_verified),
    locale: (raw.locale as string | null) ?? null,
    dietary_preferences: (raw.dietary_preferences as User['dietary_preferences']) ?? null,
    default_address_id: (raw.default_address_id as number | null) ?? null,
    default_address: defaultAddress ? normalizeAddress(defaultAddress) : undefined,
    default_slot_id: (raw.default_slot_id as number | null) ?? null,
    status: raw.status as User['status'],
    roles: raw.roles as User['roles'],
  };
}

function normalizeAuthResult(raw: Raw): AuthResult {
  return {
    user: normalizeUser(raw.user as Raw),
    token: raw.token as string,
  };
}

/** POST /auth/login → `{ data: { user, token } }` */
export async function login(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/login', {
    device_name: 'ahaar-mobile',
    ...payload,
  });
  return normalizeAuthResult(unwrap(data));
}

/** POST /auth/register → 201 `{ data: { user, token } }` */
export async function register(payload: RegisterPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/register', {
    device_name: 'ahaar-mobile',
    ...payload,
  });
  return normalizeAuthResult(unwrap(data));
}

/**
 * POST /auth/logout — revokes the current Sanctum token server-side.
 * Callers should clear local auth state regardless of whether this succeeds.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/** POST /auth/forgot-password */
export async function forgotPassword(email: string): Promise<void> {
  await apiClient.post('/auth/forgot-password', { email });
}

/** POST /auth/reset-password */
export async function resetPassword(payload: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  await apiClient.post('/auth/reset-password', payload);
}
