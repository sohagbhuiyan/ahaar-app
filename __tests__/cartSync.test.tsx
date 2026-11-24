import { act, renderHook, waitFor } from '@testing-library/react-native';

import { api } from '@/lib/api/endpoints';
import { normalizeCart } from '@/lib/api/endpoints/cart';
import { useCartSync } from '@/lib/query/hooks/useCart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useInstantOrderStore } from '@/lib/store';

const serverCart = normalizeCart({
  items: [
    { id: 5, kind: 'item', menu_item_id: 1, package_id: null, name: 'Rice', image_url: null, unit_price: '12.50', quantity: 3, line_total: '37.50', is_available: true },
    { id: 6, kind: 'package', menu_item_id: null, package_id: 9, name: 'Family Box', image_url: null, dish_count: 4, unit_price: '40.00', quantity: 1, line_total: '40.00', is_available: false },
  ],
  item_count: 3,
  subtotal: '37.50',
  delivery_fee: '5.00',
  total: '42.50',
  has_unavailable: true,
  cash_limit: '500.00',
  exceeds_cash_limit: false,
});

// A bare client: gcTime Infinity schedules no timers, so jest can exit.
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

afterEach(() => client.clear());

beforeEach(async () => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  // Let the persisted stores finish reading back first, or they land mid-test.
  await useAuthStore.persist.rehydrate();
  await useInstantOrderStore.persist.rehydrate();
  jest.restoreAllMocks();
  useInstantOrderStore.getState().clear();
  useAuthStore.setState({ token: null, hasHydrated: true });
});

describe('server cart', () => {
  it('normalizes decimal strings, availability and the cash ceiling', () => {
    expect(serverCart.total).toBe(42.5);
    expect(serverCart.delivery_fee).toBe(5);
    expect(serverCart.items[1].is_available).toBe(false);
    expect(serverCart.has_unavailable).toBe(true);
    expect(serverCart.cash_limit).toBe(500);
    expect(serverCart.exceeds_cash_limit).toBe(false);
  });

  it('adopts the account cart as the basket, with server prices and box dish counts', () => {
    useInstantOrderStore.getState().add({ menu_item_id: 1, name: 'Rice', unit_price: 1, image_url: null });
    expect(useInstantOrderStore.getState().dirty).toBe(true);

    useInstantOrderStore.getState().adoptServerCart(serverCart);

    const { lines, packageLines, dirty } = useInstantOrderStore.getState();
    expect(lines).toEqual([{ menu_item_id: 1, name: 'Rice', unit_price: 12.5, image_url: null, quantity: 3 }]);
    // A box added on the website arrives with its dish count.
    expect(packageLines[0]).toMatchObject({ package_id: 9, unit_price: 40, item_count: 4, quantity: 1 });
    expect(dirty).toBe(false);
  });

  it('marks the customer emptying the basket as an edit, but not a post-checkout clear', () => {
    useInstantOrderStore.getState().adoptServerCart(serverCart);
    useInstantOrderStore.getState().emptyBasket();
    expect(useInstantOrderStore.getState()).toMatchObject({ lines: [], packageLines: [], dirty: true });

    useInstantOrderStore.getState().clear();
    expect(useInstantOrderStore.getState().dirty).toBe(false);
  });
});

describe('useCartSync', () => {
  it('merges the device basket into the account cart on sign-in — ids and quantities only', async () => {
    const merge = jest.spyOn(api.cart, 'mergeCart').mockResolvedValue(serverCart);
    useInstantOrderStore.getState().add({ menu_item_id: 1, name: 'Rice', unit_price: 999, image_url: null }, 2);

    await renderHook(() => useCartSync(), { wrapper });
    await act(async () => {
      useAuthStore.setState({ token: 'fresh' });
    });

    await waitFor(() =>
      expect(merge).toHaveBeenCalledWith({ items: [{ menu_item_id: 1, quantity: 2 }], packages: [] }),
    );
    await waitFor(() => expect(useInstantOrderStore.getState().lines[0].quantity).toBe(3));
  });

  it('on launch with a stored session, pulls the account cart (website edits show up) — never re-merges', async () => {
    const merge = jest.spyOn(api.cart, 'mergeCart').mockResolvedValue(serverCart);
    const get = jest.spyOn(api.cart, 'getCart').mockResolvedValue(serverCart);
    useAuthStore.setState({ token: 'stored', hasHydrated: false });

    await renderHook(() => useCartSync(), { wrapper });
    await act(async () => {
      useAuthStore.setState({ token: 'stored', hasHydrated: true });
    });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(merge).not.toHaveBeenCalled();
    await waitFor(() => expect(useInstantOrderStore.getState().lines[0]?.name).toBe('Rice'));
  });

  it('on launch with unsynced device edits, pushes them instead of overwriting them', async () => {
    const get = jest.spyOn(api.cart, 'getCart').mockResolvedValue(normalizeCart({ items: [] }));
    const put = jest.spyOn(api.cart, 'replaceCart').mockResolvedValue(serverCart);
    useInstantOrderStore.getState().add({ menu_item_id: 1, name: 'Rice', unit_price: 1, image_url: null }, 3);
    useAuthStore.setState({ token: 'stored', hasHydrated: false });

    await renderHook(() => useCartSync(), { wrapper });
    await act(async () => {
      useAuthStore.setState({ token: 'stored', hasHydrated: true });
    });

    await waitFor(() => expect(put).toHaveBeenCalledWith({ items: [{ menu_item_id: 1, quantity: 3 }], packages: [] }));
    expect(get).not.toHaveBeenCalled();
    await waitFor(() => expect(useInstantOrderStore.getState().dirty).toBe(false));
  });

  it('pushes an edit made while signed in, debounced, and an emptied basket clears the account cart', async () => {
    jest.spyOn(api.cart, 'getCart').mockResolvedValue(normalizeCart({ items: [] }));
    const put = jest.spyOn(api.cart, 'replaceCart').mockResolvedValue(normalizeCart({ items: [] }));
    useAuthStore.setState({ token: 'stored', hasHydrated: true });
    await renderHook(() => useCartSync(), { wrapper });

    await act(async () => {
      useInstantOrderStore.getState().add({ menu_item_id: 7, name: 'Dal', unit_price: 5, image_url: null });
      useInstantOrderStore.getState().setQuantity(7, 2);
    });
    // One PUT for the settled stepper, not one per tap.
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenLastCalledWith({ items: [{ menu_item_id: 7, quantity: 2 }], packages: [] });

    await act(async () => {
      useInstantOrderStore.getState().emptyBasket();
    });
    await waitFor(() => expect(put).toHaveBeenLastCalledWith({ items: [], packages: [] }));
  });

  it('does not touch the server while signed out', async () => {
    const put = jest.spyOn(api.cart, 'replaceCart').mockResolvedValue(serverCart);
    await renderHook(() => useCartSync(), { wrapper });
    await act(async () => {
      useInstantOrderStore.getState().add({ menu_item_id: 7, name: 'Dal', unit_price: 5, image_url: null });
    });
    await new Promise((r) => setTimeout(r, 600));
    expect(put).not.toHaveBeenCalled();
  });
});
