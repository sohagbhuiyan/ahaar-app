/**
 * Transient UI state that more than one component needs to agree on.
 *
 * Ephemeral by design — none of this should survive an app kill. Reopening
 * into a half-open bottom sheet is a bug, not a restored session.
 *
 * Keep this small: state owned by exactly one component belongs in that
 * component's `useState`, not here. This is only for things a sibling or a
 * screen-level handler also has to read or close.
 */
import { create } from 'zustand';

/** Bottom sheets that can be open, one at a time. */
export type SheetId =
  | 'swap'
  | 'addons'
  | 'planDetail'
  | 'addressPicker'
  | 'slotPicker'
  | 'extraOrder';

interface UIState {
  /** `null` = nothing open. Single-slot: opening one closes any other. */
  openSheet: SheetId | null;
  /** Context for the open sheet, e.g. the delivery being customised. */
  sheetPayload: Record<string, unknown> | null;
  /** The day-wise Menu tab's selected date (YYYY-MM-DD). */
  selectedDeliveryDate: string | null;

  openSheetWith: (id: SheetId, payload?: Record<string, unknown>) => void;
  closeSheet: () => void;
  setSelectedDeliveryDate: (date: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  openSheet: null,
  sheetPayload: null,
  selectedDeliveryDate: null,

  openSheetWith: (id, payload) => set({ openSheet: id, sheetPayload: payload ?? null }),
  closeSheet: () => set({ openSheet: null, sheetPayload: null }),
  setSelectedDeliveryDate: (selectedDeliveryDate) => set({ selectedDeliveryDate }),
}));

/** Whether one specific sheet is the open one. */
export function useIsSheetOpen(id: SheetId): boolean {
  return useUIStore((s) => s.openSheet === id);
}
