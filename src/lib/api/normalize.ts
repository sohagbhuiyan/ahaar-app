/**
 * Raw API payloads â†’ the domain types in `./types`.
 *
 * There is exactly one systematic transformation: Laravel casts money columns
 * with `decimal:2`, which JSON-encodes as a **string** ("49.95"). Parsing here
 * means no component ever calls `parseFloat`, and a missing/garbage price
 * becomes 0 rather than `NaN` propagating into a total.
 *
 * Field names are otherwise left exactly as the Laravel resources emit them â€”
 * per the brief, mobile mirrors the API rather than inventing aliases. (The
 * web app additionally carries legacy `*_sar` duplicates; those are not
 * reproduced here.)
 */
import type {
  Address,
  Category,
  DeliverySlot,
  MenuItem,
  Plan,
  PlanMenuEntryType,
  PlanQuotaSummary,
  PlanScheduleDay,
  PlanScheduleItem,
  PlanScheduleSlot,
  PlanSlot,
} from './types/catalog';
import type { Order, OrderItem, Payment } from './types/order';
import type {
  Delivery,
  DeliveryItem,
  Subscription,
  SubscriptionQuota,
} from './types/subscription';
import type {
  AppSectionType,
  HomeBanner,
  HomeContent,
  HomeSectionContent,
} from './types/home';
import { APP_SECTION_TYPES } from './types/home';
import type {
  DeliverySwapOptions,
  MealSwapEntry,
  ScheduleDay,
  ScheduleMeal,
  SchedulePlate,
  SubscriptionSchedule,
  SwapBlockedReason,
  SwapPosition,
  SwapTarget,
} from './types/swap';
import type { FoodPackage } from './types/package';
import type { Paginated, PaginationMeta } from './types/common';

/**
 * Fallback for the rare payload that omits `currency`.
 *
 * EUR because that is what the API actually emits: `config('payments.currency')`
 * is 'EUR' and `GET /plans` returns `"currency":"EUR"`.
 *
 * **This is data, not a display value.** Nothing in the UI reads it. Ahaar sells
 * in Saudi Arabia, so every amount is rendered as SAR by `formatMoney` in
 * `lib/utils.ts`, which ignores the payload's currency entirely. The field is
 * kept on the normalised entities because it is a true statement about what the
 * gateway will charge, and dropping it would hide a real discrepancy between the
 * charged currency and the displayed one.
 */
export const FALLBACK_CURRENCY = 'EUR';

/** Money/number coercion. Accepts the API's decimal strings and real numbers. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Nullable variant â€” keeps `null` distinct from 0 (used for lat/lng). */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toNumber(value);
  return parsed;
}

type Raw = Record<string, unknown>;

// â”€â”€ Catalogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** `PlanSchedule::slot()` — times and cutoff may all be null. */
export function normalizePlanSlot(raw: Raw): PlanSlot {
  return {
    id: raw.id as number,
    name: (raw.name as string) ?? '',
    slug: (raw.slug as string) ?? '',
    start_time: (raw.start_time as string | null) ?? null,
    end_time: (raw.end_time as string | null) ?? null,
    cutoff_hours:
      raw.cutoff_hours === null || raw.cutoff_hours === undefined
        ? null
        : toNumber(raw.cutoff_hours),
  };
}

/** Anything unrecognised is treated as part of the meal — the safe reading. */
function toEntryType(raw: unknown, isAddon: unknown): PlanMenuEntryType {
  if (raw === 'optional_addon' || raw === 'default_addon' || raw === 'included') {
    return raw;
  }
  return isAddon ? 'default_addon' : 'included';
}

function normalizeScheduleItem(raw: Raw): PlanScheduleItem {
  const menuItem = raw.menu_item as Raw | null | undefined;
  const category = raw.category as Raw | null | undefined;
  const entryType = toEntryType(raw.entry_type, raw.is_addon);

  return {
    id: (raw.id as number) ?? (raw.menu_item_id as number),
    menu_item_id: raw.menu_item_id as number,
    menu_item: menuItem ? normalizeMenuItem(menuItem) : undefined,
    category: category
      ? {
          id: category.id as number,
          name: category.name as string,
          slug: category.slug as string,
          is_swappable: Boolean(category.is_swappable),
        }
      : undefined,
    // A missing count means one portion — 0 would render the item as if it
    // weren't served at all.
    quantity: Math.max(1, Math.trunc(toNumber(raw.quantity ?? 1)) || 1),
    entry_type: entryType,
    is_addon: raw.is_addon === undefined ? entryType === 'default_addon' : Boolean(raw.is_addon),
  };
}

