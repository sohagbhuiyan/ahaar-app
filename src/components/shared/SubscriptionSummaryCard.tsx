import { Text, View } from 'react-native';

import { Badge, Card, Separator, type BadgeVariant } from '@/components/ui';
import type { Subscription, SubscriptionStatus } from '@/lib/api/types/subscription';
import { cn, formatLongDate, formatMoney, todayISO } from '@/lib/utils';

interface Props {
  subscription: Subscription;
  /** Extra rows, e.g. a quota meter or an action button. */
  children?: React.ReactNode;
  className?: string;
}

const STATUS_VARIANT: Record<SubscriptionStatus, BadgeVariant> = {
  pending: 'warning',
  active: 'success',
  paused: 'warning',
  completed: 'muted',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  pending: 'Awaiting payment',
  active: 'Active',
  paused: 'Paused',
  completed: 'Finished',
  cancelled: 'Cancelled',
};

/**
 * At-a-glance state of one subscription.
 *
 * "Day N of M" counts from the subscriber's own `start_date`, not the calendar
 * week — a plan starting on a Thursday is on day 1 that Thursday.
 *
 * `end_date` (not `original_end_date`) drives the remaining count, because
 * every paused day pushes the end later and the customer should see the date
 * they will actually be served until.
 */
export function SubscriptionSummaryCard({
  subscription,
  children,
  className,
}: Props) {
  const { plan, status, start_date, end_date } = subscription;

  const totalDays = daySpan(start_date, end_date);
  const elapsed = daySpan(start_date, todayISO());
  // Clamp: before the start date `elapsed` is 0 or negative; after the end it
  // overshoots. Neither should render as "day 0" or "day 34 of 30".
  const currentDay = Math.min(Math.max(elapsed, 1), Math.max(totalDays, 1));
  const isRunning = status === 'active' || status === 'paused';

  const extended =
    subscription.original_end_date !== '' &&
    subscription.end_date !== subscription.original_end_date;

  return (
    <Card className={className}>
      <View className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-text-primary">
              {plan?.name ?? 'Subscription'}
            </Text>
            <Text className="mt-0.5 text-xs text-text-muted">
              {formatLongDate(start_date)} → {formatLongDate(end_date)}
            </Text>
          </View>

          <Badge label={STATUS_LABEL[status]} variant={STATUS_VARIANT[status]} />
        </View>

        {isRunning && totalDays > 0 ? (
          <View className="mt-4 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold text-text-secondary">
                Day {currentDay} of {totalDays}
              </Text>
              <Text className="text-xs text-text-muted">
                {Math.max(0, totalDays - currentDay)} days left
              </Text>
            </View>

            <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
              <View
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(currentDay / totalDays) * 100}%` }}
              />
            </View>

            {extended ? (
              <Text className="text-[11px] text-text-muted">
                Extended past {formatLongDate(subscription.original_end_date)} to
                make up paused days.
              </Text>
            ) : null}
          </View>
        ) : null}

        {plan ? (
          <>
            <Separator className="my-4" />
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-text-secondary">Paid</Text>
              <Text className="text-base font-bold text-text-primary">
                {formatMoney(subscription.price_paid)}
              </Text>
            </View>
          </>
        ) : null}

        {children ? <View className={cn('mt-4')}>{children}</View> : null}
      </View>
    </Card>
  );
}

/**
 * Inclusive day count between two YYYY-MM-DD dates (same day = 1).
 *
 * Parsed at UTC midnight so a device in a different timezone from the server
 * can't be off by one.
 */
function daySpan(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.floor((end - start) / 86_400_000) + 1;
}
