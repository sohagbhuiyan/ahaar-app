import { useGuestLocationSync } from '@/lib/query/hooks';

/**
 * Saves a signed-out visitor's delivery location to their account once they
 * sign in. Renders nothing; mounted once at the root so it runs however the
 * customer came to sign in — from Home, checkout or the account tab.
 */
export function LocationSync() {
  useGuestLocationSync();
  return null;
}
