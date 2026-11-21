// Hermes ships Intl without PluralRules on some versions; i18next needs it
// for plural keys (Arabic has six forms). Installs only when missing.
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { DEFAULT_LOCALE } from './config';
import { resources } from './resources';

/**
 * One i18next namespace ("translation"); each locale file becomes a top-level
 * key, so `t('home.greeting')` reads `locales/<lng>/home.json → greeting`.
 *
 * Fallback chain: requested language → English → the key's last segment.
 * An empty string in bn/ar counts as missing (`returnEmptyString: false`), so a
 * placeholder left by a translator still renders English.
 *
 * The language is set from `useLanguageStore` once its persisted value is
 * read; the root layout holds the splash until then, so nothing renders in
 * the wrong language first.
 */
i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  returnEmptyString: false,
  returnNull: false,
  interpolation: {
    escapeValue: false, // React already escapes
  },
  parseMissingKeyHandler: (key) => key.split('.').pop() ?? key,
  react: {
    useSuspense: false,
  },
});

export default i18n;