function normalizeScheduleSlot(raw: Raw): PlanScheduleSlot {
  const slot = raw.slot as Raw | null | undefined;
  return {
    slot_id: raw.slot_id as number,
    slot: slot ? normalizePlanSlot(slot) : undefined,
    items: ((raw.items as Raw[] | null) ?? []).map(normalizeScheduleItem),
    addons: ((raw.addons as Raw[] | null) ?? []).map(normalizeScheduleItem),
  };
}

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function normalizeScheduleDay(raw: Raw): PlanScheduleDay {
  const dayNumber = (raw.day_number as number) ?? 1;
  return {
    day_number: dayNumber,
    day_name: (raw.day_name as string) ?? DAY_NAMES[dayNumber - 1] ?? '',
    slots: ((raw.slots as Raw[] | null) ?? []).map(normalizeScheduleSlot),
  };
}

function normalizePlanQuota(raw: Raw): PlanQuotaSummary {
  const menuItem = raw.menu_item as Raw | null | undefined;
  return {
    menu_item_id: raw.menu_item_id as number,
    menu_item: menuItem
      ? {
          id: menuItem.id as number,
          name: menuItem.name as string,
          slug: menuItem.slug as string,
        }
      : null,
    weekly_limit: toNumber(raw.weekly_limit),
    // `null` means "not computed", which is different from "commits none".
    default_count:
      raw.default_count === null || raw.default_count === undefined
        ? null
        : toNumber(raw.default_count),
  };
}

/**
 * `slots` / `schedule` / `quotas` are `whenLoaded` on the resource: absent
 * means "the API wasn't asked", not "empty". They stay `undefined` rather than
 * defaulting to `[]` so the UI can tell the two apart.
 */
export function normalizePlan(raw: Raw): Plan {
  const slots = raw.slots as Raw[] | undefined;
  const schedule = raw.schedule as Raw[] | undefined;
  const quotas = raw.quotas as Raw[] | undefined;

  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    description: (raw.description as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    duration_days: raw.duration_days as number,
    price: toNumber(raw.price),
    currency: (raw.currency as string) ?? FALLBACK_CURRENCY,
    slots: Array.isArray(slots) ? slots.map(normalizePlanSlot) : undefined,
    schedule: Array.isArray(schedule) ? schedule.map(normalizeScheduleDay) : undefined,
    quotas: Array.isArray(quotas) ? quotas.map(normalizePlanQuota) : undefined,
  };
}

export function normalizeMenuItem(raw: Raw): MenuItem {
  const category = raw.category as Raw | undefined;
  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    category: category
      ? {
          id: category.id as number,
          name: category.name as string,
          slug: category.slug as string,
        }
      : undefined,
    description: (raw.description as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    base_price: toNumber(raw.base_price),
    dietary_tags: (raw.dietary_tags as string[] | null) ?? [],
    allergens: (raw.allergens as string[] | null) ?? [],
    is_addon: Boolean(raw.is_addon),
    // Left undefined when absent so "free" / "paid" / "unknown" stay distinct.
    // The API does not send this yet â€” see types/addons.ts.
    is_free: raw.is_free === undefined ? undefined : Boolean(raw.is_free),
  };
}

export function normalizeCategory(raw: Raw): Category {
  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    is_swappable: Boolean(raw.is_swappable),
    sort_order: (raw.sort_order as number) ?? 0,
  };
}

export function normalizeDeliverySlot(raw: Raw): DeliverySlot {
  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    start_time: raw.start_time as string,
    end_time: raw.end_time as string,
    cutoff_hours: toNumber(raw.cutoff_hours),
  };
}

export function normalizeAddress(raw: Raw): Address {
  return {
    id: raw.id as number,
    label: (raw.label as string | null) ?? null,
    line1: raw.line1 as string,
    line2: (raw.line2 as string | null) ?? null,
    postal_code: (raw.postal_code as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    country: (raw.country as string | null) ?? null,
    lat: toNullableNumber(raw.lat),
    lng: toNullableNumber(raw.lng),
    instructions: (raw.instructions as string | null) ?? null,
    is_default: Boolean(raw.is_default),
  };
}

// â”€â”€ Payments & orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function normalizePayment(raw: Raw): Payment {
  return {
    id: raw.id as number,
    amount: toNumber(raw.amount),
    currency: (raw.currency as string) ?? FALLBACK_CURRENCY,
    status: raw.status as Payment['status'],
    gateway: raw.gateway as string,
    checkout_url: (raw.checkout_url as string | null) ?? null,
    paid_at: (raw.paid_at as string | null) ?? null,
    created_at: (raw.created_at as string) ?? '',
  };
}

