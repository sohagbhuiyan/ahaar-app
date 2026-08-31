/**
 * Packages — bundles sold at one price, outside the subscription.
 *
 * Catalogue data, and public: cached for a while rather than refetched on every
 * screen that offers an extra, and left out of `PRIVATE_QUERY_ROOTS` so a
 * sign-out doesn't empty it.
 */
import { useQuery } from '@tanstack/react-query';

import * as packagesApi from '../../api/endpoints/packages';
import { queryKeys } from '../keys';

const PACKAGES_STALE_MS = 5 * 60 * 1000;

export function usePackages() {
  return useQuery({
    queryKey: queryKeys.packages.list(),
    queryFn: packagesApi.getPackages,
    staleTime: PACKAGES_STALE_MS,
  });
}

export function usePackage(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id ?? ''),
    queryFn: () => packagesApi.getPackage(id!),
    enabled: id !== undefined && id !== '',
    staleTime: PACKAGES_STALE_MS,
  });
}
