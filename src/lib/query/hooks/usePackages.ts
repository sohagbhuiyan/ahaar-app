/**
 * Packages — bundles sold at one price, outside the subscription.
 *
 * Catalogue data, and public: cached for a while rather than refetched on every
 * screen that offers an extra, and left out of `PRIVATE_QUERY_ROOTS` so a
 * sign-out doesn't empty it.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as packagesApi from '../../api/endpoints/packages';
import { isNotFound } from '../../api/types/common';
import { queryKeys } from '../keys';

const PACKAGES_STALE_MS = 5 * 60 * 1000;

export function usePackages() {
  return useQuery({
    queryKey: queryKeys.packages.list(),
    queryFn: packagesApi.getPackages,
    staleTime: PACKAGES_STALE_MS,
  });
}

/**
 * One box. A 404 means it left the shelf — unpublished, or one of its dishes
 * was — so the cached list is refreshed as well. See `usePlan`.
 */
export function usePackage(id: string | number | undefined) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.packages.detail(id ?? ''),
    queryFn: async () => {
      try {
        return await packagesApi.getPackage(id!);
      } catch (error) {
        if (isNotFound(error)) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.packages.list() });
        }
        throw error;
      }
    },
    enabled: id !== undefined && id !== '',
    staleTime: PACKAGES_STALE_MS,
  });
}
