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
import type { Payment } from './api/types/order';

/** A payment still waiting on the customer, with somewhere to send them. */
export function isPayable(payment: Payment | null | undefined): payment is Payment & {
  checkout_url: string;
} {
  return payment?.status === 'pending' && Boolean(payment.checkout_url);
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
