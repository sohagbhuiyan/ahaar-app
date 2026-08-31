/**
 * The subscription draft — what the customer has chosen but not yet paid for.
 *
 * Persisted to AsyncStorage (not SecureStore: nothing here is sensitive, and
 * a draft can outgrow SecureStore's Android size limit) so an interrupted
 * checkout survives an app kill.
 *
 * ── On the price snapshot ───────────────────────────────────────────────────
 * `plan` below holds name/price/currency copied from the server at selection
 * time. That is a deliberate, narrow exception to "no server data in Zustand":
 * the checkout screen has to show a running total the instant the user taps,
 * and re-deriving it from a query that may be offline would leave the summary
 * blank. It is a **display snapshot only** — the server recomputes the real
 * charge in `POST /subscriptions`, and `isStale()` flags a drift so the UI can
 * re-confirm before submitting.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Copied from the server when a plan is selected. Never authoritative. */
export interface PlanSnapshot {
  id: number;
  name: string;
  duration_days: number;
  price: number;
  currency: string;
  /** Epoch ms — used by `isStale()`. */
  capturedAt: number;
}

/** A paid extra the customer added while building the draft. */
export interface DraftAddon {
  menu_item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  /** YYYY-MM-DD the add-on applies to, when tied to a specific day. */
  delivery_date?: string;
}

/** A draft older than this is re-confirmed against the server before checkout. */
const SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

/**
 * No `slotId`: a subscription covers every meal its plan serves, so there is no
 * meal to choose and nothing to hold here. Instant orders still pick one — that
 * lives in `useInstantOrderStore`, which is why the two stores are separate.
 */
interface CartState {
  plan: PlanSnapshot | null;
  addressId: number | null;
  /** YYYY-MM-DD */
  startDate: string | null;
  addons: DraftAddon[];

  selectPlan: (plan: Omit<PlanSnapshot, 'capturedAt'>) => void;
  setAddress: (addressId: number | null) => void;
  setStartDate: (date: string | null) => void;

  addAddon: (addon: Omit<DraftAddon, 'quantity'> & { quantity?: number }) => void;
  setAddonQuantity: (menuItemId: number, quantity: number) => void;
  removeAddon: (menuItemId: number) => void;

  clear: () => void;
}

const EMPTY = {
  plan: null,
  addressId: null,
  startDate: null,
  addons: [],
} satisfies Pick<CartState, 'plan' | 'addressId' | 'startDate' | 'addons'>;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      selectPlan: (plan) =>
        set((state) => ({
          plan: { ...plan, capturedAt: Date.now() },
          // Switching plans invalidates day-specific add-ons: the new plan may
          // not run on those dates at all.
          addons: state.plan?.id === plan.id ? state.addons : [],
        })),

      setAddress: (addressId) => set({ addressId }),
      setStartDate: (startDate) => set({ startDate }),

      addAddon: (addon) => {
        const existing = get().addons.find(
          (a) =>
            a.menu_item_id === addon.menu_item_id &&
            a.delivery_date === addon.delivery_date,
        );

        if (existing) {
          set((state) => ({
            addons: state.addons.map((a) =>
              a === existing
                ? { ...a, quantity: a.quantity + (addon.quantity ?? 1) }
                : a,
            ),
          }));
          return;
        }

        set((state) => ({
          addons: [...state.addons, { ...addon, quantity: addon.quantity ?? 1 }],
        }));
      },

      setAddonQuantity: (menuItemId, quantity) =>
        set((state) => ({
          addons:
            quantity <= 0
              ? state.addons.filter((a) => a.menu_item_id !== menuItemId)
              : state.addons.map((a) =>
                  a.menu_item_id === menuItemId ? { ...a, quantity } : a,
                ),
        })),

      removeAddon: (menuItemId) =>
        set((state) => ({
          addons: state.addons.filter((a) => a.menu_item_id !== menuItemId),
        })),

      clear: () => set({ ...EMPTY }),
    }),
    {
      name: 'ahaar.cart',
      storage: createJSONStorage(() => AsyncStorage),
      // v1 dropped `slotId`. A draft persisted by an older build still carries
      // it, and `persist` merges the stored object wholesale — so strip it here
      // rather than leave a stray field the type no longer describes.
      version: 1,
      migrate: (persisted) => {
        const { slotId: _dropped, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        // Only the persisted slice comes back here — zustand merges it over the
        // freshly-built store, so the actions are already in place.
        return rest as unknown as CartState;
      },
    },
  ),
);

// ── Selectors ────────────────────────────────────────────────────────────────

/** Sum of the draft's add-ons. Excludes the plan price. */
export function useAddonsTotal(): number {
  return useCartStore((s) =>
    s.addons.reduce((sum, a) => sum + a.unit_price * a.quantity, 0),
  );
}

/**
 * Indicative total for the summary card. The server's figure is authoritative —
 * it applies tax and re-reads the live plan price.
 */
export function useCartTotal(): number {
  return useCartStore((s) => {
    const addons = s.addons.reduce((sum, a) => sum + a.unit_price * a.quantity, 0);
    return (s.plan?.price ?? 0) + addons;
  });
}

/** Everything the checkout call needs is present. */
export function useCartIsComplete(): boolean {
  return useCartStore((s) => s.plan !== null && s.startDate !== null);
}

/**
 * The price snapshot is old enough that it may no longer match the server.
 * Re-fetch the plan and refresh the draft before submitting.
 */
export function isCartStale(plan: PlanSnapshot | null): boolean {
  if (!plan) return false;
  return Date.now() - plan.capturedAt > SNAPSHOT_MAX_AGE_MS;
}

export function useCartIsStale(): boolean {
  return useCartStore((s) => isCartStale(s.plan));
}
