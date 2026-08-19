/**
 * Delivery-slot availability.
 *
 * `GET /delivery-slots` returns every configured slot and accepts no date
 * filter, so the API cannot tell the UI what is still orderable on a given day.
 * What it does return is `cutoff_hours` — how many hours before the slot starts
 * that ordering closes. Turning that into "may the customer still pick this
 * slot for this date?" is therefore the client's job, and this module owns the
 * rule so the instant-order screen, the extra-order sheet and subscription
 * checkout all agree on it.
 *
 * Ported from the web app's `ahaar/src/lib/slots.ts` so both platforms close a
 * slot at the same moment. Comparisons run in the device's local timezone,
 * which is the clock the customer is reading. The API re-checks the cutoff on
 * write and remains the authority — this only stops the UI offering a choice
 * the server would reject.
 */
import type { DeliverySlot, PlanSlot } from './api/types/catalog';
import { toISODate } from './utils';

/** `"12:00:00"` | `"12:00"` → `"12:00"`. Empty string when unparseable. */
export function hhmm(time?: string | null): string {
  const match = /^(\d{1,2}):(\d{2})/.exec((time ?? '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

/**
 * Anything slot-shaped enough to label. A plan nests a slot whose times may be
 * null, so the formatters degrade to just the name.
 */
export interface SlotLike {
  name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

/** Human-readable delivery window, e.g. `"12:00–14:00"`. */
export function slotWindow(slot: SlotLike): string {
  const start = hhmm(slot.start_time);
  const end = hhmm(slot.end_time);
  if (!start) return end;
  return end ? `${start}–${end}` : start;
}

/** `"Lunch · 12:00–14:00"` — the one-line label used in summaries and cards. */
export function slotLabel(slot: SlotLike): string {
  return [slot.name, slotWindow(slot)].filter(Boolean).join(' · ');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Slot-shaped enough to compute a cutoff from. Covers `DeliverySlot` and `PlanSlot`. */
type CutoffSlot = Pick<DeliverySlot, 'start_time'> & {
  cutoff_hours?: number | null;
};

/** Local `Date` at which the slot starts on `date` (YYYY-MM-DD), or null. */
export function slotStartAt(slot: CutoffSlot, date: string): Date | null {
  const time = hhmm(slot.start_time);
  if (!ISO_DATE.test(date) || !time) return null;
  // No trailing `Z` — parsed in the device's timezone, deliberately.
  const at = new Date(`${date}T${time}:00`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Local `Date` at which ordering closes for this slot on `date`, or null. */
export function slotCutoffAt(slot: CutoffSlot, date: string): Date | null {
  const start = slotStartAt(slot, date);
  if (!start) return null;
  const hours = Number(slot.cutoff_hours);
  const cutoff = new Date(start);
  cutoff.setMinutes(cutoff.getMinutes() - (Number.isFinite(hours) ? hours : 0) * 60);
  return cutoff;
}

export type SlotClosedReason = 'cutoff' | 'invalid';

export interface SlotAvailability {
  slot: DeliverySlot;
  /** Whether the customer may still choose this slot for the requested date. */
  isBookable: boolean;
  startAt: Date | null;
  cutoffAt: Date | null;
  /** Only set when `isBookable` is false. */
  reason?: SlotClosedReason;
  /** Ready-to-render explanation, e.g. `"Order by 09:00"` / `"Closed 09:00"`. */
  hint: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `"09:00"` when the cutoff is today, otherwise `"22 Jul, 09:00"`. */
function formatCutoff(cutoffAt: Date, now: Date): string {
  const time = `${String(cutoffAt.getHours()).padStart(2, '0')}:${String(
    cutoffAt.getMinutes(),
  ).padStart(2, '0')}`;

  if (isSameDay(cutoffAt, now)) return time;

  try {
    const day = new Intl.DateTimeFormat(undefined, {
      day: 'numeric',
      month: 'short',
    }).format(cutoffAt);
    return `${day}, ${time}`;
  } catch {
    return time;
  }
}

/** Whether `slot` can still be booked for `date`, and why not when it can't. */
export function slotAvailability(
  slot: DeliverySlot,
  date: string,
  now: Date = new Date(),
): SlotAvailability {
  const startAt = slotStartAt(slot, date);
  const cutoffAt = slotCutoffAt(slot, date);

  if (!startAt || !cutoffAt) {
    return {
      slot,
      isBookable: false,
      startAt,
      cutoffAt,
      reason: 'invalid',
      hint: 'Unavailable',
    };
  }

  if (now.getTime() >= cutoffAt.getTime()) {
    return {
      slot,
      isBookable: false,
      startAt,
      cutoffAt,
      reason: 'cutoff',
      hint: `Closed ${formatCutoff(cutoffAt, now)}`,
    };
  }

  return {
    slot,
    isBookable: true,
    startAt,
    cutoffAt,
    hint: `Order by ${formatCutoff(cutoffAt, now)}`,
  };
}

/** Availability for every slot on `date`, in delivery-time order. */
export function slotAvailabilityFor(
  slots: DeliverySlot[],
  date: string,
  now: Date = new Date(),
): SlotAvailability[] {
  return slots
    .map((slot) => slotAvailability(slot, date, now))
    .sort((a, b) => hhmm(a.slot.start_time).localeCompare(hhmm(b.slot.start_time)));
}

/** The earliest still-open slot, or null when the whole day has closed. */
export function firstBookableSlotId(options: SlotAvailability[]): number | null {
  return options.find((o) => o.isBookable)?.slot.id ?? null;
}

/**
 * Earliest date on which `slot` is still bookable, scanning forward from
 * `from`.
 *
 * `POST /subscriptions` additionally refuses anything before tomorrow
 * (`after_or_equal:tomorrow`), so pass `minDate` to floor the scan — a plan
 * whose lunch cutoff hasn't passed today still cannot *start* today.
 */
export function earliestBookableDate(
  slots: CutoffSlot[],
  minDate: string,
  now: Date = new Date(),
  lookaheadDays = 14,
): string {
  const probe = new Date(`${minDate}T00:00:00`);
  let date = minDate;

  for (let i = 0; i <= lookaheadDays; i++) {
    date = toISODate(probe);
    if (slots.length === 0) return date;

    const allOpen = slots.every((slot) => {
      const cutoffAt = slotCutoffAt(slot, date);
      // A slot with no usable time can't be proven closed; treat it as open
      // and let the server have the final word.
      return cutoffAt === null || now.getTime() < cutoffAt.getTime();
    });
    if (allOpen) return date;

    probe.setDate(probe.getDate() + 1);
  }

  return date;
}

/** A `PlanSlot` widened to `DeliverySlot`, for pickers that take either. */
export function planSlotAsDeliverySlot(slot: PlanSlot): DeliverySlot {
  return {
    id: slot.id,
    name: slot.name,
    slug: slot.slug,
    start_time: slot.start_time ?? '',
    end_time: slot.end_time ?? '',
    cutoff_hours: slot.cutoff_hours ?? 0,
  };
}
