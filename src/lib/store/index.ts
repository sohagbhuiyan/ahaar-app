/**
 * Client/session state. Server data does NOT belong here — that is TanStack
 * Query's job (`../query`). The one deliberate exception is the cart's plan
 * price snapshot, explained in `useCartStore.ts`.
 */
export {
  useAuthStore,
  useIsAuthenticated,
  useCurrentUser,
  useAuthHydrated,
  type SessionUser,
} from './useAuthStore';

export {
  useCartStore,
  useAddonsTotal,
  useCartTotal,
  useCartIsComplete,
  useCartIsStale,
  isCartStale,
  type PlanSnapshot,
  type DraftAddon,
} from './useCartStore';

export { useAuthPromptStore } from './useAuthPromptStore';

export { useFilterStore, useHasActiveFilters } from './useFilterStore';

export {
  useInstantOrderStore,
  useInstantOrderCount,
  useInstantOrderTotal,
  type InstantOrderLine,
} from './useInstantOrderStore';

export { useNetworkStore, useIsOffline } from './useNetworkStore';

export { useUIStore, useIsSheetOpen, type SheetId } from './useUIStore';
