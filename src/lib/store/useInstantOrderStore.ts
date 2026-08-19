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

interface InstantOrderState {
  lines: InstantOrderLine[];
  /** YYYY-MM-DD. Null until the customer picks a day. */
  deliveryDate: string | null;
  slotId: number | null;
  addressId: number | null;

  /** Adds one, or increments an existing line. Clamped to the API's max. */
  add: (line: Omit<InstantOrderLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (menuItemId: number, quantity: number) => void;
  remove: (menuItemId: number) => void;

  setDeliveryDate: (date: string | null) => void;
  setSlot: (slotId: number | null) => void;
  setAddress: (addressId: number | null) => void;

  clear: () => void;
}

const EMPTY = {
  lines: [] as InstantOrderLine[],
  deliveryDate: null,
  slotId: null,
  addressId: null,
};

function clampQuantity(value: number): number {
  return Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(value)));
}

export const useInstantOrderStore = create<InstantOrderState>()(
  persist(
    (set) => ({
      ...EMPTY,

      add: (line, quantity = 1) =>
        set((state) => {
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
        set((state) => ({
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
        set((state) => ({
          lines: state.lines.filter((l) => l.menu_item_id !== menuItemId),
        })),

      setDeliveryDate: (deliveryDate) => set({ deliveryDate }),
      setSlot: (slotId) => set({ slotId }),
      setAddress: (addressId) => set({ addressId }),

      clear: () => set({ ...EMPTY }),
    }),
    {
      name: 'ahaar.instant-order',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

/** Total portions in the basket — the number on the tab badge. */
export function useInstantOrderCount(): number {
  return useInstantOrderStore((s) =>
    s.lines.reduce((sum, l) => sum + l.quantity, 0),
  );
}

/**
 * Indicative basket total. Tax-inclusive prices, but the server's figure wins:
 * `OrderService` re-reads every `base_price` when the order is created.
 */
export function useInstantOrderTotal(): number {
  return useInstantOrderStore((s) =>
    s.lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
  );
}
