/**
 * The delivery location on this device — only for someone not signed in.
 *
 * A signed-in customer's current location is their **default address** on the
 * server: one answer shared with checkout, the website and every other device,
 * and nothing is kept here for them. A visitor browsing signed out can't save
 * an address yet, so what they set lives in `guestLocation` until they sign in,
 * when `useGuestLocationSync` saves it to the account and clears it.
 *
 * Location never changes the menu, plans, packages or prices — it only answers
 * "where should this be delivered?".
 *
 * Persisted to AsyncStorage: nothing here is sensitive, and a visitor who set
 * their area yesterday shouldn't be asked again today.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AddressDraft } from '../location/address';

interface LocationState {
  /** Set by a signed-out visitor; saved to the account on sign-in. */
  guestLocation: AddressDraft | null;
  /** The first-use "where should we deliver?" sheet has been offered once. */
  hasPromptedLocation: boolean;
  /** False until AsyncStorage has been read back — don't prompt before then. */
  hasHydrated: boolean;

  setGuestLocation: (draft: AddressDraft | null) => void;
  markPrompted: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      guestLocation: null,
      hasPromptedLocation: false,
      hasHydrated: false,

      setGuestLocation: (guestLocation) => set({ guestLocation }),
      markPrompted: () => set({ hasPromptedLocation: true }),
    }),
    {
      name: 'ahaar.location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        guestLocation: state.guestLocation,
        hasPromptedLocation: state.hasPromptedLocation,
      }),
      onRehydrateStorage: () => () => {
        useLocationStore.setState({ hasHydrated: true });
      },
    },
  ),
);