export function normalizeOrderItem(raw: Raw): OrderItem {
  const menuItem = raw.menu_item as Raw | undefined;
  const pkg = raw.package as Raw | undefined;
  const packageId = (raw.package_id as number | null) ?? null;

  // A line is either a dish or a bundle. The fallbacks keep an older payload
  // (no `kind`, no `name`) reading as a dish rather than as a blank row.
  const kind = (raw.kind as OrderItem['kind']) ?? (packageId !== null ? 'package' : 'item');

  return {
    id: raw.id as number,
    kind,
    name:
      (raw.name as string) ??
      (menuItem?.name as string) ??
      (pkg?.name as string) ??
      '',
    menu_item_id: (raw.menu_item_id as number | null) ?? null,
    menu_item: menuItem
      ? {
          id: menuItem.id as number,
          name: menuItem.name as string,
          slug: menuItem.slug as string,
          image_url: (menuItem.image_url as string | null) ?? null,
        }
      : undefined,
    package_id: packageId,
    package: pkg
      ? {
          id: pkg.id as number,
          name: pkg.name as string,
          slug: pkg.slug as string,
          image_url: (pkg.image_url as string | null) ?? null,
        }
      : undefined,
    quantity: raw.quantity as number,
    unit_price: toNumber(raw.unit_price),
    tax_rate: toNumber(raw.tax_rate),
    subtotal: toNumber(raw.subtotal),
  };
}

export function normalizeOrder(raw: Raw): Order {
  const payment = raw.payment as Raw | undefined;
  const items = raw.items as Raw[] | undefined;
  return {
    id: raw.id as number,
    type: raw.type as Order['type'],
    subscription_id: (raw.subscription_id as number | null) ?? null,
    daily_delivery_id: (raw.daily_delivery_id as number | null) ?? null,
    delivery_date: raw.delivery_date as string,
    slot_id: raw.slot_id as number,
    address_id: (raw.address_id as number | null) ?? null,
    subtotal: toNumber(raw.subtotal),
    tax_amount: toNumber(raw.tax_amount),
    total_amount: toNumber(raw.total_amount),
    currency: (raw.currency as string) ?? FALLBACK_CURRENCY,
    status: raw.status as Order['status'],
    guests_count: (raw.guests_count as number | null) ?? null,
    confirmed_at: (raw.confirmed_at as string | null) ?? null,
    cancelled_at: (raw.cancelled_at as string | null) ?? null,
    cancellation_reason: (raw.cancellation_reason as string | null) ?? null,
    items: items?.map(normalizeOrderItem),
    payment: payment ? normalizePayment(payment) : undefined,
    created_at: (raw.created_at as string) ?? '',
  };
}

// â”€â”€ Subscriptions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function normalizeSubscription(raw: Raw): Subscription {
  const plan = raw.plan as Raw | undefined;
  const payment = raw.payment as Raw | undefined;
  const slots = raw.slots as Raw[] | undefined;
  return {
    id: raw.id as number,
    plan: plan ? normalizePlan(plan) : undefined,
    address_id: (raw.address_id as number | null) ?? null,
    // Every meal the plan serves, not one. Defaults to [] rather than staying
    // undefined: a subscription always covers at least one meal, so an empty
    // list means "the API didn't send them", which reads the same to the UI as
    // "none" and is safer than a crash on `.map`.
    slots: (slots ?? []).map(normalizeDeliverySlot),
    status: raw.status as Subscription['status'],
    start_date: (raw.start_date as string) ?? '',
    end_date: (raw.end_date as string) ?? '',
    original_end_date: (raw.original_end_date as string) ?? '',
    price_paid: toNumber(raw.price_paid),
    activated_at: (raw.activated_at as string | null) ?? null,
    cancelled_at: (raw.cancelled_at as string | null) ?? null,
    cancellation_reason: (raw.cancellation_reason as string | null) ?? null,
    payment: payment ? normalizePayment(payment) : undefined,
  };
}

