import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { LocationPill } from '@/components/shared/LocationPill';

describe('LocationPill', () => {
  it('holds its place with a skeleton while the location loads', async () => {
    await render(
      <LocationPill location={{ source: null, title: '', isLoading: true }} onPress={jest.fn()} />,
    );

    expect(screen.getByTestId('location-pill-loading')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delivery location, loading' })).toBeTruthy();
  });

  it('invites the customer to set a location when there is none', async () => {
    const onPress = jest.fn();
    await render(
      <LocationPill location={{ source: null, title: '', isLoading: false }} onPress={onPress} />,
    );

    expect(screen.getByText('Set delivery location')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Set delivery location' }));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows where food is going, with a way to change it', async () => {
    const onPress = jest.fn();
    await render(
      <LocationPill
        location={{ source: 'address', title: 'Home · Al Olaya, Riyadh', isLoading: false }}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Home · Al Olaya, Riyadh')).toBeTruthy();
    expect(screen.getByText('Change')).toBeTruthy();

    await act(async () => {
      fireEvent.press(
        screen.getByRole('button', { name: 'Delivering to Home · Al Olaya, Riyadh. Change location' }),
      );
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
