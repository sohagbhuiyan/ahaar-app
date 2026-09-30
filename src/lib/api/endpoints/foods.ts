/**
 * Foods — the public menu-item catalogue behind the Foods tab.
 *
 * There is no separate "foods" resource on the backend; the Foods tab browses
 * `GET /menu-items`, which is the same catalogue the swap and add-on flows
 * draw from. This endpoint IS paginated (50/page) and returns `{ data, meta }`.
 *
 * `category` filters by category **slug**, not id — the controller does
 * `whereHas('category', fn ($c) => $c->where('slug', …))`.
 */
import { apiClient } from '../client';
import { normalizeMenuItem, normalizePaginated } from '../normalize';
import type { Paginated } from '../types/common';
import type { MenuItem, MenuItemFilters } from '../types/catalog';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: Paginated<MenuItem>['meta'] };

/** GET /menu-items */
export async function getFoods(
  filters: MenuItemFilters = {},
): Promise<Paginated<MenuItem>> {
  const { data } = await apiClient.get<PaginatedBody>('/menu-items', {
    params: {
      category: filters.category || undefined,
      // Only send the flag when true; `addons_only=false` would still be
      // truthy to Laravel's `boolean()` helper on some inputs.
      addons_only: filters.addons_only ? 1 : undefined,
      page: filters.page,
    },
  });
  return normalizePaginated(data, normalizeMenuItem);
}

/** GET /menu-items/{id} — 404s when the item is inactive. */
export async function getFood(id: number | string): Promise<MenuItem> {
  const { data } = await apiClient.get<{ data: Raw }>(`/menu-items/${id}`);
  return normalizeMenuItem(data.data);
}

/**
 * Convenience wrapper for the add-on picker: the catalogue restricted to
 * `is_addon = true`.
 *
 * NOTE: this returns *every* add-on in the catalogue, not the add-ons offerable
 * on a particular day/slot, and it carries no free/paid flag — the backend does
 * not model either yet. See `./addons.ts`.
 */
export async function getAddonCatalogue(
  page?: number,
): Promise<Paginated<MenuItem>> {
  return getFoods({ addons_only: true, page });
}

/** 20 pages x 50 rows — far past any real add-on catalogue, and a hard stop. */
const MAX_ADDON_PAGES = 20;

/**
 * Every add-on, across all pages.
 *
 * `ExtraOrderSheet` shows the whole add-on catalogue in one scrollable picker
 * and has no way to ask for more, so a paged answer here is silently a wrong
 * one: the customer simply cannot see add-on 51. This is the same shape as
 * `getAllDeliveries` in `./menu.ts` — the consumer always wants the complete
 * set, so the paging is resolved here rather than left half-done in the UI.
 */
export async function getAllAddons(): Promise<MenuItem[]> {
  const first = await getAddonCatalogue();
  const all = [...first.data];

  // A guard, not an expectation: `last_page` is the server's own count, and a
  // malformed one must not turn a list into an unbounded request loop.
  const lastPage = Math.min(first.meta.last_page ?? 1, MAX_ADDON_PAGES);

  for (let page = 2; page <= lastPage; page++) {
    const next = await getAddonCatalogue(page);
    all.push(...next.data);
    if (next.data.length === 0) break;
  }

  return all;
}
