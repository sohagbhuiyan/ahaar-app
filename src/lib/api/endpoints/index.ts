/**
 * Barrel for the endpoint modules. Namespaced rather than flat, because several
 * domains legitimately want the same verb (`getQuota`, `getDeliveries`, …) and
 * `api.subscriptions.getQuota(id)` reads better at the call site than a
 * disambiguated free function.
 */
import * as addons from './addons';
import * as auth from './auth';
import * as foods from './foods';
import * as home from './home';
import * as media from './media';
import * as menu from './menu';
import * as orders from './orders';
import * as packages from './packages';
import * as plans from './plans';
import * as profile from './profile';
import * as quota from './quota';
import * as subscriptions from './subscriptions';
import * as swap from './swap';

export const api = {
  addons,
  auth,
  foods,
  home,
  media,
  menu,
  orders,
  packages,
  plans,
  profile,
  quota,
  subscriptions,
  swap,
} as const;

export {
  addons,
  auth,
  foods,
  home,
  media,
  menu,
  orders,
  packages,
  plans,
  profile,
  quota,
  subscriptions,
  swap,
};
