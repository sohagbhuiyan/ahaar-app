/**
 * Auth + profile shapes.
 *
 * Mirrors `App\Http\Resources\Customer\UserResource` and the
 * `POST /auth/login` / `POST /auth/register` payloads, which both return
 * `{ data: { user, token }, message }` with a Sanctum plain-text token.
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
  locale: string | null;
  dietary_preferences: DietaryPreferences | null;
  default_address_id: number | null;
  /** Only present when the endpoint eager-loads it. */
  default_address?: Address | null;
  default_slot_id: number | null;
  status: UserStatus;
  /** Only present when the endpoint eager-loads roles (login/register do). */
  roles?: UserRole[];
}

export interface AuthResult {
  user: User;
  token: string;
}

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
  device_name?: string;
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
