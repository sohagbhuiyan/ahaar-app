/**
 * Whether there is a session, for gating queries.
 *
 * Every hook that reads a customer-owned endpoint (`/me`, `/subscriptions`,
 * `/deliveries`, `/orders`, `/addresses`, quota, swap options) passes this to
 * `enabled`. Without it, browsing the public catalogue signed out would fire a
 * volley of requests that can only 401 — each one tripping the global
 * unauthorized handler and popping a sign-in prompt at someone who was just
 * looking at the menu.
 *
 * `token`, not `user`: the token is what the request actually needs, and the
 * identity snapshot can briefly lag it during rehydration.
 */
import { useAuthStore } from '../../store/useAuthStore';

export function useIsSignedIn(): boolean {
  return useAuthStore((s) => s.token !== null);
}
