/**
 * Calendar maths for a subscription's deliveries.
 *
 * The Deliveries screen reads Date → Slot → Meal, so everything here turns the
 * flat `GET /deliveries` list into that shape: meals grouped by calendar date
 * in time-of-day order, and dates laid out in plan weeks.
 *
 * Weeks are anchored at the subscription's `start_date`, not at Monday, which
 * is how the backend numbers them too (days 1–7 are week 1) — so "Week 2" here
 * is the same week the quotas and swap rules talk about.
 *
 * All date arithmetic runs at UTC midnight on `YYYY-MM-DD` strings: a delivery
 * date is a calendar day, and doing the walk in local time would let a DST
 * change skip or repeat one.
 */
import type { Delivery } from './api/types/subscription';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** A 12-month plan is 53 weeks; anything past this is bad data, not a plan. */
const MAX_WEEKS = 60;

/** `YYYY-MM-DD` plus `days`. Unparseable input comes back unchanged. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Chronological within a day; a delivery without a slot time sorts last. */
function byTimeOfDay(a: Delivery, b: Delivery): number {
  return (a.slot?.start_time ?? '99:99').localeCompare(b.slot?.start_time ?? '99:99');
}

/**
 * Every date's meals, breakfast before lunch before dinner.
 *
 * Sorted by slot time, never by id: the catalogue happens to create lunch
 * before breakfast, so id order would print the day out of sequence.
 */
export function groupDeliveriesByDate(deliveries: Delivery[]): Map<string, Delivery[]> {
  const byDate = new Map<string, Delivery[]>();
  for (const delivery of deliveries) {
    const list = byDate.get(delivery.delivery_date);
    if (list) list.push(delivery);
    else byDate.set(delivery.delivery_date, [delivery]);
  }
  for (const list of byDate.values()) list.sort(byTimeOfDay);
  return byDate;
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  /** This date's meals, in time-of-day order. Empty when not a plan day. */
  deliveries: Delivery[];
  /** Whether the plan delivers on this date at all. */
  inPlan: boolean;
}

export interface DeliveryWeek {
  /** 1-based plan week. */
  number: number;
  /** Always seven consecutive days, so every week row lines up. */
  days: CalendarDay[];
  from: string;
  to: string;
}

/**
 * The plan as rows of seven days, from `anchor` (the subscription's start
 * date) through its last delivery.
 *
 * Days inside a week that the plan does not deliver on — before a late first
 * delivery, or after the last — are still present with `inPlan: false`, so a
 * week always renders as a full, evenly spaced row.
 */
export function buildDeliveryWeeks(
  byDate: Map<string, Delivery[]>,
  anchor?: string | null,
): DeliveryWeek[] {
  const dates = [...byDate.keys()].filter((d) => ISO_DATE.test(d)).sort();
  if (dates.length === 0) return [];

  const first = dates[0];
  const last = dates[dates.length - 1];
  // A start date after the first delivery would hide days; ignore it then.
  const start = anchor && ISO_DATE.test(anchor) && anchor <= first ? anchor : first;

  const weeks: DeliveryWeek[] = [];
  for (let from = start; from <= last && weeks.length < MAX_WEEKS; from = addDays(from, 7)) {
    const days = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(from, offset);
      const deliveries = byDate.get(date) ?? [];
      return { date, deliveries, inPlan: deliveries.length > 0 };
    });
    weeks.push({ number: weeks.length + 1, days, from, to: addDays(from, 6) });
  }
  return weeks;
}

/** Index of the week containing `date`, or `null` when no week does. */
export function weekIndexOf(weeks: DeliveryWeek[], date: string | null): number | null {
  if (!date) return null;
  const index = weeks.findIndex((week) => date >= week.from && date <= week.to);
  return index === -1 ? null : index;
}

/**
 * The day to open on: today when the plan delivers today, otherwise the next
 * plan day, otherwise — the plan has finished — its last day.
 */
export function defaultDeliveryDate(dates: string[], today: string): string | null {
  if (dates.length === 0) return null;
  return dates.find((date) => date >= today) ?? dates[dates.length - 1];
}

/**
 * What a meal means to the customer right now.
 *
 * - `open`      still changeable — `before_cutoff` is the server's answer
 * - `locked`    past its cutoff; the kitchen has it
 * - `delivered` done
 * - `off`       skipped or paused, so nothing arrives
 */
export type MealTone = 'open' | 'locked' | 'delivered' | 'off';

export function mealTone(delivery: Delivery): MealTone {
  if (delivery.status === 'delivered') return 'delivered';
  if (delivery.status === 'skipped' || delivery.status === 'paused') return 'off';
  return delivery.before_cutoff && delivery.status === 'scheduled' ? 'open' : 'locked';
}

/** `morning` / `midday` / `evening` — for the slot's icon. Name first, then time. */
export type SlotPeriod = 'morning' | 'midday' | 'evening';

export function slotPeriod(slot: Delivery['slot']): SlotPeriod {
  const name = `${slot?.name ?? ''} ${slot?.slug ?? ''}`.toLowerCase();
  if (/breakfast|morning|brunch/.test(name)) return 'morning';
  if (/lunch|noon|midday/.test(name)) return 'midday';
  if (/dinner|supper|evening|night/.test(name)) return 'evening';

  const hour = Number((slot?.start_time ?? '').slice(0, 2));
  if (!Number.isFinite(hour) || hour < 11) return 'morning';
  return hour < 16 ? 'midday' : 'evening';
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(parsed);
  } catch {
    return date;
  }
}

/** "Mon" */
export const weekdayShort = (date: string) => formatDate(date, { weekday: 'short' });

/** "4" — the day of the month, without a leading zero. */
export const dayOfMonth = (date: string) => String(Number(date.slice(8, 10)));

/** "4 Jan" (order follows the device locale). */
export const formatDayMonth = (date: string) => formatDate(date, { day: 'numeric', month: 'short' });

/** "Friday, 4 January" (order follows the device locale). */
export const formatDayHeading = (date: string) =>
  formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' });

/** "3 – 9 Jan", or "29 Jan – 4 Feb" across a month boundary. */
export function formatWeekRange(from: string, to: string): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  const start = sameMonth ? dayOfMonth(from) : formatDayMonth(from);
  return `${start} – ${formatDayMonth(to)}`;
}

/** "Thu 20:00" in the device's clock — when a meal stops accepting changes. */
export function formatCutoff(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(at);
  } catch {
    return null;
  }
}
