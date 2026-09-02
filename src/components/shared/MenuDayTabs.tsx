import { useMemo } from "react";

import { Tabs, type TabItem } from "@/components/ui";
import type { Delivery } from "@/lib/api/types/subscription";
import { isToday } from "@/lib/utils";

interface Props {
  deliveries: Delivery[];
  /** YYYY-MM-DD */
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Day selector across a subscription's deliveries.
 *
 * Keyed by **date**, not by delivery. A subscription covers every meal its plan
 * serves, so one Monday can be three deliveries — breakfast, lunch and dinner —
 * and mapping the raw list would render Monday three times.
 *
 * Ordered by real calendar date, starting at the subscriber's own `start_date`
 * — NOT at Monday. A subscription beginning on a Thursday shows Thu, Fri, Sat…
 * because the backend anchors day 1 to `start_date` and maps each date to that
 * date's own weekday menu.
 *
 * Dates are parsed at UTC midnight so a device east or west of the server
 * never shifts a delivery onto the wrong weekday.
 */
export function MenuDayTabs({ deliveries, value, onChange, className }: Props) {
  const items = useMemo<TabItem<string>[]>(() => {
    const byDate = new Map<string, Delivery[]>();
    for (const delivery of deliveries) {
      const forDate = byDate.get(delivery.delivery_date);
      if (forDate) forDate.push(delivery);
      else byDate.set(delivery.delivery_date, [delivery]);
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, meals]) => {
        const parsed = new Date(`${date}T00:00:00Z`);
        const weekdayIndex =
          parsed.getUTCDay() === 0 ? 6 : parsed.getUTCDay() - 1;
        const monthShort = new Intl.DateTimeFormat(undefined, {
          month: "short",
          timeZone: "UTC",
        }).format(parsed);

        return {
          value: date,
          label: isToday(date) ? "Today" : WEEKDAY_SHORT[weekdayIndex],
          sublabel: `${parsed.getUTCDate()}, ${monthShort}`, 
          disabled: meals.every((m) => m.status === "skipped"),
        };
      });
  }, [deliveries]);

  return (
    <Tabs
      items={items}
      value={value}
      onChange={onChange}
      scrollable
      className={className}
    />
  );
}
