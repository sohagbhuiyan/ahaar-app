/**
 * Server-state hooks. One file per domain, each wrapping the thin endpoint
 * functions in `../../api/endpoints`.
 *
 * Every list/detail hook returns the standard TanStack result, so screens have
 * `data`, `isLoading`, `isFetching`, `isError`, `error` and `refetch`
 * available — use `isFetching && !isLoading` to drive pull-to-refresh rather
 * than a full-screen loader on every background refetch.
 */
export { usePlans, usePlan, useFeaturedPlanId, useDeliverySlots, useDeliverySlotMap } from './usePlans';
export {
  useFoods,
  useFilteredFoods,
  useFoodCategories,
  useFood,
  useAddonCatalogue,
} from './useFoods';
export { useIsSignedIn } from './useIsSignedIn';
export { useHomeContent, useHomeLayout, FALLBACK_HOME_LAYOUT, type HomeLayout } from './useHome';
export {
  useDeliveries,
  useDelivery,
  useSubscriptionDeliveries,
  useDeliveriesOnDate,
  useDeliveryDates,
  useTodaysDelivery,
} from './useMenu';
export { useQuota, useQuotaForDate, remainingFor } from './useQuota';
export {
  useSubscriptionSchedule,
  useSwapOptions,
  useSwapTargets,
  useSwapHistory,
  useApplyMealSwap,
  swapError,
} from './useSwap';
export { usePackages, usePackage } from './usePackages';
export {
  useSubscriptions,
  useSubscription,
  useCurrentSubscription,
  useCreateSubscription,
  usePauseSubscription,
  useResumeSubscription,
} from './useSubscription';
export {
  useAddonsApiAvailable,
  useAddPaidAddons,
  useAddFreeAddon,
  useRemoveAddon,
} from './useAddons';
export {
  useOrders,
  useFilteredOrders,
  useOrder,
  useCreateExtraOrder,
  useCreateGuestOrder,
  useCreateInstantOrder,
  useCancelOrder,
} from './useOrders';
export {
  useProfile,
  useUpdateProfile,
  useUpdateDietaryPreferences,
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from './useProfile';
export { usePayments } from './usePayments';
export { useLogin, useRegister, useLogout } from './useAuth';
