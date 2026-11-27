/**
 * Auth endpoints — `routes/api_auth.php`.
 *
 * All of them are rate-limited by the `throttle:auth` middleware, so a 429 here
 * is expected under retry pressure and surfaces as `code: 'rate_limited'`.
 */
import { apiClient, unwrap } from '../client';
import { normalizeAddress } from '../normalize';
import type {
  AuthResult,
  EmailVerificationChallenge,
  LoginPayload,
  RegisterPayload,
  ResendEmailCodeResult,
  User,
  VerifyEmailPayload,
} from '../types/auth';
import { isApiError, type ApiEnvelope } from '../types/common';

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
    avatar_url: (raw.avatar_url as string | null | undefined) ?? null,
    google_linked: Boolean(raw.google_linked),
    // Absent from an older API: assume a password, so nothing offers to
    // strand the customer.
    has_password: raw.has_password !== false,
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
    isNewUser: Boolean(raw.is_new_user),
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

function normalizeChallenge(raw: Raw, fallbackEmail = ''): EmailVerificationChallenge {
  return {
    verification_required: raw.verification_required !== false,
    email: (raw.email as string | undefined) ?? fallbackEmail,
    otp_sent: raw.otp_sent !== false,
    expires_in: Number(raw.expires_in ?? 300),
    resend_available_in: Math.max(0, Number(raw.resend_available_in ?? 0)),
  };
}

/**
 * POST /auth/register → 201 `{ data: { verification_required, email, otp_sent,
 * expires_in, resend_available_in } }`.
 *
 * No token: the account is signed in only once its email is verified with
 * the mailed code (`verifyEmail`). Re-registering an email that is still
 * unverified answers the same 201, so the customer simply lands on the code
 * screen again.
 */
export async function register(payload: RegisterPayload): Promise<EmailVerificationChallenge> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/register', payload);
  return normalizeChallenge(unwrap(data), payload.email);
}

/**
 * POST /auth/email/verify → `{ data: { user, token } }` — the login shape.
 *
 * 422 refusals carry `code`: `otp_invalid` (with `attempts_remaining`),
 * `otp_expired` and `otp_attempts_exceeded` (both need a new code).
 */
export async function verifyEmail(payload: VerifyEmailPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/email/verify', {
    device_name: 'ahaar-mobile',
    ...payload,
  });
  return normalizeAuthResult(unwrap(data));
}

/**
 * POST /auth/email/resend → `{ data: { expires_in, resend_available_in } }`.
 *
 * 429 `otp_resend_throttled` carries `retry_after`; 503 `otp_delivery_failed`
 * means the mail could not be sent.
 */
export async function resendEmailCode(email: string): Promise<ResendEmailCodeResult> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/email/resend', { email });
  const raw = unwrap(data) ?? {};
  return {
    expires_in: Number(raw.expires_in ?? 300),
    resend_available_in: Math.max(0, Number(raw.resend_available_in ?? 60)),
  };
}

/**
 * The verification challenge behind a refused sign-in — 403 `email_unverified`
 * from `POST /auth/login` — or `null` for any other error.
 */
export function emailVerificationChallengeFrom(
  error: unknown,
  fallbackEmail = '',
): EmailVerificationChallenge | null {
  if (!isApiError(error) || error.status !== 403) return null;
  const details = error.details as { code?: string; data?: Raw } | undefined;
  if (details?.code !== 'email_unverified') return null;
  return normalizeChallenge(details.data ?? {}, fallbackEmail);
}

/** The domain `code` on an API refusal (`otp_invalid`, …), if it has one. */
export function apiErrorDomainCode(error: unknown): string | undefined {
  if (!isApiError(error)) return undefined;
  const code = (error.details as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

/**
 * POST /auth/google/token → `{ data: { user, token, is_new_user } }`
 *
 * The API verifies the ID token with Google. An existing account with the same
 * (Google-verified) email is signed in and connected rather than duplicated.
 * Refusals are 422s with a `reason`: `account_inactive`, `email_unverified`,
 * `account_conflict`, `invalid_token`, …
 */
export async function loginWithGoogle(idToken: string): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>('/auth/google/token', {
    id_token: idToken,
    device_name: 'ahaar-mobile',
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
