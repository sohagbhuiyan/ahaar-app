/**
 * Public catalogue: plans, menu items, categories, delivery slots, addresses.
 *
 * Field names match the Laravel resources exactly. The one transformation
 * applied in `../normalize.ts` is numeric: Laravel casts money columns with
 * `decimal:2`, which serialises to a **string** ("49.95"). Every price below is
 * already parsed to `number`, so components never call `parseFloat`.
 */

/** Nested category, as embedded by `MenuItemResource`. */
export interface MenuItemCategory {
  id: number;
  name: string;
  slug: string;
}

/** Standalone category, from `GET /categories` style reads. */
export interface Category {
  id: number;
  name: string;
  slug: string;
  is_swappable: boolean;
  sort_order: number;
}

/** `App\Http\Resources\Customer\MenuItemResource` */
export interface MenuItem {
  id: number;
  name: string;
  slug: string;
  /** Only present when the endpoint eager-loads the relation. */
  category?: MenuItemCategory;
  description: string | null;
  image_url: string | null;
  /** Parsed from the API's decimal string. */
  base_price: number;
  dietary_tags: string[];
  allergens: string[];
  is_addon: boolean;
  /**
   * Whether the add-on is free for subscribers.
   *
   * NOT YET RETURNED BY THE API — `menu_items.is_free` is Priority 4 of the
   * backend work and does not exist yet. Normalisation defaults it to
   * `undefined` so the UI can distinguish "free" / "paid" / "not known yet".
   * See `./addons.ts`.
   */
  is_free?: boolean;
  /**
   * Every picture of the dish, cover first. Detail endpoint only, and absent —
   * never `[]` — when the item has no picture at all.
   */
  gallery?: MediaImage[];
  /** Detail endpoint only; absent when no video was uploaded. */
  video?: CatalogVideo;
}

/** One picture in a menu item's or package's gallery. */
export interface MediaImage {
  url: string;
  alt: string | null;
}

/** The optional video on a menu item or package detail. */
export interface CatalogVideo {
  url: string;
  mime_type: string | null;
  /** `null` when the admin uploaded none — show the cover instead. */
  poster_url: string | null;
  /** `null` when the length is unknown. */
  duration_seconds: number | null;
}

/**
 * A meal slot a plan's weekly menu covers, as nested on `PlanResource.slots`.
 *
 * A subscription buys **one** of these — the customer picks which. Times and
 * cutoff are optional because `PlanSchedule::slot()` may emit a null cutoff.
 */
export interface PlanSlot {
  id: number;
  name: string;
  slug: string;
  start_time: string | null;
  end_time: string | null;
  cutoff_hours: number | null;
}

/**
 * What a `plan_menus` line is to the meal it belongs to.
 *
 * - `included`       — part of the meal; delivered.
 * - `default_addon`  — delivered too, but presented as an add-on.
 * - `optional_addon` — offered for the slot and never delivered unless the
 *                      customer asks, so it costs no quota until they do.
 */
export type PlanMenuEntryType = 'included' | 'default_addon' | 'optional_addon';

/** One line of a meal slot: an item, how many of it, and what role it plays. */
export interface PlanScheduleItem {
  /** `plan_menus.id` — stable list key. */
  id: number;
  menu_item_id: number;
  menu_item?: MenuItem;
  category?: MenuItemCategory & { is_swappable?: boolean };
  /** Portions served, e.g. Roti ×2. Always ≥ 1. */
  quantity: number;
  entry_type: PlanMenuEntryType;
  /** True for `default_addon` — delivered, but badged as an add-on. */
  is_addon: boolean;
}

/** One meal slot of one day: what arrives, and what may be added to it. */
export interface PlanScheduleSlot {
  slot_id: number;
  slot?: PlanSlot;
  /** Delivered lines — `included` and `default_addon`. */
  items: PlanScheduleItem[];
  /** `optional_addon` lines: on offer for this slot, never delivered by default. */
  addons: PlanScheduleItem[];
}

/**
 * One weekday of the plan's repeating week. Weekdays the plan does not serve
 * are absent, so a blank day never has to be rendered.
 */
export interface PlanScheduleDay {
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  day_number: number;
  day_name: string;
  slots: PlanScheduleSlot[];
}

/** A plan's weekly cap for one item, next to what its own menu already spends. */
export interface PlanQuotaSummary {
  menu_item_id: number;
  menu_item?: { id: number; name: string; slug: string } | null;
  weekly_limit: number;
  /**
   * Portions the plan's defaults already commit each week. `null` when the API
   * did not compute it — show nothing rather than imply the plan commits none.
   */
  default_count: number | null;
}

/** `App\Http\Resources\Customer\PlanResource` */
export interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  /** Any length — 7, 15, 25, 30… Not a fixed union. */
  duration_days: number;
  /** Parsed from the API's decimal string. */
  price: number;
  /** ISO-4217, from the backend's `payments.currency` config. */
  currency: string;
  /**
   * The meals this plan covers, derived server-side from its `plan_menus`.
   * Present on both `GET /plans` and `GET /plans/{id}`; `undefined` means the
   * API wasn't asked, NOT "covers no meals" — never invent a list here.
   */
  slots?: PlanSlot[];
  /** The repeating week. Detail endpoint only (`GET /plans/{id}`). */
  schedule?: PlanScheduleDay[];
  /** Weekly per-item entitlements. Detail endpoint only. */
  quotas?: PlanQuotaSummary[];
}

/** `App\Http\Resources\Customer\DeliverySlotResource` */
export interface DeliverySlot {
  id: number;
  name: string;
  slug: string;
  /** "HH:MM:SS" */
  start_time: string;
  /** "HH:MM:SS" */
  end_time: string;
  /** Hours before `start_time` after which the delivery locks. */
  cutoff_hours: number;
}

/** `App\Http\Resources\Customer\AddressResource` */
export interface Address {
  id: number;
  label: string | null;
  line1: string;
  line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  instructions: string | null;
  is_default: boolean;
}

/** Query params for `GET /menu-items`. */
export interface MenuItemFilters {
  /** Category *slug*, not id — the backend filters on `category.slug`. */
  category?: string;
  /** Restricts the list to `is_addon = true`. */
  addons_only?: boolean;
  page?: number;
}
