/**
 * The single axios instance for the whole app.
 *
 * Token handling mirrors the web app's `setAxiosAuthToken` pattern: the token
 * lives in a module-level variable that `useAuthStore` pushes into on login,
 * hydration and logout. Keeping it here rather than importing the store avoids
 * a client ↔ store import cycle. On a cold start the store may not have
 * hydrated before the first request fires, so the request interceptor falls
 * back to reading SecureStore directly and caches what it finds.
 */
import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

import type { ApiEnvelope, ApiError, ApiErrorCode } from './types/common';

/** SecureStore key. Also used by `useAuthStore`'s storage adapter. */
export const AUTH_TOKEN_KEY = 'ahaar.auth.token';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) {
  // Failing loudly beats every request 404-ing against `undefined/...`.
  console.warn(
    '[api] EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env.local and restart the dev server.',
  );
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15_000,
});

// ── Token ────────────────────────────────────────────────────────────────────

let authToken: string | null = null;
/** Guards against a stampede of SecureStore reads on cold start. */
let tokenHydration: Promise<string | null> | null = null;

/** Called by `useAuthStore` on login / hydrate / logout. */
export function setAuthToken(token: string | null): void {
  authToken = token;
  tokenHydration = null;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function resolveToken(): Promise<string | null> {
  if (authToken) return authToken;

  tokenHydration ??= SecureStore.getItemAsync(AUTH_TOKEN_KEY)
    .then((stored) => {
      authToken = stored;
      return stored;
    })
    .catch(() => null);

  return tokenHydration;
}

// ── Unauthorized handling ────────────────────────────────────────────────────

type UnauthorizedHandler = () => void | Promise<void>;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered once at app start (see `app/_layout.tsx`). Runs when the API
 * rejects a token: clear auth state and send the user to login.
 *
 * NOTE: there is deliberately no silent refresh here. The backend issues
 * Laravel Sanctum personal access tokens, which do not expire and have no
 * refresh endpoint — `routes/api_auth.php` exposes only register / login /
 * logout / password / phone-OTP. A 401 therefore means the token was revoked
 * or the account was deactivated, and the only correct response is to
 * re-authenticate. If a refresh endpoint is added later, this is where the
 * retry-once logic belongs.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// ── Interceptors ─────────────────────────────────────────────────────────────

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await resolveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const normalized = normalizeError(error);

    if (normalized.status === 401) {
      setAuthToken(null);
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => undefined);
      await onUnauthorized?.();
    }

    return Promise.reject(normalized);
  },
);

// ── Error normalisation ──────────────────────────────────────────────────────

interface LaravelErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** Everything a screen shows on failure comes from here — never a raw axios error. */
export function normalizeError(error: AxiosError): ApiError {
  if (error.code === 'ECONNABORTED') {
    return {
      message: 'That took too long. Check your connection and try again.',
      status: 0,
      code: 'timeout',
    };
  }

  if (!error.response) {
    return {
      message: "Can't reach Ahaar right now. Check your connection and try again.",
      status: 0,
      code: 'network',
    };
  }

  const { status } = error.response;
  const body = error.response.data as LaravelErrorBody | undefined;
  const code = codeForStatus(status);

  // Laravel's own `message` is customer-safe for 4xx (validation summaries,
  // "Delivery is past cutoff", …). 5xx bodies can leak internals, so those get
  // a generic string instead.
  const message =
    code === 'server' || !body?.message
      ? fallbackMessage(code)
      : body.message;

  return { message, status, code, errors: body?.errors };
}

function fallbackMessage(code: ApiErrorCode): string {
  switch (code) {
    case 'unauthorized':
      return 'Please sign in again.';
    case 'forbidden':
      return "You don't have access to that.";
    case 'not_found':
      return "We couldn't find that.";
    case 'rate_limited':
      return 'Too many attempts. Please wait a moment.';
    case 'server':
      return 'Something went wrong on our end. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// ── Response helpers ─────────────────────────────────────────────────────────

/**
 * Unwraps `{ data, message? }`. Every endpoint function goes through this so
 * the envelope never escapes the API layer.
 */
export function unwrap<T>(payload: ApiEnvelope<T>): T {
  return payload.data;
}
