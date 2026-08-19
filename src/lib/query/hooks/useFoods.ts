/**
 * Foods — the public menu-item catalogue, paged for FlashList.
 *
 * The list is an infinite query rather than a plain one because the endpoint
 * pages at 50 and the catalogue grows without bound. Filters are part of the
 * query key, so each filter combination keeps its own cached pages and going
 * "back" to a previous filter is instant.
 */
import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import * as foodsApi from '../../api/endpoints/foods';
import type { MenuItem, MenuItemFilters } from '../../api/types/catalog';
import type { Paginated } from '../../api/types/common';
import { useFilterStore } from '../../store/useFilterStore';
import { queryKeys } from '../keys';

const CATALOGUE_STALE_MS = 5 * 60 * 1000;

/** `undefined` when there is no next page — TanStack stops paging on that. */
function nextPage(last: Paginated<MenuItem>): number | undefined {
  const { current_page, last_page } = last.meta;
  return current_page < last_page ? current_page + 1 : undefined;
}

/**
 * Paged catalogue.
 *
 * `select` flattens the pages into one array so screens hand a plain list to
 * FlashList and never touch `data.pages`.
 */
export function useFoods(filters: MenuItemFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.foods.list(filters),
    queryFn: ({ pageParam }) => foodsApi.getFoods({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: CATALOGUE_STALE_MS,
    select: (data) => ({
      items: data.pages.flatMap((page) => page.data),
      total: data.pages[0]?.meta.total ?? 0,
    }),
  });
}

/**
 * The Foods screen's list, driven by `useFilterStore`.
 *
 * Search is applied client-side over the loaded pages: the API exposes no
 * `search` parameter (`MenuController@index` filters only on category and
 * `addons_only`), so sending one would be silently ignored and quietly return
 * unfiltered results. Filtering here is honest about that limit — but it only
 * searches what has been paged in, which is worth revisiting if the catalogue
 * grows past a few hundred items.
 */
export function useFilteredFoods() {
  const categorySlug = useFilterStore((s) => s.categorySlug);
  const addonsOnly = useFilterStore((s) => s.addonsOnly);
  const searchTerm = useFilterStore((s) => s.searchTerm);

  const query = useFoods({
    category: categorySlug ?? undefined,
    addons_only: addonsOnly || undefined,
  });

  const term = searchTerm.trim().toLowerCase();
  const items = query.data?.items ?? [];

  return {
    ...query,
    items: term
      ? items.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            (item.description?.toLowerCase().includes(term) ?? false),
        )
      : items,
    /** True when a search hid everything the current page held. */
    isSearchEmpty: term.length > 0 && items.length > 0,
  };
}

/**
 * Category chips for the Foods screen.
 *
 * There is no public categories endpoint — `GET /admin/categories` is behind
 * the admin role — so the options are derived from the catalogue itself.
 *
 * Crucially it reads the *unfiltered* query rather than whatever the screen is
 * currently showing. Deriving from the filtered list would collapse the chip
 * row to the one selected category the moment it was used, leaving no way back
 * to any other. That query is the same one the screen loads first, so this
 * costs nothing extra in the common case.
 */
export function useFoodCategories() {
  const { data } = useFoods();

  const categories = useMemo(() => {
    const byslug = new Map<string, string>();
    for (const item of data?.items ?? []) {
      if (item.category) byslug.set(item.category.slug, item.category.name);
    }
    return [...byslug]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return categories;
}

export function useFood(id: string | number | undefined) {
  return useQuery({
    queryKey: queryKeys.foods.detail(id ?? ''),
    queryFn: () => foodsApi.getFood(id!),
    enabled: id !== undefined && id !== '',
    staleTime: CATALOGUE_STALE_MS,
  });
}

/**
 * Add-on catalogue for the picker.
 *
 * Every `is_addon` item, not the ones offerable on a given weekday/slot — the
 * backend models neither that restriction nor a free/paid flag yet, so the
 * picker treats all of these as paid extras.
 */
export function useAddonCatalogue() {
  return useInfiniteQuery({
    queryKey: queryKeys.foods.addons(),
    queryFn: ({ pageParam }) => foodsApi.getAddonCatalogue(pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    staleTime: CATALOGUE_STALE_MS,
    select: (data) => data.pages.flatMap((page) => page.data),
  });
}
