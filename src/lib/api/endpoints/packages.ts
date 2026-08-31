/**
 * Packages — bundles sold at one price, e.g. "Rice + Egg + Dal, 50 SAR".
 *
 * A public read, like the menu: the storefront shows bundles before anyone
 * signs in. They sit outside the subscription entirely — never part of a plan's
 * weekly menu, never swappable, never counted against the weekly entitlement.
 */
import { apiClient, unwrap } from '../client';
import { normalizeList, normalizePackage } from '../normalize';
import type { ApiEnvelope } from '../types/common';
import type { FoodPackage } from '../types/package';

type Raw = Record<string, unknown>;

/** GET /packages — active bundles, in display order. */
export async function getPackages(): Promise<FoodPackage[]> {
  const { data } = await apiClient.get<{ data?: Raw[] } | Raw[]>('/packages');
  return normalizeList(data, normalizePackage);
}

/** GET /packages/{id} — one bundle with its contents. */
export async function getPackage(id: number | string): Promise<FoodPackage> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/packages/${id}`);
  return normalizePackage(unwrap(data));
}
