/**
 * Refresh a screen's data when it comes back into view.
 *
 * Tab screens stay mounted, so TanStack's `refetchOnMount` fires once and
 * never again: an order placed from Foods would not show on the Account tab
 * until a pull-to-refresh. On every *return* to the screen (not the first
 * focus, which the queries' own mount already covers), this refetches the
 * listed roots — only the ones that are active and stale, so hopping between
 * tabs costs nothing while the data is fresh.
 *
 * Lives beside `useRequireAuth` rather than in `query/hooks`: it depends on the
 * router, and the server-state hooks deliberately don't.
 *
 * Pass a module-level constant: a new array each render would re-run the
 * focus effect on every render.
 */
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

export function useRefreshOnFocus(queryKeys: readonly QueryKey[]): void {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      for (const queryKey of queryKeys) {
        void queryClient.refetchQueries({ queryKey, type: 'active', stale: true });
      }
    }, [queryClient, queryKeys]),
  );
}