export function normalizeDeliveryItem(raw: Raw): DeliveryItem {
  const menuItem = raw.menu_item as Raw | undefined;
  const category = raw.category as Raw | undefined;
  const pkg = raw.package as Raw | null | undefined;

  return {
    id: raw.id as number,
    menu_item_id: (raw.menu_item_id as number | null) ?? null,
    menu_item: menuItem
      ? {
          id: menuItem.id as number,
          name: menuItem.name as string,
          slug: menuItem.slug as string,
          image_url: (menuItem.image_url as string | null) ?? null,
        }
      : undefined,
    category_id: raw.category_id as number,
    category: category
      ? {
          id: category.id as number,
          name: category.name as string,
          is_swappable: Boolean(category.is_swappable),
        }
      : undefined,
    quantity: raw.quantity as number,
    is_addon: Boolean(raw.is_addon),
    is_free_addon: Boolean(raw.is_free_addon),
    is_default: Boolean(raw.is_default),
    source: raw.source as DeliveryItem['source'],
    package: pkg ? { id: pkg.id as number, name: pkg.name as string } : null,

    // Swap state. `can_swap` is the server's whole answer — cutoff, lock and
    // category swappability folded into one boolean — so it is read, never
    // recomputed. A payload without these fields (an older backend) must read
    // as "not swappable" rather than as permission.
    swap_locked: Boolean(raw.swap_locked),
    swap_locked_at: (raw.swap_locked_at as string | null) ?? null,
    was_swapped: Boolean(raw.was_swapped),
    swapped_from: (raw.swapped_from as string | null) ?? null,
    can_swap: Boolean(raw.can_swap),
    swap_blocked_reason:
      (raw.swap_blocked_reason as DeliveryItem['swap_blocked_reason']) ?? null,
    swap_blocked_message: (raw.swap_blocked_message as string | null) ?? null,
  };
}

export function normalizeDelivery(raw: Raw): Delivery {
  const items = raw.items as Raw[] | undefined;
  const slot = raw.slot as Raw | undefined;
  return {
    id: raw.id as number,
    subscription_id: raw.subscription_id as number,
    delivery_date: (raw.delivery_date as string) ?? '',
    slot_id: raw.slot_id as number,
    slot: slot ? normalizeDeliverySlot(slot) : undefined,
    status: raw.status as Delivery['status'],
    is_customized: Boolean(raw.is_customized),
    cutoff_at: (raw.cutoff_at as string) ?? '',
    before_cutoff: Boolean(raw.before_cutoff),
    items: items?.map(normalizeDeliveryItem),
  };
}

export function normalizeQuota(raw: Raw): SubscriptionQuota {
  const menuItem = raw.menu_item as Raw | undefined;
  const allowed = toNumber(raw.allowed);
  const consumed = toNumber(raw.consumed);
  return {
    menu_item_id: raw.menu_item_id as number,
    menu_item: menuItem
      ? {
          id: menuItem.id as number,
          name: menuItem.name as string,
          slug: menuItem.slug as string,
        }
      : undefined,
    week_number: raw.week_number as number,
    allowed,
    consumed,
    // Server sends this, but derive as a fallback so the meter never shows NaN.
    remaining:
      raw.remaining === undefined
        ? Math.max(0, allowed - consumed)
        : toNumber(raw.remaining),
  };
}

// â”€â”€ Swap options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function normalizeSwapTarget(raw: Raw): SwapTarget {
  return {
    item_id: raw.item_id as number,
    delivery_id: raw.delivery_id as number,
    delivery_date: (raw.delivery_date as string) ?? '',
    slot_id: (raw.slot_id as number | null) ?? null,
    slot_name: (raw.slot_name as string | null) ?? null,
    menu_item_id: raw.menu_item_id as number,
    name: (raw.name as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    quantity: toNumber(raw.quantity),
    eligible: Boolean(raw.eligible),
    reason: (raw.reason as SwapBlockedReason | null) ?? null,
    message: (raw.message as string | null) ?? null,
  };
}

