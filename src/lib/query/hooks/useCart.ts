/**
 * The device basket ↔ the account cart (`/cart`, shared with the website).
 *
 * `useInstantOrderStore` stays the basket the screens edit: instant, and it
 * survives being offline. Signed in, it is kept equal to the server cart by one
 * small sync engine, with one rule for who wins:
 *
 *   - the device edited the basket and the server hasn't seen it (`dirty`)
 *     → the device wins: PUT /cart (replace), debounced while the stepper moves;
 *   - otherwise → the server wins: GET /cart, so a cart changed on the website
 *     shows up here on launch, on returning to the app, and on the order screen.
 *
 * Either way the answer (priced, with "no longer available" flags) is adopted
 * as the basket, so after a sync the two are the same cart. On a real sign-in
 * the device basket is *merged* (added) into the account cart instead.
 *
 * Checkout (`useCheckoutCart`) then buys the server cart as ONE order, and only
 * once the screen is showing a server price for exactly this basket.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../api/endpoints';
import type { CartLinesBody, CheckoutCartPayload, ServerCart } from '../../api/endpoints/cart';
import { useAuthStore } from '../../store/useAuthStore';
import { useInstantOrderStore } from '../../store/useInstantOrderStore';
import { queryKeys } from '../keys';

/** The account cart as last seen from the server. */
export const CART_KEY = ['cart', 'server'] as const;
/** @deprecated same query as {@link CART_KEY}; kept for existing callers. */
export const CART_PRICING_KEY = CART_KEY;

type Basket = Pick<ReturnType<typeof useInstantOrderStore.getState>, 'lines' | 'packageLines'>;

/** The basket as the server cart body — ids and quantities only, never prices. */
export const bodyOf = (b: Basket): CartLinesBody => ({
  items: b.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
  packages: b.packageLines.map((l) => ({ package_id: l.package_id, quantity: l.quantity })),
});

export const signatureOf = (body: CartLinesBody) =>
  [
    ...body.items.map((l) => `i${l.menu_item_id}x${l.quantity}`),
    ...body.packages.map((l) => `p${l.package_id}x${l.quantity}`),
  ]
    .sort()
    .join('.');

const signatureOfCart = (cart: ServerCart) =>
  signatureOf({
    items: cart.items
      .filter((l) => l.kind === 'item' && l.menu_item_id != null)
      .map((l) => ({ menu_item_id: l.menu_item_id as number, quantity: l.quantity })),
    packages: cart.items
      .filter((l) => l.kind === 'package' && l.package_id != null)
      .map((l) => ({ package_id: l.package_id as number, quantity: l.quantity })),
  });

export function useBasketBody(): CartLinesBody {
  const lines = useInstantOrderStore((s) => s.lines);
  const packageLines = useInstantOrderStore((s) => s.packageLines);
  return bodyOf({ lines, packageLines });
}

// ---------------------------------------------------------------------------
// The engine. Module state: there is one basket and one account per process.
// ---------------------------------------------------------------------------

/** Bumped by every sync; an answer from an older one is dropped on arrival. */
let generation = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

const signedIn = () => !!useAuthStore.getState().token;

function adopt(queryClient: QueryClient, cart: ServerCart) {
  useInstantOrderStore.getState().adoptServerCart(cart);
  queryClient.setQueryData(CART_KEY, cart);
}

/** Device → server. Throws on failure; the basket stays `dirty` for a retry. */
async function push(queryClient: QueryClient): Promise<void> {
  if (!signedIn()) return;
  const body = bodyOf(useInstantOrderStore.getState());
  const sig = signatureOf(body);
  const gen = ++generation;
  const cart = await api.cart.replaceCart(body);
  if (gen !== generation) return;
  // Edited again while this was in flight: the push already scheduled for
  // that edit carries the newer basket. Adopting this answer would undo it.
  if (signatureOf(bodyOf(useInstantOrderStore.getState())) !== sig) return;
  adopt(queryClient, cart);
}

/** Server → device. Throws on failure. */
async function pull(queryClient: QueryClient): Promise<void> {
  if (!signedIn()) return;
  const gen = ++generation;
  const cart = await api.cart.getCart();
  if (gen !== generation) return;
  // The customer edited the basket meanwhile: theirs is the newer cart.
  if (useInstantOrderStore.getState().dirty) return push(queryClient);
  adopt(queryClient, cart);
}

