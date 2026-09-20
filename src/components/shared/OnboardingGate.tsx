import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useOnboardingStore } from '@/lib/store';

/**
 * Sends a first-time visitor to the welcome tour, once per install.
 *
 * Sits beside `AuthGate` and works the same way — an effect over the current
 * segments rather than a `<Redirect>`, because this wraps the navigator rather
 * than living inside a route.
 *
 * Two things keep this from firing when it shouldn't:
 *
 *  - `hasHydrated`. The persisted flag starts out `false` on every launch and
 *    only becomes true once AsyncStorage has been read, so routing before
 *    hydration would re-run the tour for everyone, every time.
 *  - The segment check. `replace` swaps the route but this effect re-runs on
 *    the resulting segment change, and without the guard it would replace the
 *    tour with itself on each pass.
 *
 * There is no flash of the tabs underneath: `AnimatedSplash` covers the app
 * until this same store has hydrated, which is the moment the redirect fires.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();

  const hydrated = useOnboardingStore((state) => state.hasHydrated);
  const hasSeen = useOnboardingStore((state) => state.hasSeenOnboarding);

  useEffect(() => {
    if (!hydrated || hasSeen) return;
    if (segments[0] === 'onboarding') return;

    // Replace, not push: the tour is not somewhere you go back to, and a
    // pushed route would leave the tabs sitting underneath it.
    router.replace('/onboarding');
  }, [hydrated, hasSeen, segments, router]);

  return <>{children}</>;
}
