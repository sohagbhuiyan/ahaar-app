import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { FoodImage } from '@/components/shared/FoodImage';

// `expo-image` is the shared mock from jest.setup.js, which passes `onError`
// through so a failed load can be fired by hand.
describe('FoodImage', () => {
  it('shows the picture when there is one', async () => {
    await render(<FoodImage uri="https://cdn.test/roti.jpg" label="Roti" testID="dish" />);

    expect(screen.getByTestId('dish')).toBeTruthy();
    expect(screen.getByLabelText('Roti')).toBeTruthy();
    expect(screen.queryByTestId('dish-fallback')).toBeNull();
  });

  it('shows the food glyph when there is no picture', async () => {
    await render(<FoodImage uri={null} label="Roti" testID="dish" />);

    expect(screen.getByTestId('dish-fallback')).toBeTruthy();
    // The glyph is decoration, hidden from screen readers — the frame carries the name.
    expect(screen.getByText('🍽️', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('dish')).toBeNull();
    // Still named for a screen reader, even without a picture.
    expect(screen.getByLabelText('Roti')).toBeTruthy();
  });

  it('uses the glyph it is given', async () => {
    await render(<FoodImage uri={undefined} glyph="🍱" testID="box" />);

    expect(screen.getByText('🍱', { includeHiddenElements: true })).toBeTruthy();
  });

  it('falls back when the picture fails to load', async () => {
    await render(<FoodImage uri="https://cdn.test/gone.jpg" testID="dish" />);

    await act(async () => {
      fireEvent(screen.getByTestId('dish'), 'error');
    });

    expect(screen.queryByTestId('dish')).toBeNull();
    expect(screen.getByTestId('dish-fallback')).toBeTruthy();
  });

  it('tries again when handed a different picture', async () => {
    const { rerender } = await render(
      <FoodImage uri="https://cdn.test/gone.jpg" testID="dish" />,
    );

    await act(async () => {
      fireEvent(screen.getByTestId('dish'), 'error');
    });
    expect(screen.getByTestId('dish-fallback')).toBeTruthy();

    await rerender(<FoodImage uri="https://cdn.test/dal.jpg" testID="dish" />);

    expect(screen.getByTestId('dish')).toBeTruthy();
  });
});
