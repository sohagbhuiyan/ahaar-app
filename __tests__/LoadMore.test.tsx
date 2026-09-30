import { fireEvent, render, screen } from '@testing-library/react-native';

import { LoadMore } from '@/components/ui/LoadMore';

describe('LoadMore', () => {
  it('renders nothing on the last page, so an exhausted list simply ends', async () => {
    await render(<LoadMore hasMore={false} loading={false} onPress={jest.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('pages forward only when pressed — never on scroll', async () => {
    const onPress = jest.fn();
    await render(<LoadMore hasMore loading={false} onPress={onPress} />);

    expect(onPress).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('takes a caller-supplied label', async () => {
    await render(
      <LoadMore hasMore loading={false} onPress={jest.fn()} label="Load more dishes" />,
    );

    expect(screen.getByRole('button', { name: 'Load more dishes' })).toBeTruthy();
  });

  it('blocks a second press while a page is already in flight', async () => {
    const onPress = jest.fn();
    await render(<LoadMore hasMore loading onPress={onPress} />);

    const button = screen.getByRole('button');
    expect(button.props.accessibilityState.busy).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