export function normalizeSwapPosition(raw: Raw): SwapPosition {
  const targets = (raw.targets as Raw[] | undefined) ?? [];
  return {
    item_id: raw.item_id as number,
    delivery_id: raw.delivery_id as number,
    menu_item_id: raw.menu_item_id as number,
    name: (raw.name as string | null) ?? null,
    category_id: raw.category_id as number,
    category_name: (raw.category_name as string | null) ?? null,
    quantity: toNumber(raw.quantity),
    is_addon: Boolean(raw.is_addon),
    week_number: toNumber(raw.week_number),
    can_swap: Boolean(raw.can_swap),
    blocked_reason: (raw.blocked_reason as SwapBlockedReason | null) ?? null,
    blocked_message: (raw.blocked_message as string | null) ?? null,
    targets: targets.map(normalizeSwapTarget),
  };
}

export function normalizeSwapOptions(raw: Raw): DeliverySwapOptions {
  const positions = (raw.positions as Raw[] | undefined) ?? [];
  return {
    delivery_id: raw.delivery_id as number,
    delivery_date: (raw.delivery_date as string) ?? '',
    before_cutoff: Boolean(raw.before_cutoff),
    cutoff_at: (raw.cutoff_at as string | null) ?? null,
    positions: positions.map(normalizeSwapPosition),
  };
}

// â”€â”€ The plan schedule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeSchedulePlate(raw: Raw): SchedulePlate {
  const pkg = raw.package as Raw | null | undefined;
  return {
    id: raw.id as number,
    menu_item_id: raw.menu_item_id as number,
    name: (raw.name as string | null) ?? null,
    slug: (raw.slug as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    category_id: raw.category_id as number,
    category_name: (raw.category_name as string | null) ?? null,
    quantity: toNumber(raw.quantity),
    is_addon: Boolean(raw.is_addon),
    is_free_addon: Boolean(raw.is_free_addon),
    source: (raw.source as string) ?? 'plan',
    package: pkg ? { id: pkg.id as number, name: pkg.name as string } : null,
    was_swapped: Boolean(raw.was_swapped),
    original_name: (raw.original_name as string | null) ?? null,
    can_swap: Boolean(raw.can_swap),
    swap_blocked_reason: (raw.swap_blocked_reason as SwapBlockedReason | null) ?? null,
    swap_blocked_message: (raw.swap_blocked_message as string | null) ?? null,
  };
}

function normalizeScheduleMeal(raw: Raw): ScheduleMeal {
  const slot = (raw.slot as Raw | undefined) ?? {};
  const items = (raw.items as Raw[] | undefined) ?? [];
  return {
    delivery_id: raw.delivery_id as number,
    slot: {
      id: slot.id as number,
      name: (slot.name as string) ?? '',
      slug: (slot.slug as string) ?? '',
      start_time: (slot.start_time as string | null) ?? null,
      end_time: (slot.end_time as string | null) ?? null,
    },
    status: (raw.status as string) ?? 'scheduled',
    cutoff_at: (raw.cutoff_at as string | null) ?? null,
    before_cutoff: Boolean(raw.before_cutoff),
    is_customized: Boolean(raw.is_customized),
    items: items.map(normalizeSchedulePlate),
  };
}

function normalizeScheduleDayEntry(raw: Raw): ScheduleDay {
  const meals = (raw.meals as Raw[] | undefined) ?? [];
  const dayNumber = toNumber(raw.day_number) || 1;
  return {
    date: (raw.date as string) ?? '',
    day_number: dayNumber,
    day_name: (raw.day_name as string) ?? DAY_NAMES[dayNumber - 1] ?? '',
    week_number: toNumber(raw.week_number) || 1,
    meals: meals.map(normalizeScheduleMeal),
  };
}

export function normalizeSubscriptionSchedule(raw: Raw): SubscriptionSchedule {
  const weeks = (raw.weeks as Raw[] | undefined) ?? [];
  return {
    subscription_id: raw.subscription_id as number,
    start_date: (raw.start_date as string) ?? '',
    end_date: (raw.end_date as string) ?? '',
    weeks: weeks.map((week) => ({
      week_number: toNumber(week.week_number) || 1,
      starts_on: (week.starts_on as string) ?? '',
      ends_on: (week.ends_on as string) ?? '',
      days: ((week.days as Raw[] | undefined) ?? []).map(normalizeScheduleDayEntry),
    })),
  };
}

