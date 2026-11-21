import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Tabs, type TabItem } from "@/components/ui";
import type { Delivery } from "@/lib/api/types/subscription";
import { useFormatters } from "@/lib/i18n/format";
import { isToday } from "@/lib/utils";

interface Props {
  deliveries: Delivery[];
  /** YYYY-MM-DD */
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
}

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
  const { t } = useTranslation();
  const { formatDate } = useFormatters();
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
        // ISO weekday, 1 = Monday … 7 = Sunday (common.weekdays.short.<n>).
        const isoWeekday = parsed.getUTCDay() === 0 ? 7 : parsed.getUTCDay();

        return {
          value: date,
          label: isToday(date)
            ? t("common.time.today")
            : t(`common.weekdays.short.${isoWeekday}`),
          // A bare YYYY-MM-DD is parsed as a local calendar day by formatDate.
          sublabel: formatDate(date, { day: "numeric", month: "short" }),
          disabled: meals.every((m) => m.status === "skipped"),
        };
      });
  }, [deliveries, t, formatDate]);

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
