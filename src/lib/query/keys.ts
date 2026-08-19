/**
 * Centralised query-key factory.
 *
 * Every `useQuery` and every `invalidateQueries` call must build its key from
 * here — never a hand-rolled array. Keys are hierarchical so a broad
 * invalidation (`queryKeys.menu.all()`) sweeps every narrower key beneath it.
 *
 * Shape mirrors the web app's `ahaar/src/lib/queryKeys.ts`, minus everything
 * under `admin` — this app is user-facing only.
 */
import type { MenuItemFilters } from '../api/types/catalog';
import type { DeliveryFilters } from '../api/types/subscription';
import type { PageParams } from '../api/types/common';

export const queryKeys = {
  /**
   * Homepage CMS content — the sections and banners an admin configured for
   * this app. A public read, so it deliberately stays out of
   * PRIVATE_QUERY_ROOTS and survives a sign-out.
   */
  home: {
    all: () => ['home'] as const,
    content: () => ['home', 'content'] as const,
  },

  /** Public catalogue — subscription plans. */
  plans: {
    all: () => ['plans'] as const,
    list: () => ['plans', 'list'] as const,
    detail: (id: string | number) => ['plans', 'detail', String(id)] as const,
  },

  /** Public catalogue — delivery slots (lunch, dinner…). */
  deliverySlots: {
    all: () => ['delivery-slots'] as const,
    list: () => ['delivery-slots', 'list'] as const,
  },

  /** Public catalogue — menu items, behind the Foods tab. */
  foods: {
    all: () => ['foods'] as const,
    list: (filters?: MenuItemFilters) => ['foods', 'list', filters ?? {}] as const,
    detail: (id: string | number) => ['foods', 'detail', String(id)] as const,
    addons: () => ['foods', 'addons'] as const,
  },

  /**
   * The subscriber's day-by-day deliveries — the Menu tab. Not a catalogue:
   * these are the customer's own scheduled days.
   */
  menu: {
    all: () => ['menu'] as const,
    deliveries: (filters?: DeliveryFilters) =>
      ['menu', 'deliveries', filters ?? {}] as const,
    detail: (deliveryId: string | number) =>
      ['menu', 'deliveries', 'detail', String(deliveryId)] as const,
  },

  subscription: {
    all: () => ['subscription'] as const,
    list: (params?: PageParams) => ['subscription', 'list', params ?? {}] as const,
    detail: (id: string | number) =>
      ['subscription', 'detail', String(id)] as const,
    /** The single most relevant subscription, derived from the list. */
    current: () => ['subscription', 'current'] as const,
  },

  /** Entitlement quota (per item, per week). Not kitchen capacity. */
  quota: {
    all: () => ['quota'] as const,
    bySubscription: (subscriptionId: string | number) =>
      ['quota', 'subscription', String(subscriptionId)] as const,
  },

  /** Swap options for one delivery. */
  swap: {
    all: () => ['swap'] as const,
    options: (deliveryId: string | number) =>
      ['swap', 'options', String(deliveryId)] as const,
  },

  orders: {
    all: () => ['orders'] as const,
    /**
     * One key for the whole history — `GET /orders` takes no filter params, so
     * a per-filter key would just duplicate the same bytes under new names.
     */
    list: () => ['orders', 'list'] as const,
    detail: (id: string | number) => ['orders', 'detail', String(id)] as const,
  },

  /** The customer's own charge history. */
  payments: {
    all: () => ['payments'] as const,
    list: () => ['payments', 'list'] as const,
    detail: (id: string | number) => ['payments', 'detail', String(id)] as const,
  },

  profile: {
    all: () => ['profile'] as const,
    me: () => ['profile', 'me'] as const,
    addresses: () => ['profile', 'addresses'] as const,
  },

  /** Add-ons per delivery. Stubbed until the backend ships them. */
  addons: {
    all: () => ['addons'] as const,
    byDelivery: (deliveryId: string | number) =>
      ['addons', 'delivery', String(deliveryId)] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;

/**
 * Query roots that belong to *one signed-in customer*.
 *
 * Everything listed here sits behind `auth:sanctum` on the API and must be
 * evicted when a session ends — on sign-out, and on the 401 that means a token
 * was revoked. What is *not* listed is just as deliberate: `plans`,
 * `delivery-slots` and `foods` are public reads (see the "Public reads (no
 * auth)" group in `routes/api_customer.php`), so they survive a session change
 * instead of leaving a signed-out visitor staring at an empty catalogue.
 */
export const PRIVATE_QUERY_ROOTS: readonly (readonly string[])[] = [
  queryKeys.profile.all(),
  queryKeys.subscription.all(),
  queryKeys.menu.all(),
  queryKeys.quota.all(),
  queryKeys.swap.all(),
  queryKeys.orders.all(),
  queryKeys.payments.all(),
  queryKeys.addons.all(),
];
