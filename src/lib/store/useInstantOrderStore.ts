/**
 * The instant-order basket — menu items a customer wants delivered on one
 * chosen day, with no subscription involved.
 *
 * Deliberately separate from `useCartStore`. That store holds a *subscription*
 * draft (one plan, a start date, a recurring meal slot) and submits to
 * `POST /subscriptions`; this one holds a one-off order and submits to
 * `POST /orders/instant`. They have different payloads, different validation
 * and different cutoffs, and a customer can plausibly have both in flight —
 * browsing dishes to order tonight while still deciding on a weekly plan.
 * Sharing one store would make "clear the cart" ambiguous.
 *
 * Persisted to AsyncStorage (nothing here is sensitive) so a basket survives
 * the app being killed mid-decision.
 *
 * ── On the price snapshot ───────────────────────────────────────────────────
 * Lines carry `unit_price` copied from the catalogue at add time, purely so the
 * basket can show a running total offline. The server recomputes the real
 * charge — including tax — in `POST /orders/instant`; nothing here is ever
 * authoritative.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** The API caps a line at 20 (`items.*.quantity` → `max:20`). */
export const MAX_LINE_QUANTITY = 20;

export interface InstantOrderLine {
  menu_item_id: number;
  name: string;
  /** Display snapshot from the catalogue. Never authoritative. */
  unit_price: number;
  image_url: string | null;
  /** 1…`MAX_LINE_QUANTITY`. */
  quantity: number;
}

/**
 * A bundle in the basket.
 *
 * Kept in its own list rather than folded into `lines` with a nullable
 * `menu_item_id`. `POST /orders/instant` takes `items` and `packages` as two
 * separate arrays validated against two different tables, so the split has to
 * exist by the time the order is submitted — doing it here means the basket
 * cannot hold a line that is ambiguous about which one it belongs to, and a
 * package id can never be posted where a menu-item id is expected.
 */
export interface InstantOrderPackageLine {
  package_id: number;
  name: string;
  /** Display snapshot from the catalogue. Never authoritative. */
  unit_price: number;
  image_url: string | null;
  /** How many dishes are in the box — for the basket subtitle. */
  item_count: number;
  /** 1…`MAX_LINE_QUANTITY`. */
  quantity: number;
}

interface InstantOrderState {
  lines: InstantOrderLine[];
  packageLines: InstantOrderPackageLine[];
  /** YYYY-MM-DD. Null until the customer picks a day. */
  deliveryDate: string | null;
  slotId: number | null;
  addressId: number | null;
  /**
   * The basket was changed on this device and the account cart has not caught
   * up yet. While true the device wins the next sync (it is pushed); while
   * false the server wins (it is pulled) — so an edit made on the website is
   * never overwritten by a stale phone, nor a phone edit by a stale server.
   */
  dirty: boolean;

  /** Adds one, or increments an existing line. Clamped to the API's max. */
  add: (line: Omit<InstantOrderLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (menuItemId: number, quantity: number) => void;
  remove: (menuItemId: number) => void;

  addPackage: (line: Omit<InstantOrderPackageLine, 'quantity'>, quantity?: number) => void;
  setPackageQuantity: (packageId: number, quantity: number) => void;
  removePackage: (packageId: number) => void;

  setDeliveryDate: (date: string | null) => void;
  setSlot: (slotId: number | null) => void;
  setAddress: (addressId: number | null) => void;

  /**
   * Take the account's cart (from `POST /cart/merge` on sign-in) as the
   * basket: what the customer put in the cart on the website shows up here.
   * Server prices replace the device snapshot. Box dish counts are kept when
   * the box was already in the basket (the cart doesn't carry them).
   */
  adoptServerCart: (cart: {
    items: { kind: 'item' | 'package'; menu_item_id: number | null; package_id: number | null; name: string; image_url: string | null; unit_price: number; quantity: number; dish_count?: number | null }[];
  }) => void;

  /** The customer emptied the basket: also empties the account cart on next sync. */
  emptyBasket: () => void;

  /** Forget everything (after checkout, on sign-out). Not a cart edit. */
  clear: () => void;
}

const EMPTY = {
  lines: [] as InstantOrderLine[],
  packageLines: [] as InstantOrderPackageLine[],
  deliveryDate: null,
  slotId: null,
  addressId: null,
  dirty: false,
};

function clampQuantity(value: number): number {
  return Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(value)));
}

