import { fireEvent, render, screen } from '@testing-library/react-native';

import { CashOnDeliveryCheckbox } from '@/components/shared/CashOnDeliveryCheckbox';
import { CASH_MAX_AMOUNT } from '@/lib/payments';

describe('CashOnDeliveryCheckbox', () => {
  it('starts unticked and says what happens if it is left alone', async () => {
    await render(
      <CashOnDeliveryCheckbox checked={false} onChange={jest.fn()} total={45} />,
    );

    const box = screen.getByRole('checkbox', { name: 'Cash on Delivery' });
    expect(box).toBeTruthy();
    expect(box.props.accessibilityState.checked).toBe(false);

    expect(screen.getByText('Leave this unticked to pay securely by card now.')).toBeTruthy();
  });

  it('names the exact amount the rider will collect', async () => {
    await render(
      <CashOnDeliveryCheckbox checked={false} onChange={jest.fn()} total={45} />,
    );

    expect(
      screen.getByText(/Pay .*45.*in cash to the rider when your food arrives\./),
    ).toBeTruthy();
  });

  it('reports the ticked state and reminds the customer to have change ready', async () => {
    await render(
      <CashOnDeliveryCheckbox checked onChange={jest.fn()} total={45} />,
    );

    const box = screen.getByRole('checkbox', { name: 'Cash on Delivery' });
    expect(box.props.accessibilityState.checked).toBe(true);

    expect(
      screen.getByText('Please have the exact amount ready — riders may not carry change.'),
    ).toBeTruthy();
  });

  it('toggles when the label is pressed, not just the tick box itself', async () => {
    const onChange = jest.fn();
    await render(
      <CashOnDeliveryCheckbox checked={false} onChange={onChange} total={45} />,
    );

    fireEvent.press(screen.getByRole('checkbox', { name: 'Cash on Delivery' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disables itself above the cash ceiling and says why', async () => {
    const onChange = jest.fn();
    await render(
      <CashOnDeliveryCheckbox
        checked={false}
        onChange={onChange}
        total={CASH_MAX_AMOUNT + 1}
      />,
    );

    const box = screen.getByRole('checkbox', { name: 'Cash on Delivery' });
    expect(box.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Cash is only available on orders up to/)).toBeTruthy();

    fireEvent.press(box);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows unticked above the ceiling even when the caller still says checked', async () => {
    // The order screen derives `useCash` the same way, so a stale tick from
    // before the basket grew must not look active here either.
    await render(
      <CashOnDeliveryCheckbox
        checked
        onChange={jest.fn()}
        total={CASH_MAX_AMOUNT + 1}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Cash on Delivery' }).props.accessibilityState
        .checked,
    ).toBe(false);
  });

  it('drops the amount rather than printing a wrong one when the total is unknown', async () => {
    await render(<CashOnDeliveryCheckbox checked={false} onChange={jest.fn()} />);

    expect(
      screen.getByText('Pay in cash to the rider when your food arrives.'),
    ).toBeTruthy();
  });
});
