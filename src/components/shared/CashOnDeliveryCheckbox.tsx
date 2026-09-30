import { Text, View } from 'react-native';

import { Checkbox } from '@/components/ui';
import { CASH_MAX_AMOUNT, isCashAllowedForAmount } from '@/lib/payments';
import { cn, formatMoney } from '@/lib/utils';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * The order total, so the box can state the exact sum and police the cap.
   *
   * Optional because not every flow knows it: a guest order is priced from the
   * delivery's own items server-side, so the app genuinely cannot name a figure
   * before placing it. Left out, the box drops the amount from its copy rather
   * than printing a wrong one, and leaves the ceiling to the API.
   */
  total?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * The one control that decides how an order gets paid for.
 *
 * Deliberately a single tick box rather than a two-option list. There are only
 * two ways to pay and one of them is the default, so a pair of radio buttons
 * would make the customer read both to discover that the left one is what
 * already happens. A tick box says the one thing that is actually a choice —
 * "I will pay the rider instead" — and the line underneath says plainly what
 * happens if it is left alone.
 *
 * Above `CASH_MAX_AMOUNT` the box is disabled rather than hidden. A control
 * that vanishes as the basket grows reads as a bug; one that stays put and
 * explains itself reads as a rule. The server enforces the same ceiling in
 * `OrderController::withPayment`, so this is a courtesy, not the guard.
 */
export function CashOnDeliveryCheckbox({
  checked,
  onChange,
  total,
  disabled = false,
  className,
}: Props) {
  const overCap = total !== undefined && !isCashAllowedForAmount(total);
  const isDisabled = disabled || overCap;

  const payLine =
    total !== undefined
      ? `Pay ${formatMoney(total)} in cash to the rider when your food arrives.`
      : 'Pay in cash to the rider when your food arrives.';

  return (
    <View className={cn('gap-2', className)}>
      <Checkbox
        checked={checked && !overCap}
        onChange={onChange}
        disabled={isDisabled}
        label="Cash on Delivery"
        description={
          overCap
            ? `Cash is only available on orders up to ${formatMoney(CASH_MAX_AMOUNT)}. This order will be paid by card.`
            : payLine
        }
      />

      {!checked || overCap ? (
        <Text className="px-1 text-xs leading-5 text-text-muted">
          Leave this unticked to pay securely by card now.
        </Text>
      ) : (
        <Text className="px-1 text-xs leading-5 text-text-muted">
          Please have the exact amount ready — riders may not carry change.
        </Text>
      )}
    </View>
  );
}
