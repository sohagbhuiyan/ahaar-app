/**
 * Packages — bundles sold at one price, e.g. "Rice + Egg + Dal, 50 SAR".
 *
 * A package is not a menu item. It spans categories, never appears in a plan's
 * weekly menu, is never swappable, and never counts against the subscription's
 * weekly entitlement. It is bought on the day: alongside a subscription
 * delivery (an *extra*) or on its own (an *instant* order).
 *
 * Mirrors `App\Http\Resources\Customer\PackageResource`.
 */
import type { CatalogVideo, MediaImage } from './catalog';

export interface PackageContent {
  menu_item_id: number;
  name: string | null;
  slug: string | null;
  image_url: string | null;
  quantity: number;
}

export interface FoodPackage {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  /** The bundle's own price — what is actually charged. */
  price: number;
  sort_order: number;
  /**
   * What the same dishes would cost bought separately. **Display only** — the
   * gap between this and `price` is the offer. `null` when the API returned the
   * bundle without its contents.
   */
  a_la_carte_price: number | null;
  items: PackageContent[];
  /** Cover first, then the extra pictures. Detail only; absent when none. */
  gallery?: MediaImage[];
  /** Detail only; absent when no video was uploaded. */
  video?: CatalogVideo;
}

/** A bundle line on an order payload. */
export interface PackageLineInput {
  package_id: number;
  /** 1-20, enforced server-side. */
  quantity: number;
}
