/**
 * Whether the welcome tour has been shown on this install.
 *
 * Persisted to AsyncStorage rather than SecureStore or the server: it isn't
 * sensitive, and "once per install" is exactly what AsyncStorage gives us for
 * free — it survives app updates and relaunches, and is wiped when the app is
 * uninstalled. There is deliberately no server field for this: someone
 * reinstalling on a new phone *should* see the tour again, and someone who has
 * never signed in has no account to hang the flag off in the first place.
 *
 * `hasHydrated` matters as much as the flag itself. Reading AsyncStorage is
 * async, so on a cold start `hasSeenOnboarding` is `false` for a few frames on
 * *every* launch. Acting on that value before hydration would throw a returning
 * customer back into the tour each time they open the app — so `OnboardingGate`
 * waits, and `AnimatedSplash` stays up until this store has been read back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface OnboardingState {
  /** True once the tour has been finished or skipped on this install. */
  hasSeenOnboarding: boolean;
  /** False until AsyncStorage has been read back — don't route before then. */
  hasHydrated: boolean;

  /** Called by both "Get Started" and "Skip": either way, it has been seen. */
  completeOnboarding: () => void;
  /** Shows the tour again on the next launch. For QA and the dev menu. */
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      hasHydrated: false,

      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      resetOnboarding: () => set({ hasSeenOnboarding: false }),
    }),
    {
      name: 'ahaar.onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      // `hasHydrated` describes this runtime, not the install — writing it
      // would make the very first read report "already hydrated".
      partialize: (state) => ({ hasSeenOnboarding: state.hasSeenOnboarding }),
      // Runs on success *and* on a read failure (corrupt entry, storage full).
      // Either way the gate has to be unblocked, or the splash never leaves;
      // the cost of a failed read is one extra showing of the tour.
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** True once the persisted flag has been read — see the note above. */
export const useOnboardingHydrated = () =>
  useOnboardingStore((state) => state.hasHydrated);

/** True only when the tour still needs showing *and* we know that for sure. */
export const useNeedsOnboarding = () =>
  useOnboardingStore((state) => state.hasHydrated && !state.hasSeenOnboarding);
