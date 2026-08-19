/**
 * Gate one action behind a session, without leaving the screen.
 *
 * The rule for this app is that *browsing* is public and *transacting* is not.
 * Every button that spends money or touches the customer's own record goes
 * through here:
 *
 *     const requireAuth = useRequireAuth();
 *     <Button onPress={() => requireAuth(placeOrder, 'to place this order')} />
 *
 * Signed in, `placeOrder` runs immediately. Signed out, the login sheet opens
 * and `placeOrder` runs the moment authentication succeeds — so the tap is
 * never lost and the customer never has to find their way back.
 */
import { useCallback } from 'react';

import { useAuthPromptStore } from '../store/useAuthPromptStore';
import { useAuthStore } from '../store/useAuthStore';

export type RequireAuth = (action: () => void, reason?: string) => void;

export function useRequireAuth(): RequireAuth {
  const prompt = useAuthPromptStore((s) => s.prompt);

  return useCallback(
    (action: () => void, reason?: string) => {
      // Read imperatively rather than subscribing: this hook is used inside
      // press handlers, and re-rendering every gated button on every auth
      // change buys nothing.
      if (useAuthStore.getState().token !== null) {
        action();
        return;
      }
      prompt(reason, action);
    },
    [prompt],
  );
}
