import { createContext, useContext } from 'react';
import type { View } from 'react-native';

/**
 * What a component rendering inside a `Sheet` can ask of it.
 *
 * `Input` reads this to swap in `BottomSheetTextInput` — the text field the
 * bottom-sheet library can track, which is how the sheet knows a field has
 * focus and lifts itself above the keyboard — and to report focus, so the
 * sheet can scroll the field into view when the keyboard leaves it too little
 * room. Kept out of `Sheet.tsx` so `Input` doesn't import the whole sheet just
 * to ask.
 */
export interface SheetContextValue {
  /** `field` is the whole block — label, input and message — to keep in view. */
  onFieldFocus: (field: View) => void;
  onFieldBlur: (field: View) => void;
}

export const SheetContext = createContext<SheetContextValue | null>(null);

/** The enclosing sheet, or `null` outside one. */
export function useSheet(): SheetContextValue | null {
  return useContext(SheetContext);
}
