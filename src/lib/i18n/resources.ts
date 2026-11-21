/**
 * Static imports — Metro has no glob import. Adding an area means adding a
 * JSON file per locale AND a line in `area()` below.
 */
import arAccount from './locales/ar/account.json';
import arAuth from './locales/ar/auth.json';
import arCatalog from './locales/ar/catalog.json';
import arCommon from './locales/ar/common.json';
import arHome from './locales/ar/home.json';
import arLocation from './locales/ar/location.json';
import arOrdering from './locales/ar/ordering.json';
import arProfile from './locales/ar/profile.json';
import arTabs from './locales/ar/tabs.json';
import arUi from './locales/ar/ui.json';
import bnAccount from './locales/bn/account.json';
import bnAuth from './locales/bn/auth.json';
import bnCatalog from './locales/bn/catalog.json';
import bnCommon from './locales/bn/common.json';
import bnHome from './locales/bn/home.json';
import bnLocation from './locales/bn/location.json';
import bnOrdering from './locales/bn/ordering.json';
import bnProfile from './locales/bn/profile.json';
import bnTabs from './locales/bn/tabs.json';
import bnUi from './locales/bn/ui.json';
import enAccount from './locales/en/account.json';
import enAuth from './locales/en/auth.json';
import enCatalog from './locales/en/catalog.json';
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enLocation from './locales/en/location.json';
import enOrdering from './locales/en/ordering.json';
import enProfile from './locales/en/profile.json';
import enTabs from './locales/en/tabs.json';
import enUi from './locales/en/ui.json';

export const resources = {
  en: {
    translation: {
      common: enCommon, tabs: enTabs, home: enHome, catalog: enCatalog, ui: enUi,
      auth: enAuth, profile: enProfile, account: enAccount, ordering: enOrdering, location: enLocation,
    },
  },
  bn: {
    translation: {
      common: bnCommon, tabs: bnTabs, home: bnHome, catalog: bnCatalog, ui: bnUi,
      auth: bnAuth, profile: bnProfile, account: bnAccount, ordering: bnOrdering, location: bnLocation,
    },
  },
  ar: {
    translation: {
      common: arCommon, tabs: arTabs, home: arHome, catalog: arCatalog, ui: arUi,
      auth: arAuth, profile: arProfile, account: arAccount, ordering: arOrdering, location: arLocation,
    },
  },
} as const;