export function normalizeMealSwapEntry(raw: Raw): MealSwapEntry {
  const side = (value: unknown) => {
    const s = (value as Raw | undefined) ?? {};
    return {
      dish: (s.dish as string | null) ?? null,
      from: (s.from as string | null) ?? null,
      to: (s.to as string | null) ?? null,
    };
  };

  return {
    id: raw.id as number,
    week_number: toNumber(raw.week_number),
    category: (raw.category as string | null) ?? null,
    swapped_at: (raw.swapped_at as string) ?? '',
    moved: side(raw.moved),
    in_exchange_for: side(raw.in_exchange_for),
  };
}

// â”€â”€ Packages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function normalizePackage(raw: Raw): FoodPackage {
  const items = raw.items as Raw[] | undefined;
  return {
    id: raw.id as number,
    name: raw.name as string,
    slug: raw.slug as string,
    description: (raw.description as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    price: toNumber(raw.price),
    sort_order: toNumber(raw.sort_order),
    // Only sent when the API loaded the contents; `null` keeps "no comparison
    // available" distinct from "costs nothing extra".
    a_la_carte_price:
      raw.a_la_carte_price === undefined || raw.a_la_carte_price === null
        ? null
        : toNumber(raw.a_la_carte_price),
    items: (items ?? []).map((item) => ({
      menu_item_id: item.menu_item_id as number,
      name: (item.name as string | null) ?? null,
      slug: (item.slug as string | null) ?? null,
      image_url: (item.image_url as string | null) ?? null,
      quantity: toNumber(item.quantity) || 1,
    })),
  };
}

// â”€â”€ List helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SINGLE_PAGE = (total: number): PaginationMeta => ({
  current_page: 1,
  per_page: total,
  total,
  last_page: 1,
});

/**
 * Normalise a paginated body. Several endpoints (`/plans`, `/delivery-slots`)
 * return a bare `{ data: [...] }` with no `meta`; those get a synthetic
 * single-page meta so callers can treat every list identically.
 */
export function normalizePaginated<T>(
  body: { data?: unknown[]; meta?: PaginationMeta } | unknown[],
  map: (raw: Raw) => T,
): Paginated<T> {
  const list = Array.isArray(body) ? body : (body?.data ?? []);
  const data = (list as Raw[]).map(map);
  const meta = (!Array.isArray(body) && body?.meta) || SINGLE_PAGE(data.length);
  return { data, meta };
}

/** Unwrap a list that may be a bare array or `{ data: [...] }`. */
export function normalizeList<T>(
  body: { data?: unknown[] } | unknown[],
  map: (raw: Raw) => T,
): T[] {
  const list = Array.isArray(body) ? body : (body?.data ?? []);
  return (list as Raw[]).map(map);
}

// ── Homepage CMS ─────────────────────────────────────────────────────────────

/**
 * A section type this build has no renderer for is dropped rather than passed
 * through. An admin can add a section to the backend before this app ships
 * support for it, and a blank gap on Home is worse than the section being
 * absent until the next release.
 */
function isAppSectionType(value: unknown): value is AppSectionType {
  return (
    typeof value === 'string' &&
    (APP_SECTION_TYPES as readonly string[]).includes(value)
  );
}

/** Empty string → null, so a blank CMS field reads as "use the default". */
function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function normalizeHomeBanner(raw: Raw): HomeBanner {
  return {
    id: raw.id as number,
    image_path: (raw.image_path as string) ?? '',
    image_url: nullableText(raw.image_url),
    alt_text: nullableText(raw.alt_text),
    title: nullableText(raw.title),
    subtitle: nullableText(raw.subtitle),
    cta_label: nullableText(raw.cta_label),
    cta_url: nullableText(raw.cta_url),
  };
}

/**
 * `content` is handed through once confirmed to be an object. The backend
 * validates it per section type, so re-checking each field here would duplicate
 * that contract — the components read every field defensively instead.
 */
function normalizeSectionContent(raw: unknown): HomeSectionContent | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as HomeSectionContent)
    : null;
}

export function normalizeHomeContent(raw: Raw): HomeContent {
  const sections = Array.isArray(raw.sections) ? (raw.sections as Raw[]) : [];

  return {
    sections: sections
      .filter((s) => isAppSectionType(s.type))
      .map((s) => ({
        type: s.type as AppSectionType,
        sort_order: (s.sort_order as number) ?? 0,
        content: normalizeSectionContent(s.content),
        banners: Array.isArray(s.banners)
          ? (s.banners as Raw[]).map(normalizeHomeBanner)
          : [],
      }))
      // The API already sorts; Home's layout depends on this order, so it is
      // cheap insurance rather than trust.
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}
