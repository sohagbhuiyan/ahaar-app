/**
 * The "once per install" promise, from both ends: the gate that decides
 * whether the tour is shown, and the screen that decides it never will be
 * again.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '@/app/onboarding';
import { OnboardingGate } from '@/components/shared/OnboardingGate';
import { useOnboardingStore } from '@/lib/store';

const mockReplace = jest.fn();
let mockSegments: string[] = ['(tabs)'];

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
}));

/**
 * The persisted state, set without going through AsyncStorage.
 *
 * Deliberately *not* wrapped in `act`: nothing is mounted when this runs, so
 * there is nothing to flush. Worth knowing if you add one anyway — a bare,
 * synchronous `act(() => ...)` leaves its scope open, and every `render` after
 * it in the file silently produces an empty tree. Updates made while something
 * *is* mounted need `await act(async () => ...)`, awaited, at the call site.
 */
function setStore(state: { hasHydrated: boolean; hasSeenOnboarding: boolean }) {
  useOnboardingStore.setState(state);
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSegments = ['(tabs)'];
  setStore({ hasHydrated: false, hasSeenOnboarding: false });
});

describe('OnboardingGate', () => {
  it('waits for the persisted flag rather than assuming a first run', async () => {
    // `hasSeenOnboarding` is false here only because AsyncStorage has not been
    // read yet. Routing on it would restart the tour on every single launch —
    // the one bug this gate exists to avoid.
    await render(
      <OnboardingGate>
        <></>
      </OnboardingGate>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens the tour once the flag is read and says it has not been seen', async () => {
    await render(
      <OnboardingGate>
        <></>
      </OnboardingGate>,
    );

    // Mounted now, so this one does go through `act` — awaited, like every
    // other `act` in the suite, so its scope closes before the next test.
    await act(async () => {
      setStore({ hasHydrated: true, hasSeenOnboarding: false });
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/onboarding'));
  });

  it('leaves a returning customer where they were', async () => {
    setStore({ hasHydrated: true, hasSeenOnboarding: true });

    await render(
      <OnboardingGate>
        <></>
      </OnboardingGate>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not replace the tour with itself while it is open', async () => {
    mockSegments = ['onboarding'];
    setStore({ hasHydrated: true, hasSeenOnboarding: false });

    await render(
      <OnboardingGate>
        <></>
      </OnboardingGate>,
    );

    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('OnboardingScreen', () => {
  it('offers Skip on the way in, and marks the tour seen when taken', async () => {
    await render(<OnboardingScreen />);

    // The heading's hand-placed line break is normalised to a space by the
    // text matcher, so it's queried the way a screen reader would read it.
    expect(screen.getByText('Fresh Food, Every Single Day')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Skip the introduction' }));
    });

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });

  it('ends on Get Started, which is what finally retires the tour', async () => {
    await render(<OnboardingScreen />);

    // Walk to the last card. `Continue` advances; the label is the tell that
    // the end has been reached.
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Continue'));
    });

    expect(screen.queryByText('Continue')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip the introduction' })).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText('Get Started'));
    });

    expect(useOnboardingStore.getState().hasSeenOnboarding).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
