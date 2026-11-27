/**
 * Auth + profile shapes.
 *
 * Mirrors `App\Http\Resources\Customer\UserResource` and the auth payloads.
 * `POST /auth/login` and `POST /auth/email/verify` return
 * `{ data: { user, token }, message }` with a Sanctum plain-text token;
 * `POST /auth/register` returns no token, only an email-verification
 * challenge (see `EmailVerificationChallenge`).
 */
import type { Address } from './catalog';

export type UserRole = 'customer' | 'admin' | 'finance' | 'kitchen' | 'ops';

export type UserStatus = 'active' | 'suspended' | 'pending';

/** Free-form diet preferences; the backend stores this as a JSON column. */
export interface DietaryPreferences {
  tags?: string[];
  avoid_allergens?: string[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  /** Photo from Google, for accounts that have signed in with it. */
  avatar_url: string | null;
  /** Google is connected, so the customer can sign in with it. */
  google_linked: boolean;
  /** False for an account created through Google that hasn't set a password. */
  has_password: boolean;
  locale: string | null;
  dietary_preferences: DietaryPreferences | null;
  default_address_id: number | null;
  /** Only present when the endpoint eager-loads it. */
  default_address?: Address | null;
  default_slot_id: number | null;
  status: UserStatus;
  /**
   * Name, phone and a default delivery address are all present. False means
   * no order or subscription yet: `AuthGate` suggests completing it once per
   * launch, and the API answers purchases with 403 `profile_incomplete`,
   * which does send the customer to the complete-profile screen. Optional so
   * an older API never blocks anyone.
   */
  profile_complete?: boolean;
  /** What is still missing, in the API's terms. */
  profile_missing?: ('name' | 'phone' | 'address')[];
  /** Only present when the endpoint eager-loads roles (login/register do). */
  roles?: UserRole[];
}

export interface AuthResult {
  user: User;
  token: string;
  /** Google sign-in only: the account was created by this sign-in. */
  isNewUser?: boolean;
}

/**
 * What the API answers when an email account still has to prove its address:
 * `POST /auth/register` → 201 `{ data }`, and `POST /auth/login` → 403
 * `{ code: 'email_unverified', data }` for an unverified customer (only once
 * the password was right). No session exists yet — the customer enters the
 * 6-digit code mailed to `email` on the verify-email screen.
 */
export interface EmailVerificationChallenge {
  verification_required: boolean;
  email: string;
  /** False when no new code went out (a recent one is still valid). */
  otp_sent: boolean;
  /** Seconds the current code stays valid. */
  expires_in: number;
  /** Seconds until another code may be requested. */
  resend_available_in: number;
}

/** POST /auth/email/verify */
export interface VerifyEmailPayload {
  email: string;
  /** The 6 digits from the email. */
  code: string;
  device_name?: string;
}

/** POST /auth/email/resend → `{ data }` */
export interface ResendEmailCodeResult {
  expires_in: number;
  resend_available_in: number;
}

/**
 * Domain codes the email-OTP endpoints put on their refusals (`body.code`,
 * read from `ApiError.details.code`).
 */
export type EmailOtpErrorCode =
  | 'otp_invalid'
  | 'otp_expired'
  | 'otp_attempts_exceeded'
  | 'otp_resend_throttled'
  | 'otp_delivery_failed';

export interface LoginPayload {
  email: string;
  password: string;
  /** Names the Sanctum token; defaults to 'api' server-side. */
  device_name?: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
  locale?: string;
}

/** PATCH /me */
export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  locale?: string;
  default_address_id?: number | null;
  default_slot_id?: number | null;
}

/** PATCH /me/dietary-preferences */
export interface UpdateDietaryPayload {
  tags?: string[];
  avoid_allergens?: string[];
}
