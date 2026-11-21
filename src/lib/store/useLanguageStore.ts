import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n from '../i18n';
import { DEFAULT_LOCALE, isLocale, isRtlLocale, type AppLocale } from '../i18n/config';

export type { AppLocale } from '../i18n/config';

export interface LanguageState {
  locale: AppLocale;
  /** False until the customer picks a language themselves (device default until then). */
  chosen: boolean;
  hydrated: boolean;
  /**
   * Switch the whole app's language. Resolves once i18next has switched; when
   * the switch crosses the LTR/RTL boundary the app restarts itself (React
   * Native can only flip layout direction at startup).
   */
  setLocale: (locale: AppLocale) => Promise<void>;
}

export const LANGUAGE_STORAGE_KEY = 'ahaar.app.locale';

/** The device's first preferred language we speak, else English. */
function deviceLocale(): AppLocale {
  try {
    for (const l of getLocales()) {
      if (isLocale(l.languageCode)) return l.languageCode;
    }
  } catch {
    // native module unavailable (tests, web) — fall through
  }
  return DEFAULT_LOCALE;
}

type Listener = (locale: AppLocale, previous: AppLocale) => void | Promise<void>;
const listeners = new Set<Listener>();

/**
 * Side effects that need things this store must not import (the query client,
 * the API client — which itself reads `getActiveLocale`). `LanguageSync`
 * registers them. Awaited before an RTL restart so they finish first.
 */
export function onLanguageChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Restart the JS bundle so `I18nManager` direction changes take effect. */
async function restartApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Expo Go / dev client without an updates server: the dev reload does
    // the same job.
    if (__DEV__) DevSettings.reload();
  }
}

/**
 * Bring native layout direction in line with `locale`. Returns true when a
 * restart was triggered (the caller should render nothing further).
 */
export function syncLayoutDirection(locale: AppLocale): boolean {
  const rtl = isRtlLocale(locale);
  I18nManager.allowRTL(rtl);
  // Android/iOS swap left/right style props in RTL by default; keep it so
  // existing `ml-*`/`left-*` styles mirror automatically.
  I18nManager.swapLeftAndRightInRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    void restartApp();
    return true;
  }
  return false;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      locale: deviceLocale(),
      chosen: false,
      hydrated: false,
      setLocale: async (next) => {
        const previous = get().locale;
        if (previous === next) return;

        set({ locale: next, chosen: true });
        await i18n.changeLanguage(next);
        await Promise.allSettled([...listeners].map((l) => l(next, previous)));

        if (isRtlLocale(next) !== isRtlLocale(previous)) {
          // Let zustand's persist write land before the bundle restarts.
          await new Promise((r) => setTimeout(r, 150));
          syncLayoutDirection(next);
        }
      },
    }),
    {
      name: LANGUAGE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale, chosen: s.chosen }),
      onRehydrateStorage: () => (state) => {
        const stored = state?.locale;
        // Not chosen yet → follow the device, which may have changed.
        const locale = state?.chosen && isLocale(stored) ? stored : deviceLocale();
        void i18n.changeLanguage(locale).finally(() => {
          useLanguageStore.setState({ locale, hydrated: true });
        });
      },
    },
  ),
);

/** Synchronous getter for non-React code (the axios request interceptor). */
export function getActiveLocale(): AppLocale {
  return useLanguageStore.getState().locale || DEFAULT_LOCALE;
}

export function useAppLocale(): AppLocale {
  return useLanguageStore((s) => s.locale);
}

export function useLanguageHydrated(): boolean {
  return useLanguageStore((s) => s.hydrated);
}