export const useInstantOrderStore = create<InstantOrderState>()(
  persist(
    (set) => {
      /** A basket edit made on this device: the account cart must catch up. */
      const edit = (fn: (state: InstantOrderState) => Partial<InstantOrderState>) =>
        set((state) => ({ ...fn(state), dirty: true }));

      return {
      ...EMPTY,

      add: (line, quantity = 1) =>
        edit((state) => {
          const existing = state.lines.find(
            (l) => l.menu_item_id === line.menu_item_id,
          );

          if (!existing) {
            return {
              lines: [...state.lines, { ...line, quantity: clampQuantity(quantity) }],
            };
          }

          return {
            lines: state.lines.map((l) =>
              l.menu_item_id === line.menu_item_id
                ? {
                    ...l,
                    // Refresh the snapshot: the catalogue may have repriced
                    // since this line was first added.
                    unit_price: line.unit_price,
                    quantity: clampQuantity(l.quantity + quantity),
                  }
                : l,
            ),
          };
        }),

      setQuantity: (menuItemId, quantity) =>
        edit((state) => ({
          // Dropping to zero removes the line — that is what a stepper's "−"
          // at 1 means, and an order can't carry a zero-quantity item.
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.menu_item_id !== menuItemId)
              : state.lines.map((l) =>
                  l.menu_item_id === menuItemId
                    ? { ...l, quantity: clampQuantity(quantity) }
                    : l,
                ),
        })),

      remove: (menuItemId) =>
        edit((state) => ({
          lines: state.lines.filter((l) => l.menu_item_id !== menuItemId),
        })),

      addPackage: (line, quantity = 1) =>
        edit((state) => {
          const existing = state.packageLines.find(
            (l) => l.package_id === line.package_id,
          );

          if (!existing) {
            return {
              packageLines: [
                ...state.packageLines,
                { ...line, quantity: clampQuantity(quantity) },
              ],
            };
          }

          return {
            packageLines: state.packageLines.map((l) =>
              l.package_id === line.package_id
                ? {
                    ...l,
                    // Refresh the snapshot: the bundle may have been repriced
                    // since this line was first added.
                    unit_price: line.unit_price,
                    quantity: clampQuantity(l.quantity + quantity),
                  }
                : l,
            ),
          };
        }),

      setPackageQuantity: (packageId, quantity) =>
        edit((state) => ({
          packageLines:
            quantity <= 0
              ? state.packageLines.filter((l) => l.package_id !== packageId)
              : state.packageLines.map((l) =>
                  l.package_id === packageId
                    ? { ...l, quantity: clampQuantity(quantity) }
                    : l,
                ),
        })),

      removePackage: (packageId) =>
        edit((state) => ({
          packageLines: state.packageLines.filter((l) => l.package_id !== packageId),
        })),

      setDeliveryDate: (deliveryDate) => set({ deliveryDate }),
      setSlot: (slotId) => set({ slotId }),
      setAddress: (addressId) => set({ addressId }),

      adoptServerCart: (cart) =>
        set((state) => ({
          dirty: false,
          lines: cart.items
            .filter((l) => l.kind === 'item' && l.menu_item_id != null)
            .map((l) => ({
              menu_item_id: l.menu_item_id as number,
              name: l.name,
              unit_price: l.unit_price,
              image_url: l.image_url,
              quantity: clampQuantity(l.quantity),
            })),
          packageLines: cart.items
            .filter((l) => l.kind === 'package' && l.package_id != null)
            .map((l) => ({
              package_id: l.package_id as number,
              name: l.name,
              unit_price: l.unit_price,
              image_url: l.image_url,
              item_count:
                l.dish_count ??
                state.packageLines.find((p) => p.package_id === l.package_id)?.item_count ?? 0,
              quantity: clampQuantity(l.quantity),
            })),
        })),

      emptyBasket: () => set({ lines: [], packageLines: [], dirty: true }),

      clear: () => set({ ...EMPTY }),
      };
    },
    {
      name: 'ahaar.instant-order',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

/** Total portions and boxes in the basket — the number on the tab badge. */
export function useInstantOrderCount(): number {
  return useInstantOrderStore(
    (s) =>
      s.lines.reduce((sum, l) => sum + l.quantity, 0) +
      s.packageLines.reduce((sum, l) => sum + l.quantity, 0),
  );
}

/** Whether the basket has anything at all — dishes, boxes or both. */
export function useInstantOrderIsEmpty(): boolean {
  return useInstantOrderStore(
    (s) => s.lines.length === 0 && s.packageLines.length === 0,
  );
}

/**
 * Indicative basket total. Tax-inclusive prices, but the server's figure wins:
 * `OrderService` re-reads every `base_price` when the order is created.
 */
export function useInstantOrderTotal(): number {
  return useInstantOrderStore(
    (s) =>
      s.lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0) +
      s.packageLines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
  );
}
