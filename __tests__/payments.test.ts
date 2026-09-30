import type { Payment } from '@/lib/api/types/order';
import {
  CASH_MAX_AMOUNT,
  isAwaitingCash,
  isCashAllowedForAmount,
  isCashOnDelivery,
  isPayable,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
} from '@/lib/payments';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    amount: 45,
    currency: 'SAR',
    status: 'pending',
    gateway: 'stripe',
    checkout_url: 'https://pay.example/1',
    paid_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const cash = (overrides: Partial<Payment> = {}) =>
  payment({ gateway: 'cash', checkout_url: null, ...overrides });

describe('isPayable', () => {
  it('is true only for a pending payment that has somewhere to send the customer', () => {
    expect(isPayable(payment())).toBe(true);
    expect(isPayable(payment({ status: 'succeeded' }))).toBe(false);
    expect(isPayable(payment({ checkout_url: null }))).toBe(false);
    expect(isPayable(null)).toBe(false);
  });

  it('is never true for cash, which has no checkout page to offer', () => {
    // This is the guard that stops a "Pay now" button appearing on a cash
    // order and leading nowhere.
    expect(isPayable(cash())).toBe(false);
  });
});

describe('cash recognition', () => {
  it('identifies a cash payment by its gateway', () => {
    expect(isCashOnDelivery(cash())).toBe(true);
    expect(isCashOnDelivery(payment())).toBe(false);
    expect(isCashOnDelivery(undefined)).toBe(false);
  });

  it('treats cash as awaiting collection only while it is pending', () => {
    expect(isAwaitingCash(cash())).toBe(true);
    expect(isAwaitingCash(cash({ status: 'succeeded' }))).toBe(false);
    expect(isAwaitingCash(payment())).toBe(false);
  });
});

describe('the cash ceiling', () => {
  it('allows an order at the limit and refuses one above it', () => {
    expect(isCashAllowedForAmount(CASH_MAX_AMOUNT)).toBe(true);
    expect(isCashAllowedForAmount(CASH_MAX_AMOUNT + 0.01)).toBe(false);
  });
});

describe('paymentStatusLabel', () => {
  it('reads a pending cash payment as the healthy state it is', () => {
    // "Awaiting payment" against a meal the kitchen is already cooking reads
    // as a fault the customer has to fix. It is not one.
    expect(paymentStatusLabel(cash())).toBe('Pay on delivery');
  });

  it('still warns on a pending card payment, which really is unfinished', () => {
    expect(paymentStatusLabel(payment())).toBe('Awaiting payment');
  });

  it('says "Paid" once the cash has been collected', () => {
    expect(paymentStatusLabel(cash({ status: 'succeeded' }))).toBe('Paid');
  });

  it('falls back to the raw status for a state it does not know', () => {
    expect(paymentStatusLabel(payment({ status: 'refunded' }))).toBe('Refunded');
  });
});

describe('paymentStatusTone', () => {
  it('keeps pending cash neutral — there is nothing for the customer to fix', () => {
    expect(paymentStatusTone(cash())).toBe('brand');
    expect(paymentStatusTone(payment())).toBe('warning');
  });

  it('maps the settled states the way every screen expects', () => {
    expect(paymentStatusTone(payment({ status: 'succeeded' }))).toBe('success');
    expect(paymentStatusTone(payment({ status: 'failed' }))).toBe('danger');
    expect(paymentStatusTone(payment({ status: 'refunded' }))).toBe('muted');
    expect(paymentStatusTone(null)).toBe('muted');
  });
});

describe('paymentMethodLabel', () => {
  it('names cash in the customer’s words and passes other gateways through', () => {
    expect(paymentMethodLabel(cash())).toBe('Cash on delivery');
    expect(paymentMethodLabel(payment())).toBe('stripe');
    expect(paymentMethodLabel(undefined)).toBe('—');
  });
});
