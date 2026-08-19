import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useAuthHydrated, useIsAuthenticated } from '@/lib/store';

/**
 * Keeps the route tree and the session in agreement.
 *
 * There is deliberately only **one** rule left here: a signed-in customer has
 * no business sitting on the login screen, so send them to the tabs.
 *
 * The inverse rule — "signed out, anywhere but `(auth)` → go to login" — used
 * to live here and has been removed on purpose. The whole app is browsable
 * without an account: the catalogue, plans, dish details and the plan schedule
 * are public reads on the API (`routes/api_customer.php` puts them outside the
 * `auth:sanctum` group), so gating them client-side was a restriction the
 * backend never asked for. Authentication is now demanded per *action* instead
 * — see `useRequireAuth` and `LoginPrompt` — which keeps a visitor's place and
 * their half-built order intact.
 *
 * Nothing runs until `hasHydrated` is true: persist rehydration is async, and
 * acting on a not-yet-read session would bounce people around on cold start.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const hydrated = useAuthHydrated();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [hydrated, isAuthenticated, segments, router]);

  return <>{children}</>;
}
