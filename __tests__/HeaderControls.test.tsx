/**
 * Home's top-bar controls: the basket icon (reusing the existing basket store
 * and `/order` screen) and the compact language switcher.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CartButton } from '@/components/shared/CartButton';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { useInstantOrderStore } from '@/lib/store';
import { useLanguageStore } from '@/lib/store/useLanguageStore';

const mockPush = jest.fn();
let mockBlur: (() => void) | undefined;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // Run the focus callback once, keep its cleanup: calling it is "the screen lost focus".
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      const cleanup = cb();
      mockBlur = typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

beforeEach(() => {
  mockPush.mockClear();
  useInstantOrderStore.getState().clear();
});

describe('CartButton', () => {
  it('shows no badge on an empty basket and opens the basket screen', async () => {
    await render(<CartButton />);

    expect(screen.queryByTestId('cart-button-badge')).toBeNull();
    expect(screen.getByRole('button', { name: 'Basket' })).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('cart-button'));
    });
    expect(mockPush).toHaveBeenCalledWith('/order');
  });

  it('counts dishes and meal boxes together, like the tab badge', async () => {
    await act(async () => {
      useInstantOrderStore
        .getState()
        .add({ menu_item_id: 1, name: 'Kacchi', unit_price: 20, image_url: null }, 2);
      useInstantOrderStore
        .getState()
        .addPackage({ package_id: 9, name: 'Family box', unit_price: 80, image_url: null, item_count: 4 });
    });

    await render(<CartButton />);

    expect(screen.getByTestId('cart-button-badge')).toHaveTextContent('3');
  });
});

describe('LanguageSwitcher', () => {
  afterEach(async () => {
    await act(async () => {
      await useLanguageStore.getState().setLocale('en');
    });
  });

  it('shows the short code and switches on one tap', async () => {
    await render(<LanguageSwitcher />);
    expect(screen.getByTestId('language-switcher')).toHaveTextContent('en');

    await act(async () => {
      fireEvent.press(screen.getByTestId('language-switcher'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('language-option-bn'));
    });

    expect(useLanguageStore.getState().locale).toBe('bn');
    await waitFor(() => expect(screen.queryByTestId('language-option-bn')).toBeNull());
  });

  it('warns that Arabic restarts the app, before it is chosen', async () => {
    await render(<LanguageSwitcher />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('language-switcher'));
    });

    expect(screen.getByText('Restarts the app to change the layout')).toBeTruthy();
  });

  it('closes when its screen loses focus, so it never floats over another screen', async () => {
    await render(<LanguageSwitcher />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('language-switcher'));
    });
    expect(screen.getByTestId('language-option-en')).toBeTruthy();

    await act(async () => {
      mockBlur?.();
    });

    await waitFor(() => expect(screen.queryByTestId('language-option-en')).toBeNull());
  });
});