/** Make the two equal, in whichever direction is right now. */
export function syncCart(queryClient: QueryClient): Promise<void> {
  return useInstantOrderStore.getState().dirty ? push(queryClient) : pull(queryClient);
}

function schedulePush(queryClient: QueryClient, ms = 400) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    push(queryClient).catch(() => {
      // Offline: still dirty, so the next edit, foreground or order screen retries.
    });
  }, ms);
}

/** Resolves once the basket has been read back from AsyncStorage. */
function useBasketHydrated(): boolean {
  const [ready, setReady] = useState(() => useInstantOrderStore.persist.hasHydrated());
  useEffect(() => {
    if (ready) return;
    const off = useInstantOrderStore.persist.onFinishHydration(() => setReady(true));
    if (useInstantOrderStore.persist.hasHydrated()) setReady(true);
    return off;
  }, [ready]);
  return ready;
}

/**
 * Keeps the basket and the account cart in step. Mounted once, at the root.
 */
export function useCartSync() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const authReady = useAuthStore((s) => s.hasHydrated);
  const basketReady = useBasketHydrated();
  const previous = useRef<string | null | undefined>(undefined);

  // Sign-in and launch. Both stores are read back asynchronously at launch;
  // syncing before they are would be overwritten by the stored basket.
  useEffect(() => {
    if (!authReady || !basketReady) return;
    const was = previous.current;
    previous.current = token;
    if (!token) return;

    if (was === null) {
      // A real sign-in (signed out → signed in): ADD what was picked while
      // signed out to what the account already holds (e.g. from the website).
      // Only here — re-merging on every launch would double the basket.
      const gen = ++generation;
      api.cart
        .mergeCart(bodyOf(useInstantOrderStore.getState()))
        .then((cart) => {
          if (gen === generation) adopt(queryClient, cart);
        })
        .catch(() => {
          // Offline or a staff account: keep the device basket as it is.
        });
      return;
    }

    if (was === undefined) {
      // Launch with a stored session: whichever side changed last wins.
      syncCart(queryClient).catch(() => {});
    }
  }, [token, authReady, basketReady, queryClient]);

  // Every basket edit made on this device, signed in → push (debounced).
  useEffect(
    () =>
      useInstantOrderStore.subscribe((state, prev) => {
        if (!state.dirty || !signedIn()) return;
        if (state.lines === prev.lines && state.packageLines === prev.packageLines) return;
        schedulePush(queryClient);
      }),
    [queryClient],
  );

  // Back from the background (perhaps after changing the cart on the website).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && signedIn()) syncCart(queryClient).catch(() => {});
    });
    return () => sub.remove();
  }, [queryClient]);
}

/** @deprecated renamed — the sync now runs on launch and foreground too. */
export const useCartSyncOnSignIn = useCartSync;

/**
 * The server's price for exactly the basket on screen, or `undefined` while
 * the two differ (a push is pending, or the first sync hasn't answered).
 * `isFetching` stays true until they agree, so a submit can wait on it.
 */
export function useCartPricing(enabled: boolean) {
  const queryClient = useQueryClient();
  const sig = signatureOf(useBasketBody());
  const dirty = useInstantOrderStore((s) => s.dirty);

  const query = useQuery({
    queryKey: CART_KEY,
    queryFn: async () => {
      await syncCart(queryClient);
      return queryClient.getQueryData<ServerCart>(CART_KEY) ?? (await api.cart.getCart());
    },
    enabled: enabled && sig !== '',
    staleTime: 15_000,
  });

  const inSync = !!query.data && !dirty && signatureOfCart(query.data) === sig;

  // Out of step with nothing on its way (e.g. the push failed offline): try again.
  // Not after an error: React Query's own retries ran, and looping here would
  // hammer an offline phone. The next edit or foreground tries again.
  const { isFetching, isError, refetch } = query;
  useEffect(() => {
    if (enabled && sig !== '' && !inSync && !isFetching && !isError && !pushTimer) void refetch();
  }, [enabled, sig, inSync, isFetching, isError, refetch]);

  return {
    data: inSync ? query.data : undefined,
    isFetching: query.isFetching || (enabled && sig !== '' && !inSync),
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCheckoutCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: CheckoutCartPayload; idempotencyKey: string }) =>
      api.cart.checkoutCart(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all() });
      // The server emptied the cart; the screen clears the basket itself.
      ++generation;
      queryClient.removeQueries({ queryKey: CART_KEY });
    },
  });
}
