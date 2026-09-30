/**
 * Handing a pending payment off to its gateway.
 *
 * `POST /subscriptions`, `/orders/extra`, `/orders/guest` and `/orders/instant`
 * all create the record in `pending` and attach a `Payment` whose
 * `checkout_url` points at Mollie or Stripe. Nothing is confirmed until that
 * page is completed and the gateway calls the webhook back — so an order that
 * looks "placed" in the UI is not paid for until the customer has been through
 * here.
 *
 * The web app does `window.location.href = checkout_url`. The mobile
 * equivalent is an in-app browser rather than `Linking.openURL`: it keeps the
 * app in the background instead of task-switching away, and it resolves when
 * the sheet is dismissed, which is the cue to re-read the order and find out
 * what actually happened.
 */
import * as WebBrowser from 'expo-web-browser';

import { colors } from './theme';
import type { Payment, PaymentGateway, PaymentStatus } from './api/types/order';

/** The gateway name the API uses for cash on delivery. */
export const CASH_GATEWAY: PaymentGateway = 'cash';

/**
 * The largest order a rider is expected to collect in cash.
 *
 * Mirrors `payments.gateways.cash.max_amount` on the API, which is what
 * actually enforces it — this copy only exists so the checkbox can grey itself
 * out and say why, instead of letting the customer fill in a basket, tick the
 * box and discover the rule from a 422. If the two ever drift, the server
 * wins and the customer sees its message.
 */
export const CASH_MAX_AMOUNT = 500;

/** Whether an order of this size may be paid for in cash. */
export function isCashAllowedForAmount(total: number): boolean {
  return total <= CASH_MAX_AMOUNT;
}

/**
 * A payment still waiting on the customer, with somewhere to send them.
 *
 * Cash payments are excluded by construction rather than by a special case:
 * `CashOnDeliveryGateway` returns no `checkout_url`, so a cash order is
 * `pending` forever from the app's point of view and can never render a "Pay
 * now" button that would lead nowhere.
 */
export function isPayable(payment: Payment | null | undefined): payment is Payment & {
  checkout_url: string;
} {
  return payment?.status === 'pending' && Boolean(payment.checkout_url);
}

/**
 * A payment the customer settles at the door.
 *
 * `pending` here means "not collected yet", not "not finished" — the order
 * behind it is already confirmed and the kitchen is already cooking it. Every
 * screen that prints a payment status needs this distinction, or a perfectly
 * healthy cash order reads as a failed one.
 */
export function isCashOnDelivery(payment: Payment | null | undefined): boolean {
  return payment?.gateway === CASH_GATEWAY;
}

/** Waiting on the rider to collect. */
export function isAwaitingCash(payment: Payment | null | undefined): boolean {
  return isCashOnDelivery(payment) && payment?.status === 'pending';
}

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Awaiting payment',
  succeeded: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partly refunded',
};

/**
 * What to print for a payment's state, in the customer's words.
 *
 * Lives here rather than in each screen because cash makes the mapping
 * conditional, and three copies of it had already drifted ("Awaiting payment"
 * on one screen, "Payment due" on another). `pending` is the case that matters:
 * on a card order it means something went wrong or was abandoned, but on a cash
 * order it is the normal, healthy state of an order that is on its way — and
 * "Awaiting payment" against a meal the kitchen is already cooking reads as a
 * fault the customer needs to fix.
 */
export function paymentStatusLabel(payment: Payment | null | undefined): string {
  if (!payment) return '';
  if (isAwaitingCash(payment)) return 'Pay on delivery';
  return PAYMENT_STATUS_LABEL[payment.status] ?? payment.status;
}

/**
 * The badge tone for a payment's state.
 *
 * Cash pending is deliberately neutral rather than `warning`: nothing is wrong
 * and there is nothing for the customer to act on, so an amber badge would be
 * an alarm about the arrangement they deliberately chose.
 */
export function paymentStatusTone(
  payment: Payment | null | undefined,
): 'success' | 'warning' | 'danger' | 'muted' | 'brand' {
  if (!payment) return 'muted';
  if (isAwaitingCash(payment)) return 'brand';

  switch (payment.status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'muted';
  }
}

/** How the money is being taken, for a summary row. */
export function paymentMethodLabel(payment: Payment | null | undefined): string {
  if (!payment) return '—';
  if (isCashOnDelivery(payment)) return 'Cash on delivery';
  return payment.gateway;
}

/**
 * Open the gateway's checkout page and resolve once the customer comes back.
 *
 * Resolving does **not** mean the payment succeeded — dismissing the sheet
 * looks identical to completing it from here. The only reliable answer is the
 * server's, so every caller refetches the order/subscription afterwards rather
 * than assuming an outcome.
 */
export async function openCheckout(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    // Match the app chrome so the hand-off doesn't look like leaving Ahaar.
    toolbarColor: colors.surface.DEFAULT,
    controlsColor: colors.brand[500],
    dismissButtonStyle: 'close',
    enableBarCollapsing: true,
  });
}
