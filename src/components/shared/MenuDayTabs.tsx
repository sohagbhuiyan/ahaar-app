import { useMemo } from 'react';

import { Tabs, type TabItem } from '@/components/ui';
import type { Delivery } from '@/lib/api/types/subscription';
import { isToday } from '@/lib/utils';

interface Props {
  deliveries: Delivery[];
  /** YYYY-MM-DD */
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Day selector across a subscription's deliveries.
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
    return [...deliveries]
      .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date))
      .map((delivery) => {
        const date = new Date(`${delivery.delivery_date}T00:00:00Z`);
        const weekdayIndex = date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1;

        return {
          value: delivery.delivery_date,
          label: isToday(delivery.delivery_date)
            ? 'Today'
            : WEEKDAY_SHORT[weekdayIndex],
          sublabel: String(date.getUTCDate()),
          // Skipped and cancelled days are shown but not selectable: hiding
          // them would silently renumber the week and confuse a paused plan.
          disabled: delivery.status === 'skipped',
        };
      });
  }, [deliveries]);

  return (
    <Tabs items={items} value={value} onChange={onChange} scrollable className={className} />
  );
}
