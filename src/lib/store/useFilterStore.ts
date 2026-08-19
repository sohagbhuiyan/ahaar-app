/**
 * Foods / Menu browsing filters.
 *
 * Deliberately NOT persisted: a filter is a momentary intent, not a
 * preference. Reopening the app to a search for "chicken" from three days ago,
 * with most of the catalogue hidden and no obvious reason why, reads as a bug.
 *
 * These values feed the query key (`queryKeys.foods.list(filters)`), so
 * changing one automatically refetches — and results for each combination stay
 * separately cached.
 */
import { create } from 'zustand';

interface FilterState {
  /** Category **slug** — the API filters on slug, not id. `null` = all. */
  categorySlug: string | null;
  /** Raw text from the search field; debounce before putting it in a key. */
  searchTerm: string;
  /** Restrict the Foods list to add-on items. */
  addonsOnly: boolean;

  setCategory: (slug: string | null) => void;
  setSearchTerm: (term: string) => void;
  setAddonsOnly: (value: boolean) => void;
  reset: () => void;
}

const INITIAL = {
  categorySlug: null,
  searchTerm: '',
  addonsOnly: false,
} satisfies Pick<FilterState, 'categorySlug' | 'searchTerm' | 'addonsOnly'>;

export const useFilterStore = create<FilterState>((set) => ({
  ...INITIAL,

  // Tapping the active category clears it, so the chip row toggles.
  setCategory: (slug) =>
    set((state) => ({ categorySlug: state.categorySlug === slug ? null : slug })),

  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setAddonsOnly: (addonsOnly) => set({ addonsOnly }),
  reset: () => set({ ...INITIAL }),
}));

/** True when anything is narrowing the list — drives the "clear filters" chip. */
export function useHasActiveFilters(): boolean {
  return useFilterStore(
    (s) => s.categorySlug !== null || s.searchTerm.trim() !== '' || s.addonsOnly,
  );
}
