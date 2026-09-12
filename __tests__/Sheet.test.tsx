import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, Sheet } from '@/components/ui';

/**
 * `Sheet` keeps a boolean `open` in step with the library's imperative modal.
 * `jest/bottom-sheet-mock.js` keeps the modal quirk that once left taps on
 * "Sign in" doing nothing, so these fail if `Sheet` falls out of step again.
 */
const press = (name: string) =>
  act(async () => {
    fireEvent.press(screen.getByRole('button', { name }));
  });

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <BottomSheetModalProvider>
      <Button label="Open sheet" onPress={() => setOpen(true)} />
      <Button label="Close sheet" onPress={() => setOpen(false)} />
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Sheet title"
      >
        <Text>Sheet body</Text>
      </Sheet>
    </BottomSheetModalProvider>
  );
}

describe('Sheet', () => {
  it('opens on the first press', async () => {
    await render(<Harness />);
    expect(screen.queryByText('Sheet body')).toBeNull();

    await press('Open sheet');

    expect(screen.getByText('Sheet body')).toBeTruthy();
  });

  it('opens again after the screen closes it', async () => {
    await render(<Harness />);

    await press('Open sheet');
    await press('Close sheet');
    expect(screen.queryByText('Sheet body')).toBeNull();

    await press('Open sheet');
    expect(screen.getByText('Sheet body')).toBeTruthy();
  });

  it('tells the screen when it is swiped away, then opens on the next press', async () => {
    const onClose = jest.fn();
    await render(<Harness onClose={onClose} />);

    await press('Open sheet');
    await press('Drag sheet closed');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sheet body')).toBeNull();

    await press('Open sheet');
    expect(screen.getByText('Sheet body')).toBeTruthy();
  });
});
