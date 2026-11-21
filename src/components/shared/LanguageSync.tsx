import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { updateProfile } from '@/lib/api/endpoints/profile';
import { clearPersistedCache } from '@/lib/query/persister';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { onLanguageChange } from '@/lib/store/useLanguageStore';

/**
 * Renders nothing. Runs the cross-cutting work of a language switch, which the
 * language store can't do itself without an import cycle:
 *
 * - drops the on-disk query cache and refetches what's on screen, because
 *   every cached dish, plan and banner carries the old language's text;
 * - stores the choice on the account (`users.locale`) so notifications reach
 *   the customer in the same language. Best effort: a failure leaves the
 *   app switched, and the next change retries.
 */
export function LanguageSync() {
  const queryClient = useQueryClient();

  useEffect(
    () =>
      onLanguageChange(async (locale) => {
        await clearPersistedCache().catch(() => undefined);
        await queryClient.invalidateQueries();

        if (useAuthStore.getState().token) {
          await updateProfile({ locale }).catch(() => undefined);
        }
      }),
    [queryClient],
  );

  return null;
}
