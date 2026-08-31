/**
 * Envelope and error shapes shared by every endpoint.
 *
 * The Laravel API wraps every response through `BaseApiController`:
 *   - `ok()` / `created()` → `{ data, message? }`  (message omitted when null)
 *   - `paginated()`        → `{ data, meta }`
 *   - `noContent()`        → 204, empty body
 *
 * Endpoint functions in `../endpoints` unwrap `data` before returning, so
 * hooks and components never see the envelope.
 */

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Normalised error shape produced by the axios response interceptor. Every UI
 * error state consumes this rather than an `AxiosError`, so screens never have
 * to know the transport.
 */
export interface ApiError {
  /** Human-readable, safe to show. Falls back to a generic network message. */
  message: string;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  /** Machine-readable discriminator for branching in UI. */
  code: ApiErrorCode;
  /** Laravel 422 field errors, when present. */
  errors?: Record<string, string[]>;
  /**
   * A domain reason code some 422s carry alongside the sentence, when the
   * refusal is a business rule rather than a field validation. The swap
   * endpoint emits these (`already_swapped`, `past_cutoff`, …) so the UI can
   * branch on the rule instead of matching on prose.
   */
  reason?: string;
}

export type ApiErrorCode =
  | 'network' // no response — offline, DNS, TLS
  | 'timeout'
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'not_found' // 404
  | 'validation' // 422
  | 'rate_limited' // 429
  | 'server' // 5xx
  | 'unknown';

/** Type guard so `catch (e)` blocks can narrow safely. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'status' in value &&
    'message' in value
  );
}

/** Cursor/page params accepted by the paginated list endpoints. */
export interface PageParams {
  page?: number;
}
